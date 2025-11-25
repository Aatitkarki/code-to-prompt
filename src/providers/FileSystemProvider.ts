import {
  FileSystemProviderInterface,
  FileContent,
  CacheProviderInterface,
} from "../models/types";

/**
 * Manages file selection state and content retrieval
 */
export class FileSystemProvider implements FileSystemProviderInterface {
  private checkedItems: Set<string> = new Set();
  private cache: CacheProviderInterface;
  private pendingUpdates: Set<string> = new Set();
  private batchUpdatesInProgress: boolean = false;

  constructor(cache: CacheProviderInterface) {
    this.cache = cache;
  }

  /**
   * Toggle the checked state of a single file
   * @param path File path to toggle
   */
  toggleChecked(path: string): void {
    if (this.checkedItems.has(path)) {
      this.checkedItems.delete(path);
    } else {
      this.checkedItems.add(path);
    }
    this.cache.notifyUpdate();
  }

  /**
   * Toggle the checked state of multiple files in a batch operation
   * @param paths Array of file paths to toggle
   */
  batchToggleChecked(paths: string[]): void {
    if (this.batchUpdatesInProgress) {
      paths.forEach((path) => this.pendingUpdates.add(path));
      return;
    }

    this.batchUpdatesInProgress = true;
    paths.forEach((path) => {
      if (this.checkedItems.has(path)) {
        this.checkedItems.delete(path);
      } else {
        this.checkedItems.add(path);
      }
    });

    if (this.pendingUpdates.size > 0) {
      this.pendingUpdates.clear();
    }

    this.batchUpdatesInProgress = false;
    this.cache.notifyUpdate();
  }

  /**
   * Check if a file is currently selected
   * @param path File path to check
   * @returns Whether the file is checked
   */
  isChecked(path: string): boolean {
    return this.checkedItems.has(path);
  }

  /**
   * Get the content of all checked files
   * @param cache Cache provider for file content
   * @returns Array of file contents with paths and token counts
   */
  async getCheckedFilesContent(
    cache: CacheProviderInterface
  ): Promise<FileContent[]> {
    const contents: FileContent[] = [];
    for (const path of this.checkedItems) {
      try {
        const content = await cache.getFileContent(path);
        contents.push({ path, ...content });
      } catch (error) {
        console.error(`Error getting content for ${path}:`, error);
      }
    }
    return contents;
  }

  /**
   * Get all currently checked paths
   * @returns Array of checked file paths
   */
  getCheckedPaths(): string[] {
    return Array.from(this.checkedItems);
  }

  /**
   * Clear all checked items
   */
  clearChecked(): void {
    this.checkedItems.clear();
    this.pendingUpdates.clear();
    this.batchUpdatesInProgress = false;
    this.cache.notifyUpdate();
  }

  /**
   * Remove a single checked item
   * @param path File path to remove
   */
  removeChecked(path: string): void {
    this.checkedItems.delete(path);
    this.cache.notifyUpdate();
  }

  /**
   * Get the number of checked items
   * @returns Number of checked items
   */
  getCheckedCount(): number {
    return this.checkedItems.size;
  }
}
