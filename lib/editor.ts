/**
 * PDF overlay editor — serializable object model + vector export.
 *
 * The /edit page uses fabric.js as the on-screen editing surface, but the
 * source of truth it persists (per page, for undo/redo + navigation) is the
 * plain JSON model defined here. Keeping the model independent of fabric means
 * the export math is testable in Node with no DOM (it only touches
 * @cantoo/pdf-lib) — see scripts/test-editor.mjs.
 *
 * Coordinate convention (matches lib/sign.ts): every position/size is a
 * FRACTION (0..1) of the page measured from the TOP-LEFT, so it's resolution-
 * independent and maps cleanly from any preview/zoom size. Export flips to
 * pdf-lib's bottom-left origin.
 *
 * Two export modes:
 *   - "visual cover" (default): redactions are drawn as opaque black rects on
 *     top — fast, but the underlying text is NOT removed (still extractable).
 *   - "secure redact": the caller pre-rasterizes affected pages to images in
 *     the browser (lib/editorRaster.ts) and passes them as `rasterPages`; those
 *     pages are rebuilt from the flattened image so the original text is gone.
 */

import {
  PDFDocument,
  PDFTextField,
  PDFCheckBox,
  PDFRadioGroup,
  PDFDropdown,
  PDFOptionList,
  StandardFonts,
  degrees,
  rgb,
  type PDFFont,
} from "@cantoo/pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { fontDef, fontTtfUrl, type FontStd } from "./fonts.ts";

// ---- Object model ----------------------------------------------------------

export interface BaseObj {
  /** Top-left corner + size, as fractions (0..1) of the page. */
  fracX: number;
  fracY: number;
  fracW: number;
  fracH: number;
  /** Clockwise rotation in screen degrees (optional). */
  angle?: number;
}

export type EditFont = string;

export interface TextObj extends BaseObj {
  type: "text";
  text: string;
  /** Font size as a fraction of page height (resolution-independent). */
  fontFrac: number;
  color: string; // #rrggbb
  font: EditFont;
  bold?: boolean;
}

export interface RectObj extends BaseObj {
  type: "rect";
  color: string; // #rrggbb
  opacity: number; // 0..1
  /** kind drives intent (and the secure-redact pass keys off "redact"). */
  kind: "highlight" | "whiteout" | "redact" | "shape";
  /** Outline-only (no fill) — used for shape outlines. */
  outline?: boolean;
}

export interface ImageObj extends BaseObj {
  type: "image";
  dataUrl: string; // data:image/png|jpeg;base64,...
}

export interface PathObj extends BaseObj {
  type: "path";
  /** Polyline points as fractions of the page (top-left origin). */
  points: { x: number; y: number }[];
  color: string;
  /** Stroke thickness as a fraction of page width. */
  widthFrac: number;
}

export type EditObj = TextObj | RectObj | ImageObj | PathObj;
export type PageModel = EditObj[];

export type RasterPage = { dataUrl: string; wPts: number; hPts: number };

// ---- helpers ---------------------------------------------------------------

/** Parse "#rrggbb" (or "#rgb") into a pdf-lib rgb() color. Defaults to black. */
export function hexToRgb(hex: string) {
  let h = (hex || "").trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  if (h.length !== 6 || Number.isNaN(n)) return rgb(0, 0, 0);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Decode a data URL to bytes + a PNG/JPEG flag. Works in Node and browser. */
export function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; isPng: boolean } {
  const comma = dataUrl.indexOf(",");
  if (comma === -1) throw new Error("Invalid image data URL.");
  const meta = dataUrl.slice(0, comma);
  const b64 = dataUrl.slice(comma + 1);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, isPng: /image\/png/i.test(meta) };
}

function stdFont(std: FontStd, bold: boolean) {
  if (std === "courier") return bold ? StandardFonts.CourierBold : StandardFonts.Courier;
  if (std === "times") return bold ? StandardFonts.TimesRomanBold : StandardFonts.TimesRoman;
  return bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica;
}

