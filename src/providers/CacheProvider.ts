import * as fs from "fs/promises";
import { encoding_for_model } from "tiktoken";
import { DEFAULT_MODEL } from "../config/constants";
import * as vscode from "vscode";
import {
  CacheProviderInterface,
  CachedContent,
  CachedStats,
} from "../models/types";

/**
 * Provides caching functionality for file stats and content
 * to avoid redundant file system operations and token calculations
 */
export class CacheProvider implements CacheProviderInterface {
  private statsCache = new Map<string, CachedStats>();
  private contentCache = new Map<string, CachedContent>();
  private encoder: ReturnType<typeof encoding_for_model>;
  private _onDidUpdateCache = new vscode.EventEmitter<void>();
  readonly onDidUpdateCache = this._onDidUpdateCache.event;

  constructor() {
    try {
      this.encoder = encoding_for_model(DEFAULT_MODEL);
      console.log("Initialized tiktoken encoder for", DEFAULT_MODEL);
    } catch (error) {
      console.error("Failed to initialize tiktoken encoder:", error);
      throw error;
    }
  }

  /**
   * Get cached stats for a file, or read from disk if not cached
   * @param path File path
   * @returns File stats or null if file doesn't exist
   */
  async getStats(path: string): Promise<CachedStats | null> {
    try {
      const cached = this.statsCache.get(path);
      const stat = await fs.stat(path);
      const current: CachedStats = {
        isDirectory: stat.isDirectory(),
        mtime: stat.mtime,
      };

      if (!cached || cached.mtime < current.mtime) {
        this.statsCache.set(path, current);
        this.notifyUpdate();
        return current;
      }

      return cached;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error(`Error getting stats for ${path}:`, error);
      }
      return null;
    }
  }

  /**
   * Get cached file content and token count, or read from disk if not cached
   * @param path File path
   * @returns File content, token count, and modification time
   */
  async getFileContent(path: string): Promise<CachedContent> {
    try {
      const cached = this.contentCache.get(path);
      const stat = await fs.stat(path);

      // Return cached content if file hasn't been modified
      if (cached && cached.mtime >= stat.mtime) {
        return cached;
      }

      // Read file and calculate tokens
      const content = await fs.readFile(path, "utf8");

      // Use Buffer.from() instead of deprecated Buffer constructor
      const contentBuffer = Buffer.from(content, "utf8");
      const tokens = this.encoder.encode(contentBuffer.toString()).length;

      const result: CachedContent = {
        content,
        tokens,
        mtime: stat.mtime,
      };

      this.contentCache.set(path, result);
      this.notifyUpdate();
      console.log(`Cached file ${path} with ${tokens} tokens`);
      return result;
    } catch (error) {
      console.error(`Error reading file ${path}:`, error);
      return {
        content: `Error reading file content: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        tokens: 0,
        mtime: new Date(),
      };
    }
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.statsCache.clear();
    this.contentCache.clear();
    this.notifyUpdate();
    console.log("Cleared cache");
  }

  /**
   * Get the current size of the cache
   * @returns Object containing cache size information
   */
  getCacheSize(): { stats: number; content: number } {
    return {
      stats: this.statsCache.size,
      content: this.contentCache.size,
    };
  }

  /**
   * Remove specific entries from the cache
   * @param paths Array of file paths to remove from cache
   */
  invalidateEntries(paths: string[]): void {
    for (const path of paths) {
      this.statsCache.delete(path);
      this.contentCache.delete(path);
    }
    this.notifyUpdate();
    console.log(`Invalidated ${paths.length} cache entries`);
  }

  public notifyUpdate(): void {
    this._onDidUpdateCache.fire();
  }

  dispose() {
    this._onDidUpdateCache.dispose();
  }
}
