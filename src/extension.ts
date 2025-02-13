import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { encoding_for_model } from "tiktoken";

class FileExplorerViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _fileSystemProvider: FileSystemProvider;

  constructor(private readonly _extensionUri: vscode.Uri) {
    this._fileSystemProvider = new FileSystemProvider();
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
        }
      });

      // Get initial content
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        webviewView.webview.html = this._getErrorContent("No folder is open");
        return;
      }

      const rootPath = workspaceFolders[0].uri.fsPath;
      const files = await this._scanDirectory(rootPath, false);
      const checkedContents = this._fileSystemProvider.getCheckedFilesContent();
      
      // Set initial HTML content
      webviewView.webview.html = this._getWebviewContent(files, checkedContents, rootPath);

    } catch (error) {
      console.error("Error in resolveWebviewView:", error);
      webviewView.webview.html = this._getErrorContent(
        "Failed to load files. Please try again."
      );
    }
  }

  private async _refreshView() {
    if (!this._view) {
      return;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      this._view.webview.html = this._getErrorContent("No folder is open");
      return;
    }

    try {
      const rootPath = workspaceFolders[0].uri.fsPath;
      console.log("Scanning directory:", rootPath);
      const files = await this._scanDirectory(rootPath, false);
      const checkedContents = this._fileSystemProvider.getCheckedFilesContent();

      // If the view hasn't been initialized yet, set the full HTML
      if (!this._view.webview.html) {
        this._view.webview.html = this._getWebviewContent(files, checkedContents, rootPath);
      } else {
        // Otherwise just update the data via postMessage
        this._view.webview.postMessage({
          command: "updateFiles",
          files,
          checkedContents,
        });
      }
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
      const result = [];
      const entries = await fs.promises.readdir(dirPath);

      // Asset-related folders to exclude
      const excludedFolders = [
        "node_modules",
        "dist",
        "out",
        "assets",
        "images",
        "img",
        "icons",
        "media",
        "public",
      ];

      // Programming file extensions to include
      const programmingExtensions = [
        // Web development
        ".js",
        ".ts",
        ".jsx",
        ".tsx",
        ".html",
        ".css",
        ".scss",
        ".sass",
        ".less",
        // Backend
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
        // Mobile
        ".swift",
        ".kt",
        ".dart",
        ".m",
        ".mm",
        // Configuration & Data
        ".json",
        ".yaml",
        ".yml",
        ".xml",
        ".toml",
        ".ini",
        ".env",
        // Shell & Scripts
        ".sh",
        ".bash",
        ".zsh",
        ".ps1",
        ".bat",
        ".cmd",
        // Other
        ".sql",
        ".graphql",
        ".proto",
        ".vue",
        ".svelte",
        ".elm",
      ];

      // Asset file extensions to exclude (keep this for additional filtering)
      const assetExtensions = [
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".svg",
        ".ico",
        ".webp",
        ".bmp",
        ".tiff",
        ".mp4",
        ".mov",
        ".avi",
        ".mp3",
        ".wav",
        ".ogg",
        ".woff",
        ".woff2",
        ".ttf",
        ".eot",
      ];

      for (const entryName of entries) {
        if (
          entryName.startsWith(".") ||
          excludedFolders.includes(entryName.toLowerCase())
        ) {
          continue;
        }

        const fullPath = path.join(dirPath, entryName);
        try {
          const stat = await fs.promises.stat(fullPath);

          // For files, only include programming files and skip assets
          if (!stat.isDirectory()) {
            const lowerName = entryName.toLowerCase();
            // Skip if it's an asset file
            if (assetExtensions.some((ext) => lowerName.endsWith(ext))) {
              continue;
            }
            // Skip if it's not a programming file
            if (!programmingExtensions.some((ext) => lowerName.endsWith(ext))) {
              continue;
            }
          }

          const isChecked = this._fileSystemProvider.isChecked(fullPath);
          const fileData: any = {
            name: entryName,
            path: fullPath,
            isDirectory: stat.isDirectory(),
            isChecked: isChecked,
          };

          if (!stat.isDirectory()) {
            const { tokens } =
              this._fileSystemProvider.getFileContent(fullPath);
            fileData.tokens = tokens;
          }

          fileData.children = stat.isDirectory()
            ? await this._scanDirectory(fullPath, isChecked)
            : undefined;

          result.push(fileData);
        } catch (error) {
          console.warn(`Skipping ${entryName} due to error:`, error);
        }
      }

      return result.sort((a, b) => {
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
            display: flex;
            align-items: center;
          }
          .folder:before {
            content: "📁";
            font-size: 12px;
          }
          .arrow {
            margin-left: auto;
            padding: 0 4px;
            cursor: pointer;
            opacity: 0.7;
            font-size: 12px;
            transition: transform 0.2s;
            user-select: none;
          }
          .arrow:after {
            content: "⌵";
          }
          .item.expanded .arrow {
            transform: rotate(180deg);
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
            display: none;
          }
          .children.expanded {
            display: block;
          }
          .name {
            flex: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            line-height: 20px;
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
          
          // Initialize state storage for scroll position, separator and expanded states
          const state = vscode.getState() || { 
            scrollPosition: 0, 
            separator: '=====',
            expandedPaths: []  // Initialize as array since Set can't be serialized directly
          };
          let separator = state.separator;
          let expandedPaths = new Set(state.expandedPaths || []); // Ensure we handle null/undefined case
          
          // Update separator input initial value
          document.querySelector('.separator-input').value = separator;
          
          function saveState() {
            state.expandedPaths = Array.from(expandedPaths);
            state.scrollPosition = document.getElementById('root').scrollTop;
            state.separator = separator;
            vscode.setState(state);
          }

          function saveScrollPosition() {
            state.scrollPosition = document.getElementById('root').scrollTop;
            saveState();
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
            
            let totalTokens = 0;
            const formattedContent = checkedContents.map(file => {
              const relativePath = file.path.replace(workspacePath + '/', '');
              totalTokens += file.tokens;
              return \`\${separator}\\n// \${relativePath} \\n\${separator}\\n\${file.content}\\n\${separator}\`;
            }).join('\\n\\n');
            
            fileList.textContent = formattedContent;
            totalTokensEl.textContent = \`Total tokens: \${totalTokens}\`;
            saveState(); // Save state after update
          }

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
            const items = container.querySelectorAll('.item');
            items.forEach(item => {
              if (checked) {
                item.classList.add('checked');
              } else {
                item.classList.remove('checked');
              }
            });
          }

          function createItem(item) {
            totalFiles++;
            if (item.isChecked) {
              checkedFiles++;
            }

            const div = document.createElement('div');
            div.className = 'item' + (item.isChecked ? ' checked' : '');
            if (item.isDirectory) {
              // Set expanded state based on saved state
              if (expandedPaths.has(item.path)) {
                div.classList.add('expanded');
              }
            }
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

            // Add token count for files
            if (!item.isDirectory && item.tokens > 0) {
              const tokenCount = document.createElement('span');
              tokenCount.className = 'token-count';
              tokenCount.textContent = item.tokens + ' tokens';
              div.appendChild(tokenCount);
            }

            // Add arrow for directories
            if (item.isDirectory) {
              const arrow = document.createElement('span');
              arrow.className = 'arrow';
              div.appendChild(arrow);

              // Handle arrow click separately
              arrow.onclick = (e) => {
                e.stopPropagation();
                
                // Toggle folder expansion only
                const isExpanded = div.classList.contains('expanded');
                if (isExpanded) {
                  div.classList.remove('expanded');
                  expandedPaths.delete(item.path);
                } else {
                  div.classList.add('expanded');
                  expandedPaths.add(item.path);
                }
                
                // Save the expanded state
                saveState();
                
                // Toggle children visibility
                const nextSibling = div.nextElementSibling;
                if (nextSibling && nextSibling.classList.contains('children')) {
                  if (isExpanded) {
                    nextSibling.classList.remove('expanded');
                  } else {
                    nextSibling.classList.add('expanded');
                  }
                }
              };
            }
            
            // Handle checkbox click on the main div
            div.onclick = (e) => {
              if (e.target.classList.contains('arrow')) {
                return; // Don't handle if arrow was clicked
              }
              
              e.stopPropagation();
              
              // Handle checkbox state
              const isNowChecked = !div.classList.contains('checked');
              
              // Save scroll position before update
              saveScrollPosition();
              
              // Toggle this item's state
              if (isNowChecked) {
                div.classList.add('checked');
              } else {
                div.classList.remove('checked');
              }
              
              // Update children if this is a directory
              const nextSibling = div.nextElementSibling;
              if (nextSibling && nextSibling.classList.contains('children')) {
                updateChildrenState(nextSibling, isNowChecked);
              }

              vscode.postMessage({
                command: 'toggleItem',
                path: item.path
              });
              
              updateFileList();
            };
            
            return div;
          }

          function renderFiles(container, items) {
            items.forEach(item => {
              const itemEl = createItem(item);
              container.appendChild(itemEl);
              
              if (item.children && item.children.length > 0) {
                const childrenDiv = document.createElement('div');
                // Set expanded state based on parent's state
                childrenDiv.className = 'children' + (expandedPaths.has(item.path) ? ' expanded' : '');
                renderFiles(childrenDiv, item.children);
                container.appendChild(childrenDiv);
              }
            });
          }

          renderFiles(document.getElementById('root'), files);
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

          // Handle messages from the extension
          window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
              case 'updateFiles':
                // Update files while preserving expansion state
                files = message.files;
                checkedContents = message.checkedContents;
                const root = document.getElementById('root');
                if (!root) {
                    console.error('Root element not found');
                    return;
                }
                const oldScrollTop = root.scrollTop;
                const savedExpandedPaths = new Set(expandedPaths); // Save current expanded state
                root.innerHTML = '';
                renderFiles(root, files);
                expandedPaths = savedExpandedPaths; // Restore expanded state
                updateFileList();
                root.scrollTop = oldScrollTop;
                saveState(); // Make sure state is saved after update
                break;
            }
          });

          // Ensure initial render happens
          const root = document.getElementById('root');
          if (root && (!root.children.length || root.children.length === 0)) {
            renderFiles(root, files);
            updateFileList();
            // Restore scroll position after initial render
            requestAnimationFrame(() => {
              if (state.scrollPosition) {
                root.scrollTop = state.scrollPosition;
              }
            });
          }
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
  private encoder = encoding_for_model("gpt-4");

  toggleChecked(path: string) {
    const isChecked = this.checkedItems.has(path);
    try {
      if (isChecked) {
        // Uncheck this item and all children
        this.checkedItems.delete(path);
        const stat = fs.statSync(path);
        if (stat.isDirectory()) {
          const entries = fs.readdirSync(path);
          for (const entry of entries) {
            const fullPath = path.endsWith("/")
              ? path + entry
              : path + "/" + entry;
            this.checkedItems.delete(fullPath);
            this.setChildrenState(fullPath, false);
          }
        }
      } else {
        // Check this item and all children
        this.checkedItems.add(path);
        const stat = fs.statSync(path);
        if (stat.isDirectory()) {
          const entries = fs.readdirSync(path);
          for (const entry of entries) {
            const fullPath = path.endsWith("/")
              ? path + entry
              : path + "/" + entry;
            if (
              !entry.startsWith(".") &&
              entry !== "node_modules" &&
              entry !== "dist" &&
              entry !== "out"
            ) {
              this.checkedItems.add(fullPath);
              this.setChildrenState(fullPath, true);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error toggling path ${path}:`, error);
    }
  }

  private setChildrenState(path: string, state: boolean) {
    try {
      const stat = fs.statSync(path);
      if (stat.isDirectory()) {
        const entries = fs.readdirSync(path);
        for (const entry of entries) {
          if (
            !entry.startsWith(".") &&
            entry !== "node_modules" &&
            entry !== "dist" &&
            entry !== "out"
          ) {
            const fullPath = path.endsWith("/")
              ? path + entry
              : path + "/" + entry;
            if (state) {
              this.checkedItems.add(fullPath);
            } else {
              this.checkedItems.delete(fullPath);
            }
            this.setChildrenState(fullPath, state);
          }
        }
      }
    } catch (error) {
      console.error(`Error setting children state for ${path}:`, error);
    }
  }

  isChecked(path: string): boolean {
    return this.checkedItems.has(path);
  }

  getFileContent(path: string): { content: string; tokens: number } {
    try {
      const content = fs.readFileSync(path, "utf8");
      const tokens = this.encoder.encode(content).length;
      return { content, tokens };
    } catch (error) {
      console.error(`Error reading file ${path}:`, error);
      return { content: `Error reading file content`, tokens: 0 };
    }
  }

  getCheckedFilesContent(): Array<{
    path: string;
    content: string;
    tokens: number;
  }> {
    const contents = [];
    let totalTokens = 0;
    for (const path of this.checkedItems) {
      try {
        const stat = fs.statSync(path);
        if (!stat.isDirectory()) {
          const { content, tokens } = this.getFileContent(path);
          contents.push({
            path,
            content,
            tokens,
          });
          totalTokens += tokens;
        }
      } catch (error) {
        console.error(`Error processing file ${path}:`, error);
      }
    }
    return contents;
  }
}

export function activate(context: vscode.ExtensionContext) {
  const provider = new FileExplorerViewProvider(context.extensionUri);

  // Register the WebviewViewProvider
  const registration = vscode.window.registerWebviewViewProvider(
    "fileExplorerView",
    provider,
    {
      webviewOptions: { retainContextWhenHidden: true },
    }
  );

  // Register the command handler
  const disposable = vscode.commands.registerCommand(
    "fileExplorer.openWebview",
    () => {
      // Show the view
      vscode.commands.executeCommand("workbench.view.extension.fileExplorer");
    }
  );

  // Watch for workspace folder changes
  const watcher = vscode.workspace.onDidChangeWorkspaceFolders(() => {
    if (provider["_view"]) {
      provider["_refreshView"]();
    }
  });

  // Force open the view when extension activates
  vscode.commands.executeCommand("workbench.view.extension.fileExplorer");

  context.subscriptions.push(registration, watcher, disposable);
}

export function deactivate() {}
