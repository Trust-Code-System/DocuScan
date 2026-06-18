"use client";

/**
 * /qr-labels — Document QR Labels.
 *
 * Generate QR codes for documents, files or folders and print a clean label
 * sheet to stick onto physical paperwork. QR codes are built in the browser
 * (lib/qr.ts). Labels are saved on this device only (localStorage) until
 * accounts exist. Scanning a label opens whatever link/note you encoded — so
 * only put a private link there if it's access-controlled.
 */

import { useEffect, useState } from "react";
import { makeQrDataUrl } from "@/lib/qr";

interface Label {
  id: string;
  title: string;
  content: string;
  note: string;
  qr: string; // data URL
}

const KEY = "ds-qr-labels";

function load(): Label[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function QrLabelsPage() {
  const [labels, setLabels] = useState<Label[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLabels(load());
  }, []);

  function persist(next: Label[]) {
    setLabels(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* best effort */
    }
  }

  async function add() {
    setError(null);
    const t = title.trim();
    const c = content.trim();
    if (!t || !c) {
      setError("Add a label name and the link or text to encode.");
      return;
    }
    setBusy(true);
    try {
      const qr = await makeQrDataUrl(c);
      const label: Label = {
        id:
          (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) ||
          String(Date.now()),
        title: t,
        content: c,
        note: note.trim(),
        qr,
      };
      persist([label, ...labels]);
      setTitle("");
      setContent("");
      setNote("");
    } catch {
      setError("Could not generate that QR code.");
    } finally {
      setBusy(false);
    }
  }

  function remove(id: string) {
    persist(labels.filter((l) => l.id !== id));
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="print:hidden">
        <h1 className="text-2xl font-bold sm:text-3xl">Document QR Labels</h1>
        <p className="mt-1 text-muted">
          Create QR codes for files and folders, then print a label sheet to stick onto physical
          documents. Scan a label later to jump straight to the digital copy.
        </p>
        <p className="mt-2 text-xs text-muted">
          QR codes are generated on your device. Anyone who scans a label can open whatever you
          encode — only use a private link if it requires sign-in.
        </p>

        <div className="mt-5 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-ink">Label name</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Tax Return 2025"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-ink">Link or text to encode</span>
            <input
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="https://… or a reference code"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-ink">Note (optional)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Cabinet B · shelf 2"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              onClick={add}
              disabled={busy}
              className="press rounded-xl bg-brand-500 px-6 py-2.5 font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
            >
              {busy ? "Generating…" : "Add label"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {labels.length > 0 && (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">
              {labels.length} label{labels.length === 1 ? "" : "s"}
            </p>
            <button
              onClick={() => window.print()}
              className="press inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden>
                print
              </span>
              Print labels
            </button>
          </div>
        )}
      </div>

      {labels.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-muted print:hidden">
          No labels yet. Add one above to start your label sheet.
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3 print:gap-2">
          {labels.map((l) => (
            <div
              key={l.id}
              className="relative flex flex-col items-center rounded-xl border border-slate-300 bg-white p-4 text-center print:break-inside-avoid"
            >
              <button
                onClick={() => remove(l.id)}
                aria-label="Delete label"
                className="absolute right-2 top-2 text-slate-400 hover:text-red-600 print:hidden"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden>
                  close
                </span>
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={l.qr} alt={`QR for ${l.title}`} className="h-32 w-32" />
              <p className="mt-2 w-full truncate text-sm font-semibold text-ink">{l.title}</p>
              {l.note && <p className="w-full truncate text-xs text-muted">{l.note}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
