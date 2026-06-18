"use client";

/**
 * Cookie / analytics consent banner.
 *
 * Only appears when (a) analytics is actually configured (a PostHog/Sentry key
 * is set) and (b) the user hasn't decided yet — so dev and unconfigured deploys
 * never show it. Strictly-necessary cookies (the guest counter) aren't gated;
 * this is purely for the optional analytics scripts in <Analytics/>.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { getConsent, setConsent } from "@/lib/consent";
import { analyticsEnabled } from "@/lib/analytics";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

export default function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const configured = analyticsEnabled() || !!SENTRY_DSN;
    if (configured && getConsent() === null) setShow(true);
  }, []);

  if (!show) return null;

  function decide(value: "granted" | "denied") {
    setConsent(value);
    setShow(false);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted">
          We use privacy-friendly analytics to improve DocuScan. No ads, no
          selling data. See our{" "}
          <Link href="/privacy" className="font-medium text-brand-600 underline">
            Privacy Policy
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => decide("denied")}
            className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-ink hover:bg-slate-50"
          >
            Decline
          </button>
          <button
            onClick={() => decide("granted")}
            className="rounded-lg bg-brand-500 px-3 py-1.5 font-semibold text-white hover:bg-brand-600"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
