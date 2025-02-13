import {
  FileSystemProviderInterface,
  FileContent,
  CacheProviderInterface,
} from "../models/types";

/**
 * Manages file selection state and content retrieval
 */
export class FileSystemProvider implements FileSystemProviderInterface {
  private checkedItems = new Set<string>();
  private batchUpdatesInProgress = false;
  private pendingUpdates = new Set<string>();

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

    try {
      paths.forEach((path) => {
        if (this.checkedItems.has(path)) {
          this.checkedItems.delete(path);
        } else {
          this.checkedItems.add(path);
        }
      });
    } finally {
      // Process any updates that came in during the batch operation
      if (this.pendingUpdates.size > 0) {
        const pendingPaths = Array.from(this.pendingUpdates);
        this.pendingUpdates.clear();
        this.batchToggleChecked(pendingPaths);
      }

      this.batchUpdatesInProgress = false;
    }
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
    const contentPromises = Array.from(this.checkedItems).map(async (path) => {
      try {
        const stats = await cache.getStats(path);
        if (stats && !stats.isDirectory) {
          const { content, tokens } = await cache.getFileContent(path);
          return { path, content, tokens };
        }
      } catch (error) {
        console.error(`Error processing file ${path}:`, error);
      }
      return null;
    });

    const contents = await Promise.all(contentPromises);
    return contents.filter((item): item is FileContent => item !== null);
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
  }

  /**
   * Get the number of checked items
   * @returns Number of checked items
   */
  getCheckedCount(): number {
    return this.checkedItems.size;
  }
}
