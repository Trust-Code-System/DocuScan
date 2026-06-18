"use client";

import { useEffect, useState } from "react";
import { track, Events, toolFromPath } from "@/lib/analytics";
import { brandingEnabled, setBranding, BRANDING_EVENT } from "@/lib/branding";
import { nativeShareFile } from "@/lib/nativeBridge";
import { addRecentDoc } from "@/lib/recentDocs";
import { hapticSuccess, hapticError } from "@/lib/haptics";
import ShareActions from "@/components/ShareActions";

export default function PdfResult({
  bytes,
  fileName,
  title = "Your PDF is ready",
  note,
}: {
  bytes: Uint8Array;
  fileName: string;
  title?: string;
  note?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharePublic, setSharePublic] = useState(false);
  const [manageToken, setManageToken] = useState<string | null>(null);
  const [shareLimit, setShareLimit] = useState<number | null>(null);
  const [sharePassword, setSharePassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [branding, setBrandingState] = useState(true);

  // Optional link protections, set before creating a share link.
  const [showOptions, setShowOptions] = useState(false);
  const [password, setPassword] = useState("");
  const [limitInput, setLimitInput] = useState("");

  useEffect(() => {
    setBrandingState(brandingEnabled());
    const onChange = () => setBrandingState(brandingEnabled());
    window.addEventListener(BRANDING_EVENT, onChange);
    return () => window.removeEventListener(BRANDING_EVENT, onChange);
  }, []);

  useEffect(() => {
    const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
    const u = URL.createObjectURL(blob);
    setUrl(u);
    setShareUrl(null);
    void addRecentDoc({ name: fileName, type: "application/pdf", bytes });
    track(Events.ToolResult, { tool: toolFromPath(window.location.pathname) });
    return () => URL.revokeObjectURL(u);
  }, [bytes, fileName]);

  async function download() {
    if (!url) return;
    hapticSuccess();
    track(Events.Download, { tool: toolFromPath(window.location.pathname) });
    try {
      if (await nativeShareFile(bytes, fileName)) return;
    } catch {
      /* fall back to browser download */
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
  }

  async function share(isPublic: boolean) {
    setBusy(true);
    setError(null);
    try {
      const q = new URLSearchParams({ name: fileName });
      if (isPublic) q.set("public", "1");
      const headers: Record<string, string> = { "Content-Type": "application/pdf" };
      // Protections travel in headers so they stay out of URLs / logs.
      if (password.trim()) headers["x-share-password"] = password;
      if (limitInput.trim()) headers["x-share-max-downloads"] = limitInput.trim();
      const res = await fetch(`/api/share?${q.toString()}`, {
        method: "POST",
        headers,
        body: new Uint8Array(bytes) as BlobPart,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create share link.");
      track(Events.ShareCreated, {
        tool: toolFromPath(window.location.pathname),
        public: isPublic,
      });
      hapticSuccess();
      setShareUrl(data.url);
      setSharePublic(isPublic);
      setManageToken(data.manageToken ?? null);
      setShareLimit(typeof data.maxDownloads === "number" ? data.maxDownloads : null);
      setSharePassword(!!data.passwordProtected);
    } catch (e) {
      hapticError();
      setError(e instanceof Error ? e.message : "Could not create share link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-rise mt-8 rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="font-semibold text-ink">{title}</h2>
      {note && <p className="mt-1 text-sm text-muted">{note}</p>}
      {url && (
        <iframe
          src={url}
          title="PDF preview"
          className="mt-3 h-96 w-full rounded-lg border border-slate-200"
        />
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={download}
          className="press rounded-xl bg-brand-500 px-5 py-2.5 font-semibold text-white transition-colors duration-150 hover:bg-brand-600"
        >
          Download
        </button>
        <button
          type="button"
          onClick={() => share(false)}
          disabled={busy}
          className="press inline-flex items-center gap-2 rounded-xl border border-slate-300 px-5 py-2.5 font-semibold text-ink transition-colors duration-150 hover:bg-slate-50 disabled:opacity-60"
        >
          {busy && <span className="spinner text-brand-500" aria-hidden />}
          Share link (1 hour)
        </button>
        <button
          type="button"
          onClick={() => share(true)}
          disabled={busy}
          className="press rounded-xl border border-slate-300 px-5 py-2.5 font-semibold text-ink transition-colors duration-150 hover:bg-slate-50 disabled:opacity-60"
          title="A longer-lived link you can post or turn into a QR code"
        >
          Public link (7 days)
        </button>
      </div>

      {!shareUrl && (
        <div className="mt-3 text-sm">
          <button
            type="button"
            onClick={() => setShowOptions((v) => !v)}
            className="font-medium text-brand-600 hover:underline"
          >
            {showOptions ? "Hide link options" : "Link options (password, limit)"}
          </button>
          {showOptions && (
            <div className="animate-rise mt-2 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-muted">
                  Password (optional)
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Require a password to open"
                  autoComplete="new-password"
                  maxLength={128}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-ink"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted">
                  Download limit (optional)
                </span>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={limitInput}
                  onChange={(e) => setLimitInput(e.target.value)}
                  placeholder="e.g. 3 downloads"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-ink"
                />
              </label>
              <p className="text-xs text-muted sm:col-span-2">
                Applied when you create a link below. You&apos;ll get a Revoke
                button to kill the link at any time.
              </p>
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {shareUrl && (
        <ShareActions
          url={shareUrl}
          fileName={fileName}
          isPublic={sharePublic}
          manageToken={manageToken}
          maxDownloads={shareLimit}
          passwordProtected={sharePassword}
        />
      )}

      {branding && (
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-muted">
          <span>✨ Created with DocuScan</span>
          <button
            type="button"
            onClick={() => setBranding(false)}
            className="font-medium text-brand-600 hover:underline"
            title="Hide the DocuScan credit"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
