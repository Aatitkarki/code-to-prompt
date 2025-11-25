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
exports.isValidProgrammingFile = isValidProgrammingFile;
exports.shouldExcludeDirectory = shouldExcludeDirectory;
exports.getRelativePath = getRelativePath;
exports.showError = showError;
exports.createStatusBarItem = createStatusBarItem;
exports.registerCommandSafely = registerCommandSafely;
exports.createFileWatcher = createFileWatcher;
exports.getWorkspaceFolder = getWorkspaceFolder;
const vscode = __importStar(require("vscode"));
const constants_1 = require("../config/constants");
/**
 * Check if a file should be included based on its extension
 */
function isValidProgrammingFile(fileName) {
    const ext = fileName.toLowerCase().split(".").pop();
    return ext ? constants_1.PROGRAMMING_EXTENSIONS.has(`.${ext}`) : false;
}
/**
 * Check if a directory should be excluded
 */
function shouldExcludeDirectory(dirName) {
    return constants_1.EXCLUDED_FOLDERS.has(dirName.toLowerCase());
}
/**
 * Get relative path from workspace root
 */
function getRelativePath(fullPath, workspacePath) {
    return fullPath.replace(workspacePath + "/", "");
}
/**
 * Show error message to user
 */
function showError(message, error) {
    const errorMessage = error ? `${message}: ${error.message}` : message;
    vscode.window.showErrorMessage(errorMessage);
    console.error(errorMessage, error);
}
/**
 * Create a disposable status bar item
 */
function createStatusBarItem(text, tooltip, command) {
    const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    item.text = text;
    if (tooltip) {
        item.tooltip = tooltip;
    }
    if (command) {
        item.command = command;
    }
    return item;
}
/**
 * Register a command with error handling
 */
function registerCommandSafely(context, command, callback) {
    const disposable = vscode.commands.registerCommand(command, async (...args) => {
        try {
            await callback(...args);
        }
        catch (error) {
            showError(`Error executing command ${command}`, error);
        }
    });
    context.subscriptions.push(disposable);
}
/**
 * Create and register a file system watcher
 */
function createFileWatcher(pattern, onChange, context) {
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    watcher.onDidChange(onChange);
    watcher.onDidCreate(onChange);
    watcher.onDidDelete(onChange);
    context.subscriptions.push(watcher);
    return watcher;
}
/**
 * Ensure workspace folder exists
 */
function getWorkspaceFolder() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        throw new Error("No workspace folder is open");
    }
    return workspaceFolders[0].uri.fsPath;
}
//# sourceMappingURL=helpers.js.map