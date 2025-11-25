import * as vscode from "vscode";
import * as path from "path";
import { DEBOUNCE_DELAY, WEBVIEW_OPTIONS } from "../config/constants";
import { FileSystemProvider } from "./FileSystemProvider";
import { CacheProvider } from "./CacheProvider";
import {
  WebViewProviderInterface,
  FileItem,
  WebViewMessage,
} from "../models/types";
import {
  generateWebViewContent,
  generateErrorContent,
} from "../views/template";
import {
  showError,
  isValidProgrammingFile,
  shouldExcludeDirectory,
} from "../utils/helpers";

/**
 * Provides the WebView implementation for the file explorer
 */
export class WebViewProvider implements WebViewProviderInterface {
  private _view?: vscode.WebviewView;
  private _fileSystemProvider: FileSystemProvider;
  private _cache: CacheProvider;
  private _debounceTimer?: NodeJS.Timeout;

  constructor(private readonly _extensionUri: vscode.Uri) {
    try {
      console.log("Initializing WebViewProvider");
      this._fileSystemProvider = new FileSystemProvider();
      this._cache = new CacheProvider();
    } catch (error) {
      console.error("Error initializing WebViewProvider:", error);
      throw error;
    }
  }

  /**
   * Resolve the WebView content
   */
  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): Promise<void> {
    try {
      console.log("Resolving WebView");
      this._view = webviewView;

      webviewView.webview.options = {
        enableScripts: true,
        localResourceRoots: [this._extensionUri],
      };

      // Set up message listener
      webviewView.webview.onDidReceiveMessage(this._handleMessage.bind(this));

      await this._refreshView();
      console.log("WebView resolved successfully");
    } catch (error) {
      console.error("Error in resolveWebviewView:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      webviewView.webview.html = generateErrorContent(
        `Failed to load files: ${errorMessage}`
      );
      showError("Failed to load files", error as Error);
    }
  }

  /**
   * Handle messages from the WebView
   */
  private async _handleMessage(message: WebViewMessage) {
    try {
      console.log("Handling WebView message:", message.command);
      switch (message.command) {
        case "toggleItem":
          this._fileSystemProvider.toggleChecked(message.path);
          await this._refreshView();
          break;

        case "toggleItems":
          this._fileSystemProvider.batchToggleChecked(message.paths);
          await this._refreshView();
          break;

        case "updateCounts":
          // Could be used for status bar updates or other UI elements
          console.log("File counts updated:", message);
          break;

        default:
          console.warn("Unknown message command:", message);
      }
    } catch (error) {
      console.error("Error handling message:", error);
      if (this._view) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        this._view.webview.html = generateErrorContent(
          `Error processing request: ${errorMessage}`
        );
        showError("Error processing request", error as Error);
      }
    }
  }

  /**
   * Refresh the WebView content
   */
  private async _refreshView() {
    if (!this._view) {
      console.log("No view to refresh");
      return;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      console.log("No workspace folders found");
      this._view.webview.html = generateErrorContent("No folder is open");
      return;
    }

    try {
      console.log("Refreshing view");
      const rootPath = workspaceFolders[0].uri.fsPath;
      const files = await this._scanDirectory(rootPath);
      const checkedContents =
        await this._fileSystemProvider.getCheckedFilesContent(this._cache);

      this._view.webview.html = generateWebViewContent(
        files,
        checkedContents,
        rootPath
      );
      console.log("View refreshed successfully");
    } catch (error) {
      console.error("Error refreshing view:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this._view.webview.html = generateErrorContent(
        `Failed to refresh files: ${errorMessage}`
      );
      showError("Failed to refresh files", error as Error);
    }
  }

  /**
   * Scan a directory recursively to build the file tree
   */
  private async _scanDirectory(
    dirPath: string,
    parentIsChecked: boolean = false
  ): Promise<FileItem[]> {
    try {
      console.log("Scanning directory:", dirPath);
      const entries = await vscode.workspace.fs.readDirectory(
        vscode.Uri.file(dirPath)
      );
      const items: FileItem[] = [];

      for (const [name, type] of entries) {
        // Skip hidden files and excluded directories
        if (name.startsWith(".") || shouldExcludeDirectory(name)) {
          continue;
        }

        const fullPath = path.join(dirPath, name);
        const isDirectory = (type & vscode.FileType.Directory) !== 0;

        // Skip non-programming files
        if (!isDirectory && !isValidProgrammingFile(name)) {
          continue;
        }

        // Create file item
        const item: FileItem = {
          name,
          path: fullPath,
          isDirectory,
          isChecked: this._fileSystemProvider.isChecked(fullPath),
        };

        // Process directories recursively
        if (isDirectory) {
          item.children = await this._scanDirectory(fullPath, item.isChecked);
          // Only include directories that have valid children
          if (item.children.length === 0) {
            continue;
          }
        } else {
          // Get token count for files
          const { tokens } = await this._cache.getFileContent(fullPath);
          item.tokens = tokens;
        }

        items.push(item);
      }

      // Sort directories first, then alphabetically
      return items.sort((a, b) => {
        if (a.isDirectory === b.isDirectory) {
          return a.name.localeCompare(b.name);
        }
        return a.isDirectory ? -1 : 1;
      });
    } catch (error) {
      console.error(`Error scanning directory ${dirPath}:`, error);
      throw error;
    }
  }

  /**
   * Debounce the view refresh
   */
  public debounceRefresh(delay = DEBOUNCE_DELAY) {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }
    this._debounceTimer = setTimeout(() => this._refreshView(), delay);
  }

  /**
   * Clear the cache and refresh the view
   */
  public refresh(): void {
    console.log("Manual refresh requested");
    this._cache.clear();
    this._refreshView();
  }
}
