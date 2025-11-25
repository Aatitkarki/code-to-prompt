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
exports.CacheProvider = void 0;
const fs = __importStar(require("fs/promises"));
const tiktoken_1 = require("tiktoken");
const constants_1 = require("../config/constants");
const vscode = __importStar(require("vscode"));
/**
 * Provides caching functionality for file stats and content
 * to avoid redundant file system operations and token calculations
 */
class CacheProvider {
    statsCache = new Map();
    contentCache = new Map();
    encoder;
    _onDidUpdateCache = new vscode.EventEmitter();
    onDidUpdateCache = this._onDidUpdateCache.event;
    constructor() {
        try {
            this.encoder = (0, tiktoken_1.encoding_for_model)(constants_1.DEFAULT_MODEL);
            console.log("Initialized tiktoken encoder for", constants_1.DEFAULT_MODEL);
        }
        catch (error) {
            console.error("Failed to initialize tiktoken encoder:", error);
            throw error;
        }
    }
    /**
     * Get cached stats for a file, or read from disk if not cached
     * @param path File path
     * @returns File stats or null if file doesn't exist
     */
    async getStats(path) {
        try {
            const cached = this.statsCache.get(path);
            const stat = await fs.stat(path);
            const current = {
                isDirectory: stat.isDirectory(),
                mtime: stat.mtime,
            };
            if (!cached || cached.mtime < current.mtime) {
                this.statsCache.set(path, current);
                this.notifyUpdate();
                return current;
            }
            return cached;
        }
        catch (error) {
            if (error.code !== "ENOENT") {
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
    async getFileContent(path) {
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
            const result = {
                content,
                tokens,
                mtime: stat.mtime,
            };
            this.contentCache.set(path, result);
            this.notifyUpdate();
            console.log(`Cached file ${path} with ${tokens} tokens`);
            return result;
        }
        catch (error) {
            console.error(`Error reading file ${path}:`, error);
            return {
                content: `Error reading file content: ${error instanceof Error ? error.message : "Unknown error"}`,
                tokens: 0,
                mtime: new Date(),
            };
        }
    }
    /**
     * Clear all cached data
     */
    clear() {
        this.statsCache.clear();
        this.contentCache.clear();
        this.notifyUpdate();
        console.log("Cleared cache");
    }
    /**
     * Get the current size of the cache
     * @returns Object containing cache size information
     */
    getCacheSize() {
        return {
            stats: this.statsCache.size,
            content: this.contentCache.size,
        };
    }
    /**
     * Remove specific entries from the cache
     * @param paths Array of file paths to remove from cache
     */
    invalidateEntries(paths) {
        for (const path of paths) {
            this.statsCache.delete(path);
            this.contentCache.delete(path);
        }
        this.notifyUpdate();
        console.log(`Invalidated ${paths.length} cache entries`);
    }
    notifyUpdate() {
        this._onDidUpdateCache.fire();
    }
    dispose() {
        this._onDidUpdateCache.dispose();
    }
}
exports.CacheProvider = CacheProvider;
//# sourceMappingURL=CacheProvider.js.map