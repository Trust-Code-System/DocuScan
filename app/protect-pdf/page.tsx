"use client";

import { useState } from "react";
import { protectPdf } from "@/lib/protect";
import { validateDocFile, formatBytes } from "@/lib/limits";
import { anyFileToPdf } from "@/lib/toPdf";
import { useGuestTask } from "@/lib/useGuestTask";
import Dropzone from "@/components/Dropzone";
import PdfResult from "@/components/PdfResult";

export default function ProtectPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Uint8Array | null>(null);
  const { usage, consume } = useGuestTask();

  async function pick(files: FileList | null) {
    setError(null);
    setResult(null);
    const f = files?.[0];
    if (!f) return;
    const v = validateDocFile(f);
    if (!v.ok) {
      setError(v.reason);
      return;
    }
    try {
      setBusy(true);
      setFile(await anyFileToPdf(f));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this file.");
    } finally {
      setBusy(false);
    }
  }

  const mismatch = confirm.length > 0 && password !== confirm;
  const canRun = !!file && password.length >= 4 && password === confirm;

  async function run() {
    if (!canRun || !file) return;
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const blocked = await consume();
      if (blocked) {
        setError(blocked);
        return;
      }
      const buf = await file.arrayBuffer();
      const bytes = await protectPdf(buf, password);
      setResult(bytes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not protect this PDF.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Protect PDF</h1>
      <p className="mt-1 text-muted">
        Add a password so only people who know it can open the file. Encrypted in your browser.
      </p>
      {usage && (
        <p className="mt-2 text-xs text-muted">
          Free tasks left today: <span className="font-semibold">{usage.remaining}</span> /{" "}
          {usage.limit}
        </p>
      )}

      <Dropzone onFiles={pick} className="mt-5">
        {(open) =>
          file ? (
            <div>
              <p className="font-medium text-ink">{file.name}</p>
              <p className="mt-1 text-sm text-muted">{formatBytes(file.size)}</p>
              <button
                onClick={open}
                className="mt-3 text-sm font-medium text-brand-600 underline"
              >
                Choose a different file
              </button>
            </div>
          ) : (
            <>
              <p className="font-medium text-ink">Drop a document here</p>
              <p className="mt-1 text-sm text-muted">PDF, Word, image & more — converted to PDF · or</p>
              <button
                onClick={open}
                className="mt-3 rounded-xl bg-brand-500 px-5 py-2.5 font-semibold text-white hover:bg-brand-600"
              >
                Choose file
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
          <div className="mt-6 space-y-3">
            <div>
              <label htmlFor="pw" className="mb-1 block text-sm font-semibold text-ink">
                Password
              </label>
              <input
                id="pw"
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setResult(null);
                }}
                autoComplete="new-password"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-ink"
              />
            </div>
            <div>
              <label htmlFor="pw2" className="mb-1 block text-sm font-semibold text-ink">
                Confirm password
              </label>
              <input
                id="pw2"
                type={show ? "text" : "password"}
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  setResult(null);
                }}
                autoComplete="new-password"
                className={`w-full rounded-xl border px-3 py-2.5 text-ink ${
                  mismatch ? "border-red-300" : "border-slate-300"
                }`}
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-muted">
                <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
                Show password
              </label>
              {mismatch && <span className="text-sm text-red-600">Passwords don&apos;t match</span>}
              {!mismatch && password.length > 0 && password.length < 4 && (
                <span className="text-sm text-muted">Use at least 4 characters</span>
              )}
            </div>
          </div>

          <button
            onClick={run}
            disabled={busy || !canRun}
            className="mt-6 rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {busy ? "Encrypting…" : "Protect PDF"}
          </button>
          <p className="mt-2 text-xs text-muted">
            Keep your password safe — if you lose it, the file can&apos;t be recovered.
          </p>
        </>
      )}

      {result && (
        <PdfResult
          bytes={result}
          fileName="docuscan-protected.pdf"
          title="Protected PDF ready"
          note="This PDF now requires the password to open."
        />
      )}
    </div>
  );
}
