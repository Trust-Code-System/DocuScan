"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  LANGUAGES,
  LOCALE_COOKIE,
  SCOPE_COOKIE,
  DEFAULT_LOCALE,
  getLanguage,
  type Language,
} from "@/lib/i18n";
import LanguageDialog from "@/components/LanguageDialog";

/**
 * Footer language picker. Opens a searchable list of all supported languages;
 * choosing one (other than English) opens <LanguageDialog/> to ask how much to
 * translate. Choosing English clears the locale and reloads (turns it off).
 * Marked data-no-translate so the native language names are never translated.
 */
export default function LocaleSwitcher({
  current,
  placement = "up",
}: {
  current: string;
  placement?: "up" | "down";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<Language | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const currentLabel = getLanguage(current)?.label ?? "English";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LANGUAGES;
    return LANGUAGES.filter(
      (l) => l.label.toLowerCase().includes(q) || l.name.toLowerCase().includes(q),
    );
  }, [query]);

  function select(lang: Language) {
    setOpen(false);
    setQuery("");
    if (lang.code === current) return;
    if (lang.code === DEFAULT_LOCALE) {
      // Turn translation off.
      document.cookie = `${LOCALE_COOKIE}=; path=/; max-age=0; samesite=lax`;
      document.cookie = `${SCOPE_COOKIE}=; path=/; max-age=0; samesite=lax`;
      window.location.reload();
      return;
    }
    setChosen(lang);
  }

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
    <div ref={rootRef} className="relative" data-no-translate>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Language"
        className="press flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-ink transition-colors duration-150 ease-snappy hover:border-brand-300"
      >
        <span className="material-symbols-outlined text-base text-muted" aria-hidden>
          language
        </span>
        {currentLabel}
        <span
          className={`material-symbols-outlined text-base text-muted transition-transform duration-200 ease-snappy ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          expand_more
        </span>
      </button>

      {open && (
        <div
          className={`animate-pop absolute right-0 z-40 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card ${
            placement === "down"
              ? "top-full mt-1.5 origin-top-right"
              : "bottom-full mb-1.5 origin-bottom-right"
          }`}
        >
          <div className="border-b border-slate-100 p-2">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search language…"
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
            />
          </div>
          <div role="listbox" aria-label="Language" className="max-h-72 overflow-auto p-1">
            {filtered.map((l) => {
              const active = l.code === current;
              return (
                <button
                  key={l.code}
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
                  {l.label}
                  {active && (
                    <span className="material-symbols-outlined text-base text-brand-600" aria-hidden>
                      check
                    </span>
                  )}
                </button>
              );
            })}
            {!filtered.length && (
              <p className="px-2.5 py-3 text-center text-sm text-muted">No matches</p>
            )}
          </div>
        </div>
      )}

      {chosen && <LanguageDialog language={chosen} onCancel={() => setChosen(null)} />}
    </div>
  );
}
