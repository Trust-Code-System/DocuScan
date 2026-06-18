"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import { ACCEPT_ANY_DOC, formatBytes, validateDocFile } from "@/lib/limits";
import { anyFileToPdf } from "@/lib/toPdf";
import {
  exportEditedPdf,
  readFormFields,
  type EditObj,
  type FormFieldInfo,
  type PageModel,
  type RectObj,
  type RasterPage,
} from "@/lib/editor";
import { rasterizeRedactedPage } from "@/lib/editorRaster";
import PdfResult from "@/components/PdfResult";
import Select from "@/components/Select";
import { FONT_GROUPS, loadWebFont } from "@/lib/fonts";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

type Tool = "select" | "text" | "highlight" | "whiteout" | "redact" | "shape" | "image";
type EditorObj = EditObj & { id: string };
type PagePreview = { index: number; dataUrl: string; width: number; height: number };
type DragState = {
  pageIndex: number;
  id: string;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  start: EditorObj;
};

// Font picker is grouped (Standard / Sans / Serif / Mono / Display / Script).
// Each option previews in its own typeface; embeddable fonts are lazy-loaded as
// the user browses (onActivate) and embedded for real on export. See lib/fonts.
const FONT_SELECT_GROUPS = FONT_GROUPS.map((grp) => ({
  label: grp.label,
  options: grp.fonts.map((f) => ({
    value: f.family,
    label: f.label ?? f.family,
    style: { fontFamily: `"${f.family}"` },
  })),
}));

const TOOLS: { id: Tool; label: string; icon: string }[] = [
  { id: "select", label: "Select", icon: "arrow_selector_tool" },
  { id: "text", label: "Text", icon: "text_fields" },
  { id: "image", label: "Image", icon: "add_photo_alternate" },
  { id: "highlight", label: "Highlight", icon: "ink_highlighter" },
  { id: "whiteout", label: "White-out", icon: "ink_eraser" },
  { id: "redact", label: "Redact", icon: "visibility_off" },
  { id: "shape", label: "Shape", icon: "crop_square" },
];

function Sym({ name, className }: { name: string; className?: string }) {
  return (
    <span className={`material-symbols-outlined ${className ?? ""}`} aria-hidden>
      {name}
    </span>
  );
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function clamp(n: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, n));
}

function stripIds(models: EditorObj[][]): PageModel[] {
  return models.map((page) =>
    page.map((obj) => {
      const { id: _id, ...clean } = obj;
      return clean as EditObj;
    }),
  );
}

async function renderPdfPages(buf: ArrayBuffer, onStatus?: (status: string) => void): Promise<PagePreview[]> {
  const doc = await pdfjs.getDocument({ data: buf.slice(0) }).promise;
  try {
    const pages: PagePreview[] = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      onStatus?.(`Rendering page ${pageNumber} of ${doc.numPages}...`);
      const page = await doc.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(2, 1400 / base.width);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas is not supported in this browser.");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      page.cleanup();
      pages.push({
        index: pageNumber - 1,
        dataUrl: canvas.toDataURL("image/png"),
        width: canvas.width,
        height: canvas.height,
      });
    }
    return pages;
  } finally {
    await doc.destroy();
  }
}

