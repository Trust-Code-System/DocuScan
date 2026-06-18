"use client";

import { PDFDocument } from "@cantoo/pdf-lib";
import * as pdfjs from "pdfjs-dist";
import { createWorker } from "tesseract.js";

// Point pdf.js at its worker (same setup as lib/compress.ts).
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

/**
 * Tesseract language codes we expose in the UI. Each one is downloaded on
 * demand (~2-15MB of traineddata) from the CDN on first use, then cached by
 * the browser. Combine with "+" for multi-language docs (e.g. "eng+fra").
 */
export const OCR_LANGS: { code: string; label: string }[] = [
  { code: "eng", label: "English" },
  { code: "fra", label: "French" },
  { code: "spa", label: "Spanish" },
  { code: "deu", label: "German" },
  { code: "por", label: "Portuguese" },
  { code: "ita", label: "Italian" },
  { code: "ara", label: "Arabic" },
  { code: "chi_sim", label: "Chinese (Simplified)" },
];

export type OcrProgress = {
  /** 1-based page currently being processed. */
  page: number;
  total: number;
  /** Tesseract status, e.g. "recognizing text" or "loading language traineddata". */
  status: string;
  /** 0..1 progress for the current status. */
  fraction: number;
};

export type OcrResult = { bytes: Uint8Array; text: string };

/**
 * Run OCR on a single image (or any blob the browser can decode as an image)
 * and return the recognized text. Used by the universal text extractor so the
 * AI/reading tools can accept photos and scans, not just PDFs.
 */
export async function ocrImage(
  image: Blob,
  lang = "eng",
  onProgress?: (fraction: number, status: string) => void,
): Promise<string> {
  const worker = await createWorker(lang, 1, {
    logger: (m: { status?: string; progress?: number }) => {
      if (m.status) onProgress?.(typeof m.progress === "number" ? m.progress : 0, m.status);
    },
  });
  try {
    const { data } = await worker.recognize(image);
    return (data.text || "").trim();
  } finally {
    await worker.terminate();
  }
}

// Higher render resolution = better OCR accuracy, at the cost of speed/memory.
// ~2x is a good balance for typical scanned documents.
const RENDER_SCALE = 2.0;

/**
 * Make a PDF searchable: rasterize each page with pdf.js, run Tesseract on the
 * image, and use Tesseract's built-in PDF renderer to emit a page with an
 * invisible, selectable text layer behind the image. The per-page PDFs are then
 * stitched into one document with pdf-lib.
 *
 * Runs entirely in the browser (privacy-first). The first run downloads the
 * Tesseract core + language data from the CDN; subsequent runs are cached.
 */
export async function ocrPdf(
  input: ArrayBuffer,
  lang: string,
  onProgress?: (p: OcrProgress) => void,
): Promise<OcrResult> {
  // Clone the buffer for pdf.js (it detaches the one it's given).
  const doc = await pdfjs.getDocument({ data: input.slice(0) }).promise;
  const total = doc.numPages;

  let currentPage = 1;
  const worker = await createWorker(lang, 1, {
    logger: (m: { status?: string; progress?: number }) => {
      if (m.status) {
        onProgress?.({
          page: currentPage,
          total,
          status: m.status,
          fraction: typeof m.progress === "number" ? m.progress : 0,
        });
      }
    },
  });

  try {
    const out = await PDFDocument.create();
    let fullText = "";

    for (let i = 1; i <= total; i++) {
      currentPage = i;
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: RENDER_SCALE });

      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported in this browser.");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: ctx, viewport }).promise;

      const { data } = await worker.recognize(canvas, {}, { pdf: true, text: true });
      fullText += (data.text || "").trim() + "\n\n";

      if (!data.pdf) throw new Error("OCR did not return a PDF for this page.");
      const pagePdf = await PDFDocument.load(Uint8Array.from(data.pdf));
      const [copied] = await out.copyPages(pagePdf, [0]);
      out.addPage(copied);

      page.cleanup();
    }

    const bytes = await out.save();
    return { bytes, text: fullText.trim() };
  } finally {
    await worker.terminate();
    await doc.destroy();
  }
}
