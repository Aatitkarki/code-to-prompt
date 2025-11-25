"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectedFilesProvider = void 0;
const vscode = __importStar(require("vscode"));
const template_1 = require("../views/template");
const helpers_1 = require("../utils/helpers");
const constants_1 = require("../config/constants");
class SelectedFilesProvider {
    _extensionUri;
    _view;
    _fileSystemProvider;
    _cache;
    _disposables = [];
    _separator = constants_1.DEFAULT_SEPARATOR;
    constructor(_extensionUri, fileSystemProvider, cache) {
        this._extensionUri = _extensionUri;
        this._fileSystemProvider = fileSystemProvider;
        this._cache = cache;
        this._disposables.push(this._cache.onDidUpdateCache(() => {
            this._updateView();
        }));
    }
    async resolveWebviewView(webviewView, context, _token) {
        try {
            this._view = webviewView;
            webviewView.webview.options = {
                enableScripts: true,
                localResourceRoots: [this._extensionUri],
            };
            webviewView.webview.onDidReceiveMessage(this._handleMessage.bind(this));
            await this._updateView();
        }
        catch (error) {
            console.error("Error in resolveWebviewView:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            webviewView.webview.html = (0, template_1.generateErrorContent)(`Failed to load selected files: ${errorMessage}`);
            (0, helpers_1.showError)("Failed to load selected files", error);
        }
    }
    async _handleMessage(message) {
        if (message.command === "updateSeparator" && message.separator) {
            this._separator = message.separator;
            vscode.commands.executeCommand("code-prompt.updateSeparator", message.separator);
            await this._updateView();
        }
    }
    async _updateView() {
        if (!this._view)
            return;
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            this._view.webview.html = (0, template_1.generateErrorContent)("No folder is open");
            return;
        }
        try {
            const rootPath = workspaceFolders[0].uri.fsPath;
            const checkedContents = await this._fileSystemProvider.getCheckedFilesContent(this._cache);
            this._view.webview.html = (0, template_1.generateSelectedFilesViewContent)(checkedContents, rootPath, this._separator);
        }
        catch (error) {
            console.error("Error updating selected files view:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            this._view.webview.html = (0, template_1.generateErrorContent)(`Failed to update selected files: ${errorMessage}`);
            (0, helpers_1.showError)("Failed to update selected files", error);
        }
    }
    dispose() {
        this._disposables.forEach((d) => d.dispose());
    }
}
exports.SelectedFilesProvider = SelectedFilesProvider;
//# sourceMappingURL=SelectedFilesProvider.js.map