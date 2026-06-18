"use client";

/**
 * Extract plain text from a PDF in the browser (pdf.js getTextContent).
 *
 * Used by the AI document assistant so only extracted *text* is sent to the
 * server — the PDF itself never leaves the device. Works for text-based PDFs;
 * for scans (image-only) run the OCR tool first to get a text layer.
 */

import * as pdfjs from "pdfjs-dist";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export async function extractPdfText(buf: ArrayBuffer): Promise<string> {
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const line = content.items
      .map((it) => ("str" in it ? it.str : ""))
      .join(" ");
    parts.push(line);
  }
  await pdf.destroy();
  return parts.join("\n").replace(/\s+\n/g, "\n").trim();
}
