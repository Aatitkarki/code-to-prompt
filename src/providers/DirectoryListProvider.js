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
exports.DirectoryListProvider = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const constants_1 = require("../config/constants");
const template_1 = require("../views/template");
const helpers_1 = require("../utils/helpers");
class DirectoryListProvider {
    _extensionUri;
    _view;
    _fileSystemProvider;
    _cache;
    _debounceTimer;
    #separator = constants_1.DEFAULT_SEPARATOR; // Making it readonly since it's only modified through updateSeparator
    constructor(_extensionUri, fileSystemProvider, cache) {
        this._extensionUri = _extensionUri;
        this._fileSystemProvider = fileSystemProvider;
        this._cache = cache;
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
            webviewView.webview.html = (0, template_1.generateErrorContent)(`Failed to load files: ${errorMessage}`);
            (0, helpers_1.showError)("Failed to load files", error);
        }
    }
    refresh() {
        this._cache.clear();
        this._updateView();
    }
    debounceViewUpdate(delay = constants_1.DEBOUNCE_DELAY) {
        if (this._debounceTimer)
            clearTimeout(this._debounceTimer);
        this._debounceTimer = setTimeout(() => this._updateView(), delay);
    }
    updateSeparator(separator) {
        this.#separator = separator;
        this._updateView();
    }
    async _handleMessage(message) {
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
        }
        catch (error) {
            console.error("Error handling message:", error);
            (0, helpers_1.showError)("Error processing request", error);
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
            const files = await this._scanDirectory(rootPath);
            this._view.webview.html = (0, template_1.generateDirectoryViewContent)(files, rootPath, this.#separator);
        }
        catch (error) {
            console.error("Error updating view:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            this._view.webview.html = (0, template_1.generateErrorContent)(`Failed to update files: ${errorMessage}`);
            (0, helpers_1.showError)("Failed to update files", error);
        }
    }
    async _scanDirectory(dirPath, parentIsChecked = false) {
        try {
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dirPath));
            const items = [];
            for (const [name, type] of entries) {
                if (name.startsWith(".") || (0, helpers_1.shouldExcludeDirectory)(name))
                    continue;
                const fullPath = path.join(dirPath, name);
                const isDirectory = (type & vscode.FileType.Directory) !== 0;
                if (!isDirectory && !(0, helpers_1.isValidProgrammingFile)(name))
                    continue;
                const item = {
                    name,
                    path: fullPath,
                    isDirectory,
                    isChecked: this._fileSystemProvider.isChecked(fullPath),
                };
                if (isDirectory) {
                    item.children = await this._scanDirectory(fullPath, item.isChecked);
                    if (item.children.length === 0)
                        continue;
                }
                else {
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
        }
        catch (error) {
            console.error(`Error scanning directory ${dirPath}:`, error);
            throw error;
        }
    }
}
exports.DirectoryListProvider = DirectoryListProvider;
//# sourceMappingURL=DirectoryListProvider.js.map