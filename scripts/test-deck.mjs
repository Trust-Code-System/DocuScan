/**
 * Pure-logic test for the slide-deck PDF export (lib/deck.ts → deckToPdf).
 * Run: node --experimental-strip-types scripts/test-deck.mjs
 *
 * Only the PDF path is exercised here — it's DOM-free (like blocksToPdf). The
 * PPTX path (deckToPptxBlob) needs a browser (CDN-loaded pptxgenjs), so it's
 * verified by the production build + on-device QA, not here.
 */

import { deckToPdf } from "../lib/deck.ts";

const deck = {
  title: "Quarterly Business Review",
  subtitle: "Acme Inc · Q3 2026",
  slides: [
    {
      title: "Overview",
      bullets: [
        "Revenue up 12% quarter over quarter",
        "Costs held flat despite a longer-than-usual hiring cycle and supply headwinds this quarter",
        "Two senior engineers joined the platform team",
      ],
      notes: "Open with the headline number.",
    },
    { title: "Outlook", bullets: ["Expand into the EU market", "Ship v2 of the product"], notes: "" },
  ],
};

let failures = 0;
for (const style of ["professional", "academic", "pitch", "simple"]) {
  const bytes = await deckToPdf(deck, style);
  const validHeader = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
  const ok = validHeader && bytes.length > 1000;
  if (!ok) failures++;
  console.log(`${style.padEnd(13)} ${String(bytes.length).padStart(6)} bytes  ${ok ? "✓" : "✗ FAILED"}`);
}

// An empty deck should still produce a valid (title-only) PDF, not throw.
const empty = await deckToPdf({ title: "", subtitle: "", slides: [] }, "simple");
const emptyOk = empty[0] === 0x25 && empty[1] === 0x50;
console.log(`empty-deck    ${String(empty.length).padStart(6)} bytes  ${emptyOk ? "✓" : "✗ FAILED"}`);
if (!emptyOk) failures++;

if (failures) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll deck PDF checks passed.");
