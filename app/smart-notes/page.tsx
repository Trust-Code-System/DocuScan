"use client";

/**
 * /smart-notes — Smart Notes editor.
 *
 * Paste rough text → auto-format into headings, code blocks, lists, checklists,
 * quotes, tables and key:value rows (lib/smartNotes.ts, pure + Node-tested).
 * Live preview, manual editing (as Markdown), AI actions (summarize / to
 * checklist / to flashcards) and export to PDF / DOCX / Markdown / plain text.
 *
 * Receives content from other tools via sessionStorage key `ds-smartnotes-seed`
 * ("Send to Smart Notes" from OCR, summaries, etc.). All formatting runs on the
 * device; AI actions send only text to the rate-limited /api/ai.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  formatNotes,
  blocksToMarkdown,
  blocksToPlainText,
  toDocBlocks,
  type NoteBlock,
} from "@/lib/smartNotes";
import { useGuestTask } from "@/lib/useGuestTask";

const SAMPLE = `Project Kickoff Notes

Overview
We are launching the new billing system next quarter. The goal is to reduce churn and simplify invoicing for small teams.

Goals:
- Cut payment failures by 30%
- Ship the new invoice template
- Add dunning emails

Tasks
- [ ] Review the API contract
- [x] Set up the staging environment
- call the payments provider about webhooks

Decisions
Name: Atlas Billing
Owner: Priya
Launch date: 2026-09-01

Example webhook handler:
\`\`\`js
export async function POST(req) {
  const event = await req.json();
  if (event.type === "payment.failed") notify(event.customer);
  return new Response("ok");
}
\`\`\`

> Remember: every customer-facing string needs a translation key.`;

type DownloadName = "smart-notes";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SmartNotesPage() {
  const [raw, setRaw] = useState("");
  const [blocks, setBlocks] = useState<NoteBlock[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [md, setMd] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiPanel, setAiPanel] = useState<{ title: string; lines: string[] } | null>(null);
  const [copied, setCopied] = useState(false);
  const { usage, consume } = useGuestTask();

  // Pick up content handed off from another tool.
  useEffect(() => {
    try {
      const seed = sessionStorage.getItem("ds-smartnotes-seed");
      if (seed) {
        sessionStorage.removeItem("ds-smartnotes-seed");
        setRaw(seed);
        setBlocks(formatNotes(seed));
      }
    } catch {
      /* sessionStorage may be unavailable */
    }
  }, []);

  const plain = useMemo(() => (blocks ? blocksToPlainText(blocks) : ""), [blocks]);

  function doFormat(text = raw) {
    setError(null);
    setAiPanel(null);
    if (!text.trim()) {
      setError("Paste or type some notes first.");
      return;
    }
    setBlocks(formatNotes(text));
    setEditing(false);
  }

  function startEditing() {
    if (!blocks) return;
    setMd(blocksToMarkdown(blocks));
    setEditing(true);
  }

  function applyEdits() {
    setBlocks(formatNotes(md));
    setEditing(false);
  }

  async function exportPdf() {
    if (!blocks) return;
    setBusy("Building PDF…");
    try {
      const { blocksToPdf } = await import("@/lib/docExport");
      const bytes = await blocksToPdf(toDocBlocks(blocks));
      download(new Blob([bytes as BlobPart], { type: "application/pdf" }), "smart-notes.pdf");
    } catch {
      setError("Could not build the PDF.");
    } finally {
      setBusy(null);
    }
  }

  async function exportDocx() {
    if (!blocks) return;
    setBusy("Building Word doc…");
    try {
      const { blocksToDocxBlob } = await import("@/lib/docExport");
      const blob = await blocksToDocxBlob(toDocBlocks(blocks));
      download(blob, "smart-notes.docx");
    } catch {
      setError("Could not build the Word document.");
    } finally {
      setBusy(null);
    }
  }

  function exportMarkdown() {
    if (!blocks) return;
    download(new Blob([blocksToMarkdown(blocks)], { type: "text/markdown" }), "smart-notes.md");
  }

  function exportTxt() {
    if (!blocks) return;
    download(new Blob([plain], { type: "text/plain" }), "smart-notes.txt");
  }

  async function copyAll() {
    if (!blocks) return;
    await navigator.clipboard.writeText(blocksToMarkdown(blocks));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // ---- AI actions ----------------------------------------------------------
  async function aiAction(task: "summarize" | "study", label: string) {
    if (!blocks) return;
    setError(null);
    setBusy(label + "…");
    setAiPanel(null);
    try {
      const blocked = await consume();
      if (blocked) {
        setError(blocked);
        return;
      }
      const text = blocksToPlainText(blocks);
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(task === "summarize" ? { task, text, mode: "bullets" } : { task, text }),
      });
      const data = await res.json();
      if (res.status === 503) throw new Error("AI features aren't enabled on this server.");
      if (!res.ok) throw new Error(data.error || "Request failed.");
      if (task === "summarize") {
        setAiPanel({
          title: "Summary",
          lines: [data.tldr, ...(data.keyPoints || []).map((p: string) => "• " + p)].filter(Boolean),
        });
      } else {
        setAiPanel({
          title: "Flashcards",
          lines: (data.flashcards || []).map(
            (c: { front: string; back: string }) => `${c.front} → ${c.back}`,
          ),
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not complete that action.");
    } finally {
      setBusy(null);
    }
  }

  function toChecklist() {
    if (!blocks) return;
    // Re-emit the note as a single checklist of every list/paragraph line.
    const items: { text: string; checked: boolean }[] = [];
    for (const b of blocks) {
      if (b.type === "checklist") items.push(...b.items);
      else if (b.type === "list") b.items.forEach((t) => items.push({ text: t, checked: false }));
      else if (b.type === "paragraph")
        b.text
          .split(/\.\s+/)
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((t) => items.push({ text: t.replace(/\.$/, ""), checked: false }));
    }
    if (items.length) setBlocks([{ type: "checklist", items }]);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Smart Notes</h1>
      <p className="mt-1 text-muted">
        Paste rough notes and DocuScan formats them automatically — headings, code blocks, lists,
        checklists, quotes and tables. Edit freely, then export.
      </p>
      <p className="mt-2 text-xs text-muted">
        Private: formatting happens entirely in your browser. AI actions send only the note text.
      </p>
      {usage && (
        <p className="mt-2 text-xs text-muted">
          Free AI tasks left today: <span className="font-semibold">{usage.remaining}</span> /{" "}
          {usage.limit}
        </p>
      )}

      {!blocks ? (
        <div className="mt-5">
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="Paste your notes here…"
            className="h-72 w-full resize-y rounded-xl border border-slate-300 bg-white p-4 font-mono text-sm leading-relaxed text-ink outline-none focus:border-brand-500"
          />
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              onClick={() => doFormat()}
              className="press rounded-xl bg-brand-500 px-6 py-2.5 font-semibold text-white hover:bg-brand-600"
            >
              Format notes
            </button>
            <button
              onClick={() => {
                setRaw(SAMPLE);
                doFormat(SAMPLE);
              }}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 font-semibold text-ink hover:bg-slate-50"
            >
              Try a sample
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5">
          {/* Action toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setBlocks(null);
                setAiPanel(null);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-slate-50"
            >
              ← New note
            </button>
            {editing ? (
              <button
                onClick={applyEdits}
                className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600"
              >
                Apply edits
              </button>
            ) : (
              <button
                onClick={startEditing}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-slate-50"
              >
                Edit
              </button>
            )}
            <button
              onClick={() => doFormat(raw)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-slate-50"
            >
              Re-format
            </button>
            <span className="mx-1 h-5 w-px bg-slate-200" />
            <button
              onClick={() => aiAction("summarize", "Summarizing")}
              className="rounded-lg border border-ai-200 bg-ai-50 px-3 py-2 text-sm font-medium text-ai-700 hover:bg-ai-100"
            >
              Summarize
            </button>
            <button
              onClick={toChecklist}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-slate-50"
            >
              To checklist
            </button>
            <button
              onClick={() => aiAction("study", "Building flashcards")}
              className="rounded-lg border border-ai-200 bg-ai-50 px-3 py-2 text-sm font-medium text-ai-700 hover:bg-ai-100"
            >
              To flashcards
            </button>
          </div>

          {busy && <p className="mt-3 text-sm text-muted">{busy}</p>}
          {error && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {aiPanel && (
            <div className="mt-4 rounded-xl border border-ai-200 bg-ai-50/50 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ai-700">
                {aiPanel.title}
              </p>
              <ul className="space-y-1 text-sm text-ink">
                {aiPanel.lines.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Editor / preview */}
          {editing ? (
            <textarea
              value={md}
              onChange={(e) => setMd(e.target.value)}
              className="mt-4 h-96 w-full resize-y rounded-xl border border-slate-300 bg-white p-4 font-mono text-sm leading-relaxed text-ink outline-none focus:border-brand-500"
            />
          ) : (
            <article className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
              <NotePreview blocks={blocks} onToggle={setBlocks} />
            </article>
          )}

          {/* Export bar */}
          <div className="mt-5 flex flex-wrap gap-2">
            <ExportBtn onClick={exportPdf} icon="picture_as_pdf" label="PDF" disabled={!!busy} />
            <ExportBtn onClick={exportDocx} icon="description" label="Word" disabled={!!busy} />
            <ExportBtn onClick={exportMarkdown} icon="code" label="Markdown" />
            <ExportBtn onClick={exportTxt} icon="notes" label="Text" />
            <button
              onClick={copyAll}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-slate-50"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}

      <p className="mt-8 text-xs text-muted">
        Tip: run a scan through{" "}
        <Link href="/ocr-pdf" className="text-brand-600 underline">
          OCR
        </Link>{" "}
        and send the recognized text here to clean it up.
      </p>
    </div>
  );
}

function ExportBtn({
  onClick,
  icon,
  label,
  disabled,
}: {
  onClick: () => void;
  icon: string;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="press inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
    >
      <span className="material-symbols-outlined text-[18px]" aria-hidden>
        {icon}
      </span>
      {label}
    </button>
  );
}

function NotePreview({
  blocks,
  onToggle,
}: {
  blocks: NoteBlock[];
  onToggle: (b: NoteBlock[]) => void;
}) {
  const toggleCheck = (bi: number, ii: number) => {
    const next = blocks.map((b, i) => {
      if (i !== bi || b.type !== "checklist") return b;
      return {
        ...b,
        items: b.items.map((it, j) => (j === ii ? { ...it, checked: !it.checked } : it)),
      };
    });
    onToggle(next);
  };

  return (
    <div className="space-y-3 text-ink">
      {blocks.map((b, bi) => {
        switch (b.type) {
          case "heading": {
            const cls =
              b.level === 1
                ? "text-2xl font-bold mt-2"
                : b.level === 2
                  ? "text-xl font-bold mt-2"
                  : "text-base font-semibold mt-1";
            return (
              <p key={bi} className={cls}>
                {b.text}
              </p>
            );
          }
          case "paragraph":
            return (
              <p key={bi} className="leading-relaxed text-slate-700">
                {b.text}
              </p>
            );
          case "list":
            return b.ordered ? (
              <ol key={bi} className="list-decimal space-y-1 pl-6 text-slate-700">
                {b.items.map((it, i) => (
                  <li key={i}>{it}</li>
                ))}
              </ol>
            ) : (
              <ul key={bi} className="list-disc space-y-1 pl-6 text-slate-700">
                {b.items.map((it, i) => (
                  <li key={i}>{it}</li>
                ))}
              </ul>
            );
          case "checklist":
            return (
              <ul key={bi} className="space-y-1.5">
                {b.items.map((it, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={it.checked}
                      onChange={() => toggleCheck(bi, i)}
                      className="mt-1 h-4 w-4 accent-brand-500"
                    />
                    <span className={it.checked ? "text-slate-400 line-through" : "text-slate-700"}>
                      {it.text}
                    </span>
                  </li>
                ))}
              </ul>
            );
          case "quote":
            return (
              <blockquote
                key={bi}
                className="border-l-4 border-brand-300 bg-brand-50/40 py-1 pl-4 italic text-slate-600"
              >
                {b.text}
              </blockquote>
            );
          case "code":
            return <CodeBlock key={bi} code={b.code} lang={b.lang} />;
          case "kv":
            return (
              <dl key={bi} className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
                {b.pairs.map((p, i) => (
                  <div key={i} className="contents">
                    <dt className="font-semibold text-slate-500">{p.key}</dt>
                    <dd className="text-slate-700">{p.value}</dd>
                  </div>
                ))}
              </dl>
            );
          case "table":
            return (
              <div key={bi} className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <tbody>
                    {b.rows.map((r, ri) => (
                      <tr key={ri}>
                        {r.map((c, ci) => (
                          <td
                            key={ci}
                            className={`border border-slate-200 px-3 py-1.5 ${
                              ri === 0 ? "bg-slate-50 font-semibold" : ""
                            }`}
                          >
                            {c}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
        }
      })}
    </div>
  );
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-700 px-3 py-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
          {lang}
        </span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
          className="text-[11px] font-medium text-slate-300 hover:text-white"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-[13px] leading-relaxed text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}
