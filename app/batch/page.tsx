"use client";

import { useState } from "react";
import JSZip from "jszip";
import { compressPdf, type CompressLevel } from "@/lib/compress";
import { validateDocFile, formatBytes } from "@/lib/limits";
import { anyFileToPdf } from "@/lib/toPdf";
import { useGuestTask } from "@/lib/useGuestTask";
import Dropzone from "@/components/Dropzone";
import { track, Events } from "@/lib/analytics";

const LEVELS: { value: CompressLevel; label: string }[] = [
  { value: "high", label: "Strong" },
  { value: "balanced", label: "Balanced" },
  { value: "low", label: "Light" },
];

type Item = { file: File; status: "queued" | "working" | "done" | "error"; outSize?: number };

export default function BatchPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [level, setLevel] = useState<CompressLevel>("balanced");
  const [busy, setBusy] = useState(false);
  const [zipUrl, setZipUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { usage, consume } = useGuestTask();
  const [converting, setConverting] = useState(false);

  async function add(files: FileList | null) {
    setError(null);
    setZipUrl(null);
    if (!files) return;
    const next: Item[] = [];
    const rejected: string[] = [];
    setConverting(true);
    try {
      for (const f of Array.from(files)) {
        const v = validateDocFile(f);
        if (!v.ok) {
          rejected.push(v.reason);
          continue;
        }
        try {
          next.push({ file: await anyFileToPdf(f), status: "queued" });
        } catch (e) {
          rejected.push(e instanceof Error ? e.message : `Couldn't read "${f.name}".`);
        }
      }
    } finally {
      setConverting(false);
    }
    if (next.length === 0) {
      setError(rejected.join(" ") || "Add one or more supported files (max 20MB each).");
      return;
    }
    setItems((prev) => [...prev, ...next]);
    if (rejected.length) setError(rejected.join(" "));
  }

  async function run() {
    if (items.length === 0) return;
    setError(null);
    setBusy(true);
    setZipUrl(null);
    try {
      const blocked = await consume();
      if (blocked) {
        setError(blocked);
        return;
      }
      track(Events.ToolRun, { tool: "batch", count: items.length });
      const zip = new JSZip();
      const results = [...items];
      for (let i = 0; i < results.length; i++) {
        results[i] = { ...results[i], status: "working" };
        setItems([...results]);
        try {
          const buf = await results[i].file.arrayBuffer();
          const out = await compressPdf(buf, level);
          const name = results[i].file.name.replace(/\.pdf$/i, "") + "-compressed.pdf";
          zip.file(name, out);
          results[i] = { ...results[i], status: "done", outSize: out.byteLength };
        } catch {
          results[i] = { ...results[i], status: "error" };
        }
        setItems([...results]);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      setZipUrl(URL.createObjectURL(blob));
      track(Events.ToolResult, { tool: "batch", count: results.length });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Batch processing failed.");
    } finally {
      setBusy(false);
    }
  }

  const totalIn = items.reduce((s, it) => s + it.file.size, 0);
  const totalOut = items.reduce((s, it) => s + (it.outSize ?? 0), 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Batch compress PDFs</h1>
      <p className="mt-1 text-muted">
        Upload several PDFs, compress them all at once, and download a single ZIP.
      </p>
      {usage && (
        <p className="mt-2 text-xs text-muted">
          Free tasks left today: <span className="font-semibold">{usage.remaining}</span> /{" "}
          {usage.limit}
        </p>
      )}

      <Dropzone onFiles={add} multiple className="mt-5">
        {(open) => (
          <>
            <p className="font-medium text-ink">Drop files here</p>
            <p className="mt-1 text-sm text-muted">
              {converting ? "Converting to PDF…" : "PDF, Word, images & more — converted to PDF · or"}
            </p>
            <button
              type="button"
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
          <div className="mt-6">
            <p className="mb-2 text-sm font-semibold text-ink">Compression level</p>
            <div className="grid grid-cols-3 gap-2">
              {LEVELS.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  onClick={() => setLevel(l.value)}
                  className={`rounded-xl border p-3 font-semibold transition ${
                    level === l.value
                      ? "border-brand-500 bg-brand-50 text-ink"
                      : "border-slate-200 bg-white text-ink hover:border-slate-300"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <ul className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {items.map((it, i) => (
              <li key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="truncate pr-3 text-ink">{it.file.name}</span>
                <span className="shrink-0 text-muted">
                  {it.status === "queued" && formatBytes(it.file.size)}
                  {it.status === "working" && "Compressing…"}
                  {it.status === "done" && `→ ${formatBytes(it.outSize ?? 0)} ✓`}
                  {it.status === "error" && <span className="text-red-600">failed</span>}
                </span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={run}
            disabled={busy}
            className="mt-6 rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {busy ? "Processing…" : `Compress ${items.length} file${items.length > 1 ? "s" : ""}`}
          </button>
        </>
      )}

      {zipUrl && (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-ink">Batch ready</h2>
          <p className="mt-1 text-sm text-muted">
            {formatBytes(totalIn)} → {formatBytes(totalOut)} across {items.length} files.
          </p>
          <a
            href={zipUrl}
            download="docuscan-batch.zip"
            className="mt-3 inline-block rounded-xl bg-brand-500 px-5 py-2.5 font-semibold text-white hover:bg-brand-600"
          >
            Download ZIP
          </a>
        </div>
      )}
    </div>
  );
}
