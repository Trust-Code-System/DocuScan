"use client";

/**
 * /convert — universal document conversion hub (roadmap §8).
 *
 * Auto-detects each uploaded file's type and offers only the valid target
 * formats. Conversions run fully in the browser (file never uploads) for every
 * in-browser path; targets marked "server" use /api/convert (a LibreOffice/
 * Gotenberg seam) and are disabled with a note when that service isn't wired.
 * Supports batch (many files of one type) with progress and a download-all ZIP.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Select from "@/components/Select";
import { useFileDrop } from "@/components/Dropzone";
import { formatBytes, MAX_FILE_BYTES } from "@/lib/limits";
import {
  detectKind,
  convert,
  zipFiles,
  TARGETS,
  KIND_LABEL,
  type SourceKind,
  type ConvertFile,
} from "@/lib/convert";

type Item = { file: File; kind: SourceKind | null };
type Output = ConvertFile & { from: string };

export default function ConvertPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [activeKind, setActiveKind] = useState<SourceKind | null>(null);
  const [targetId, setTargetId] = useState<string>("");
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [serverEnabled, setServerEnabled] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { dragActive, dropHandlers } = useFileDrop(add);

  useEffect(() => {
    fetch("/api/convert")
      .then((r) => r.json())
      .then((d) => setServerEnabled(!!d.enabled))
      .catch(() => setServerEnabled(false));
  }, []);

  // Distinct detected kinds + the files that belong to the active one.
  const kinds = useMemo(() => {
    const set = new Set<SourceKind>();
    for (const it of items) if (it.kind) set.add(it.kind);
    return [...set];
  }, [items]);
  const matching = useMemo(
    () => items.filter((it) => it.kind === activeKind),
    [items, activeKind],
  );
  const targets = activeKind ? TARGETS[activeKind] : [];
  const target = targets.find((t) => t.id === targetId) || null;

  function add(files: FileList | null) {
    setError(null);
    setOutputs([]);
    if (!files?.length) return;
    const next: Item[] = [];
    for (const f of Array.from(files)) {
      if (f.size > MAX_FILE_BYTES) {
        setError(`"${f.name}" is too large (max ${formatBytes(MAX_FILE_BYTES)}).`);
        continue;
      }
      next.push({ file: f, kind: detectKind(f) });
    }
    const merged = [...items, ...next];
    setItems(merged);
    const firstKind = merged.find((i) => i.kind)?.kind ?? null;
    if (!activeKind && firstKind) {
      setActiveKind(firstKind);
      setTargetId(TARGETS[firstKind][0]?.id ?? "");
    }
  }

  function chooseKind(k: SourceKind) {
    setActiveKind(k);
    setTargetId(TARGETS[k][0]?.id ?? "");
    setOutputs([]);
    setError(null);
  }

  function reset() {
    setItems([]);
    setActiveKind(null);
    setTargetId("");
    setOutputs([]);
    setError(null);
  }

  async function runServer(file: File, ext: string): Promise<ConvertFile> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("target", ext);
    const res = await fetch("/api/convert", { method: "POST", body: fd });
    if (res.status === 503) throw new Error("Server conversion isn't enabled on this server.");
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || "Server conversion failed.");
    }
    const blob = await res.blob();
    return { name: `${file.name.replace(/\.[^.]+$/, "")}.${ext}`, blob };
  }

  async function runAll() {
    if (!target || !matching.length) return;
    setBusy(true);
    setError(null);
    setOutputs([]);
    const collected: Output[] = [];
    try {
      for (let i = 0; i < matching.length; i++) {
        const { file } = matching[i];
        const prefix = matching.length > 1 ? `File ${i + 1}/${matching.length}: ` : "";
        setStatus(`${prefix}converting ${file.name}…`);
        let produced: ConvertFile[];
        if (target.server) {
          produced = [await runServer(file, target.ext)];
        } else {
          produced = await convert(file, activeKind!, target.id, (d, t) =>
            setStatus(`${prefix}page ${d}/${t}…`),
          );
        }
        collected.push(...produced.map((p) => ({ ...p, from: file.name })));
      }
      setOutputs(collected);
      if (!collected.length) setError("Nothing was produced — check the file and try again.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Conversion failed.");
      if (collected.length) setOutputs(collected); // keep partial successes
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  function download(o: ConvertFile) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(o.blob);
    a.download = o.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function downloadAll() {
    const zip = await zipFiles(outputs, "docuscan-converted.zip");
    download(zip);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Convert documents</h1>
      <p className="mt-1 text-muted">
        PDF, Word, Excel, PowerPoint, images, HEIC, CSV, JSON, text, Markdown and HTML — pick a file
        and choose what to turn it into. Most conversions run right in your browser.
      </p>
      <p className="mt-2 text-xs text-muted">
        Private: in-browser conversions never upload your file. High-fidelity Office conversions
        {serverEnabled ? " use this server's converter." : " need a server converter (not enabled here)."}
      </p>

      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />

      {items.length === 0 ? (
        <div
          {...dropHandlers}
          className={`mt-5 rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
            dragActive ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-white"
          }`}
        >
          <p className="font-medium text-ink">Drop files here</p>
          <p className="mt-1 text-sm text-muted">or</p>
          <button
            onClick={() => inputRef.current?.click()}
            className="press mt-3 rounded-xl bg-brand-500 px-5 py-2.5 font-semibold text-white hover:bg-brand-600"
          >
            Choose files
          </button>
          <p className="mt-3 text-xs text-muted">Up to {formatBytes(MAX_FILE_BYTES)} per file</p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {/* file list */}
          <div className="rounded-xl border border-slate-200 bg-white">
            {items.map((it, i) => (
              <div
                key={i}
                className={`flex items-center justify-between gap-3 px-4 py-2.5 ${
                  i > 0 ? "border-t border-slate-100" : ""
                } ${it.kind && it.kind !== activeKind ? "opacity-50" : ""}`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{it.file.name}</p>
                  <p className="text-xs text-muted">
                    {it.kind ? KIND_LABEL[it.kind] : "Unsupported type"} · {formatBytes(it.file.size)}
                  </p>
                </div>
                <button
                  onClick={() => setItems((p) => p.filter((_, j) => j !== i))}
                  aria-label="Remove"
                  className="shrink-0 text-slate-300 hover:text-red-500"
                >
                  <span className="material-symbols-outlined text-[20px]" aria-hidden>
                    close
                  </span>
                </button>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2">
              <button onClick={() => inputRef.current?.click()} className="text-sm font-medium text-brand-600">
                + Add more
              </button>
              <button onClick={reset} className="text-sm text-muted hover:text-ink">
                Clear all
              </button>
            </div>
          </div>

          {/* mixed-type picker */}
          {kinds.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">Convert which type:</span>
              {kinds.map((k) => (
                <button
                  key={k}
                  onClick={() => chooseKind(k)}
                  className={`rounded-lg border px-3 py-1 font-medium ${
                    k === activeKind
                      ? "border-brand-400 bg-brand-50 text-brand-700"
                      : "border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
          )}

          {/* target + run */}
          {activeKind ? (
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm">
                <span className="mb-1 block text-muted">
                  Convert {matching.length} {KIND_LABEL[activeKind].toLowerCase()}
                  {matching.length === 1 ? " file" : " files"} to
                </span>
                <Select
                  ariaLabel="Convert to"
                  value={targetId}
                  onChange={setTargetId}
                  options={targets.map((t) => ({
                    value: t.id,
                    label:
                      t.label + (t.server ? (serverEnabled ? " (server)" : " (server — not enabled)") : ""),
                    disabled: t.server && !serverEnabled,
                  }))}
                />
              </label>
              <button
                onClick={runAll}
                disabled={busy || !target || (target.server && !serverEnabled)}
                className="press rounded-xl bg-brand-500 px-6 py-2.5 font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
              >
                {busy ? "Converting…" : "Convert"}
              </button>
              {target?.note && <p className="w-full text-xs text-muted">Note: {target.note}.</p>}
            </div>
          ) : (
            <p className="text-sm text-red-600">None of these file types can be converted.</p>
          )}

          {busy && status && <p className="text-sm text-muted">{status}</p>}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {outputs.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">
              {outputs.length} file{outputs.length === 1 ? "" : "s"} ready
            </p>
            {outputs.length > 1 && (
              <button onClick={downloadAll} className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600">
                Download all (ZIP)
              </button>
            )}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white">
            {outputs.map((o, i) => (
              <div key={i} className={`flex items-center justify-between gap-3 px-4 py-2.5 ${i > 0 ? "border-t border-slate-100" : ""}`}>
                <p className="truncate text-sm font-medium text-ink">{o.name}</p>
                <button onClick={() => download(o)} className="shrink-0 text-sm font-medium text-brand-600 underline">
                  Download
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
