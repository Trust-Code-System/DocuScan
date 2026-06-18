"use client";

import { useEffect, useRef, useState } from "react";
import { LOCALES, LOCALE_NAMES, LOCALE_COOKIE, type Locale } from "@/lib/i18n";

/**
 * Custom language dropdown styled to the site scheme. A native <select> can't
 * restyle its open option list cross-browser, so we render our own listbox.
 * Sets the locale cookie and reloads so the server re-renders translated chrome.
 */
export default function LocaleSwitcher({ current }: { current: Locale }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  function select(value: Locale) {
    setOpen(false);
    if (value === current) return;
    document.cookie = `${LOCALE_COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    window.location.reload();
  }

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open ? "true" : "false"}
        aria-label="Language"
        className="press flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-ink transition-colors duration-150 ease-snappy hover:border-brand-300"
      >
        {LOCALE_NAMES[current]}
        <span
          className={`material-symbols-outlined text-base text-muted transition-transform duration-200 ease-snappy ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          expand_more
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Language"
          className="animate-pop absolute bottom-full right-0 z-40 mb-1.5 min-w-[9rem] origin-bottom-right overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-card"
        >
          {LOCALES.map((l) => {
            const active = l === current;
            return (
              <button
                key={l}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => select(l)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors duration-100 ${
                  active
                    ? "bg-brand-50 font-semibold text-brand-700"
                    : "text-ink hover:bg-slate-100"
                }`}
              >
                {LOCALE_NAMES[l]}
                {active && (
                  <span className="material-symbols-outlined text-base text-brand-600" aria-hidden>
                    check
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
