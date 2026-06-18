"use client";

import { useEffect, useRef, useState } from "react";
import { buildPdfFromImages, type ScanPage } from "@/lib/pdf";
import { validateImageFile, MAX_PAGES } from "@/lib/limits";
import ScanEditor from "@/components/ScanEditor";

type Usage = { used: number; limit: number; remaining: number };

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function ImageToPdfPage() {
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const uploadRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const editingPage = pages.find((p) => p.id === editingId) ?? null;

  // Replace a page's image with the cropped/scanned result from ScanEditor.
  function applyScan(id: string, file: File) {
    resetOutput();
    setPages((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        URL.revokeObjectURL(p.url);
        return { ...p, file, url: URL.createObjectURL(file), rotation: 0 };
      }),
    );
    setEditingId(null);
  }

  // Load remaining guest quota on mount.
  useEffect(() => {
    fetch("/api/usage")
      .then((r) => r.json())
      .then(setUsage)
      .catch(() => {});
  }, []);

  // Clean up object URLs on unmount.
  useEffect(() => {
    return () => {
      pages.forEach((p) => URL.revokeObjectURL(p.url));
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetOutput() {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
    setPdfBytes(null);
    setShareUrl(null);
  }

  function addFiles(files: FileList | null) {
    if (!files) return;
    setError(null);
    resetOutput();
    const next: ScanPage[] = [];
    const rejected: string[] = [];
    for (const file of Array.from(files)) {
      const v = validateImageFile(file);
      if (!v.ok) {
        rejected.push(v.reason);
        continue;
      }
      next.push({ id: uid(), file, url: URL.createObjectURL(file), rotation: 0 });
    }

    setPages((prev) => {
      const room = MAX_PAGES - prev.length;
      if (room <= 0) {
        rejected.push(`You can add up to ${MAX_PAGES} pages per PDF.`);
        return prev;
      }
      const accepted = next.slice(0, room);
      if (next.length > room) {
        rejected.push(`Only ${room} more page${room === 1 ? "" : "s"} allowed (max ${MAX_PAGES}).`);
        // Revoke URLs we won't use.
        next.slice(room).forEach((p) => URL.revokeObjectURL(p.url));
      }
      return [...prev, ...accepted];
    });

    if (rejected.length > 0) {
      setError(rejected.join(" "));
    } else if (next.length === 0) {
      setError("Please choose image files (JPG, PNG, etc.).");
    }
  }

  function rotate(id: string) {
    resetOutput();
    setPages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, rotation: (p.rotation + 90) % 360 } : p)),
    );
  }

  function remove(id: string) {
    resetOutput();
    setPages((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((p) => p.id !== id);
    });
  }

  function move(id: string, dir: -1 | 1) {
    resetOutput();
    setPages((prev) => {
      const i = prev.findIndex((p) => p.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const copy = [...prev];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  async function generate() {
    setError(null);
    setBusy(true);
    try {
      // Consume one guest task (server enforces the daily limit).
      const res = await fetch("/api/usage", { method: "POST" });
      const u: Usage & { allowed?: boolean } = await res.json();
      setUsage(u);
      if (res.status === 429) {
        setError(
          `You've reached today's free limit (${u.limit} tasks). Come back tomorrow or sign in for more.`,
        );
        return;
      }

      const bytes = await buildPdfFromImages(pages);
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      setPdfBytes(bytes);
      setPdfUrl(URL.createObjectURL(blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = "docuscan.pdf";
    a.click();
  }

  async function share() {
    if (!pdfBytes) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/share?name=docuscan.pdf", {
        method: "POST",
        headers: { "Content-Type": "application/pdf" },
        body: new Uint8Array(pdfBytes) as BlobPart,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create share link.");
      setShareUrl(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create share link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Scan / Image to PDF</h1>
      <p className="mt-1 text-muted">
        Add photos, tidy up the order, then download a clean PDF.
      </p>

      {usage && (
        <p className="mt-2 text-xs text-muted">
          Free tasks left today: <span className="font-semibold">{usage.remaining}</span> /{" "}
          {usage.limit}
        </p>
      )}

      {/* Hidden inputs */}
      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => addFiles(e.target.files)}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => addFiles(e.target.files)}
      />

      {/* Drop / action zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!dragActive) setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragActive(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          addFiles(e.dataTransfer.files);
        }}
        className={`mt-5 rounded-2xl border-2 border-dashed p-8 text-center transition-colors duration-200 ease-snappy ${
          dragActive
            ? "border-brand-500 bg-brand-50"
            : "border-slate-300 bg-white"
        }`}
      >
        <p className="font-medium text-ink">Drop images here</p>
        <p className="mt-1 text-sm text-muted">or</p>
        <div className="mt-3 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="press w-full rounded-xl bg-brand-500 px-5 py-2.5 font-semibold text-white transition-colors duration-150 hover:bg-brand-600 sm:w-auto"
          >
            Take photo
          </button>
          <button
            type="button"
            onClick={() => uploadRef.current?.click()}
            className="press w-full rounded-xl border border-slate-300 px-5 py-2.5 font-semibold text-ink transition-colors duration-150 hover:bg-slate-50 sm:w-auto"
          >
            Upload images
          </button>
        </div>
      </div>

      {error && (
        <div className="animate-pop mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Pages */}
      {pages.length > 0 && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {pages.map((p, i) => (
              <div
                key={p.id}
                className="animate-pop overflow-hidden rounded-xl border border-slate-200 bg-white transition-shadow duration-200 hover:shadow-md"
              >
                <div className="aspect-[3/4] overflow-hidden bg-slate-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={`Page ${i + 1}`}
                    className="h-full w-full object-contain transition-transform"
                    style={{ transform: `rotate(${p.rotation}deg)` }}
                  />
                </div>
                <div className="flex items-center justify-between gap-1 border-t border-slate-100 p-1.5 text-xs">
                  <span className="px-1 font-medium text-muted">#{i + 1}</span>
                  <div className="flex gap-1">
                    <IconBtn label="Move left" onClick={() => move(p.id, -1)} disabled={i === 0}>
                      ←
                    </IconBtn>
                    <IconBtn
                      label="Move right"
                      onClick={() => move(p.id, 1)}
                      disabled={i === pages.length - 1}
                    >
                      →
                    </IconBtn>
                    <IconBtn label="Crop & scan" onClick={() => setEditingId(p.id)}>
                      ⛶
                    </IconBtn>
                    <IconBtn label="Rotate" onClick={() => rotate(p.id)}>
                      ⟳
                    </IconBtn>
                    <IconBtn label="Delete" onClick={() => remove(p.id)} danger>
                      ✕
                    </IconBtn>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={generate}
              disabled={busy}
              className="press inline-flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white transition-colors duration-150 hover:bg-brand-600 disabled:opacity-60"
            >
              {busy && <span className="spinner" aria-hidden />}
              {busy ? "Working…" : `Create PDF (${pages.length} page${pages.length > 1 ? "s" : ""})`}
            </button>
          </div>
        </>
      )}

      {/* Output */}
      {pdfUrl && (
        <div className="animate-rise mt-8 rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-ink">Your PDF is ready</h2>
          <iframe
            src={pdfUrl}
            title="PDF preview"
            className="mt-3 h-96 w-full rounded-lg border border-slate-200"
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={download}
              className="press rounded-xl bg-brand-500 px-5 py-2.5 font-semibold text-white transition-colors duration-150 hover:bg-brand-600"
            >
              Download
            </button>
            <button
              type="button"
              onClick={share}
              disabled={busy}
              className="press inline-flex items-center gap-2 rounded-xl border border-slate-300 px-5 py-2.5 font-semibold text-ink transition-colors duration-150 hover:bg-slate-50 disabled:opacity-60"
            >
              {busy && <span className="spinner text-brand-500" aria-hidden />}
              Create share link
            </button>
          </div>
          {shareUrl && (
            <div className="animate-pop mt-3 rounded-lg bg-brand-50 px-4 py-3 text-sm">
              <p className="text-muted">Share link (expires in 1 hour):</p>
              <a
                href={shareUrl}
                target="_blank"
                rel="noreferrer"
                className="break-all font-medium text-brand-600 underline"
              >
                {shareUrl}
              </a>
            </div>
          )}
        </div>
      )}

      <p className="mt-8 text-xs text-muted">
        Your images are processed in your browser. Files are never stored unless you create a share
        link, which auto-deletes after 1 hour. See our{" "}
        <a href="/privacy" className="underline">
          Privacy Policy
        </a>
        .
      </p>

      {editingPage && (
        <ScanEditor
          imageUrl={editingPage.url}
          fileName={editingPage.file.name.replace(/\.[^.]+$/, "") + "-scan.jpg"}
          onApply={(file) => applyScan(editingPage.id, file)}
          onCancel={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

function IconBtn({
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
      className={`press grid h-7 w-7 place-items-center rounded-md border text-sm transition-colors duration-150 disabled:opacity-30 ${
        danger
          ? "border-red-200 text-red-600 hover:bg-red-50"
          : "border-slate-200 text-slate-600 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}
