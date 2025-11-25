"use strict";
/**
 * Configuration constants for the Code To Prompt extension
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WEBVIEW_OPTIONS = exports.WATCHER_CONFIG = exports.WATCHER_PATTERN = exports.VIEW_IDS = exports.DEFAULT_MODEL = exports.DEBOUNCE_DELAY = exports.DEFAULT_SEPARATOR = exports.EXCLUDED_FOLDERS = exports.PROGRAMMING_EXTENSIONS = void 0;
/** File extensions that are considered as programming files */
exports.PROGRAMMING_EXTENSIONS = new Set([
    ".js",
    ".ts",
    ".jsx",
    ".tsx",
    ".html",
    ".css",
    ".scss",
    ".sass",
    ".less",
    ".py",
    ".java",
    ".rb",
    ".php",
    ".go",
    ".rs",
    ".cs",
    ".cpp",
    ".c",
    ".h",
    ".swift",
    ".kt",
    ".dart",
    ".m",
    ".mm",
    ".json",
    ".yaml",
    ".yml",
    ".xml",
    ".toml",
    ".ini",
    ".env",
    ".sh",
    ".bash",
    ".zsh",
    ".ps1",
    ".bat",
    ".cmd",
    ".sql",
    ".graphql",
    ".proto",
    ".vue",
    ".svelte",
    ".elm",
]);
/** Folders to exclude from file scanning */
exports.EXCLUDED_FOLDERS = new Set([
    "node_modules",
    "dist",
    "out",
    "assets",
    "images",
    "img",
    "icons",
    "media",
    "public",
]);
/** Default separator for file content in prompts */
exports.DEFAULT_SEPARATOR = "###";
/** Default debounce delay for file system events (in ms) */
exports.DEBOUNCE_DELAY = 300;
/** LLM model name for token counting */
exports.DEFAULT_MODEL = "gpt-4";
/** WebView identifiers */
exports.VIEW_IDS = {
    DIRECTORY: "code-prompt-directory",
    SELECTED_FILES: "code-prompt-selected-files",
    CONTAINER: "code-prompt-explorer",
};
/** File system watcher pattern */
exports.WATCHER_PATTERN = "**/*.{js,jsx,ts,tsx,py,java,cpp,c,h,hpp,cs,go,rs,php,rb,swift,kt,scala,html,css,scss,less,json,yaml,yml,md,txt}";
/** File system watcher configuration */
exports.WATCHER_CONFIG = {
    ignoreCreateEvents: false,
    ignoreChangeEvents: true,
    ignoreDeleteEvents: true,
};
/** WebView options */
exports.WEBVIEW_OPTIONS = {
    retainContextWhenHidden: true,
};
//# sourceMappingURL=constants.js.map