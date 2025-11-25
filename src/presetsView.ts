import * as vscode from "vscode";
import { CodeToPromptTreeProvider } from "./fileSystem";

interface Preset {
  id: string;
  name: string;
  paths: string[];
}

const PRESETS_KEY = "codeToPrompt.presets";

export class PresetsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = "codeToPromptPresets";

  private view: vscode.WebviewView | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly treeProvider: CodeToPromptTreeProvider,
    private readonly globalState: vscode.Memento
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case "savePreset":
          await this.savePreset(message.name as string);
          break;
        case "loadPreset":
          await this.loadPreset(message.id as string);
          break;
        case "deletePreset":
          await this.deletePreset(message.id as string);
          break;
      }
    });

    this.postPresets();
  }

  private getHtmlForWebview(_webview: vscode.Webview): string {
    const nonce = Date.now().toString();

    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Code to Prompt Presets</title>
          <style>
            body {
              font-family: var(--vscode-font-family);
              color: var(--vscode-foreground);
              background-color: var(--vscode-sideBar-background);
              margin: 0;
              padding: 8px;
            }
            h3 {
              margin-top: 0;
              font-size: 13px;
            }
            .row {
              display: flex;
              gap: 4px;
              margin-bottom: 8px;
            }
            input[type="text"] {
              flex: 1;
              box-sizing: border-box;
            }
            button {
              border: none;
              padding: 2px 6px;
              cursor: pointer;
              background: var(--vscode-button-secondaryBackground, var(--vscode-button-background));
              color: var(--vscode-button-foreground);
            }
            button:hover {
              background: var(--vscode-button-hoverBackground);
            }
            ul {
              list-style: none;
              margin: 0;
              padding: 0;
            }
            li {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 2px 0;
              border-bottom: 1px solid var(--vscode-sideBar-border, var(--vscode-editorGroup-border));
              font-size: 12px;
            }
            .name {
              flex: 1;
              margin-right: 4px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .empty {
              font-size: 11px;
              opacity: 0.7;
            }
          </style>
        </head>
        <body>
          <h3>Presets</h3>
          <div class="row">
            <input type="text" id="presetName" placeholder="Preset name (e.g. Auth System)" />
            <button id="saveBtn">Save</button>
          </div>
          <ul id="presetList"></ul>
          <div id="emptyState" class="empty">No presets yet. Create one from the current selection.</div>

          <script nonce="${nonce}">
            const vscode = acquireVsCodeApi();

            const nameInput = document.getElementById('presetName');
            const saveBtn = document.getElementById('saveBtn');
            const listEl = document.getElementById('presetList');
            const emptyEl = document.getElementById('emptyState');

            let presets = [];

            saveBtn.addEventListener('click', () => {
              const name = nameInput.value.trim();
              if (!name) {
                return;
              }
              vscode.postMessage({ command: 'savePreset', name });
              nameInput.value = '';
            });

            function render() {
              listEl.innerHTML = '';
              if (!presets.length) {
                emptyEl.style.display = 'block';
                return;
              }
              emptyEl.style.display = 'none';

              presets.forEach(p => {
                const li = document.createElement('li');
                const span = document.createElement('span');
                span.className = 'name';
                span.textContent = p.name + ' (' + p.paths.length + ')';
                const actions = document.createElement('div');

                const loadBtn = document.createElement('button');
                loadBtn.textContent = 'Load';
                loadBtn.onclick = () => {
                  vscode.postMessage({ command: 'loadPreset', id: p.id });
                };

                const delBtn = document.createElement('button');
                delBtn.textContent = '✕';
                delBtn.onclick = () => {
                  vscode.postMessage({ command: 'deletePreset', id: p.id });
                };

                actions.appendChild(loadBtn);
                actions.appendChild(delBtn);
                li.appendChild(span);
                li.appendChild(actions);
                listEl.appendChild(li);
              });
            }

            window.addEventListener('message', event => {
              const message = event.data;
              if (message.command === 'presets') {
                presets = message.presets || [];
                render();
              }
            });
          </script>
        </body>
      </html>
    `;
  }

  private getPresets(): Preset[] {
    return this.globalState.get<Preset[]>(PRESETS_KEY, []);
  }

  private async savePresets(list: Preset[]): Promise<void> {
    await this.globalState.update(PRESETS_KEY, list);
    this.postPresets();
  }

  private postPresets(): void {
    if (!this.view) return;
    const presets = this.getPresets();
    this.view.webview.postMessage({ command: "presets", presets });
  }

  private async savePreset(name: string): Promise<void> {
    const paths = this.treeProvider.getSelectedPaths();
    if (!paths.length) {
      vscode.window.showInformationMessage(
        "Code to Prompt: No files selected to save as preset."
      );
      return;
    }

    const presets = this.getPresets();
    const id = Date.now().toString() + Math.random().toString(16).slice(2);
    presets.push({ id, name, paths });
    await this.savePresets(presets);
    vscode.window.showInformationMessage(
      `Code to Prompt: Saved preset "${name}".`
    );
  }

  private async loadPreset(id: string): Promise<void> {
    const presets = this.getPresets();
    const preset = presets.find((p) => p.id === id);
    if (!preset) return;

    this.treeProvider.setSelectedPaths(preset.paths);
    vscode.window.showInformationMessage(
      `Code to Prompt: Loaded preset "${preset.name}".`
    );
  }

  private async deletePreset(id: string): Promise<void> {
    let presets = this.getPresets();
    const preset = presets.find((p) => p.id === id);
    presets = presets.filter((p) => p.id !== id);
    await this.savePresets(presets);
    if (preset) {
      vscode.window.showInformationMessage(
        `Code to Prompt: Deleted preset "${preset.name}".`
      );
    }
  }
}
