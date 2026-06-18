"use client";

import { useEffect, useState } from "react";
import { track, Events } from "@/lib/analytics";

const DONE_KEY = "ds-feedback-done"; // submitted or dismissed — don't auto-show again
const AUTO_DELAY_MS = 25_000; // let people use the app first

const OPTIONS = [
  "Edit text inside a PDF",
  "Convert PDF ↔ Word / Excel",
  "Fill & sign forms",
  "More accurate OCR",
  "Save to cloud / Drive",
  "Something else",
];

export default function FeedbackPopup() {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(true); // assume done until we check storage
  const [choice, setChoice] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  // Decide whether to auto-prompt, once, after a delay.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DONE_KEY)) return;
    setDone(false);
    const t = setTimeout(() => setOpen(true), AUTO_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  function finish() {
    localStorage.setItem(DONE_KEY, "1");
    setDone(true);
    setOpen(false);
  }

  async function submit() {
    const message = [choice, note.trim()].filter(Boolean).join(" — ");
    if (!message) return;
    setState("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          email: email.trim() || undefined,
          source: window.location.pathname,
        }),
      });
      if (!res.ok) throw new Error();
      track(Events.FeedbackSubmitted, { choice });
      setState("sent");
      localStorage.setItem(DONE_KEY, "1");
      setDone(true);
      setTimeout(() => setOpen(false), 1600);
    } catch {
      setState("error");
    }
  }

  // Hidden launcher stays available even after dismiss, so people can opt back in.
  if (!open) {
    if (done) {
      // Only show the small launcher tab once the auto-prompt window is over.
      return (
        <button
          onClick={() => {
            setOpen(true);
            setState("idle");
          }}
          className="press animate-pop fixed bottom-3 left-3 z-30 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-muted shadow-sm transition-colors duration-150 hover:bg-slate-50 hover:text-ink"
          aria-label="Give feedback"
        >
          💬 Feedback
        </button>
      );
    }
    return null;
  }

  return (
    <div className="animate-slide-up fixed bottom-3 left-3 z-40 w-[calc(100vw-1.5rem)] max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
      {state === "sent" ? (
        <div className="animate-pop py-2 text-center">
          <p className="text-2xl">🙏</p>
          <p className="mt-1 font-semibold text-ink">Thanks for the steer!</p>
          <p className="text-sm text-muted">We read every note.</p>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-ink">What should we build next?</p>
            <button
              onClick={finish}
              className="press -mt-1 -mr-1 rounded-lg px-2 py-1 text-muted transition-colors duration-150 hover:bg-slate-100 hover:text-ink"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <p className="mt-0.5 text-sm text-muted">
            Which PDF feature do you need most?
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {OPTIONS.map((o) => (
              <button
                key={o}
                onClick={() => setChoice(o)}
                className={`press rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
                  choice === o
                    ? "border-brand-500 bg-brand-500 text-white"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {o}
              </button>
            ))}
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything else? (optional)"
            rows={2}
            className="mt-3 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email if you'd like a reply (optional)"
            type="email"
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
          />

          {state === "error" && (
            <p className="mt-2 text-xs text-red-600">
              Couldn&apos;t send that — please try again.
            </p>
          )}

          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              onClick={finish}
              className="press rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition-colors duration-150 hover:bg-slate-100 hover:text-ink"
            >
              No thanks
            </button>
            <button
              onClick={submit}
              disabled={(!choice && !note.trim()) || state === "sending"}
              className="press inline-flex items-center gap-2 rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-brand-600 disabled:opacity-50"
            >
              {state === "sending" && <span className="spinner" aria-hidden />}
              {state === "sending" ? "Sending…" : "Send"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
