import * as vscode from "vscode";
import { WATCHER_PATTERN } from "./config/constants";
import { DirectoryListProvider } from "./providers/DirectoryListProvider";
import { SelectedFilesProvider } from "./providers/SelectedFilesProvider";
import { FileSystemProvider } from "./providers/FileSystemProvider";
import { CacheProvider } from "./providers/CacheProvider";
import { createFileWatcher, showError } from "./utils/helpers";

/**
 * Activate the extension
 */
export function activate(context: vscode.ExtensionContext) {
  try {
    // Initialize shared providers
    const cacheProvider = new CacheProvider();
    const fileSystemProvider = new FileSystemProvider(cacheProvider);

    // Initialize view providers
    const directoryListProvider = new DirectoryListProvider(
      context.extensionUri,
      fileSystemProvider,
      cacheProvider
    );
    const selectedFilesProvider = new SelectedFilesProvider(
      context.extensionUri,
      fileSystemProvider,
      cacheProvider
    );

    // Register WebView providers
    const directoryViewRegistration = vscode.window.registerWebviewViewProvider(
      "code-prompt-directory",
      directoryListProvider,
      {
        webviewOptions: { retainContextWhenHidden: true },
      }
    );

    const selectedFilesViewRegistration =
      vscode.window.registerWebviewViewProvider(
        "code-prompt-selected-files",
        selectedFilesProvider,
        {
          webviewOptions: { retainContextWhenHidden: true },
        }
      );

    // Create file system watcher that updates views
    const watcher = createFileWatcher(
      WATCHER_PATTERN,
      () => {
        directoryListProvider.debounceViewUpdate();
      },
      context
    );

    // Register separator update command
    const updateSeparatorCommand = vscode.commands.registerCommand(
      "code-prompt.updateSeparator",
      (separator: string) => {
        directoryListProvider.updateSeparator(separator);
      }
    );

    // Add to subscriptions
    context.subscriptions.push(
      directoryViewRegistration,
      selectedFilesViewRegistration,
      watcher,
      updateSeparatorCommand
    );
  } catch (error) {
    showError("Failed to activate extension", error as Error);
  }
}

/**
 * Deactivate the extension
 */
export function deactivate() {
  // Cleanup will be handled by the disposables
}
