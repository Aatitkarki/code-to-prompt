import * as vscode from "vscode";
import { CodeToPromptTreeProvider } from "./fileSystem";
import { SettingsViewProvider } from "./settingsView";
import { PresetsViewProvider } from "./presetsView";
import { registerSelectionCommands } from "./commands/selectionCommands";
import { registerPromptCommands } from "./commands/promptCommands";
import { registerDashboardCommand } from "./commands/dashboardCommand";

export async function activate(
    context: vscode.ExtensionContext
): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const rootUri = workspaceFolders?.[0]?.uri ?? vscode.Uri.file(process.cwd());

    // ── File tree provider ──────────────────────────────────────────────────────
    const treeProvider = new CodeToPromptTreeProvider(rootUri);
    const treeView = vscode.window.createTreeView("codeToPromptExplorer", {
        treeDataProvider: treeProvider,
        showCollapseAll: true,
    });
    context.subscriptions.push(treeView);

    // ── Settings & Presets sidebar views ───────────────────────────────────────
    const settingsProvider = new SettingsViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            SettingsViewProvider.viewId,
            settingsProvider
        )
    );

    const presetsProvider = new PresetsViewProvider(
        context.extensionUri,
        treeProvider,
        context.globalState
    );
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            PresetsViewProvider.viewId,
            presetsProvider
        )
    );

    // ── React to configuration changes ─────────────────────────────────────────
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(async (e) => {
            if (e.affectsConfiguration("codeToPrompt")) {
                await treeProvider.reloadConfig();
            }
        })
    );

    // ── Register commands ───────────────────────────────────────────────────────
    registerSelectionCommands(context, rootUri, treeProvider);
    registerPromptCommands(context, rootUri, treeProvider);
    registerDashboardCommand(context, rootUri, treeProvider);
}

export function deactivate(): void {
    // nothing to do
}