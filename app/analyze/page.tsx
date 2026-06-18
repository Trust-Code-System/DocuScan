"use client";

/**
 * /analyze — AI contract / legal analysis (Phase C3).
 *
 * Extracts text in the browser (pdf.js, OCR fallback), then asks the AI for a
 * plain-English overview, parties, key terms, obligations and risk flags
 * (task "analyze"). Informational only — not legal advice. Only the text is
 * sent; the file stays on the user's device.
 */

import { useState } from "react";
import { extractAnyText } from "@/lib/extractText";
import { validateDocFile, formatBytes } from "@/lib/limits";
import { useGuestTask } from "@/lib/useGuestTask";
import Dropzone from "@/components/Dropzone";
import type { AnalysisResult, RiskSeverity } from "@/lib/ai";

const SEVERITY: Record<RiskSeverity, string> = {
  high: "border-red-200 bg-red-50 text-red-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-slate-200 bg-slate-50 text-slate-600",
};

export default function AnalyzePage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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

  async function analyze() {
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

      setStatus("Analyzing…");
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "analyze", text }),
      });
      const data = await res.json();
      if (res.status === 503) throw new Error("AI features aren't enabled on this server.");
      if (!res.ok) throw new Error(data.error || "Analysis failed.");
      setResult(data as AnalysisResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not analyze this document.");
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Analyze a contract</h1>
      <p className="mt-1 text-muted">
        Get a plain-English breakdown of an agreement — parties, key terms, obligations and the
        clauses worth a closer look.
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
        <div className="mt-5">
          <button
            onClick={analyze}
            disabled={busy}
            className="rounded-xl bg-brand-500 px-6 py-2.5 font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {busy ? status || "Analyzing…" : "Analyze"}
          </button>
        </div>
      )}

      {busy && status && <p className="mt-3 text-sm text-muted">{status}</p>}

      {result && (
        <div className="mt-6 space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">Overview</p>
            <p className="text-ink">{result.overview}</p>
            {result.parties.length > 0 && (
              <p className="mt-3 text-sm text-muted">
                <span className="font-semibold text-ink">Parties:</span> {result.parties.join(", ")}
              </p>
            )}
          </div>

          {result.keyTerms.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Key terms</p>
              <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {result.keyTerms.map((t, i) => (
                  <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                    <dt className="text-xs font-semibold text-muted">{t.label}</dt>
                    <dd className="text-sm text-ink">{t.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {result.obligations.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Obligations</p>
              <ul className="list-disc space-y-1 pl-5 text-ink">
                {result.obligations.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </div>
          )}

          {result.risks.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
                Clauses to review
              </p>
              <div className="space-y-3">
                {result.risks.map((r, i) => (
                  <div key={i} className={`rounded-xl border p-4 ${SEVERITY[r.severity]}`}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="font-semibold">{r.clause}</p>
                      <span className="shrink-0 rounded-full border border-current px-2 py-0.5 text-[10px] font-bold uppercase">
                        {r.severity}
                      </span>
                    </div>
                    <p className="text-sm opacity-90">{r.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-muted">
            This is an automated, informational summary — not legal advice. Review important
            agreements with a qualified professional.
          </p>
        </div>
      )}
    </div>
  );
}
