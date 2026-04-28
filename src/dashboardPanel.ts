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
    selectCommits: () => Promise<boolean>;
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
                case "selectCommits": {
                    const selected = await DashboardPanel.messageHandler.selectCommits();
                    if (selected) {
                        const options = message.options as PromptOptions | undefined;
                        const data = await DashboardPanel.messageHandler.getSelection(options);
                        this.panel.webview.postMessage({ command: "selectionData", data });
                    }
                    break;
                }
            }
        });
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
                  padding: 12px 20px;
                  background-color: var(--vscode-sideBar-background);
                  border-bottom: 1px solid var(--vscode-widget-border);
                  display: flex;
                  flex-direction: column;
                  gap: 12px;
                }
                
                .header-top {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                }
                
                .title-area {
                  display: flex;
                  align-items: center;
                  gap: 8px;
                }
                
                .title {
                  font-size: 14px;
                  font-weight: 600;
                  letter-spacing: 0.5px;
                }
                
                .badge {
                  font-size: 10px;
                  font-weight: 600;
                  padding: 2px 8px;
                  border-radius: 12px;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                }
                
                .badge.format-markdown { background: var(--vscode-charts-blue); color: white; }
                .badge.format-xml { background: var(--vscode-charts-orange); color: white; }
                .badge.format-json { background: var(--vscode-charts-green); color: white; }
                
                .token-container {
                  display: flex;
                  flex-direction: column;
                  gap: 4px;
                  width: 100%;
                }
                
                .token-info {
                  display: flex;
                  justify-content: space-between;
                  font-size: 12px;
                  color: var(--vscode-descriptionForeground);
                }
                
                .progress-bar {
                  height: 6px;
                  background: var(--vscode-scrollbarSlider-background);
                  border-radius: 3px;
                  overflow: hidden;
                  position: relative;
                }
                
                .progress-fill {
                  height: 100%;
                  width: 0%;
                  background: var(--vscode-progressBar-background);
                  transition: width 0.3s ease, background-color 0.3s ease;
                }
                
                .progress-fill.warning { background: var(--vscode-charts-yellow); }
                .progress-fill.danger { background: var(--vscode-charts-red); }
                
                .controls {
                  display: flex;
                  gap: 8px;
                }
                
                .btn {
                  display: flex;
                  align-items: center;
                  gap: 6px;
                  background: var(--vscode-button-secondaryBackground);
                  color: var(--vscode-button-secondaryForeground);
                  border: 1px solid var(--vscode-button-border, transparent);
                  padding: 6px 12px;
                  border-radius: 4px;
                  cursor: pointer;
                  font-size: 12px;
                  font-weight: 500;
                  transition: all 0.2s;
                }
                
                .btn:hover {
                  background: var(--vscode-button-secondaryHoverBackground);
                }
                
                .btn.primary {
                  background: var(--vscode-button-background);
                  color: var(--vscode-button-foreground);
                }
                
                .btn.primary:hover {
                  background: var(--vscode-button-hoverBackground);
                }
                
                .btn.success {
                  background: var(--vscode-testing-iconPassed);
                  color: white;
                }
                
                main {
                  display: flex;
                  flex: 1;
                  overflow: hidden;
                }
                
                .split-view {
                  display: flex;
                  width: 100%;
                  height: 100%;
                }
                
                .left-panel {
                  width: 40%;
                  min-width: 300px;
                  display: flex;
                  flex-direction: column;
                  border-right: 1px solid var(--vscode-widget-border);
                  background: var(--vscode-sideBar-background);
                }
                
                .right-panel {
                  flex: 1;
                  display: flex;
                  flex-direction: column;
                  background: var(--vscode-editor-background);
                }
                
                .section {
                  display: flex;
                  flex-direction: column;
                  flex: 1;
                  overflow: hidden;
                }
                
                .section-header {
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  padding: 10px 16px;
                  background: var(--vscode-sideBarSectionHeader-background);
                  border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border);
                  font-size: 11px;
                  font-weight: 600;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                }
                
                .count-badge {
                  background: var(--vscode-badge-background);
                  color: var(--vscode-badge-foreground);
                  padding: 2px 6px;
                  border-radius: 10px;
                  font-size: 10px;
                }
                
                .scrollable-list {
                  flex: 1;
                  overflow-y: auto;
                  padding: 8px;
                  display: flex;
                  flex-direction: column;
                  gap: 4px;
                }
                
                .card {
                  background: var(--vscode-editor-background);
                  border: 1px solid var(--vscode-widget-border);
                  border-radius: 6px;
                  padding: 8px 12px;
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  transition: border-color 0.2s, background-color 0.2s;
                }
                
                .card:hover {
                  border-color: var(--vscode-focusBorder);
                  background: var(--vscode-list-hoverBackground);
                }
                
                .draggable {
                  cursor: grab;
                }
                
                .draggable:active {
                  cursor: grabbing;
                }
                
                .drag-handle {
                  color: var(--vscode-icon-foreground);
                  opacity: 0.5;
                  display: flex;
                  align-items: center;
                }
                
                .drag-handle:hover {
                  opacity: 1;
                }
                
                .file-icon {
                  font-size: 16px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                }
                
                .card-content {
                  flex: 1;
                  min-width: 0;
                }
                
                .card-title {
                  font-size: 13px;
                  color: var(--vscode-foreground);
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                }
                
                .card-subtitle {
                  font-size: 11px;
                  color: var(--vscode-descriptionForeground);
                  margin-top: 2px;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                }
                
                .footer-controls {
                  padding: 12px 16px;
                  border-top: 1px solid var(--vscode-widget-border);
                  background: var(--vscode-sideBar-background);
                }
                
                .toggle-row {
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  font-size: 13px;
                  color: var(--vscode-foreground);
                  cursor: pointer;
                }
                
                /* Toggle Switch */
                .switch {
                  position: relative;
                  display: inline-block;
                  width: 32px;
                  height: 18px;
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
                  border-radius: 18px;
                }
                
                .slider:before {
                  position: absolute;
                  content: "";
                  height: 14px;
                  width: 14px;
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
                  transform: translateX(14px);
                }
                
                .editor-container {
                  flex: 1;
                  padding: 16px;
                  display: flex;
                  flex-direction: column;
                }
                
                .editor-textarea {
                  flex: 1;
                  width: 100%;
                  background: var(--vscode-input-background);
                  color: var(--vscode-input-foreground);
                  border: 1px solid var(--vscode-input-border, var(--vscode-widget-border));
                  border-radius: 6px;
                  padding: 12px;
                  font-family: var(--vscode-editor-font-family, monospace);
                  font-size: var(--vscode-editor-font-size, 13px);
                  line-height: 1.5;
                  resize: none;
                  box-sizing: border-box;
                }
                
                .editor-textarea:focus {
                  outline: 1px solid var(--vscode-focusBorder);
                  border-color: transparent;
                }
                
                .empty-state {
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  height: 100%;
                  color: var(--vscode-descriptionForeground);
                  text-align: center;
                  padding: 20px;
                }
                
                .empty-icon {
                  font-size: 32px;
                  margin-bottom: 12px;
                  opacity: 0.5;
                }
                
                .shortcut {
                  font-size: 10px;
                  opacity: 0.7;
                  margin-left: 4px;
                  padding: 1px 4px;
                  background: var(--vscode-badge-background);
                  border-radius: 3px;
                }
                
                /* Drag animations */
                .dragging {
                  opacity: 0.5;
                  background: var(--vscode-list-activeSelectionBackground) !important;
                }
                .drag-over {
                  border-top: 2px solid var(--vscode-focusBorder) !important;
                }
              </style>
            </head>
            <body>
              <header>
                <div class="header-top">
                  <div class="title-area">
                    <span class="title">Code to Prompt</span>
                    <span id="formatInfo" class="badge"></span>
                  </div>
                  <div class="controls">
                    <button id="refreshBtn" class="btn"><i class="codicon codicon-refresh"></i> Refresh</button>
                    <button id="selectCommitsBtn" class="btn"><i class="codicon codicon-git-commit"></i> Commits</button>
                    <button id="copyBtn" class="btn primary"><i class="codicon codicon-files"></i> Copy Prompt</button>
                    <button id="resetBtn" class="btn"><i class="codicon codicon-clear-all"></i> Reset</button>
                  </div>
                </div>
                <div class="token-container">
                  <div class="token-info">
                    <span id="tokenText">Calculating tokens...</span>
                    <span id="budgetText"></span>
                  </div>
                  <div class="progress-bar">
                    <div id="tokenProgress" class="progress-fill"></div>
                  </div>
                </div>
              </header>
              <main>
                <div class="split-view">
                  <div class="left-panel">
                    
                    <div id="commitsSection" class="section" style="display: none; flex: 0 0 auto; max-height: 40%;">
                      <div class="section-header">
                        <span>Selected Commits</span>
                        <span id="commitCount" class="count-badge">0</span>
                      </div>
                      <div id="commitList" class="scrollable-list"></div>
                    </div>
                    
                    <div class="section">
                      <div class="section-header">
                        <span>Selected Files</span>
                        <span id="fileCount" class="count-badge">0</span>
                      </div>
                      <div id="fileList" class="scrollable-list"></div>
                    </div>
                    
                    <div class="footer-controls">
                      <label class="toggle-row">
                        <label class="switch">
                          <input type="checkbox" id="treeToggle">
                          <span class="slider"></span>
                        </label>
                        <span>Include tree structure</span>
                      </label>
                    </div>
                    
                  </div>
                  
                  <div class="right-panel">
                    <div class="section-header">
                      <span>Prompt Preview</span>
                    </div>
                    <div class="editor-container">
                      <textarea id="promptPreview" class="editor-textarea" spellcheck="false"></textarea>
                    </div>
                  </div>
                </div>
              </main>
              
              <script nonce="${nonce}">
                const vscode = acquireVsCodeApi();
    
                const state = {
                  paths: [],
                  commits: [],
                  includeTreeStructure: false
                };
    
                const commitsSectionEl = document.getElementById('commitsSection');
                const commitListEl = document.getElementById('commitList');
                const commitCountEl = document.getElementById('commitCount');
                const fileListEl = document.getElementById('fileList');
                const fileCountEl = document.getElementById('fileCount');
                const previewEl = document.getElementById('promptPreview');
                
                const tokenTextEl = document.getElementById('tokenText');
                const budgetTextEl = document.getElementById('budgetText');
                const tokenProgressEl = document.getElementById('tokenProgress');
                
                const refreshBtn = document.getElementById('refreshBtn');
                const selectCommitsBtn = document.getElementById('selectCommitsBtn');
                const copyBtn = document.getElementById('copyBtn');
                const resetBtn = document.getElementById('resetBtn');
                const treeToggleEl = document.getElementById('treeToggle');
                const formatInfoEl = document.getElementById('formatInfo');
                
                // Drag and drop state
                let draggedItemIndex = null;
                
                function getFileIcon(filename) {
                  // Simple heuristic for file icons using emojis
                  if (filename.endsWith('.ts') || filename.endsWith('.js')) return '📜';
                  if (filename.endsWith('.md')) return '📝';
                  if (filename.endsWith('.json')) return '{}';
                  if (filename.endsWith('.css') || filename.endsWith('.scss')) return '🎨';
                  if (filename.endsWith('.html')) return '🌐';
                  if (filename.includes('react') || filename.endsWith('.tsx') || filename.endsWith('.jsx')) return '⚛️';
                  return '📄';
                }
    
                function renderCommits() {
                  if (state.commits && state.commits.length > 0) {
                    commitsSectionEl.style.display = 'flex';
                    commitCountEl.textContent = state.commits.length;
                    commitListEl.innerHTML = '';
                    
                    state.commits.forEach(c => {
                      const card = document.createElement('div');
                      card.className = 'card';
                      
                      const icon = document.createElement('div');
                      icon.className = 'file-icon';
                      icon.textContent = '📦';
                      
                      const content = document.createElement('div');
                      content.className = 'card-content';
                      
                      const title = document.createElement('div');
                      title.className = 'card-title';
                      title.textContent = c.subject;
                      
                      const subtitle = document.createElement('div');
                      subtitle.className = 'card-subtitle';
                      subtitle.textContent = c.shortHash + ' • ' + (c.authorName || 'Unknown');
                      
                      content.appendChild(title);
                      content.appendChild(subtitle);
                      
                      card.appendChild(icon);
                      card.appendChild(content);
                      commitListEl.appendChild(card);
                    });
                  } else {
                    commitsSectionEl.style.display = 'none';
                    commitListEl.innerHTML = '';
                  }
                }
    
                function renderFiles() {
                  fileCountEl.textContent = state.paths.length;
                  fileListEl.innerHTML = '';
                  
                  if (state.paths.length === 0) {
                    const empty = document.createElement('div');
                    empty.className = 'empty-state';
                    empty.innerHTML = '<div class="empty-icon">📁</div><div>No files selected.</div><div style="font-size: 11px; margin-top: 4px;">Right-click files in Explorer and select "Code to Prompt: Select File/Folder".</div>';
                    fileListEl.appendChild(empty);
                    return;
                  }
                  
                  state.paths.forEach((p, index) => {
                    const filename = p.split('/').pop() || p;
                    
                    const card = document.createElement('div');
                    card.className = 'card draggable';
                    card.draggable = true;
                    card.dataset.index = index;
                    
                    // Drag events
                    card.addEventListener('dragstart', (e) => {
                      draggedItemIndex = index;
                      setTimeout(() => card.classList.add('dragging'), 0);
                    });
                    
                    card.addEventListener('dragend', () => {
                      card.classList.remove('dragging');
                      document.querySelectorAll('.card').forEach(c => c.classList.remove('drag-over'));
                    });
                    
                    card.addEventListener('dragover', (e) => {
                      e.preventDefault();
                      card.classList.add('drag-over');
                    });
                    
                    card.addEventListener('dragleave', () => {
                      card.classList.remove('drag-over');
                    });
                    
                    card.addEventListener('drop', (e) => {
                      e.preventDefault();
                      card.classList.remove('drag-over');
                      if (draggedItemIndex !== null && draggedItemIndex !== index) {
                        // Reorder array
                        const arr = state.paths.slice();
                        const item = arr[draggedItemIndex];
                        arr.splice(draggedItemIndex, 1);
                        arr.splice(index, 0, item);
                        state.paths = arr;
                        
                        renderFiles();
                        vscode.postMessage({ command: 'reorder', paths: state.paths });
                      }
                    });
                    
                    const handle = document.createElement('div');
                    handle.className = 'drag-handle';
                    handle.innerHTML = '<i class="codicon codicon-gripper"></i>';
                    
                    const icon = document.createElement('div');
                    icon.className = 'file-icon';
                    icon.textContent = getFileIcon(filename);
                    
                    const content = document.createElement('div');
                    content.className = 'card-content';
                    
                    const title = document.createElement('div');
                    title.className = 'card-title';
                    title.textContent = filename;
                    
                    const subtitle = document.createElement('div');
                    subtitle.className = 'card-subtitle';
                    subtitle.textContent = p;
                    
                    content.appendChild(title);
                    content.appendChild(subtitle);
                    
                    card.appendChild(handle);
                    card.appendChild(icon);
                    card.appendChild(content);
                    fileListEl.appendChild(card);
                  });
                }
    
                refreshBtn.onclick = function () {
                  vscode.postMessage({
                    command: 'loadSelection',
                    options: { includeTreeStructure: state.includeTreeStructure }
                  });
                };
    
                selectCommitsBtn.onclick = function () {
                  vscode.postMessage({
                    command: 'selectCommits',
                    options: { includeTreeStructure: state.includeTreeStructure }
                  });
                };
    
                copyBtn.onclick = function () {
                  // Flash effect
                  const originalHtml = copyBtn.innerHTML;
                  copyBtn.innerHTML = '<i class="codicon codicon-check"></i> Copied!';
                  copyBtn.classList.add('success');
                  setTimeout(() => { copyBtn.innerHTML = originalHtml; copyBtn.classList.remove('success'); }, 2000);
                  
                  vscode.postMessage({ command: 'copy', text: previewEl.value });
                };
    
                resetBtn.onclick = function () {
                  vscode.postMessage({ command: 'resetSelection', options: { includeTreeStructure: state.includeTreeStructure } });
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
                    state.commits = data.commits || [];
                    state.includeTreeStructure = !!data.includeTreeStructure;
                    treeToggleEl.checked = state.includeTreeStructure;
                    
                    renderCommits();
                    renderFiles();
    
                    previewEl.value = data.prompt;
    
                    // Update Token Info
                    const t = data.tokenInfo;
                    tokenTextEl.textContent = t.tokens.toLocaleString() + ' Tokens (' + (t.approximate ? 'approx' : t.model) + ')';
                    
                    const budget = data.tokenBudget || 32000;
                    budgetTextEl.textContent = budget.toLocaleString() + ' Limit';
                    
                    const pct = Math.min(100, Math.max(0, (t.tokens / budget) * 100));
                    tokenProgressEl.style.width = pct + '%';
    
                    tokenProgressEl.className = 'progress-fill';
                    if (pct > 95) {
                      tokenProgressEl.classList.add('danger');
                    } else if (pct > 75) {
                      tokenProgressEl.classList.add('warning');
                    }
    
                    // Update Format Badge
                    if (data.format) {
                      formatInfoEl.textContent = data.format;
                      formatInfoEl.className = 'badge format-' + data.format.toLowerCase();
                    } else {
                      formatInfoEl.className = 'badge';
                      formatInfoEl.textContent = 'TXT';
                    }
                  }
                });
    
                // Initial load
                vscode.postMessage({ command: 'loadSelection', options: { includeTreeStructure: false } });
                
                // Add keyboard listener for copy
                document.addEventListener('keydown', e => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'c' && document.activeElement !== previewEl) {
                    copyBtn.click();
                  }
                });
              </script>
            </body>
          </html>
    `;
    }
}