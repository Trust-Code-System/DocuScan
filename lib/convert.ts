"use client";

/**
 * Universal document conversion engine (roadmap §8).
 *
 * Detects a file's source kind and exposes the set of valid target formats,
 * then runs the conversion fully in the browser (the file never leaves the
 * device) wherever feasible. High-fidelity Office conversions are marked
 * `server: true` and are handled by the caller via /api/convert (a LibreOffice/
 * Gotenberg seam) — this module only does the in-browser paths.
 *
 * Heavy/finicky vendor libs (SheetJS, mammoth, heic2any) are CDN-loaded on
 * demand (lib/loadScript.ts); pdf.js + @cantoo/pdf-lib + docx (via docExport)
 * + jszip are already in the stack.
 */

import { PDFDocument } from "@cantoo/pdf-lib";
import * as pdfjs from "pdfjs-dist";
import JSZip from "jszip";
import { blocksToPdf, blocksToDocxBlob, markdownToBlocks } from "@/lib/docExport";
import type { DocBlock } from "@/lib/ai";
import { extractPdfText } from "@/lib/pdfText";
import { loadXLSX, loadMammoth, loadHeic2any } from "@/lib/loadScript";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export type ConvertFile = { name: string; blob: Blob };
export type SourceKind =
  | "pdf"
  | "docx"
  | "xlsx"
  | "pptx"
  | "csv"
  | "json"
  | "txt"
  | "md"
  | "html"
  | "image"
  | "heic";

export type Target = {
  id: string;
  label: string;
  ext: string;
  server?: boolean; // routed to /api/convert
  note?: string;
};

const EXT_KIND: Record<string, SourceKind> = {
  pdf: "pdf",
  docx: "docx",
  doc: "docx",
  xlsx: "xlsx",
  xls: "xlsx",
  pptx: "pptx",
  ppt: "pptx",
  csv: "csv",
  json: "json",
  txt: "txt",
  text: "txt",
  md: "md",
  markdown: "md",
  html: "html",
  htm: "html",
  heic: "heic",
  heif: "heic",
  png: "image",
  jpg: "image",
  jpeg: "image",
  webp: "image",
  gif: "image",
  bmp: "image",
};

export function detectKind(file: File): SourceKind | null {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (EXT_KIND[ext]) return EXT_KIND[ext];
  const m = file.type;
  if (m === "application/pdf") return "pdf";
  if (m.startsWith("image/heic") || m.startsWith("image/heif")) return "heic";
  if (m.startsWith("image/")) return "image";
  if (m === "text/csv") return "csv";
  if (m === "application/json") return "json";
  if (m === "text/html") return "html";
  if (m === "text/markdown") return "md";
  if (m.startsWith("text/")) return "txt";
  return null;
}

