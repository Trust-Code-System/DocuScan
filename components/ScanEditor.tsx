"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  detectDocumentCorners,
  warpAndEnhance,
  defaultCorners,
  canvasToFile,
  type Pt,
  type ScanFilter,
} from "@/lib/scan";

type Corners = [Pt, Pt, Pt, Pt];

export default function ScanEditor({
  imageUrl,
  fileName,
  onApply,
  onCancel,
}: {
  imageUrl: string;
  fileName: string;
  onApply: (file: File) => void;
  onCancel: () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [displayW, setDisplayW] = useState(0);
  const [corners, setCorners] = useState<Corners | null>(null);
  const [filter, setFilter] = useState<ScanFilter>("color");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dragIndex = useRef<number | null>(null);

  const scale = natural && displayW ? displayW / natural.w : 1;

  const measure = useCallback(() => {
    if (imgRef.current) setDisplayW(imgRef.current.clientWidth);
  }, []);

  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  function onImgLoad() {
    const img = imgRef.current;
    if (!img) return;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    setNatural({ w, h });
    setDisplayW(img.clientWidth);
    setCorners(defaultCorners(w, h));
  }

  function sourceCanvas(): HTMLCanvasElement {
    const img = imgRef.current!;
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext("2d")!.drawImage(img, 0, 0);
    return c;
  }

  async function autoDetect() {
    if (!natural) return;
    setBusy(true);
    setError(null);
    setStatus("Loading scanner…");
    try {
      const found = await detectDocumentCorners(sourceCanvas());
      if (found) {
        setCorners(found);
        setStatus("Edges detected — drag the dots to fine-tune.");
      } else {
        setStatus("No clear edges found. Drag the dots to set them manually.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Auto-detect failed.");
    } finally {
      setBusy(false);
    }
  }

  function startDrag(i: number) {
    dragIndex.current = i;
  }

  function onPointerMove(e: React.PointerEvent) {
    const i = dragIndex.current;
    if (i === null || !natural || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const x = Math.min(Math.max(0, (e.clientX - rect.left) / scale), natural.w);
    const y = Math.min(Math.max(0, (e.clientY - rect.top) / scale), natural.h);
    setCorners((prev) => {
      if (!prev) return prev;
      const next = [...prev] as Corners;
      next[i] = { x, y };
      return next;
    });
  }

  function endDrag() {
    dragIndex.current = null;
  }

  async function apply() {
    if (!corners) return;
    setBusy(true);
    setError(null);
    setStatus("Processing…");
    try {
      const out = document.createElement("canvas");
      await warpAndEnhance(sourceCanvas(), corners, filter, out);
      const file = await canvasToFile(out, fileName);
      onApply(file);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not process this image.");
      setBusy(false);
    }
  }

  const polygon =
    corners && scale
      ? corners.map((p) => `${p.x * scale},${p.y * scale}`).join(" ")
      : "";

  return (
    <div className="animate-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="animate-modal flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold text-ink">Crop &amp; scan</h2>
          <button
            onClick={onCancel}
            className="press rounded-lg px-2 py-1 text-muted transition-colors duration-150 hover:bg-slate-100 hover:text-ink"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div
            ref={wrapRef}
            className="relative mx-auto w-full touch-none select-none"
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerLeave={endDrag}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={imageUrl}
              alt="To scan"
              onLoad={onImgLoad}
              className="block w-full rounded-lg"
              draggable={false}
            />
            {corners && natural && (
              <>
                <svg
                  className="pointer-events-none absolute inset-0 h-full w-full"
                  viewBox={`0 0 ${displayW} ${natural.h * scale}`}
                  preserveAspectRatio="none"
                >
                  <polygon
                    points={polygon}
                    fill="rgba(249,115,22,0.12)"
                    stroke="#f97316"
                    strokeWidth={2}
                  />
                </svg>
                {corners.map((p, i) => (
                  <button
                    key={i}
                    onPointerDown={() => startDrag(i)}
                    aria-label={`Corner ${i + 1}`}
                    className="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand-500 shadow-md"
                    style={{ left: p.x * scale, top: p.y * scale }}
                  />
                ))}
              </>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={autoDetect}
              disabled={busy}
              className="press inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium transition-colors duration-150 hover:bg-slate-50 disabled:opacity-60"
            >
              {busy && <span className="spinner text-brand-500" aria-hidden />}
              Auto-detect edges
            </button>
            <div className="ml-auto flex gap-1">
              {([
                ["color", "Color"],
                ["gray", "Grayscale"],
                ["bw", "B&W"],
              ] as [ScanFilter, string][]).map(([val, label]) => (
                <button
                  type="button"
                  key={val}
                  onClick={() => setFilter(val)}
                  className={`press rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                    filter === val
                      ? "bg-brand-500 text-white"
                      : "border border-slate-300 text-ink hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {status && <p className="mt-3 text-xs text-muted">{status}</p>}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="press rounded-xl border border-slate-300 px-4 py-2 font-semibold text-ink transition-colors duration-150 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={busy || !corners}
            className="press inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2 font-semibold text-white transition-colors duration-150 hover:bg-brand-600 disabled:opacity-60"
          >
            {busy && <span className="spinner" aria-hidden />}
            {busy ? "Working…" : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}
