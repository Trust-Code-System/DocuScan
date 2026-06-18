/**
 * Node test for lib/smartNotes.ts — the Smart Notes auto-formatter.
 * Run: node --experimental-strip-types scripts/test-smartnotes.mjs
 */
import assert from "node:assert";
import {
  formatNotes,
  detectLanguage,
  blocksToMarkdown,
  blocksToPlainText,
  toDocBlocks,
} from "../lib/smartNotes.ts";

let passed = 0;
const ok = (n) => {
  passed++;
  console.log("  ✓ " + n);
};
const types = (bs) => bs.map((b) => b.type);

// --- headings ---
{
  const bs = formatNotes("# Title\n\nSome body text here that is longer.");
  assert.strictEqual(bs[0].type, "heading");
  assert.strictEqual(bs[0].level, 1);
  assert.strictEqual(bs[0].text, "Title");
  ok("markdown heading parsed");

  const sub = formatNotes("Project Details:\nmore text");
  assert.strictEqual(sub[0].type, "heading");
  assert.strictEqual(sub[0].level, 3, "colon line → subheading");
  ok("colon line → subheading (H3)");

  const heur = formatNotes("Project Kickoff Notes\nThis is a much longer explanatory paragraph.");
  assert.strictEqual(heur[0].type, "heading", "title-ish line → heading");
  ok("heuristic heading detected");
}

// --- code detection ---
{
  const fenced = formatNotes("```js\nconst x = 1;\n```");
  assert.strictEqual(fenced[0].type, "code");
  assert.strictEqual(fenced[0].lang, "js");
  assert.strictEqual(fenced[0].code, "const x = 1;");
  ok("fenced code block parsed");

  const heur = formatNotes("function add(a, b) {\n  return a + b;\n}");
  assert.strictEqual(heur[0].type, "code", "heuristic code run detected");
  ok("heuristic code block detected");

  assert.strictEqual(detectLanguage('{ "a": 1 }'), "json");
  assert.strictEqual(detectLanguage("SELECT * FROM users WHERE id = 1"), "sql");
  assert.strictEqual(detectLanguage("def foo():\n    print(1)"), "python");
  assert.strictEqual(detectLanguage("<div class='x'>hi</div>"), "html");
  ok("language detection (json/sql/python/html)");
}

// --- lists & checklists ---
{
  const bul = formatNotes("- one\n- two\n- three");
  assert.strictEqual(bul[0].type, "list");
  assert.strictEqual(bul[0].ordered, false);
  assert.deepStrictEqual(bul[0].items, ["one", "two", "three"]);
  ok("bullet list parsed");

  const num = formatNotes("1. first\n2. second");
  assert.strictEqual(num[0].type, "list");
  assert.strictEqual(num[0].ordered, true);
  ok("numbered list parsed");

  const chk = formatNotes("- [ ] todo one\n- [x] done two");
  assert.strictEqual(chk[0].type, "checklist");
  assert.strictEqual(chk[0].items[0].checked, false);
  assert.strictEqual(chk[0].items[1].checked, true);
  ok("checklist with [ ]/[x] parsed");

  const action = formatNotes("call the vendor\nsend the invoice");
  assert.strictEqual(action[0].type, "checklist", "action-word lines → checklist");
  ok("action-word lines → checklist");
}

// --- quote, table, key:value ---
{
  const q = formatNotes("> remember this");
  assert.strictEqual(q[0].type, "quote");
  assert.strictEqual(q[0].text, "remember this");
  ok("blockquote parsed");

  const tbl = formatNotes("| Name | Amount |\n| --- | --- |\n| Alice | 100 |");
  assert.strictEqual(tbl[0].type, "table");
  assert.deepStrictEqual(tbl[0].rows[0], ["Name", "Amount"]);
  assert.deepStrictEqual(tbl[0].rows[1], ["Alice", "100"]);
  ok("markdown table parsed (separator dropped)");

  const kv = formatNotes("Name: Atlas\nOwner: Priya\nDate: 2026-09-01");
  assert.strictEqual(kv[0].type, "kv");
  assert.strictEqual(kv[0].pairs.length, 3);
  assert.strictEqual(kv[0].pairs[0].key, "Name");
  ok("key:value run grouped");
}

// --- serialization & export mapping ---
{
  const bs = formatNotes("# T\n\n- a\n- b\n\n> q");
  const md = blocksToMarkdown(bs);
  assert.ok(md.includes("# T") && md.includes("- a") && md.includes("> q"), "markdown round-trips");
  const txt = blocksToPlainText(bs);
  assert.ok(txt.includes("• a"), "plain text bullets");
  const doc = toDocBlocks(formatNotes("```js\nx\n```\n- [ ] do it"));
  assert.ok(doc.every((b) => ["heading", "paragraph", "list", "table"].includes(b.type)),
    "toDocBlocks emits only engine-supported block types");
  ok("serialization + DocBlock mapping");
}

console.log(`\n${passed} checks passed.`);
