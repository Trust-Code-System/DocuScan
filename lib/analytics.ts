/**
 * Lightweight analytics facade (PostHog).
 *
 * Design goals, consistent with the rest of lib/*:
 *   - **Env-driven + no-op when unset.** With no NEXT_PUBLIC_POSTHOG_KEY the
 *     whole thing is inert — nothing loads, track() does nothing.
 *   - **Zero main-bundle weight.** PostHog is loaded from its CDN at runtime by
 *     <Analytics/> (only after consent), not bundled — keeps First Load JS lean.
 *   - **Consent-gated.** See lib/consent.ts; the loader only runs once the user
 *     accepts analytics cookies.
 *
 * Callers just import { track, Events } and fire events; if PostHog isn't
 * loaded yet the call is silently dropped (acceptable for funnel analytics).
 */

declare global {
  interface Window {
    posthog?: {
      init?: (key: string, opts: Record<string, unknown>) => void;
      capture: (event: string, props?: Record<string, unknown>) => void;
    };
  }
}

/** Canonical event names so the funnel stays consistent across tools. */
export const Events = {
  ToolView: "tool_view",
  ToolRun: "tool_run", // user actually started a task (passed quota check)
  ToolResult: "tool_result", // a result was produced (conversion)
  ToolError: "tool_error",
  ShareCreated: "share_created",
  Download: "download",
  FeedbackSubmitted: "feedback_submitted",
} as const;

export type EventName = (typeof Events)[keyof typeof Events];

export const ANALYTICS_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
export const ANALYTICS_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

/** Is analytics configured at all? (key present) */
export function analyticsEnabled(): boolean {
  return !!ANALYTICS_KEY;
}

/** Fire an event. Safe to call anywhere; no-ops if PostHog isn't loaded. */
export function track(event: EventName, props?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  window.posthog?.capture(event, props);
}

/** Convenience: derive a tool slug from a pathname (e.g. "/compress-pdf"). */
export function toolFromPath(pathname: string): string {
  return pathname.replace(/^\/+/, "").split("/")[0] || "home";
}
