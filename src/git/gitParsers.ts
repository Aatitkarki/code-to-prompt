import * as vscode from "vscode";

/**
 * Parses `git status --porcelain=v1 -z` output into relative file paths,
 * excluding deleted files.
 */
export function parseGitStatusPaths(statusOutput: string): string[] {
    const entries = statusOutput.split("\0").filter(Boolean);
    const paths: string[] = [];

    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if (entry.length < 4) {
            continue;
        }

        const indexStatus = entry[0];
        const worktreeStatus = entry[1];
        const statusPath = entry.slice(3);

        if (indexStatus === "R" || indexStatus === "C") {
            paths.push(statusPath);
            i++; // skip the original path entry
            continue;
        }

        if (indexStatus === "D" || worktreeStatus === "D") {
            continue;
        }

        paths.push(statusPath);
    }

    return Array.from(new Set(paths));
}

/**
 * Parses `git diff --name-status -z` / `git diff-tree --name-status -r -z`
 * output into relative file paths, excluding deleted files.
 */
export function parseGitNameStatusPaths(statusOutput: string): string[] {
    const entries = statusOutput.split("\0").filter(Boolean);
    const paths: string[] = [];

    for (let i = 0; i < entries.length; i++) {
        const status = entries[i];
        const pathEntry = entries[i + 1];
        if (!status || !pathEntry) {
            continue;
        }

        if (status.startsWith("R") || status.startsWith("C")) {
            const newPath = entries[i + 2];
            if (newPath) {
                paths.push(newPath);
            }
            i += 2;
            continue;
        }

        if (!status.startsWith("D")) {
            paths.push(pathEntry);
        }
        i++;
    }

    return Array.from(new Set(paths));
}

/**
 * Filters a list of relative paths to only those that currently exist
 * as files in the workspace (i.e. not deleted or unavailable).
 */
export async function filterExistingFilePaths(
    rootUri: vscode.Uri,
    paths: string[]
): Promise<string[]> {
    const existingFiles: string[] = [];

    for (const relPath of Array.from(new Set(paths))) {
        const uri = vscode.Uri.joinPath(rootUri, relPath);
        try {
            const stat = await vscode.workspace.fs.stat(uri);
            if (stat.type === vscode.FileType.File) {
                existingFiles.push(relPath);
            }
        } catch {
            // Deleted or otherwise unavailable files cannot be selected for prompts.
        }
    }

    return existingFiles;
}