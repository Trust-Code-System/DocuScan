"use client";

/**
 * Shown right after a language is picked in <LocaleSwitcher/>. Asks how much to
 * translate, sets the locale + scope cookies, and reloads (or, for the document
 * option, routes to /translate with the language preset so the existing tool
 * does the file translation).
 */

import { LOCALE_COOKIE, SCOPE_COOKIE, type Language, type TranslateScope } from "@/lib/i18n";

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

const OPTIONS: {
  scope: TranslateScope;
  doc?: boolean;
  icon: string;
  title: string;
  desc: string;
}[] = [
  {
    scope: "tools",
    icon: "grid_view",
    title: "Just the tool names",
    desc: "Translate the names and descriptions of the tools only.",
  },
  {
    scope: "site",
    icon: "language",
    title: "The whole website",
    desc: "Translate the entire interface — menus, headings, buttons and text.",
  },
  {
    scope: "site",
    doc: true,
    icon: "translate",
    title: "The whole website + my document",
    desc: "Translate the interface, then translate a PDF or Word file you upload.",
  },
];

export default function LanguageDialog({
  language,
  onCancel,
}: {
  language: Language;
  onCancel: () => void;
}) {
  function choose(scope: TranslateScope, doc?: boolean) {
    setCookie(LOCALE_COOKIE, language.code);
    setCookie(SCOPE_COOKIE, scope);
    if (doc) {
      window.location.assign(`/translate?to=${encodeURIComponent(language.name)}`);
    } else {
      window.location.reload();
    }
  }

  return (
    <div
      className="animate-overlay fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Choose what to translate"
      onClick={onCancel}
    >
      <div
        className="animate-modal w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-ink">
          Translate to {language.label}?
        </h2>
        <p className="mt-1 text-sm text-muted">Choose how much you&apos;d like translated.</p>

        <div className="mt-5 space-y-2">
          {OPTIONS.map((o) => (
            <button
              key={o.title}
              type="button"
              onClick={() => choose(o.scope, o.doc)}
              className="press group flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition duration-150 ease-snappy hover:border-brand-400 hover:bg-brand-50/40"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
                <span className="material-symbols-outlined text-[20px]" aria-hidden>
                  {o.icon}
                </span>
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-ink">{o.title}</span>
                <span className="mt-0.5 block text-sm text-slate-500">{o.desc}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-muted transition-colors hover:bg-slate-100 hover:text-ink"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
