"use client";

/**
 * Global tap haptics for touch devices.
 *
 * Mounts one passive pointerdown listener and fires a soft tick whenever an
 * actionable control (button, link, toggle, .press element…) is pressed with a
 * finger. This gives the whole app native-feeling tap feedback without wiring
 * haptics into every component. Richer cues (success/error) can be triggered
 * explicitly from a flow via lib/haptics. No-op on devices without the
 * Vibration API (e.g. iOS Safari) and on mouse/pen input.
 */

import { useEffect } from "react";
import { hapticLight, hapticsSupported } from "@/lib/haptics";

const ACTIONABLE = [
  "button",
  "a[href]",
  '[role="button"]',
  '[role="tab"]',
  '[role="switch"]',
  ".press",
  "summary",
  "select",
  'input[type="checkbox"]',
  'input[type="radio"]',
  'input[type="submit"]',
  'input[type="button"]',
].join(",");

function isDisabled(el: Element): boolean {
  return (
    (el as HTMLButtonElement).disabled === true ||
    el.getAttribute("aria-disabled") === "true"
  );
}

export default function Haptics() {
  useEffect(() => {
    if (!hapticsSupported()) return;

    const onPointerDown = (e: PointerEvent) => {
      // Only finger taps — never mouse or stylus.
      if (e.pointerType !== "touch") return;
      const target = e.target as Element | null;
      const el = target?.closest(ACTIONABLE);
      if (el && !isDisabled(el)) hapticLight();
    };

    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return null;
}
