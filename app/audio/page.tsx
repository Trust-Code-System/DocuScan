"use client";

/**
 * /audio — Document → Audio (roadmap §16).
 *
 * Reads a document aloud in the browser (Web Speech API — on-device, no API
 * cost). "Full document" speaks the extracted text as-is; the AI styles
 * (summary/explainer/study/podcast) rewrite it into listenable narration first
 * (task "narrate"). Voice + speed are adjustable; the script is editable and
 * downloadable as .txt. Text is read in the browser (pdf.js + OCR fallback) so
 * the file never leaves the device. (MP3 export would need a cloud TTS voice —
 * browser speech can't be captured to a file; see lib/speech.ts.)
 */

import { useEffect, useRef, useState } from "react";
import { extractAnyText } from "@/lib/extractText";
import { validateDocFile, formatBytes } from "@/lib/limits";
import { useGuestTask } from "@/lib/useGuestTask";
import { Speaker, getVoices, speechSupported, type SpeakerState } from "@/lib/speech";
import Dropzone from "@/components/Dropzone";
import Select from "@/components/Select";
import type { NarrateStyle } from "@/lib/ai";

type Source = "full" | NarrateStyle;

const SOURCES: { value: Source; label: string; ai: boolean }[] = [
  { value: "full", label: "Read full document", ai: false },
  { value: "summary", label: "AI: short audio summary", ai: true },
  { value: "explainer", label: "AI: spoken explainer", ai: true },
  { value: "study", label: "AI: study narration", ai: true },
  { value: "podcast", label: "AI: podcast-style", ai: true },
];

