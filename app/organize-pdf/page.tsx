"use client";

import { useState } from "react";
import { getPageCount, parsePageOrder, extractPages } from "@/lib/pdf";
import { validateDocFile, formatBytes } from "@/lib/limits";
import { anyFileToPdf } from "@/lib/toPdf";
import { useGuestTask } from "@/lib/useGuestTask";
import Dropzone from "@/components/Dropzone";
import PdfResult from "@/components/PdfResult";

function defaultOrder(total: number) {
  return Array.from({ length: total }, (_, i) => String(i + 1)).join(", ");
}

export default function OrganizePdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [order, setOrder] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Uint8Array | null>(null);
  const { usage, consume } = useGuestTask();

  async function pick(files: FileList | null) {
    setError(null);
    setResult(null);
    setPageCount(null);
    const f0 = files?.[0];
    if (!f0) return;
    const v = validateDocFile(f0);
    if (!v.ok) {
      setError(v.reason);
      return;
    }
    try {
      const f = await anyFileToPdf(f0);
      const count = await getPageCount(await f.arrayBuffer());
      setFile(f);
      setPageCount(count);
      setOrder(defaultOrder(count));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this file.");
      setFile(null);
    }
  }

  async function run() {
    if (!file || pageCount === null) return;
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const blocked = await consume();
      if (blocked) {
        setError(blocked);
        return;
      }
      const indices = parsePageOrder(order, pageCount);
      const bytes = await extractPages(await file.arrayBuffer(), indices);
      setResult(bytes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not organize this PDF.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Organize PDF pages</h1>
      <p className="mt-1 text-muted">
        Delete pages by leaving them out, or reorder pages by changing the sequence.
      </p>
      {usage && (
        <p className="mt-2 text-xs text-muted">
          Free tasks left today: <span className="font-semibold">{usage.remaining}</span> / {usage.limit}
        </p>
      )}

      <Dropzone onFiles={pick} className="mt-5">
        {(open) =>
          file ? (
            <div>
              <p className="font-medium text-ink">{file.name}</p>
              <p className="mt-1 text-sm text-muted">
                {formatBytes(file.size)}
                {pageCount !== null && ` - ${pageCount} page${pageCount === 1 ? "" : "s"}`}
              </p>
              <button onClick={open} className="mt-3 text-sm font-medium text-brand-600 underline">
                Choose a different file
              </button>
            </div>
          ) : (
            <>
              <p className="font-medium text-ink">Drop a document here</p>
              <p className="mt-1 text-sm text-muted">PDF, Word, image and more - or</p>
              <button
                onClick={open}
                className="press mt-3 rounded-xl bg-brand-500 px-5 py-2.5 font-semibold text-white hover:bg-brand-600"
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

      {file && pageCount !== null && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-ink">Final page order</span>
            <input
              value={order}
              onChange={(e) => {
                setOrder(e.target.value);
                setResult(null);
              }}
              placeholder="Example: 1, 3, 2, 5-7"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
            />
          </label>
          <p className="mt-2 text-xs text-muted">
            Use commas and ranges. Example: <span className="font-medium">1, 3, 2, 5-7</span>. To delete
            page 4, leave it out.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setOrder(defaultOrder(pageCount))}
              className="press rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Reset order
            </button>
            <button
              type="button"
              onClick={() => setOrder(defaultOrder(pageCount).split(", ").reverse().join(", "))}
              className="press rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Reverse pages
            </button>
          </div>
          <button
            onClick={run}
            disabled={busy}
            className="press mt-5 rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {busy ? "Organizing..." : "Create organized PDF"}
          </button>
        </div>
      )}

      {result && (
        <PdfResult
          bytes={result}
          fileName="docuscan-organized.pdf"
          title="Organized PDF ready"
          note="Only the pages listed in the final order are included."
        />
      )}
    </div>
  );
}
