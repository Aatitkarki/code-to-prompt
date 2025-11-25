import * as vscode from "vscode";
import * as path from "path";
import { CodeToPromptTreeProvider, FileNode } from "./fileSystem";
import { formatPrompt, OutputFormat, FileContent } from "./formatter";
import { countTokens } from "./tokenCounter";
import { DashboardPanel } from "./dashboardPanel";
import { SettingsViewProvider } from "./settingsView";
import { PresetsViewProvider } from "./presetsView";
import { parsePromptTextToFilesAuto } from "./importParser";

const STANDARD_FOOTER_NOTE =
  "Always output in same format as provided. Only provide new or files that requires update";

export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const rootUri = workspaceFolders?.[0]?.uri ?? vscode.Uri.file(process.cwd());

  const treeProvider = new CodeToPromptTreeProvider(rootUri);

  const treeView = vscode.window.createTreeView("codeToPromptExplorer", {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

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

  // React to config changes (gitignore & ignorePatterns, etc.)
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration("codeToPrompt")) {
        await treeProvider.reloadConfig();
      }
    })
  );

  // Commands ---------------------------------------------------------------

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "codeToPrompt.toggleSelection",
      (node: FileNode) => {
        treeProvider.toggleSelection(node);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "codeToPrompt.selectOpenEditors",
      async () => {
        const editors = vscode.window.visibleTextEditors;
        const uris = editors
          .map((e) => e.document.uri)
          .filter((uri) => uri.scheme === "file");
        treeProvider.setSelectedUris(uris);
        vscode.window.showInformationMessage(
          `Code to Prompt: Selected ${uris.length} open editor(s).`
        );
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("codeToPrompt.resetSelection", () => {
      treeProvider.clearSelection();
      vscode.window.showInformationMessage(
        "Code to Prompt: Selection cleared."
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("codeToPrompt.reloadFiles", async () => {
      await treeProvider.reloadConfig();
      vscode.window.showInformationMessage(
        "Code to Prompt: File tree reloaded."
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("codeToPrompt.copyPrompt", async () => {
      const files = await getSelectedFileContents(treeProvider);
      if (!files.length) {
        vscode.window.showWarningMessage(
          "Code to Prompt: No files selected. Use the Files view to pick files."
        );
        return;
      }

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
      const includeTreeStructure = config.get<boolean>(
        "includeTreeStructure",
        false
      );
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
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("codeToPrompt.openDashboard", () => {
      DashboardPanel.createOrShow(context.extensionUri);
    })
  );

  // Import prompt from clipboard, auto-detect format, analyze, confirm, then create/overwrite files
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "codeToPrompt.importFromClipboard",
      async () => {
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

        // Auto-detect between XML / JSON / Markdown
        const files = parsePromptTextToFilesAuto(text);
        if (!files.length) {
          vscode.window.showWarningMessage(
            "Code to Prompt: Could not find any files in the clipboard text."
          );
          return;
        }

        // Analyze: new vs updated vs unchanged
        type ImportTask = {
          safePath: string;
          uri: vscode.Uri;
          exists: boolean;
          changed: boolean;
          content: string;
        };

        const newFiles: string[] = [];
        const updatedFiles: string[] = [];
        const unchangedFiles: string[] = [];
        const tasks: ImportTask[] = [];

        for (const f of files) {
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

          let changed = false;
          if (!exists) {
            newFiles.push(safePath);
            changed = true;
          } else if (existingContent !== f.content) {
            updatedFiles.push(safePath);
            changed = true;
          } else {
            unchangedFiles.push(safePath);
            changed = false;
          }

          if (changed) {
            tasks.push({
              safePath,
              uri: targetUri,
              exists,
              changed: true,
              content: f.content,
            });
          }
        }

        if (!tasks.length) {
          vscode.window.showInformationMessage(
            "Code to Prompt: Nothing to import. All files are identical to existing ones."
          );
          return;
        }

        // UX: Confirm with a summary of new/updated files if enabled
        if (requireImportConfirmation) {
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

        // Perform writes
        let created = 0;
        let updated = 0;

        for (const t of tasks) {
          const dirPath = path.dirname(t.uri.fsPath);
          const dirUri = vscode.Uri.file(dirPath);

          try {
            await vscode.workspace.fs.createDirectory(dirUri);
          } catch {
            // ignore; directory may already exist
          }

          await vscode.workspace.fs.writeFile(
            t.uri,
            Buffer.from(t.content, "utf8")
          );

          if (t.exists) {
            updated++;
          } else {
            created++;
          }
        }

        await treeProvider.reloadConfig();

        vscode.window.showInformationMessage(
          `Code to Prompt: Imported ${tasks.length} file(s) from clipboard (${created} new, ${updated} updated).`
        );
      }
    )
  );

  // Dashboard message handler ---------------------------------------------

  DashboardPanel.registerMessageHandler({
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

      const prompt = formatPrompt(
        files,
        format,
        includeLineNumbers,
        headerPrompt,
        footerPrompt,
        includeTreeStructure
      );
      const tokenInfo = await countTokens(prompt);

      return {
        files,
        prompt,
        tokenInfo,
        tokenBudget,
        includeTreeStructure,
        format,
      };
    },
    copyPrompt: async (text: string) => {
      await vscode.env.clipboard.writeText(text);
      vscode.window.showInformationMessage(
        "Code to Prompt: Prompt copied from dashboard."
      );
    },
    updateSelectionOrder: async (paths: string[]) => {
      treeProvider.reorderSelection(paths);
    },
    resetSelection: async () => {
      treeProvider.clearSelection();
    },
  });
}

export function deactivate(): void {
  // nothing to do
}

async function getSelectedFileContents(
  treeProvider: CodeToPromptTreeProvider
): Promise<FileContent[]> {
  const entries = treeProvider.getSelectedFileEntries();
  const result: FileContent[] = [];

  for (const entry of entries) {
    try {
      const data = await vscode.workspace.fs.readFile(entry.uri);
      const text = Buffer.from(data).toString("utf8");
      result.push({ path: entry.relativePath, content: text });
    } catch (err) {
      console.error("Code to Prompt: failed to read", entry.uri.fsPath, err);
    }
  }

  return result;
}

// Prevent paths like "../../etc/passwd" escaping workspace
function sanitizeRelativePath(relPath: string): string | null {
  const normalized = relPath.replace(/\\/g, "/");
  if (!normalized || normalized.startsWith("/")) {
    return null;
  }
  const parts = normalized.split("/").filter((p) => p && p !== ".");
  const safeParts: string[] = [];
  for (const part of parts) {
    if (part === "..") {
      if (safeParts.length === 0) {
        // would go above root
        return null;
      }
      safeParts.pop();
    } else {
      safeParts.push(part);
    }
  }
  return safeParts.join("/");
}

function buildFooterPrompt(
  baseFooter: string,
  appendStandard: boolean
): string {
  if (!appendStandard) {
    return baseFooter;
  }

  if (!baseFooter || !baseFooter.trim()) {
    return STANDARD_FOOTER_NOTE;
  }

  const trimmed = baseFooter.trim();
  // Avoid duplicating the standard note if user already put it there
  if (trimmed.includes(STANDARD_FOOTER_NOTE)) {
    return trimmed;
  }

  return trimmed + "\n\n" + STANDARD_FOOTER_NOTE;
}

function buildImportSummaryMessage(
  newFiles: string[],
  updatedFiles: string[]
): string {
  const totalNew = newFiles.length;
  const totalUpdated = updatedFiles.length;

  const maxShow = 5;

  const lines: string[] = [];
  lines.push(
    `Code to Prompt: This will create ${totalNew} new file(s) and update ${totalUpdated} existing file(s).`
  );

  if (totalNew > 0) {
    lines.push("");
    lines.push("New:");
    const list = newFiles.slice(0, maxShow);
    for (const p of list) {
      lines.push(`- ${p}`);
    }
    if (totalNew > maxShow) {
      lines.push(`- ...and ${totalNew - maxShow} more`);
    }
  }

  if (totalUpdated > 0) {
    lines.push("");
    lines.push("Updated:");
    const list = updatedFiles.slice(0, maxShow);
    for (const p of list) {
      lines.push(`- ${p}`);
    }
    if (totalUpdated > maxShow) {
      lines.push(`- ...and ${totalUpdated - maxShow} more`);
    }
  }

  lines.push("");
  lines.push("Proceed with import?");

  return lines.join("\n");
}
