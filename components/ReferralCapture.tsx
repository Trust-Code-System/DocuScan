"use client";

/**
 * Captures a `?ref=CODE` referral on first visit: records one visit server-side
 * and stashes the code locally so a future signup can attribute the conversion.
 * No UI. Once accounts exist, read ds-ref at signup and call recordConversion.
 */

import { useEffect } from "react";

const KEY = "ds-ref";

export default function ReferralCapture() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("ref");
    if (!code) return;
    if (localStorage.getItem(KEY) === code) return; // already counted this code
    localStorage.setItem(KEY, code);
    fetch("/api/referral", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    }).catch(() => {});
  }, []);

  return null;
}
