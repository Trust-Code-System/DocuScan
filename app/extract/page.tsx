"use client";

/**
 * /extract — "Extract anything to a table" (roadmap §5).
 *
 * Pick a preset (invoice, bank statement, attendance sheet…) or define custom
 * columns / a freeform request, then AI pulls the data into an editable table.
 * Multi-record docs (transactions, line items, business cards) yield one row
 * each, with a per-row confidence flag. Export to Excel/CSV or a PDF
 * report. Text is read in the browser (pdf.js, OCR fallback for scans) — the
 * file never leaves the device; only the extracted text is sent to the AI.
 */

import { useState } from "react";
import { extractAnyText } from "@/lib/extractText";
import { validateDocFile, formatBytes } from "@/lib/limits";
import { useGuestTask } from "@/lib/useGuestTask";
import Dropzone from "@/components/Dropzone";
import { blocksToPdf } from "@/lib/docExport";
import Select from "@/components/Select";
import type { TableResult, DocBlock } from "@/lib/ai";
import { rowsToXlsxBlob } from "@/lib/xlsx";

type Preset = { id: string; label: string; fields: string[]; hint?: string };

// Practical presets — repeating-record fields where the doc type is naturally
// tabular, key fields otherwise. "Custom" lets the user define their own.
const PRESETS: Preset[] = [
  { id: "custom", label: "Custom (your own fields)", fields: [] },
  {
    id: "invoice",
    label: "Invoice line items",
    fields: ["Item", "Description", "Quantity", "Unit price", "Amount"],
    hint: "Extract only invoice line-item rows. Ignore invoice subtotal, discount, tax, total, receipt rows, comparison tables, form fields, checklists, and narrative text.",
  },
  {
    id: "receipt",
    label: "Receipt items",
    fields: ["Item", "Quantity", "Price"],
    hint: "Extract only individual receipt purchase items. Ignore subtotal, tax, total, invoice rows, and unrelated document sections unless the user explicitly asks for them.",
  },
  {
    id: "bank",
    label: "Bank statement",
    fields: ["Date", "Description", "Debit", "Credit", "Balance"],
    hint: "Extract only transaction rows from the bank statement. Ignore headings, summaries, opening/closing narrative, and unrelated pages.",
  },
  {
    id: "attendance",
    label: "Attendance / sign-in sheet",
    fields: ["Name", "Role", "Organization", "Signature", "Date"],
    hint: "Extract only attendee or sign-in rows. Ignore instructions, blank signature lines, and unrelated form labels.",
  },
  {
    id: "appointment",
    label: "Appointment letters",
    fields: ["Name", "Role", "Department", "Start date", "Salary"],
    hint: "Extract one row per appointed person or appointment record. Ignore boilerplate paragraphs unless they contain one of the requested fields.",
  },
  {
    id: "results",
    label: "School results",
    fields: ["Student", "Subject", "Score", "Grade"],
    hint: "Extract only result rows. Ignore school headers, grading legends, and unrelated notes.",
  },
  {
    id: "medical",
    label: "Medical / lab report",
    fields: ["Test", "Result", "Unit", "Reference range"],
    hint: "Extract only lab test/result rows. Ignore patient demographics and general notes unless needed for the requested columns.",
  },
  {
    id: "business-cards",
    label: "Business cards",
    fields: ["Name", "Title", "Company", "Phone", "Email"],
    hint: "Extract one row per contact. Ignore unrelated document examples and section headings.",
  },
  {
    id: "id",
    label: "ID card",
    fields: ["Name", "ID number", "Date of birth", "Expiry", "Address"],
    hint: "Extract only fields from ID-card-like content. Ignore unrelated form fields and sample documents.",
  },
  {
    id: "certificate",
    label: "Certificates",
    fields: ["Name", "Award", "Issuer", "Date"],
    hint: "Extract one row per certificate or award. Ignore decorative text and unrelated pages.",
  },
  {
    id: "waybill",
    label: "Waybill / delivery",
    fields: ["Item", "Quantity", "Weight", "Destination"],
    hint: "Extract only delivery or waybill item rows. Ignore totals, instructions, and unrelated pages.",
  },
  {
    id: "form",
    label: "Form fields",
    fields: ["Field", "Value"],
    hint: "Extract only explicit form field labels and their filled values. Ignore instructions, requested action checklists, and unrelated tables.",
  },
  {
    id: "contacts",
    label: "Names & contacts",
    fields: ["Name", "Phone", "Email"],
    hint: "Extract only people or organization contact records. Ignore unrelated labels and prose.",
  },
];

