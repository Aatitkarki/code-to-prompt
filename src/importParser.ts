import { FileContent, OutputFormat } from "./formatter";

/**
 * Legacy entry (still available if needed), but the import command
 * now uses parsePromptTextToFilesAuto to auto-detect the format.
 */
export function parsePromptTextToFiles(
  text: string,
  format: OutputFormat
): FileContent[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  switch (format) {
    case "xml":
      return parseXml(trimmed);
    case "json":
      return parseJson(trimmed);
    case "markdown":
    default:
      return parseMarkdown(trimmed);
  }
}

/**
 * Auto-detect between XML, JSON and Markdown.
 *
 * Strategy:
 *  1. Try XML (<document path="...">)
 *  2. Try JSON ("documents": [...])
 *  3. Fall back to Markdown (File: path + fenced code)
 */
export function parsePromptTextToFilesAuto(text: string): FileContent[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  // 1. XML
  const xmlResult = parseXml(trimmed);
  if (xmlResult.length > 0) {
    return xmlResult;
  }

  // 2. JSON
  const jsonResult = parseJson(trimmed);
  if (jsonResult.length > 0) {
    return jsonResult;
  }

  // 3. Markdown (fallback)
  return parseMarkdown(trimmed);
}

// ---------------------------------------------------------------------------
// MARKDOWN
// ---------------------------------------------------------------------------

/**
 * Expected pattern (as emitted by formatter):
 *
 *   Project tree:
 *   ```text
 *   ...
 *   ```
 *
 *   File: src/main.ts
 *
 *   ```ts
 *   console.log("hello");
 *   ```
 *
 * We only care about the "File:" + fenced code blocks. Anything
 * before/after is ignored.
 */
function parseMarkdown(text: string): FileContent[] {
  const lines = text.split(/\r?\n/);
  const result: FileContent[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Be flexible:
    // - optional leading spaces
    // - optional bullet: "- " or "* "
    // - then "File: path"
    const fileMatch = /^\s*(?:[-*]\s*)?File:\s+(.+)$/.exec(line);
    if (!fileMatch) {
      i++;
      continue;
    }

    const rawPath = fileMatch[1].trim();

    // Skip optional blank lines after "File: ..."
    i++;
    while (i < lines.length && lines[i].trim() === "") {
      i++;
    }

    // Expect a fenced code block: ```lang or ``` (we don't care about lang)
    if (i >= lines.length || !lines[i].trim().startsWith("```")) {
      // Malformed, skip this file header
      continue;
    }

    // const fenceLine = lines[i].trim(); // language is not used
    i++;

    const contentLines: string[] = [];
    while (i < lines.length && !lines[i].trim().startsWith("```")) {
      contentLines.push(lines[i]);
      i++;
    }

    // Skip closing ```
    if (i < lines.length && lines[i].trim().startsWith("```")) {
      i++;
    }

    result.push({
      path: normalizePath(rawPath),
      content: contentLines.join("\n"),
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// XML
// ---------------------------------------------------------------------------

/**
 * Expected pattern:
 *
 * <documents>
 *   <document path="src/main.ts">
 *     console.log("hi");
 *   </document>
 *   ...
 * </documents>
 *
 * We dedent the inner code so that leading indentation from XML formatting
 * (e.g. two spaces under <document>) does NOT end up as invalid leading
 * indentation in languages like Python.
 */
function parseXml(text: string): FileContent[] {
  const result: FileContent[] = [];

  // Very lightweight parsing, not a full XML parser.
  const documentRegex = /<document\s+path="([^"]+)"\s*>([\s\S]*?)<\/document>/g;

  let match: RegExpExecArray | null;
  while ((match = documentRegex.exec(text)) !== null) {
    const pathAttr = match[1];
    let body = match[2] || "";

    // Strip leading/trailing completely blank lines
    body = body.replace(/^\s*\n/, "").replace(/\s*$/, "");

    // Decode XML entities
    body = decodeXmlText(body);

    // Dedent so that code doesn't start with indentation
    body = dedent(body);

    result.push({
      path: normalizePath(decodeXmlAttr(pathAttr)),
      content: body,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// JSON
// ---------------------------------------------------------------------------

/**
 * Expected pattern (as emitted by formatter):
 *
 * {
 *   "documents": [
 *     { "path": "src/main.ts", "content": "console.log('hi');" }
 *   ],
 *   "tree": "..." // optional
 * }
 *
 * BUT: models often wrap this in ```json fences or add text around it.
 * We try:
 *  1) content of a ```json ... ``` block (if present)
 *  2) whole text as-is
 *  3) substring between first '{' and last '}'
 */
function parseJson(text: string): FileContent[] {
  const candidates: string[] = [];
  const trimmed = text.trim();

  // 1) Look for fenced code block that looks like JSON
  const fenceRegex = /```(?:json|javascript|js)?\s*([\s\S]*?)```/i;
  const fenceMatch = fenceRegex.exec(trimmed);
  if (fenceMatch && fenceMatch[1]) {
    candidates.push(fenceMatch[1].trim());
  }

  // 2) Try the whole text
  candidates.push(trimmed);

  // 3) Try the inner-most { ... } block
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const slice = trimmed.slice(firstBrace, lastBrace + 1);
    candidates.push(slice.trim());
  }

  for (const candidate of candidates) {
    try {
      const obj = JSON.parse(candidate);
      if (!obj || !Array.isArray(obj.documents)) {
        continue;
      }

      const docs = obj.documents as Array<{
        path?: string;
        content?: string;
      }>;

      const result: FileContent[] = [];

      for (const d of docs) {
        if (!d.path || typeof d.content !== "string") {
          continue;
        }
        result.push({
          path: normalizePath(d.path),
          content: d.content,
        });
      }

      if (result.length) {
        return result;
      }
    } catch {
      // Try next candidate
    }
  }

  return [];
}

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}

function decodeXmlText(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

function decodeXmlAttr(text: string): string {
  return decodeXmlText(text);
}

/**
 * Dedent a multi-line string:
 * - Find minimum indentation (spaces/tabs) among all non-empty lines
 * - Remove that indent from each line
 *
 * This is critical for languages like Python where a file cannot start
 * with an indented line.
 */
function dedent(text: string): string {
  const lines = text.split(/\r?\n/);

  // Find min indent over non-empty lines
  let minIndent: number | null = null;

  for (const line of lines) {
    if (/^\s*$/.test(line)) {
      continue; // skip empty lines
    }
    const match = /^([ \t]*)/.exec(line);
    const indent = match ? match[1].length : 0;
    if (minIndent === null || indent < minIndent) {
      minIndent = indent;
    }
  }

  if (minIndent === null || minIndent === 0) {
    return text;
  }

  const dedented = lines.map((line) => {
    if (/^\s*$/.test(line)) {
      return ""; // keep empty as empty
    }
    return line.slice(minIndent!);
  });

  return dedented.join("\n");
}
