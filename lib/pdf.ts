"use client";

import { PDFDocument, StandardFonts, degrees, rgb } from "@cantoo/pdf-lib";

export type ScanPage = {
  id: string;
  file: File;
  /** Object URL for preview; revoke when the page is removed. */
  url: string;
  /** Clockwise rotation in degrees: 0 | 90 | 180 | 270. */
  rotation: number;
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read this image."));
    img.src = url;
  });
}

/**
 * Render one image to a canvas (applying rotation) and return JPEG bytes.
 * JPEG at 0.82 quality gives a solid size/quality trade-off for documents.
 */
async function rasterize(page: ScanPage): Promise<{ bytes: Uint8Array; w: number; h: number }> {
  const img = await loadImage(page.url);
  const rot = ((page.rotation % 360) + 360) % 360;
  const swap = rot === 90 || rot === 270;

  const canvas = document.createElement("canvas");
  canvas.width = swap ? img.naturalHeight : img.naturalWidth;
  canvas.height = swap ? img.naturalWidth : img.naturalHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported in this browser.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to encode image."))),
      "image/jpeg",
      0.82,
    ),
  );
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { bytes, w: canvas.width, h: canvas.height };
}

async function loadPdf(buf: ArrayBuffer): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(buf, { ignoreEncryption: true });
  } catch {
    throw new Error("This file isn't a readable PDF (it may be encrypted or corrupt).");
  }
}

/** Number of pages in a PDF. */
export async function getPageCount(buf: ArrayBuffer): Promise<number> {
  const doc = await loadPdf(buf);
  return doc.getPageCount();
}

/**
 * Parse a 1-based page selection like "1-3, 5, 8-10" into sorted, de-duped
 * 0-based indices, clamped to [0, total). Throws on clearly invalid input.
 */
export function parsePageRange(input: string, total: number): number[] {
  const set = new Set<number>();
  const parts = input.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) throw new Error("Enter at least one page or range.");

  for (const part of parts) {
    const range = part.match(/^(\d+)\s*-\s*(\d+)$/);
    const single = part.match(/^(\d+)$/);
    if (range) {
      let [a, b] = [parseInt(range[1], 10), parseInt(range[2], 10)];
      if (a > b) [a, b] = [b, a];
      for (let n = a; n <= b; n++) if (n >= 1 && n <= total) set.add(n - 1);
    } else if (single) {
      const n = parseInt(single[1], 10);
      if (n >= 1 && n <= total) set.add(n - 1);
    } else {
      throw new Error(`"${part}" isn't a valid page or range.`);
    }
  }

  const indices = [...set].sort((a, b) => a - b);
  if (indices.length === 0) throw new Error(`No pages in range (this PDF has ${total}).`);
  return indices;
}

/**
 * Parse a 1-based page order like "1, 3, 2, 5-7" into 0-based indices.
 * Unlike parsePageRange, this preserves the user's order so it can be used for
 * reordering pages. Pages omitted from the list are deleted from the output.
 */
export function parsePageOrder(input: string, total: number): number[] {
  const indices: number[] = [];
  const seen = new Set<number>();
  const parts = input.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) throw new Error("Enter at least one page.");

  for (const part of parts) {
    const range = part.match(/^(\d+)\s*-\s*(\d+)$/);
    const single = part.match(/^(\d+)$/);
    const add = (n: number) => {
      if (n < 1 || n > total) throw new Error(`Page ${n} is outside this ${total}-page PDF.`);
      const i = n - 1;
      if (seen.has(i)) throw new Error(`Page ${n} is listed more than once.`);
      seen.add(i);
      indices.push(i);
    };

    if (range) {
      let [a, b] = [parseInt(range[1], 10), parseInt(range[2], 10)];
      const step = a <= b ? 1 : -1;
      for (let n = a; step > 0 ? n <= b : n >= b; n += step) add(n);
    } else if (single) {
      add(parseInt(single[1], 10));
    } else {
      throw new Error(`"${part}" isn't a valid page or range.`);
    }
  }

  return indices;
}

/** Build a new PDF containing only the given 0-based page indices, in order. */
export async function extractPages(buf: ArrayBuffer, indices: number[]): Promise<Uint8Array> {
  const src = await loadPdf(buf);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, indices);
  copied.forEach((p) => out.addPage(p));
  return out.save();
}

