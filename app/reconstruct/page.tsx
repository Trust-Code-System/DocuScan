"use client";

/**
 * /reconstruct — AI "✨ Make editable" (Phase A2).
 *
 * Turns ANY document — text PDFs and scans with no text layer — into a clean,
 * editable document. Text is obtained in the browser (pdf.js, or OCR for scans)
 * so the file never uploads; only the text is sent to Claude (task "reconstruct"),
 * which returns structured blocks. The user edits as markdown, then exports to a
 * clean PDF or DOCX. This is a clean editable document, NOT a pixel-perfect clone.
 */

import { useState } from "react";
import { extractAnyText } from "@/lib/extractText";
import { validateDocFile, formatBytes } from "@/lib/limits";
import { useGuestTask } from "@/lib/useGuestTask";
import { blocksToMarkdown, markdownToBlocks, blocksToPdf, blocksToDocxBlob } from "@/lib/docExport";
import Dropzone from "@/components/Dropzone";
import type { DocBlock } from "@/lib/ai";
import PdfResult from "@/components/PdfResult";

export default function ReconstructPage() {
  const [file, setFile] = useState<File | null>(null);
  const [markdown, setMarkdown] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const { usage, consume } = useGuestTask();

  function pick(files: FileList | null) {
    setError(null);
    setMarkdown("");
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

  async function makeEditable() {
    if (!file) return;
    setError(null);
    setBusy(true);
    setPdfBytes(null);
    setMarkdown("");
    try {
      const blocked = await consume();
      if (blocked) {
        setError(blocked);
        return;
      }
      const text = await extractAnyText(file, setStatus);

      setStatus("Asking AI to reconstruct the document…");
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "reconstruct", text }),
      });
      const data = await res.json();
      if (res.status === 503) throw new Error("AI features aren't enabled on this server.");
      if (!res.ok) throw new Error(data.error || "Reconstruction failed.");

      const blocks = (data.blocks ?? []) as DocBlock[];
      if (!blocks.length) throw new Error("The AI returned an empty document.");
      setMarkdown(blocksToMarkdown(blocks));
      setStatus(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not make this document editable.");
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  async function exportPdf() {
    setError(null);
    setBusy(true);
    try {
      const bytes = await blocksToPdf(markdownToBlocks(markdown));
      setPdfBytes(bytes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not export PDF.");
    } finally {
      setBusy(false);
    }
  }

  async function exportDocx() {
    setError(null);
    setBusy(true);
    try {
      const blob = await blocksToDocxBlob(markdownToBlocks(markdown));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "docuscan-document.docx";
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
      <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
        <span className="material-symbols-outlined text-[28px] text-ai-600" aria-hidden>
          auto_awesome
        </span>
        Make editable
      </h1>
      <p className="mt-1 text-muted">
        Turn any document — even a flat scan with no text layer — into a clean, editable document you
        can rework and export to PDF or Word.
      </p>
      <p className="mt-2 text-xs text-muted">
        Private: the text is extracted in your browser (with OCR for scans) — only the text is sent to
        the AI, never the file. This produces a clean editable document, not a pixel-perfect copy.
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
          <button onClick={() => { setFile(null); setMarkdown(""); setPdfBytes(null); }} className="text-sm font-medium text-brand-600 underline">
            Change
          </button>
        </div>
      )}

      {file && !markdown && (
        <button
          onClick={makeEditable}
          disabled={busy}
          className="press mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white shadow-sm shadow-brand-500/20 transition-colors duration-150 ease-snappy hover:bg-brand-600 disabled:opacity-60"
        >
          {busy ? (
            status || "Working…"
          ) : (
            <>
              <span className="material-symbols-outlined text-xl" aria-hidden>
                auto_awesome
              </span>
              Make editable
            </>
          )}
        </button>
      )}

      {busy && status && <p className="mt-3 text-sm text-muted">{status}</p>}

      {markdown && (
        <div className="mt-6">
          <label className="mb-2 block text-sm font-semibold text-ink">
            Edit your document (markdown: # heading, - list, | tables |)
          </label>
          <textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            rows={20}
            className="w-full rounded-xl border border-slate-300 bg-white p-3 font-mono text-sm"
          />
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
        <PdfResult bytes={pdfBytes} fileName="docuscan-document.pdf" title="Editable PDF ready" />
      )}
    </div>
  );
}
