"use client";

import { useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { compressPdf, type CompressLevel } from "@/lib/compress";
import { validateDocFile, formatBytes } from "@/lib/limits";
import { anyFileToPdf } from "@/lib/toPdf";
import { useGuestTask } from "@/lib/useGuestTask";
import Dropzone from "@/components/Dropzone";
import { track, Events } from "@/lib/analytics";
import {
  clearBatchSession,
  fileToStoredBatchItem,
  loadBatchSession,
  saveBatchSession,
  storedItemToFile,
} from "@/lib/batchSession";

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
  const [zipBytes, setZipBytes] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { usage, consume } = useGuestTask();
  const [converting, setConverting] = useState(false);
  const restoredRef = useRef(false);
  const zipUrlRef = useRef<string | null>(null);

  function clearZip() {
    if (zipUrlRef.current) URL.revokeObjectURL(zipUrlRef.current);
    zipUrlRef.current = null;
    setZipUrl(null);
    setZipBytes(null);
  }

  function setZipFromBytes(bytes: Uint8Array) {
    if (zipUrlRef.current) URL.revokeObjectURL(zipUrlRef.current);
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/zip" }));
    zipUrlRef.current = url;
    setZipBytes(bytes);
    setZipUrl(url);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await loadBatchSession();
      if (cancelled) return;
      if (session) {
        setLevel(session.level);
        setItems(
          session.items.map((it) => ({
            file: storedItemToFile(it),
            status: it.status,
            outSize: it.outSize,
          })),
        );
        if (session.zip) setZipFromBytes(new Uint8Array(session.zip.bytes.slice(0)));
      }
      restoredRef.current = true;
    })();

    return () => {
      cancelled = true;
      if (zipUrlRef.current) URL.revokeObjectURL(zipUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!restoredRef.current) return;
    const timeout = window.setTimeout(() => {
      void (async () => {
        if (items.length === 0 && !zipBytes) {
          await clearBatchSession();
          return;
        }

        const storedZipBytes = zipBytes ? new Uint8Array(zipBytes).buffer : undefined;

        await saveBatchSession({
          level,
          items: await Promise.all(
            items.map((it) =>
              fileToStoredBatchItem(
                it.file,
                it.status === "working" ? "queued" : it.status,
                it.outSize,
              ),
            ),
          ),
          zip: storedZipBytes
            ? { name: "docuscan-batch.zip", type: "application/zip", bytes: storedZipBytes }
            : undefined,
        });
      })();
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [items, level, zipBytes]);

  async function add(files: FileList | null) {
    setError(null);
    clearZip();
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
    clearZip();
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
      setZipFromBytes(new Uint8Array(await blob.arrayBuffer()));
      track(Events.ToolResult, { tool: "batch", count: results.length });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Batch processing failed.");
    } finally {
      setBusy(false);
    }
  }

  const totalIn = items.reduce((s, it) => s + it.file.size, 0);
  const totalOut = items.reduce((s, it) => s + (it.outSize ?? 0), 0);

  async function clearAll() {
    setItems([]);
    setError(null);
    clearZip();
    await clearBatchSession();
  }

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
              {converting ? "Converting to PDF..." : "PDF, Word, images and more - converted to PDF - or"}
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
                  onClick={() => {
                    setLevel(l.value);
                    clearZip();
                  }}
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
                  {it.status === "working" && "Compressing..."}
                  {it.status === "done" && `-> ${formatBytes(it.outSize ?? 0)} done`}
                  {it.status === "error" && <span className="text-red-600">failed</span>}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={run}
              disabled={busy}
              className="rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
            >
              {busy ? "Processing..." : `Compress ${items.length} file${items.length > 1 ? "s" : ""}`}
            </button>
            <button
              type="button"
              onClick={clearAll}
              disabled={busy}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-ink hover:bg-slate-50 disabled:opacity-60"
            >
              Clear
            </button>
          </div>
        </>
      )}

      {zipUrl && (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-ink">Batch ready</h2>
          <p className="mt-1 text-sm text-muted">
            {formatBytes(totalIn)} to {formatBytes(totalOut)} across {items.length} files.
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
