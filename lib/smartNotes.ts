/**
 * Smart Notes — auto-formatter.
 *
 * Pure, DOM-free logic (Node-testable via scripts/test-smartnotes.mjs): takes
 * rough pasted text and returns a structured list of NoteBlocks the editor can
 * render and the export path can turn into PDF / DOCX / Markdown / plain text.
 *
 * Detection (in priority order, line-driven):
 *   fenced code → table → checklist → bullet/numbered list → quote → markdown
 *   heading → key:value run → heuristic code run → heuristic heading/subheading
 *   → paragraph.
 *
 * Nothing here touches the network or the DOM, so it can be unit-tested and
 * reused server-side if ever needed. Export to PDF/DOCX reuses the tested
 * lib/docExport block engine via toDocBlocks().
 */

import type { DocBlock } from "@/lib/ai";

export type NoteBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "checklist"; items: { text: string; checked: boolean }[] }
  | { type: "quote"; text: string }
  | { type: "code"; lang: string; code: string }
  | { type: "table"; rows: string[][] }
  | { type: "kv"; pairs: { key: string; value: string }[] };

// Words that, when they start a short imperative line, mark it as a task.
const ACTION_WORDS = [
  "fix", "call", "send", "review", "submit", "complete", "email", "buy", "pay",
  "schedule", "book", "update", "check", "follow up", "followup", "finish",
  "prepare", "write", "ask", "confirm", "renew", "sign", "file", "remind",
];

