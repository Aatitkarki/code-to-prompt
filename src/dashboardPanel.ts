import * as vscode from "vscode";
import { TokenInfo } from "./tokenCounter";
import { FileContent } from "./formatter";

interface PromptOptions {
  includeTreeStructure?: boolean;
}

interface DashboardSelectionData {
  files: FileContent[];
  prompt: string;
  tokenInfo: TokenInfo;
  tokenBudget: number;
  includeTreeStructure: boolean;
  format: string;
}

interface DashboardMessageHandler {
  getSelection: (options?: PromptOptions) => Promise<DashboardSelectionData>;
  copyPrompt: (text: string) => Promise<void>;
  updateSelectionOrder: (paths: string[]) => Promise<void>;
  resetSelection: () => Promise<void>;
}

export class DashboardPanel {
  public static currentPanel: DashboardPanel | undefined;
  private static messageHandler: DashboardMessageHandler | null = null;

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;

  public static createOrShow(extensionUri: vscode.Uri): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : vscode.ViewColumn.One;

    if (DashboardPanel.currentPanel) {
      DashboardPanel.currentPanel.panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "codeToPromptDashboard",
      "Code to Prompt Dashboard",
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    DashboardPanel.currentPanel = new DashboardPanel(panel, extensionUri);
  }

