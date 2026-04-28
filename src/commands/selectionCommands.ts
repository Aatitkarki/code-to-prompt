import * as vscode from "vscode";
import * as path from "path";
import { CodeToPromptTreeProvider } from "../fileSystem";
import {
    getGitChangedFilePaths,
    getGitChangedFilePathsForRange,
    getDefaultBaseRef,
    getBranchCommits,
    getGitChangedFilePathsForCommits,
    GitCommitPickItem,
} from "../git/gitHelpers";
import { CommitInfo } from "../formatter";
import { getAllFilePaths } from "../utils/promptUtils";

// Re-export so consuming modules can reference the type without reaching into git/
export { GitCommitPickItem };

// ─── Commit selection state ───────────────────────────────────────────────────

/**
 * Stores the commit hashes + metadata from the most recent "Select Commit
 * Changes" / "Copy Commit Prompt" invocation so the dashboard and copy command
 * can reuse it without prompting again.
 */
export let lastCommitSelection: {
    hashes: string[];
    commits: CommitInfo[];
} | null = null;

export function setLastCommitSelection(
    value: { hashes: string[]; commits: CommitInfo[] } | null
): void {
    lastCommitSelection = value;
}

// ─── Shared commit-selection UI ───────────────────────────────────────────────

/**
 * Shows the commit QuickPick, updates file selection in the tree, and
 * optionally records the commit metadata for prompt generation.
 *
 * @param updateCommitMode  When `true` (default), stores commit metadata in
 *   `lastCommitSelection` so prompts include per-commit context.
 *   When `false`, only selects the changed files in their current state.
 */
export async function performCommitSelection(
    rootUri: vscode.Uri,
    treeProvider: CodeToPromptTreeProvider,
    updateCommitMode = true
): Promise<boolean> {
    const baseRef = await getDefaultBaseRef(rootUri);
    if (!baseRef) {
        vscode.window.showWarningMessage(
            "Code to Prompt: Could not find a Git base branch to list commits."
        );
        return false;
    }

    const commits = await getBranchCommits(rootUri, baseRef);
    if (!commits.length) {
        vscode.window.showInformationMessage(
            `Code to Prompt: No branch commits found compared with ${baseRef}.`
        );
        return false;
    }

    const selectedCommits = await vscode.window.showQuickPick(commits, {
        canPickMany: true,
        matchOnDescription: true,
        matchOnDetail: true,
        placeHolder: "Select commits to include changed files from...",
        title: "Select Commit Changes",
    });

    if (!selectedCommits || !selectedCommits.length) {
        return false;
    }

    // Sort chronologically (oldest → newest).
    // `commits` is ordered newest → oldest, so higher index = older commit.
    const chronological = [...selectedCommits].sort(
        (a, b) => commits.indexOf(b) - commits.indexOf(a)
    );

    const selectedHashes = chronological.map((item) => item.hash);
    const changedPaths = await getGitChangedFilePathsForCommits(
        rootUri,
        selectedHashes
    );

    if (!changedPaths.length) {
        vscode.window.showInformationMessage(
            "Code to Prompt: No selectable files found for the selected commits."
        );
        return false;
    }

    if (updateCommitMode) {
        lastCommitSelection = {
            hashes: selectedHashes,
            commits: selectedCommits.map((item) => ({
                hash: item.hash,
                shortHash: item.hash.substring(0, 7),
                subject: item.label?.replace(/^[a-f0-9]+\s+/, "") || "(no subject)",
                author: item.detail?.replace(/^by\s+/, "") || "unknown",
                relativeDate: item.description || "",
                absoluteDate: item.absoluteDate,
            })),
        };
    } else {
        // Plain file-selection mode: no commit-mode context
        lastCommitSelection = null;
    }

    treeProvider.setSelectedPaths(changedPaths);
    vscode.window.showInformationMessage(
        `Code to Prompt: Selected ${changedPaths.length} file${changedPaths.length === 1 ? "" : "s"
        } from ${selectedHashes.length} commit${selectedHashes.length === 1 ? "" : "s"
        }.`
    );

    return true;
}

// ─── Command registration ─────────────────────────────────────────────────────

