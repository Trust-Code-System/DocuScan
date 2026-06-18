/**
 * Print Ready PDF — prepare a PDF for the print shop.
 *
 * Two paths:
 *   relayoutPdf()  — pure @cantoo/pdf-lib: normalize page size (A4 / Letter /
 *                    keep), add even margins, add page numbers. DOM-free and
 *                    Node-tested (scripts/test-printready.mjs).
 *   grayscalePdf() — browser-only: rasterize each page with pdf.js applying a
 *                    grayscale filter, then rebuild (for true B&W print output).
 *                    pdf.js is imported lazily inside the function so this module
 *                    stays importable from Node for the pure-logic tests.
 *
 * prepareForPrint() runs grayscale first (if requested) then the re-layout, so
 * the size/margin/number pass always shapes the final document.
 */

import { PDFDocument, StandardFonts, rgb } from "@cantoo/pdf-lib";

export type PageSize = "keep" | "a4" | "letter";

export interface PrintOptions {
  pageSize: PageSize;
  margin: number; // points (1/72 inch); 36 ≈ 0.5 inch
  grayscale: boolean;
  pageNumbers: boolean;
}

export const A4: [number, number] = [595.28, 841.89];
export const LETTER: [number, number] = [612, 792];

/** Target [width,height] for a page, honoring orientation when keeping size. */
export function targetDimensions(
  size: PageSize,
  srcW: number,
  srcH: number,
): [number, number] {
  if (size === "keep") return [srcW, srcH];
  const base = size === "letter" ? LETTER : A4;
  // Preserve landscape orientation of the source page.
  return srcW > srcH ? [base[1], base[0]] : [base[0], base[1]];
}

/**
 * Fit a source page of (srcW × srcH) into a (pageW × pageH) target with an even
 * margin, centered. Returns the uniform scale and the bottom-left offset.
 */
export function fitWithMargin(
  srcW: number,
  srcH: number,
  pageW: number,
  pageH: number,
  margin: number,
): { scale: number; x: number; y: number; w: number; h: number } {
  const availW = Math.max(1, pageW - margin * 2);
  const availH = Math.max(1, pageH - margin * 2);
  const scale = Math.min(availW / srcW, availH / srcH, 1);
  const w = srcW * scale;
  const h = srcH * scale;
  return { scale, w, h, x: (pageW - w) / 2, y: (pageH - h) / 2 };
}

/**
 * Re-layout a PDF onto normalized pages with margins and optional page numbers.
 * Vector content is preserved (pages are embedded, not rasterized).
 */
export async function relayoutPdf(
  input: ArrayBuffer | Uint8Array,
  opts: Pick<PrintOptions, "pageSize" | "margin" | "pageNumbers">,
): Promise<Uint8Array> {
  const src = await PDFDocument.load(input);
  const out = await PDFDocument.create();
  const font = opts.pageNumbers ? await out.embedFont(StandardFonts.Helvetica) : null;

  const srcPages = src.getPages();
  const total = srcPages.length;

  for (let i = 0; i < total; i++) {
    const srcW = srcPages[i].getWidth();
    const srcH = srcPages[i].getHeight();
    const [pw, ph] = targetDimensions(opts.pageSize, srcW, srcH);
    const page = out.addPage([pw, ph]);

    // Embed the source page as vector content; blank pages (no /Contents) can't
    // be embedded, so they just become a correctly-sized empty page.
    try {
      const ep = await out.embedPage(srcPages[i]);
      const fit = fitWithMargin(srcW, srcH, pw, ph, opts.margin);
      page.drawPage(ep, { x: fit.x, y: fit.y, xScale: fit.scale, yScale: fit.scale });
    } catch {
      /* blank/uncontented page — leave it empty at the target size */
    }

    if (opts.pageNumbers && font) {
      const label = `${i + 1} / ${total}`;
      const size = 9;
      const tw = font.widthOfTextAtSize(label, size);
      page.drawText(label, {
        x: (pw - tw) / 2,
        y: Math.max(12, opts.margin / 2),
        size,
        font,
        color: rgb(0.4, 0.4, 0.4),
      });
    }
  }

  return out.save();
}

/**
 * Browser-only: rasterize every page to a grayscale JPEG and rebuild the PDF.
 * Needed because converting vector colour to true B&W requires rendering.
 */
export async function grayscalePdf(
  input: ArrayBuffer,
  onProgress?: (done: number, total: number) => void,
): Promise<Uint8Array> {
  if (typeof document === "undefined") {
    throw new Error("Grayscale conversion needs a browser.");
  }
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const doc = await pdfjs.getDocument({ data: input.slice(0) }).promise;
  const out = await PDFDocument.create();
  const total = doc.numPages;

  for (let i = 1; i <= total; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1.4 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported in this browser.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;

    // Desaturate in place.
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    for (let p = 0; p < d.length; p += 4) {
      const g = Math.round(0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2]);
      d[p] = d[p + 1] = d[p + 2] = g;
    }
    ctx.putImageData(img, 0, 0);

    const blob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Encode failed."))), "image/jpeg", 0.82),
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

/** Full print-prep pipeline. */
export async function prepareForPrint(
  input: ArrayBuffer,
  opts: PrintOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<Uint8Array> {
  let bytes: ArrayBuffer | Uint8Array = input;
  if (opts.grayscale) {
    bytes = await grayscalePdf(input, onProgress);
  }
  // relayout expects ArrayBuffer | Uint8Array; pass through.
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return relayoutPdf(buf, opts);
}