export default function ExtractPage() {
  const [file, setFile] = useState<File | null>(null);
  const [presetId, setPresetId] = useState("invoice");
  const [fieldText, setFieldText] = useState("");
  const [instruction, setInstruction] = useState("");
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<{ values: string[]; confidence: number }[]>([]);
  const [notes, setNotes] = useState("");
  const [hasResult, setHasResult] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const { usage, consume } = useGuestTask();

  const preset = PRESETS.find((p) => p.id === presetId)!;
  const isCustom = presetId === "custom";

  function pick(files: FileList | null) {
    setError(null);
    setHasResult(false);
    const f = files?.[0];
    if (!f) return;
    const v = validateDocFile(f);
    if (!v.ok) {
      setError(v.reason);
      return;
    }
    setFile(f);
  }

  function chosenFields(): string[] {
    if (isCustom) {
      return fieldText
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return preset.fields;
  }

  async function run() {
    if (!file) return;
    setError(null);
    setBusy(true);
    setHasResult(false);
    const fields = chosenFields();
    if (isCustom && fields.length === 0 && !instruction.trim()) {
      setError("Add some columns (comma-separated) or describe what to extract.");
      setBusy(false);
      return;
    }
    try {
      const blocked = await consume();
      if (blocked) {
        setError(blocked);
        return;
      }
      const text = await extractAnyText(file, setStatus);
      const effectiveInstruction = [preset.hint, instruction.trim()].filter(Boolean).join("\n");

      setStatus("Extracting…");
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "extract-table", text, fields, instructions: effectiveInstruction }),
      });
      const data = await res.json();
      if (res.status === 503) throw new Error("AI features aren't enabled on this server.");
      if (!res.ok) throw new Error(data.error || "Extraction failed.");
      const r = data as TableResult;
      const cols = r.columns.length ? r.columns : fields;
      // Normalise every row to the column count so the editable grid stays aligned.
      const norm = r.rows.map((row) => ({
        confidence: typeof row.confidence === "number" ? row.confidence : 1,
        values: cols.map((_, i) => row.values[i] ?? ""),
      }));
      setColumns(cols);
      setRows(norm);
      setNotes(r.notes || "");
      setHasResult(true);
      if (norm.length === 0) setError("No matching data found — try different fields or a clearer scan.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not extract data from this document.");
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  // ---- editing -------------------------------------------------------------
  function editCell(r: number, c: number, v: string) {
    setRows((prev) => prev.map((row, i) => (i === r ? { ...row, values: row.values.map((x, j) => (j === c ? v : x)) } : row)));
  }
  function addRow() {
    setRows((prev) => [...prev, { values: columns.map(() => ""), confidence: 1 }]);
  }
  function removeRow(r: number) {
    setRows((prev) => prev.filter((_, i) => i !== r));
  }

  // ---- export --------------------------------------------------------------
  function baseName() {
    return (file?.name.replace(/\.[^.]+$/, "") || "extract").replace(/[^\w.-]+/g, "_");
  }
  function save(blob: Blob, ext: string) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${baseName()}-data.${ext}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function exportExcel() {
    const blob = await rowsToXlsxBlob({
      sheetName: preset.label.replace(/\s*\/\s*/g, " "),
      columns,
      rows: rows.map((row) => row.values),
    });
    save(blob, "xlsx");
  }
  async function exportPdf() {
    const blocks: DocBlock[] = [
      { type: "heading", level: 1, text: `${preset.label} — extracted data` },
      { type: "table", rows: [columns, ...rows.map((r) => r.values)] },
    ];
    if (notes) blocks.push({ type: "paragraph", text: `Notes: ${notes}` });
    const bytes = await blocksToPdf(blocks);
    save(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), "pdf");
  }
  async function copyTsv() {
    const tsv = [columns.join("\t"), ...rows.map((r) => r.values.join("\t"))].join("\n");
    await navigator.clipboard.writeText(tsv);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Extract data to a table</h1>
      <p className="mt-1 text-muted">
        Pull invoices, receipts, bank statements, line items, names or any custom fields into an
        editable table — then export to a formatted Excel workbook or a PDF report.
      </p>
      <p className="mt-2 text-xs text-muted">
        Private: only the document&apos;s text is sent to the AI; the file stays on your device.
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
                className="press mt-3 rounded-xl bg-brand-500 px-5 py-2.5 font-semibold text-white hover:bg-brand-600"
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
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{file.name}</p>
            <p className="text-sm text-muted">{formatBytes(file.size)}</p>
          </div>
          <button onClick={() => { setFile(null); setHasResult(false); }} className="text-sm font-medium text-brand-600 underline">
            Change
          </button>
        </div>
      )}

      {file && (
        <div className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-muted">What to extract</span>
            <Select
              ariaLabel="What to extract"
              className="w-full sm:w-80"
              value={presetId}
              onChange={setPresetId}
              options={PRESETS.map((p) => ({ value: p.id, label: p.label }))}
            />
          </label>

          {isCustom ? (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-muted">Columns (comma-separated)</span>
              <input
                value={fieldText}
                onChange={(e) => setFieldText(e.target.value)}
                placeholder="e.g. Name, Date, Amount, Status"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {preset.fields.map((f) => (
                <span key={f} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                  {f}
                </span>
              ))}
            </div>
          )}

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-muted">
              Extra instructions <span className="font-normal">(optional)</span>
            </span>
            <input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="e.g. only rows after 1 Jan, amounts in USD, ignore the header block"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <button
            onClick={run}
            disabled={busy}
            className="press rounded-xl bg-brand-500 px-6 py-2.5 font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {busy ? status || "Extracting…" : "Extract table"}
          </button>
          {busy && status && <p className="text-sm text-muted">{status}</p>}
        </div>
      )}

      {hasResult && columns.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink">
              {rows.length} row{rows.length === 1 ? "" : "s"} · {columns.length} column
              {columns.length === 1 ? "" : "s"}
            </p>
            <div className="flex flex-wrap gap-2 text-sm">
              <button onClick={addRow} className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-50">
                + Row
              </button>
              <button onClick={copyTsv} className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-50">
                {copied ? "Copied!" : "Copy table"}
              </button>
              <button onClick={exportExcel} className="rounded-lg bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-700">
                Excel workbook
              </button>
              <button onClick={exportPdf} className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-50">
                PDF report
              </button>
            </div>
          </div>

          {notes && (
            <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {notes}
            </p>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="w-10 border-b border-slate-200 px-2 py-2 text-xs font-semibold text-muted">#</th>
                  {columns.map((c) => (
                    <th key={c} className="border-b border-slate-200 px-3 py-2 font-semibold text-ink">
                      {c}
                    </th>
                  ))}
                  <th className="w-8 border-b border-slate-200"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} className="even:bg-slate-50/50">
                    <td className="px-2 py-1 align-top">
                      <span
                        title={`Confidence ${(row.confidence * 100).toFixed(0)}%`}
                        className={`inline-block h-2 w-2 rounded-full ${
                          row.confidence >= 0.75 ? "bg-emerald-500" : row.confidence >= 0.5 ? "bg-amber-400" : "bg-red-400"
                        }`}
                      />
                    </td>
                    {row.values.map((v, ci) => (
                      <td key={ci} className="border-t border-slate-100 p-0">
                        <input
                          value={v}
                          onChange={(e) => editCell(ri, ci, e.target.value)}
                          className="w-full bg-transparent px-3 py-1.5 outline-none focus:bg-brand-50"
                        />
                      </td>
                    ))}
                    <td className="border-t border-slate-100 px-1 text-center">
                      <button
                        onClick={() => removeRow(ri)}
                        aria-label="Delete row"
                        className="text-slate-300 hover:text-red-500"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">
            Cells are editable — fix anything the AI got wrong before exporting. The dot shows the AI&apos;s
            confidence for that row.
          </p>
        </div>
      )}
    </div>
  );
}
