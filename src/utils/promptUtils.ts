import * as vscode from "vscode";
import { CodeToPromptTreeProvider, FileNode } from "../fileSystem";
import { FileContent } from "../formatter";

export const STANDARD_FOOTER_NOTE =
    "Always output in same format as provided. Only provide new or files that requires update";

// ─── Footer builder ───────────────────────────────────────────────────────────

/**
 * Combines the user-configured footer with the standard footer note,
 * avoiding duplication if the note is already present.
 */
export function buildFooterPrompt(
    baseFooter: string,
    appendStandard: boolean
): string {
    if (!appendStandard) {
        return baseFooter;
    }

    if (!baseFooter || !baseFooter.trim()) {
        return STANDARD_FOOTER_NOTE;
    }

    const trimmed = baseFooter.trim();
    // Avoid duplicating the standard note if user already put it there
    if (trimmed.includes(STANDARD_FOOTER_NOTE)) {
        return trimmed;
    }

    return trimmed + "\n\n" + STANDARD_FOOTER_NOTE;
}

// ─── Import confirmation message ──────────────────────────────────────────────

/**
 * Builds the confirmation message shown before an import, listing new and
 * updated files (up to 5 each before truncating).
 */
export function buildImportSummaryMessage(
    newFiles: string[],
    updatedFiles: string[]
): string {
    const totalNew = newFiles.length;
    const totalUpdated = updatedFiles.length;
    const maxShow = 5;
    const lines: string[] = [];

    lines.push(
        `Code to Prompt: This will create ${totalNew} new file(s) and update ${totalUpdated} existing file(s).`
    );

    if (totalNew > 0) {
        lines.push("", "New:");
        for (const p of newFiles.slice(0, maxShow)) {
            lines.push(`- ${p}`);
        }
        if (totalNew > maxShow) {
            lines.push(`- ...and ${totalNew - maxShow} more`);
        }
    }

    if (totalUpdated > 0) {
        lines.push("", "Updated:");
        for (const p of updatedFiles.slice(0, maxShow)) {
            lines.push(`- ${p}`);
        }
        if (totalUpdated > maxShow) {
            lines.push(`- ...and ${totalUpdated - maxShow} more`);
        }
    }

    lines.push("", "Proceed with import?");
    return lines.join("\n");
}

// ─── Path sanitisation ────────────────────────────────────────────────────────

/**
 * Normalises a relative path and ensures it cannot escape the workspace root
 * via path-traversal (`../`).  Returns `null` for invalid paths.
 */
export function sanitizeRelativePath(relPath: string): string | null {
    const normalized = relPath.replace(/\\/g, "/");
    if (!normalized || normalized.startsWith("/")) {
        return null;
    }
    const parts = normalized.split("/").filter((p) => p && p !== ".");
    const safeParts: string[] = [];
    for (const part of parts) {
        if (part === "..") {
            if (safeParts.length === 0) {
                return null; // would escape workspace root
            }
            safeParts.pop();
        } else {
            safeParts.push(part);
        }
    }
    return safeParts.join("/");
}

// ─── File content helpers ─────────────────────────────────────────────────────

/**
 * Reads the content of every selected file from disk and returns an array of
 * `{ path, content }` objects, skipping any files that cannot be read.
 */
export async function getSelectedFileContents(
    treeProvider: CodeToPromptTreeProvider
): Promise<FileContent[]> {
    const entries = treeProvider.getSelectedFileEntries();
    const result: FileContent[] = [];

    for (const entry of entries) {
        try {
            const data = await vscode.workspace.fs.readFile(entry.uri);
            const text = Buffer.from(data).toString("utf8");
            result.push({ path: entry.relativePath, content: text });
        } catch (err) {
            console.error("Code to Prompt: failed to read", entry.uri.fsPath, err);
        }
    }

    return result;
}

/**
 * Recursively collects all relative file paths from the tree provider.
 */
export async function getAllFilePaths(
    treeProvider: CodeToPromptTreeProvider
): Promise<string[]> {
    const allFiles: string[] = [];

    const collectFiles = async (items: FileNode[]): Promise<void> => {
        for (const item of items) {
            if (item.isFile) {
                allFiles.push(item.relativePath);
            } else {
                const children = await treeProvider.getChildren(item);
                await collectFiles(children);
            }
        }
    };

    const rootItems = await treeProvider.getChildren();
    await collectFiles(rootItems);
    return allFiles;
}