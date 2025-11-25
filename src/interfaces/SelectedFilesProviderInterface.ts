import * as vscode from "vscode";

export interface SelectedFilesProviderInterface extends vscode.Disposable {
  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ): Promise<void>;
}
