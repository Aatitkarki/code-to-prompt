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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const constants_1 = require("./config/constants");
const DirectoryListProvider_1 = require("./providers/DirectoryListProvider");
const SelectedFilesProvider_1 = require("./providers/SelectedFilesProvider");
const FileSystemProvider_1 = require("./providers/FileSystemProvider");
const CacheProvider_1 = require("./providers/CacheProvider");
const helpers_1 = require("./utils/helpers");
/**
 * Activate the extension
 */
function activate(context) {
    try {
        // Initialize shared providers
        const cacheProvider = new CacheProvider_1.CacheProvider();
        const fileSystemProvider = new FileSystemProvider_1.FileSystemProvider(cacheProvider);
        // Initialize view providers
        const directoryListProvider = new DirectoryListProvider_1.DirectoryListProvider(context.extensionUri, fileSystemProvider, cacheProvider);
        const selectedFilesProvider = new SelectedFilesProvider_1.SelectedFilesProvider(context.extensionUri, fileSystemProvider, cacheProvider);
        // Register WebView providers
        const directoryViewRegistration = vscode.window.registerWebviewViewProvider("code-prompt-directory", directoryListProvider, {
            webviewOptions: { retainContextWhenHidden: true },
        });
        const selectedFilesViewRegistration = vscode.window.registerWebviewViewProvider("code-prompt-selected-files", selectedFilesProvider, {
            webviewOptions: { retainContextWhenHidden: true },
        });
        // Create file system watcher that updates views
        const watcher = (0, helpers_1.createFileWatcher)(constants_1.WATCHER_PATTERN, () => {
            directoryListProvider.debounceViewUpdate();
        }, context);
        // Register separator update command
        const updateSeparatorCommand = vscode.commands.registerCommand("code-prompt.updateSeparator", (separator) => {
            directoryListProvider.updateSeparator(separator);
        });
        // Add to subscriptions
        context.subscriptions.push(directoryViewRegistration, selectedFilesViewRegistration, watcher, updateSeparatorCommand);
    }
    catch (error) {
        (0, helpers_1.showError)("Failed to activate extension", error);
    }
}
/**
 * Deactivate the extension
 */
function deactivate() {
    // Cleanup will be handled by the disposables
}
//# sourceMappingURL=extension.js.map