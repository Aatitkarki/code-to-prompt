export type OutputFormat = "markdown" | "xml" | "json";

export interface FileContent {
  path: string;
  content: string;
}

export function formatPrompt(
  files: FileContent[],
  format: OutputFormat,
  includeLineNumbers: boolean,
  headerPrompt: string,
  footerPrompt: string,
  includeTreeStructure: boolean
): string {
  const header =
    headerPrompt && headerPrompt.trim().length > 0
      ? headerPrompt.trim() + "\n\n"
      : "";
  const footer =
    footerPrompt && footerPrompt.trim().length > 0
      ? "\n\n" + footerPrompt.trim()
      : "";

  let body: string;
  switch (format) {
    case "xml":
      body = formatXml(files, includeLineNumbers);
      break;
    case "json":
      body = formatJson(files, includeLineNumbers, includeTreeStructure);
      break;
    case "markdown":
    default:
      body = formatMarkdown(files, includeLineNumbers, includeTreeStructure);
      break;
  }

  return header + body + footer;
}

function addLineNumbers(content: string): string {
  return content
    .split(/\r?\n/)
    .map((line, idx) => `${idx + 1}: ${line}`)
    .join("\n");
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}

function buildTreeSummary(files: FileContent[]): string {
  interface TreeNode {
    children: Map<string, TreeNode>;
    isFile: boolean;
  }

  const root: TreeNode = { children: new Map(), isFile: false };

  for (const file of files) {
    const norm = normalizePath(file.path);
    const parts = norm.split("/").filter(Boolean);
    let node = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      if (!node.children.has(part)) {
        node.children.set(part, { children: new Map(), isFile });
      }
      const child = node.children.get(part)!;
      if (isFile) {
        child.isFile = true;
      }
      node = child;
    }
  }

  const lines: string[] = [];

  function walk(node: TreeNode, indent: string): void {
    const entries = Array.from(node.children.entries()).sort(
      ([aName, aNode], [bName, bNode]) => {
        if (aNode.isFile !== bNode.isFile) {
          return aNode.isFile ? 1 : -1; // folders first
        }
        return aName.localeCompare(bName);
      }
    );

    for (const [name, child] of entries) {
      const prefix = child.isFile ? "- " : "+ ";
      lines.push(indent + prefix + name);
      walk(child, indent + "  ");
    }
  }

  walk(root, "");
  return lines.join("\n");
}

function formatMarkdown(
  files: FileContent[],
  includeLineNumbers: boolean,
  includeTreeStructure: boolean
): string {
  const parts: string[] = [];

  if (includeTreeStructure && files.length > 0) {
    const tree = buildTreeSummary(files);
    if (tree.trim().length > 0) {
      parts.push("Project tree:", "```text", tree, "```", "");
    }
  }

  for (const file of files) {
    const body = includeLineNumbers
      ? addLineNumbers(file.content)
      : file.content;
    const lang = detectLanguageFromPath(file.path);
    const labelPath = normalizePath(file.path);

    parts.push(`File: ${labelPath}\n\n` + "```" + lang + "\n" + body + "\n```");
  }

  return parts.join("\n\n");
}

function formatXml(files: FileContent[], includeLineNumbers: boolean): string {
  const parts: string[] = [];

  parts.push("<documents>");

  for (const file of files) {
    const body = includeLineNumbers
      ? addLineNumbers(file.content)
      : file.content;
    const escaped = escapeXml(body);
    parts.push(
      `  <document path="${escapeXmlAttr(normalizePath(file.path))}">`
    );
    parts.push("    " + escaped.split("\n").join("\n    "));
    parts.push("  </document>");
  }

  parts.push("</documents>");
  return parts.join("\n");
}

function formatJson(
  files: FileContent[],
  includeLineNumbers: boolean,
  includeTreeStructure: boolean
): string {
  const payload = files.map((f) => ({
    path: normalizePath(f.path),
    content: includeLineNumbers ? addLineNumbers(f.content) : f.content,
  }));

  const obj: any = {
    documents: payload,
  };

  if (includeTreeStructure && files.length > 0) {
    obj.tree = buildTreeSummary(files);
  }

  return JSON.stringify(obj, null, 2);
}

function detectLanguageFromPath(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".ts")) return "ts";
  if (lower.endsWith(".tsx")) return "tsx";
  if (lower.endsWith(".js")) return "js";
  if (lower.endsWith(".jsx")) return "jsx";
  if (lower.endsWith(".py")) return "py";
  if (lower.endsWith(".java")) return "java";
  if (lower.endsWith(".cs")) return "cs";
  if (lower.endsWith(".cpp") || lower.endsWith(".cc") || lower.endsWith(".cxx"))
    return "cpp";
  if (lower.endsWith(".go")) return "go";
  if (lower.endsWith(".rs")) return "rust";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".md")) return "md";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  if (lower.endsWith(".css")) return "css";
  return "";
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeXmlAttr(text: string): string {
  return escapeXml(text).replace(/"/g, "&quot;");
}
