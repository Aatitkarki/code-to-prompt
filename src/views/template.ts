import { styles } from "./styles";
import { DEFAULT_SEPARATOR } from "../config/constants";
import { FileItem, FileContent } from "../models/types";

/**
 * Generate the WebView HTML content
 */
export function generateWebViewContent(
  files: FileItem[],
  checkedContents: FileContent[],
  workspacePath: string
): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <style>${styles}</style>
  </head>
  <body>
    <div class="header">
      <span>Directory List</span>
      <div class="settings-icon" title="Settings">⚙️
        <div class="settings-dropdown">
          <div>Separator:</div>
          <input type="text" class="separator-input" value="${DEFAULT_SEPARATOR}" />
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
      
      // Initialize state storage
      const state = vscode.getState() || { 
        scrollPosition: 0, 
        separator: '${DEFAULT_SEPARATOR}',
        folderStates: {}
      };

      // Ensure folderStates exists
      if (!state.folderStates) {
        state.folderStates = {};
      }
      
      let separator = state.separator;
      
      // Update separator input initial value
      document.querySelector('.separator-input').value = separator;

      function saveFolderState(path, isCollapsed) {
        state.folderStates[path] = isCollapsed;
        vscode.setState(state);
      }

      function getFolderState(path) {
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

      // Add scroll event listener
      document.getElementById('root').addEventListener('scroll', saveScrollPosition);
      
      function updateFileList() {
        const fileList = document.getElementById('file-list');
        const totalTokensEl = document.getElementById('total-tokens');
        
        if (checkedContents.length === 0) {
          fileList.textContent = 'No files selected';
          totalTokensEl.textContent = '';
          return;
        }
        
        const fragment = document.createDocumentFragment();
        let totalTokens = 0;
        
        checkedContents.forEach(file => {
          const relativePath = file.path.replace(workspacePath + '/', '');
          totalTokens += file.tokens;
          const content = \`\${separator}\\n// \${relativePath} \\n\${separator}\\n\${file.content}\\n\${separator}\\n\\n\`;
          fragment.appendChild(document.createTextNode(content));
        });
        
        fileList.textContent = '';
        fileList.appendChild(fragment);
        totalTokensEl.textContent = \`Total tokens: \${totalTokens}\`;
      }

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

      const debouncedUpdateFileList = debounce(updateFileList, 100);

      document.getElementById('copy-icon').onclick = () => {
        if (checkedContents.length === 0) return;

        const llmFormattedContent = checkedContents.map(file => {
          const relativePath = file.path.replace(workspacePath + '/', '');
          return \`\${separator}\\n// \${relativePath} \\n\${separator}\\n\${file.content}\\n\${separator}\`;
        }).join('\\n\\n');
        
        navigator.clipboard.writeText(llmFormattedContent);
        const icon = document.getElementById('copy-icon');
        icon.textContent = '✓';
        setTimeout(() => icon.textContent = '📄', 2000);
      };

      function updateChildrenState(container, checked) {
        const items = container.getElementsByClassName('item');
        const paths = [];
        
        Array.from(items).forEach(item => {
          const shouldUpdate = checked !== item.classList.contains('checked');
          if (shouldUpdate) {
            item.classList.toggle('checked');
            paths.push(item.dataset.path);
          }
        });
        
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
      
        if (!item.isDirectory && item.tokens > 0) {
          const tokenCount = document.createElement('span');
          tokenCount.className = 'token-count';
          tokenCount.textContent = item.tokens + ' tokens';
          div.appendChild(tokenCount);
        }
        
        div.onclick = (e) => {
          e.stopPropagation();
          const isNowChecked = !div.classList.contains('checked');
          
          saveScrollPosition();
          div.classList.toggle('checked');
          
          const nextSibling = div.nextElementSibling;
          if (nextSibling && nextSibling.classList.contains('children')) {
            updateChildrenState(nextSibling, isNowChecked);
          }
      
          vscode.postMessage({
            command: 'toggleItem',
            path: item.path
          });
          
          debouncedUpdateFileList();
        };
        
        return div;
      }
      
      function renderFiles(container, items) {
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

      // Initialize and render
      const rootElement = document.getElementById('root');
      if (files && files.length > 0) {
        renderFiles(rootElement, files);
        updateFileList();
        requestAnimationFrame(restoreScrollPosition);
        vscode.postMessage({
          command: 'updateCounts',
          total: totalFiles,
          checked: checkedFiles
        });
      } else {
        rootElement.innerHTML = '<div style="padding: 8px;">No files available</div>';
      }

      // Settings handlers
      const settingsIcon = document.querySelector('.settings-icon');
      const settingsDropdown = document.querySelector('.settings-dropdown');
      const separatorInput = document.querySelector('.separator-input');
      
      settingsIcon.onclick = (e) => {
        e.stopPropagation();
        settingsDropdown.classList.toggle('show');
      };
      
      settingsDropdown.onclick = (e) => e.stopPropagation();
      
      document.addEventListener('click', (e) => {
        if (!settingsIcon.contains(e.target)) {
          settingsDropdown.classList.remove('show');
        }
      });
      
      separatorInput.oninput = (e) => {
        separator = e.target.value || '${DEFAULT_SEPARATOR}';
        state.separator = separator;
        vscode.setState(state);
        updateFileList();
      };
    </script>
  </body>
</html>`;
}

/**
 * Generate error content for the WebView
 */
export function generateErrorContent(message: string): string {
  return `<!DOCTYPE html>
    <html>
      <body style="padding: 20px;">
        <div style="color: var(--vscode-errorForeground);">
          ${message}
        </div>
      </body>
    </html>`;
}
