import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs/promises";
import { encoding_for_model } from "tiktoken";

// Cache for file stats and tokens to avoid redundant calculations
class FileCache {
  private statsCache = new Map<string, { isDirectory: boolean; mtime: Date }>();
  private tokenCache = new Map<
    string,
    { tokens: number; content: string; mtime: Date }
  >();
  private encoder = encoding_for_model("gpt-4");

  async getStats(path: string) {
    const cached = this.statsCache.get(path);
    try {
      const stat = await fs.stat(path);
      const current = { isDirectory: stat.isDirectory(), mtime: stat.mtime };

      if (!cached || cached.mtime < current.mtime) {
        this.statsCache.set(path, current);
        return current;
      }
      return cached;
    } catch (error) {
      console.error(`Error getting stats for ${path}:`, error);
      return null;
    }
  }

  async getFileContent(path: string) {
    const cached = this.tokenCache.get(path);
    try {
      const stat = await fs.stat(path);
      if (cached && cached.mtime >= stat.mtime) {
        return cached;
      }

      const content = await fs.readFile(path, "utf8");
      const tokens = this.encoder.encode(content).length;
      const result = { content, tokens, mtime: stat.mtime };
      this.tokenCache.set(path, result);
      return result;
    } catch (error) {
      console.error(`Error reading file ${path}:`, error);
      return {
        content: `Error reading file content`,
        tokens: 0,
        mtime: new Date(),
      };
    }
  }

  clear() {
    this.statsCache.clear();
    this.tokenCache.clear();
  }
}

class FileExplorerViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _fileSystemProvider: FileSystemProvider;
  private _debounceTimer?: NodeJS.Timeout;
  private _cache: FileCache;

  constructor(private readonly _extensionUri: vscode.Uri) {
    this._fileSystemProvider = new FileSystemProvider();
    this._cache = new FileCache();
  }

  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    try {
      this._view = webviewView;

      webviewView.webview.options = {
        enableScripts: true,
        localResourceRoots: [this._extensionUri],
      };

      // Set up message listener
      webviewView.webview.onDidReceiveMessage(async (message) => {
        switch (message.command) {
          case "toggleItem":
            this._fileSystemProvider.toggleChecked(message.path);
            await this._refreshView();
            break;
          case "toggleItems":
            this._fileSystemProvider.batchToggleChecked(message.paths);
            await this._refreshView();
            break;
        }
      });

      await this._refreshView();
    } catch (error) {
      console.error("Error in resolveWebviewView:", error);
      webviewView.webview.html = this._getErrorContent(
        "Failed to load files. Please try again."
      );
    }
  }

  private debounceRefresh(delay = 300) {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }
    this._debounceTimer = setTimeout(() => this._refreshView(), delay);
  }

  private async _refreshView() {
    if (!this._view) return;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      this._view.webview.html = this._getErrorContent("No folder is open");
      return;
    }

    try {
      const rootPath = workspaceFolders[0].uri.fsPath;
      console.log("Scanning directory:", rootPath);
      const files = await this._scanDirectory(rootPath, false);
      const checkedContents =
        await this._fileSystemProvider.getCheckedFilesContent(this._cache);
      this._view.webview.html = this._getWebviewContent(
        files,
        checkedContents,
        rootPath
      );
    } catch (error) {
      console.error("Error refreshing view:", error);
      this._view.webview.html = this._getErrorContent(
        "Failed to refresh files"
      );
    }
  }

  private async _scanDirectory(
    dirPath: string,
    parentIsChecked: boolean = false
  ): Promise<any[]> {
    try {
      const entries = await fs.readdir(dirPath);
      const result = [];

      // Move these to class constants
      const excludedFolders = new Set([
        "node_modules",
        "dist",
        "out",
        "assets",
        "images",
        "img",
        "icons",
        "media",
        "public",
      ]);

      const programmingExtensions = new Set([
        ".js",
        ".ts",
        ".jsx",
        ".tsx",
        ".html",
        ".css",
        ".scss",
        ".sass",
        ".less",
        ".py",
        ".java",
        ".rb",
        ".php",
        ".go",
        ".rs",
        ".cs",
        ".cpp",
        ".c",
        ".h",
        ".swift",
        ".kt",
        ".dart",
        ".m",
        ".mm",
        ".json",
        ".yaml",
        ".yml",
        ".xml",
        ".toml",
        ".ini",
        ".env",
        ".sh",
        ".bash",
        ".zsh",
        ".ps1",
        ".bat",
        ".cmd",
        ".sql",
        ".graphql",
        ".proto",
        ".vue",
        ".svelte",
        ".elm",
      ]);

      const processPromises = entries
        .filter(
          (entryName) =>
            !entryName.startsWith(".") &&
            !excludedFolders.has(entryName.toLowerCase())
        )
        .map(async (entryName) => {
          const fullPath = path.join(dirPath, entryName);
          const stats = await this._cache.getStats(fullPath);
          if (!stats) return null;

          // For files, only include programming files
          if (!stats.isDirectory) {
            const ext = path.extname(entryName).toLowerCase();
            if (!programmingExtensions.has(ext)) return null;
          }

          const isChecked = this._fileSystemProvider.isChecked(fullPath);
          const fileData: any = {
            name: entryName,
            path: fullPath,
            isDirectory: stats.isDirectory,
            isChecked,
          };

          if (!stats.isDirectory) {
            const { tokens } = await this._cache.getFileContent(fullPath);
            fileData.tokens = tokens;
          } else {
            fileData.children = await this._scanDirectory(fullPath, isChecked);
          }

          return fileData;
        });

      const items = (await Promise.all(processPromises)).filter(
        (item) => item !== null
      );

      return items.sort((a, b) => {
        if (a.isDirectory === b.isDirectory) {
          return a.name.localeCompare(b.name);
        }
        return a.isDirectory ? -1 : 1;
      });
    } catch (error) {
      console.error(`Error scanning directory ${dirPath}:`, error);
      throw error; // Let the error propagate to show proper error message in UI
    }
  }

  private _getWebviewContent(
    files: any[],
    checkedContents: Array<{ path: string; content: string; tokens: number }>,
    workspacePath: string
  ) {
    return `<!DOCTYPE html>
    <html>
      <head>
        <style>
          body {
            padding: 5px;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            height: 100vh;
            margin: 0;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }
          .header {
            font-size: 1.1em;
            font-weight: bold;
            margin-bottom: 8px;
            padding: 4px;
            border-bottom: 1px solid var(--vscode-panel-border);
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .settings-icon {
            cursor: pointer;
            opacity: 0.8;
            padding: 4px;
            position: relative;
          }
          .settings-icon:hover {
            opacity: 1;
          }
          .settings-dropdown {
            position: absolute;
            top: 100%;
            right: 0;
            background: var(--vscode-dropdown-background);
            border: 1px solid var(--vscode-dropdown-border);
            border-radius: 3px;
            padding: 8px;
            display: none;
            z-index: 1000;
          }
          .settings-dropdown.show {
            display: block;
          }
          .separator-input {
            margin-top: 4px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 2px 4px;
            border-radius: 2px;
          }
          #root {
            flex: 1;
            overflow-y: auto;
            max-height: 50vh;
            padding-bottom: 5px;
            border-bottom: 1px solid var(--vscode-panel-border);
          }
          .item {
            padding: 2px 4px;
            display: flex;
            align-items: center;
            cursor: pointer;
            border-radius: 2px;
            min-height: 20px;
          }
          .item:hover {
            background: var(--vscode-list-hoverBackground);
          }
          .item:not(.checked) .name {
            text-decoration: line-through;
            opacity: 0.7;
          }
          .checkbox {
            width: 14px;
            height: 14px;
            margin-right: 4px;
            border: 1px solid var(--vscode-checkbox-border);
            border-radius: 3px;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .item.checked .checkbox:before {
            content: "✓";
            color: var(--vscode-checkbox-foreground);
            font-size: 11px;
          }
          .folder { 
            color: var(--vscode-symbolIcon-folderForeground);
            margin-right: 4px;
          }
          .folder:before {
            content: "📁";
            font-size: 12px;
          }
          .item.checked .folder:before {
            content: "📂";
          }
          .file { 
            color: var(--vscode-symbolIcon-fileForeground);
            margin-right: 4px;
          }
          .file:before {
            content: "📄";
            font-size: 12px;
          }
          .children { 
            margin-left: 12px;
            border-left: 1px solid var(--vscode-tree-inactiveIndentGuidesStroke);
            margin-top: 1px;
            margin-bottom: 1px;
            padding-left: 3px;
            display: block; /* Add this to control visibility */
          }
          .children.collapsed {
            display: none;
          }
          .name {
            flex: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            line-height: 20px;
          }
          .collapse-icon {
            margin-left: 4px;
            cursor: pointer;
            user-select: none;
            opacity: 0.7;
          }
          .collapse-icon:hover {
            opacity: 1;
          }
          .file-list-section {
            margin-top: 5px;
            padding-top: 5px;
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }
          .file-list-header {
            font-size: 1em;
            font-weight: bold;
            margin-bottom: 6px;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .copy-icon {
            cursor: pointer;
            opacity: 0.8;
            padding: 4px;
            border-radius: 4px;
          }
          .copy-icon:hover {
            opacity: 1;
            background: var(--vscode-button-background);
          }
          .file-list-content {
            white-space: pre-wrap;
            font-family: var(--vscode-editor-font-family);
            background: var(--vscode-textBlockQuote-background);
            padding: 8px;
            border-radius: 3px;
            overflow-y: auto;
            flex: 1;
          }
          .copy-button {
            display: none; /* Hide the old copy button */
          }
          .token-count {
            margin-left: 8px;
            font-size: 0.9em;
            color: var(--vscode-descriptionForeground);
          }
          .total-tokens {
            margin-top: 8px;
            font-size: 0.9em;
            color: var(--vscode-descriptionForeground);
          }
        </style>
      </head>
      <body>
        <div class="header">
          <span>Directory List</span>
          <div class="settings-icon" title="Settings">⚙️
            <div class="settings-dropdown">
              <div>Separator:</div>
              <input type="text" class="separator-input" value="=====" />
            </div>
          </div>
        </div>
        <div id="root"></div>
        <div class="file-list-section">
          <div class="file-list-header">
            Selected Files (LLM Format)
            <div id="copy-icon" class="copy-icon" title="Copy to Clipboard">📄</div>
          </div>
          <div id="file-list" class="file-list-content"></div>
          <div id="total-tokens" class="total-tokens"></div>
        </div>
        <script>
          const vscode = acquireVsCodeApi();
          const files = ${JSON.stringify(files, null, 2)};
          const checkedContents = ${JSON.stringify(checkedContents, null, 2)};
          const workspacePath = ${JSON.stringify(workspacePath)};
          let totalFiles = 0;
          let checkedFiles = 0;
          
          // Initialize state storage for scroll position, separator, and folder states
          const state = vscode.getState() || { 
            scrollPosition: 0, 
            separator: '=====',
            folderStates: {} // Changed from new Map() to plain object
          };

          // Ensure folderStates exists
          if (!state.folderStates) {
            state.folderStates = {};
          }
          
          let separator = state.separator;
          
          // Update separator input initial value
          document.querySelector('.separator-input').value = separator;

          function saveFolderState(path, isCollapsed) {
            if (!state.folderStates) {
              state.folderStates = {};
            }
            state.folderStates[path] = isCollapsed;
            vscode.setState(state);
          }

          function getFolderState(path) {
            if (!state.folderStates) {
              return true; // Default to collapsed
            }
            // If the state doesn't exist for this path, return true (collapsed)
            return state.folderStates[path] !== false;
          }

          function saveScrollPosition() {
            const rootElement = document.getElementById('root');
            state.scrollPosition = rootElement.scrollTop;
            vscode.setState(state);
          }

          function restoreScrollPosition() {
            const rootElement = document.getElementById('root');
            if (state.scrollPosition) {
              rootElement.scrollTop = state.scrollPosition;
            }
          }

          // Add scroll event listener to save position
          document.getElementById('root').addEventListener('scroll', () => {
            saveScrollPosition();
          });
          
          function updateFileList() {
            const fileList = document.getElementById('file-list');
            const totalTokensEl = document.getElementById('total-tokens');
            
            if (checkedContents.length === 0) {
              fileList.textContent = 'No files selected';
              totalTokensEl.textContent = '';
              return;
            }
            
            // Use DocumentFragment for batch DOM updates
            const fragment = document.createDocumentFragment();
            let totalTokens = 0;
            
            checkedContents.forEach(file => {
              const relativePath = file.path.replace(workspacePath + '/', '');
              totalTokens += file.tokens;
              const content = \`\${separator}\\n// \${relativePath} \\n\${separator}\\n\${file.content}\\n\${separator}\\n\\n\`;
              fragment.appendChild(document.createTextNode(content));
            });
            
            // Single DOM update
            fileList.textContent = '';
            fileList.appendChild(fragment);
            totalTokensEl.textContent = \`Total tokens: \${totalTokens}\`;
          }

          // Debounce function
          function debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
              const later = () => {
                clearTimeout(timeout);
                func(...args);
              };
              clearTimeout(timeout);
              timeout = setTimeout(later, wait);
            };
          }

          // Debounced version of updateFileList
          const debouncedUpdateFileList = debounce(updateFileList, 100);

          document.getElementById('copy-icon').onclick = () => {
            if (checkedContents.length === 0) {
              return;
            }

            const llmFormattedContent = checkedContents.map(file => {
              const relativePath = file.path.replace(workspacePath + '/', '');
              return \`\${separator}\\n// \${relativePath} \\n\${separator}\\n\${file.content}\\n\${separator}\`;
            }).join('\\n\\n');
            
            navigator.clipboard.writeText(llmFormattedContent);
            const icon = document.getElementById('copy-icon');
            icon.textContent = '✓';
            setTimeout(() => {
              icon.textContent = '📄';
            }, 2000);
          };

          function findParentItem(element) {
            let current = element;
            while (current && !current.classList.contains('item')) {
              current = current.parentElement;
            }
            return current;
          }

          function findItemByPath(container, path) {
            const items = container.querySelectorAll('.item');
            return Array.from(items).find(item => item.dataset.path === path);
          }

          function updateChildrenState(container, checked) {
            // Use more efficient querySelectorAll with specific class
            const items = container.getElementsByClassName('item');
            const paths = [];
            
            Array.from(items).forEach(item => {
              const shouldUpdate = checked !== item.classList.contains('checked');
              if (shouldUpdate) {
                item.classList.toggle('checked');
                paths.push(item.dataset.path);
              }
            });
            
            // Batch update messages
            if (paths.length > 0) {
              vscode.postMessage({
                command: 'toggleItems',
                paths: paths
              });
            }
          }

          function createItem(item) {
            totalFiles++;
            if (item.isChecked) {
              checkedFiles++;
            }
          
            const div = document.createElement('div');
            div.className = 'item' + (item.isChecked ? ' checked' : '');
            div.dataset.path = item.path;
            
            const checkbox = document.createElement('span');
            checkbox.className = 'checkbox';
            
            const icon = document.createElement('span');
            icon.className = item.isDirectory ? 'folder' : 'file';
            
            const name = document.createElement('span');
            name.className = 'name';
            name.textContent = item.name;
            
            div.appendChild(checkbox);
            div.appendChild(icon);
            div.appendChild(name);
          
            // Add collapse/expand icon for directories
            if (item.isDirectory && item.children && item.children.length > 0) {
              const collapseIcon = document.createElement('span');
              collapseIcon.className = 'collapse-icon';
              const isCollapsed = getFolderState(item.path);
              collapseIcon.textContent = isCollapsed ? '↓' : '↑';
              collapseIcon.onclick = (e) => {
                e.stopPropagation();
                const nextSibling = div.nextElementSibling;
                if (nextSibling && nextSibling.classList.contains('children')) {
                  const isCollapsed = nextSibling.classList.toggle('collapsed');
                  collapseIcon.textContent = isCollapsed ? '↓' : '↑';
                  saveFolderState(item.path, isCollapsed);
                }
              };
              div.appendChild(collapseIcon);
            }
          
            // Add token count for files
            if (!item.isDirectory && item.tokens > 0) {
              const tokenCount = document.createElement('span');
              tokenCount.className = 'token-count';
              tokenCount.textContent = item.tokens + ' tokens';
              div.appendChild(tokenCount);
            }
            
            div.onclick = (e) => {
              e.stopPropagation();
              const isNowChecked = !div.classList.contains('checked');
              
              // Save scroll position before update
              saveScrollPosition();
              
              // Toggle this item's state
              div.classList.toggle('checked');
              
              // Update children if this is a directory
              const nextSibling = div.nextElementSibling;
              if (nextSibling && nextSibling.classList.contains('children')) {
                updateChildrenState(nextSibling, isNowChecked);
              }
          
              // Send message for this item
              vscode.postMessage({
                command: 'toggleItem',
                path: item.path
              });
              
              // Use debounced update
              debouncedUpdateFileList();
            };
            
            return div;
          }
          
          function renderFiles(container, items) {
            // Clear the container first
            container.innerHTML = '';
            
            items.forEach(item => {
              const itemEl = createItem(item);
              container.appendChild(itemEl);
              
              if (item.children && item.children.length > 0) {
                const childrenDiv = document.createElement('div');
                childrenDiv.className = 'children' + (getFolderState(item.path) ? ' collapsed' : '');
                renderFiles(childrenDiv, item.children);
                container.appendChild(childrenDiv);
              }
            });
          }

          // Initialize and render the file tree
          const rootElement = document.getElementById('root');
          if (files && files.length > 0) {
            renderFiles(rootElement, files);
            updateFileList();

            // Restore scroll position after rendering
            requestAnimationFrame(() => {
              restoreScrollPosition();
            });

            // Notify extension of initial counts
            vscode.postMessage({
              command: 'updateCounts',
              total: totalFiles,
              checked: checkedFiles
            });
          } else {
            rootElement.innerHTML = '<div style="padding: 8px;">No files available</div>';
          }

          // Add settings icon click handler
          const settingsIcon = document.querySelector('.settings-icon');
          const settingsDropdown = document.querySelector('.settings-dropdown');
          const separatorInput = document.querySelector('.separator-input');
          
          settingsIcon.onclick = (e) => {
            e.stopPropagation();
            settingsDropdown.classList.toggle('show');
          };
          
          // Prevent dropdown from closing when clicking inside it
          settingsDropdown.onclick = (e) => {
            e.stopPropagation();
          };
          
          document.addEventListener('click', (e) => {
            if (!settingsIcon.contains(e.target)) {
              settingsDropdown.classList.remove('show');
            }
          });
          
          separatorInput.oninput = (e) => {
            separator = e.target.value || '=====';
            state.separator = separator; // Save separator to state
            vscode.setState(state);
            updateFileList();
          };
        </script>
      </body>
    </html>`;
  }

  private _getErrorContent(message: string) {
    return `<!DOCTYPE html>
      <html>
        <body style="padding: 20px;">
          <div style="color: var(--vscode-errorForeground);">
            ${message}
          </div>
        </body>
      </html>`;
  }
}

