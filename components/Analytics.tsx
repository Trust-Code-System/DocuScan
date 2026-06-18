"use client";

/**
 * Loads third-party analytics/error scripts — but only when (a) the relevant
 * env key is set and (b) the user has granted consent. Everything here is a
 * no-op in dev / when unconfigured, so the default experience ships nothing.
 *
 *   - PostHog (NEXT_PUBLIC_POSTHOG_KEY): product analytics + funnel.
 *   - Sentry browser Loader (NEXT_PUBLIC_SENTRY_DSN): client error tracking,
 *     lazy-loaded from Sentry's CDN. Server errors are handled in
 *     instrumentation.ts.
 *
 * Both load from a CDN at runtime, so they add ZERO weight to First Load JS.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  ANALYTICS_KEY,
  ANALYTICS_HOST,
  Events,
  track,
  toolFromPath,
} from "@/lib/analytics";
import { CONSENT_EVENT, hasAnalyticsConsent } from "@/lib/consent";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Standard PostHog array-stub snippet, loads posthog-js from the CDN.
function loadPostHog() {
  if (!ANALYTICS_KEY || window.posthog) return;
  /* eslint-disable */
  // prettier-ignore
  (function (t: any, e: any) { var o: any, n: any, p: any, r: any; e.__SV || ((window as any).posthog = e, e._i = [], e.init = function (i: any, s: any, a: any) { function g(t: any, e: any) { var o = e.split("."); 2 == o.length && (t = t[o[0]], e = o[1]), t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))) } } (p = t.createElement("script")).type = "text/javascript", p.async = !0, p.src = s.api_host.replace(".i.posthog.com", "-assets.i.posthog.com") + "/static/array.js", (r = t.getElementsByTagName("script")[0]).parentNode.insertBefore(p, r); var u = e; for (void 0 !== a ? u = e[a] = [] : a = "posthog", u.people = u.people || [], u.toString = function (t: any) { var e = "posthog"; return "posthog" !== a && (e += "." + a), t || (e += " (stub)"), e }, u.people.toString = function () { return u.toString(1) + ".people (stub)" }, o = "init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "), n = 0; n < o.length; n++) g(u, o[n]); e._i.push([i, s, a]) }, e.__SV = 1) })(document, (window as any).posthog || []);
  /* eslint-enable */
  const ph = (window as unknown as {
    posthog?: { init?: (k: string, o: Record<string, unknown>) => void };
  }).posthog;
  ph?.init?.(ANALYTICS_KEY, {
    api_host: ANALYTICS_HOST,
    capture_pageview: false, // we send our own on route change
    persistence: "localStorage+cookie",
  });
}

// Sentry browser Loader Script: https://js.sentry-cdn.com/<publicKey>.min.js
function loadSentry() {
  if (!SENTRY_DSN) return;
  if (document.getElementById("sentry-loader")) return;
  const match = SENTRY_DSN.match(/\/\/([^@]+)@/);
  const publicKey = match?.[1];
  if (!publicKey) return;
  const s = document.createElement("script");
  s.id = "sentry-loader";
  s.src = `https://js.sentry-cdn.com/${publicKey}.min.js`;
  s.crossOrigin = "anonymous";
  document.head.appendChild(s);
}

function loadAll() {
  if (!hasAnalyticsConsent()) return;
  loadPostHog();
  loadSentry();
}

export default function Analytics() {
  const pathname = usePathname();

  // Load on mount (if already consented) and whenever consent changes.
  useEffect(() => {
    loadAll();
    const onChange = () => loadAll();
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  // Send a pageview + tool_view on every route change.
  useEffect(() => {
    if (!pathname) return;
    window.posthog?.capture("$pageview");
    track(Events.ToolView, { tool: toolFromPath(pathname) });
  }, [pathname]);

  return null;
}
