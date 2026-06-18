"use client";

/**
 * Global guard so a file dropped anywhere outside a real drop zone never makes
 * the browser navigate to / open it (the main reason drag-and-drop felt
 * "broken": a slightly-missed drop replaced the app with the raw file).
 *
 * Drop zones call preventDefault on their own onDrop during bubbling, so this
 * window-level fallback only kicks in for misses — it doesn't interfere with the
 * <Dropzone> handlers.
 */

import { useEffect } from "react";

export default function DropGuard() {
  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault();
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);
  return null;
}
