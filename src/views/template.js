"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDirectoryViewContent = generateDirectoryViewContent;
exports.generateSelectedFilesViewContent = generateSelectedFilesViewContent;
exports.generateErrorContent = generateErrorContent;
const styles_1 = require("./styles");
const constants_1 = require("../config/constants");
function generateDirectoryViewContent(files, workspacePath, separator = constants_1.DEFAULT_SEPARATOR) {
    return `<!DOCTYPE html>
<html style="height: 100%">
  <head>
    <style>${styles_1.styles}</style>
  </head>
  <body>
    <div class="header">
      <span>Directory List</span>
      <div class="header-icons">
        <div id="copy-icon" class="icon" title="Copy to Clipboard">📄</div>
        <div class="settings-icon icon" title="Settings">⚙️
          <div class="settings-dropdown">
            <div>Separator:</div>
            <input type="text" class="separator-input" value="${separator}" />
          </div>
        </div>
      </div>
    </div>
    <div id="root"></div>
    <script>
      const vscode = acquireVsCodeApi();
      const files = ${JSON.stringify(files, null, 2)};
      const workspacePath = ${JSON.stringify(workspacePath)};
      let separator = ${JSON.stringify(separator)};
      let totalFiles = 0;
      let checkedFiles = 0;
      
      const state = vscode.getState() || { 
        scrollPosition: 0,
        folderStates: {},
        separator: separator
      };
      if (!state.folderStates) {
        state.folderStates = {};
      }
      
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
      
      document.getElementById('root').addEventListener('scroll', saveScrollPosition);
      
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
      
      const rootElement = document.getElementById('root');
      if (files && files.length > 0) {
        renderFiles(rootElement, files);
        requestAnimationFrame(restoreScrollPosition);
      } else {
        rootElement.innerHTML = '<div style="padding: 4px;">No files available</div>';
      }

      document.getElementById('copy-icon').onclick = () => {
        const checkedItems = Array.from(document.getElementsByClassName('checked'))
          .filter(el => !el.querySelector('.folder')); // Exclude folders
        
        if (checkedItems.length === 0) return;
        
        vscode.postMessage({
          command: 'copySelected'
        });
        
        const icon = document.getElementById('copy-icon');
        icon.textContent = '✓';
        setTimeout(() => icon.textContent = '📄', 2000);
      };
      
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
        separator = e.target.value || '${constants_1.DEFAULT_SEPARATOR}';
        state.separator = separator;
        vscode.setState(state);
        vscode.postMessage({
          command: 'updateSeparator',
          separator: separator
        });
      };
    </script>
  </body>
</html>`;
}
function generateSelectedFilesViewContent(checkedContents, workspacePath, separator = constants_1.DEFAULT_SEPARATOR) {
    return `<!DOCTYPE html>
<html>
  <head>
    <style>${styles_1.styles}</style>
  </head>
  <body>
    <div class="header">
      <span>Selected Files</span>
      <div class="header-icons">
        <div id="copy-icon" class="icon" title="Copy to Clipboard">📄</div>
        <div class="settings-icon icon" title="Settings">⚙️
          <div class="settings-dropdown">
            <div>Separator:</div>
            <input type="text" class="separator-input" value="${separator}" />
          </div>
        </div>
      </div>
    </div>
    <div class="file-list-section">
      <div id="file-list" class="file-list-content"></div>
      <div id="total-tokens" class="total-tokens"></div>
    </div>
    <script>
      const vscode = acquireVsCodeApi();
      const checkedContents = ${JSON.stringify(checkedContents, null, 2)};
      const workspacePath = ${JSON.stringify(workspacePath)};
      let separator = ${JSON.stringify(separator)};
      
      const state = vscode.getState() || { separator: separator };
      
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
        separator = e.target.value || '${constants_1.DEFAULT_SEPARATOR}';
        state.separator = separator;
        vscode.setState(state);
        vscode.postMessage({
          command: 'updateSeparator',
          separator: separator
        });
      };
      
      updateFileList();
    </script>
  </body>
</html>`;
}
function generateErrorContent(message) {
    return `<!DOCTYPE html>
    <html>
      <body style="padding: 20px;">
        <div style="color: var(--vscode-errorForeground);">
          ${message}
        </div>
      </body>
    </html>`;
}
//# sourceMappingURL=template.js.map