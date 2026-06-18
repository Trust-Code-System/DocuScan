"use client";

import { useEffect, useState } from "react";
import { formatBytes } from "@/lib/limits";
import {
  clearRecentDocs,
  deleteRecentDoc,
  getRecentDoc,
  listRecentDocs,
  type RecentDocSummary,
} from "@/lib/recentDocs";
import { nativeShareFile } from "@/lib/nativeBridge";

function dateLabel(ts: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ts));
}

function bytesFromBuffer(buf: ArrayBuffer) {
  return new Uint8Array(buf.slice(0));
}

export default function RecentDocs() {
  const [docs, setDocs] = useState<RecentDocSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setDocs(await listRecentDocs());
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function exportDoc(id: string) {
    setError(null);
    const doc = await getRecentDoc(id);
    if (!doc) {
      setError("That document is no longer available.");
      await refresh();
      return;
    }

    const bytes = bytesFromBuffer(doc.bytes);
    try {
      if (await nativeShareFile(bytes, doc.name, doc.type)) return;
    } catch {
      /* fall back to browser download */
    }

    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: doc.type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function remove(id: string) {
    await deleteRecentDoc(id);
    await refresh();
  }

  async function clearAll() {
    await clearRecentDocs();
    await refresh();
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Recent scans</h1>
          <p className="mt-1 text-sm text-muted">
            Saved on this device only, ready for offline export.
          </p>
        </div>
        {docs.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="press rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Clear
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {docs.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <span className="material-symbols-outlined text-4xl text-brand-500" aria-hidden>
            history
          </span>
          <h2 className="mt-3 font-semibold text-ink">No recent scans yet</h2>
          <p className="mt-1 text-sm text-muted">
            Create or export a PDF and it will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="mt-6 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
          {docs.map((doc) => (
            <article key={doc.id} className="flex items-center gap-3 p-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <span className="material-symbols-outlined" aria-hidden>
                  picture_as_pdf
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-semibold text-ink">{doc.name}</h2>
                <p className="mt-0.5 text-xs text-muted">
                  {formatBytes(doc.size)} - {dateLabel(doc.createdAt)}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => exportDoc(doc.id)}
                  className="press rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600"
                >
                  Export
                </button>
                <button
                  type="button"
                  onClick={() => remove(doc.id)}
                  aria-label={`Remove ${doc.name}`}
                  className="press grid h-9 w-9 place-items-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden>
                    delete
                  </span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
