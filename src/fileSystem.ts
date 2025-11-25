import * as vscode from "vscode";
import * as path from "path";
import ignore from "ignore";

export interface FileNode extends vscode.TreeItem {
  resourceUri: vscode.Uri;
  isFile: boolean;
  relativePath: string;
}

interface InternalNode {
  uri: vscode.Uri;
  isFile: boolean;
  children?: InternalNode[];
}

const BINARY_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".bmp",
  ".ico",
  ".pdf",
  ".zip",
  ".rar",
  ".7z",
  ".lock",
  ".exe",
  ".dll",
];

export class CodeToPromptTreeProvider
  implements vscode.TreeDataProvider<FileNode>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    FileNode | undefined | void
  >();
  readonly onDidChangeTreeData: vscode.Event<FileNode | undefined | void> =
    this._onDidChangeTreeData.event;

  private root: vscode.Uri;
  private tree: InternalNode | undefined;
  private gitignore: ReturnType<typeof ignore> | null = null;

  // Selection state (ordered)
  private selectedOrder: string[] = [];
  private selectedSet: Set<string> = new Set<string>();

  constructor(root: vscode.Uri) {
    this.root = root;
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.reloadIgnoreConfig();
    this.tree = await this.buildTree(this.root);
    this.refresh();
  }

  async reloadConfig(): Promise<void> {
    await this.reloadIgnoreConfig();
    this.tree = await this.buildTree(this.root);
    this.refresh();
  }

  private async reloadIgnoreConfig(): Promise<void> {
    const config = vscode.workspace.getConfiguration("codeToPrompt");
    const respectGitignore = config.get<boolean>("respectGitignore", true);
    const ignorePatternsText = config.get<string>("ignorePatterns", "") || "";
    const extraPatterns = ignorePatternsText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const ig = ignore();

    if (respectGitignore) {
      try {
        const gitignoreUri = vscode.Uri.joinPath(this.root, ".gitignore");
        const data = await vscode.workspace.fs.readFile(gitignoreUri);
        const text = Buffer.from(data).toString("utf8");
        ig.add(text);
      } catch {
        // No .gitignore or can't read; ignore.
      }
    }

    if (extraPatterns.length) {
      ig.add(extraPatterns);
    }

    this.gitignore = ig;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: FileNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: FileNode): Promise<FileNode[]> {
    if (!this.tree) {
      return [];
    }

    const parentNode = element
      ? await this.findInternalNode(this.tree, element.resourceUri)
      : this.tree;

    if (!parentNode || !parentNode.children) {
      return [];
    }

    const children = parentNode.children;

    return children
      .map((child) => {
        const relPath =
          path.relative(this.root.fsPath, child.uri.fsPath) || ".";
        const collapsibleState = child.isFile
          ? vscode.TreeItemCollapsibleState.None
          : vscode.TreeItemCollapsibleState.Collapsed;

        const isSelected = this.selectedSet.has(relPath);

        const item = new vscode.TreeItem(
          child.uri,
          collapsibleState
        ) as FileNode;
        item.resourceUri = child.uri;
        item.isFile = child.isFile;
        item.relativePath = relPath;
        item.label = child.isFile
          ? path.basename(child.uri.fsPath)
          : path.basename(relPath) || relPath;
        item.description = child.isFile
          ? undefined
          : relPath === "."
          ? undefined
          : relPath;
        item.contextValue = child.isFile ? "file" : "folder";
        item.tooltip = relPath;
        item.iconPath = child.isFile
          ? new vscode.ThemeIcon(isSelected ? "check" : "file")
          : new vscode.ThemeIcon(isSelected ? "check" : "folder");

        item.command = {
          command: "codeToPrompt.toggleSelection",
          title: "Toggle Selection",
          arguments: [item],
        };

        return item;
      })
      .sort((a, b) => {
        const aIsFile = (a as FileNode).isFile;
        const bIsFile = (b as FileNode).isFile;
        if (aIsFile !== bIsFile) {
          return aIsFile ? 1 : -1; // folders first
        }
        return (a.label || "")
          .toString()
          .localeCompare((b.label || "").toString());
      });
  }

  // ---------------------------------------------------------------------------
  // Selection helpers
  // ---------------------------------------------------------------------------

  private addSelection(relPath: string): void {
    if (!relPath || this.selectedSet.has(relPath) || this.isBinary(relPath)) {
      return;
    }
    this.selectedSet.add(relPath);
    this.selectedOrder.push(relPath);
  }

  private removeSelection(relPath: string): void {
    if (!this.selectedSet.has(relPath)) {
      return;
    }
    this.selectedSet.delete(relPath);
    this.selectedOrder = this.selectedOrder.filter((p) => p !== relPath);
  }

  toggleSelection(node: FileNode): void {
    if (!node) {
      return;
    }

    if (node.isFile) {
      if (this.selectedSet.has(node.relativePath)) {
        this.removeSelection(node.relativePath);
      } else {
        this.addSelection(node.relativePath);
      }
    } else {
      void this.toggleFolder(node.relativePath);
    }

    this.refresh();
  }

  private async toggleFolder(relPath: string): Promise<void> {
    if (!this.tree) return;

    const folderUri =
      relPath === "." ? this.root : vscode.Uri.joinPath(this.root, relPath);
    const folderNode = await this.findInternalNode(this.tree, folderUri);
    if (!folderNode) return;

    const filePaths: string[] = [];

    const collect = (node: InternalNode): void => {
      if (node.isFile) {
        const rp = path.relative(this.root.fsPath, node.uri.fsPath) || ".";
        if (!this.isBinary(rp)) {
          filePaths.push(rp);
        }
      }
      for (const child of node.children || []) {
        collect(child);
      }
    };

    collect(folderNode);

    if (filePaths.length === 0) return;

    const allSelected = filePaths.every((p) => this.selectedSet.has(p));

    if (allSelected) {
      for (const p of filePaths) {
        this.removeSelection(p);
      }
    } else {
      for (const p of filePaths) {
        this.addSelection(p);
      }
    }
  }

  getSelectedPaths(): string[] {
    return [...this.selectedOrder];
  }

  getSelectedFileEntries(): { uri: vscode.Uri; relativePath: string }[] {
    const entries: { uri: vscode.Uri; relativePath: string }[] = [];
    for (const rel of this.selectedOrder) {
      const uri = rel === "." ? this.root : vscode.Uri.joinPath(this.root, rel);
      entries.push({ uri, relativePath: rel });
    }
    return entries;
  }

  setSelectedUris(uris: vscode.Uri[]): void {
    this.selectedOrder = [];
    this.selectedSet = new Set<string>();

    for (const uri of uris) {
      const rel = path.relative(this.root.fsPath, uri.fsPath) || ".";
      this.addSelection(rel);
    }

    this.refresh();
  }

  setSelectedPaths(paths: string[]): void {
    this.selectedOrder = [];
    this.selectedSet = new Set<string>();

    for (const p of paths) {
      if (p) {
        this.addSelection(p);
      }
    }

    this.refresh();
  }

  reorderSelection(paths: string[]): void {
    const filtered = paths.filter((p) => this.selectedSet.has(p));
    this.selectedOrder = [...filtered];
    this.selectedSet = new Set<string>(this.selectedOrder);
    this.refresh();
  }

  clearSelection(): void {
    this.selectedOrder = [];
    this.selectedSet = new Set<string>();
    this.refresh();
  }

  // ---------------------------------------------------------------------------
  // Tree building / ignore
  // ---------------------------------------------------------------------------

  private async buildTree(uri: vscode.Uri): Promise<InternalNode> {
    const stat = await vscode.workspace.fs.stat(uri);
    const isFile = stat.type === vscode.FileType.File;

    const node: InternalNode = { uri, isFile };

    if (!isFile) {
      const entries = await vscode.workspace.fs.readDirectory(uri);
      const children: InternalNode[] = [];

      for (const [name, type] of entries) {
        const childUri = vscode.Uri.joinPath(uri, name);
        const relPath = path.relative(this.root.fsPath, childUri.fsPath);

        if (this.shouldIgnore(relPath, type)) {
          continue;
        }

        if (
          type === vscode.FileType.File ||
          type === vscode.FileType.Directory
        ) {
          children.push(await this.buildTree(childUri));
        }
      }

      node.children = children;
    }

    return node;
  }

  private async findInternalNode(
    node: InternalNode,
    uri: vscode.Uri
  ): Promise<InternalNode | undefined> {
    if (node.uri.toString() === uri.toString()) {
      return node;
    }
    for (const child of node.children || []) {
      const found = await this.findInternalNode(child, uri);
      if (found) return found;
    }
    return undefined;
  }

  private shouldIgnore(relPath: string, type: vscode.FileType): boolean {
    if (!relPath || relPath === ".") return false;

    const parts = relPath.split(path.sep);
    if (parts.includes("node_modules")) return true;

    if (type === vscode.FileType.File && this.isBinary(relPath)) {
      return true;
    }

    if (this.gitignore && this.gitignore.ignores(relPath)) {
      return true;
    }

    return false;
  }

  private isBinary(relPath: string): boolean {
    const ext = path.extname(relPath).toLowerCase();
    return BINARY_EXTENSIONS.includes(ext);
  }
}
