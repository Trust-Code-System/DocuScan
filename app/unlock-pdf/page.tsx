"use client";

import { useState } from "react";
import { unlockPdf } from "@/lib/protect";
import { validateDocFile, formatBytes } from "@/lib/limits";
import { anyFileToPdf } from "@/lib/toPdf";
import { useGuestTask } from "@/lib/useGuestTask";
import Dropzone from "@/components/Dropzone";
import PdfResult from "@/components/PdfResult";

export default function UnlockPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
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

  async function run() {
    if (!file || !password) return;
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
      const bytes = await unlockPdf(buf, password);
      setResult(bytes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not unlock this PDF.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Unlock PDF</h1>
      <p className="mt-1 text-muted">
        Remove the password from a PDF you can already open. Done in your browser.
      </p>
      {usage && (
        <p className="mt-2 text-xs text-muted">
          Free tasks left today: <span className="font-semibold">{usage.remaining}</span> /{" "}
          {usage.limit}
        </p>
      )}

      <Dropzone onFiles={pick} accept="application/pdf,.pdf" className="mt-5">
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
              <p className="font-medium text-ink">Drop a PDF here</p>
              <p className="mt-1 text-sm text-muted">or</p>
              <button
                onClick={open}
                className="mt-3 rounded-xl bg-brand-500 px-5 py-2.5 font-semibold text-white hover:bg-brand-600"
              >
                Choose PDF
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
          <div className="mt-6">
            <label htmlFor="pw" className="mb-1 block text-sm font-semibold text-ink">
              PDF password
            </label>
            <input
              id="pw"
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setResult(null);
              }}
              autoComplete="off"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-ink"
            />
            <label className="mt-2 flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
              Show password
            </label>
          </div>

          <button
            onClick={run}
            disabled={busy || !password}
            className="mt-6 rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {busy ? "Unlocking…" : "Unlock PDF"}
          </button>
          <p className="mt-2 text-xs text-muted">
            Only unlock PDFs you own or are authorized to access.
          </p>
        </>
      )}

      {result && (
        <PdfResult
          bytes={result}
          fileName="docuscan-unlocked.pdf"
          title="Unlocked PDF ready"
          note="The password has been removed — this PDF now opens without one."
        />
      )}
    </div>
  );
}
