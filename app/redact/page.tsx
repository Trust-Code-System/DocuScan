"use client";

/**
 * /redact — AI auto-redaction (Phase B2).
 *
 * Extracts text WITH positions in the browser, asks Claude to find PII spans
 * (task "redact-detect"), maps those spans back to glyph boxes, and — by default
 * — uses the SECURE rasterize export so the underlying text is genuinely removed
 * (not just covered). Something no incumbent offers: private + AI-driven + truly
 * removing the data.
 */

import { useState } from "react";
import { extractPdfText } from "@/lib/pdfText";
import { validateDocFile, formatBytes } from "@/lib/limits";
import { anyFileToPdf } from "@/lib/toPdf";
import { useGuestTask } from "@/lib/useGuestTask";
import { extractPageItems, spansToRedactions } from "@/lib/redact";
import { rasterizeRedactedPage } from "@/lib/editorRaster";
import { exportEditedPdf, type RasterPage, type RectObj, type PageModel } from "@/lib/editor";
import type { RedactType } from "@/lib/ai";
import Dropzone from "@/components/Dropzone";
import PdfResult from "@/components/PdfResult";

type Span = { text: string; type: RedactType };

export default function RedactPage() {
  const [file, setFile] = useState<File | null>(null);
  const [buf, setBuf] = useState<ArrayBuffer | null>(null);
  const [spans, setSpans] = useState<Span[]>([]);
  const [chosen, setChosen] = useState<Record<number, boolean>>({});
  const [secure, setSecure] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Uint8Array | null>(null);
  const { usage, consume } = useGuestTask();

  async function pick(files: FileList | null) {
    setError(null);
    setSpans([]);
    setResult(null);
    const f0 = files?.[0];
    if (!f0) return;
    const v = validateDocFile(f0);
    if (!v.ok) {
      setError(v.reason);
      return;
    }
    try {
      setBusy(true);
      const f = await anyFileToPdf(f0);
      setFile(f);
      setBuf(await f.arrayBuffer());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this file.");
    } finally {
      setBusy(false);
    }
  }

  async function detect() {
    if (!buf) return;
    setError(null);
    setBusy(true);
    setSpans([]);
    setResult(null);
    try {
      const blocked = await consume();
      if (blocked) {
        setError(blocked);
        return;
      }
      setStatus("Reading document text…");
      const text = await extractPdfText(buf.slice(0));
      if (text.trim().length < 10) {
        throw new Error("This PDF has no extractable text. Run OCR first, then redact.");
      }
      setStatus("Asking AI to find sensitive data…");
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "redact-detect", text }),
      });
      const data = await res.json();
      if (res.status === 503) throw new Error("AI features aren't enabled on this server.");
      if (!res.ok) throw new Error(data.error || "Detection failed.");
      const found = (data.spans ?? []) as Span[];
      setSpans(found);
      setChosen(Object.fromEntries(found.map((_, i) => [i, true])));
      if (!found.length) setError("No personal data detected.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not detect sensitive data.");
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  async function applyRedactions() {
    if (!buf) return;
    setError(null);
    setBusy(true);
    setResult(null);
    try {
      const selected = spans.filter((_, i) => chosen[i]).map((s) => s.text);
      if (!selected.length) throw new Error("Select at least one item to redact.");

      setStatus("Locating text on the pages…");
      const pageItems = await extractPageItems(buf.slice(0));
      const redByPage = spansToRedactions(pageItems, selected);
      const pageIdxs = Object.keys(redByPage).map(Number);
      if (!pageIdxs.length) {
        throw new Error("Couldn't locate the selected text on the pages.");
      }

      const models: PageModel[] = [];
      for (const [pi, rects] of Object.entries(redByPage)) models[Number(pi)] = rects as RectObj[];

      const rasterPages: Record<number, RasterPage> = {};
      if (secure) {
        for (const pi of pageIdxs) {
          setStatus(`Securely redacting page ${pi + 1}…`);
          rasterPages[pi] = await rasterizeRedactedPage(buf.slice(0), pi, redByPage[pi]);
        }
      }

      setStatus("Building redacted PDF…");
      const out = await exportEditedPdf(buf.slice(0), models, { rasterPages });
      setResult(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not redact this PDF.");
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">AI auto-redaction</h1>
      <p className="mt-1 text-muted">
        Let AI find names, emails, phone numbers, IDs and more — then truly remove them.
      </p>
      <p className="mt-2 text-xs text-muted">
        Private: only the document&apos;s text is sent to the AI to find PII; the redaction happens in
        your browser.
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
              <p className="mt-1 text-sm text-muted">PDF, Word, image & more — converted to PDF · or</p>
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
          <button onClick={() => { setFile(null); setBuf(null); setSpans([]); setResult(null); }} className="text-sm font-medium text-brand-600 underline">
            Change
          </button>
        </div>
      )}

      {file && spans.length === 0 && (
        <button
          onClick={detect}
          disabled={busy}
          className="mt-6 rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {busy ? status || "Scanning…" : "Find sensitive data"}
        </button>
      )}

      {busy && status && <p className="mt-3 text-sm text-muted">{status}</p>}

      {spans.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-sm font-semibold text-ink">
            Found {spans.length} item{spans.length === 1 ? "" : "s"} — choose what to redact:
          </p>
          <div className="max-h-72 space-y-1 overflow-auto rounded-xl border border-slate-200 bg-white p-3">
            {spans.map((s, i) => (
              <label key={i} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!chosen[i]}
                  onChange={(e) => setChosen((c) => ({ ...c, [i]: e.target.checked }))}
                />
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase text-muted">
                  {s.type}
                </span>
                <span className="font-mono">{s.text}</span>
              </label>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={secure} onChange={(e) => setSecure(e.target.checked)} className="mt-1" />
              <span>
                <strong>Secure redact (recommended)</strong> — flattens affected pages to images so the
                hidden text is genuinely removed and can&apos;t be copied back out. Uncheck for a faster
                visual-only black box (text stays in the file).
              </span>
            </label>
          </div>

          <button
            onClick={applyRedactions}
            disabled={busy}
            className="mt-4 rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {busy ? status || "Redacting…" : "Redact & export"}
          </button>
        </div>
      )}

      {result && <PdfResult bytes={result} fileName="docuscan-redacted.pdf" title="Redacted PDF ready" />}
    </div>
  );
}
