export const styles = `
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
  display: block;
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
`;
