/**
 * Node test for lib/docExport.ts — markdown round-trip + PDF/DOCX builders.
 * Run: node --experimental-strip-types scripts/test-docexport.mjs
 */
import assert from "node:assert";
import { PDFDocument } from "@cantoo/pdf-lib";
import {
  blocksToMarkdown,
  markdownToBlocks,
  blocksToPdf,
  blocksToDocxBlob,
} from "../lib/docExport.ts";

let passed = 0;
const ok = (n) => {
  passed++;
  console.log("  ✓ " + n);
};

const blocks = [
  { type: "heading", level: 1, text: "Quarterly Report" },
  { type: "paragraph", text: "This is the summary paragraph with several words." },
  { type: "heading", level: 2, text: "Highlights" },
  { type: "list", items: ["First point", "Second point", "Third point"] },
  { type: "table", rows: [["Name", "Amount"], ["Alice", "100"], ["Bob", "200"]] },
];

// --- markdown round-trip ---
{
  const md = blocksToMarkdown(blocks);
  assert.ok(md.includes("# Quarterly Report"), "h1 rendered");
  assert.ok(md.includes("## Highlights"), "h2 rendered");
  assert.ok(md.includes("- First point"), "list rendered");
  assert.ok(md.includes("| Name | Amount |"), "table header rendered");
  const round = markdownToBlocks(md);
  const types = round.map((b) => b.type);
  assert.deepStrictEqual(types, ["heading", "paragraph", "heading", "list", "table"], "block types round-trip");
  assert.strictEqual(round[0].level, 1, "h1 level preserved");
  assert.deepStrictEqual(round[3].items, ["First point", "Second point", "Third point"], "list items preserved");
  assert.deepStrictEqual(round[4].rows[0], ["Name", "Amount"], "table header preserved (separator dropped)");
  assert.strictEqual(round[4].rows.length, 3, "table has 3 data rows, no separator row");
  ok("blocks ⇄ markdown round-trips (headings, paragraph, list, table)");
}

// --- blocksToPdf ---
{
  const bytes = await blocksToPdf(blocks);
  const doc = await PDFDocument.load(bytes);
  assert.ok(doc.getPageCount() >= 1, "produces at least one page");
  assert.deepStrictEqual(
    [Math.round(doc.getPage(0).getWidth()), Math.round(doc.getPage(0).getHeight())],
    [595, 842],
    "A4 page size",
  );
  ok("blocksToPdf renders a valid A4 PDF");
}

// --- pagination: many blocks span multiple pages ---
{
  const many = Array.from({ length: 120 }, (_, i) => ({ type: "paragraph", text: `Paragraph number ${i} with enough words to take a line or so of space on the page.` }));
  const bytes = await blocksToPdf(many);
  const doc = await PDFDocument.load(bytes);
  assert.ok(doc.getPageCount() > 1, `paginates (got ${doc.getPageCount()} pages)`);
  ok("blocksToPdf paginates long content across pages");
}

// --- blocksToDocxBlob ---
{
  const blob = await blocksToDocxBlob(blocks);
  assert.ok(blob && blob.size > 0, "produces a non-empty DOCX blob");
  // DOCX is a zip — first bytes are PK
  const head = new Uint8Array(await blob.arrayBuffer()).slice(0, 2);
  assert.deepStrictEqual([...head], [0x50, 0x4b], "DOCX is a zip (PK magic)");
  ok("blocksToDocxBlob produces a valid .docx (zip) file");
}

console.log(`\nAll ${passed} docExport tests passed.`);
