import * as vscode from "vscode";
import { OutputFormat } from "./formatter";

export class SettingsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = "codeToPromptSettings";

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (message) => {
      if (message.command === "updateSetting") {
        const key = message.key as string;
        const value = message.value;
        const config = vscode.workspace.getConfiguration("codeToPrompt");
        await config.update(key, value, true);
      }
    });
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = Date.now().toString();
    const config = vscode.workspace.getConfiguration("codeToPrompt");

    const defaultFormat =
      (config.get<OutputFormat>("defaultFormat", "markdown") as OutputFormat) ||
      "markdown";
    const includeLineNumbers = config.get<boolean>("includeLineNumbers", false);
    const includeTreeStructure = config.get<boolean>(
      "includeTreeStructure",
      false
    );
    const tokenBudget = config.get<number>("tokenBudget", 32000);
    const respectGitignore = config.get<boolean>("respectGitignore", true);
    const ignorePatterns = config.get<string>("ignorePatterns", "") || "";
    const headerPrompt = config.get<string>("headerPrompt", "") || "";
    const footerPrompt = config.get<string>("footerPrompt", "") || "";
    const appendStandardFooterNote = config.get<boolean>(
      "appendStandardFooterNote",
      true
    );
    const requireImportConfirmation = config.get<boolean>(
      "requireImportConfirmation",
      true
    );

    const initialSettings = {
      defaultFormat,
      includeLineNumbers,
      includeTreeStructure,
      tokenBudget,
      respectGitignore,
      ignorePatterns,
      headerPrompt,
      footerPrompt,
      appendStandardFooterNote,
      requireImportConfirmation,
    };

    const standardFooterText =
      "Always output in same format as provided. Only provide new or files that requires update";

    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Code to Prompt Settings</title>
          <style>
            body {
              font-family: var(--vscode-font-family);
              color: var(--vscode-foreground);
              background-color: var(--vscode-sideBar-background);
              margin: 0;
              padding: 8px;
            }
            h3 {
              margin-top: 12px;
              font-size: 13px;
            }
            h3:first-of-type {
              margin-top: 0;
            }
            .field {
              margin-bottom: 8px;
            }
            label {
              font-size: 12px;
              display: block;
              margin-bottom: 2px;
            }
            select, input[type="number"] {
              width: 100%;
              box-sizing: border-box;
            }
            input[type="checkbox"] {
              margin-right: 4px;
            }
            textarea {
              width: 100%;
              box-sizing: border-box;
              font-family: var(--vscode-editor-font-family);
              font-size: 12px;
            }
            .hint {
              font-size: 11px;
              opacity: 0.8;
            }
          </style>
        </head>
        <body>
          <h3>Prompt Settings</h3>
          <div class="field">
            <label for="format">Format</label>
            <select id="format">
              <option value="markdown">Markdown</option>
              <option value="xml">XML</option>
              <option value="json">JSON</option>
            </select>
          </div>
          <div class="field">
            <label><input type="checkbox" id="lineNumbers" /> Include line numbers</label>
          </div>
          <div class="field">
            <label><input type="checkbox" id="treeStructure" /> Include tree structure (markdown/json)</label>
          </div>
          <div class="field">
            <label><input type="checkbox" id="respectGitignore" /> Respect .gitignore</label>
            <div class="hint">When disabled, .gitignore rules are ignored and all files (except binaries and custom ignore patterns) are shown.</div>
          </div>
          <div class="field">
            <label for="ignorePatterns">Ignore patterns</label>
            <textarea id="ignorePatterns" rows="4" placeholder="e.g.\n*.log\n*.tmp\nbuild/"></textarea>
            <div class="hint">Additional ignore patterns, one per line, using .gitignore-style globs.</div>
          </div>
          <div class="field">
            <label for="tokenBudget">Token budget</label>
            <input type="number" id="tokenBudget" min="1000" step="1000" />
            <div class="hint">Used for warnings in notifications and dashboard.</div>
          </div>

          <h3>Header / Footer Prompts</h3>
          <div class="field">
            <label for="headerPrompt">Header prompt (optional)</label>
            <textarea id="headerPrompt" rows="3" placeholder="This is my current code, help me fix the bug in ..."></textarea>
            <div class="hint">Prepended above the generated prompt. Great for task instructions.</div>
          </div>
          <div class="field">
            <label for="footerPrompt">Footer prompt (optional)</label>
            <textarea id="footerPrompt" rows="3" placeholder="Any extra notes for the AI..."></textarea>
            <div class="hint">Appended below the generated prompt.</div>
          </div>
          <div class="field">
            <label>
              <input type="checkbox" id="appendStandardFooterNote" />
              Append note: "<span id="standardFooterText">${standardFooterText}</span>"
            </label>
            <div class="hint">This note is helpful to keep the AI output in the same multi-file format and avoid unchanged files.</div>
          </div>

          <h3>Import Settings</h3>
          <div class="field">
            <label>
              <input type="checkbox" id="requireImportConfirmation" />
              Require confirmation before importing prompt files
            </label>
            <div class="hint">Shows a summary of new and updated files before writing them to disk.</div>
          </div>

          <script nonce="${nonce}">
            const vscode = acquireVsCodeApi();
            const settings = ${JSON.stringify(initialSettings)};

            const formatEl = document.getElementById('format');
            const lineNumbersEl = document.getElementById('lineNumbers');
            const treeStructureEl = document.getElementById('treeStructure');
            const respectGitignoreEl = document.getElementById('respectGitignore');
            const ignorePatternsEl = document.getElementById('ignorePatterns');
            const tokenBudgetEl = document.getElementById('tokenBudget');
            const headerPromptEl = document.getElementById('headerPrompt');
            const footerPromptEl = document.getElementById('footerPrompt');
            const appendStandardFooterNoteEl = document.getElementById('appendStandardFooterNote');
            const requireImportConfirmationEl = document.getElementById('requireImportConfirmation');

            formatEl.value = settings.defaultFormat;
            lineNumbersEl.checked = !!settings.includeLineNumbers;
            treeStructureEl.checked = !!settings.includeTreeStructure;
            respectGitignoreEl.checked = !!settings.respectGitignore;
            ignorePatternsEl.value = settings.ignorePatterns || "";
            tokenBudgetEl.value = settings.tokenBudget;
            headerPromptEl.value = settings.headerPrompt || "";
            footerPromptEl.value = settings.footerPrompt || "";
            appendStandardFooterNoteEl.checked = !!settings.appendStandardFooterNote;
            requireImportConfirmationEl.checked = !!settings.requireImportConfirmation;

            formatEl.addEventListener('change', () => {
              vscode.postMessage({ command: 'updateSetting', key: 'defaultFormat', value: formatEl.value });
            });

            lineNumbersEl.addEventListener('change', () => {
              vscode.postMessage({ command: 'updateSetting', key: 'includeLineNumbers', value: lineNumbersEl.checked });
            });

            treeStructureEl.addEventListener('change', () => {
              vscode.postMessage({ command: 'updateSetting', key: 'includeTreeStructure', value: treeStructureEl.checked });
            });

            respectGitignoreEl.addEventListener('change', () => {
              vscode.postMessage({ command: 'updateSetting', key: 'respectGitignore', value: respectGitignoreEl.checked });
            });

            ignorePatternsEl.addEventListener('change', () => {
              vscode.postMessage({ command: 'updateSetting', key: 'ignorePatterns', value: ignorePatternsEl.value });
            });

            tokenBudgetEl.addEventListener('change', () => {
              const v = parseInt(tokenBudgetEl.value, 10) || 0;
              vscode.postMessage({ command: 'updateSetting', key: 'tokenBudget', value: v });
            });

            headerPromptEl.addEventListener('change', () => {
              vscode.postMessage({ command: 'updateSetting', key: 'headerPrompt', value: headerPromptEl.value });
            });

            footerPromptEl.addEventListener('change', () => {
              vscode.postMessage({ command: 'updateSetting', key: 'footerPrompt', value: footerPromptEl.value });
            });

            appendStandardFooterNoteEl.addEventListener('change', () => {
              vscode.postMessage({
                command: 'updateSetting',
                key: 'appendStandardFooterNote',
                value: appendStandardFooterNoteEl.checked
              });
            });

            requireImportConfirmationEl.addEventListener('change', () => {
              vscode.postMessage({
                command: 'updateSetting',
                key: 'requireImportConfirmation',
                value: requireImportConfirmationEl.checked
              });
            });
          </script>
        </body>
      </html>
    `;
  }
}