class FileSystemProvider {
  private checkedItems = new Set<string>();
  private batchUpdatesInProgress = false;
  private pendingUpdates = new Set<string>();

  toggleChecked(path: string) {
    if (this.checkedItems.has(path)) {
      this.checkedItems.delete(path);
    } else {
      this.checkedItems.add(path);
    }
  }

  // New method for batch updates
  batchToggleChecked(paths: string[]) {
    this.batchUpdatesInProgress = true;
    paths.forEach((path) => {
      this.pendingUpdates.add(path);
    });

    // Process batch updates
    setTimeout(() => {
      this.pendingUpdates.forEach((path) => {
        this.toggleChecked(path);
      });
      this.pendingUpdates.clear();
      this.batchUpdatesInProgress = false;
    }, 0);
  }

  isChecked(path: string): boolean {
    return this.checkedItems.has(path);
  }

  async getCheckedFilesContent(cache: FileCache): Promise<
    Array<{
      path: string;
      content: string;
      tokens: number;
    }>
  > {
    const contentPromises = Array.from(this.checkedItems).map(async (path) => {
      try {
        const stats = await cache.getStats(path);
        if (stats && !stats.isDirectory) {
          const { content, tokens } = await cache.getFileContent(path);
          return { path, content, tokens };
        }
      } catch (error) {
        console.error(`Error processing file ${path}:`, error);
      }
      return null;
    });

    const contents = (await Promise.all(contentPromises)).filter(
      (item) => item !== null
    );
    return contents;
  }
}

export function activate(context: vscode.ExtensionContext) {
  const provider = new FileExplorerViewProvider(context.extensionUri);

  // Register with retained context for better performance
  const registration = vscode.window.registerWebviewViewProvider(
    "fileExplorerView",
    provider,
    { webviewOptions: { retainContextWhenHidden: true } }
  );

  const watcher = vscode.workspace.createFileSystemWatcher(
    "**/*",
    false,
    true,
    true
  );
  watcher.onDidChange(() => provider["debounceRefresh"]());
  watcher.onDidCreate(() => provider["debounceRefresh"]());
  watcher.onDidDelete(() => provider["debounceRefresh"]());

  context.subscriptions.push(registration, watcher);
}

export function deactivate() {}
