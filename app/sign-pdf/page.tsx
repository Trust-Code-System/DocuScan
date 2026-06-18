"use client";

import { useRef, useState } from "react";
import { getPageCount } from "@/lib/pdf";
import { renderPagePreview, signPdf, type PagePreview } from "@/lib/sign";
import { validateDocFile, formatBytes, ACCEPT_ANY_DOC } from "@/lib/limits";
import { anyFileToPdf } from "@/lib/toPdf";
import { useGuestTask } from "@/lib/useGuestTask";
import Dropzone from "@/components/Dropzone";
import PdfResult from "@/components/PdfResult";
import SignaturePad, { type Signature } from "@/components/SignaturePad";

// Box position/size in displayed pixels, relative to the preview image.
type Box = { x: number; y: number; w: number };

export default function SignPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [buf, setBuf] = useState<ArrayBuffer | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [preview, setPreview] = useState<PagePreview | null>(null);
  const [sig, setSig] = useState<Signature | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Uint8Array | null>(null);
  const { usage, consume } = useGuestTask();
  const inputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ mode: "move" | "resize"; startX: number; startY: number; box: Box } | null>(
    null,
  );

  async function loadPage(b: ArrayBuffer, index: number) {
    const p = await renderPagePreview(b, index);
    setPreview(p);
    setResult(null);
  }

  async function pick(files: FileList | null) {
    setError(null);
    setResult(null);
    setPreview(null);
    setBox(null);
    const f0 = files?.[0];
    if (!f0) return;
    const v = validateDocFile(f0);
    if (!v.ok) {
      setError(v.reason);
      return;
    }
    try {
      setBusy(true);
      const f = await anyFileToPdf(f0);
      const b = await f.arrayBuffer();
      const count = await getPageCount(b.slice(0));
      setFile(f);
      setBuf(b);
      setPageCount(count);
      setPageIndex(0);
      await loadPage(b, 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this file.");
    } finally {
      setBusy(false);
    }
  }

  async function changePage(index: number) {
    if (!buf || index < 0 || index >= pageCount) return;
    setPageIndex(index);
    setBox(null);
    await loadPage(buf, index);
  }

  // Place the signature at a sensible default when the preview image loads.
  function onPreviewLoad() {
    const img = imgRef.current;
    if (!img || !sig) return;
    const w = img.clientWidth * 0.32;
    setBox({ x: img.clientWidth * 0.6, y: img.clientHeight * 0.78, w });
  }

  function clamp(b: Box): Box {
    const img = imgRef.current;
    if (!img || !sig) return b;
    const h = b.w / sig.aspect;
    const w = Math.max(40, Math.min(b.w, img.clientWidth));
    const x = Math.max(0, Math.min(b.x, img.clientWidth - w));
    const y = Math.max(0, Math.min(b.y, img.clientHeight - h));
    return { x, y, w };
  }

  function startDrag(e: React.PointerEvent, mode: "move" | "resize") {
    if (!box) return;
    e.preventDefault();
    e.stopPropagation();
    drag.current = { mode, startX: e.clientX, startY: e.clientY, box };
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (d.mode === "move") {
      setBox(clamp({ ...d.box, x: d.box.x + dx, y: d.box.y + dy }));
    } else {
      setBox(clamp({ ...d.box, w: d.box.w + dx }));
    }
  }

  function endDrag() {
    drag.current = null;
  }

  async function apply() {
    const img = imgRef.current;
    if (!buf || !sig || !box || !img || !preview) return;
    setError(null);
    setBusy(true);
    setResult(null);
    try {
      const blocked = await consume();
      if (blocked) {
        setError(blocked);
        return;
      }
      const iw = img.clientWidth;
      const ih = img.clientHeight;
      const h = box.w / sig.aspect;
      const bytes = await signPdf(buf.slice(0), sig.bytes, {
        pageIndex,
        fracX: box.x / iw,
        fracY: box.y / ih,
        fracW: box.w / iw,
        fracH: h / ih,
      });
      setResult(bytes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign this PDF.");
    } finally {
      setBusy(false);
    }
  }

  const sigHeight = box && sig ? box.w / sig.aspect : 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Sign PDF</h1>
      <p className="mt-1 text-muted">
        Add your signature and place it anywhere on the page — all in your browser.
      </p>
      {usage && (
        <p className="mt-2 text-xs text-muted">
          Free tasks left today: <span className="font-semibold">{usage.remaining}</span> /{" "}
          {usage.limit}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ANY_DOC}
        hidden
        onChange={(e) => pick(e.target.files)}
      />

      {!file && (
        <Dropzone onFiles={pick} className="mt-5">
          {(open) => (
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
          )}
        </Dropzone>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {file && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div>
            <p className="font-medium text-ink">{file.name}</p>
            <p className="text-sm text-muted">
              {formatBytes(file.size)} · {pageCount} page{pageCount === 1 ? "" : "s"}
            </p>
          </div>
          <button
            onClick={() => inputRef.current?.click()}
            className="text-sm font-medium text-brand-600 underline"
          >
            Change
          </button>
        </div>
      )}

      {file && (
        <div className="mt-6">
          <p className="mb-2 text-sm font-semibold text-ink">1. Create your signature</p>
          <SignaturePad onChange={setSig} />
        </div>
      )}

      {file && preview && (
        <div className="mt-8">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">2. Place it on the page</p>
            {pageCount > 1 && (
              <div className="flex items-center gap-2 text-sm">
                <button
                  onClick={() => changePage(pageIndex - 1)}
                  disabled={pageIndex === 0}
                  className="rounded-lg border border-slate-300 px-2 py-1 disabled:opacity-40"
                >
                  ←
                </button>
                <span className="text-muted">
                  Page {pageIndex + 1} / {pageCount}
                </span>
                <button
                  onClick={() => changePage(pageIndex + 1)}
                  disabled={pageIndex === pageCount - 1}
                  className="rounded-lg border border-slate-300 px-2 py-1 disabled:opacity-40"
                >
                  →
                </button>
              </div>
            )}
          </div>

          {!sig && (
            <p className="mb-2 text-sm text-muted">Create a signature above to place it here.</p>
          )}

          <div className="relative inline-block w-full select-none rounded-lg border border-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={preview.dataUrl}
              alt={`Page ${pageIndex + 1}`}
              onLoad={onPreviewLoad}
              className="block w-full rounded-lg"
            />
            {sig && box && (
              <div
                onPointerDown={(e) => startDrag(e, "move")}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                style={{
                  position: "absolute",
                  left: box.x,
                  top: box.y,
                  width: box.w,
                  height: sigHeight,
                  touchAction: "none",
                }}
                className="cursor-move rounded border border-dashed border-brand-500 bg-brand-500/5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sig.dataUrl}
                  alt="signature"
                  draggable={false}
                  className="pointer-events-none h-full w-full object-contain"
                />
                <span
                  onPointerDown={(e) => startDrag(e, "resize")}
                  onPointerMove={onPointerMove}
                  onPointerUp={endDrag}
                  style={{ touchAction: "none" }}
                  className="absolute -bottom-2 -right-2 h-4 w-4 cursor-se-resize rounded-full border border-white bg-brand-500"
                />
              </div>
            )}
          </div>

          <button
            onClick={apply}
            disabled={busy || !sig || !box}
            className="mt-6 rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {busy ? "Signing…" : "Apply signature"}
          </button>
        </div>
      )}

      {result && (
        <PdfResult bytes={result} fileName="docuscan-signed.pdf" title="Signed PDF ready" />
      )}
    </div>
  );
}
