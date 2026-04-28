import * as vscode from "vscode";
import { execFile } from "child_process";
import { promisify } from "util";
import {
    filterExistingFilePaths,
    parseGitNameStatusPaths,
    parseGitStatusPaths,
} from "./gitParsers";

const execFileAsync = promisify(execFile);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GitCommitPickItem extends vscode.QuickPickItem {
    hash: string;
    absoluteDate: string;
}

// ─── Working-tree changes ─────────────────────────────────────────────────────

/**
 * Returns relative paths of files that are changed in the working tree
 * (staged or unstaged), excluding deletions.
 */
export async function getGitChangedFilePaths(
    rootUri: vscode.Uri
): Promise<string[]> {
    let stdout: string;
    try {
        const result = await execFileAsync(
            "git",
            ["status", "--porcelain=v1", "-z"],
            { cwd: rootUri.fsPath, encoding: "utf8", maxBuffer: 1024 * 1024 * 10 }
        );
        stdout = result.stdout;
    } catch (err) {
        vscode.window.showWarningMessage(
            "Code to Prompt: Could not read git changes for this workspace."
        );
        console.error("Code to Prompt: failed to read git status", err);
        return [];
    }

    const paths = parseGitStatusPaths(stdout);
    return filterExistingFilePaths(rootUri, paths);
}

// ─── Range / branch changes ───────────────────────────────────────────────────

/**
 * Returns relative paths of files changed in the given git range
 * (e.g. `origin/main...HEAD`), excluding deletions.
 */
export async function getGitChangedFilePathsForRange(
    rootUri: vscode.Uri,
    range: string
): Promise<string[]> {
    let stdout: string;
    try {
        const result = await execFileAsync(
            "git",
            ["diff", "--name-status", "-z", range],
            { cwd: rootUri.fsPath, encoding: "utf8", maxBuffer: 1024 * 1024 * 10 }
        );
        stdout = result.stdout;
    } catch (err) {
        vscode.window.showWarningMessage(
            "Code to Prompt: Could not read branch changed files."
        );
        console.error("Code to Prompt: failed to read git branch diff", err);
        return [];
    }

    return filterExistingFilePaths(rootUri, parseGitNameStatusPaths(stdout));
}

// ─── Per-commit changes ───────────────────────────────────────────────────────

/**
 * Returns the union of relative paths changed across the given commit hashes,
 * excluding deletions.
 */
export async function getGitChangedFilePathsForCommits(
    rootUri: vscode.Uri,
    commitHashes: string[]
): Promise<string[]> {
    const paths: string[] = [];

    for (const hash of commitHashes) {
        try {
            const result = await execFileAsync(
                "git",
                ["diff-tree", "--no-commit-id", "--name-status", "-r", "-z", hash],
                { cwd: rootUri.fsPath, encoding: "utf8", maxBuffer: 1024 * 1024 * 10 }
            );
            paths.push(...parseGitNameStatusPaths(result.stdout));
        } catch (err) {
            console.error(
                `Code to Prompt: failed to read changed files for commit ${hash}`,
                err
            );
        }
    }

    return filterExistingFilePaths(rootUri, paths);
}

// ─── Base-branch detection ────────────────────────────────────────────────────

/**
 * Detects the best "base" branch to compare against (e.g. `origin/main`).
 * Returns `null` if none can be found.
 */
export async function getDefaultBaseRef(
    rootUri: vscode.Uri
): Promise<string | null> {
    const candidates: string[] = [];

    try {
        const result = await execFileAsync(
            "git",
            ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"],
            { cwd: rootUri.fsPath, encoding: "utf8" }
        );
        const ref = result.stdout.trim();
        if (ref) {
            candidates.push(ref);
        }
    } catch {
        // Fall back to common default branch names below.
    }

    candidates.push("origin/main", "origin/master", "main", "master");

    for (const candidate of Array.from(new Set(candidates))) {
        try {
            await execFileAsync("git", ["rev-parse", "--verify", candidate], {
                cwd: rootUri.fsPath,
                encoding: "utf8",
            });
            return candidate;
        } catch {
            // Try the next candidate.
        }
    }

    return null;
}

// ─── Commit listing ───────────────────────────────────────────────────────────

/**
 * Lists the non-merge commits on the current branch that are not reachable
 * from `baseRef`, formatted as QuickPick items.
 */
export async function getBranchCommits(
    rootUri: vscode.Uri,
    baseRef: string
): Promise<GitCommitPickItem[]> {
    let stdout: string;
    try {
        const result = await execFileAsync(
            "git",
            [
                "log",
                "--no-merges",
                "--max-count=100",
                "--format=%H%x1f%h%x1f%s%x1f%an%x1f%cr%x1f%aI",
                `${baseRef}..HEAD`,
            ],
            { cwd: rootUri.fsPath, encoding: "utf8", maxBuffer: 1024 * 1024 * 10 }
        );
        stdout = result.stdout;
    } catch (err) {
        vscode.window.showWarningMessage(
            "Code to Prompt: Could not list branch commits."
        );
        console.error("Code to Prompt: failed to list git commits", err);
        return [];
    }

    return stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const [hash, shortHash, subject, author, relativeDate, absoluteDate] =
                line.split("\x1f");
            return {
                hash,
                label: `${shortHash} ${subject || "(no subject)"}`,
                description: relativeDate,
                detail: author ? `by ${author}` : undefined,
                absoluteDate,
            } as GitCommitPickItem;
        })
        .filter((item) => Boolean(item.hash));
}