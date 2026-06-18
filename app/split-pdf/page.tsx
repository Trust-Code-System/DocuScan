"use client";

import { useState } from "react";
import JSZip from "jszip";
import { getPageCount, parsePageRange, extractPages, splitToSinglePages } from "@/lib/pdf";
import { validateDocFile, formatBytes } from "@/lib/limits";
import { anyFileToPdf } from "@/lib/toPdf";
import { useGuestTask } from "@/lib/useGuestTask";
import Dropzone from "@/components/Dropzone";
import PdfResult from "@/components/PdfResult";

type Mode = "extract" | "all";

export default function SplitPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>("extract");
  const [range, setRange] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Uint8Array | null>(null);
  const { usage, consume } = useGuestTask();

  async function pick(files: FileList | null) {
    setError(null);
    setResult(null);
    setPageCount(null);
    const f0 = files?.[0];
    if (!f0) return;
    const v = validateDocFile(f0);
    if (!v.ok) {
      setError(v.reason);
      return;
    }
    try {
      const f = await anyFileToPdf(f0);
      setFile(f);
      const count = await getPageCount(await f.arrayBuffer());
      setPageCount(count);
      setRange(`1-${count}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this file.");
      setFile(null);
    }
  }

  async function run() {
    if (!file || pageCount === null) return;
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const blocked = await consume();
      if (blocked) {
        setError(blocked);
        return;
      }
      const buf = await file.arrayBuffer();

      if (mode === "extract") {
        const indices = parsePageRange(range, pageCount);
        const bytes = await extractPages(buf, indices);
        setResult(bytes);
      } else {
        const parts = await splitToSinglePages(buf);
        const zip = new JSZip();
        parts.forEach((p) => zip.file(p.name, p.bytes));
        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "docuscan-pages.zip";
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not split this PDF.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Split PDF</h1>
      <p className="mt-1 text-muted">Extract specific pages, or split every page into its own file.</p>
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
              <p className="mt-1 text-sm text-muted">
                {formatBytes(file.size)}
                {pageCount !== null && ` · ${pageCount} page${pageCount === 1 ? "" : "s"}`}
              </p>
              <button
                onClick={open}
                className="mt-3 text-sm font-medium text-brand-600 underline"
              >
                Choose a different file
              </button>
            </div>
          ) : (
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
          )
        }
      </Dropzone>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {file && pageCount !== null && (
        <>
          <div className="mt-6 space-y-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
              <input
                type="radio"
                name="mode"
                checked={mode === "extract"}
                onChange={() => {
                  setMode("extract");
                  setResult(null);
                }}
                className="mt-1"
              />
              <div className="flex-1">
                <span className="font-semibold text-ink">Extract pages</span>
                <span className="block text-xs text-muted">
                  Keep only the pages you list, as one PDF.
                </span>
                {mode === "extract" && (
                  <input
                    value={range}
                    onChange={(e) => {
                      setRange(e.target.value);
                      setResult(null);
                    }}
                    placeholder="e.g. 1-3, 5, 8-10"
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                  />
                )}
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
              <input
                type="radio"
                name="mode"
                checked={mode === "all"}
                onChange={() => {
                  setMode("all");
                  setResult(null);
                }}
                className="mt-1"
              />
              <div className="flex-1">
                <span className="font-semibold text-ink">Split into single pages</span>
                <span className="block text-xs text-muted">
                  One PDF per page, downloaded together as a ZIP.
                </span>
              </div>
            </label>
          </div>

          <button
            onClick={run}
            disabled={busy}
            className="mt-6 rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {busy ? "Working…" : mode === "extract" ? "Extract pages" : "Split & download ZIP"}
          </button>
        </>
      )}

      {result && (
        <PdfResult bytes={result} fileName="docuscan-extracted.pdf" title="Extracted pages ready" />
      )}
    </div>
  );
}
