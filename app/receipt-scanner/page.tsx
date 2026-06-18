"use client";

/**
 * /receipt-scanner — Receipt Scanner → expense log.
 *
 * Reads a receipt (in-browser text extraction, OCR fallback for photos), pulls
 * out merchant/date/total/tax/category with AI (task "extract", docType
 * "receipt"), lets the user correct every field (OCR is never perfect), saves it
 * to a device-local expense log and exports the log to CSV.
 */

import { useEffect, useState } from "react";
import Dropzone from "@/components/Dropzone";
import { extractAnyText } from "@/lib/extractText";
import { validateDocFile, formatBytes } from "@/lib/limits";
import { useGuestTask } from "@/lib/useGuestTask";
import {
  addExpense,
  deleteExpense,
  listExpenses,
  toCsv,
  sumTotals,
  EXPENSES_EVENT,
  type Expense,
} from "@/lib/expenses";

type Fields = {
  merchant: string;
  date: string;
  total: string;
  tax: string;
  currency: string;
  category: string;
  note: string;
};

const empty: Fields = { merchant: "", date: "", total: "", tax: "", currency: "", category: "", note: "" };

export default function ReceiptScannerPage() {
  const [file, setFile] = useState<File | null>(null);
  const [fields, setFields] = useState<Fields | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { usage, consume } = useGuestTask();

  useEffect(() => {
    const refresh = () => setExpenses(listExpenses());
    refresh();
    window.addEventListener(EXPENSES_EVENT, refresh);
    return () => window.removeEventListener(EXPENSES_EVENT, refresh);
  }, []);

  function pick(files: FileList | null) {
    setError(null);
    const f = files?.[0];
    if (!f) return;
    const v = validateDocFile(f);
    if (!v.ok) {
      setError(v.reason);
      return;
    }
    setFile(f);
    setFields(null);
  }

  async function scan() {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const blocked = await consume();
      if (blocked) {
        setError(blocked);
        return;
      }
      const text = await extractAnyText(file, setStatus);
      setStatus("Reading receipt…");
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "extract", docType: "receipt", text }),
      });
      const data = await res.json();
      if (res.status === 503) throw new Error("AI features aren't enabled on this server.");
      if (!res.ok) throw new Error(data.error || "Could not read the receipt.");
      setFields({
        merchant: String(data.merchant || ""),
        date: String(data.date || ""),
        total: String(data.total || ""),
        tax: String(data.tax || ""),
        currency: String(data.currency || ""),
        category: String(data.category || ""),
        note: "",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this receipt.");
      // Still let the user log it manually.
      setFields(empty);
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  function save() {
    if (!fields) return;
    if (!fields.merchant.trim() && !fields.total.trim()) {
      setError("Add at least a merchant or a total before saving.");
      return;
    }
    addExpense(fields);
    setFields(null);
    setFile(null);
  }

  function exportCsv() {
    const csv = toCsv(expenses);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "expenses.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const set = (k: keyof Fields, v: string) => setFields((f) => (f ? { ...f, [k]: v } : f));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Receipt Scanner</h1>
      <p className="mt-1 text-muted">
        Scan a receipt, check the extracted details, and build an expense report you can export to
        CSV.
      </p>
      <p className="mt-2 text-xs text-muted">
        Private: receipts are read in your browser and the expense log is stored on this device.
      </p>
      {usage && (
        <p className="mt-2 text-xs text-muted">
          Free scans left today: <span className="font-semibold">{usage.remaining}</span> /{" "}
          {usage.limit}
        </p>
      )}

      {!file && !fields && (
        <Dropzone onFiles={pick} className="mt-5">
          {(open) => (
            <>
              <p className="font-medium text-ink">Drop a receipt photo or PDF</p>
              <p className="mt-1 text-sm text-muted">or</p>
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

      {file && !fields && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div>
            <p className="font-medium text-ink">{file.name}</p>
            <p className="text-sm text-muted">{formatBytes(file.size)}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setFile(null)} className="text-sm font-medium text-brand-600 underline">
              Change
            </button>
            <button
              onClick={scan}
              disabled={busy}
              className="press rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
            >
              {busy ? status || "Scanning…" : "Scan receipt"}
            </button>
          </div>
        </div>
      )}
      {busy && status && <p className="mt-3 text-sm text-muted">{status}</p>}

      {fields && (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <p className="mb-3 text-sm font-semibold text-ink">Check the details</p>
          <p className="mb-4 text-xs text-muted">
            Scanning isn&apos;t perfect — correct anything that looks wrong before saving.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Merchant" value={fields.merchant} onChange={(v) => set("merchant", v)} />
            <Field label="Date" value={fields.date} onChange={(v) => set("date", v)} placeholder="2026-06-18" />
            <Field label="Total" value={fields.total} onChange={(v) => set("total", v)} />
            <Field label="Tax" value={fields.tax} onChange={(v) => set("tax", v)} />
            <Field label="Currency" value={fields.currency} onChange={(v) => set("currency", v)} placeholder="USD" />
            <Field label="Category" value={fields.category} onChange={(v) => set("category", v)} placeholder="Meals" />
            <div className="sm:col-span-2">
              <Field label="Note" value={fields.note} onChange={(v) => set("note", v)} />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={save}
              className="press rounded-xl bg-brand-500 px-6 py-2.5 font-semibold text-white hover:bg-brand-600"
            >
              Save to expenses
            </button>
            <button
              onClick={() => {
                setFields(null);
                setFile(null);
              }}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 font-semibold text-ink hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {expenses.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink">
              Expenses{" "}
              <span className="text-sm font-normal text-muted">
                ({expenses.length} · {sumTotals(expenses).toFixed(2)} total)
              </span>
            </h2>
            <button
              onClick={exportCsv}
              className="press inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden>
                download
              </span>
              Export CSV
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Merchant</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 text-slate-600">{e.date || "—"}</td>
                    <td className="px-3 py-2 font-medium text-ink">{e.merchant || "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{e.category || "—"}</td>
                    <td className="px-3 py-2 text-right text-ink">
                      {e.currency} {e.total}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => deleteExpense(e.id)}
                        aria-label="Delete expense"
                        className="text-slate-400 hover:text-red-600"
                      >
                        <span className="material-symbols-outlined text-[18px]" aria-hidden>
                          delete
                        </span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-ink">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
      />
    </label>
  );
}
