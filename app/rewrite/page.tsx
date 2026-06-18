"use client";

/**
 * /rewrite — AI rewrite / simplify a document (Phase C2).
 *
 * Extracts text in the browser (pdf.js, OCR fallback), rewrites it in the chosen
 * style via Claude (task "rewrite", structured blocks preserving structure), then
 * re-renders to a clean PDF or DOCX. Only the text is sent; the file stays local.
 */

import { useState } from "react";
import { extractAnyText } from "@/lib/extractText";
import { validateDocFile, formatBytes } from "@/lib/limits";
import { useGuestTask } from "@/lib/useGuestTask";
import { blocksToPdf, blocksToDocxBlob } from "@/lib/docExport";
import Dropzone from "@/components/Dropzone";
import type { DocBlock, RewriteStyle } from "@/lib/ai";
import PdfResult from "@/components/PdfResult";
import Select from "@/components/Select";

const STYLES: { value: RewriteStyle; label: string; hint: string }[] = [
  { value: "simplify", label: "Simplify", hint: "Plain language, ~8th-grade reading level" },
  { value: "shorten", label: "Shorten", hint: "Tighter and shorter, same meaning" },
  { value: "professional", label: "Professional", hint: "Clear, confident business tone" },
  { value: "formal", label: "Formal", hint: "Polished, official tone" },
  { value: "friendly", label: "Friendly", hint: "Warm and approachable" },
];

export default function RewritePage() {
  const [file, setFile] = useState<File | null>(null);
  const [style, setStyle] = useState<RewriteStyle>("simplify");
  const [blocks, setBlocks] = useState<DocBlock[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const { usage, consume } = useGuestTask();

  const hint = STYLES.find((s) => s.value === style)?.hint;

  function pick(files: FileList | null) {
    setError(null);
    setBlocks(null);
    setPdfBytes(null);
    const f = files?.[0];
    if (!f) return;
    const v = validateDocFile(f);
    if (!v.ok) {
      setError(v.reason);
      return;
    }
    setFile(f);
  }

  async function rewrite() {
    if (!file) return;
    setError(null);
    setBusy(true);
    setBlocks(null);
    setPdfBytes(null);
    try {
      const blocked = await consume();
      if (blocked) {
        setError(blocked);
        return;
      }
      const text = await extractAnyText(file, setStatus);

      setStatus("Rewriting…");
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "rewrite", text, style }),
      });
      const data = await res.json();
      if (res.status === 503) throw new Error("AI features aren't enabled on this server.");
      if (!res.ok) throw new Error(data.error || "Rewrite failed.");
      const b = (data.blocks ?? []) as DocBlock[];
      if (!b.length) throw new Error("The AI returned an empty document.");
      setBlocks(b);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not rewrite this document.");
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  async function exportPdf() {
    if (!blocks) return;
    setBusy(true);
    try {
      setPdfBytes(await blocksToPdf(blocks));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not export PDF.");
    } finally {
      setBusy(false);
    }
  }

  async function exportDocx() {
    if (!blocks) return;
    setBusy(true);
    try {
      const blob = await blocksToDocxBlob(blocks);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "docuscan-rewritten.docx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not export DOCX.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Rewrite &amp; simplify</h1>
      <p className="mt-1 text-muted">
        Rewrite a document in plainer language or a different tone, keeping its structure — then
        export to PDF or Word.
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
          <button onClick={() => { setFile(null); setBlocks(null); setPdfBytes(null); }} className="text-sm font-medium text-brand-600 underline">
            Change
          </button>
        </div>
      )}

      {file && (
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-muted">Style</span>
            <Select
              ariaLabel="Style"
              value={style}
              onChange={(v) => setStyle(v as RewriteStyle)}
              options={STYLES}
            />
          </label>
          <button
            onClick={rewrite}
            disabled={busy}
            className="rounded-xl bg-brand-500 px-6 py-2.5 font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {busy ? status || "Rewriting…" : "Rewrite"}
          </button>
          {hint && <p className="w-full text-xs text-muted">{hint}</p>}
        </div>
      )}

      {busy && status && <p className="mt-3 text-sm text-muted">{status}</p>}

      {blocks && (
        <div className="mt-6">
          <p className="mb-2 text-sm font-semibold text-ink">Rewritten — preview:</p>
          <div className="max-h-80 space-y-2 overflow-auto rounded-xl border border-slate-200 bg-white p-4 text-sm">
            {blocks.map((b, i) => {
              if (b.type === "heading")
                return (
                  <p key={i} className="font-bold text-ink" style={{ fontSize: b.level === 1 ? 18 : 15 }}>
                    {b.text}
                  </p>
                );
              if (b.type === "list")
                return (
                  <ul key={i} className="list-disc pl-5 text-ink">
                    {(b.items ?? []).map((it, j) => (
                      <li key={j}>{it}</li>
                    ))}
                  </ul>
                );
              if (b.type === "table")
                return (
                  <table key={i} className="w-full border-collapse text-xs">
                    <tbody>
                      {(b.rows ?? []).map((r, ri) => (
                        <tr key={ri}>
                          {r.map((c, ci) => (
                            <td key={ci} className="border border-slate-200 px-2 py-1">
                              {c}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              return (
                <p key={i} className="text-ink">
                  {b.text}
                </p>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={exportPdf}
              disabled={busy}
              className="rounded-xl bg-brand-500 px-5 py-2.5 font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
            >
              Export PDF
            </button>
            <button
              onClick={exportDocx}
              disabled={busy}
              className="rounded-xl border border-slate-300 px-5 py-2.5 font-semibold text-ink hover:bg-slate-50 disabled:opacity-60"
            >
              Export Word (.docx)
            </button>
          </div>
        </div>
      )}

      {pdfBytes && (
        <PdfResult bytes={pdfBytes} fileName="docuscan-rewritten.pdf" title="Rewritten PDF ready" />
      )}
    </div>
  );
}
