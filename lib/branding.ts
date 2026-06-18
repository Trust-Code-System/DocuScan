/**
 * Optional "Created with DocuScan" branding.
 *
 * A free-tier credit that users can toggle off (and which paid tiers will have
 * off by default once accounts exist). Persisted per-device in localStorage so
 * the choice sticks. Today this controls the credit shown on the result card;
 * the same flag is the hook for stamping a footer onto exported PDFs later.
 */

const KEY = "ds-branding";
export const BRANDING_EVENT = "ds-branding-change";

/** Defaults ON for guests (free tier shows the credit). */
export function brandingEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(KEY) !== "off";
}

export function setBranding(on: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, on ? "on" : "off");
  window.dispatchEvent(new CustomEvent(BRANDING_EVENT, { detail: on }));
}
