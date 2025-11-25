import * as vscode from "vscode";
import { Event } from "vscode";

/** Represents a file or directory item in the explorer */
export interface FileItem {
  /** Name of the file or directory */
  name: string;
  /** Full path to the file or directory */
  path: string;
  /** Whether this item is a directory */
  isDirectory: boolean;
  /** Whether this item is checked in the UI */
  isChecked: boolean;
  /** Number of tokens in the file (for files only) */
  tokens?: number;
  /** Child items (for directories only) */
  children?: FileItem[];
}

/** Represents cached file stats */
export interface CachedStats {
  isDirectory: boolean;
  mtime: Date;
}

/** Represents cached file content and token count */
export interface CachedContent {
  content: string;
  tokens: number;
  mtime: Date;
}

/** Represents a file's content in LLM-ready format */
export interface FileContent {
  path: string;
  content: string;
  tokens: number;
}

/** WebView state interface */
export interface WebViewState {
  scrollPosition: number;
  separator: string;
  folderStates: Record<string, boolean>;
}

/** Message types that can be sent from the WebView */
export type WebViewMessage =
  | { command: "toggleItem"; path: string }
  | { command: "toggleItems"; paths: string[] }
  | { command: "updateCounts"; total: number; checked: number };

/** Configuration for the file system watcher */
export interface WatcherConfig {
  ignoreCreateEvents: boolean;
  ignoreChangeEvents: boolean;
  ignoreDeleteEvents: boolean;
}

/** Provider interfaces */
export interface FileSystemProviderInterface {
  isChecked(path: string): boolean;
  toggleChecked(path: string): void;
  batchToggleChecked(paths: string[]): void;
  getCheckedFilesContent(cache: CacheProviderInterface): Promise<FileContent[]>;
  clearChecked(): void;
  removeChecked(path: string): void;
}

export interface DirectoryProviderInterface extends vscode.WebviewViewProvider {
  updateSeparator(separator: string): void;
  debounceViewUpdate(delay?: number): void;
  refresh(): void;
}

export interface SelectedFilesProviderInterface
  extends vscode.WebviewViewProvider {
  dispose(): void;
}

export interface CacheProviderInterface {
  getStats(path: string): Promise<CachedStats | null>;
  getFileContent(path: string): Promise<CachedContent>;
  clear(): void;
  getCacheSize(): { stats: number; content: number };
  invalidateEntries(paths: string[]): void;
  notifyUpdate(): void;
  onDidUpdateCache: Event<void>;
  dispose(): void;
}

export interface WebViewProviderInterface extends vscode.WebviewViewProvider {
  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ): Promise<void>;
}