const BULLET_RE = /^\s*[-*•·–]\s+(.*)$/;
const NUM_RE = /^\s*\d+[.)]\s+(.*)$/;
const CHECK_RE = /^\s*(?:[-*]\s*)?\[( |x|X)\]\s+(.*)$/;
const QUOTE_RE = /^\s*>\s?(.*)$/;
const HEADING_MD_RE = /^\s*(#{1,6})\s+(.*)$/;
const TABLE_SEP_RE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/;

function isBlank(line: string): boolean {
  return line.trim().length === 0;
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function isTableRow(line: string): boolean {
  const t = line.trim();
  // A genuine table row has at least two cells separated by a pipe.
  return t.includes("|") && splitTableRow(t).length >= 2 && !/^\|?\s*\|?$/.test(t);
}

function isActionLine(line: string): boolean {
  const t = line.trim().toLowerCase().replace(/^todo[:\-\s]+/, "");
  return ACTION_WORDS.some((w) => t === w || t.startsWith(w + " "));
}

function looksLikeKeyValue(line: string): boolean {
  const m = /^([^:]{1,32}):\s+(.+)$/.exec(line.trim());
  if (!m) return false;
  const key = m[1].trim();
  // Key should be label-ish: a few words, not a full sentence.
  return key.split(/\s+/).length <= 4 && !/[.!?]$/.test(key);
}

// ---- code heuristics -------------------------------------------------------

const CODE_SIGNALS = [
  /[{};]\s*$/, // line ends with brace/semicolon
  /=>/, /\bfunction\b/, /\b(const|let|var)\s+\w+\s*=/, /\b(import|export)\b/,
  /\bclass\s+\w+/, /\bdef\s+\w+\s*\(/, /<\/?[a-zA-Z][\w-]*[^>]*>/, /^\s*#!\//,
  /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|FROM|WHERE)\b/, /\bconsole\.\w+\(/,
  /^\s*[\w.]+\s*\([^)]*\)\s*[;{]?\s*$/, /:\s*(string|number|boolean|any)\b/,
  /^\s*(\$|>)\s+\w+/, /\bprint\(/, /[\w)]\s*\{\s*$/,
];

function isCodeLine(line: string): boolean {
  if (isBlank(line)) return false;
  return CODE_SIGNALS.some((re) => re.test(line));
}

/** Strongly code-like single line (enough to start a code block on its own). */
function isStrongCodeLine(line: string): boolean {
  return (
    /[{};]\s*$/.test(line) ||
    /\bfunction\b|\b(const|let|var)\s+\w+\s*=|\b(import|export)\b|=>/.test(line) ||
    /<\/?[a-zA-Z][\w-]*[^>]*>/.test(line) ||
    /\b(SELECT|INSERT|CREATE)\b.*\b(FROM|TABLE|INTO)\b/.test(line)
  );
}

export function detectLanguage(code: string): string {
  const c = code.trim();
  if (/^\s*[[{]/.test(c) && /"\s*:/.test(c)) return "json";
  if (/<\/?[a-zA-Z][\w-]*[^>]*>/.test(c) && /<(html|div|span|p|a|body|head|script)/i.test(c))
    return "html";
  if (/\b(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|FROM|WHERE)\b/.test(c)) return "sql";
  if (/[#.][\w-]+\s*\{[^}]*:[^}]*;/.test(c) || /^\s*[\w-]+\s*:\s*[^;]+;/m.test(c)) return "css";
  if (/\b(def|elif|lambda)\b|^\s*from\s+\w+\s+import|\bprint\(/.test(c)) return "python";
  if (/^\s*(\$|#)\s|\b(npm|git|cd|sudo|chmod|echo|curl|mkdir)\b/.test(c)) return "bash";
  if (/\binterface\b|:\s*(string|number|boolean)\b|\bimport\s+type\b/.test(c)) return "typescript";
  if (/\b(function|const|let|var|=>|console\.)\b/.test(c)) return "javascript";
  return "code";
}

// ---- main parser -----------------------------------------------------------

export function formatNotes(raw: string): NoteBlock[] {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const blocks: NoteBlock[] = [];
  let i = 0;

  const peekNonBlank = (from: number): string | null => {
    for (let j = from; j < lines.length; j++) if (!isBlank(lines[j])) return lines[j];
    return null;
  };

  while (i < lines.length) {
    const line = lines[i];

    if (isBlank(line)) {
      i++;
      continue;
    }

    // Fenced code block ```lang ... ```
    const fence = /^\s*```(\w+)?\s*$/.exec(line);
    if (fence) {
      const lang = fence[1];
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      i++; // consume closing fence
      const code = body.join("\n");
      blocks.push({ type: "code", lang: lang || detectLanguage(code), code });
      continue;
    }

    // Markdown table (two+ pipe rows, optional separator)
    if (isTableRow(line) && (isTableRow(peekNonBlank(i + 1) ?? "") || TABLE_SEP_RE.test(lines[i + 1] ?? ""))) {
      const rows: string[][] = [];
      while (i < lines.length && (isTableRow(lines[i]) || TABLE_SEP_RE.test(lines[i]))) {
        if (!TABLE_SEP_RE.test(lines[i])) rows.push(splitTableRow(lines[i]));
        i++;
      }
      if (rows.length) blocks.push({ type: "table", rows });
      continue;
    }

    // Checklist (explicit [ ] / [x], "todo:", or action-word imperatives)
    const isCheck = (l: string) => CHECK_RE.test(l) || /^\s*todo[:\-\s]/i.test(l) || isActionLine(l);
    if (isCheck(line)) {
      const items: { text: string; checked: boolean }[] = [];
      while (i < lines.length && isCheck(lines[i])) {
        const m = CHECK_RE.exec(lines[i]);
        if (m) items.push({ text: m[2].trim(), checked: m[1].toLowerCase() === "x" });
        else items.push({ text: lines[i].trim().replace(/^todo[:\-\s]+/i, ""), checked: false });
        i++;
      }
      blocks.push({ type: "checklist", items });
      continue;
    }

    // Numbered list
    if (NUM_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length && NUM_RE.test(lines[i])) {
        items.push(NUM_RE.exec(lines[i])![1].trim());
        i++;
      }
      blocks.push({ type: "list", ordered: true, items });
      continue;
    }

    // Bullet list
    if (BULLET_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length && BULLET_RE.test(lines[i]) && !CHECK_RE.test(lines[i])) {
        items.push(BULLET_RE.exec(lines[i])![1].trim());
        i++;
      }
      blocks.push({ type: "list", ordered: false, items });
      continue;
    }

    // Block quote
    if (QUOTE_RE.test(line)) {
      const parts: string[] = [];
      while (i < lines.length && QUOTE_RE.test(lines[i])) {
        parts.push(QUOTE_RE.exec(lines[i])![1].trim());
        i++;
      }
      blocks.push({ type: "quote", text: parts.join(" ").trim() });
      continue;
    }

    // Markdown heading
    const mdH = HEADING_MD_RE.exec(line);
    if (mdH) {
      const level = Math.min(3, mdH[1].length) as 1 | 2 | 3;
      blocks.push({ type: "heading", level, text: mdH[2].trim() });
      i++;
      continue;
    }

    // Key:value run (Name: …, Date: …, Amount: …)
    if (looksLikeKeyValue(line)) {
      const pairs: { key: string; value: string }[] = [];
      while (i < lines.length && looksLikeKeyValue(lines[i])) {
        const m = /^([^:]+):\s+(.+)$/.exec(lines[i].trim())!;
        pairs.push({ key: m[1].trim(), value: m[2].trim() });
        i++;
      }
      // A single key:value pair reads better as a paragraph; group only 2+.
      if (pairs.length >= 2) {
        blocks.push({ type: "kv", pairs });
        continue;
      }
      blocks.push({ type: "paragraph", text: line.trim() });
      i++;
      continue;
    }

    // Heuristic code run (no fence): 2+ consecutive code-like lines, or one
    // strongly code-like line.
    if (isStrongCodeLine(line) || (isCodeLine(line) && isCodeLine(lines[i + 1] ?? ""))) {
      const body: string[] = [];
      while (i < lines.length && (isCodeLine(lines[i]) || (body.length > 0 && lines[i].startsWith("  ")))) {
        body.push(lines[i]);
        i++;
      }
      const code = body.join("\n").replace(/\n+$/, "");
      blocks.push({ type: "code", lang: detectLanguage(code), code });
      continue;
    }

    // Heuristic heading / subheading:
    //  - line ending with ":" and short → subheading (H3)
    //  - short, title-ish line followed by a longer paragraph → heading (H2)
    const trimmed = line.trim();
    const words = trimmed.split(/\s+/).length;
    const next = peekNonBlank(i + 1);
    const endsColon = /:$/.test(trimmed);
    const noSentenceEnd = !/[.!?,;]$/.test(trimmed);
    const shortish = trimmed.length <= 60 && words <= 9;

    if (endsColon && shortish) {
      blocks.push({ type: "heading", level: 3, text: trimmed.replace(/:$/, "") });
      i++;
      continue;
    }
    if (
      shortish &&
      noSentenceEnd &&
      next &&
      !isBlank(next) &&
      (next.trim().length > trimmed.length || /[.!?]$/.test(next.trim())) &&
      isTitleish(trimmed)
    ) {
      blocks.push({ type: "heading", level: 2, text: trimmed });
      i++;
      continue;
    }

    // Paragraph: accumulate consecutive plain lines.
    const para: string[] = [];
    while (
      i < lines.length &&
      !isBlank(lines[i]) &&
      !BULLET_RE.test(lines[i]) &&
      !NUM_RE.test(lines[i]) &&
      !CHECK_RE.test(lines[i]) &&
      !QUOTE_RE.test(lines[i]) &&
      !HEADING_MD_RE.test(lines[i]) &&
      !/^\s*```/.test(lines[i]) &&
      !looksLikeKeyValue(lines[i])
    ) {
      para.push(lines[i].trim());
      i++;
    }
    if (para.length) blocks.push({ type: "paragraph", text: para.join(" ") });
  }

  return blocks;
}

/** Title-ish: mostly Title Case or ALL CAPS, no trailing sentence punctuation. */
function isTitleish(s: string): boolean {
  if (/[.!?]$/.test(s)) return false;
  const words = s.split(/\s+/).filter((w) => /[a-zA-Z]/.test(w));
  if (!words.length) return false;
  if (s === s.toUpperCase() && /[A-Z]/.test(s)) return true;
  const capped = words.filter((w) => /^[A-Z0-9]/.test(w)).length;
  return capped / words.length >= 0.6;
}

// ---- serialization ---------------------------------------------------------

export function blocksToMarkdown(blocks: NoteBlock[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "heading":
        out.push("#".repeat(b.level) + " " + b.text);
        break;
      case "paragraph":
        out.push(b.text);
        break;
      case "list":
        b.items.forEach((it, idx) => out.push((b.ordered ? `${idx + 1}. ` : "- ") + it));
        break;
      case "checklist":
        b.items.forEach((it) => out.push(`- [${it.checked ? "x" : " "}] ${it.text}`));
        break;
      case "quote":
        out.push("> " + b.text);
        break;
      case "code":
        out.push("```" + (b.lang === "code" ? "" : b.lang), b.code, "```");
        break;
      case "kv":
        b.pairs.forEach((p) => out.push(`**${p.key}:** ${p.value}`));
        break;
      case "table": {
        if (!b.rows.length) break;
        const cols = Math.max(...b.rows.map((r) => r.length));
        const row = (r: string[]) =>
          "| " + Array.from({ length: cols }, (_, c) => r[c] ?? "").join(" | ") + " |";
        out.push(row(b.rows[0]));
        out.push("| " + Array.from({ length: cols }, () => "---").join(" | ") + " |");
        b.rows.slice(1).forEach((r) => out.push(row(r)));
        break;
      }
    }
    out.push("");
  }
  return out.join("\n").trim() + "\n";
}

export function blocksToPlainText(blocks: NoteBlock[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "heading":
        out.push(b.text.toUpperCase());
        break;
      case "paragraph":
        out.push(b.text);
        break;
      case "list":
        b.items.forEach((it, idx) => out.push((b.ordered ? `${idx + 1}. ` : "• ") + it));
        break;
      case "checklist":
        b.items.forEach((it) => out.push(`[${it.checked ? "x" : " "}] ${it.text}`));
        break;
      case "quote":
        out.push("“" + b.text + "”");
        break;
      case "code":
        out.push(b.code);
        break;
      case "kv":
        b.pairs.forEach((p) => out.push(`${p.key}: ${p.value}`));
        break;
      case "table":
        b.rows.forEach((r) => out.push(r.join("\t")));
        break;
    }
    out.push("");
  }
  return out.join("\n").trim() + "\n";
}

/** Map rich NoteBlocks down to the tested DocBlock engine for PDF/DOCX export. */
export function toDocBlocks(blocks: NoteBlock[]): DocBlock[] {
  const out: DocBlock[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "heading":
        out.push({ type: "heading", level: b.level, text: b.text });
        break;
      case "paragraph":
        out.push({ type: "paragraph", text: b.text });
        break;
      case "list":
        out.push({
          type: "list",
          items: b.ordered ? b.items.map((it, idx) => `${idx + 1}. ${it}`) : b.items,
        });
        break;
      case "checklist":
        out.push({
          type: "list",
          items: b.items.map((it) => `${it.checked ? "☑" : "☐"} ${it.text}`),
        });
        break;
      case "quote":
        out.push({ type: "paragraph", text: "“" + b.text + "”" });
        break;
      case "code":
        // Preserve each code line as its own paragraph so newlines survive.
        for (const ln of b.code.split("\n")) out.push({ type: "paragraph", text: ln || " " });
        break;
      case "kv":
        out.push({ type: "table", rows: b.pairs.map((p) => [p.key, p.value]) });
        break;
      case "table":
        out.push({ type: "table", rows: b.rows });
        break;
    }
  }
  return out;
}

/** Pull every task across the note as a flat checklist (for "to checklist"). */
export function extractTasks(blocks: NoteBlock[]): string[] {
  const tasks: string[] = [];
  for (const b of blocks) {
    if (b.type === "checklist") b.items.forEach((it) => tasks.push(it.text));
    if (b.type === "list") b.items.forEach((it) => isActionLine(it) && tasks.push(it));
  }
  return tasks;
}