// Source kind → valid targets. `-server` ids go through /api/convert.
export const TARGETS: Record<SourceKind, Target[]> = {
  pdf: [
    { id: "png", label: "PNG images (per page)", ext: "png" },
    { id: "jpg", label: "JPG images (per page)", ext: "jpg" },
    { id: "zip-img", label: "ZIP of page images", ext: "zip" },
    { id: "txt", label: "Plain text (.txt)", ext: "txt" },
    { id: "md", label: "Markdown (.md)", ext: "md" },
    { id: "html", label: "HTML (.html)", ext: "html" },
    { id: "docx", label: "Word (.docx) — text", ext: "docx", note: "Text-based; layout simplified" },
    { id: "docx-server", label: "Word (.docx) — high fidelity", ext: "docx", server: true },
  ],
  docx: [
    { id: "pdf", label: "PDF — in browser", ext: "pdf", note: "Layout approximate" },
    { id: "html", label: "HTML (.html)", ext: "html" },
    { id: "txt", label: "Plain text (.txt)", ext: "txt" },
    { id: "pdf-server", label: "PDF — high fidelity", ext: "pdf", server: true },
  ],
  xlsx: [
    { id: "csv", label: "CSV (per sheet)", ext: "csv" },
    { id: "json", label: "JSON", ext: "json" },
    { id: "pdf", label: "PDF (tables)", ext: "pdf" },
  ],
  pptx: [{ id: "pdf-server", label: "PDF", ext: "pdf", server: true, note: "Needs the conversion service" }],
  csv: [
    { id: "xlsx", label: "Excel (.xlsx)", ext: "xlsx" },
    { id: "json", label: "JSON", ext: "json" },
    { id: "pdf", label: "PDF (table)", ext: "pdf" },
  ],
  json: [
    { id: "csv", label: "CSV", ext: "csv" },
    { id: "xlsx", label: "Excel (.xlsx)", ext: "xlsx" },
  ],
  txt: [
    { id: "pdf", label: "PDF", ext: "pdf" },
    { id: "docx", label: "Word (.docx)", ext: "docx" },
    { id: "md", label: "Markdown (.md)", ext: "md" },
  ],
  md: [
    { id: "pdf", label: "PDF", ext: "pdf" },
    { id: "html", label: "HTML (.html)", ext: "html" },
    { id: "docx", label: "Word (.docx)", ext: "docx" },
  ],
  html: [
    { id: "pdf", label: "PDF", ext: "pdf" },
    { id: "txt", label: "Plain text (.txt)", ext: "txt" },
  ],
  image: [
    { id: "png", label: "PNG", ext: "png" },
    { id: "jpg", label: "JPG", ext: "jpg" },
    { id: "webp", label: "WebP", ext: "webp" },
    { id: "pdf", label: "PDF", ext: "pdf" },
  ],
  heic: [
    { id: "jpg", label: "JPG", ext: "jpg" },
    { id: "png", label: "PNG", ext: "png" },
    { id: "pdf", label: "PDF", ext: "pdf" },
  ],
};

export const KIND_LABEL: Record<SourceKind, string> = {
  pdf: "PDF",
  docx: "Word",
  xlsx: "Excel",
  pptx: "PowerPoint",
  csv: "CSV",
  json: "JSON",
  txt: "Text",
  md: "Markdown",
  html: "HTML",
  image: "Image",
  heic: "HEIC photo",
};

// ---- small helpers ---------------------------------------------------------
const stem = (name: string) => name.replace(/\.[^./\\]+$/, "") || "converted";
const pdfBlob = (bytes: Uint8Array) => new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function textToBlocks(text: string): DocBlock[] {
  return text
    .split(/\n{2,}/)
    .map((p) => ({ type: "paragraph" as const, text: p.replace(/\s*\n\s*/g, " ").trim() }))
    .filter((b) => b.text);
}

function blocksToHtml(blocks: DocBlock[]): string {
  const body = blocks
    .map((b) => {
      if (b.type === "heading") {
        const l = Math.min(Math.max(b.level ?? 2, 1), 6);
        return `<h${l}>${escapeHtml(b.text ?? "")}</h${l}>`;
      }
      if (b.type === "list") {
        return `<ul>\n${(b.items ?? []).map((i) => `  <li>${escapeHtml(i)}</li>`).join("\n")}\n</ul>`;
      }
      if (b.type === "table") {
        const rows = (b.rows ?? [])
          .map(
            (r, ri) =>
              `  <tr>${r
                .map((c) => (ri === 0 ? `<th>${escapeHtml(c)}</th>` : `<td>${escapeHtml(c)}</td>`))
                .join("")}</tr>`,
          )
          .join("\n");
        return `<table border="1" cellspacing="0" cellpadding="6">\n${rows}\n</table>`;
      }
      return `<p>${escapeHtml(b.text ?? "")}</p>`;
    })
    .join("\n");
  return `<!doctype html>\n<html>\n<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>\n<body>\n${body}\n</body>\n</html>`;
}

