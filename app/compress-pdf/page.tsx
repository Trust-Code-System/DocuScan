"use client";

import { useState } from "react";
import { compressPdf, type CompressLevel } from "@/lib/compress";
import { validateDocFile, formatBytes } from "@/lib/limits";
import { anyFileToPdf } from "@/lib/toPdf";
import { useGuestTask } from "@/lib/useGuestTask";
import Dropzone from "@/components/Dropzone";
import PdfResult from "@/components/PdfResult";

const LEVELS: { value: CompressLevel; label: string; hint: string }[] = [
  { value: "high", label: "Strong", hint: "Smallest file" },
  { value: "balanced", label: "Balanced", hint: "Recommended" },
  { value: "low", label: "Light", hint: "Best quality" },
];

export default function CompressPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [level, setLevel] = useState<CompressLevel>("balanced");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
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
    setBusy(true);
    setProgress(null);
    setResult(null);
    try {
      const blocked = await consume();
      if (blocked) {
        setError(blocked);
        return;
      }
      const buf = await file.arrayBuffer();
      const bytes = await compressPdf(buf, level, (done, total) =>
        setProgress({ done, total }),
      );
      setResult(bytes);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not compress this PDF (it may be encrypted or corrupt).",
      );
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const newSize = result ? result.byteLength : 0;
  const saved = file && result ? 1 - newSize / file.size : 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Compress PDF</h1>
      <p className="mt-1 text-muted">Shrink a PDF so it&apos;s easy to email or upload.</p>
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
            <p className="mb-2 text-sm font-semibold text-ink">Compression level</p>
            <div className="grid grid-cols-3 gap-2">
              {LEVELS.map((l) => (
                <button
                  key={l.value}
                  onClick={() => {
                    setLevel(l.value);
                    setResult(null);
                  }}
                  className={`rounded-xl border p-3 text-left transition ${
                    level === l.value
                      ? "border-brand-500 bg-brand-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <span className="block font-semibold text-ink">{l.label}</span>
                  <span className="block text-xs text-muted">{l.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={run}
            disabled={busy}
            className="mt-6 rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {busy
              ? progress
                ? `Compressing… page ${progress.done}/${progress.total}`
                : "Working…"
              : "Compress PDF"}
          </button>
          <p className="mt-2 text-xs text-muted">
            Note: compression flattens pages to images, so selectable text becomes
            non-selectable. Run OCR afterwards to make it searchable again.
          </p>
        </>
      )}

      {result && file && (
        <PdfResult
          bytes={result}
          fileName="docuscan-compressed.pdf"
          title="Compressed PDF ready"
          note={
            saved > 0.01
              ? `${formatBytes(file.size)} → ${formatBytes(newSize)} (${Math.round(
                  saved * 100,
                )}% smaller)`
              : `${formatBytes(file.size)} → ${formatBytes(
                  newSize,
                )} — already well optimized; try a stronger level.`
          }
        />
      )}
    </div>
  );
}
