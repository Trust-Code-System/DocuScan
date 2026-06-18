"use client";

/**
 * /slides — Document → Presentation (roadmap §17).
 *
 * Turns a document into an editable slide deck with AI (task "slides"), shown
 * as a live preview you can edit, then exports to PowerPoint (PPTX) or PDF.
 * Text is read in the browser (pdf.js + OCR fallback) so the file never leaves
 * the device; only the text is sent to the AI. PPTX/PDF generation is fully
 * client-side (pptxgenjs / @cantoo/pdf-lib, both dynamic-imported).
 */

import { useState } from "react";
import { extractAnyText } from "@/lib/extractText";
import { validateDocFile, formatBytes } from "@/lib/limits";
import { useGuestTask } from "@/lib/useGuestTask";
import Dropzone from "@/components/Dropzone";
import Select from "@/components/Select";
import type { DeckResult, SlideStyle } from "@/lib/ai";

const STYLES: { value: SlideStyle; label: string }[] = [
  { value: "professional", label: "Professional (business)" },
  { value: "academic", label: "Academic (lecture)" },
  { value: "pitch", label: "Business pitch" },
  { value: "simple", label: "Simple & clean" },
];

export default function SlidesPage() {
  const [file, setFile] = useState<File | null>(null);
  const [style, setStyle] = useState<SlideStyle>("professional");
  const [deck, setDeck] = useState<DeckResult | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const { usage, consume } = useGuestTask();

  function pick(files: FileList | null) {
    setError(null);
    setDeck(null);
    const f = files?.[0];
    if (!f) return;
    const v = validateDocFile(f);
    if (!v.ok) {
      setError(v.reason);
      return;
    }
    setFile(f);
  }

  async function generate() {
    if (!file) return;
    setError(null);
    setBusy(true);
    setDeck(null);
    try {
      const blocked = await consume();
      if (blocked) {
        setError(blocked);
        return;
      }
      const text = await extractAnyText(file, setStatus);

      setStatus("Building slides…");
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "slides", text, style }),
      });
      const data = await res.json();
      if (res.status === 503) throw new Error("AI features aren't enabled on this server.");
      if (!res.ok) throw new Error(data.error || "Couldn't build the presentation.");
      setDeck(data as DeckResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create a presentation.");
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  // ---- editing -------------------------------------------------------------
  function setTitle(v: string) {
    setDeck((d) => (d ? { ...d, title: v } : d));
  }
  function setSubtitle(v: string) {
    setDeck((d) => (d ? { ...d, subtitle: v } : d));
  }
  function setSlideTitle(i: number, v: string) {
    setDeck((d) => (d ? { ...d, slides: d.slides.map((s, j) => (j === i ? { ...s, title: v } : s)) } : d));
  }
  function setBullets(i: number, v: string) {
    const bullets = v.split("\n").map((b) => b.replace(/^[•\-\s]+/, "").trimEnd());
    setDeck((d) => (d ? { ...d, slides: d.slides.map((s, j) => (j === i ? { ...s, bullets } : s)) } : d));
  }
  function removeSlide(i: number) {
    setDeck((d) => (d ? { ...d, slides: d.slides.filter((_, j) => j !== i) } : d));
  }

  // ---- export --------------------------------------------------------------
  function baseName() {
    return (file?.name.replace(/\.[^.]+$/, "") || "presentation").replace(/[^\w.-]+/g, "_");
  }
  function save(blob: Blob, ext: string) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${baseName()}.${ext}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function exportPptx() {
    if (!deck) return;
    setExporting("pptx");
    try {
      const { deckToPptxBlob } = await import("@/lib/deck");
      save(await deckToPptxBlob(deck, style), "pptx");
    } catch (e) {
      setError(e instanceof Error ? e.message : "PPTX export failed.");
    } finally {
      setExporting(null);
    }
  }
  async function exportPdf() {
    if (!deck) return;
    setExporting("pdf");
    try {
      const { deckToPdf } = await import("@/lib/deck");
      const bytes = await deckToPdf(deck, style);
      save(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), "pdf");
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF export failed.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Document to presentation</h1>
      <p className="mt-1 text-muted">
        Turn a report, proposal or paper into an editable slide deck with AI — then export to PowerPoint or PDF.
      </p>
      <p className="mt-2 text-xs text-muted">
        Private: only the document&apos;s text is sent to the AI; the file stays on your device.
      </p>
      {usage && (
        <p className="mt-2 text-xs text-muted">
          Free tasks left today: <span className="font-semibold">{usage.remaining}</span> / {usage.limit}
        </p>
      )}

      {!file && (
        <Dropzone onFiles={pick} className="mt-5">
          {(open) => (
            <>
              <p className="font-medium text-ink">Drop a document here</p>
              <p className="mt-1 text-sm text-muted">PDF, Word, image, text & more — or</p>
              <button
                onClick={open}
                className="press mt-3 rounded-xl bg-brand-500 px-5 py-2.5 font-semibold text-white hover:bg-brand-600"
              >
                Choose file
              </button>
            </>
          )}
        </Dropzone>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {file && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{file.name}</p>
            <p className="text-sm text-muted">{formatBytes(file.size)}</p>
          </div>
          <button onClick={() => { setFile(null); setDeck(null); }} className="text-sm font-medium text-brand-600 underline">
            Change
          </button>
        </div>
      )}

      {file && (
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-muted">Style</span>
            <Select
              ariaLabel="Style"
              value={style}
              onChange={(v) => setStyle(v as SlideStyle)}
              options={STYLES}
            />
          </label>
          <button
            onClick={generate}
            disabled={busy}
            className="press rounded-xl bg-brand-500 px-6 py-2.5 font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {busy ? status || "Building…" : deck ? "Re-generate" : "Create slides"}
          </button>
          {busy && status && <p className="w-full text-sm text-muted">{status}</p>}
        </div>
      )}

      {deck && (
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink">{deck.slides.length} slides</p>
            <div className="flex flex-wrap gap-2 text-sm">
              <button
                onClick={exportPptx}
                disabled={!!exporting}
                className="rounded-lg bg-orange-500 px-3 py-1.5 font-medium text-white hover:bg-orange-600 disabled:opacity-60"
              >
                {exporting === "pptx" ? "Exporting…" : "PowerPoint (.pptx)"}
              </button>
              <button
                onClick={exportPdf}
                disabled={!!exporting}
                className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-50 disabled:opacity-60"
              >
                {exporting === "pdf" ? "Exporting…" : "PDF"}
              </button>
            </div>
          </div>

          {/* Title slide */}
          <div className="mb-3 rounded-xl border border-slate-200 bg-white p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Title slide</p>
            <input
              value={deck.title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-lg font-bold"
            />
            <input
              value={deck.subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Subtitle"
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-muted"
            />
          </div>

          {/* Content slides */}
          <div className="space-y-3">
            {deck.slides.map((s, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-slate-100 text-xs font-bold text-slate-500">
                    {i + 1}
                  </span>
                  <input
                    value={s.title}
                    onChange={(e) => setSlideTitle(i, e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-ink"
                  />
                  <button
                    onClick={() => removeSlide(i)}
                    aria-label="Delete slide"
                    className="shrink-0 text-slate-300 hover:text-red-500"
                  >
                    <span className="material-symbols-outlined text-[20px]" aria-hidden>
                      delete
                    </span>
                  </button>
                </div>
                <textarea
                  value={s.bullets.join("\n")}
                  onChange={(e) => setBullets(i, e.target.value)}
                  rows={Math.max(2, s.bullets.length)}
                  placeholder="One bullet per line"
                  className="w-full resize-y rounded-lg border border-slate-200 p-2 text-sm leading-relaxed"
                />
                {s.notes && (
                  <p className="mt-2 text-xs italic text-muted">
                    <span className="font-semibold not-italic">Speaker notes: </span>
                    {s.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            Edit any slide above (one bullet per line) before exporting. PowerPoint files keep the speaker notes.
          </p>
        </div>
      )}
    </div>
  );
}
