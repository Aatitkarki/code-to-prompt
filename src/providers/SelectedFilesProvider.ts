import * as vscode from "vscode";
import { FileSystemProvider } from "./FileSystemProvider";
import { CacheProvider } from "./CacheProvider";
import { FileContent } from "../models/types";
import {
  generateSelectedFilesViewContent,
  generateErrorContent,
} from "../views/template";
import { showError } from "../utils/helpers";
import { DEFAULT_SEPARATOR } from "../config/constants";
import { SelectedFilesProviderInterface } from "../interfaces/SelectedFilesProviderInterface";

export class SelectedFilesProvider implements SelectedFilesProviderInterface {
  private _view?: vscode.WebviewView;
  private _fileSystemProvider: FileSystemProvider;
  private _cache: CacheProvider;
  private _disposables: vscode.Disposable[] = [];
  private _separator: string = DEFAULT_SEPARATOR;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    fileSystemProvider: FileSystemProvider,
    cache: CacheProvider
  ) {
    this._fileSystemProvider = fileSystemProvider;
    this._cache = cache;
    this._disposables.push(
      this._cache.onDidUpdateCache(() => {
        this._updateView();
      })
    );
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
        `Failed to load selected files: ${errorMessage}`
      );
      showError("Failed to load selected files", error as Error);
    }
  }

  private async _handleMessage(message: {
    command: string;
    separator?: string;
  }) {
    if (message.command === "updateSeparator" && message.separator) {
      this._separator = message.separator;
      vscode.commands.executeCommand(
        "code-prompt.updateSeparator",
        message.separator
      );
      await this._updateView();
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
      const checkedContents =
        await this._fileSystemProvider.getCheckedFilesContent(this._cache);
      this._view.webview.html = generateSelectedFilesViewContent(
        checkedContents,
        rootPath,
        this._separator
      );
    } catch (error) {
      console.error("Error updating selected files view:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this._view.webview.html = generateErrorContent(
        `Failed to update selected files: ${errorMessage}`
      );
      showError("Failed to update selected files", error as Error);
    }
  }

  public dispose() {
    this._disposables.forEach((d) => d.dispose());
  }
}
