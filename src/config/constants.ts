/**
 * Configuration constants for the Code To Prompt extension
 */

/** File extensions that are considered as programming files */
export const PROGRAMMING_EXTENSIONS = new Set([
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
export const EXCLUDED_FOLDERS = new Set([
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
export const DEFAULT_SEPARATOR = "=====";

/** Default debounce delay for file system events (in ms) */
export const DEBOUNCE_DELAY = 300;

/** LLM model name for token counting */
export const DEFAULT_MODEL = "gpt-4";

/** WebView identifier */
export const WEBVIEW_ID = "fileExplorerView";

/** File system watcher pattern */
export const WATCHER_PATTERN = "**/*";

/** File system watcher configuration */
export const WATCHER_CONFIG = {
  ignoreCreateEvents: false,
  ignoreChangeEvents: true,
  ignoreDeleteEvents: true,
};

/** WebView options */
export const WEBVIEW_OPTIONS = {
  retainContextWhenHidden: true,
};
