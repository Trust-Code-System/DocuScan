/**
 * White-label branding config.
 *
 * Env-driven so a deployment can be re-skinned without code changes (name,
 * accent color, tagline, logo letter). Defaults to "DocuScan". NEXT_PUBLIC_* so
 * the values reach the browser; they're inlined at build time (one brand per
 * build/deploy — the white-label model). Pairs with the per-user branding
 * toggle in lib/branding.ts (the "Created with…" credit).
 */

export const BRAND = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME || "DocuScan",
  /** First word + rest, for the two-tone wordmark (e.g. "Docu" + "Scan"). */
  tagline:
    process.env.NEXT_PUBLIC_BRAND_TAGLINE ||
    "Scan, edit, sign & share PDFs in seconds",
  /** Single letter shown in the logo badge. */
  logoLetter: (process.env.NEXT_PUBLIC_BRAND_NAME || "DocuScan").charAt(0).toUpperCase(),
  /** Whether this is the default DocuScan brand (controls "Created with" credit). */
  isDefault: !process.env.NEXT_PUBLIC_BRAND_NAME,
};

/** Split the brand name into two tone-able halves for the wordmark. */
export function brandParts(): { head: string; tail: string } {
  const name = BRAND.name;
  // Default DocuScan splits as Docu|Scan; otherwise split at the midpoint.
  if (name === "DocuScan") return { head: "Docu", tail: "Scan" };
  const mid = Math.ceil(name.length / 2);
  return { head: name.slice(0, mid), tail: name.slice(mid) };
}