  public static registerMessageHandler(handler: DashboardMessageHandler): void {
    DashboardPanel.messageHandler = handler;
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;

    this.panel.webview.html = this.getHtmlForWebview(this.panel.webview);

    this.panel.onDidDispose(() => {
      DashboardPanel.currentPanel = undefined;
    });

    this.panel.webview.onDidReceiveMessage(async (message) => {
      if (!DashboardPanel.messageHandler) {
        return;
      }

      switch (message.command) {
        case "loadSelection": {
          const options = message.options as PromptOptions | undefined;
          const data = await DashboardPanel.messageHandler.getSelection(
            options
          );
          this.panel.webview.postMessage({ command: "selectionData", data });
          break;
        }
        case "copy": {
          await DashboardPanel.messageHandler.copyPrompt(
            message.text as string
          );
          break;
        }
        case "reorder": {
          await DashboardPanel.messageHandler.updateSelectionOrder(
            message.paths as string[]
          );
          break;
        }
        case "resetSelection": {
          await DashboardPanel.messageHandler.resetSelection();
          const options = message.options as PromptOptions | undefined;
          const data = await DashboardPanel.messageHandler.getSelection(
            options
          );
          this.panel.webview.postMessage({ command: "selectionData", data });
          break;
        }
      }
    });
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = Date.now().toString();

    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Code to Prompt Dashboard</title>
          <style>
            body {
              font-family: var(--vscode-font-family);
              color: var(--vscode-foreground);
              background-color: var(--vscode-editor-background);
              margin: 0;
              padding: 0;
              display: flex;
              flex-direction: column;
              height: 100vh;
            }
            header {
              padding: 8px 16px;
              border-bottom: 1px solid var(--vscode-editorGroup-border);
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 13px;
            }
            main {
              display: flex;
              flex: 1;
              overflow: hidden;
            }
            .left, .right {
              flex: 1;
              padding: 8px;
              box-sizing: border-box;
              overflow: auto;
            }
            .section-title {
              font-weight: bold;
              margin-bottom: 4px;
            }
            ul {
              list-style: none;
              padding: 0;
              margin: 0;
            }
            li {
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 4px 0;
              border-bottom: 1px solid var(--vscode-editorGroup-border);
              font-size: 12px;
            }
            .path {
              flex: 1;
              margin-right: 4px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            button {
              background: var(--vscode-button-background);
              color: var(--vscode-button-foreground);
              border: none;
              padding: 4px 8px;
              margin-left: 4px;
              cursor: pointer;
              font-size: 12px;
            }
            button:hover {
              background: var(--vscode-button-hoverBackground);
            }
            textarea {
              width: 100%;
              height: 100%;
              box-sizing: border-box;
              font-family: var(--vscode-editor-font-family);
              font-size: var(--vscode-editor-font-size);
              background: var(--vscode-editor-background);
              color: var(--vscode-editor-foreground);
              border: 1px solid var(--vscode-editorGroup-border);
              border-radius: 4px;
              padding: 8px;
              resize: none;
              white-space: pre;
            }
            .token-info {
              font-size: 12px;
              opacity: 0.8;
            }
            .token-warning {
              color: var(--vscode-editorError-foreground);
            }
            .controls {
              display: flex;
              align-items: center;
              gap: 4px;
            }
            .checkbox-row {
              display: flex;
              align-items: center;
              margin-top: 4px;
              font-size: 12px;
            }
            .checkbox-row input[type="checkbox"] {
              margin-right: 4px;
            }
            .badge {
              font-size: 11px;
              padding: 2px 6px;
              border-radius: 999px;
              border: 1px solid var(--vscode-editorGroup-border);
              margin-left: 4px;
            }
          </style>
        </head>
        <body>
          <header>
            <div>
              <strong>Code to Prompt Dashboard</strong>
              <span id="formatInfo" class="badge"></span>
            </div>
            <div class="controls">
              <span id="tokenInfo" class="token-info"></span>
              <button id="refreshBtn">Refresh</button>
              <button id="copyBtn">Copy Prompt</button>
              <button id="resetBtn">Reset</button>
            </div>
          </header>
          <main>
            <section class="left">
              <div class="section-title">Selected Files</div>
              <ul id="fileList"></ul>
              <div class="checkbox-row">
                <input type="checkbox" id="treeToggle" />
                <label for="treeToggle">Include tree structure (markdown/json)</label>
              </div>
            </section>
            <section class="right">
              <div class="section-title">Prompt Preview</div>
              <textarea id="promptPreview"></textarea>
            </section>
          </main>
          <script nonce="${nonce}">
            const vscode = acquireVsCodeApi();

            const state = {
              paths: [],
              includeTreeStructure: false
            };

            const fileListEl = document.getElementById('fileList');
            const previewEl = document.getElementById('promptPreview');
            const tokenInfoEl = document.getElementById('tokenInfo');
            const refreshBtn = document.getElementById('refreshBtn');
            const copyBtn = document.getElementById('copyBtn');
            const resetBtn = document.getElementById('resetBtn');
            const treeToggleEl = document.getElementById('treeToggle');
            const formatInfoEl = document.getElementById('formatInfo');

            function renderFiles() {
              fileListEl.innerHTML = '';
              for (let i = 0; i < state.paths.length; i++) {
                const p = state.paths[i];
                const li = document.createElement('li');
                const span = document.createElement('span');
                span.className = 'path';
                span.textContent = p;
                const controls = document.createElement('div');
                const up = document.createElement('button');
                up.textContent = '↑';
                up.onclick = function () { move(i, -1); };
                const down = document.createElement('button');
                down.textContent = '↓';
                down.onclick = function () { move(i, 1); };
                controls.appendChild(up);
                controls.appendChild(down);
                li.appendChild(span);
                li.appendChild(controls);
                fileListEl.appendChild(li);
              }
            }

            function move(index, delta) {
              const newIndex = index + delta;
              if (newIndex < 0 || newIndex >= state.paths.length) {
                return;
              }
              const arr = state.paths.slice();
              const item = arr[index];
              arr.splice(index, 1);
              arr.splice(newIndex, 0, item);
              state.paths = arr;
              renderFiles();
              vscode.postMessage({ command: 'reorder', paths: state.paths });
            }

            refreshBtn.onclick = function () {
              vscode.postMessage({
                command: 'loadSelection',
                options: { includeTreeStructure: state.includeTreeStructure }
              });
            };

            copyBtn.onclick = function () {
              vscode.postMessage({ command: 'copy', text: previewEl.value });
            };

            resetBtn.onclick = function () {
              vscode.postMessage({ command: 'resetSelection' });
            };

            treeToggleEl.addEventListener('change', function () {
              state.includeTreeStructure = !!treeToggleEl.checked;
              vscode.postMessage({
                command: 'loadSelection',
                options: { includeTreeStructure: state.includeTreeStructure }
              });
            });

            window.addEventListener('message', function (event) {
              const message = event.data;
              if (message.command === 'selectionData') {
                const data = message.data;
                state.paths = data.files.map(function (f) { return f.path; });
                state.includeTreeStructure = !!data.includeTreeStructure;
                treeToggleEl.checked = state.includeTreeStructure;
                renderFiles();

                previewEl.value = data.prompt;

                var tokenText = 'Tokens: ' + data.tokenInfo.tokens + ' (' +
                  (data.tokenInfo.approximate ? 'approximate' : data.tokenInfo.model) + ')';
                if (data.tokenBudget && data.tokenBudget > 0) {
                  tokenText = tokenText + ' / Budget: ' + data.tokenBudget;
                }
                tokenInfoEl.textContent = tokenText;

                if (data.tokenBudget && data.tokenInfo.tokens > data.tokenBudget) {
                  tokenInfoEl.classList.add('token-warning');
                } else {
                  tokenInfoEl.classList.remove('token-warning');
                }

                if (data.format) {
                  formatInfoEl.textContent = data.format.toUpperCase();
                } else {
                  formatInfoEl.textContent = '';
                }
              }
            });

            // Initial load
            vscode.postMessage({ command: 'loadSelection', options: { includeTreeStructure: false } });
          </script>
        </body>
      </html>
    `;
  }
}
