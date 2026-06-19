"use client";

/**
 * /translate — AI translate document (Phase B3).
 *
 * Extracts text in the browser (pdf.js, OCR fallback), translates via Claude
 * (task "translate", structured blocks preserving headings/lists/tables), then
 * re-renders to a clean PDF or DOCX.
 */

import { useEffect, useState } from "react";
import { extractAnyText } from "@/lib/extractText";
import { LANGUAGES } from "@/lib/i18n";
import { validateDocFile, formatBytes } from "@/lib/limits";
import { useGuestTask } from "@/lib/useGuestTask";
import { blocksToPdf, blocksToDocxBlob } from "@/lib/docExport";
import Dropzone from "@/components/Dropzone";
import type { DocBlock } from "@/lib/ai";
import PdfResult from "@/components/PdfResult";
import Select from "@/components/Select";

// Translation targets — the full supported language set (shared with the UI
// language switcher via lib/i18n), minus the "no-op" English-to-English entry
// only when it's the source; we keep English so users can translate *into* it.
const LANGS = LANGUAGES.map((l) => l.name);

export default function TranslatePage() {
  const [file, setFile] = useState<File | null>(null);
  const [target, setTarget] = useState("English");
  const [blocks, setBlocks] = useState<DocBlock[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const { usage, consume } = useGuestTask();

  // Preset the target when arrived from the language switcher (/translate?to=…).
  useEffect(() => {
    const to = new URLSearchParams(window.location.search).get("to");
    if (to && LANGS.includes(to)) setTarget(to);
  }, []);

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

  async function translate() {
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

      setStatus(`Translating to ${target}…`);
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "translate", text, targetLang: target }),
      });
      const data = await res.json();
      if (res.status === 503) throw new Error("AI features aren't enabled on this server.");
      if (!res.ok) throw new Error(data.error || "Translation failed.");
      const b = (data.blocks ?? []) as DocBlock[];
      if (!b.length) throw new Error("The AI returned an empty document.");
      setBlocks(b);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not translate this document.");
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
      a.download = "docuscan-translated.docx";
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
      <h1 className="text-2xl font-bold sm:text-3xl">Translate document</h1>
      <p className="mt-1 text-muted">
        Translate a document into another language, keeping its structure — then export to PDF or Word.
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
            <span className="mb-1 block text-muted">Translate to</span>
            <Select
              ariaLabel="Translate to"
              value={target}
              onChange={setTarget}
              options={LANGS.map((l) => ({ value: l, label: l }))}
            />
          </label>
          <button
            onClick={translate}
            disabled={busy}
            className="rounded-xl bg-brand-500 px-6 py-2.5 font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {busy ? status || "Translating…" : "Translate"}
          </button>
        </div>
      )}

      {busy && status && <p className="mt-3 text-sm text-muted">{status}</p>}

      {blocks && (
        <div className="mt-6">
          <p className="mb-2 text-sm font-semibold text-ink">Translated ({target}) — preview:</p>
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
        <PdfResult bytes={pdfBytes} fileName="docuscan-translated.pdf" title="Translated PDF ready" />
      )}
    </div>
  );
}
