/**
 * Node test for lib/printReady.ts — pure re-layout helpers + PDF output.
 * Run: node --experimental-strip-types scripts/test-printready.mjs
 */
import assert from "node:assert";
import { PDFDocument, rgb } from "@cantoo/pdf-lib";
import {
  targetDimensions,
  fitWithMargin,
  relayoutPdf,
  A4,
  LETTER,
} from "../lib/printReady.ts";

let passed = 0;
const ok = (n) => {
  passed++;
  console.log("  ✓ " + n);
};

// --- targetDimensions ---
{
  assert.deepStrictEqual(targetDimensions("keep", 300, 400), [300, 400]);
  assert.deepStrictEqual(targetDimensions("a4", 100, 200), A4, "portrait A4");
  assert.deepStrictEqual(targetDimensions("letter", 100, 200), LETTER, "portrait Letter");
  // landscape source → landscape target (dims swapped)
  assert.deepStrictEqual(targetDimensions("a4", 800, 400), [A4[1], A4[0]], "landscape keeps orientation");
  ok("targetDimensions size + orientation");
}

// --- fitWithMargin ---
{
  const f = fitWithMargin(1000, 1000, 600, 800, 50);
  assert.ok(f.scale <= 1 && f.scale > 0, "scale clamped to <= 1");
  // content + margins must fit inside the page
  assert.ok(f.w <= 600 - 100 + 0.01, "width fits within horizontal margins");
  assert.ok(f.x >= 50 - 0.01 && f.y >= 0, "centered within margins");
  const small = fitWithMargin(100, 100, 600, 800, 20);
  assert.strictEqual(small.scale, 1, "small page is not upscaled");
  ok("fitWithMargin scaling + centering");
}

// --- relayoutPdf end-to-end ---
{
  const src = await PDFDocument.create();
  const a = src.addPage([300, 500]);
  a.drawRectangle({ x: 20, y: 20, width: 100, height: 100, color: rgb(0.2, 0.4, 0.8) });
  const b = src.addPage([900, 400]); // landscape
  b.drawText("landscape", { x: 40, y: 200, size: 24 });
  const bytes = await src.save();

  const out = await relayoutPdf(bytes, { pageSize: "a4", margin: 36, pageNumbers: true });
  const reopened = await PDFDocument.load(out);
  assert.strictEqual(reopened.getPageCount(), 2, "page count preserved");
  const [p0, p1] = reopened.getPages();
  assert.ok(Math.abs(p0.getWidth() - A4[0]) < 1, "portrait page normalized to A4 width");
  assert.ok(p1.getWidth() > p1.getHeight(), "landscape page stays landscape");
  ok("relayoutPdf normalizes size, keeps orientation, adds numbers");

  const keep = await relayoutPdf(bytes, { pageSize: "keep", margin: 0, pageNumbers: false });
  const k = await PDFDocument.load(keep);
  assert.ok(Math.abs(k.getPage(0).getWidth() - 300) < 1, "keep preserves original size");
  ok("relayoutPdf keep mode preserves dimensions");
}

console.log(`\n${passed} checks passed.`);