function htmlToBlocks(html: string): DocBlock[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks: DocBlock[] = [];
  const walk = (node: Element) => {
    for (const el of Array.from(node.children)) {
      const tag = el.tagName.toLowerCase();
      if (/^h[1-6]$/.test(tag)) {
        const t = el.textContent?.trim();
        if (t) blocks.push({ type: "heading", level: Number(tag[1]), text: t });
      } else if (tag === "p" || tag === "blockquote") {
        const t = el.textContent?.trim();
        if (t) blocks.push({ type: "paragraph", text: t });
      } else if (tag === "ul" || tag === "ol") {
        const items = Array.from(el.querySelectorAll("li"))
          .map((li) => li.textContent?.trim() || "")
          .filter(Boolean);
        if (items.length) blocks.push({ type: "list", items });
      } else if (tag === "table") {
        const rows = Array.from(el.querySelectorAll("tr")).map((tr) =>
          Array.from(tr.querySelectorAll("th,td")).map((c) => c.textContent?.trim() || ""),
        );
        if (rows.length) blocks.push({ type: "table", rows });
      } else if (el.children.length) {
        walk(el); // descend through wrappers (div, section, article…)
      } else {
        const t = el.textContent?.trim();
        if (t) blocks.push({ type: "paragraph", text: t });
      }
    }
  };
  walk(doc.body);
  if (!blocks.length) {
    const t = doc.body.textContent?.trim();
    if (t) blocks.push({ type: "paragraph", text: t });
  }
  return blocks;
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Image encoding failed."))), mime, quality),
  );
}

async function blobToCanvas(blob: Blob, whiteBg = false): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Could not read this image."));
      i.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported in this browser.");
    if (whiteBg) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function imageBlobToPdf(blob: Blob, name: string): Promise<ConvertFile[]> {
  const canvas = await blobToCanvas(blob, true);
  const png = await canvasToBlob(canvas, "image/png");
  const doc = await PDFDocument.create();
  const embedded = await doc.embedPng(new Uint8Array(await png.arrayBuffer()));
  const page = doc.addPage([canvas.width, canvas.height]);
  page.drawImage(embedded, { x: 0, y: 0, width: canvas.width, height: canvas.height });
  return [{ name: `${name}.pdf`, blob: pdfBlob(await doc.save()) }];
}

// ---- PDF source ------------------------------------------------------------
async function pdfRenderImages(
  buf: ArrayBuffer,
  mime: "image/png" | "image/jpeg",
  ext: string,
  name: string,
  onProgress?: (d: number, t: number) => void,
): Promise<ConvertFile[]> {
  const doc = await pdfjs.getDocument({ data: buf.slice(0) }).promise;
  const out: ConvertFile[] = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported in this browser.");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      const blob = await canvasToBlob(canvas, mime, 0.92);
      out.push({ name: `${name}-page-${String(i).padStart(2, "0")}.${ext}`, blob });
      page.cleanup();
      onProgress?.(i, doc.numPages);
    }
  } finally {
    await doc.destroy();
  }
  return out;
}

async function convertPdf(
  file: File,
  name: string,
  target: string,
  onProgress?: (d: number, t: number) => void,
): Promise<ConvertFile[]> {
  const buf = await file.arrayBuffer();
  if (target === "png") return pdfRenderImages(buf, "image/png", "png", name, onProgress);
  if (target === "jpg") return pdfRenderImages(buf, "image/jpeg", "jpg", name, onProgress);
  if (target === "zip-img") {
    const images = await pdfRenderImages(buf, "image/png", "png", name, onProgress);
    const zip = new JSZip();
    for (const img of images) zip.file(img.name, img.blob);
    const blob = await zip.generateAsync({ type: "blob" });
    return [{ name: `${name}-images.zip`, blob }];
  }
  const text = await extractPdfText(buf.slice(0));
  if (!text.trim()) throw new Error("No selectable text found — run OCR first for scanned PDFs.");
  if (target === "txt") return [{ name: `${name}.txt`, blob: new Blob([text], { type: "text/plain;charset=utf-8" }) }];
  if (target === "md") {
    const md = text
      .split(/\n{2,}/)
      .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
      .filter(Boolean)
      .join("\n\n");
    return [{ name: `${name}.md`, blob: new Blob([md], { type: "text/markdown;charset=utf-8" }) }];
  }
  if (target === "html") {
    const html = blocksToHtml(textToBlocks(text));
    return [{ name: `${name}.html`, blob: new Blob([html], { type: "text/html;charset=utf-8" }) }];
  }
  if (target === "docx") return [{ name: `${name}.docx`, blob: await blocksToDocxBlob(textToBlocks(text)) }];
  throw new Error("Unsupported PDF conversion.");
}

