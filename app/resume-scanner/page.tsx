"use client";

/**
 * /resume-scanner — Resume / CV Scanner.
 *
 * Extracts a candidate's details from a CV (text read in-browser, OCR fallback
 * for scans), summarizes it, optionally compares it to a pasted job description
 * and generates interview questions (task "resume-review"). Decision support
 * only — a human makes the hiring call. A candidate-summary PDF can be exported.
 */

import { useState } from "react";
import Dropzone from "@/components/Dropzone";
import { extractAnyText } from "@/lib/extractText";
import { validateDocFile, formatBytes } from "@/lib/limits";
import { useGuestTask } from "@/lib/useGuestTask";
import type { ResumeResult } from "@/lib/ai";
import type { DocBlock } from "@/lib/docExport";

export default function ResumeScannerPage() {
  const [file, setFile] = useState<File | null>(null);
  const [jd, setJd] = useState("");
  const [result, setResult] = useState<ResumeResult | null>(null);
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

  async function run() {
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
      setStatus("Reviewing résumé…");
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "resume-review", text, jobDescription: jd }),
      });
      const data = await res.json();
      if (res.status === 503) throw new Error("AI features aren't enabled on this server.");
      if (!res.ok) throw new Error(data.error || "Review failed.");
      setResult(data as ResumeResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not review this résumé.");
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  async function exportPdf() {
    if (!result) return;
    const blocks: DocBlock[] = [
      { type: "heading", level: 1, text: result.name || "Candidate summary" },
      { type: "paragraph", text: [result.title, result.email, result.phone].filter(Boolean).join(" · ") },
    ];
    if (result.summary) {
      blocks.push({ type: "heading", level: 2, text: "Summary" }, { type: "paragraph", text: result.summary });
    }
    if (result.fit) {
      blocks.push({ type: "heading", level: 2, text: "Fit for the role" }, { type: "paragraph", text: result.fit });
    }
    if (result.strengths.length)
      blocks.push({ type: "heading", level: 2, text: "Strengths" }, { type: "list", items: result.strengths });
    if (result.gaps.length)
      blocks.push({ type: "heading", level: 2, text: "Gaps / to probe" }, { type: "list", items: result.gaps });
    if (result.skills.length)
      blocks.push({ type: "heading", level: 2, text: "Skills" }, { type: "paragraph", text: result.skills.join(", ") });
    if (result.education.length)
      blocks.push({ type: "heading", level: 2, text: "Education" }, { type: "list", items: result.education });
    if (result.experience.length)
      blocks.push({ type: "heading", level: 2, text: "Experience" }, { type: "list", items: result.experience });
    if (result.questions.length)
      blocks.push(
        { type: "heading", level: 2, text: "Interview questions" },
        { type: "list", items: result.questions.map((q) => q.question) },
      );
    blocks.push({
      type: "paragraph",
      text: "AI-generated summary — review with a human before making any hiring decision.",
    });

    const { blocksToPdf } = await import("@/lib/docExport");
    const bytes = await blocksToPdf(blocks);
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(result.name || "candidate").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-summary.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Resume Scanner</h1>
      <p className="mt-1 text-muted">
        Pull a candidate&apos;s details from a CV, get a neutral summary, compare it to a job
        description and generate interview questions.
      </p>
      <p className="mt-2 text-xs text-muted">
        Private: the file is read in your browser and only its text is sent to the AI.
      </p>
      {usage && (
        <p className="mt-2 text-xs text-muted">
          Free tasks left today: <span className="font-semibold">{usage.remaining}</span> /{" "}
          {usage.limit}
        </p>
      )}

      {!file && (
        <Dropzone onFiles={pick} className="mt-5">
          {(open) => (
            <>
              <p className="font-medium text-ink">Drop a CV / résumé here</p>
              <p className="mt-1 text-sm text-muted">PDF, Word, image or text — or</p>
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
          <button
            onClick={() => {
              setFile(null);
              setResult(null);
            }}
            className="text-sm font-medium text-brand-600 underline"
          >
            Change
          </button>
        </div>
      )}

      {file && !result && (
        <div className="mt-5">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-ink">
              Job description <span className="font-normal text-muted">(optional)</span>
            </span>
            <textarea
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder="Paste the role's requirements to compare the candidate against…"
              className="h-32 w-full resize-y rounded-lg border border-slate-300 bg-white p-3 text-sm outline-none focus:border-brand-500"
            />
          </label>
          <button
            onClick={run}
            disabled={busy}
            className="press mt-4 rounded-xl bg-brand-500 px-6 py-2.5 font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {busy ? status || "Reviewing…" : "Scan résumé"}
          </button>
          {busy && status && <p className="mt-3 text-sm text-muted">{status}</p>}
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-ink">{result.name || "Candidate"}</h2>
              <p className="text-sm text-muted">
                {[result.title, result.yearsExperience && `${result.yearsExperience} experience`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <button
              onClick={exportPdf}
              className="press inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden>
                picture_as_pdf
              </span>
              Summary PDF
            </button>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            AI assists screening — it does not decide. Always review with a human before any hiring
            decision.
          </div>

          <Card title="Contact">
            <p className="text-sm text-ink">
              {[result.email, result.phone].filter(Boolean).join(" · ") || "Not found"}
            </p>
          </Card>

          {result.summary && (
            <Card title="Summary">
              <p className="text-sm leading-relaxed text-slate-700">{result.summary}</p>
            </Card>
          )}

          {result.fit && (
            <Card title="Fit for the role">
              <p className="text-sm leading-relaxed text-slate-700">{result.fit}</p>
            </Card>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            {result.strengths.length > 0 && (
              <Card title="Strengths">
                <BulletList items={result.strengths} />
              </Card>
            )}
            {result.gaps.length > 0 && (
              <Card title="Gaps / to probe">
                <BulletList items={result.gaps} />
              </Card>
            )}
          </div>

          {result.skills.length > 0 && (
            <Card title="Skills">
              <div className="flex flex-wrap gap-1.5">
                {result.skills.map((s, i) => (
                  <span
                    key={i}
                    className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </Card>
          )}

          {result.education.length > 0 && (
            <Card title="Education">
              <BulletList items={result.education} />
            </Card>
          )}

          {result.experience.length > 0 && (
            <Card title="Experience">
              <BulletList items={result.experience} />
            </Card>
          )}

          {result.questions.length > 0 && (
            <Card title="Interview questions">
              <ul className="space-y-3">
                {result.questions.map((q, i) => (
                  <li key={i}>
                    <p className="text-sm font-medium text-ink">{q.question}</p>
                    <p className="text-xs text-muted">{q.rationale}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">{title}</p>
      {children}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}
