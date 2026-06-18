"use client";

/**
 * /chat — Chat with your document (Phase B1).
 *
 * Extracts the document text in the browser (pdf.js, or OCR for scans) and sends
 * only that text to Claude (task "chat", streamed). The doc text is cached in a
 * system prefix server-side so multi-turn chat over the same doc stays cheap.
 */

import { useState } from "react";
import { extractAnyText } from "@/lib/extractText";
import { validateDocFile, formatBytes } from "@/lib/limits";
import { useGuestTask } from "@/lib/useGuestTask";
import Dropzone from "@/components/Dropzone";
import type { ChatTurn } from "@/lib/ai";

export default function ChatPage() {
  const [file, setFile] = useState<File | null>(null);
  const [docText, setDocText] = useState<string | null>(null);
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { usage, consume } = useGuestTask();

  async function pick(files: FileList | null) {
    setError(null);
    setDocText(null);
    setHistory([]);
    const f = files?.[0];
    if (!f) return;
    const v = validateDocFile(f);
    if (!v.ok) {
      setError(v.reason);
      return;
    }
    setFile(f);
    setBusy(true);
    try {
      const text = await extractAnyText(f, setStatus);
      setDocText(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this document.");
      setFile(null);
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  async function ask() {
    const q = question.trim();
    if (!q || !docText || busy) return;
    setError(null);
    setQuestion("");
    setBusy(true);
    const baseHistory = history;
    setHistory((h) => [...h, { role: "user", content: q }, { role: "assistant", content: "" }]);
    try {
      const blocked = await consume();
      if (blocked) {
        setError(blocked);
        setHistory((h) => h.slice(0, -2));
        return;
      }
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "chat", text: docText, question: q, history: baseHistory }),
      });
      if (res.status === 503) throw new Error("AI features aren't enabled on this server.");
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Chat request failed.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setHistory((h) => {
          const copy = h.slice();
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat request failed.");
      setHistory((h) => h.slice(0, -2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Chat with your document</h1>
      <p className="mt-1 text-muted">
        Ask questions and get answers grounded in your document.
      </p>
      <p className="mt-2 text-xs text-muted">
        Private: only the document&apos;s text is sent to the AI — the file stays on your device.
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
            <p className="text-sm text-muted">
              {formatBytes(file.size)}
              {docText ? ` · ${docText.length.toLocaleString()} chars of text` : ""}
            </p>
          </div>
          <button onClick={() => { setFile(null); setDocText(null); setHistory([]); }} className="text-sm font-medium text-brand-600 underline">
            Change
          </button>
        </div>
      )}

      {busy && status && <p className="mt-3 text-sm text-muted">{status}</p>}

      {docText && (
        <div className="mt-6">
          <div className="space-y-3">
            {history.length === 0 && (
              <p className="text-sm text-muted">
                Try: &ldquo;Summarise this document&rdquo; or &ldquo;What are the key dates?&rdquo;
              </p>
            )}
            {history.map((m, i) => (
              <div
                key={i}
                className={`rounded-xl px-4 py-3 text-sm ${
                  m.role === "user"
                    ? "ml-8 bg-brand-50 text-ink"
                    : "mr-8 border border-slate-200 bg-white text-ink"
                }`}
              >
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  {m.role === "user" ? "You" : "DocuScan AI"}
                </p>
                {m.role === "assistant" ? (
                  <ChatAnswer content={m.content || (busy && i === history.length - 1 ? "..." : "")} />
                ) : (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                )}
              </div>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask();
            }}
            className="mt-4 flex gap-2"
          >
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question about this document…"
              className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
            />
            <button
              type="submit"
              disabled={busy || !question.trim()}
              className="rounded-xl bg-brand-500 px-5 py-2.5 font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
            >
              {busy ? "…" : "Ask"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

type AnswerBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

function ChatAnswer({ content }: { content: string }) {
  const blocks = parseAnswer(content);
  return (
    <div className="space-y-3 leading-relaxed text-ink">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <h3 key={index} className="pt-1 text-base font-semibold text-ink">
              {renderInline(block.text)}
            </h3>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={index} className="space-y-1.5">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                  <span>{renderInline(item)}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index} className="whitespace-pre-wrap">
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}

function parseAnswer(content: string): AnswerBlock[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: AnswerBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  };
  const flushList = () => {
    if (!list.length) return;
    blocks.push({ type: "list", items: list });
    list = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^\*\*(.+?)\*\*:?\s*$/);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", text: heading[1] });
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      list.push(bullet[1]);
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks.length ? blocks : [{ type: "paragraph", text: content }];
}

function renderInline(text: string): React.ReactNode[] {
  const clean = text.replace(/\*\*/g, "");
  const parts = clean.split(/(\$?\d[\d,]*(?:\.\d{2})?%?)/g);
  return parts.map((part, index) => {
    if (/^\$?\d[\d,]*(?:\.\d{2})?%?$/.test(part)) {
      return (
        <strong key={index} className="font-semibold text-ink">
          {part}
        </strong>
      );
    }
    return <span key={index}>{part}</span>;
  });
}
