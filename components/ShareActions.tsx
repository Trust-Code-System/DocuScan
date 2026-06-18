"use client";

/**
 * Share actions for a created share link: copy, WhatsApp, native share sheet
 * (Web Share API on mobile), and a QR code. Used by PdfResult once a link
 * exists. Growth features (Phase 6): WhatsApp share, public links + QR.
 */

import { useEffect, useState } from "react";
import { makeQrDataUrl } from "@/lib/qr";
import CloudSave from "@/components/CloudSave";

export default function ShareActions({
  url,
  fileName,
  isPublic,
  manageToken,
  maxDownloads,
  passwordProtected,
}: {
  url: string;
  fileName: string;
  isPublic: boolean;
  /** Secret returned at creation; enables the Revoke control when present. */
  manageToken?: string | null;
  maxDownloads?: number | null;
  passwordProtected?: boolean;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [revoked, setRevoked] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  // The share id is the last path segment of the download URL.
  const shareId = url.split("/").pop() || "";

  async function revoke() {
    if (!manageToken) return;
    setRevoking(true);
    setRevokeError(null);
    try {
      const res = await fetch(
        `/api/share/${encodeURIComponent(shareId)}?token=${encodeURIComponent(manageToken)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not revoke this link.");
      }
      setRevoked(true);
    } catch (e) {
      setRevokeError(e instanceof Error ? e.message : "Could not revoke this link.");
    } finally {
      setRevoking(false);
    }
  }

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && !!navigator.share);
    makeQrDataUrl(url)
      .then(setQr)
      .catch(() => setQr(null));
  }, [url]);

  if (revoked) {
    return (
      <div className="mt-3 rounded-lg bg-slate-100 px-4 py-3 text-sm text-muted">
        🚫 This link has been revoked. It can no longer be opened.
      </div>
    );
  }

  const message = `I shared "${fileName}" with you via DocuScan: ${url}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(message)}`;
  const subject = `DocuScan: ${fileName}`;
  const gmailHref = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(message)}`;
  const mailtoHref = `mailto:?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(message)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — user can still select the link */
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title: fileName, text: message, url });
    } catch {
      /* user cancelled */
    }
  }

  return (
    <div className="mt-3 rounded-lg bg-brand-50 px-4 py-3 text-sm">
      <p className="text-muted">
        {isPublic
          ? "Public link (expires in 7 days):"
          : "Share link (expires in 1 hour):"}
      </p>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="break-all font-medium text-brand-600 underline"
      >
        {url}
      </a>

      {(passwordProtected || (maxDownloads != null && maxDownloads > 0)) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {passwordProtected && (
            <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-ink ring-1 ring-slate-200">
              🔒 Password protected
            </span>
          )}
          {maxDownloads != null && maxDownloads > 0 && (
            <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-ink ring-1 ring-slate-200">
              ⬇ Limit: {maxDownloads} download{maxDownloads === 1 ? "" : "s"}
            </span>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={copy}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-ink hover:bg-slate-50"
        >
          {copied ? "Copied ✓" : "Copy link"}
        </button>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg bg-[#25D366] px-3 py-1.5 font-semibold text-white hover:opacity-90"
        >
          WhatsApp
        </a>
        <a
          href={gmailHref}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-ink hover:bg-slate-50"
        >
          Gmail
        </a>
        <a
          href={mailtoHref}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-ink hover:bg-slate-50"
        >
          Email
        </a>
        {canNativeShare && (
          <button
            type="button"
            onClick={nativeShare}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-ink hover:bg-slate-50"
          >
            Share…
          </button>
        )}
        {manageToken && (
          <button
            type="button"
            onClick={revoke}
            disabled={revoking}
            className="ml-auto inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-1.5 font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
            title="Immediately disable this link for everyone"
          >
            {revoking && <span className="spinner text-red-500" aria-hidden />}
            Revoke
          </button>
        )}
      </div>
      {revokeError && <p className="mt-2 text-xs text-red-600">{revokeError}</p>}

      {isPublic && <CloudSave url={url} fileName={fileName} />}

      {qr && (
        <div className="mt-3 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr}
            alt="QR code for the share link"
            width={96}
            height={96}
            className="rounded-md border border-slate-200 bg-white p-1"
          />
          <p className="text-xs text-muted">
            Scan to open on another device.
            {isPublic && " Anyone with this code can download the file."}
          </p>
        </div>
      )}
    </div>
  );
}
