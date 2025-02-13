import * as vscode from "vscode";
import { EXCLUDED_FOLDERS, PROGRAMMING_EXTENSIONS } from "../config/constants";

/**
 * Check if a file should be included based on its extension
 */
export function isValidProgrammingFile(fileName: string): boolean {
  const ext = fileName.toLowerCase().split(".").pop();
  return ext ? PROGRAMMING_EXTENSIONS.has(`.${ext}`) : false;
}

/**
 * Check if a directory should be excluded
 */
export function shouldExcludeDirectory(dirName: string): boolean {
  return EXCLUDED_FOLDERS.has(dirName.toLowerCase());
}

/**
 * Get relative path from workspace root
 */
export function getRelativePath(
  fullPath: string,
  workspacePath: string
): string {
  return fullPath.replace(workspacePath + "/", "");
}

/**
 * Show error message to user
 */
export function showError(message: string, error?: Error): void {
  const errorMessage = error ? `${message}: ${error.message}` : message;
  vscode.window.showErrorMessage(errorMessage);
  console.error(errorMessage, error);
}

/**
 * Create a disposable status bar item
 */
export function createStatusBarItem(
  text: string,
  tooltip?: string,
  command?: string
): vscode.StatusBarItem {
  const item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  item.text = text;
  if (tooltip) {
    item.tooltip = tooltip;
  }
  if (command) {
    item.command = command;
  }
  return item;
}

/**
 * Register a command with error handling
 */
export function registerCommandSafely(
  context: vscode.ExtensionContext,
  command: string,
  callback: (...args: any[]) => any
): void {
  const disposable = vscode.commands.registerCommand(
    command,
    async (...args) => {
      try {
        await callback(...args);
      } catch (error) {
        showError(`Error executing command ${command}`, error as Error);
      }
    }
  );
  context.subscriptions.push(disposable);
}

/**
 * Create and register a file system watcher
 */
export function createFileWatcher(
  pattern: string,
  onChange: () => void,
  context: vscode.ExtensionContext
): vscode.FileSystemWatcher {
  const watcher = vscode.workspace.createFileSystemWatcher(pattern);

  watcher.onDidChange(onChange);
  watcher.onDidCreate(onChange);
  watcher.onDidDelete(onChange);

  context.subscriptions.push(watcher);
  return watcher;
}

/**
 * Ensure workspace folder exists
 */
export function getWorkspaceFolder(): string {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    throw new Error("No workspace folder is open");
  }
  return workspaceFolders[0].uri.fsPath;
}