// ---- image / HEIC ----------------------------------------------------------
const IMG_MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

async function convertImage(file: File, name: string, target: string): Promise<ConvertFile[]> {
  if (target === "pdf") return imageBlobToPdf(file, name);
  const mime = IMG_MIME[target];
  if (!mime) throw new Error("Unsupported image conversion.");
  const canvas = await blobToCanvas(file, target === "jpg");
  return [{ name: `${name}.${target}`, blob: await canvasToBlob(canvas, mime, 0.92) }];
}

async function convertHeic(file: File, name: string, target: string): Promise<ConvertFile[]> {
  const heic2any = await loadHeic2any();
  const toType = target === "png" ? "image/png" : "image/jpeg";
  const res = await heic2any({ blob: file, toType, quality: 0.92 });
  const jpeg: Blob = Array.isArray(res) ? res[0] : res;
  if (target === "pdf") return imageBlobToPdf(jpeg, name);
  return [{ name: `${name}.${target === "png" ? "png" : "jpg"}`, blob: jpeg }];
}

// ---- text / markdown / html ------------------------------------------------
async function convertText(text: string, name: string, target: string): Promise<ConvertFile[]> {
  const blocks = textToBlocks(text);
  if (target === "pdf") return [{ name: `${name}.pdf`, blob: pdfBlob(await blocksToPdf(blocks)) }];
  if (target === "docx") return [{ name: `${name}.docx`, blob: await blocksToDocxBlob(blocks) }];
  if (target === "md") return [{ name: `${name}.md`, blob: new Blob([text], { type: "text/markdown;charset=utf-8" }) }];
  throw new Error("Unsupported text conversion.");
}

async function convertMd(text: string, name: string, target: string): Promise<ConvertFile[]> {
  const blocks = markdownToBlocks(text);
  if (target === "pdf") return [{ name: `${name}.pdf`, blob: pdfBlob(await blocksToPdf(blocks)) }];
  if (target === "docx") return [{ name: `${name}.docx`, blob: await blocksToDocxBlob(blocks) }];
  if (target === "html")
    return [{ name: `${name}.html`, blob: new Blob([blocksToHtml(blocks)], { type: "text/html;charset=utf-8" }) }];
  throw new Error("Unsupported Markdown conversion.");
}

async function convertHtml(html: string, name: string, target: string): Promise<ConvertFile[]> {
  if (target === "pdf") return [{ name: `${name}.pdf`, blob: pdfBlob(await blocksToPdf(htmlToBlocks(html))) }];
  if (target === "txt") {
    const text = new DOMParser().parseFromString(html, "text/html").body.textContent?.trim() || "";
    return [{ name: `${name}.txt`, blob: new Blob([text], { type: "text/plain;charset=utf-8" }) }];
  }
  throw new Error("Unsupported HTML conversion.");
}

// ---- spreadsheet / data ----------------------------------------------------
async function convertXlsx(file: File, name: string, target: string): Promise<ConvertFile[]> {
  const XLSX = await loadXLSX();
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  if (target === "csv") {
    const out: ConvertFile[] = [];
    for (const sheet of wb.SheetNames as string[]) {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheet]);
      const sn = (wb.SheetNames as string[]).length > 1 ? `${name}-${sheet}` : name;
      out.push({ name: `${sn}.csv`, blob: new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }) });
    }
    return out;
  }
  if (target === "json") {
    const obj: Record<string, unknown> = {};
    for (const sheet of wb.SheetNames as string[]) obj[sheet] = XLSX.utils.sheet_to_json(wb.Sheets[sheet]);
    const data = (wb.SheetNames as string[]).length === 1 ? obj[(wb.SheetNames as string[])[0]] : obj;
    return [{ name: `${name}.json`, blob: new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }) }];
  }
  if (target === "pdf") {
    const blocks: DocBlock[] = [];
    for (const sheet of wb.SheetNames as string[]) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, blankrows: false }) as unknown[][];
      if ((wb.SheetNames as string[]).length > 1) blocks.push({ type: "heading", level: 2, text: sheet });
      if (rows.length) blocks.push({ type: "table", rows: rows.map((r) => r.map((c) => (c == null ? "" : String(c)))) });
    }
    return [{ name: `${name}.pdf`, blob: pdfBlob(await blocksToPdf(blocks)) }];
  }
  throw new Error("Unsupported spreadsheet conversion.");
}

