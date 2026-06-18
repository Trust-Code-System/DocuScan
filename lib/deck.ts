/**
 * Slide-deck export for the Document → Presentation tool (§17).
 *
 * Renders a DeckResult (from the AI "slides" task, edited by the user) to:
 *   - PPTX via `pptxgenjs` (dynamic-imported so it stays out of the main bundle)
 *   - PDF  via @cantoo/pdf-lib — one landscape page per slide (no DOM, like
 *     lib/docExport's blocksToPdf), so it's Node-testable.
 *
 * Per-style theming keeps both exports visually consistent with the on-page
 * preview.
 */

import { PDFDocument, StandardFonts, rgb } from "@cantoo/pdf-lib";
import type { DeckResult, SlideStyle } from "@/lib/ai";

type Theme = { bg: [number, number, number]; accent: [number, number, number]; text: [number, number, number] };

// RGB 0-255 (pptxgenjs uses hex; pdf-lib uses 0-1 — converted below).
const THEMES: Record<SlideStyle, Theme> = {
  professional: { bg: [255, 255, 255], accent: [13, 148, 136], text: [17, 24, 39] }, // teal
  academic: { bg: [255, 255, 255], accent: [79, 70, 229], text: [17, 24, 39] }, // indigo
  pitch: { bg: [17, 24, 39], accent: [251, 146, 60], text: [243, 244, 246] }, // dark + orange
  simple: { bg: [255, 255, 255], accent: [71, 85, 105], text: [15, 23, 42] }, // slate
};

const hex = (c: [number, number, number]) =>
  c.map((n) => n.toString(16).padStart(2, "0")).join("");
const norm = (c: [number, number, number]) => rgb(c[0] / 255, c[1] / 255, c[2] / 255);

// ---- PPTX (dynamic-imported pptxgenjs) -------------------------------------
export async function deckToPptxBlob(deck: DeckResult, style: SlideStyle): Promise<Blob> {
  // Dynamic import keeps the browser-only CDN loader out of the (Node-testable)
  // PDF path below and out of any bundle that doesn't export PPTX.
  const { loadPptxGenJS } = await import("@/lib/pptx");
  const PptxGenJS = (await loadPptxGenJS()) as new () => PptxLike;
  const t = THEMES[style];
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in
  const bg = { fill: hex(t.bg) };
  const accent = hex(t.accent);
  const textC = hex(t.text);

  // Title slide
  const title = pptx.addSlide();
  title.background = bg;
  title.addText(deck.title || "Presentation", {
    x: 0.7, y: 2.6, w: 11.9, h: 1.5, fontSize: 40, bold: true, color: textC,
  });
  if (deck.subtitle) {
    title.addText(deck.subtitle, { x: 0.7, y: 4.1, w: 11.9, h: 0.8, fontSize: 20, color: accent });
  }
  title.addShape("rect", { x: 0.7, y: 2.4, w: 2.2, h: 0.08, fill: { color: accent } });

  for (const s of deck.slides) {
    const slide = pptx.addSlide();
    slide.background = bg;
    slide.addText(s.title || "", { x: 0.7, y: 0.5, w: 11.9, h: 1, fontSize: 28, bold: true, color: accent });
    const bullets = (s.bullets || []).filter(Boolean);
    if (bullets.length) {
      slide.addText(
        bullets.map((b) => ({ text: b, options: { bullet: true } })),
        { x: 0.9, y: 1.7, w: 11.5, h: 5, fontSize: 18, color: textC, lineSpacingMultiple: 1.3, valign: "top" },
      );
    }
    if (s.notes) slide.addNotes(s.notes);
  }

  const data = (await pptx.write({ outputType: "blob" })) as Blob;
  return data;
}

// Minimal structural typing for pptxgenjs (avoids a hard type dependency).
interface PptxLike {
  layout: string;
  addSlide(): PptxSlide;
  write(opts: { outputType: string }): Promise<unknown>;
}
interface PptxSlide {
  background: { fill: string };
  addText(text: unknown, opts: Record<string, unknown>): void;
  addShape(shape: string, opts: Record<string, unknown>): void;
  addNotes(notes: string): void;
}

// ---- PDF (one landscape page per slide) ------------------------------------
export async function deckToPdf(deck: DeckResult, style: SlideStyle): Promise<Uint8Array> {
  const t = THEMES[style];
  const PW = 960; // 4:3-ish landscape in points
  const PH = 540;
  const M = 56;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const wrap = (text: string, size: number, maxW: number, f = font): string[] => {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (f.widthOfTextAtSize(test, size) > maxW && line) {
        lines.push(line);
        line = w;
      } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  };

  const addSlide = () => {
    const page = doc.addPage([PW, PH]);
    page.drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: norm(t.bg) });
    return page;
  };

  // Title slide
  {
    const page = addSlide();
    page.drawRectangle({ x: M, y: PH - 200, width: 120, height: 6, color: norm(t.accent) });
    let y = PH - 250;
    for (const ln of wrap(deck.title || "Presentation", 36, PW - M * 2, bold)) {
      page.drawText(ln, { x: M, y, size: 36, font: bold, color: norm(t.text) });
      y -= 44;
    }
    if (deck.subtitle) {
      y -= 8;
      for (const ln of wrap(deck.subtitle, 18, PW - M * 2)) {
        page.drawText(ln, { x: M, y, size: 18, font, color: norm(t.accent) });
        y -= 24;
      }
    }
  }

  for (const s of deck.slides) {
    const page = addSlide();
    let y = PH - M - 20;
    for (const ln of wrap(s.title || "", 26, PW - M * 2, bold)) {
      page.drawText(ln, { x: M, y, size: 26, font: bold, color: norm(t.accent) });
      y -= 34;
    }
    page.drawRectangle({ x: M, y: y + 6, width: PW - M * 2, height: 1.5, color: norm(t.accent) });
    y -= 26;
    for (const b of (s.bullets || []).filter(Boolean)) {
      const lines = wrap(b, 18, PW - M * 2 - 24);
      page.drawText("•", { x: M, y, size: 18, font, color: norm(t.accent) });
      for (let i = 0; i < lines.length; i++) {
        page.drawText(lines[i], { x: M + 24, y, size: 18, font, color: norm(t.text) });
        y -= 26;
      }
      y -= 6;
    }
  }

  return doc.save();
}