export default function AudioPage() {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<Source>("full");
  const [script, setScript] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState("");
  const [rate, setRate] = useState(1);
  const [state, setState] = useState<SpeakerState>("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const { usage, consume } = useGuestTask();
  const speakerRef = useRef<Speaker | null>(null);
  const supported = speechSupported();

  // Lazily create one Speaker for the page's lifetime.
  if (!speakerRef.current && supported) {
    const sp = new Speaker();
    sp.onState = setState;
    sp.onProgress = (done, total) => setProgress({ done, total });
    speakerRef.current = sp;
  }

  useEffect(() => {
    if (!supported) return;
    getVoices().then((vs) => {
      setVoices(vs);
      // Prefer an English voice as a sensible default.
      const def = vs.find((v) => v.default) || vs.find((v) => v.lang.startsWith("en")) || vs[0];
      if (def) setVoiceURI(def.voiceURI);
    });
    const sp = speakerRef.current;
    return () => sp?.stop();
  }, [supported]);

  // Push current voice/rate into the speaker (apply from the next chunk).
  useEffect(() => {
    const sp = speakerRef.current;
    if (!sp) return;
    sp.voice = voices.find((v) => v.voiceURI === voiceURI) ?? null;
    sp.rate = rate;
  }, [voiceURI, rate, voices]);

  function pick(files: FileList | null) {
    setError(null);
    const f = files?.[0];
    if (!f) return;
    const v = validateDocFile(f);
    if (!v.ok) {
      setError(v.reason);
      return;
    }
    speakerRef.current?.stop();
    setScript("");
    setProgress({ done: 0, total: 0 });
    setFile(f);
  }

  async function prepare() {
    if (!file) return;
    setError(null);
    setBusy(true);
    speakerRef.current?.stop();
    try {
      const text = await extractAnyText(file, setStatus);

      let out = text.trim();
      if (source !== "full") {
        const blocked = await consume();
        if (blocked) {
          setError(blocked);
          return;
        }
        setStatus("Writing narration…");
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task: "narrate", text, style: source }),
        });
        const data = await res.json();
        if (res.status === 503) throw new Error("AI features aren't enabled on this server.");
        if (!res.ok) throw new Error(data.error || "Couldn't write the narration.");
        out = (data.script as string).trim();
      }
      setScript(out);
      speakerRef.current?.load(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not prepare the audio.");
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  function onScriptEdit(v: string) {
    setScript(v);
    speakerRef.current?.load(v); // re-chunk; stops any current playback
  }

  function downloadScript() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([script], { type: "text/plain;charset=utf-8" }));
    a.download = `${(file?.name.replace(/\.[^.]+$/, "") || "narration").replace(/[^\w.-]+/g, "_")}-script.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Listen to your document</h1>
      <p className="mt-1 text-muted">
        Have a document read aloud, or let AI turn it into a short audio summary, explainer or
        podcast-style narration. Adjust the voice and speed, and play it right here.
      </p>
      <p className="mt-2 text-xs text-muted">
        Private: the reading happens in your browser; only the text is sent to the AI for the narrated styles.
      </p>
      {usage && (
        <p className="mt-2 text-xs text-muted">
          Free AI tasks left today: <span className="font-semibold">{usage.remaining}</span> / {usage.limit}
        </p>
      )}

      {!supported && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Your browser doesn&apos;t support built-in speech. Try Chrome, Edge or Safari to listen — you can
          still generate and download a narration script.
        </div>
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
          <button onClick={() => { setFile(null); setScript(""); }} className="text-sm font-medium text-brand-600 underline">
            Change
          </button>
        </div>
      )}

      {file && (
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-muted">What to read</span>
            <Select
              ariaLabel="What to read"
              value={source}
              onChange={(v) => setSource(v as Source)}
              options={SOURCES.map((s) => ({ value: s.value, label: s.label }))}
            />
          </label>
          <button
            onClick={prepare}
            disabled={busy}
            className="press rounded-xl bg-brand-500 px-6 py-2.5 font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {busy ? status || "Preparing…" : script ? "Re-generate" : "Prepare audio"}
          </button>
          {busy && status && <p className="w-full text-sm text-muted">{status}</p>}
        </div>
      )}

      {script && (
        <div className="mt-6 space-y-4">
          {/* Player */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              {supported ? (
                <>
                  {state !== "speaking" ? (
                    <button
                      onClick={() => speakerRef.current?.play()}
                      className="press inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-5 py-2.5 font-semibold text-white hover:bg-brand-600"
                    >
                      <span className="material-symbols-outlined text-[20px]" aria-hidden>
                        play_arrow
                      </span>
                      {state === "paused" ? "Resume" : "Play"}
                    </button>
                  ) : (
                    <button
                      onClick={() => speakerRef.current?.pause()}
                      className="press inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-5 py-2.5 font-semibold hover:bg-slate-50"
                    >
                      <span className="material-symbols-outlined text-[20px]" aria-hidden>
                        pause
                      </span>
                      Pause
                    </button>
                  )}
                  <button
                    onClick={() => speakerRef.current?.stop()}
                    disabled={state === "idle"}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2.5 font-medium hover:bg-slate-50 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[20px]" aria-hidden>
                      stop
                    </span>
                    Stop
                  </button>
                </>
              ) : null}
              <button
                onClick={downloadScript}
                className="ml-auto text-sm font-medium text-brand-600 underline"
              >
                Download script (.txt)
              </button>
            </div>

            {supported && progress.total > 0 && (
              <div className="mt-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted">
                  {state === "idle" && progress.done === 0
                    ? `${progress.total} segments ready`
                    : `Segment ${Math.min(progress.done + (state === "speaking" ? 1 : 0), progress.total)} of ${progress.total}`}
                </p>
              </div>
            )}

            {supported && (
              <div className="mt-3 flex flex-wrap items-end gap-4">
                <label className="text-sm">
                  <span className="mb-1 block text-muted">Voice</span>
                  <Select
                    ariaLabel="Voice"
                    className="max-w-[16rem]"
                    value={voiceURI}
                    onChange={setVoiceURI}
                    options={voices.map((v) => ({ value: v.voiceURI, label: `${v.name} (${v.lang})` }))}
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted">Speed: {rate.toFixed(1)}×</span>
                  <input
                    type="range"
                    min={0.5}
                    max={2}
                    step={0.1}
                    value={rate}
                    onChange={(e) => setRate(Number(e.target.value))}
                    className="w-44 accent-brand-500"
                  />
                </label>
              </div>
            )}
            <p className="mt-3 text-xs text-muted">
              Voice & speed apply from the next segment. Tip: edit the script below to fix names or trim
              sections before listening.
            </p>
          </div>

          {/* Editable script */}
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-muted">Narration script (editable)</span>
            <textarea
              value={script}
              onChange={(e) => onScriptEdit(e.target.value)}
              rows={10}
              className="w-full resize-y rounded-xl border border-slate-300 p-3 font-sans leading-relaxed"
            />
          </label>
        </div>
      )}
    </div>
  );
}
