"use client";

/**
 * /compare — Document compare / redline (Phase B4).
 *
 * Two PDFs → extract both texts in the browser → Claude (task "compare") returns
 * structured added/removed/changed + a plain-language summary, rendered as a
 * redline. Great for contract revisions.
 */

import { useRef, useState } from "react";
import { extractAnyText } from "@/lib/extractText";
import { validateDocFile, formatBytes, ACCEPT_ANY_DOC } from "@/lib/limits";
import { useGuestTask } from "@/lib/useGuestTask";
import { useFileDrop } from "@/components/Dropzone";
import type { CompareResult } from "@/lib/ai";

function Drop({
  label,
  file,
  onPick,
}: {
  label: string;
  file: File | null;
  onPick: (f: FileList | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const { dragActive, dropHandlers } = useFileDrop(onPick);
  return (
    <div className="flex-1">
      <input
        ref={ref}
        type="file"
        accept={ACCEPT_ANY_DOC}
        hidden
        onChange={(e) => {
          onPick(e.target.files);
          e.target.value = "";
        }}
      />
      <div
        {...dropHandlers}
        className={`rounded-2xl border-2 border-dashed p-5 text-center transition-colors ${
          dragActive ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-white"
        }`}
      >
        <p className="text-sm font-semibold text-ink">{label}</p>
        {file ? (
          <p className="mt-1 text-xs text-muted">
            {file.name} · {formatBytes(file.size)}
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted">No file yet</p>
        )}
        <button
          onClick={() => ref.current?.click()}
          className="mt-3 rounded-lg border border-slate-300 px-4 py-1.5 text-sm font-medium text-ink hover:bg-slate-50"
        >
          {file ? "Change" : "Choose file"}
        </button>
      </div>
    </div>
  );
}

export default function ComparePage() {
  const [a, setA] = useState<File | null>(null);
  const [b, setB] = useState<File | null>(null);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { usage, consume } = useGuestTask();

  function pickA(files: FileList | null) {
    setError(null);
    setResult(null);
    const f = files?.[0];
    if (!f) return;
    const v = validateDocFile(f);
    if (!v.ok) return setError(v.reason);
    setA(f);
  }
  function pickB(files: FileList | null) {
    setError(null);
    setResult(null);
    const f = files?.[0];
    if (!f) return;
    const v = validateDocFile(f);
    if (!v.ok) return setError(v.reason);
    setB(f);
  }

  async function compare() {
    if (!a || !b) return;
    setError(null);
    setBusy(true);
    setResult(null);
    try {
      const blocked = await consume();
      if (blocked) {
        setError(blocked);
        return;
      }
      setStatus("Reading both documents…");
      const [ta, tb] = await Promise.all([extractAnyText(a), extractAnyText(b)]);
      setStatus("Comparing with AI…");
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "compare", text: ta, textB: tb }),
      });
      const data = await res.json();
      if (res.status === 503) throw new Error("AI features aren't enabled on this server.");
      if (!res.ok) throw new Error(data.error || "Comparison failed.");
      setResult(data as CompareResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not compare these documents.");
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Compare documents</h1>
      <p className="mt-1 text-muted">
        See what changed between two versions — additions, removals and reworded passages, plus a
        plain-language summary. Great for contracts.
      </p>
      <p className="mt-2 text-xs text-muted">
        Private: only the documents&apos; text is sent to the AI; the files stay on your device.
      </p>
      {usage && (
        <p className="mt-2 text-xs text-muted">
          Free tasks left today: <span className="font-semibold">{usage.remaining}</span> / {usage.limit}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Drop label="A — Original" file={a} onPick={pickA} />
        <Drop label="B — Revised" file={b} onPick={pickB} />
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        onClick={compare}
        disabled={busy || !a || !b}
        className="mt-6 rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
      >
        {busy ? status || "Comparing…" : "Compare"}
      </button>

      {result && (
        <div className="mt-8 space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-ink">Summary</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{result.summary}</p>
          </div>

          {result.changed.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-ink">Changed</p>
              <div className="space-y-2">
                {result.changed.map((c, i) => (
                  <div key={i} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                    <p className="text-red-700">
                      <span className="font-mono text-[10px] uppercase">− </span>
                      <span className="line-through">{c.before}</span>
                    </p>
                    <p className="text-green-700">
                      <span className="font-mono text-[10px] uppercase">+ </span>
                      {c.after}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-semibold text-green-700">Added in B ({result.added.length})</p>
              <ul className="space-y-1 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-ink">
                {result.added.length ? (
                  result.added.map((t, i) => <li key={i}>+ {t}</li>)
                ) : (
                  <li className="text-muted">None</li>
                )}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-red-700">Removed from A ({result.removed.length})</p>
              <ul className="space-y-1 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-ink">
                {result.removed.length ? (
                  result.removed.map((t, i) => <li key={i}>− {t}</li>)
                ) : (
                  <li className="text-muted">None</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
