import * as vscode from "vscode";
import { execFile } from "child_process";
import { promisify } from "util";
import { CodeToPromptTreeProvider } from "../fileSystem";
import { DashboardPanel } from "../dashboardPanel";
import {
    formatPrompt,
    formatCommitPrompt,
    OutputFormat,
    CommitFileContent,
} from "../formatter";
import { countTokens } from "../tokenCounter";
import {
    buildFooterPrompt,
    getSelectedFileContents,
} from "../utils/promptUtils";
import { getGitChangedFilePathsForCommits } from "../git/gitHelpers";
import { performCommitSelection } from "./selectionCommands";
import {
    lastCommitSelection,
    setLastCommitSelection,
} from "./promptCommands";

const execFileAsync = promisify(execFile);

// ─── Command registration ─────────────────────────────────────────────────────

export function registerDashboardCommand(
    context: vscode.ExtensionContext,
    rootUri: vscode.Uri,
    treeProvider: CodeToPromptTreeProvider
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand("codeToPrompt.openDashboard", () => {
            DashboardPanel.createOrShow(context.extensionUri);
        })
    );

    DashboardPanel.registerMessageHandler({
        // ── getSelection ────────────────────────────────────────────────────────
        getSelection: async (options) => {
            const files = await getSelectedFileContents(treeProvider);
            const config = vscode.workspace.getConfiguration("codeToPrompt");

            const format =
                (config.get<OutputFormat>(
                    "defaultFormat",
                    "markdown"
                ) as OutputFormat) || "markdown";
            const includeLineNumbers = config.get<boolean>(
                "includeLineNumbers",
                false
            );
            const includeTreeStructureConfig = config.get<boolean>(
                "includeTreeStructure",
                false
            );
            const includeTreeStructure =
                options && typeof options.includeTreeStructure === "boolean"
                    ? options.includeTreeStructure
                    : includeTreeStructureConfig;
            const headerPrompt = config.get<string>("headerPrompt", "") || "";
            const baseFooterPrompt = config.get<string>("footerPrompt", "") || "";
            const appendStandardFooterNote = config.get<boolean>(
                "appendStandardFooterNote",
                true
            );
            const tokenBudget = config.get<number>("tokenBudget", 32000);
            const footerPrompt = buildFooterPrompt(
                baseFooterPrompt,
                appendStandardFooterNote
            );

            // ── Commit mode: use git-show content per commit ─────────────────────
            let prompt = "";
            let isCommitMode = false;

            if (
                lastCommitSelection &&
                lastCommitSelection.commits.length > 0 &&
                files.length > 0
            ) {
                const commitMap = new Map(
                    lastCommitSelection.commits.map((c) => [c.hash, c])
                );
                const selectedPaths = new Set(files.map((f) => f.path));
                const commitFiles: CommitFileContent[] = [];

                for (const hash of lastCommitSelection.hashes) {
                    const commitInfo = commitMap.get(hash);
                    if (!commitInfo) {
                        continue;
                    }

                    const changedFiles = await getGitChangedFilePathsForCommits(
                        rootUri,
                        [hash]
                    );
                    for (const relPath of changedFiles) {
                        if (!selectedPaths.has(relPath)) {
                            continue;
                        }
                        try {
                            const result = await execFileAsync(
                                "git",
                                ["show", `${hash}:${relPath}`],
                                {
                                    cwd: rootUri.fsPath,
                                    encoding: "utf8",
                                    maxBuffer: 1024 * 1024 * 10,
                                }
                            );
                            commitFiles.push({
                                path: relPath,
                                content: result.stdout,
                                commit: commitInfo,
                            });
                        } catch {
                            // fallback to normal mode below
                        }
                    }
                }

                if (commitFiles.length > 0) {
                    isCommitMode = true;
                    prompt = formatCommitPrompt(
                        commitFiles,
                        format,
                        includeLineNumbers,
                        headerPrompt,
                        footerPrompt
                    );
                }
            }

            // ── Normal mode ───────────────────────────────────────────────────────
            if (!isCommitMode) {
                prompt = formatPrompt(
                    files,
                    format,
                    includeLineNumbers,
                    headerPrompt,
                    footerPrompt,
                    includeTreeStructure
                );
            }

            const tokenInfo = await countTokens(prompt);

            return {
                files,
                prompt,
                tokenInfo,
                tokenBudget,
                includeTreeStructure,
                format,
                commits:
                    isCommitMode && lastCommitSelection
                        ? lastCommitSelection.commits
                        : undefined,
            };
        },

        // ── copyPrompt ────────────────────────────────────────────────────────
        copyPrompt: async (text: string) => {
            await vscode.env.clipboard.writeText(text);
            vscode.window.showInformationMessage(
                "Code to Prompt: Prompt copied from dashboard."
            );
        },

        // ── updateSelectionOrder ──────────────────────────────────────────────
        updateSelectionOrder: async (paths: string[]) => {
            treeProvider.reorderSelection(paths);
        },

        // ── resetSelection ────────────────────────────────────────────────────
        resetSelection: async () => {
            treeProvider.clearSelection();
            setLastCommitSelection(null);
        },

        // ── selectCommits ─────────────────────────────────────────────────────
        selectCommits: async () => {
            return performCommitSelection(rootUri, treeProvider);
        },
    });
}