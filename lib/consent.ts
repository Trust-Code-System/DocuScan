/**
 * Cookie / analytics consent state.
 *
 * Stored in localStorage so it persists per-device. We only have one optional
 * category (analytics) today; strictly-necessary cookies (guest counter) don't
 * need consent. <Analytics/> waits for "granted" before loading any third party.
 *
 * A custom event ("ds-consent-change") lets components react without a reload.
 */

export type ConsentValue = "granted" | "denied" | null;

const KEY = "ds-consent";
export const CONSENT_EVENT = "ds-consent-change";

export function getConsent(): ConsentValue {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(KEY);
  return v === "granted" || v === "denied" ? v : null;
}

export function setConsent(value: Exclude<ConsentValue, null>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, value);
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
}

export function hasAnalyticsConsent(): boolean {
  return getConsent() === "granted";
}
