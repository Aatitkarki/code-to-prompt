import * as vscode from "vscode";
import { WEBVIEW_ID, WATCHER_PATTERN } from "./config/constants";
import { WebViewProvider } from "./providers/WebViewProvider";
import {
  createFileWatcher,
  registerCommandSafely,
  showError,
} from "./utils/helpers";

/**
 * Activate the extension
 */
export function activate(context: vscode.ExtensionContext) {
  try {
    // Initialize providers
    const provider = new WebViewProvider(context.extensionUri);

    // Register WebView provider
    const registration = vscode.window.registerWebviewViewProvider(
      WEBVIEW_ID,
      provider,
      {
        webviewOptions: { retainContextWhenHidden: true },
      }
    );

    // Create file system watcher
    const watcher = createFileWatcher(
      WATCHER_PATTERN,
      () => provider.debounceRefresh(),
      context
    );

    // Register commands
    registerCommandSafely(context, "code-prompt.refresh", () => {
      provider.refresh();
    });

    // Add to subscriptions
    context.subscriptions.push(registration, watcher);
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
