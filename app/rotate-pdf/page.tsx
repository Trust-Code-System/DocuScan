"use client";

import { useState } from "react";
import { getPageCount, parsePageRange, rotatePdf } from "@/lib/pdf";
import { validateDocFile, formatBytes } from "@/lib/limits";
import { anyFileToPdf } from "@/lib/toPdf";
import { useGuestTask } from "@/lib/useGuestTask";
import Dropzone from "@/components/Dropzone";
import PdfResult from "@/components/PdfResult";

const ANGLES = [
  { value: 90, label: "90° right" },
  { value: 180, label: "180°" },
  { value: 270, label: "90° left" },
];

export default function RotatePdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [angle, setAngle] = useState(90);
  const [scope, setScope] = useState<"all" | "range">("all");
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
      const indices = scope === "range" ? parsePageRange(range, pageCount) : undefined;
      const bytes = await rotatePdf(buf, angle, indices);
      setResult(bytes);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not rotate this PDF (it may be encrypted).",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Rotate PDF</h1>
      <p className="mt-1 text-muted">Turn pages the right way up — all pages or just some.</p>
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
          <div className="mt-6">
            <p className="mb-2 text-sm font-semibold text-ink">Rotation</p>
            <div className="grid grid-cols-3 gap-2">
              {ANGLES.map((a) => (
                <button
                  key={a.value}
                  onClick={() => {
                    setAngle(a.value);
                    setResult(null);
                  }}
                  className={`rounded-xl border p-3 font-semibold transition ${
                    angle === a.value
                      ? "border-brand-500 bg-brand-50 text-ink"
                      : "border-slate-200 bg-white text-ink hover:border-slate-300"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <p className="mb-2 text-sm font-semibold text-ink">Apply to</p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="radio"
                  checked={scope === "all"}
                  onChange={() => {
                    setScope("all");
                    setResult(null);
                  }}
                />
                All pages
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="radio"
                  checked={scope === "range"}
                  onChange={() => {
                    setScope("range");
                    setResult(null);
                  }}
                />
                Specific pages
              </label>
              {scope === "range" && (
                <input
                  value={range}
                  onChange={(e) => {
                    setRange(e.target.value);
                    setResult(null);
                  }}
                  placeholder="e.g. 1-3, 5"
                  className="w-40 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                />
              )}
            </div>
          </div>

          <button
            onClick={run}
            disabled={busy}
            className="mt-6 rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {busy ? "Rotating…" : "Rotate PDF"}
          </button>
        </>
      )}

      {result && (
        <PdfResult bytes={result} fileName="docuscan-rotated.pdf" title="Rotated PDF ready" />
      )}
    </div>
  );
}