export default function EditPage() {
  const [file, setFile] = useState<File | null>(null);
  const [buf, setBuf] = useState<ArrayBuffer | null>(null);
  const [pages, setPages] = useState<PagePreview[]>([]);
  const [models, setModels] = useState<EditorObj[][]>([]);
  const [selectedPage, setSelectedPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [color, setColor] = useState("#111827");
  const [fontSize, setFontSize] = useState(18);
  const [font, setFont] = useState("Calibri");
  const [bold, setBold] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [redactSecure, setRedactSecure] = useState(true);
  const [formFields, setFormFields] = useState<FormFieldInfo[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Uint8Array | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const dragRef = useRef<DragState | null>(null);

  const selectedObj = useMemo(() => {
    if (!selectedId) return null;
    return models.flat().find((obj) => obj.id === selectedId) ?? null;
  }, [models, selectedId]);

  const hasRedactions = models.some((page) =>
    page.some((obj) => obj.type === "rect" && obj.kind === "redact"),
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const pageEl = pageRefs.current[drag.pageIndex];
      if (!pageEl) return;
      const rect = pageEl.getBoundingClientRect();
      const dx = (e.clientX - drag.startX) / rect.width;
      const dy = (e.clientY - drag.startY) / rect.height;
      updateObject(drag.pageIndex, drag.id, (obj) => {
        if (drag.mode === "move") {
          return {
            ...obj,
            fracX: clamp(drag.start.fracX + dx, 0, 1 - obj.fracW),
            fracY: clamp(drag.start.fracY + dy, 0, 1 - obj.fracH),
          };
        }
        return {
          ...obj,
          fracW: clamp(drag.start.fracW + dx, 0.015, 1 - obj.fracX),
          fracH: clamp(drag.start.fracH + dy, 0.015, 1 - obj.fracY),
        };
      });
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  useEffect(() => {
    if (!pages.length) return;
    requestAnimationFrame(() => fitPage());
  }, [pages]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest("input,textarea,[contenteditable=true]")) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        deleteSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, models]);

  function updateObject(pageIndex: number, id: string, fn: (obj: EditorObj) => EditorObj) {
    setModels((prev) =>
      prev.map((page, i) => (i === pageIndex ? page.map((obj) => (obj.id === id ? fn(obj) : obj)) : page)),
    );
    setResult(null);
  }

  function fitPage() {
    const viewer = viewerRef.current;
    const widest = Math.max(...pages.map((page) => page.width), 1);
    const tallest = Math.max(...pages.map((page) => page.height), 1);
    if (!viewer || !pages.length) return;
    const availableWidth = viewer.clientWidth - 64;
    const availableHeight = viewer.clientHeight - 64;
    setZoom(clamp(Math.min(availableWidth / widest, availableHeight / tallest), 0.2, 1.5));
    viewer.scrollTo({ top: 0, left: 0 });
  }

  async function pick(files: FileList | null) {
    const picked = files?.[0];
    if (!picked) return;

    setError(null);
    setResult(null);
    setStatus(null);
    setSelectedId(null);
    setPages([]);
    setModels([]);

    const validation = validateDocFile(picked);
    if (!validation.ok) {
      setError(validation.reason);
      return;
    }

    try {
      const pdf = await anyFileToPdf(picked, setStatus);
      const bytes = await pdf.arrayBuffer();
      const rendered = await renderPdfPages(bytes, setStatus);
      const fields = await readFormFields(bytes.slice(0));
      setFile(pdf);
      setBuf(bytes);
      setPages(rendered);
      setModels(Array.from({ length: rendered.length }, () => []));
      setFormFields(fields);
      setSelectedPage(0);
      setTool("select");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open this document.");
    } finally {
      setStatus(null);
    }
  }

  function startDrag(e: React.PointerEvent, pageIndex: number, obj: EditorObj, mode: DragState["mode"]) {
    e.preventDefault();
    e.stopPropagation();
    setSelectedPage(pageIndex);
    setSelectedId(obj.id);
    dragRef.current = { pageIndex, id: obj.id, mode, startX: e.clientX, startY: e.clientY, start: obj };
  }

  function addObject(pageIndex: number, kind: Tool, fracX = 0.12, fracY = 0.12) {
    const page = pages[pageIndex];
    if (!page) return;
    let obj: EditorObj | null = null;
    if (kind === "text") {
      obj = {
        id: uid(),
        type: "text",
        text: "Text",
        fracX,
        fracY,
        fracW: 0.24,
        fracH: 0.04,
        fontFrac: fontSize / page.height,
        color,
        font,
        bold,
      };
    } else if (kind === "highlight" || kind === "whiteout" || kind === "redact" || kind === "shape") {
      const isHighlight = kind === "highlight";
      const isShape = kind === "shape";
      obj = {
        id: uid(),
        type: "rect",
        kind,
        fracX,
        fracY,
        fracW: isShape ? 0.22 : 0.28,
        fracH: isHighlight ? 0.035 : 0.08,
        color: kind === "whiteout" ? "#ffffff" : kind === "redact" ? "#000000" : color,
        opacity: isHighlight ? 0.4 : 1,
        outline: isShape,
      };
    }
    if (!obj) return;
    setModels((prev) => prev.map((pageModels, i) => (i === pageIndex ? [...pageModels, obj] : pageModels)));
    setSelectedPage(pageIndex);
    setSelectedId(obj.id);
    setResult(null);
  }

  function chooseTool(next: Tool) {
    if (next === "image") {
      imageInputRef.current?.click();
      return;
    }
    setTool(next);
    if (next !== "select") addObject(selectedPage, next);
  }

  function handlePagePointerDown(e: React.PointerEvent, pageIndex: number) {
    setSelectedPage(pageIndex);
    if (tool === "select" || tool === "image") {
      setSelectedId(null);
      return;
    }
    const pageEl = pageRefs.current[pageIndex];
    if (!pageEl) return;
    const rect = pageEl.getBoundingClientRect();
    addObject(
      pageIndex,
      tool,
      clamp((e.clientX - rect.left) / rect.width, 0, 0.95),
      clamp((e.clientY - rect.top) / rect.height, 0, 0.95),
    );
    setTool("select");
  }

  async function addImage(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read image."));
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(f);
    });
    const obj: EditorObj = {
      id: uid(),
      type: "image",
      dataUrl,
      fracX: 0.14,
      fracY: 0.14,
      fracW: 0.28,
      fracH: 0.16,
    };
    setModels((prev) => prev.map((page, i) => (i === selectedPage ? [...page, obj] : page)));
    setSelectedId(obj.id);
    setResult(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  function applyStyle() {
    if (!selectedObj || selectedId == null) return;
    updateObject(selectedPage, selectedId, (obj) => {
      if (obj.type === "text") return { ...obj, color, font, bold, fontFrac: fontSize / pages[selectedPage].height };
      if (obj.type === "rect") return { ...obj, color: obj.kind === "whiteout" ? "#ffffff" : obj.kind === "redact" ? "#000000" : color };
      if (obj.type === "path") return { ...obj, color };
      return obj;
    });
  }

  function deleteSelected() {
    if (!selectedId) return;
    setModels((prev) => prev.map((page) => page.filter((obj) => obj.id !== selectedId)));
    setSelectedId(null);
    setResult(null);
  }

  async function doExport() {
    if (!buf) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const pageModels = stripIds(models);
      const rasterPages: Record<number, RasterPage> = {};
      if (redactSecure) {
        for (let i = 0; i < pageModels.length; i++) {
          const reds = (pageModels[i] ?? []).filter(
            (obj): obj is RectObj => obj.type === "rect" && obj.kind === "redact",
          );
          if (reds.length) rasterPages[i] = await rasterizeRedactedPage(buf.slice(0), i, reds);
        }
      }
      setResult(await exportEditedPdf(buf.slice(0), pageModels, { rasterPages }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not export this PDF.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-8">
      <input ref={inputRef} type="file" accept={ACCEPT_ANY_DOC} hidden onChange={(e) => pick(e.target.files)} />
      <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={(e) => addImage(e.target.files)} />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Edit PDF</h1>
          <p className="mt-1 text-sm text-muted">Word-like page view with text, shapes, images, highlights and redaction overlays.</p>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          className="press inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 font-semibold text-white hover:bg-brand-600"
        >
          <Sym name={file ? "sync" : "folder_open"} className="text-xl" />
          {file ? "Change document" : "Choose document"}
        </button>
      </div>

      {!file && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void pick(e.dataTransfer.files);
          }}
          className="flex min-h-[360px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white p-10 text-center transition hover:border-brand-400 hover:bg-brand-50/30"
        >
          <span className="mb-5 grid h-16 w-16 place-items-center rounded-full bg-brand-50 text-brand-600">
            <Sym name="upload_file" className="text-4xl" />
          </span>
          <span className="text-lg font-semibold text-ink">Drop a document here</span>
          <span className="mt-1 text-sm text-muted">PDF, Word, image, text or spreadsheet</span>
        </button>
      )}

      {status && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700">
          <span className="spinner" aria-hidden />
          <span>{status}</span>
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <Sym name="error" className="text-lg" />
          <span>{error}</span>
        </div>
      )}

      {file && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">{file.name}</p>
              <p className="text-sm text-muted">
                {formatBytes(file.size)} - {pages.length} page{pages.length === 1 ? "" : "s"}
                {formFields.length ? ` - ${formFields.length} form fields detected` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setZoom((z) => clamp(z - 0.15, 0.25, 2.5))} className="press grid h-9 w-9 place-items-center rounded-lg border border-slate-300">
                <Sym name="remove" />
              </button>
              <span className="w-14 text-center text-sm font-semibold tabular-nums">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((z) => clamp(z + 0.15, 0.25, 2.5))} className="press grid h-9 w-9 place-items-center rounded-lg border border-slate-300">
                <Sym name="add" />
              </button>
              <button onClick={fitPage} className="press inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-semibold">
                <Sym name="fit_screen" className="text-[18px]" />
                Fit page
              </button>
              <button
                onClick={doExport}
                disabled={busy}
                className="press inline-flex h-9 items-center gap-2 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
              >
                {busy ? <span className="spinner" /> : <Sym name="download" className="text-[18px]" />}
                Export
              </button>
            </div>
          </div>

          <div className="border-b border-slate-200 bg-slate-50/80 p-3">
            <div className="flex flex-wrap items-center gap-2">
              {TOOLS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => chooseTool(item.id)}
                  className={`press inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold ${
                    tool === item.id ? "bg-brand-500 text-white" : "border border-slate-300 bg-white text-slate-700"
                  }`}
                >
                  <Sym name={item.icon} className="text-[20px]" />
                  {item.label}
                </button>
              ))}
              <span className="mx-1 h-6 w-px bg-slate-200" />
              <label className="relative grid h-9 w-9 cursor-pointer place-items-center rounded-lg border border-slate-300 bg-white">
                <span className="h-5 w-5 rounded" style={{ backgroundColor: color }} />
                <input aria-label="Color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="absolute inset-0 opacity-0" />
              </label>
              <input
                type="number"
                min={8}
                max={120}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value) || 18)}
                className="h-9 w-16 rounded-lg border border-slate-300 px-2 text-sm"
              />
              <Select
                value={font}
                onChange={(v) => {
                  loadWebFont(v);
                  setFont(v);
                }}
                groups={FONT_SELECT_GROUPS}
                onActivate={loadWebFont}
                ariaLabel="Font"
                className="h-9 min-w-44 text-sm"
              />
              <button
                onClick={() => setBold((v) => !v)}
                className={`press grid h-9 w-9 place-items-center rounded-lg ${bold ? "bg-brand-500 text-white" : "border border-slate-300 bg-white text-slate-700"}`}
              >
                <Sym name="format_bold" className="text-[20px]" />
              </button>
              <button onClick={applyStyle} disabled={!selectedId} className="press inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold disabled:opacity-40">
                <Sym name="brush" className="text-[18px]" />
                Apply style
              </button>
              <button onClick={deleteSelected} disabled={!selectedId} className="press grid h-9 w-9 place-items-center rounded-lg border border-slate-300 bg-white disabled:opacity-40">
                <Sym name="delete" />
              </button>
              {hasRedactions && (
                <label className="ml-auto inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input type="checkbox" checked={redactSecure} onChange={(e) => setRedactSecure(e.target.checked)} className="h-4 w-4 accent-brand-500" />
                  Secure redact
                </label>
              )}
            </div>
          </div>

          <div ref={viewerRef} className="h-[72vh] overflow-auto bg-neutral-700 px-6 py-8">
            <div className="mx-auto flex w-fit flex-col gap-8">
              {pages.map((page) => (
                <section key={page.index} className="text-center">
                  <div
                    ref={(el) => {
                      pageRefs.current[page.index] = el;
                    }}
                    onPointerDown={(e) => handlePagePointerDown(e, page.index)}
                    className="relative bg-white text-left shadow-2xl ring-1 ring-black/20"
                    style={{ width: page.width * zoom, height: page.height * zoom }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={page.dataUrl} alt={`Page ${page.index + 1}`} draggable={false} className="h-full w-full select-none" />
                    {(models[page.index] ?? []).map((obj) => (
                      <OverlayObject
                        key={obj.id}
                        obj={obj}
                        page={page}
                        zoom={zoom}
                        selected={selectedId === obj.id}
                        onSelect={() => {
                          setSelectedPage(page.index);
                          setSelectedId(obj.id);
                        }}
                        onDrag={(e, mode) => startDrag(e, page.index, obj, mode)}
                        onChange={(next) => updateObject(page.index, obj.id, () => next)}
                      />
                    ))}
                  </div>
                  <p className="mt-3 text-sm font-semibold text-white/80">Page {page.index + 1} of {pages.length}</p>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}

      {result && <PdfResult bytes={result} fileName="docuscan-edited.pdf" title="Edited PDF ready" />}
    </div>
  );
}

function OverlayObject({
  obj,
  page,
  zoom,
  selected,
  onSelect,
  onDrag,
  onChange,
}: {
  obj: EditorObj;
  page: PagePreview;
  zoom: number;
  selected: boolean;
  onSelect: () => void;
  onDrag: (e: React.PointerEvent, mode: DragState["mode"]) => void;
  onChange: (obj: EditorObj) => void;
}) {
  // Pull in the real typeface so the overlay preview matches the export.
  const objFont = obj.type === "text" ? obj.font : undefined;
  useEffect(() => {
    if (objFont) loadWebFont(objFont);
  }, [objFont]);

  const baseStyle: React.CSSProperties = {
    position: "absolute",
    left: `${obj.fracX * 100}%`,
    top: `${obj.fracY * 100}%`,
    width: `${obj.fracW * 100}%`,
    height: `${obj.fracH * 100}%`,
  };

  const frame = selected ? "outline outline-2 outline-brand-500" : "outline outline-1 outline-transparent";
  const handle = (
    <button
      type="button"
      aria-label="Resize"
      onPointerDown={(e) => onDrag(e, "resize")}
      className="absolute -bottom-2 -right-2 h-4 w-4 rounded-full border border-white bg-brand-500 shadow"
    />
  );

  if (obj.type === "text") {
    return (
      <div style={baseStyle} className={`group ${frame}`} onPointerDown={(e) => e.stopPropagation()} onClick={onSelect}>
        <button
          type="button"
          aria-label="Move text"
          onPointerDown={(e) => onDrag(e, "move")}
          className="absolute -left-2 -top-2 z-10 hidden h-5 w-5 cursor-move place-items-center rounded-full bg-brand-500 text-white group-hover:grid"
        >
          <Sym name="open_with" className="text-[14px]" />
        </button>
        <textarea
          value={obj.text}
          onChange={(e) => onChange({ ...obj, text: e.target.value })}
          className="h-full w-full resize-none border-0 bg-transparent p-0 leading-tight outline-none"
          style={{
            color: obj.color,
            fontFamily: obj.font,
            fontWeight: obj.bold ? 700 : 400,
            fontSize: Math.max(8, obj.fontFrac * page.height * zoom),
          }}
        />
        {handle}
      </div>
    );
  }

  if (obj.type === "image") {
    return (
      <div style={baseStyle} className={frame} onPointerDown={(e) => onDrag(e, "move")} onClick={onSelect}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={obj.dataUrl} alt="" draggable={false} className="h-full w-full object-contain" />
        {handle}
      </div>
    );
  }

  if (obj.type === "rect") {
    const isShape = obj.outline;
    return (
      <div
        style={{
          ...baseStyle,
          background: isShape ? "transparent" : obj.color,
          border: isShape ? `2px solid ${obj.color}` : undefined,
          opacity: isShape ? 1 : obj.opacity,
        }}
        className={`${frame} cursor-move`}
        onPointerDown={(e) => onDrag(e, "move")}
        onClick={onSelect}
      >
        {handle}
      </div>
    );
  }

  return null;
}
