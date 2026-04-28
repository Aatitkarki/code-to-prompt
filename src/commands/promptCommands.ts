import * as vscode from "vscode";
import * as path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { CodeToPromptTreeProvider } from "../fileSystem";
import {
    formatPrompt,
    formatCommitPrompt,
    OutputFormat,
    CommitFileContent,
    CommitInfo,
} from "../formatter";
import { countTokens } from "../tokenCounter";
import {
    buildFooterPrompt,
    buildImportSummaryMessage,
    getSelectedFileContents,
    sanitizeRelativePath,
} from "../utils/promptUtils";
import { getGitChangedFilePathsForCommits } from "../git/gitHelpers";
import {
    lastCommitSelection,
    setLastCommitSelection,
    performCommitSelection,
} from "./selectionCommands";
import { parsePromptTextToCommitGroups } from "../importParser";

const execFileAsync = promisify(execFile);

// ─── Shared config reader ─────────────────────────────────────────────────────

interface PromptConfig {
    format: OutputFormat;
    includeLineNumbers: boolean;
    includeTreeStructure: boolean;
    footerPrompt: string;
    headerPrompt: string;
    tokenBudget: number;
}

function readPromptConfig(): PromptConfig {
    const config = vscode.workspace.getConfiguration("codeToPrompt");
    const format =
        (config.get<OutputFormat>("defaultFormat", "markdown") as OutputFormat) ||
        "markdown";
    const includeLineNumbers = config.get<boolean>("includeLineNumbers", false);
    const includeTreeStructure = config.get<boolean>("includeTreeStructure", false);
    const headerPrompt = config.get<string>("headerPrompt", "") || "";
    const baseFooterPrompt = config.get<string>("footerPrompt", "") || "";
    const appendStandardFooterNote = config.get<boolean>("appendStandardFooterNote", true);
    const tokenBudget = config.get<number>("tokenBudget", 32000);
    const footerPrompt = buildFooterPrompt(baseFooterPrompt, appendStandardFooterNote);
    return { format, includeLineNumbers, includeTreeStructure, headerPrompt, footerPrompt, tokenBudget };
}

// ─── copyPrompt ───────────────────────────────────────────────────────────────

/**
 * Reads selected file contents, formats them as a prompt, copies to clipboard
 * and shows a token-count notification.
 */
async function copyPrompt(
    treeProvider: CodeToPromptTreeProvider
): Promise<void> {
    const files = await getSelectedFileContents(treeProvider);
    if (!files.length) {
        vscode.window.showWarningMessage(
            "Code to Prompt: No files selected. Use the Files view to pick files."
        );
        return;
    }

    const { format, includeLineNumbers, includeTreeStructure, headerPrompt, footerPrompt, tokenBudget } =
        readPromptConfig();

    const prompt = formatPrompt(
        files,
        format,
        includeLineNumbers,
        headerPrompt,
        footerPrompt,
        includeTreeStructure
    );
    const tokenInfo = await countTokens(prompt);
    await vscode.env.clipboard.writeText(prompt);

    const msg = `Code to Prompt: Copied prompt to clipboard. Tokens: ${tokenInfo.tokens}`;
    if (tokenInfo.tokens > tokenBudget) {
        vscode.window.showWarningMessage(
            `${msg} (above your configured budget of ${tokenBudget} tokens).`
        );
    } else {
        vscode.window.showInformationMessage(msg);
    }
}

// ─── copyCommitPrompt ─────────────────────────────────────────────────────────

/**
 * Shows the commit picker, then fetches each file's content at the selected
 * commit(s) via `git show` and copies the resulting prompt to the clipboard.
 */
