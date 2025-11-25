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
exports.WebViewProvider = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const constants_1 = require("../config/constants");
const FileSystemProvider_1 = require("./FileSystemProvider");
const CacheProvider_1 = require("./CacheProvider");
const template_1 = require("../views/template");
const helpers_1 = require("../utils/helpers");
/**
 * Provides the WebView implementation for the file explorer
 */
class WebViewProvider {
    _extensionUri;
    _view;
    _fileSystemProvider;
    _cache;
    _debounceTimer;
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
        try {
            console.log("Initializing WebViewProvider");
            this._fileSystemProvider = new FileSystemProvider_1.FileSystemProvider();
            this._cache = new CacheProvider_1.CacheProvider();
        }
        catch (error) {
            console.error("Error initializing WebViewProvider:", error);
            throw error;
        }
    }
    /**
     * Resolve the WebView content
     */
    async resolveWebviewView(webviewView, context, _token) {
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
        }
        catch (error) {
            console.error("Error in resolveWebviewView:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            webviewView.webview.html = (0, template_1.generateErrorContent)(`Failed to load files: ${errorMessage}`);
            (0, helpers_1.showError)("Failed to load files", error);
        }
    }
    /**
     * Handle messages from the WebView
     */
    async _handleMessage(message) {
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
        }
        catch (error) {
            console.error("Error handling message:", error);
            if (this._view) {
                const errorMessage = error instanceof Error ? error.message : "Unknown error";
                this._view.webview.html = (0, template_1.generateErrorContent)(`Error processing request: ${errorMessage}`);
                (0, helpers_1.showError)("Error processing request", error);
            }
        }
    }
    /**
     * Refresh the WebView content
     */
    async _refreshView() {
        if (!this._view) {
            console.log("No view to refresh");
            return;
        }
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            console.log("No workspace folders found");
            this._view.webview.html = (0, template_1.generateErrorContent)("No folder is open");
            return;
        }
        try {
            console.log("Refreshing view");
            const rootPath = workspaceFolders[0].uri.fsPath;
            const files = await this._scanDirectory(rootPath);
            const checkedContents = await this._fileSystemProvider.getCheckedFilesContent(this._cache);
            this._view.webview.html = (0, template_1.generateWebViewContent)(files, checkedContents, rootPath);
            console.log("View refreshed successfully");
        }
        catch (error) {
            console.error("Error refreshing view:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            this._view.webview.html = (0, template_1.generateErrorContent)(`Failed to refresh files: ${errorMessage}`);
            (0, helpers_1.showError)("Failed to refresh files", error);
        }
    }
    /**
     * Scan a directory recursively to build the file tree
     */
    async _scanDirectory(dirPath, parentIsChecked = false) {
        try {
            console.log("Scanning directory:", dirPath);
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dirPath));
            const items = [];
            for (const [name, type] of entries) {
                // Skip hidden files and excluded directories
                if (name.startsWith(".") || (0, helpers_1.shouldExcludeDirectory)(name)) {
                    continue;
                }
                const fullPath = path.join(dirPath, name);
                const isDirectory = (type & vscode.FileType.Directory) !== 0;
                // Skip non-programming files
                if (!isDirectory && !(0, helpers_1.isValidProgrammingFile)(name)) {
                    continue;
                }
                // Create file item
                const item = {
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
                }
                else {
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
        }
        catch (error) {
            console.error(`Error scanning directory ${dirPath}:`, error);
            throw error;
        }
    }
    /**
     * Debounce the view refresh
     */
    debounceRefresh(delay = constants_1.DEBOUNCE_DELAY) {
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
        }
        this._debounceTimer = setTimeout(() => this._refreshView(), delay);
    }
    /**
     * Clear the cache and refresh the view
     */
    refresh() {
        console.log("Manual refresh requested");
        this._cache.clear();
        this._refreshView();
    }
}
exports.WebViewProvider = WebViewProvider;
//# sourceMappingURL=WebViewProvider.js.map