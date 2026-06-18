"use client";

/**
 * Extract the *positioned* text layer of a PDF page so each run can become an
 * editable box in the overlay editor — i.e. edit the PDF's existing words in
 * place. Coordinates are returned in the same rendered-pixel space as
 * lib/sign.renderPagePreview (same `maxWidth` + scale formula), so the boxes
 * line up exactly with the page background drawn on the fabric canvas.
 *
 * Only works for text-based PDFs. Image-only scans have no text layer (returns
 * an empty array) — those need OCR or the AI "Make editable" path.
 */

import * as pdfjs from "pdfjs-dist";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export interface TextBox {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
}

interface Run {
  text: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
  baseline: number;
  fh: number;
}

function runToBox(r: Run): TextBox {
  return {
    text: r.text.trim(),
    x: r.left,
    y: r.top,
    w: Math.max(4, r.right - r.left),
    h: Math.max(4, r.bottom - r.top),
    fontSize: Math.max(6, r.fh),
  };
}

export async function extractTextBoxes(
  buf: ArrayBuffer,
  pageIndex: number,
  maxWidth = 1000,
): Promise<TextBox[]> {
  const pdf = await pdfjs.getDocument({ data: buf.slice(0) }).promise;
  try {
    const page = await pdf.getPage(pageIndex + 1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2, maxWidth / base.width);
    const viewport = page.getViewport({ scale });
    const content = await page.getTextContent();

    // Map every text item into rendered-pixel space.
    const items: Run[] = [];
    for (const raw of content.items) {
      const it = raw as { str?: string; transform?: number[]; width?: number };
      if (!it.str || !it.transform) continue;
      const tx = pdfjs.Util.transform(viewport.transform, it.transform);
      const fh = Math.hypot(tx[2], tx[3]); // scaled font height in px
      if (fh < 1) continue;
      const left = tx[4];
      const baseline = tx[5];
      const top = baseline - fh;
      const w = (it.width ?? 0) * scale;
      items.push({ text: it.str, left, right: left + w, top, bottom: top + fh, baseline, fh });
    }

    // Reading order: top-to-bottom, then left-to-right.
    items.sort((a, b) => a.top - b.top || a.left - b.left);

    // Merge items into runs: same baseline + small horizontal gap = one box.
    // A large gap (e.g. between table columns) starts a new box so cells stay
    // separately editable at their own positions.
    const boxes: TextBox[] = [];
    let cur: Run | null = null;
    for (const it of items) {
      const sameLine = cur && Math.abs(it.baseline - cur.baseline) <= cur.fh * 0.5;
      const close = cur && it.left - cur.right <= cur.fh * 1.0;
      if (cur && sameLine && close) {
        const gap = it.left - cur.right;
        cur.text += (gap > cur.fh * 0.2 ? " " : "") + it.text;
        cur.right = Math.max(cur.right, it.right);
        cur.top = Math.min(cur.top, it.top);
        cur.bottom = Math.max(cur.bottom, it.bottom);
        cur.fh = Math.max(cur.fh, it.fh);
      } else {
        if (cur) boxes.push(runToBox(cur));
        cur = { ...it };
      }
    }
    if (cur) boxes.push(runToBox(cur));

    return boxes.filter((b) => b.text.length > 0);
  } finally {
    await pdf.destroy();
  }
}
