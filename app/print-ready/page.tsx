"use client";

/**
 * /print-ready — Print Ready PDF.
 *
 * Normalize a PDF for printing: page size (A4/Letter/keep), even margins,
 * optional grayscale (rasterized) and page numbers. All processing is in the
 * browser via lib/printReady.ts — the file never leaves the device.
 */

import { useState } from "react";
import Dropzone from "@/components/Dropzone";
import PdfResult from "@/components/PdfResult";
import Select from "@/components/Select";
import { validatePdfFile, formatBytes } from "@/lib/limits";
import { useGuestTask } from "@/lib/useGuestTask";
import type { PageSize, PrintOptions } from "@/lib/printReady";

const MARGINS: { value: string; label: string }[] = [
  { value: "0", label: "None" },
  { value: "18", label: "Small (0.25in)" },
  { value: "36", label: "Standard (0.5in)" },
  { value: "54", label: "Wide (0.75in)" },
];

export default function PrintReadyPage() {
  const [file, setFile] = useState<File | null>(null);
  const [pageSize, setPageSize] = useState<PageSize>("a4");
  const [margin, setMargin] = useState("36");
  const [grayscale, setGrayscale] = useState(true);
  const [pageNumbers, setPageNumbers] = useState(true);
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { usage, consume } = useGuestTask();

  function pick(files: FileList | null) {
    setError(null);
    setResult(null);
    const f = files?.[0];
    if (!f) return;
    const v = validatePdfFile(f);
    if (!v.ok) {
      setError(v.reason);
      return;
    }
    setFile(f);
  }

  async function run() {
    if (!file) return;
    setError(null);
    setBusy(true);
    setResult(null);
    setStatus("Preparing…");
    try {
      const blocked = await consume();
      if (blocked) {
        setError(blocked);
        return;
      }
      const opts: PrintOptions = {
        pageSize,
        margin: Number(margin) || 0,
        grayscale,
        pageNumbers,
      };
      const { prepareForPrint } = await import("@/lib/printReady");
      const buf = await file.arrayBuffer();
      const out = await prepareForPrint(buf, opts, (done, total) =>
        setStatus(grayscale ? `Converting page ${done} / ${total}…` : "Preparing…"),
      );
      setResult(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not prepare this PDF for print.");
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Print Ready PDF</h1>
      <p className="mt-1 text-muted">
        Optimize any PDF for the print shop — fix the page size, add margins, convert to black &
        white and number the pages.
      </p>
      <p className="mt-2 text-xs text-muted">
        Your files are processed securely in your browser; nothing is uploaded.
      </p>
      {usage && (
        <p className="mt-2 text-xs text-muted">
          Free tasks left today: <span className="font-semibold">{usage.remaining}</span> /{" "}
          {usage.limit}
        </p>
      )}

      {!file && (
        <Dropzone onFiles={pick} accept="application/pdf,.pdf" className="mt-5">
          {(open) => (
            <>
              <p className="font-medium text-ink">Drop a PDF here</p>
              <p className="mt-1 text-sm text-muted">or</p>
              <button
                onClick={open}
                className="mt-3 rounded-xl bg-brand-500 px-5 py-2.5 font-semibold text-white hover:bg-brand-600"
              >
                Choose PDF
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

      {file && !result && (
        <>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div>
              <p className="font-medium text-ink">{file.name}</p>
              <p className="text-sm text-muted">{formatBytes(file.size)}</p>
            </div>
            <button
              onClick={() => setFile(null)}
              className="text-sm font-medium text-brand-600 underline"
            >
              Change
            </button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-muted">Page size</span>
              <Select
                ariaLabel="Page size"
                value={pageSize}
                onChange={(v) => setPageSize(v as PageSize)}
                options={[
                  { value: "a4", label: "A4" },
                  { value: "letter", label: "US Letter" },
                  { value: "keep", label: "Keep original" },
                ]}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted">Margins</span>
              <Select
                ariaLabel="Margins"
                value={margin}
                onChange={setMargin}
                options={MARGINS}
              />
            </label>
          </div>

          <div className="mt-4 space-y-2">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={grayscale}
                onChange={(e) => setGrayscale(e.target.checked)}
                className="h-4 w-4 accent-brand-500"
              />
              Convert to black &amp; white (cheaper to print)
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={pageNumbers}
                onChange={(e) => setPageNumbers(e.target.checked)}
                className="h-4 w-4 accent-brand-500"
              />
              Add page numbers
            </label>
          </div>

          {grayscale && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Black &amp; white re-renders each page as an image, so selectable text becomes flat.
              Run OCR afterwards if you need it searchable.
            </p>
          )}

          <button
            onClick={run}
            disabled={busy}
            className="press mt-5 rounded-xl bg-brand-500 px-6 py-2.5 font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {busy ? status || "Preparing…" : "Prepare for print"}
          </button>
          {busy && status && <p className="mt-3 text-sm text-muted">{status}</p>}
        </>
      )}

      {result && (
        <div className="mt-6">
          <PdfResult
            bytes={result}
            fileName={(file?.name?.replace(/\.pdf$/i, "") || "document") + "-print-ready.pdf"}
            title="Print-ready PDF is ready"
            note="Optimized for printing. Send it to your print shop or print at home."
          />
          <button
            onClick={() => {
              setResult(null);
            }}
            className="mt-4 text-sm font-medium text-brand-600 underline"
          >
            Adjust settings
          </button>
        </div>
      )}
    </div>
  );
}