/** Split a PDF into one single-page PDF per page. */
export async function splitToSinglePages(
  buf: ArrayBuffer,
): Promise<{ name: string; bytes: Uint8Array }[]> {
  const src = await loadPdf(buf);
  const total = src.getPageCount();
  const pad = String(total).length;
  const results: { name: string; bytes: Uint8Array }[] = [];

  for (let i = 0; i < total; i++) {
    const out = await PDFDocument.create();
    const [page] = await out.copyPages(src, [i]);
    out.addPage(page);
    const bytes = await out.save();
    results.push({ name: `page-${String(i + 1).padStart(pad, "0")}.pdf`, bytes });
  }
  return results;
}

/** Merge multiple PDFs (given as ArrayBuffers, in order) into one. */
export async function mergePdfs(files: ArrayBuffer[]): Promise<Uint8Array> {
  if (files.length === 0) throw new Error("Add at least one PDF first.");
  const out = await PDFDocument.create();

  for (const buf of files) {
    const src = await loadPdf(buf);
    const copied = await out.copyPages(src, src.getPageIndices());
    copied.forEach((p) => out.addPage(p));
  }

  return out.save();
}

/**
 * Rotate pages clockwise by `angle` (90 | 180 | 270), added to any existing
 * rotation. If `indices` (0-based) is given, only those pages are rotated;
 * otherwise every page is.
 */
export async function rotatePdf(
  buf: ArrayBuffer,
  angle: number,
  indices?: number[],
): Promise<Uint8Array> {
  const doc = await loadPdf(buf);
  const set = indices ? new Set(indices) : null;
  doc.getPages().forEach((page, i) => {
    if (set && !set.has(i)) return;
    const current = page.getRotation().angle;
    page.setRotation(degrees((current + angle) % 360));
  });
  return doc.save();
}

export type NumberFormat = "plain" | "fraction" | "verbose";
export type NumberPosition = "bottom-center" | "bottom-right" | "top-right";

function formatPageNumber(format: NumberFormat, n: number, total: number): string {
  if (format === "fraction") return `${n} / ${total}`;
  if (format === "verbose") return `Page ${n} of ${total}`;
  return String(n);
}

/** Stamp page numbers onto every page. Skips numbering if the PDF is empty. */
export async function addPageNumbers(
  buf: ArrayBuffer,
  opts: { format: NumberFormat; position: NumberPosition; startAt?: number } = {
    format: "plain",
    position: "bottom-center",
  },
): Promise<Uint8Array> {
  const doc = await loadPdf(buf);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const total = pages.length;
  const start = opts.startAt ?? 1;
  const size = 10;
  const margin = 28;

  pages.forEach((page, i) => {
    const text = formatPageNumber(opts.format, start + i, start + total - 1);
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(text, size);

    let x: number;
    let y: number;
    if (opts.position === "bottom-center") {
      x = width / 2 - textWidth / 2;
      y = margin;
    } else if (opts.position === "bottom-right") {
      x = width - margin - textWidth;
      y = margin;
    } else {
      x = width - margin - textWidth;
      y = height - margin;
    }

    page.drawText(text, { x, y, size, font, color: rgb(0.25, 0.25, 0.25) });
  });

  return doc.save();
}

/**
 * Stamp a semi-transparent diagonal watermark across every page. The text is
 * auto-sized to the page and centered at 45°.
 */
export async function addWatermark(
  buf: ArrayBuffer,
  text: string,
  opacity = 0.18,
): Promise<Uint8Array> {
  const label = text.trim();
  if (!label) throw new Error("Enter some watermark text first.");

  const doc = await loadPdf(buf);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const angle = 45;
  const rad = (angle * Math.PI) / 180;

  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    // Size the text to span most of the page diagonal.
    const diagonal = Math.sqrt(width * width + height * height);
    let size = 60;
    const fit = (diagonal * 0.8) / font.widthOfTextAtSize(label, 1);
    size = Math.max(12, Math.min(160, fit));

    const textWidth = font.widthOfTextAtSize(label, size);
    const x = width / 2 - (textWidth / 2) * Math.cos(rad);
    const y = height / 2 - (textWidth / 2) * Math.sin(rad);

    page.drawText(label, {
      x,
      y,
      size,
      font,
      color: rgb(0.5, 0.5, 0.5),
      opacity,
      rotate: degrees(angle),
    });
  }

  return doc.save();
}

/** Build a multi-page PDF from scan pages, one image per page (page = image size). */
export async function buildPdfFromImages(pages: ScanPage[]): Promise<Uint8Array> {
  if (pages.length === 0) throw new Error("Add at least one page first.");
  const pdf = await PDFDocument.create();

  for (const page of pages) {
    const { bytes, w, h } = await rasterize(page);
    const image = await pdf.embedJpg(bytes);
    const p = pdf.addPage([w, h]);
    p.drawImage(image, { x: 0, y: 0, width: w, height: h });
  }

  return pdf.save();
}
