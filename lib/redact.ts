"use client";

/**
 * Text-position extraction + PII-span → box mapping for AI auto-redaction (B2).
 *
 * pdf.js getTextContent items carry a transform; combined with the page's
 * scale-1 viewport transform it gives each run's device-space box (top-left
 * origin). We turn those into top-left fractional boxes (the lib/editor.ts
 * convention) so detected PII spans can be drawn and then truly removed via the
 * secure-rasterize export path.
 *
 * NOTE: glyph-box geometry from pdf.js is approximate (especially run width on
 * unusual fonts) — placement needs real-browser QA. Detection (which strings)
 * comes from the AI; this module only locates them.
 */

import * as pdfjs from "pdfjs-dist";
import type { RectObj } from "@/lib/editor";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

type Item = {
  str: string;
  fracX: number;
  fracY: number;
  fracW: number;
  fracH: number;
};

export type PageItems = { width: number; height: number; items: Item[] };

/** Extract per-page text runs with top-left fractional boxes. */
export async function extractPageItems(buf: ArrayBuffer): Promise<PageItems[]> {
  const doc = await pdfjs.getDocument({ data: buf.slice(0) }).promise;
  try {
    const pages: PageItems[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 1, rotation: 0 });
      const content = await page.getTextContent();
      const items: Item[] = [];
      for (const it of content.items) {
        if (!("str" in it) || !it.str.trim()) continue;
        // device-space transform (top-left origin, y-down)
        const tx = pdfjs.Util.transform(viewport.transform, it.transform);
        const x = tx[4];
        const baselineY = tx[5];
        const h = Math.hypot(tx[2], tx[3]) || it.height || 10;
        const w = it.width || h * it.str.length * 0.5;
        items.push({
          str: it.str,
          fracX: x / viewport.width,
          fracY: (baselineY - h) / viewport.height,
          fracW: w / viewport.width,
          fracH: (h * 1.15) / viewport.height,
        });
      }
      pages.push({ width: viewport.width, height: viewport.height, items });
      page.cleanup();
    }
    return pages;
  } finally {
    await doc.destroy();
  }
}

/**
 * Map detected PII span strings to redaction rects per page. A span may cover
 * several runs and/or lines; we emit one box per line of runs it overlaps.
 */
export function spansToRedactions(
  pages: PageItems[],
  spans: string[],
): Record<number, RectObj[]> {
  const wanted = spans.map((s) => s.trim()).filter((s) => s.length >= 2);
  const out: Record<number, RectObj[]> = {};

  pages.forEach((page, pi) => {
    const rects: RectObj[] = [];
    // Per-run substring match: redact any run that contains, or is contained
    // by, a detected span. Robust to the AI returning a whole field value while
    // pdf.js splits it across runs.
    for (const item of page.items) {
      const s = item.str;
      const hit = wanted.some(
        (span) =>
          s.includes(span) ||
          (span.length > s.length && s.length >= 3 && span.includes(s)),
      );
      if (!hit) continue;
      rects.push({
        type: "rect",
        kind: "redact",
        color: "#000000",
        opacity: 1,
        // pad slightly so descenders/edges are covered
        fracX: Math.max(0, item.fracX - 0.002),
        fracY: Math.max(0, item.fracY - 0.002),
        fracW: Math.min(1, item.fracW + 0.004),
        fracH: Math.min(1, item.fracH + 0.004),
      });
    }
    if (rects.length) out[pi] = rects;
  });

  return out;
}
