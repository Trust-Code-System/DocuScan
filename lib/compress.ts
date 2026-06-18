"use client";

import { PDFDocument } from "@cantoo/pdf-lib";
import * as pdfjs from "pdfjs-dist";

// Point pdf.js at its worker. Bundled by webpack/Next via import.meta.url.
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export type CompressLevel = "high" | "balanced" | "low";

// scale = render resolution multiplier; quality = JPEG quality.
const PRESETS: Record<CompressLevel, { scale: number; quality: number }> = {
  high: { scale: 1.0, quality: 0.4 }, // smallest file
  balanced: { scale: 1.3, quality: 0.6 },
  low: { scale: 1.7, quality: 0.78 }, // best quality
};

/**
 * Compress a PDF by rasterizing each page with pdf.js and rebuilding it with
 * re-encoded JPEGs. This reliably shrinks image-heavy / scanned PDFs. Caveat:
 * the output is image-based, so any selectable text is flattened (re-run OCR
 * later to make it searchable).
 */
export async function compressPdf(
  input: ArrayBuffer,
  level: CompressLevel,
  onProgress?: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const { scale, quality } = PRESETS[level];

  // Clone the buffer for pdf.js (it transfers/detaches the one it's given).
  const doc = await pdfjs.getDocument({ data: input.slice(0) }).promise;
  const out = await PDFDocument.create();
  const total = doc.numPages;

  for (let i = 1; i <= total; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported in this browser.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;

    const blob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Failed to encode page."))),
        "image/jpeg",
        quality,
      ),
    );
    const jpg = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
    const p = out.addPage([canvas.width, canvas.height]);
    p.drawImage(jpg, { x: 0, y: 0, width: canvas.width, height: canvas.height });

    page.cleanup();
    onProgress?.(i, total);
  }

  await doc.destroy();
  return out.save();
}
