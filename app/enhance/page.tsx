"use client";

import { useState } from "react";
import { validateImageFile, formatBytes, ACCEPTED_IMAGE_TYPES } from "@/lib/limits";
import { useGuestTask } from "@/lib/useGuestTask";
import Dropzone from "@/components/Dropzone";
import type { EnhanceResult, UpscaleFactor, UpscaleProgress } from "@/lib/upscale";

const FACTORS: { value: UpscaleFactor; label: string; note: string }[] = [
  { value: 2, label: "2× upscale", note: "Faster · great for already-decent images" },
  { value: 4, label: "4× upscale", note: "Top quality · best for small or blurry images" },
];

const ACCEPT_IMAGES = ACCEPTED_IMAGE_TYPES.join(",") + ",image/*";

export default function EnhancePage() {
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [factor, setFactor] = useState<UpscaleFactor>(4);
  const [result, setResult] = useState<EnhanceResult | null>(null);
  const [progress, setProgress] = useState<UpscaleProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { usage, consume } = useGuestTask();

  function pick(files: FileList | null) {
    setError(null);
    setResult(null);
    const f0 = files?.[0];
    if (!f0) return;
    const v = validateImageFile(f0);
    if (!v.ok) {
      setError(v.reason);
      return;
    }
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    setFile(f0);
    setSourceUrl(URL.createObjectURL(f0));
  }

  async function run() {
    if (!file) return;
    setError(null);
    setResult(null);
    setProgress({ stage: "model" });
    setBusy(true);
    try {
      const blocked = await consume();
      if (blocked) {
        setError(blocked);
        return;
      }
      // Lazy-load the heavy TF.js + model only when the user actually enhances.
      const { enhanceImage } = await import("@/lib/upscale");
      const out = await enhanceImage(file, factor, setProgress);
      setResult(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't enhance this image.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const pct = progress?.stage === "enhance" ? Math.round((progress.ratio ?? 0) * 100) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Enhance image</h1>
      <p className="mt-1 text-muted">
        AI super-resolution — sharpen and upscale photos to top quality. Runs entirely in your
        browser; the image never leaves your device.
      </p>
      {usage && (
        <p className="mt-2 text-xs text-muted">
          Free tasks left today: <span className="font-semibold">{usage.remaining}</span> /{" "}
          {usage.limit}
        </p>
      )}

      <Dropzone onFiles={pick} accept={ACCEPT_IMAGES} className="mt-5">
        {(open) =>
          file ? (
            <div>
              <p className="font-medium text-ink">{file.name}</p>
              <p className="mt-1 text-sm text-muted">{formatBytes(file.size)}</p>
              <button onClick={open} className="mt-3 text-sm font-medium text-brand-600 underline">
                Choose a different image
              </button>
            </div>
          ) : (
            <>
              <p className="font-medium text-ink">Drop an image here</p>
              <p className="mt-1 text-sm text-muted">JPG, PNG or WebP · or</p>
              <button
                onClick={open}
                className="mt-3 rounded-xl bg-brand-500 px-5 py-2.5 font-semibold text-white hover:bg-brand-600"
              >
                Choose image
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
            <p className="mb-2 text-sm font-semibold text-ink">Quality</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {FACTORS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => {
                    setFactor(f.value);
                    setResult(null);
                  }}
                  className={`rounded-xl border p-3 text-left transition ${
                    factor === f.value
                      ? "border-brand-500 bg-brand-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <span className="block font-semibold text-ink">{f.label}</span>
                  <span className="mt-0.5 block text-xs text-muted">{f.note}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={run}
            disabled={busy}
            className="press mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {busy ? (
              <>
                <span className="spinner" aria-hidden />
                {progress?.stage === "model"
                  ? "Loading AI model…"
                  : `Enhancing… ${pct ?? 0}%`}
              </>
            ) : (
              `Enhance ${factor}×`
            )}
          </button>

          {busy && pct !== null && (
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-brand-500 transition-[width] duration-200 ease-snappy"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
          {busy && progress?.stage === "model" && (
            <p className="mt-3 text-xs text-muted">
              First run downloads the AI model (cached afterwards). This can take a few seconds.
            </p>
          )}
        </>
      )}

      {result && sourceUrl && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-ink">Enhanced image ready</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <figure className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="grid h-56 place-items-center overflow-hidden rounded-lg bg-slate-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sourceUrl} alt="Original" className="max-h-full max-w-full object-contain" />
              </div>
              <figcaption className="mt-2 text-center text-xs text-muted">
                Original · {result.sourceWidth}×{result.sourceHeight}
              </figcaption>
            </figure>
            <figure className="rounded-xl border border-brand-200 bg-white p-3 ring-1 ring-brand-100">
              <div className="grid h-56 place-items-center overflow-hidden rounded-lg bg-slate-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={result.dataUrl} alt="Enhanced" className="max-h-full max-w-full object-contain" />
              </div>
              <figcaption className="mt-2 text-center text-xs font-medium text-brand-700">
                Enhanced {factor}× · {result.width}×{result.height}
              </figcaption>
            </figure>
          </div>

          <a
            href={result.dataUrl}
            download={`docuscan-enhanced-${factor}x.png`}
            className="press mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white hover:bg-brand-600"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden>
              download
            </span>
            Download PNG
          </a>
        </div>
      )}
    </div>
  );
}
