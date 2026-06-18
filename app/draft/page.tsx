"use client";

/**
 * /draft — AI draft from a document (Phase C4).
 *
 * Extracts text in the browser (pdf.js, OCR fallback), then asks the AI to draft
 * an email reply, cover letter, memo or follow-up based on it (task "draft"),
 * with optional extra instructions. Only the text is sent; the file stays local.
 */

import { useState } from "react";
import { extractAnyText } from "@/lib/extractText";
import { validateDocFile, formatBytes } from "@/lib/limits";
import { useGuestTask } from "@/lib/useGuestTask";
import Dropzone from "@/components/Dropzone";
import Select from "@/components/Select";
import type { DraftKind } from "@/lib/ai";

const KINDS: { value: DraftKind; label: string }[] = [
  { value: "email-reply", label: "Email reply" },
  { value: "follow-up", label: "Follow-up message" },
  { value: "cover-letter", label: "Cover letter" },
  { value: "memo", label: "Internal memo" },
];

export default function DraftPage() {
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<DraftKind>("email-reply");
  const [instructions, setInstructions] = useState("");
  const [result, setResult] = useState<{ title: string; body: string } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
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

  async function draft() {
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

      setStatus("Drafting…");
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "draft", text, kind, instructions }),
      });
      const data = await res.json();
      if (res.status === 503) throw new Error("AI features aren't enabled on this server.");
      if (!res.ok) throw new Error(data.error || "Draft failed.");
      setResult(data as { title: string; body: string });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not draft from this document.");
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  async function copyAll() {
    if (!result) return;
    await navigator.clipboard.writeText(`${result.title}\n\n${result.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Draft from a document</h1>
      <p className="mt-1 text-muted">
        Turn a document into a ready-to-send email reply, follow-up, cover letter or memo.
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
        <div className="mt-5 space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-muted">What should I write?</span>
            <Select
              ariaLabel="What should I write?"
              value={kind}
              onChange={(v) => setKind(v as DraftKind)}
              options={KINDS}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Extra instructions (optional)</span>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={2}
              placeholder="e.g. keep it brief, decline politely, sign as Alex from Billing"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <button
            onClick={draft}
            disabled={busy}
            className="rounded-xl bg-brand-500 px-6 py-2.5 font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {busy ? status || "Drafting…" : "Draft"}
          </button>
        </div>
      )}

      {busy && status && <p className="mt-3 text-sm text-muted">{status}</p>}

      {result && (
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">Draft</p>
            <button onClick={copyAll} className="text-sm font-medium text-brand-600 underline">
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="font-semibold text-ink">{result.title}</p>
            <p className="mt-2 whitespace-pre-wrap text-ink">{result.body}</p>
          </div>
        </div>
      )}
    </div>
  );
}
