"use client";

/**
 * Runtime UI translator.
 *
 * When the `ds-locale` cookie selects a non-default language, this walks the
 * rendered DOM, collects visible text, translates it via /api/ai (task
 * "ui-translate") and swaps it in place. Translations are cached in
 * localStorage per language so each unique string is only ever paid for once;
 * a MutationObserver re-translates content added by client-side navigation.
 *
 * Scope (`ds-locale-scope` cookie): "site" translates the whole page; "tools"
 * only translates inside elements marked [data-translate="tools"].
 */

import { useEffect, useRef, useState } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE, SCOPE_COOKIE, languageName, type TranslateScope } from "@/lib/i18n";

const BATCH = 40; // strings per AI request
const CONCURRENCY = 4; // batches in flight at once (faster first paint)
const HAS_LETTER = /\p{L}/u;

function readCookie(name: string): string | undefined {
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith(name + "="))
    ?.split("=")[1];
}

type Candidate = { node: Text; key: string; pre: string; suf: string };

export default function AutoTranslate() {
  const [busy, setBusy] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const cacheRef = useRef<Record<string, string>>({});
  const doneRef = useRef<WeakSet<Text>>(new WeakSet());

  useEffect(() => {
    const locale = readCookie(LOCALE_COOKIE) ?? DEFAULT_LOCALE;
    if (locale === DEFAULT_LOCALE) return;

    const scope: TranslateScope = readCookie(SCOPE_COOKIE) === "tools" ? "tools" : "site";
    const targetLang = languageName(locale);
    const cacheKey = `ds-tr:${locale}`;
    let aiDisabled = false;
    let cancelled = false;

    try {
      cacheRef.current = JSON.parse(localStorage.getItem(cacheKey) || "{}");
    } catch {
      cacheRef.current = {};
    }

    function roots(): Element[] {
      if (scope === "tools") return Array.from(document.querySelectorAll('[data-translate="tools"]'));
      return document.body ? [document.body] : [];
    }

    // Should this text node be translated?
    function eligible(node: Text): boolean {
      if (doneRef.current.has(node)) return false;
      const raw = node.nodeValue ?? "";
      if (!raw.trim() || !HAS_LETTER.test(raw)) return false;
      const el = node.parentElement;
      if (!el) return false;
      if (el.closest("script,style,noscript,textarea,code,pre,[contenteditable],[data-no-translate]"))
        return false;
      if (el.closest(".material-symbols-outlined")) return false;
      return true;
    }

    function collect(): Candidate[] {
      const out: Candidate[] = [];
      for (const root of roots()) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let n = walker.nextNode() as Text | null;
        while (n) {
          if (eligible(n)) {
            const raw = n.nodeValue ?? "";
            const pre = raw.match(/^\s*/)?.[0] ?? "";
            const suf = raw.match(/\s*$/)?.[0] ?? "";
            out.push({ node: n, key: raw.trim(), pre, suf });
          }
          n = walker.nextNode() as Text | null;
        }
      }
      return out;
    }

    async function fetchBatch(chunk: string[]): Promise<void> {
      const cache = cacheRef.current;
      try {
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task: "ui-translate", strings: chunk, targetLang }),
        });
        if (res.status === 503) {
          aiDisabled = true;
          setDisabled(true);
          return;
        }
        if (!res.ok) return; // rate-limited or transient — keep what we have
        const data = (await res.json()) as { translations?: string[] };
        const out = data.translations ?? [];
        chunk.forEach((src, j) => {
          cache[src] = typeof out[j] === "string" && out[j] ? out[j] : src;
        });
        try {
          localStorage.setItem(cacheKey, JSON.stringify(cache));
        } catch {
          /* quota — translations still apply this session */
        }
      } catch {
        /* network error — leave this batch untranslated */
      }
    }

    // Apply every candidate whose translation is now known; leave the rest for
    // a later batch (only resolved nodes get marked done).
    function apply(cands: Candidate[]): void {
      const cache = cacheRef.current;
      observer.disconnect();
      for (const c of cands) {
        const tr = cache[c.key];
        if (tr === undefined) continue;
        if (tr && tr !== c.key) c.node.nodeValue = c.pre + tr + c.suf;
        doneRef.current.add(c.node);
      }
      reconnect();
    }

    let running = false;
    let dirty = false;
    async function pass(): Promise<void> {
      if (running) {
        dirty = true; // a mutation arrived mid-run; do one more pass after
        return;
      }
      running = true;
      try {
        await runPass();
      } finally {
        running = false;
        if (dirty && !cancelled) {
          dirty = false;
          void pass();
        }
      }
    }

    async function runPass(): Promise<void> {
      const cands = collect();
      if (!cands.length) return;
      apply(cands); // paint anything already cached immediately
      const needed = cands.filter((c) => !(c.key in cacheRef.current));
      if (!needed.length || aiDisabled) return;

      const missing = Array.from(new Set(needed.map((c) => c.key)));
      const chunks: string[][] = [];
      for (let i = 0; i < missing.length; i += BATCH) chunks.push(missing.slice(i, i + BATCH));

      setBusy(true);
      try {
        // Run a few batches at a time; re-apply after each so tiles update live.
        let next = 0;
        async function worker() {
          while (next < chunks.length && !cancelled && !aiDisabled) {
            const chunk = chunks[next++];
            await fetchBatch(chunk);
            if (!cancelled) apply(needed);
          }
        }
        await Promise.all(
          Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, worker),
        );
      } finally {
        if (!cancelled) setBusy(false);
      }
    }

    // Re-translate DOM added by client-side navigation / dynamic UI (debounced).
    let timer: number | undefined;
    const observer = new MutationObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void pass(), 250);
    });
    function reconnect() {
      const target = document.body;
      if (target) observer.observe(target, { childList: true, subtree: true });
    }

    void pass();
    reconnect();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  if (disabled) {
    return (
      <div
        role="status"
        data-no-translate
        className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-card animate-rise"
      >
        AI translation isn&apos;t enabled on this server.
      </div>
    );
  }
  if (busy) {
    return (
      <div
        role="status"
        data-no-translate
        className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-card animate-rise"
      >
        <span className="spinner h-4 w-4" aria-hidden />
        Translating…
      </div>
    );
  }
  return null;
}