async function copyCommitPrompt(
    rootUri: vscode.Uri,
    treeProvider: CodeToPromptTreeProvider
): Promise<void> {
    const selected = await performCommitSelection(rootUri, treeProvider);
    if (!selected || !lastCommitSelection) {
        return;
    }

    const entries = treeProvider.getSelectedFileEntries();
    if (!entries.length) {
        vscode.window.showWarningMessage(
            "Code to Prompt: No files selected for the chosen commits."
        );
        return;
    }

    const { format, includeLineNumbers, headerPrompt, footerPrompt, tokenBudget } =
        readPromptConfig();

    const commitMap = new Map<string, CommitInfo>(
        lastCommitSelection.commits.map((c) => [c.hash, c])
    );
    const selectedPaths = new Set(entries.map((e) => e.relativePath));
    const commitFiles: CommitFileContent[] = [];

    for (const hash of lastCommitSelection.hashes) {
        const commitInfo = commitMap.get(hash);
        if (!commitInfo) {
            continue;
        }

        const changedFiles = await getGitChangedFilePathsForCommits(rootUri, [hash]);
        for (const relPath of changedFiles) {
            if (!selectedPaths.has(relPath)) {
                continue;
            }
            try {
                const result = await execFileAsync(
                    "git",
                    ["show", `${hash}:${relPath}`],
                    { cwd: rootUri.fsPath, encoding: "utf8", maxBuffer: 1024 * 1024 * 10 }
                );
                commitFiles.push({ path: relPath, content: result.stdout, commit: commitInfo });
            } catch (err) {
                console.error(
                    `Code to Prompt: failed to git show ${hash}:${relPath}`,
                    err
                );
            }
        }
    }

    if (!commitFiles.length) {
        vscode.window.showWarningMessage(
            "Code to Prompt: Could not retrieve file contents from selected commits."
        );
        return;
    }

    const prompt = formatCommitPrompt(
        commitFiles,
        format,
        includeLineNumbers,
        headerPrompt,
        footerPrompt
    );
    const tokenInfo = await countTokens(prompt);
    await vscode.env.clipboard.writeText(prompt);

    const msg = `Code to Prompt: Copied commit changes to clipboard. ${commitFiles.length} files from ${lastCommitSelection.hashes.length} commits. Tokens: ${tokenInfo.tokens}`;
    if (tokenInfo.tokens > tokenBudget) {
        vscode.window.showWarningMessage(
            `${msg} (above your configured budget of ${tokenBudget} tokens).`
        );
    } else {
        vscode.window.showInformationMessage(msg);
    }
}

// ─── importFromClipboard ──────────────────────────────────────────────────────

/**
 * Reads the clipboard, auto-detects the prompt format, shows a confirmation
 * dialog, writes files to disk, and optionally creates Git commits.
 */
