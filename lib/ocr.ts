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
 *
 * This is the full standard Tesseract 4/5 (tessdata_fast) language set that
 * tesseract.js fetches from its default CDN. English is listed first as the
 * default; the rest are sorted alphabetically by label.
 */
export const OCR_LANGS: { code: string; label: string }[] = [
  { code: "eng", label: "English" },
  { code: "afr", label: "Afrikaans" },
  { code: "sqi", label: "Albanian" },
  { code: "amh", label: "Amharic" },
  { code: "grc", label: "Ancient Greek" },
  { code: "ara", label: "Arabic" },
  { code: "hye", label: "Armenian" },
  { code: "asm", label: "Assamese" },
  { code: "aze", label: "Azerbaijani" },
  { code: "aze_cyrl", label: "Azerbaijani (Cyrillic)" },
  { code: "eus", label: "Basque" },
  { code: "bel", label: "Belarusian" },
  { code: "ben", label: "Bengali" },
  { code: "bos", label: "Bosnian" },
  { code: "bre", label: "Breton" },
  { code: "bul", label: "Bulgarian" },
  { code: "mya", label: "Burmese" },
  { code: "cat", label: "Catalan" },
  { code: "ceb", label: "Cebuano" },
  { code: "chr", label: "Cherokee" },
  { code: "chi_sim", label: "Chinese (Simplified)" },
  { code: "chi_tra", label: "Chinese (Traditional)" },
  { code: "cos", label: "Corsican" },
  { code: "hrv", label: "Croatian" },
  { code: "ces", label: "Czech" },
  { code: "dan", label: "Danish" },
  { code: "div", label: "Dhivehi" },
  { code: "nld", label: "Dutch" },
  { code: "dzo", label: "Dzongkha" },
  { code: "enm", label: "English (Middle)" },
  { code: "epo", label: "Esperanto" },
  { code: "est", label: "Estonian" },
  { code: "fao", label: "Faroese" },
  { code: "fil", label: "Filipino" },
  { code: "fin", label: "Finnish" },
  { code: "fra", label: "French" },
  { code: "frm", label: "French (Middle)" },
  { code: "glg", label: "Galician" },
  { code: "kat", label: "Georgian" },
  { code: "kat_old", label: "Georgian (Old)" },
  { code: "deu", label: "German" },
  { code: "frk", label: "German (Fraktur)" },
  { code: "ell", label: "Greek" },
  { code: "guj", label: "Gujarati" },
  { code: "hat", label: "Haitian Creole" },
  { code: "heb", label: "Hebrew" },
  { code: "hin", label: "Hindi" },
  { code: "hun", label: "Hungarian" },
  { code: "isl", label: "Icelandic" },
  { code: "ind", label: "Indonesian" },
  { code: "iku", label: "Inuktitut" },
  { code: "gle", label: "Irish" },
  { code: "ita", label: "Italian" },
  { code: "ita_old", label: "Italian (Old)" },
  { code: "jpn", label: "Japanese" },
  { code: "jav", label: "Javanese" },
  { code: "kan", label: "Kannada" },
  { code: "kaz", label: "Kazakh" },
  { code: "khm", label: "Khmer" },
  { code: "kor", label: "Korean" },
  { code: "kmr", label: "Kurdish (Kurmanji)" },
  { code: "kir", label: "Kyrgyz" },
  { code: "lao", label: "Lao" },
  { code: "lat", label: "Latin" },
  { code: "lav", label: "Latvian" },
  { code: "lit", label: "Lithuanian" },
  { code: "ltz", label: "Luxembourgish" },
  { code: "mkd", label: "Macedonian" },
  { code: "msa", label: "Malay" },
  { code: "mal", label: "Malayalam" },
  { code: "mlt", label: "Maltese" },
  { code: "mri", label: "Maori" },
  { code: "mar", label: "Marathi" },
  { code: "mon", label: "Mongolian" },
  { code: "nep", label: "Nepali" },
  { code: "nor", label: "Norwegian" },
  { code: "oci", label: "Occitan" },
  { code: "ori", label: "Odia" },
  { code: "pus", label: "Pashto" },
  { code: "fas", label: "Persian" },
  { code: "pol", label: "Polish" },
  { code: "por", label: "Portuguese" },
  { code: "pan", label: "Punjabi" },
  { code: "que", label: "Quechua" },
  { code: "ron", label: "Romanian" },
  { code: "rus", label: "Russian" },
  { code: "san", label: "Sanskrit" },
  { code: "gla", label: "Scottish Gaelic" },
  { code: "srp", label: "Serbian" },
  { code: "srp_latn", label: "Serbian (Latin)" },
  { code: "snd", label: "Sindhi" },
  { code: "sin", label: "Sinhala" },
  { code: "slk", label: "Slovak" },
  { code: "slv", label: "Slovenian" },
  { code: "spa", label: "Spanish" },
  { code: "spa_old", label: "Spanish (Old)" },
  { code: "sun", label: "Sundanese" },
  { code: "swa", label: "Swahili" },
  { code: "swe", label: "Swedish" },
  { code: "syr", label: "Syriac" },
  { code: "tgk", label: "Tajik" },
  { code: "tam", label: "Tamil" },
  { code: "tat", label: "Tatar" },
  { code: "tel", label: "Telugu" },
  { code: "tha", label: "Thai" },
  { code: "bod", label: "Tibetan" },
  { code: "tir", label: "Tigrinya" },
  { code: "ton", label: "Tongan" },
  { code: "tur", label: "Turkish" },
  { code: "ukr", label: "Ukrainian" },
  { code: "urd", label: "Urdu" },
  { code: "uig", label: "Uyghur" },
  { code: "uzb", label: "Uzbek" },
  { code: "uzb_cyrl", label: "Uzbek (Cyrillic)" },
  { code: "vie", label: "Vietnamese" },
  { code: "cym", label: "Welsh" },
  { code: "fry", label: "Western Frisian" },
  { code: "yid", label: "Yiddish" },
  { code: "yor", label: "Yoruba" },
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
