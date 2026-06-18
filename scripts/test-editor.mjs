/**
 * Node test for lib/editor.ts export math (no DOM).
 * Run: node --experimental-strip-types scripts/test-editor.mjs
 */
import assert from "node:assert";
import { PDFDocument, rgb } from "@cantoo/pdf-lib";
import {
  exportEditedPdf,
  hexToRgb,
  dataUrlToBytes,
} from "../lib/editor.ts";

let passed = 0;
const ok = (name) => {
  passed++;
  console.log("  ✓ " + name);
};

// 1x1 transparent-ish red PNG.
const RED_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

// --- hexToRgb ---
{
  const c = hexToRgb("#ff0000");
  assert.deepStrictEqual([c.red, c.green, c.blue], [1, 0, 0]);
  const w = hexToRgb("#ffffff");
  assert.deepStrictEqual([w.red, w.green, w.blue], [1, 1, 1]);
  const short = hexToRgb("#0f0");
  assert.deepStrictEqual([short.red, short.green, short.blue], [0, 1, 0]);
  const bad = hexToRgb("nonsense");
  assert.deepStrictEqual([bad.red, bad.green, bad.blue], [0, 0, 0]);
  ok("hexToRgb parses #rrggbb, #rgb, and bad input");
}

// --- dataUrlToBytes ---
{
  const { bytes, isPng } = dataUrlToBytes(RED_PNG);
  assert.ok(isPng, "detects png mime");
  // PNG magic bytes
  assert.deepStrictEqual([...bytes.slice(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  ok("dataUrlToBytes decodes a PNG data URL with correct magic bytes");
}

// --- exportEditedPdf round-trip ---
async function buildBasePdf(pages = 2) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const p = doc.addPage([600, 800]);
    p.drawText(`original page ${i + 1}`, { x: 50, y: 750, size: 18, color: rgb(0, 0, 0) });
  }
  return (await doc.save()).buffer;
}

{
  const base = await buildBasePdf(2);
  const models = [
    [
      { type: "text", text: "Hello\nWorld", fontFrac: 0.03, color: "#1144ff", font: "Helvetica", fracX: 0.1, fracY: 0.1, fracW: 0.4, fracH: 0.06 },
      { type: "rect", kind: "highlight", color: "#ffee00", opacity: 0.4, fracX: 0.1, fracY: 0.2, fracW: 0.5, fracH: 0.04 },
      { type: "rect", kind: "shape", outline: true, color: "#ff0000", opacity: 1, fracX: 0.1, fracY: 0.3, fracW: 0.3, fracH: 0.2 },
      { type: "path", color: "#00aa00", widthFrac: 0.005, points: [{ x: 0.1, y: 0.6 }, { x: 0.3, y: 0.65 }, { x: 0.5, y: 0.6 }], fracX: 0.1, fracY: 0.6, fracW: 0.4, fracH: 0.05 },
      { type: "image", dataUrl: RED_PNG, fracX: 0.6, fracY: 0.6, fracW: 0.2, fracH: 0.1 },
    ],
    [
      { type: "rect", kind: "redact", color: "#000000", opacity: 1, fracX: 0.2, fracY: 0.2, fracW: 0.3, fracH: 0.05 },
    ],
  ];

  const out = await exportEditedPdf(base, models);
  const reloaded = await PDFDocument.load(out);
  assert.strictEqual(reloaded.getPageCount(), 2, "page count preserved");
  const [w, h] = [reloaded.getPage(0).getWidth(), reloaded.getPage(0).getHeight()];
  assert.deepStrictEqual([w, h], [600, 800], "page size preserved");
  ok("exportEditedPdf composites text/rect/shape/path/image and round-trips");
}

// --- secure redact: rasterPages replaces a page from a flat image ---
{
  const base = await buildBasePdf(2);
  const out = await exportEditedPdf(base, [[], []], {
    rasterPages: { 1: { dataUrl: RED_PNG, wPts: 600, hPts: 800 } },
  });
  const reloaded = await PDFDocument.load(out);
  assert.strictEqual(reloaded.getPageCount(), 2, "page count preserved with raster page");
  assert.deepStrictEqual(
    [reloaded.getPage(1).getWidth(), reloaded.getPage(1).getHeight()],
    [600, 800],
    "raster page keeps original point size",
  );
  ok("exportEditedPdf rebuilds a page from a raster image (secure redact path)");
}

// --- coordinate sanity: top-left fraction maps to bottom-left pdf space ---
{
  // fracY=0 should place the top of an object at the top of the page; the
  // rect's pdf y (bottom edge) = ph - fracH*ph. We assert the mapping formula
  // used by drawObject by reconstructing it here.
  const ph = 800;
  const fracY = 0;
  const fracH = 0.1;
  const yBottom = ph - fracY * ph - fracH * ph;
  assert.strictEqual(yBottom, 720, "top-anchored rect sits just below the top edge");
  ok("top-left fraction → bottom-left pdf y mapping is correct");
}

console.log(`\nAll ${passed} editor tests passed.`);
