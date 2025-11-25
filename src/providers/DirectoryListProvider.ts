import * as vscode from "vscode";
import * as path from "path";
import { DEBOUNCE_DELAY, DEFAULT_SEPARATOR } from "../config/constants";
import { FileSystemProvider } from "./FileSystemProvider";
import { CacheProvider } from "./CacheProvider";
import { FileItem, DirectoryProviderInterface } from "../models/types";
import {
  generateDirectoryViewContent,
  generateErrorContent,
} from "../views/template";
import {
  showError,
  isValidProgrammingFile,
  shouldExcludeDirectory,
} from "../utils/helpers";

export class DirectoryListProvider implements DirectoryProviderInterface {
  private _view?: vscode.WebviewView;
  private _fileSystemProvider: FileSystemProvider;
  private _cache: CacheProvider;
  private _debounceTimer?: NodeJS.Timeout;
  readonly #separator: string = DEFAULT_SEPARATOR; // Making it readonly since it's only modified through updateSeparator

  constructor(
    private readonly _extensionUri: vscode.Uri,
    fileSystemProvider: FileSystemProvider,
    cache: CacheProvider
  ) {
    this._fileSystemProvider = fileSystemProvider;
    this._cache = cache;
  }

  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): Promise<void> {
    try {
      this._view = webviewView;
      webviewView.webview.options = {
        enableScripts: true,
        localResourceRoots: [this._extensionUri],
      };
      webviewView.webview.onDidReceiveMessage(this._handleMessage.bind(this));
      await this._updateView();
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

  public refresh(): void {
    this._cache.clear();
    this._updateView();
  }

  public debounceViewUpdate(delay = DEBOUNCE_DELAY) {
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => this._updateView(), delay);
  }

  public updateSeparator(separator: string): void {
    this.#separator = separator;
    this._updateView();
  }

  private async _handleMessage(message: {
    command: string;
    path?: string;
    paths?: string[];
  }) {
    try {
      switch (message.command) {
        case "toggleItem":
          if (message.path) {
            this._fileSystemProvider.toggleChecked(message.path);
            await this._updateView();
          }
          break;
        case "toggleItems":
          if (message.paths) {
            this._fileSystemProvider.batchToggleChecked(message.paths);
            await this._updateView();
          }
          break;
      }
    } catch (error) {
      console.error("Error handling message:", error);
      showError("Error processing request", error as Error);
    }
  }

  private async _updateView() {
    if (!this._view) return;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      this._view.webview.html = generateErrorContent("No folder is open");
      return;
    }

    try {
      const rootPath = workspaceFolders[0].uri.fsPath;
      const files = await this._scanDirectory(rootPath);
      this._view.webview.html = generateDirectoryViewContent(
        files,
        rootPath,
        this.#separator
      );
    } catch (error) {
      console.error("Error updating view:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this._view.webview.html = generateErrorContent(
        `Failed to update files: ${errorMessage}`
      );
      showError("Failed to update files", error as Error);
    }
  }

  private async _scanDirectory(
    dirPath: string,
    parentIsChecked: boolean = false
  ): Promise<FileItem[]> {
    try {
      const entries = await vscode.workspace.fs.readDirectory(
        vscode.Uri.file(dirPath)
      );
      const items: FileItem[] = [];

      for (const [name, type] of entries) {
        if (name.startsWith(".") || shouldExcludeDirectory(name)) continue;

        const fullPath = path.join(dirPath, name);
        const isDirectory = (type & vscode.FileType.Directory) !== 0;

        if (!isDirectory && !isValidProgrammingFile(name)) continue;

        const item: FileItem = {
          name,
          path: fullPath,
          isDirectory,
          isChecked: this._fileSystemProvider.isChecked(fullPath),
        };

        if (isDirectory) {
          item.children = await this._scanDirectory(fullPath, item.isChecked);
          if (item.children.length === 0) continue;
        } else {
          const { tokens } = await this._cache.getFileContent(fullPath);
          item.tokens = tokens;
        }

        items.push(item);
      }

      return items.sort((a, b) => {
        if (a.isDirectory === b.isDirectory)
          return a.name.localeCompare(b.name);
        return a.isDirectory ? -1 : 1;
      });
    } catch (error) {
      console.error(`Error scanning directory ${dirPath}:`, error);
      throw error;
    }
  }
}
