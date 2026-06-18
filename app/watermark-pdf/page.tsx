"use client";

import { useState } from "react";
import { addWatermark } from "@/lib/pdf";
import { validateDocFile, formatBytes } from "@/lib/limits";
import { anyFileToPdf } from "@/lib/toPdf";
import { useGuestTask } from "@/lib/useGuestTask";
import Dropzone from "@/components/Dropzone";
import PdfResult from "@/components/PdfResult";

export default function WatermarkPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("CONFIDENTIAL");
  const [opacity, setOpacity] = useState(0.18);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Uint8Array | null>(null);
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
    setResult(null);
    setBusy(true);
    try {
      const blocked = await consume();
      if (blocked) {
        setError(blocked);
        return;
      }
      const buf = await file.arrayBuffer();
      const bytes = await addWatermark(buf, text, opacity);
      setResult(bytes);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not watermark this PDF (it may be encrypted).",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Watermark PDF</h1>
      <p className="mt-1 text-muted">Stamp diagonal text across every page.</p>
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

      {file && (
        <>
          <div className="mt-6">
            <label htmlFor="wm-text" className="mb-2 block text-sm font-semibold text-ink">
              Watermark text
            </label>
            <input
              id="wm-text"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setResult(null);
              }}
              maxLength={40}
              placeholder="e.g. CONFIDENTIAL"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-ink"
            />
          </div>

          <div className="mt-5">
            <label htmlFor="wm-op" className="mb-2 block text-sm font-semibold text-ink">
              Opacity: {Math.round(opacity * 100)}%
            </label>
            <input
              id="wm-op"
              type="range"
              min={0.05}
              max={0.5}
              step={0.01}
              value={opacity}
              onChange={(e) => {
                setOpacity(parseFloat(e.target.value));
                setResult(null);
              }}
              className="w-full"
            />
          </div>

          <button
            onClick={run}
            disabled={busy || !text.trim()}
            className="mt-6 rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {busy ? "Working…" : "Add watermark"}
          </button>
        </>
      )}

      {result && (
        <PdfResult
          bytes={result}
          fileName="docuscan-watermarked.pdf"
          title="Watermarked PDF ready"
        />
      )}
    </div>
  );
}
