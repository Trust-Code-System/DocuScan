/**
 * Lightweight haptic feedback for the mobile/touch experience.
 *
 * Uses the Web Vibration API (navigator.vibrate). It's supported on Android
 * Chrome/Edge and degrades to a silent no-op everywhere it isn't (notably iOS
 * Safari, which has no web vibration API) — so calling these is always safe.
 *
 * Patterns are intentionally short; a haptic "tick" should be felt, not heard.
 * Users can opt out via setHapticsEnabled(false) (persisted on the device).
 */

const STORAGE_KEY = "ds:haptics";
let userEnabled: boolean | null = null;

function isEnabled(): boolean {
  if (userEnabled !== null) return userEnabled;
  try {
    userEnabled = localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    userEnabled = true;
  }
  return userEnabled;
}

/** Turn haptics on/off for this device (persisted). */
export function setHapticsEnabled(on: boolean): void {
  userEnabled = on;
  try {
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    /* ignore storage failures (private mode, etc.) */
  }
}

export function hapticsSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

/** Fire a vibration pattern (ms, or [on, off, on, …]). Safe no-op when unsupported/disabled. */
export function haptic(pattern: number | number[] = 8): void {
  if (!hapticsSupported() || !isEnabled()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* some browsers throw if called outside a user gesture */
  }
}

/** A single soft tick — the default tap response. */
export const hapticLight = (): void => haptic(8);
/** A firmer tap for primary/confirming actions. */
export const hapticMedium = (): void => haptic(16);
/** A short rising double-buzz for successful outcomes (export done, link copied…). */
export const hapticSuccess = (): void => haptic([12, 40, 24]);
/** A heavier double-buzz for errors / rejected input. */
export const hapticError = (): void => haptic([28, 60, 28]);
