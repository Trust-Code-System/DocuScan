"use client";

import * as pdfjs from "pdfjs-dist";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export type EditorPagePreview = {
  dataUrl: string;
  wPts: number;
  hPts: number;
};

export async function renderEditorPagePreview(
  buf: ArrayBuffer,
  pageIndex: number,
  maxWidth = 1000,
): Promise<EditorPagePreview> {
  const doc = await pdfjs.getDocument({ data: buf.slice(0) }).promise;
  try {
    if (pageIndex < 0 || pageIndex >= doc.numPages) {
      throw new Error("That page no longer exists in this PDF.");
    }
    const page = await doc.getPage(pageIndex + 1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2, maxWidth / base.width);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported in this browser.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    page.cleanup();

    return {
      dataUrl: canvas.toDataURL("image/png"),
      wPts: base.width,
      hPts: base.height,
    };
  } finally {
    await doc.destroy();
  }
}