async function importFromClipboard(
    rootUri: vscode.Uri,
    treeProvider: CodeToPromptTreeProvider
): Promise<void> {
    const config = vscode.workspace.getConfiguration("codeToPrompt");
    const requireImportConfirmation = config.get<boolean>(
        "requireImportConfirmation",
        true
    );

    const text = await vscode.env.clipboard.readText();
    if (!text || !text.trim()) {
        vscode.window.showWarningMessage(
            "Code to Prompt: Clipboard is empty or does not contain text."
        );
        return;
    }

    const commitGroups = parsePromptTextToCommitGroups(text);
    const hasExplicitCommits = commitGroups.some((g) => g.subject);
    const totalFiles = commitGroups.reduce((acc, g) => acc + g.files.length, 0);

    if (totalFiles === 0) {
        vscode.window.showWarningMessage(
            "Code to Prompt: Could not find any files in the clipboard text."
        );
        return;
    }

    // ── Confirm action ──────────────────────────────────────────────────────────
    let doGitCommits = false;

    if (hasExplicitCommits) {
        const commitCount = commitGroups.filter((g) => g.subject).length;
        const choice = await vscode.window.showWarningMessage(
            `Code to Prompt: This prompt contains ${commitCount} explicit commit(s). Do you want to apply changes and create Git commits automatically?`,
            { modal: true },
            "Apply & Commit",
            "Apply Files Only",
            "Cancel"
        );
        if (!choice || choice === "Cancel") {
            return;
        }
        if (choice === "Apply & Commit") {
            doGitCommits = true;
        }
    } else if (requireImportConfirmation) {
        const allFiles = commitGroups.flatMap((g) => g.files);
        const newFiles: string[] = [];
        const updatedFiles: string[] = [];

        for (const f of allFiles) {
            const safePath = sanitizeRelativePath(f.path);
            if (!safePath) {
                continue;
            }
            const targetUri = vscode.Uri.joinPath(rootUri, safePath);
            try {
                const buf = await vscode.workspace.fs.readFile(targetUri);
                const existingContent = Buffer.from(buf).toString("utf8");
                if (existingContent !== f.content) {
                    updatedFiles.push(safePath);
                }
            } catch {
                newFiles.push(safePath);
            }
        }

        if (newFiles.length === 0 && updatedFiles.length === 0) {
            vscode.window.showInformationMessage(
                "Code to Prompt: Nothing to import. All files are identical to existing ones."
            );
            return;
        }

        const summary = buildImportSummaryMessage(newFiles, updatedFiles);
        const choice = await vscode.window.showWarningMessage(
            summary,
            { modal: true },
            "Import",
            "Cancel"
        );
        if (choice !== "Import") {
            return;
        }
    }

    // ── Write files ─────────────────────────────────────────────────────────────
    let created = 0;
    let updated = 0;

    for (const group of commitGroups) {
        const writtenUris: vscode.Uri[] = [];

        for (const f of group.files) {
            const safePath = sanitizeRelativePath(f.path);
            if (!safePath) {
                continue;
            }

            const targetUri = vscode.Uri.joinPath(rootUri, safePath);
            let exists = false;
            let existingContent: string | null = null;
            try {
                const buf = await vscode.workspace.fs.readFile(targetUri);
                exists = true;
                existingContent = Buffer.from(buf).toString("utf8");
            } catch {
                exists = false;
            }

            if (!exists || existingContent !== f.content) {
                const dirPath = path.dirname(targetUri.fsPath);
                try {
                    await vscode.workspace.fs.createDirectory(vscode.Uri.file(dirPath));
                } catch { }

                await vscode.workspace.fs.writeFile(
                    targetUri,
                    Buffer.from(f.content, "utf8")
                );
                writtenUris.push(targetUri);

                if (exists) {
                    updated++;
                } else {
                    created++;
                }
            }
        }

        if (doGitCommits && group.subject && writtenUris.length > 0) {
            const pathsToStage = writtenUris.map((u) => u.fsPath);
            try {
                await execFileAsync("git", ["add", ...pathsToStage], {
                    cwd: rootUri.fsPath,
                });
                const commitEnv = { ...process.env };
                if (group.timestamp) {
                    commitEnv["GIT_AUTHOR_DATE"] = group.timestamp;
                    commitEnv["GIT_COMMITTER_DATE"] = group.timestamp;
                }
                await execFileAsync("git", ["commit", "-m", group.subject], {
                    cwd: rootUri.fsPath,
                    env: commitEnv,
                });
            } catch (err: any) {
                vscode.window.showErrorMessage(
                    "Code to Prompt: Git commit failed: " + err.message
                );
            }
        }
    }

    await treeProvider.reloadConfig();

    let msg = `Code to Prompt: Imported ${created + updated} file(s) from clipboard (${created} new, ${updated} updated).`;
    if (doGitCommits) {
        msg += " Automatically created Git commits.";
    }
    vscode.window.showInformationMessage(msg);
}

// ─── Command registration ─────────────────────────────────────────────────────

export function registerPromptCommands(
    context: vscode.ExtensionContext,
    rootUri: vscode.Uri,
    treeProvider: CodeToPromptTreeProvider
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "codeToPrompt.copyPrompt",
            async () => await copyPrompt(treeProvider)
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "codeToPrompt.copyCommitPrompt",
            async () => await copyCommitPrompt(rootUri, treeProvider)
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "codeToPrompt.importFromClipboard",
            async () => await importFromClipboard(rootUri, treeProvider)
        )
    );
}

// Re-export state setters so the dashboard command can clear commit selection
export { lastCommitSelection, setLastCommitSelection };