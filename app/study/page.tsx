"use client";

/**
 * /study — AI study aids: flashcards + quiz (Phase C5).
 *
 * Extracts text in the browser (pdf.js, OCR fallback), then asks the AI to build
 * flashcards and a multiple-choice quiz from it (task "study"). Flashcards flip on
 * click; the quiz is graded locally. Only the text is sent; the file stays local.
 */

import { useState } from "react";
import { extractAnyText } from "@/lib/extractText";
import { validateDocFile, formatBytes } from "@/lib/limits";
import { useGuestTask } from "@/lib/useGuestTask";
import Dropzone from "@/components/Dropzone";
import type { StudyResult } from "@/lib/ai";

function Flashcard({ front, back }: { front: string; back: string }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      onClick={() => setFlipped((f) => !f)}
      className="flex min-h-[120px] w-full flex-col justify-center rounded-xl border border-slate-200 bg-white p-4 text-left transition-shadow hover:shadow-card"
    >
      <span className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">
        {flipped ? "Answer" : "Question"}
      </span>
      <span className="text-ink">{flipped ? back : front}</span>
      <span className="mt-2 text-xs text-brand-600">{flipped ? "Show question" : "Show answer"}</span>
    </button>
  );
}

function QuizItem({
  q,
  index,
}: {
  q: StudyResult["quiz"][number];
  index: number;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="font-medium text-ink">
        {index + 1}. {q.question}
      </p>
      <div className="mt-3 space-y-2">
        {q.options.map((opt, i) => {
          const isAnswer = i === q.answerIndex;
          const isPicked = picked === i;
          let cls = "border-slate-200 bg-white hover:bg-slate-50";
          if (picked !== null) {
            if (isAnswer) cls = "border-green-300 bg-green-50 text-green-800";
            else if (isPicked) cls = "border-red-300 bg-red-50 text-red-700";
            else cls = "border-slate-200 bg-white opacity-70";
          }
          return (
            <button
              key={i}
              disabled={picked !== null}
              onClick={() => setPicked(i)}
              className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${cls}`}
            >
              <span className="font-semibold">{String.fromCharCode(65 + i)}.</span>
              <span>{opt}</span>
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <p className="mt-3 text-sm text-muted">
          <span className="font-semibold text-ink">
            {picked === q.answerIndex ? "Correct. " : "Not quite. "}
          </span>
          {q.explanation}
        </p>
      )}
    </div>
  );
}

export default function StudyPage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<StudyResult | null>(null);
  const [tab, setTab] = useState<"flashcards" | "quiz">("flashcards");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { usage, consume } = useGuestTask();

  function pick(files: FileList | null) {
    setError(null);
    setResult(null);
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
    setResult(null);
    try {
      const blocked = await consume();
      if (blocked) {
        setError(blocked);
        return;
      }
      const text = await extractAnyText(file, setStatus);

      setStatus("Building study aids…");
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "study", text }),
      });
      const data = await res.json();
      if (res.status === 503) throw new Error("AI features aren't enabled on this server.");
      if (!res.ok) throw new Error(data.error || "Could not build study aids.");
      setResult(data as StudyResult);
      setTab("flashcards");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not build study aids from this document.");
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Study aids</h1>
      <p className="mt-1 text-muted">
        Turn notes, a textbook chapter or any document into flashcards and a quick quiz.
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
            <p className="text-sm text-muted">{formatBytes(file.size)}</p>
          </div>
          <button onClick={() => { setFile(null); setResult(null); }} className="text-sm font-medium text-brand-600 underline">
            Change
          </button>
        </div>
      )}

      {file && (
        <div className="mt-5">
          <button
            onClick={generate}
            disabled={busy}
            className="rounded-xl bg-brand-500 px-6 py-2.5 font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {busy ? status || "Working…" : "Create study aids"}
          </button>
        </div>
      )}

      {busy && status && <p className="mt-3 text-sm text-muted">{status}</p>}

      {result && (
        <div className="mt-6">
          <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-white p-1">
            <button
              onClick={() => setTab("flashcards")}
              className={`rounded-md px-4 py-1.5 text-sm font-medium ${
                tab === "flashcards" ? "bg-brand-500 text-white" : "text-muted"
              }`}
            >
              Flashcards ({result.flashcards.length})
            </button>
            <button
              onClick={() => setTab("quiz")}
              className={`rounded-md px-4 py-1.5 text-sm font-medium ${
                tab === "quiz" ? "bg-brand-500 text-white" : "text-muted"
              }`}
            >
              Quiz ({result.quiz.length})
            </button>
          </div>

          {tab === "flashcards" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {result.flashcards.map((c, i) => (
                <Flashcard key={i} front={c.front} back={c.back} />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {result.quiz.map((q, i) => (
                <QuizItem key={i} q={q} index={i} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
