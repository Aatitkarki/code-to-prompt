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
  ) { }

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

  private getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = Date.now().toString();

    const codiconsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css')
    );

    return `
          <!DOCTYPE html>
          <html lang="en">
            <head>
              <meta charset="UTF-8" />
              <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <link href="${codiconsUri}" rel="stylesheet" />
              <title>Code to Prompt Presets</title>
              <style>
                body {
                  font-family: var(--vscode-font-family);
                  color: var(--vscode-foreground);
                  background-color: var(--vscode-sideBar-background);
                  margin: 0;
                  padding: 16px;
                }
                
                h3 {
                  margin-top: 0;
                  margin-bottom: 12px;
                  font-size: 11px;
                  font-weight: 600;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                  display: flex;
                  align-items: center;
                  gap: 6px;
                }
                
                .input-group {
                  display: flex;
                  gap: 6px;
                  margin-bottom: 16px;
                }
                
                input[type="text"] {
                  flex: 1;
                  box-sizing: border-box;
                  background: var(--vscode-input-background);
                  color: var(--vscode-input-foreground);
                  border: 1px solid var(--vscode-input-border, var(--vscode-widget-border));
                  padding: 6px 8px;
                  border-radius: 4px;
                  font-size: 13px;
                  outline: none;
                }
                
                input[type="text"]:focus {
                  border-color: var(--vscode-focusBorder);
                }
                
                .btn-primary {
                  background: var(--vscode-button-background);
                  color: var(--vscode-button-foreground);
                  border: none;
                  padding: 4px 12px;
                  border-radius: 4px;
                  cursor: pointer;
                  font-size: 13px;
                  font-weight: 500;
                  display: flex;
                  align-items: center;
                  gap: 4px;
                  transition: background-color 0.2s;
                }
                
                .btn-primary:hover {
                  background: var(--vscode-button-hoverBackground);
                }
                
                .preset-list {
                  display: flex;
                  flex-direction: column;
                  gap: 8px;
                }
                
                .preset-card {
                  background: var(--vscode-editor-background);
                  border: 1px solid var(--vscode-widget-border);
                  border-radius: 6px;
                  padding: 8px 12px;
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  transition: all 0.2s;
                  animation: slideIn 0.3s ease-out;
                  cursor: pointer;
                }
                
                @keyframes slideIn {
                  from { opacity: 0; transform: translateY(-10px); }
                  to { opacity: 1; transform: translateY(0); }
                }
                
                .preset-card:hover {
                  border-color: var(--vscode-focusBorder);
                }
                
                .preset-info {
                  display: flex;
                  flex-direction: column;
                  gap: 2px;
                  min-width: 0;
                }
                
                .preset-name {
                  font-size: 13px;
                  font-weight: 500;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                }
                
                .preset-count {
                  font-size: 11px;
                  color: var(--vscode-descriptionForeground);
                  display: flex;
                  align-items: center;
                  gap: 4px;
                }
                
                .preset-actions {
                  display: flex;
                  gap: 4px;
                  opacity: 0;
                  transition: opacity 0.2s;
                }
                
                .preset-card:hover .preset-actions {
                  opacity: 1;
                }
                
                .icon-btn {
                  background: transparent;
                  color: var(--vscode-icon-foreground);
                  border: none;
                  padding: 4px;
                  border-radius: 4px;
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  transition: all 0.2s;
                }
                
                .icon-btn:hover {
                  background: var(--vscode-list-hoverBackground);
                  color: var(--vscode-list-activeSelectionForeground);
                }
                
                .icon-btn.delete:hover {
                  color: var(--vscode-errorForeground);
                }
                
                .empty-state {
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  padding: 32px 16px;
                  text-align: center;
                  color: var(--vscode-descriptionForeground);
                }
                
                .empty-icon {
                  font-size: 32px;
                  margin-bottom: 12px;
                  opacity: 0.8;
                }
                
                .empty-text {
                  font-size: 13px;
                  line-height: 1.4;
                }
                
                /* Shake effect for invalid input */
                .shake {
                  animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
                }
                
                @keyframes shake {
                  10%, 90% { transform: translate3d(-1px, 0, 0); }
                  20%, 80% { transform: translate3d(2px, 0, 0); }
                  30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
                  40%, 60% { transform: translate3d(4px, 0, 0); }
                }
              </style>
            </head>
            <body>
              <h3><i class="codicon codicon-save-all"></i> Saved Presets</h3>
              
              <div class="input-group">
                <input type="text" id="presetName" placeholder="Preset name (e.g. Auth System)" autocomplete="off" />
                <button id="saveBtn" class="btn-primary" title="Save current selection as preset"><i class="codicon codicon-add"></i> Save</button>
              </div>
              
              <div id="presetList" class="preset-list"></div>
              
              <div id="emptyState" class="empty-state">
                <div class="empty-icon">📁</div>
                <div class="empty-text">No presets yet.<br>Select files in the dashboard and save them here for quick access later.</div>
              </div>
    
              <script nonce="${nonce}">
                const vscode = acquireVsCodeApi();
    
                const nameInput = document.getElementById('presetName');
                const saveBtn = document.getElementById('saveBtn');
                const listEl = document.getElementById('presetList');
                const emptyEl = document.getElementById('emptyState');
    
                let presets = [];
    
                function saveCurrent() {
                  const name = nameInput.value.trim();
                  if (!name) {
                    nameInput.classList.remove('shake');
                    void nameInput.offsetWidth; // trigger reflow
                    nameInput.classList.add('shake');
                    nameInput.focus();
                    return;
                  }
                  vscode.postMessage({ command: 'savePreset', name });
                  nameInput.value = '';
                }
    
                saveBtn.addEventListener('click', saveCurrent);
                
                nameInput.addEventListener('keydown', (e) => {
                  if (e.key === 'Enter') {
                    saveCurrent();
                  }
                });
    
                function render() {
                  listEl.innerHTML = '';
                  if (!presets || presets.length === 0) {
                    emptyEl.style.display = 'flex';
                    return;
                  }
                  
                  emptyEl.style.display = 'none';
    
                  presets.forEach(p => {
                    const card = document.createElement('div');
                    card.className = 'preset-card';
                    card.onclick = () => {
                      vscode.postMessage({ command: 'loadPreset', id: p.id });
                    };
                    
                    const info = document.createElement('div');
                    info.className = 'preset-info';
                    
                    const name = document.createElement('div');
                    name.className = 'preset-name';
                    name.textContent = p.name;
                    name.title = p.name;
                    
                    const count = document.createElement('div');
                    count.className = 'preset-count';
                    count.innerHTML = '<i class="codicon codicon-files"></i> ' + p.paths.length + ' file' + (p.paths.length === 1 ? '' : 's');
                    
                    info.appendChild(name);
                    info.appendChild(count);
                    
                    const actions = document.createElement('div');
                    actions.className = 'preset-actions';
    
                    const loadBtn = document.createElement('button');
                    loadBtn.className = 'icon-btn';
                    loadBtn.title = 'Load Preset';
                    loadBtn.innerHTML = '<i class="codicon codicon-arrow-down"></i>';
                    loadBtn.onclick = (e) => {
                      e.stopPropagation();
                      vscode.postMessage({ command: 'loadPreset', id: p.id });
                    };
    
                    const delBtn = document.createElement('button');
                    delBtn.className = 'icon-btn delete';
                    delBtn.title = 'Delete Preset';
                    delBtn.innerHTML = '<i class="codicon codicon-trash"></i>';
                    delBtn.onclick = (e) => {
                      e.stopPropagation();
                      vscode.postMessage({ command: 'deletePreset', id: p.id });
                    };
    
                    actions.appendChild(loadBtn);
                    actions.appendChild(delBtn);
                    
                    card.appendChild(info);
                    card.appendChild(actions);
                    listEl.appendChild(card);
                  });
                }
    
                window.addEventListener('message', event => {
                  const message = event.data;
                  if (message.command === 'presets') {
                    presets = message.presets || [];
                    render();
                  }
                });
                
                // Initial focus
                setTimeout(() => {
                  nameInput.focus();
                }, 100);
              </script>
            </body>
          </html>`;
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