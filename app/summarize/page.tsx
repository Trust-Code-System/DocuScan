"use client";

/**
 * /summarize — AI document summary (Phase C1).
 *
 * Extracts text in the browser (pdf.js, OCR fallback), then asks the AI for a
 * TL;DR, key points and action items (task "summarize"). Only the text is sent;
 * the file stays on the user's device.
 */

import { useState } from "react";
import { extractAnyText } from "@/lib/extractText";
import { validateDocFile, formatBytes } from "@/lib/limits";
import { useGuestTask } from "@/lib/useGuestTask";
import Dropzone from "@/components/Dropzone";
import Select from "@/components/Select";
import type { SummaryResult, SummaryMode } from "@/lib/ai";

// Grouped for the dropdown — value must match a SUMMARY_MODE key in lib/ai.ts.
const MODE_GROUPS: { group: string; modes: { value: SummaryMode; label: string }[] }[] = [
  {
    group: "Length",
    modes: [
      { value: "brief", label: "Short summary" },
      { value: "standard", label: "Standard summary" },
      { value: "detailed", label: "Detailed summary" },
      { value: "bullets", label: "Bullet points" },
    ],
  },
  {
    group: "Audience / tone",
    modes: [
      { value: "executive", label: "Executive summary" },
      { value: "professional", label: "Explain like a professional" },
      { value: "eli10", label: "Explain like I'm 10" },
      { value: "email", label: "Email-style recap" },
      { value: "student", label: "Student notes" },
    ],
  },
  {
    group: "By document type",
    modes: [
      { value: "actions", label: "Action items" },
      { value: "meeting", label: "Meeting notes" },
      { value: "risk", label: "Risk summary" },
      { value: "contract", label: "Contract summary" },
      { value: "financial", label: "Financial summary" },
      { value: "research", label: "Research paper summary" },
      { value: "policy", label: "Policy summary" },
    ],
  },
];

export default function SummarizePage() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<SummaryMode>("standard");
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const { usage, consume } = useGuestTask();

  function pick(files: FileList | null) {
    setError(null);
    setResult(null);
    const f = files?.[0];
    if (!f) return;
    const v = validateDocFile(f);
    if (!v.ok) {
      setError(v.reason);
      return;
    }
    setFile(f);
  }

  async function summarizeFile() {
    if (!file) return;
    setError(null);
    setBusy(true);
    setResult(null);
    try {
      const blocked = await consume();
      if (blocked) {
        setError(blocked);
        return;
      }
      const text = await extractAnyText(file, setStatus);

      setStatus("Summarizing…");
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "summarize", text, mode }),
      });
      const data = await res.json();
      if (res.status === 503) throw new Error("AI features aren't enabled on this server.");
      if (!res.ok) throw new Error(data.error || "Summary failed.");
      setResult(data as SummaryResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not summarize this document.");
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  async function copyAll() {
    if (!result) return;
    const parts = [
      result.tldr,
      result.keyPoints.length ? "\nKey points:\n" + result.keyPoints.map((p) => `• ${p}`).join("\n") : "",
      result.actionItems.length
        ? "\nAction items:\n" + result.actionItems.map((a) => `• ${a}`).join("\n")
        : "",
    ];
    await navigator.clipboard.writeText(parts.filter(Boolean).join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Summarize document</h1>
      <p className="mt-1 text-muted">
        Get a TL;DR, the key points and any action items from a long document — in seconds.
      </p>
      <p className="mt-2 text-xs text-muted">
        Private: only the document&apos;s text is sent to the AI; the file stays on your device.
      </p>
      {usage && (
        <p className="mt-2 text-xs text-muted">
          Free tasks left today: <span className="font-semibold">{usage.remaining}</span> / {usage.limit}
        </p>
      )}

      {!file && (
        <Dropzone onFiles={pick} className="mt-5">
          {(open) => (
            <>
              <p className="font-medium text-ink">Drop a document here</p>
              <p className="mt-1 text-sm text-muted">PDF, Word, image, text & more — or</p>
              <button
                onClick={open}
                className="mt-3 rounded-xl bg-brand-500 px-5 py-2.5 font-semibold text-white hover:bg-brand-600"
              >
                Choose file
              </button>
            </>
          )}
        </Dropzone>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {file && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div>
            <p className="font-medium text-ink">{file.name}</p>
            <p className="text-sm text-muted">{formatBytes(file.size)}</p>
          </div>
          <button onClick={() => { setFile(null); setResult(null); }} className="text-sm font-medium text-brand-600 underline">
            Change
          </button>
        </div>
      )}

      {file && (
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-muted">Summary mode</span>
            <Select
              ariaLabel="Summary mode"
              value={mode}
              onChange={(v) => setMode(v as SummaryMode)}
              groups={MODE_GROUPS.map((g) => ({ label: g.group, options: g.modes }))}
            />
          </label>
          <button
            onClick={summarizeFile}
            disabled={busy}
            className="rounded-xl bg-brand-500 px-6 py-2.5 font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {busy ? status || "Summarizing…" : "Summarize"}
          </button>
        </div>
      )}

      {busy && status && <p className="mt-3 text-sm text-muted">{status}</p>}

      {result && (
        <div className="mt-6 space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">Summary</p>
            <button onClick={copyAll} className="text-sm font-medium text-brand-600 underline">
              {copied ? "Copied!" : "Copy all"}
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">TL;DR</p>
            <p className="text-ink">{result.tldr}</p>
          </div>

          {result.keyPoints.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Key points</p>
              <ul className="list-disc space-y-1 pl-5 text-ink">
                {result.keyPoints.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          {result.actionItems.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Action items</p>
              <ul className="space-y-1 text-ink">
                {result.actionItems.map((a, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="material-symbols-outlined text-[18px] text-brand-600" aria-hidden>
                      check_circle
                    </span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