export function registerSelectionCommands(
    context: vscode.ExtensionContext,
    rootUri: vscode.Uri,
    treeProvider: CodeToPromptTreeProvider
): void {
    // Toggle a single node in the tree
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "codeToPrompt.toggleSelection",
            (node) => treeProvider.toggleSelection(node)
        )
    );

    // Select all currently visible editor tabs
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "codeToPrompt.selectOpenEditors",
            async () => {
                const uris = vscode.window.visibleTextEditors
                    .map((e) => e.document.uri)
                    .filter((uri) => uri.scheme === "file");
                treeProvider.setSelectedUris(uris);
                vscode.window.showInformationMessage(
                    `Code to Prompt: Selected ${uris.length} open editor(s).`
                );
            }
        )
    );

    // Select files with working-tree changes
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "codeToPrompt.selectGitChanges",
            async () => {
                const changedPaths = await getGitChangedFilePaths(rootUri);
                if (!changedPaths.length) {
                    vscode.window.showInformationMessage(
                        "Code to Prompt: No git changed files found."
                    );
                    return;
                }
                treeProvider.setSelectedPaths(changedPaths);
                vscode.window.showInformationMessage(
                    `Code to Prompt: Selected ${changedPaths.length} git changed file${changedPaths.length === 1 ? "" : "s"
                    }.`
                );
            }
        )
    );

    // Select files changed on this branch vs base branch
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "codeToPrompt.selectBranchChanges",
            async () => {
                const baseRef = await getDefaultBaseRef(rootUri);
                if (!baseRef) {
                    vscode.window.showWarningMessage(
                        "Code to Prompt: Could not find a Git base branch to compare."
                    );
                    return;
                }

                const changedPaths = await getGitChangedFilePathsForRange(
                    rootUri,
                    `${baseRef}...HEAD`
                );

                if (!changedPaths.length) {
                    vscode.window.showInformationMessage(
                        `Code to Prompt: No changed files found on this branch compared with ${baseRef}.`
                    );
                    return;
                }

                treeProvider.setSelectedPaths(changedPaths);
                vscode.window.showInformationMessage(
                    `Code to Prompt: Selected ${changedPaths.length} branch changed file${changedPaths.length === 1 ? "" : "s"
                    }.`
                );
            }
        )
    );

    // Select files changed in specific commits (current-state, no commit mode)
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "codeToPrompt.selectCommitChanges",
            async () => {
                await performCommitSelection(rootUri, treeProvider, false);
            }
        )
    );

    // Clear the entire selection
    context.subscriptions.push(
        vscode.commands.registerCommand("codeToPrompt.resetSelection", () => {
            treeProvider.clearSelection();
            vscode.window.showInformationMessage("Code to Prompt: Selection cleared.");
        })
    );

    // Force a full reload of the file tree
    context.subscriptions.push(
        vscode.commands.registerCommand("codeToPrompt.reloadFiles", async () => {
            await treeProvider.reloadConfig();
            vscode.window.showInformationMessage(
                "Code to Prompt: File tree reloaded."
            );
        })
    );

    // Fuzzy-search files and add them to the selection
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "codeToPrompt.searchFiles",
            async () => await searchAndSelectFiles(treeProvider)
        )
    );
}

// ─── Search & select helper ───────────────────────────────────────────────────

async function searchAndSelectFiles(
    treeProvider: CodeToPromptTreeProvider
): Promise<void> {
    const allFiles = await getAllFilePaths(treeProvider);

    if (allFiles.length === 0) {
        vscode.window.showInformationMessage(
            "Code to Prompt: No files available to search."
        );
        return;
    }

    const quickPick = vscode.window.createQuickPick();
    quickPick.placeholder = "Search for files to select...";
    quickPick.canSelectMany = true;
    quickPick.matchOnDescription = true;
    quickPick.matchOnDetail = true;

    const items = allFiles.map((filePath) => ({
        label: path.basename(filePath),
        description: path.dirname(filePath),
        detail: filePath,
        picked: treeProvider.getSelectedPaths().includes(filePath),
    }));

    quickPick.items = items;

    quickPick.onDidChangeValue((value) => {
        if (!value.trim()) {
            quickPick.items = items;
            return;
        }
        const search = value.toLowerCase();
        quickPick.items = items.filter(
            (item) =>
                item.label.toLowerCase().includes(search) ||
                item.detail.toLowerCase().includes(search)
        );
    });

    quickPick.onDidAccept(() => {
        const selectedPaths = quickPick.selectedItems
            .map((item) => item.detail)
            .filter((d): d is string => d !== undefined);

        treeProvider.setSelectedPaths(selectedPaths);
        vscode.window.showInformationMessage(
            `Code to Prompt: Selected ${selectedPaths.length} file${selectedPaths.length === 1 ? "" : "s"
            } from search.`
        );
        quickPick.hide();
    });

    quickPick.onDidHide(() => quickPick.dispose());
    quickPick.show();
}