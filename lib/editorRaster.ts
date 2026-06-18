"use client";

/**
 * Secure-redaction rasterizer (browser only).
 *
 * A black rectangle drawn over text (lib/editor.ts "visual cover") does NOT
 * remove the underlying text — it stays selectable/extractable. For TRUE
 * redaction we render the whole page to a canvas, paint the black boxes onto
 * the pixels, and hand the flattened image back to exportEditedPdf so that page
 * is rebuilt from the image — the original text is genuinely gone.
 *
 * This is the trade-off the UI explains: secure redact flattens the affected
 * page to an image (other selectable text on that page is lost too).
 */

import * as pdfjs from "pdfjs-dist";
import type { RectObj, RasterPage } from "@/lib/editor";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

/**
 * Render page `pageIndex` to a flattened PNG with the given redaction rects
 * (top-left fractional coords) painted solid black. `scale` trades size for
 * sharpness — 2 keeps text legible without exploding the file.
 */
export async function rasterizeRedactedPage(
  buf: ArrayBuffer,
  pageIndex: number,
  redactions: RectObj[],
  scale = 2,
): Promise<RasterPage> {
  const doc = await pdfjs.getDocument({ data: buf.slice(0) }).promise;
  try {
    const page = await doc.getPage(pageIndex + 1);
    const base = page.getViewport({ scale: 1, rotation: 0 });
    const viewport = page.getViewport({ scale, rotation: 0 });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported in this browser.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;

    ctx.fillStyle = "#000000";
    for (const r of redactions) {
      ctx.fillRect(
        r.fracX * canvas.width,
        r.fracY * canvas.height,
        r.fracW * canvas.width,
        r.fracH * canvas.height,
      );
    }

    const dataUrl = canvas.toDataURL("image/png");
    page.cleanup();
    return { dataUrl, wPts: base.width, hPts: base.height };
  } finally {
    await doc.destroy();
  }
}