async function convertCsv(text: string, name: string, target: string): Promise<ConvertFile[]> {
  const XLSX = await loadXLSX();
  const wb = XLSX.read(text, { type: "string" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (target === "xlsx") {
    const bytes = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    return [
      {
        name: `${name}.xlsx`,
        blob: new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      },
    ];
  }
  if (target === "json") {
    const rows = XLSX.utils.sheet_to_json(ws);
    return [{ name: `${name}.json`, blob: new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" }) }];
  }
  if (target === "pdf") {
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false }) as unknown[][];
    const blocks: DocBlock[] = rows.length
      ? [{ type: "table", rows: rows.map((r) => r.map((c) => (c == null ? "" : String(c)))) }]
      : [];
    return [{ name: `${name}.pdf`, blob: pdfBlob(await blocksToPdf(blocks)) }];
  }
  throw new Error("Unsupported CSV conversion.");
}

async function convertJson(text: string, name: string, target: string): Promise<ConvertFile[]> {
  const XLSX = await loadXLSX();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("This file isn't valid JSON.");
  }
  const rows = Array.isArray(data) ? data : [data];
  const ws = XLSX.utils.json_to_sheet(rows as Record<string, unknown>[]);
  if (target === "csv") {
    return [{ name: `${name}.csv`, blob: new Blob(["﻿" + XLSX.utils.sheet_to_csv(ws)], { type: "text/csv;charset=utf-8" }) }];
  }
  if (target === "xlsx") {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const bytes = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    return [
      {
        name: `${name}.xlsx`,
        blob: new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      },
    ];
  }
  throw new Error("Unsupported JSON conversion.");
}

// ---- Word (docx) -----------------------------------------------------------
async function convertDocx(file: File, name: string, target: string): Promise<ConvertFile[]> {
  const mammoth = await loadMammoth();
  const arrayBuffer = await file.arrayBuffer();
  if (target === "txt") {
    const { value } = await mammoth.extractRawText({ arrayBuffer });
    return [{ name: `${name}.txt`, blob: new Blob([value], { type: "text/plain;charset=utf-8" }) }];
  }
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer });
  if (target === "html") {
    const full = `<!doctype html>\n<html><head><meta charset="utf-8"></head><body>\n${html}\n</body></html>`;
    return [{ name: `${name}.html`, blob: new Blob([full], { type: "text/html;charset=utf-8" }) }];
  }
  if (target === "pdf") return [{ name: `${name}.pdf`, blob: pdfBlob(await blocksToPdf(htmlToBlocks(html))) }];
  throw new Error("Unsupported Word conversion.");
}

// ---- dispatcher ------------------------------------------------------------
export async function convert(
  file: File,
  kind: SourceKind,
  target: string,
  onProgress?: (d: number, t: number) => void,
): Promise<ConvertFile[]> {
  const name = stem(file.name);
  switch (kind) {
    case "pdf":
      return convertPdf(file, name, target, onProgress);
    case "image":
      return convertImage(file, name, target);
    case "heic":
      return convertHeic(file, name, target);
    case "txt":
      return convertText(await file.text(), name, target);
    case "md":
      return convertMd(await file.text(), name, target);
    case "html":
      return convertHtml(await file.text(), name, target);
    case "xlsx":
      return convertXlsx(file, name, target);
    case "csv":
      return convertCsv(await file.text(), name, target);
    case "json":
      return convertJson(await file.text(), name, target);
    case "docx":
      return convertDocx(file, name, target);
    default:
      throw new Error("This conversion needs the server-side converter.");
  }
}

export async function zipFiles(files: ConvertFile[], zipName: string): Promise<ConvertFile> {
  const zip = new JSZip();
  for (const f of files) zip.file(f.name, f.blob);
  return { name: zipName, blob: await zip.generateAsync({ type: "blob" }) };
}
