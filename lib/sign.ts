"use client";

import { PDFDocument } from "@cantoo/pdf-lib";
import * as pdfjs from "pdfjs-dist";

// Point pdf.js at its worker (same setup as lib/compress.ts).
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export type PagePreview = {
  dataUrl: string;
  /** Page size in PDF points (rotation ignored — see note below). */
  wPts: number;
  hPts: number;
};

/**
 * Render a single page to a PNG data URL for placement preview.
 *
 * Rotation is forced to 0 so the preview's coordinate space matches pdf-lib's
 * unrotated user space exactly — a signature placed here lands in the same spot
 * pdf-lib draws it. For pages with a non-zero /Rotate this shows the page in its
 * unrotated orientation; the stamped result is still correct because the viewer
 * rotates page content and signature together.
 */
export async function renderPagePreview(
  buf: ArrayBuffer,
  pageIndex: number,
  maxWidth = 900,
): Promise<PagePreview> {
  const doc = await pdfjs.getDocument({ data: buf.slice(0) }).promise;
  try {
    const page = await doc.getPage(pageIndex + 1);
    const base = page.getViewport({ scale: 1, rotation: 0 });
    const scale = Math.min(2, maxWidth / base.width);
    const viewport = page.getViewport({ scale, rotation: 0 });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported in this browser.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;

    const dataUrl = canvas.toDataURL("image/png");
    page.cleanup();
    return { dataUrl, wPts: base.width, hPts: base.height };
  } finally {
    await doc.destroy();
  }
}

/**
 * Where to stamp the signature, as fractions (0..1) of the page measured from
 * the top-left — resolution-independent so it maps cleanly from any preview size.
 */
export type Placement = {
  pageIndex: number;
  fracX: number;
  fracY: number;
  fracW: number;
  fracH: number;
};

/** Compute pdf-lib draw coordinates (origin bottom-left) from a placement. */
export function placementToRect(
  place: Placement,
  pageWidthPts: number,
  pageHeightPts: number,
): { x: number; y: number; width: number; height: number } {
  const width = place.fracW * pageWidthPts;
  const height = place.fracH * pageHeightPts;
  const x = place.fracX * pageWidthPts;
  const y = pageHeightPts - place.fracY * pageHeightPts - height;
  return { x, y, width, height };
}

/** Stamp a PNG signature onto one page of the PDF and return the new bytes. */
export async function signPdf(
  buf: ArrayBuffer,
  pngBytes: Uint8Array,
  place: Placement,
): Promise<Uint8Array> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  } catch {
    throw new Error("This file isn't a readable PDF (it may be encrypted or corrupt).");
  }

  const pages = doc.getPages();
  const page = pages[place.pageIndex];
  if (!page) throw new Error("That page no longer exists in this PDF.");

  const { width: pw, height: ph } = page.getSize();
  const png = await doc.embedPng(pngBytes);
  const rect = placementToRect(place, pw, ph);
  page.drawImage(png, rect);

  return doc.save();
}
