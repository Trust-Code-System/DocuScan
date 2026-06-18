"use client";

import { useState } from "react";
import { ocrPdf, OCR_LANGS, type OcrProgress } from "@/lib/ocr";
import { validateDocFile, formatBytes } from "@/lib/limits";
import { anyFileToPdf } from "@/lib/toPdf";
import { useGuestTask } from "@/lib/useGuestTask";
import Dropzone from "@/components/Dropzone";
import PdfResult from "@/components/PdfResult";
import Select from "@/components/Select";

export default function OcrPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [lang, setLang] = useState("eng");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [result, setResult] = useState<{ bytes: Uint8Array; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const { usage, consume } = useGuestTask();

  async function pick(files: FileList | null) {
    setError(null);
    setResult(null);
    const f = files?.[0];
    if (!f) return;
    const v = validateDocFile(f);
    if (!v.ok) {
      setError(v.reason);
      return;
    }
    try {
      setBusy(true);
      setFile(await anyFileToPdf(f));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this file.");
    } finally {
      setBusy(false);
    }
  }

  async function run() {
    if (!file) return;
    setError(null);
    setBusy(true);
    setProgress(null);
    setResult(null);
    setCopied(false);
    try {
      const blocked = await consume();
      if (blocked) {
        setError(blocked);
        return;
      }
      const buf = await file.arrayBuffer();
      const res = await ocrPdf(buf, lang, setProgress);
      setResult(res);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not OCR this PDF (it may be encrypted or corrupt).",
      );
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  function downloadText() {
    if (!result) return;
    const blob = new Blob([result.text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "docuscan-text.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyText() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be blocked; the download button still works */
    }
  }

  // Tesseract reports a 0..1 fraction per status; surface it as a rough page %.
  const pct = progress ? Math.round(progress.fraction * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">OCR PDF</h1>
      <p className="mt-1 text-muted">
        Make a scanned PDF searchable — add a selectable text layer you can copy and search.
      </p>
      {usage && (
        <p className="mt-2 text-xs text-muted">
          Free tasks left today: <span className="font-semibold">{usage.remaining}</span> /{" "}
          {usage.limit}
        </p>
      )}

      <Dropzone onFiles={pick} className="mt-5">
        {(open) =>
          file ? (
            <div>
              <p className="font-medium text-ink">{file.name}</p>
              <p className="mt-1 text-sm text-muted">{formatBytes(file.size)}</p>
              <button
                onClick={open}
                className="mt-3 text-sm font-medium text-brand-600 underline"
              >
                Choose a different file
              </button>
            </div>
          ) : (
            <>
              <p className="font-medium text-ink">Drop a document or image here</p>
              <p className="mt-1 text-sm text-muted">PDF or image (photo, scan) — or</p>
              <button
                onClick={open}
                className="mt-3 rounded-xl bg-brand-500 px-5 py-2.5 font-semibold text-white hover:bg-brand-600"
              >
                Choose file
              </button>
            </>
          )
        }
      </Dropzone>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {file && (
        <>
          <div className="mt-6">
            <label htmlFor="ocr-lang" className="mb-2 block text-sm font-semibold text-ink">
              Document language
            </label>
            <Select
              id="ocr-lang"
              ariaLabel="Document language"
              className="w-full"
              value={lang}
              onChange={(v) => {
                setLang(v);
                setResult(null);
              }}
              options={OCR_LANGS.map((l) => ({ value: l.code, label: l.label }))}
            />
          </div>

          <button
            onClick={run}
            disabled={busy}
            className="mt-6 rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {busy
              ? progress
                ? `Page ${progress.page}/${progress.total} — ${progress.status} ${pct}%`
                : "Starting…"
              : "Make searchable"}
          </button>
          <p className="mt-2 text-xs text-muted">
            Runs in your browser. The first run downloads the language data
            (a few MB) — after that it&apos;s cached and faster.
          </p>
        </>
      )}

      {result && file && (
        <>
          <PdfResult
            bytes={result.bytes}
            fileName="docuscan-searchable.pdf"
            title="Searchable PDF ready"
            note="Text is now selectable and searchable in any PDF reader."
          />

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-ink">Extracted text</h2>
              <div className="flex gap-2">
                <button
                  onClick={copyText}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-ink hover:bg-slate-50"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button
                  onClick={downloadText}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-ink hover:bg-slate-50"
                >
                  Download .txt
                </button>
              </div>
            </div>
            <textarea
              readOnly
              value={result.text || "(No text detected.)"}
              className="mt-3 h-56 w-full resize-y rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-ink"
            />
          </div>
        </>
      )}
    </div>
  );
}
