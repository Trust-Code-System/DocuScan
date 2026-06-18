"use client";

import { useState } from "react";
import { mergePdfs } from "@/lib/pdf";
import { validateDocFile, formatBytes, MAX_MERGE_FILES } from "@/lib/limits";
import { anyFileToPdf } from "@/lib/toPdf";
import { useGuestTask } from "@/lib/useGuestTask";
import Dropzone from "@/components/Dropzone";
import PdfResult from "@/components/PdfResult";

type Item = { id: string; file: File };

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function MergePdfPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Uint8Array | null>(null);
  const { usage, consume } = useGuestTask();
  const [converting, setConverting] = useState(false);

  async function addFiles(files: FileList | null) {
    if (!files) return;
    setError(null);
    setResult(null);
    const next: Item[] = [];
    const rejected: string[] = [];
    setConverting(true);
    try {
      for (const file of Array.from(files)) {
        const v = validateDocFile(file);
        if (!v.ok) {
          rejected.push(v.reason);
          continue;
        }
        try {
          next.push({ id: uid(), file: await anyFileToPdf(file) });
        } catch (e) {
          rejected.push(e instanceof Error ? e.message : `Couldn't read "${file.name}".`);
        }
      }
    } finally {
      setConverting(false);
    }
    setItems((prev) => {
      const room = MAX_MERGE_FILES - prev.length;
      if (room <= 0) {
        rejected.push(`You can merge up to ${MAX_MERGE_FILES} files at once.`);
        return prev;
      }
      return [...prev, ...next.slice(0, room)];
    });
    if (rejected.length) setError(rejected.join(" "));
  }

  function move(id: string, dir: -1 | 1) {
    setResult(null);
    setItems((prev) => {
      const i = prev.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const copy = [...prev];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  function remove(id: string) {
    setResult(null);
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  async function merge() {
    setError(null);
    setBusy(true);
    try {
      const blocked = await consume();
      if (blocked) {
        setError(blocked);
        return;
      }
      const buffers = await Promise.all(items.map((x) => x.file.arrayBuffer()));
      const bytes = await mergePdfs(buffers);
      setResult(bytes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not merge these PDFs.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Merge PDF</h1>
      <p className="mt-1 text-muted">Combine several PDFs into one. Drag to reorder.</p>
      {usage && (
        <p className="mt-2 text-xs text-muted">
          Free tasks left today: <span className="font-semibold">{usage.remaining}</span> /{" "}
          {usage.limit}
        </p>
      )}

      <Dropzone onFiles={addFiles} multiple className="mt-5">
        {(open) => (
          <>
            <p className="font-medium text-ink">Drop files here</p>
            <p className="mt-1 text-sm text-muted">
              {converting ? "Converting to PDF…" : "PDF, Word, images & more — converted to PDF · or"}
            </p>
            <button
              onClick={open}
              className="mt-3 rounded-xl bg-brand-500 px-5 py-2.5 font-semibold text-white hover:bg-brand-600"
            >
              Choose files
            </button>
          </>
        )}
      </Dropzone>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {items.length > 0 && (
        <>
          <ul className="mt-6 space-y-2">
            {items.map((x, i) => (
              <li
                key={x.id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-slate-100 text-xs font-semibold text-muted">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{x.file.name}</p>
                  <p className="text-xs text-muted">{formatBytes(x.file.size)}</p>
                </div>
                <div className="flex gap-1">
                  <SmallBtn label="Up" onClick={() => move(x.id, -1)} disabled={i === 0}>
                    ↑
                  </SmallBtn>
                  <SmallBtn
                    label="Down"
                    onClick={() => move(x.id, 1)}
                    disabled={i === items.length - 1}
                  >
                    ↓
                  </SmallBtn>
                  <SmallBtn label="Remove" onClick={() => remove(x.id)} danger>
                    ✕
                  </SmallBtn>
                </div>
              </li>
            ))}
          </ul>

          <button
            onClick={merge}
            disabled={busy || items.length < 2}
            className="mt-6 rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {busy ? "Merging…" : `Merge ${items.length} PDF${items.length > 1 ? "s" : ""}`}
          </button>
          {items.length < 2 && (
            <p className="mt-2 text-xs text-muted">Add at least 2 PDFs to merge.</p>
          )}
        </>
      )}

      {result && <PdfResult bytes={result} fileName="docuscan-merged.pdf" title="Merged PDF ready" />}
    </div>
  );
}

function SmallBtn({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`grid h-8 w-8 place-items-center rounded-md border text-sm transition disabled:opacity-30 ${
        danger
          ? "border-red-200 text-red-600 hover:bg-red-50"
          : "border-slate-200 text-slate-600 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}