/** Map a free-typed / unregistered family name to a base-14 PDF font. */
function standardFontFor(name: EditFont, bold: boolean) {
  const n = (name || "").toLowerCase();
  if (
    n.includes("courier") ||
    n.includes("mono") ||
    n.includes("consolas") ||
    n.includes("lucida console") ||
    n.includes("monaco")
  ) {
    return stdFont("courier", bold);
  }
  if (
    n.includes("times") ||
    n.includes("serif") ||
    n.includes("georgia") ||
    n.includes("garamond") ||
    n.includes("cambria") ||
    n.includes("palatino") ||
    n.includes("book")
  ) {
    return stdFont("times", bold);
  }
  return stdFont("helvetica", bold);
}

/** Fetch a TTF, falling back to the 400 weight when a 700 isn't published. */
async function fetchFontBytes(src: string, bold: boolean): Promise<Uint8Array> {
  const get = async (b: boolean) => {
    const res = await fetch(fontTtfUrl(src, b));
    if (!res.ok) throw new Error(`font ${src} (${b ? 700 : 400}): ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  };
  if (bold) {
    try {
      return await get(true);
    } catch {
      /* no bold weight — synthesise from regular */
    }
  }
  return get(false);
}

// Approximate fabric's defaults so exported text lands where it's drawn.
const ASCENT = 0.8; // baseline drop from the text top, as a fraction of font size
const LINE_HEIGHT = 1.16; // fabric default line height

// ---- export ----------------------------------------------------------------

/**
 * Composite the per-page object models onto the PDF and return the new bytes.
 *
 * `pages[i]` holds the objects for page i (sparse OK). If `opts.rasterPages[i]`
 * is supplied, that page is rebuilt from the flattened image instead of copying
 * the original (the secure-redaction path) — the original page content, text
 * included, is dropped.
 */
export async function exportEditedPdf(
  buf: ArrayBuffer,
  pages: PageModel[],
  opts: { rasterPages?: Record<number, RasterPage> } = {},
): Promise<Uint8Array> {
  let src: PDFDocument;
  try {
    src = await PDFDocument.load(buf, { ignoreEncryption: true });
  } catch {
    throw new Error("This file isn't a readable PDF (it may be encrypted or corrupt).");
  }

  const out = await PDFDocument.create();
  const fontCache = new Map<string, PDFFont>();
  let fontkitReady = false;
  const getFont = async (name: EditFont, bold: boolean): Promise<PDFFont> => {
    const key = `${name}:${bold}`;
    const cached = fontCache.get(key);
    if (cached) return cached;

    const def = fontDef(name);
    let f: PDFFont | undefined;
    if (def?.src) {
      // Real Google font: fetch the TTF and embed it (subset to keep size down)
      // so the exported PDF matches the on-screen preview exactly.
      try {
        if (!fontkitReady) {
          out.registerFontkit(fontkit);
          fontkitReady = true;
        }
        const bytes = await fetchFontBytes(def.src, bold);
        f = await out.embedFont(bytes, { subset: true });
      } catch {
        f = undefined; // network/parse failure → fall through to base-14
      }
    }
    if (!f) {
      f = await out.embedFont(def ? stdFont(def.std, bold) : standardFontFor(name, bold));
    }
    fontCache.set(key, f);
    return f;
  };

  const n = src.getPageCount();
  const rasterPages = opts.rasterPages ?? {};

  for (let i = 0; i < n; i++) {
    const raster = rasterPages[i];
    let page;
    if (raster) {
      page = out.addPage([raster.wPts, raster.hPts]);
      const { bytes, isPng } = dataUrlToBytes(raster.dataUrl);
      const img = isPng ? await out.embedPng(bytes) : await out.embedJpg(bytes);
      page.drawImage(img, { x: 0, y: 0, width: raster.wPts, height: raster.hPts });
    } else {
      const [copied] = await out.copyPages(src, [i]);
      out.addPage(copied);
      page = copied;
    }

    const model = pages[i];
    if (!model) continue;
    const { width: pw, height: ph } = page.getSize();
    for (const obj of model) await drawObject(page, obj, pw, ph, getFont);
  }

  return out.save();
}

// ---- AcroForm form fields --------------------------------------------------

export type FormFieldInfo = {
  name: string;
  type: "text" | "checkbox" | "radio" | "dropdown" | "other";
  value: string;
  options?: string[];
};

/** List the fillable AcroForm fields in a PDF (empty if none). */
export async function readFormFields(buf: ArrayBuffer): Promise<FormFieldInfo[]> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  } catch {
    return [];
  }
  const fields = doc.getForm().getFields();
  return fields.map((f) => {
    const name = f.getName();
    if (f instanceof PDFTextField) return { name, type: "text", value: f.getText() ?? "" };
    if (f instanceof PDFCheckBox) return { name, type: "checkbox", value: f.isChecked() ? "1" : "" };
    if (f instanceof PDFRadioGroup)
      return { name, type: "radio", value: f.getSelected() ?? "", options: f.getOptions() };
    if (f instanceof PDFDropdown || f instanceof PDFOptionList)
      return {
        name,
        type: "dropdown",
        value: (f.getSelected()?.[0] as string) ?? "",
        options: f.getOptions(),
      };
    return { name, type: "other", value: "" };
  });
}

/**
 * Fill the given field values and flatten the form (so the filled values become
 * static page content that copyPages preserves cleanly in the overlay export).
 */
export async function fillAndFlattenForm(
  buf: ArrayBuffer,
  values: Record<string, string>,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const form = doc.getForm();
  for (const [name, value] of Object.entries(values)) {
    const field = form.getFields().find((f) => f.getName() === name);
    if (!field) continue;
    try {
      if (field instanceof PDFTextField) field.setText(value);
      else if (field instanceof PDFCheckBox) value ? field.check() : field.uncheck();
      else if (field instanceof PDFRadioGroup) {
        if (value) field.select(value);
      } else if (field instanceof PDFDropdown || field instanceof PDFOptionList) {
        if (value) field.select(value);
      }
    } catch {
      // ignore individual field failures (e.g. value not in option list)
    }
  }
  form.flatten();
  return doc.save();
}

type AnyPage = Awaited<ReturnType<PDFDocument["copyPages"]>>[number];

async function drawObject(
  page: AnyPage,
  obj: EditObj,
  pw: number,
  ph: number,
  getFont: (name: EditFont, bold: boolean) => Promise<PDFFont>,
) {
  const rotate = obj.angle ? degrees(-obj.angle) : undefined;

  if (obj.type === "rect") {
    const w = obj.fracW * pw;
    const h = obj.fracH * ph;
    const x = obj.fracX * pw;
    const y = ph - obj.fracY * ph - h;
    const color = hexToRgb(obj.color);
    if (obj.outline) {
      page.drawRectangle({
        x, y, width: w, height: h, rotate,
        borderColor: color,
        borderWidth: Math.max(1, 0.004 * pw),
        opacity: 0,
        borderOpacity: obj.opacity,
      });
    } else {
      page.drawRectangle({ x, y, width: w, height: h, rotate, color, opacity: obj.opacity });
    }
    return;
  }

  if (obj.type === "image") {
    const { bytes, isPng } = dataUrlToBytes(obj.dataUrl);
    const doc = page.doc;
    const img = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    const w = obj.fracW * pw;
    const h = obj.fracH * ph;
    const x = obj.fracX * pw;
    const y = ph - obj.fracY * ph - h;
    page.drawImage(img, { x, y, width: w, height: h, rotate });
    return;
  }

  if (obj.type === "path") {
    const color = hexToRgb(obj.color);
    const thickness = Math.max(0.5, obj.widthFrac * pw);
    const pts = obj.points.map((p) => ({ x: p.x * pw, y: ph - p.y * ph }));
    for (let i = 1; i < pts.length; i++) {
      page.drawLine({ start: pts[i - 1], end: pts[i], thickness, color });
    }
    return;
  }

  // text
  const size = obj.fontFrac * ph;
  const font = await getFont(obj.font, !!obj.bold);
  const color = hexToRgb(obj.color);
  const x = obj.fracX * pw;
  const topY = ph - obj.fracY * ph;
  const lines = obj.text.split("\n");
  lines.forEach((line, idx) => {
    page.drawText(line, {
      x,
      y: topY - size * ASCENT - idx * size * LINE_HEIGHT,
      size,
      font,
      color,
      rotate,
    });
  });
}
