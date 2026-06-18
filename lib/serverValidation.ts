/**
 * Server-side upload validation.
 *
 * Client-side checks (lib/limits.ts) are for UX only — they can be bypassed by
 * hitting the API directly, so anything that accepts bytes must re-validate on
 * the server. This guards size and verifies the payload is actually a PDF by
 * its magic bytes (Content-Type headers are trivially spoofed).
 */

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB, matches the guest cap

export type ValidationResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/** "%PDF-" — every valid PDF starts with this signature. */
function hasPdfMagic(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 && // F
    bytes[4] === 0x2d //   -
  );
}

/** Validate raw PDF upload bytes. Returns a tagged result with HTTP status. */
export function validatePdfUpload(buf: ArrayBuffer): ValidationResult {
  const len = buf.byteLength;
  if (len === 0) return { ok: false, status: 400, error: "Empty body" };
  if (len > MAX_UPLOAD_BYTES)
    return { ok: false, status: 413, error: "File too large (max 20MB)" };
  if (!hasPdfMagic(new Uint8Array(buf, 0, Math.min(8, len))))
    return { ok: false, status: 415, error: "Not a valid PDF file" };
  return { ok: true };
}

/** Sanitize a user-supplied download filename to a safe basename.pdf. */
export function safePdfName(raw: string | null | undefined): string {
  const base = (raw || "docuscan.pdf").replace(/[^\w.-]/g, "_").slice(0, 100);
  return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
}

// ---- Share-link option validation -----------------------------------------
export const MAX_SHARE_PASSWORD_LEN = 128;
export const MAX_SHARE_DOWNLOADS = 10000;

/**
 * Parse a user-supplied download limit. Returns undefined (= unlimited) for
 * empty/invalid input; otherwise a positive integer clamped to a sane cap.
 */
export function parseMaxDownloads(
  raw: string | null | undefined,
): number | undefined {
  if (raw == null || raw === "") return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return undefined;
  return Math.min(n, MAX_SHARE_DOWNLOADS);
}

/** Clamp a share password to a max length; undefined when empty. */
export function sanitizeSharePassword(
  raw: string | null | undefined,
): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.slice(0, MAX_SHARE_PASSWORD_LEN);
  return trimmed.length ? trimmed : undefined;
}
