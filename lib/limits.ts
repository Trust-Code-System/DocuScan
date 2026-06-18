/**
 * Shared client + server limits and validation helpers.
 * Guest-tier caps from the roadmap (§13). Keep these in sync with the
 * server-side checks in the API routes.
 */

export const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB
export const MAX_PAGES = 20;
export const MAX_MERGE_FILES = 20;

export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
  "image/bmp",
];

/**
 * Every document kind the app can read or convert. Kept in sync with the
 * detectable kinds in lib/convert.ts (EXT_KIND). Used to validate dropped /
 * picked files on the reading + AI tools (which extract text from any of these)
 * and the PDF tools (which auto-convert any of these to PDF first).
 */
export const ACCEPTED_DOC_EXTS = [
  "pdf",
  "docx",
  "doc",
  "txt",
  "text",
  "md",
  "markdown",
  "html",
  "htm",
  "csv",
  "json",
  "xlsx",
  "xls",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "bmp",
  "heic",
  "heif",
] as const;

/** `accept` attribute value for "drop any document" file inputs. */
export const ACCEPT_ANY_DOC =
  ".pdf,.docx,.doc,.txt,.md,.markdown,.html,.htm,.csv,.json,.xlsx,.xls,.png,.jpg,.jpeg,.webp,.gif,.bmp,.heic,.heif," +
  "application/pdf,image/*,text/*";

function fileExt(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type Validation = { ok: true } | { ok: false; reason: string };

export function validateImageFile(file: File): Validation {
  if (!file.type.startsWith("image/")) {
    return { ok: false, reason: `"${file.name}" isn't an image file.` };
  }
  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      reason: `"${file.name}" is ${formatBytes(file.size)} — over the ${formatBytes(
        MAX_FILE_BYTES,
      )} limit.`,
    };
  }
  return { ok: true };
}

/**
 * Accept any document kind the app can read or convert (see ACCEPTED_DOC_EXTS).
 * Used by tools that take "any document" rather than PDFs only.
 */
export function validateDocFile(file: File): Validation {
  const ext = fileExt(file.name);
  const ok =
    (ACCEPTED_DOC_EXTS as readonly string[]).includes(ext) ||
    file.type === "application/pdf" ||
    file.type.startsWith("image/") ||
    file.type.startsWith("text/");
  if (!ok) {
    return {
      ok: false,
      reason: `"${file.name}" isn't a supported document. Try a PDF, Word, image, text, or spreadsheet file.`,
    };
  }
  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      reason: `"${file.name}" is ${formatBytes(file.size)} — over the ${formatBytes(
        MAX_FILE_BYTES,
      )} limit.`,
    };
  }
  return { ok: true };
}

export function validatePdfFile(file: File): Validation {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    return { ok: false, reason: `"${file.name}" isn't a PDF.` };
  }
  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      reason: `"${file.name}" is ${formatBytes(file.size)} — over the ${formatBytes(
        MAX_FILE_BYTES,
      )} limit.`,
    };
  }
  return { ok: true };
}
