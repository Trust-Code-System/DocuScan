"use client";

import { useState } from "react";
import { addPageNumbers, type NumberFormat, type NumberPosition } from "@/lib/pdf";
import { validateDocFile, formatBytes } from "@/lib/limits";
import { anyFileToPdf } from "@/lib/toPdf";
import { useGuestTask } from "@/lib/useGuestTask";
import Dropzone from "@/components/Dropzone";
import PdfResult from "@/components/PdfResult";
import Select from "@/components/Select";

const FORMATS: { value: NumberFormat; label: string; sample: string }[] = [
  { value: "plain", label: "Number", sample: "1" },
  { value: "fraction", label: "Number / total", sample: "1 / 10" },
  { value: "verbose", label: "Page x of y", sample: "Page 1 of 10" },
];

const POSITIONS: { value: NumberPosition; label: string }[] = [
  { value: "bottom-center", label: "Bottom center" },
  { value: "bottom-right", label: "Bottom right" },
  { value: "top-right", label: "Top right" },
];

export default function PageNumbersPage() {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<NumberFormat>("plain");
  const [position, setPosition] = useState<NumberPosition>("bottom-center");
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
      const bytes = await addPageNumbers(buf, { format, position });
      setResult(bytes);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not add page numbers (the PDF may be encrypted).",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Add page numbers</h1>
      <p className="mt-1 text-muted">Stamp numbers onto every page of a PDF.</p>
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
            <p className="mb-2 text-sm font-semibold text-ink">Format</p>
            <div className="grid grid-cols-3 gap-2">
              {FORMATS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => {
                    setFormat(f.value);
                    setResult(null);
                  }}
                  className={`rounded-xl border p-3 text-left transition ${
                    format === f.value
                      ? "border-brand-500 bg-brand-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <span className="block font-semibold text-ink">{f.label}</span>
                  <span className="block text-xs text-muted">{f.sample}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <label htmlFor="pos" className="mb-2 block text-sm font-semibold text-ink">
              Position
            </label>
            <Select
              id="pos"
              ariaLabel="Position"
              className="w-full"
              value={position}
              onChange={(v) => {
                setPosition(v as NumberPosition);
                setResult(null);
              }}
              options={POSITIONS}
            />
          </div>

          <button
            onClick={run}
            disabled={busy}
            className="mt-6 rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {busy ? "Working…" : "Add page numbers"}
          </button>
        </>
      )}

      {result && (
        <PdfResult bytes={result} fileName="docuscan-numbered.pdf" title="Numbered PDF ready" />
      )}
    </div>
  );
}
