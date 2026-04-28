import * as vscode from "vscode";
import { OutputFormat } from "./formatter";
import { STANDARD_FOOTER_NOTE } from "./utils/promptUtils";

export class SettingsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = "codeToPromptSettings";

  constructor(private readonly extensionUri: vscode.Uri) { }

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
              <title>Code to Prompt Settings</title>
              <style>
                body {
                  font-family: var(--vscode-font-family);
                  color: var(--vscode-foreground);
                  background-color: var(--vscode-sideBar-background);
                  margin: 0;
                  padding: 0;
                }
                
                .header-bar {
                  position: sticky;
                  top: 0;
                  background-color: var(--vscode-sideBar-background);
                  padding: 12px 16px;
                  border-bottom: 1px solid var(--vscode-widget-border);
                  z-index: 10;
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                }
                
                .header-title {
                  font-size: 13px;
                  font-weight: 600;
                  margin: 0;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                }
                
                .save-indicator {
                  font-size: 11px;
                  color: var(--vscode-testing-iconPassed);
                  display: flex;
                  align-items: center;
                  gap: 4px;
                  opacity: 0;
                  transition: opacity 0.3s;
                }
                
                .save-indicator.show {
                  opacity: 1;
                }
                
                .content {
                  padding: 16px;
                  display: flex;
                  flex-direction: column;
                  gap: 20px;
                }
                
                .section {
                  background: var(--vscode-editor-background);
                  border: 1px solid var(--vscode-widget-border);
                  border-radius: 6px;
                  overflow: hidden;
                }
                
                .section-header {
                  background: var(--vscode-sideBarSectionHeader-background);
                  padding: 10px 12px;
                  font-size: 12px;
                  font-weight: 600;
                  display: flex;
                  align-items: center;
                  gap: 6px;
                  border-bottom: 1px solid var(--vscode-widget-border);
                }
                
                .section-icon {
                  color: var(--vscode-icon-foreground);
                }
                
                .section-body {
                  padding: 12px;
                  display: flex;
                  flex-direction: column;
                  gap: 16px;
                }
                
                .field {
                  display: flex;
                  flex-direction: column;
                  gap: 6px;
                }
                
                .field-row {
                  display: flex;
                  flex-direction: row;
                  justify-content: space-between;
                  align-items: center;
                  gap: 12px;
                }
                
                label {
                  font-size: 13px;
                  color: var(--vscode-foreground);
                  font-weight: 500;
                }
                
                .hint {
                  font-size: 11px;
                  color: var(--vscode-descriptionForeground);
                  line-height: 1.4;
                  display: flex;
                  gap: 4px;
                }
                
                .hint i {
                  font-size: 12px;
                  margin-top: 2px;
                }
                
                /* Inputs styling */
                select, input[type="number"], input[type="text"] {
                  width: 100%;
                  box-sizing: border-box;
                  background: var(--vscode-input-background);
                  color: var(--vscode-input-foreground);
                  border: 1px solid var(--vscode-input-border, var(--vscode-widget-border));
                  padding: 6px 8px;
                  border-radius: 4px;
                  font-size: 13px;
                  font-family: inherit;
                  outline: none;
                }
                
                select:focus, input[type="number"]:focus, input[type="text"]:focus, textarea:focus {
                  border-color: var(--vscode-focusBorder);
                }
                
                select {
                  cursor: pointer;
                  appearance: none;
                  background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23999%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E");
                  background-repeat: no-repeat;
                  background-position: right 8px top 50%;
                  background-size: 8px auto;
                  padding-right: 24px;
                }
                
                .input-wrapper {
                  flex: 1;
                  max-width: 150px;
                }
                
                textarea {
                  width: 100%;
                  box-sizing: border-box;
                  background: var(--vscode-input-background);
                  color: var(--vscode-input-foreground);
                  border: 1px solid var(--vscode-input-border, var(--vscode-widget-border));
                  border-radius: 4px;
                  padding: 8px;
                  font-family: var(--vscode-editor-font-family, monospace);
                  font-size: 12px;
                  resize: vertical;
                  min-height: 60px;
                  outline: none;
                }
                
                .textarea-header {
                  display: flex;
                  justify-content: space-between;
                  align-items: flex-end;
                  margin-bottom: 4px;
                }
                
                .char-count {
                  font-size: 10px;
                  color: var(--vscode-descriptionForeground);
                }
                
                /* Toggle Switch CSS */
                .toggle-wrapper {
                  display: flex;
                  align-items: center;
                  cursor: pointer;
                }
                
                .switch {
                  position: relative;
                  display: inline-block;
                  width: 36px;
                  height: 20px;
                }
                
                .switch input {
                  opacity: 0;
                  width: 0;
                  height: 0;
                }
                
                .slider {
                  position: absolute;
                  cursor: pointer;
                  top: 0; left: 0; right: 0; bottom: 0;
                  background-color: var(--vscode-scrollbarSlider-background);
                  transition: .3s;
                  border-radius: 20px;
                }
                
                .slider:before {
                  position: absolute;
                  content: "";
                  height: 16px;
                  width: 16px;
                  left: 2px;
                  bottom: 2px;
                  background-color: var(--vscode-button-foreground);
                  transition: .3s;
                  border-radius: 50%;
                }
                
                input:checked + .slider {
                  background-color: var(--vscode-button-background);
                }
                
                input:checked + .slider:before {
                  transform: translateX(16px);
                }
                
                .std-footer-box {
                  background: var(--vscode-textBlockQuote-background);
                  border-left: 3px solid var(--vscode-textBlockQuote-border);
                  padding: 8px 12px;
                  margin-top: 8px;
                  font-size: 11px;
                  color: var(--vscode-textPreformat-foreground);
                }
              </style>
            </head>
            <body>
              <div class="header-bar">
                <h2 class="header-title">Extension Settings</h2>
                <div id="saveIndicator" class="save-indicator">
                  <i class="codicon codicon-check"></i> Saved
                </div>
              </div>
              
              <div class="content">
                <!-- Output Format Section -->
                <div class="section">
                  <div class="section-header">
                    <i class="codicon codicon-symbol-misc section-icon"></i> Output Format
                  </div>
                  <div class="section-body">
                    <div class="field field-row">
                      <div>
                        <label for="format">Default Format</label>
                        <div class="hint">The structure of the generated prompt</div>
                      </div>
                      <div class="input-wrapper">
                        <select id="format">
                          <option value="markdown">Markdown</option>
                          <option value="xml">XML</option>
                          <option value="json">JSON</option>
                        </select>
                      </div>
                    </div>
                    
                    <div class="field field-row">
                      <div>
                        <label>Include line numbers</label>
                        <div class="hint">Prefix every line with its number (useful for pointing out specific lines)</div>
                      </div>
                      <label class="toggle-wrapper">
                        <div class="switch">
                          <input type="checkbox" id="lineNumbers" />
                          <span class="slider"></span>
                        </div>
                      </label>
                    </div>
                    
                    <div class="field field-row">
                      <div>
                        <label>Include tree structure</label>
                        <div class="hint">Prefix the prompt with a file hierarchy map</div>
                      </div>
                      <label class="toggle-wrapper">
                        <div class="switch">
                          <input type="checkbox" id="treeStructure" />
                          <span class="slider"></span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
                
                <!-- File Processing Section -->
                <div class="section">
                  <div class="section-header">
                    <i class="codicon codicon-filter section-icon"></i> File Selection & Ignore Rules
                  </div>
                  <div class="section-body">
                    <div class="field field-row">
                      <div>
                        <label>Respect .gitignore</label>
                        <div class="hint">Filter out files that match the gitignore rules</div>
                      </div>
                      <label class="toggle-wrapper">
                        <div class="switch">
                          <input type="checkbox" id="respectGitignore" />
                          <span class="slider"></span>
                        </div>
                      </label>
                    </div>
                    
                    <div class="field">
                      <div class="textarea-header">
                        <label for="ignorePatterns">Custom Ignore Patterns</label>
                      </div>
                      <textarea id="ignorePatterns" rows="3" placeholder="*.log
    *.tmp
    build/"></textarea>
                      <div class="hint"><i class="codicon codicon-info"></i> One .gitignore-style pattern per line</div>
                    </div>
                  </div>
                </div>
                
                <!-- Context Limits Section -->
                <div class="section">
                  <div class="section-header">
                    <i class="codicon codicon-pulse section-icon"></i> Context Limits
                  </div>
                  <div class="section-body">
                    <div class="field field-row">
                      <div>
                        <label for="tokenBudget">Token Budget</label>
                        <div class="hint">Shows warnings when the total hits this limit</div>
                      </div>
                      <div class="input-wrapper">
                        <input type="number" id="tokenBudget" min="1000" step="1000" />
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- Prompt Templates Section -->
                <div class="section">
                  <div class="section-header">
                    <i class="codicon codicon-quote section-icon"></i> Custom Prompts
                  </div>
                  <div class="section-body">
                    <div class="field">
                      <div class="textarea-header">
                        <label for="headerPrompt">Header Prompt Setup</label>
                      </div>
                      <textarea id="headerPrompt" rows="3" placeholder="This is my current codebase, please help me optimize..."></textarea>
                      <div class="hint"><i class="codicon codicon-info"></i> Static text prepended above the collected code</div>
                    </div>
                    
                    <div class="field">
                      <div class="textarea-header">
                        <label for="footerPrompt">Footer Prompt Instruction</label>
                      </div>
                      <textarea id="footerPrompt" rows="3" placeholder="Additional instructions to the AI..."></textarea>
                      <div class="hint"><i class="codicon codicon-info"></i> Static text appended below the collected code</div>
                    </div>
                    
                    <div class="field">
                      <div class="field-row">
                        <div>
                          <label>Append Standard Edits Note</label>
                          <div class="hint">Instructs the AI to output files in a standard format</div>
                        </div>
                        <label class="toggle-wrapper">
                          <div class="switch">
                            <input type="checkbox" id="appendStandardFooterNote" />
                            <span class="slider"></span>
                          </div>
                        </label>
                      </div>
                      <div class="std-footer-box" id="standardFooterText">${STANDARD_FOOTER_NOTE}</div>
                    </div>
                  </div>
                </div>
                
                <!-- Workflow Section -->
                <div class="section">
                  <div class="section-header">
                    <i class="codicon codicon-git-pull-request section-icon"></i> Workflow Options
                  </div>
                  <div class="section-body">
                    <div class="field field-row">
                      <div>
                        <label>Require Import Confirmation</label>
                        <div class="hint">Preview file changes before applying generated code back to workspace</div>
                      </div>
                      <label class="toggle-wrapper">
                        <div class="switch">
                          <input type="checkbox" id="requireImportConfirmation" />
                          <span class="slider"></span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
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
                const saveIndicator = document.getElementById('saveIndicator');
    
                // Initialize values
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
    
                let saveTimeout;
                function flashSaved() {
                  saveIndicator.classList.add('show');
                  clearTimeout(saveTimeout);
                  saveTimeout = setTimeout(() => {
                    saveIndicator.classList.remove('show');
                  }, 2000);
                }
    
                function triggerUpdate(key, value) {
                  vscode.postMessage({ command: 'updateSetting', key, value });
                  flashSaved();
                }
    
                // Event listeners
                formatEl.addEventListener('change', () => triggerUpdate('defaultFormat', formatEl.value));
                lineNumbersEl.addEventListener('change', () => triggerUpdate('includeLineNumbers', lineNumbersEl.checked));
                treeStructureEl.addEventListener('change', () => triggerUpdate('includeTreeStructure', treeStructureEl.checked));
                respectGitignoreEl.addEventListener('change', () => triggerUpdate('respectGitignore', respectGitignoreEl.checked));
                ignorePatternsEl.addEventListener('change', () => triggerUpdate('ignorePatterns', ignorePatternsEl.value));
                
                tokenBudgetEl.addEventListener('change', () => {
                  const v = parseInt(tokenBudgetEl.value, 10) || 32000;
                  triggerUpdate('tokenBudget', v);
                });
                
                headerPromptEl.addEventListener('change', () => triggerUpdate('headerPrompt', headerPromptEl.value));
                footerPromptEl.addEventListener('change', () => triggerUpdate('footerPrompt', footerPromptEl.value));
                appendStandardFooterNoteEl.addEventListener('change', () => triggerUpdate('appendStandardFooterNote', appendStandardFooterNoteEl.checked));
                requireImportConfirmationEl.addEventListener('change', () => triggerUpdate('requireImportConfirmation', requireImportConfirmationEl.checked));
              </script>
            </body>
          </html>`;
  }

}