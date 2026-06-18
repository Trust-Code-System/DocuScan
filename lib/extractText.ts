"use client";

/**
 * Universal in-browser text extractor for the AI / reading tools.
 *
 * Given any document the app supports (PDF, Word, text, Markdown, HTML, CSV,
 * JSON, spreadsheets, images, HEIC photos) this returns its plain text so it can
 * be sent to /api/ai. Everything runs on the device — only the extracted text
 * ever leaves it. Heavy parsers (mammoth, SheetJS, heic2any, Tesseract) are
 * loaded on demand, mirroring lib/convert.ts.
 */

import { detectKind } from "@/lib/convert";
import { extractPdfText } from "@/lib/pdfText";
import { ocrPdf, ocrImage } from "@/lib/ocr";
import { loadMammoth, loadXLSX, loadHeic2any } from "@/lib/loadScript";

export type ExtractProgress = (status: string) => void;

const htmlToText = (html: string): string =>
  new DOMParser().parseFromString(html, "text/html").body.textContent?.trim() || "";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Extract readable text from any supported document. Throws a friendly error if
 * the file can't be read (e.g. an empty scan with no recognizable text).
 */
export async function extractAnyText(file: File, onStatus?: ExtractProgress): Promise<string> {
  const kind = detectKind(file);

  switch (kind) {
    case "pdf": {
      const buf = await file.arrayBuffer();
      onStatus?.("Reading document text…");
      let text = await extractPdfText(buf.slice(0));
      if (text.trim().length < 40) {
        onStatus?.("No text layer — running OCR…");
        const ocr = await ocrPdf(buf.slice(0), "eng", (p) =>
          onStatus?.(`OCR: page ${p.page}/${p.total} — ${p.status}`),
        );
        text = ocr.text;
      }
      return finalize(text);
    }

    case "docx": {
      onStatus?.("Reading Word document…");
      const mammoth = await loadMammoth();
      const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      return finalize(value);
    }

    case "txt":
    case "md":
      onStatus?.("Reading text…");
      return finalize(await file.text());

    case "csv":
    case "json":
      onStatus?.("Reading file…");
      return finalize(await file.text());

    case "html":
      onStatus?.("Reading page text…");
      return finalize(htmlToText(await file.text()));

    case "xlsx": {
      onStatus?.("Reading spreadsheet…");
      const XLSX = await loadXLSX();
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const parts = (wb.SheetNames as string[]).map((sheet) => {
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheet]);
        return (wb.SheetNames as string[]).length > 1 ? `# ${sheet}\n${csv}` : csv;
      });
      return finalize(parts.join("\n\n"));
    }

    case "image": {
      onStatus?.("Running OCR on image…");
      const text = await ocrImage(file, "eng", (_f, status) => onStatus?.(`OCR: ${status}`));
      return finalize(text);
    }

    case "heic": {
      onStatus?.("Decoding photo…");
      const heic2any = await loadHeic2any();
      const res = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
      const jpeg: Blob = Array.isArray(res) ? res[0] : res;
      onStatus?.("Running OCR on photo…");
      const text = await ocrImage(jpeg, "eng", (_f, status) => onStatus?.(`OCR: ${status}`));
      return finalize(text);
    }

    default:
      throw new Error("This file type isn't supported. Try a PDF, Word, image, text, or spreadsheet file.");
  }
}

function finalize(text: string): string {
  const trimmed = (text || "").trim();
  if (trimmed.length < 10) {
    throw new Error("Couldn't read any text from this document.");
  }
  return trimmed;
}
