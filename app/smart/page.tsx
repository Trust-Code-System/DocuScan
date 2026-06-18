"use client";

import { useState } from "react";
import { validateDocFile } from "@/lib/limits";
import { extractAnyText } from "@/lib/extractText";
import { useGuestTask } from "@/lib/useGuestTask";
import Dropzone from "@/components/Dropzone";
import { track, Events } from "@/lib/analytics";

type ExtractType = "receipt" | "invoice" | "contract" | "resume";
type SmartTask = "name" | "tags" | "extract";
type SmartResult = {
  task: SmartTask;
  label: string;
  docType: ExtractType;
  data: unknown;
};

export default function SmartPage() {
  const [text, setText] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SmartResult | null>(null);
  const [docType, setDocType] = useState<ExtractType>("receipt");
  const { usage, consume } = useGuestTask();

  async function pick(files: FileList | null) {
    setError(null);
    setResult(null);
    setText("");
    const f = files?.[0];
    if (!f) return;
    const v = validateDocFile(f);
    if (!v.ok) {
      setError(v.reason);
      return;
    }
    setFileName(f.name);
    setBusy("Reading document…");
    try {
      const extracted = await extractAnyText(f, (s) => setBusy(s));
      setText(extracted);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this document.");
    } finally {
      setBusy(null);
    }
  }

  async function callAi(task: SmartTask, label: string) {
    if (!text) return;
    setError(null);
    setResult(null);
    const blocked = await consume();
    if (blocked) {
      setError(blocked);
      return;
    }
    setBusy(`${label}…`);
    track(Events.ToolRun, { tool: "smart", task });
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, text, docType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI request failed.");
      setResult({ task, label, docType, data });
      track(Events.ToolResult, { tool: "smart", task });
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI request failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">AI document assistant</h1>
      <p className="mt-1 text-muted">
        Name a document, tag &amp; classify it, or pull structured data from receipts,
        invoices, contracts and résumés. Text is extracted in your browser — only the text is sent.
      </p>
      {usage && (
        <p className="mt-2 text-xs text-muted">
          Free tasks left today: <span className="font-semibold">{usage.remaining}</span> /{" "}
          {usage.limit}
        </p>
      )}

      <Dropzone onFiles={pick} className="mt-5">
        {(open) =>
          fileName ? (
            <div>
              <p className="font-medium text-ink">{fileName}</p>
              {text && <p className="mt-1 text-xs text-muted">{text.length} characters read</p>}
              <button
                type="button"
                onClick={open}
                className="mt-3 text-sm font-medium text-brand-600 underline"
              >
                Choose a different file
              </button>
            </div>
          ) : (
            <>
              <p className="font-medium text-ink">Drop a document here</p>
              <p className="mt-1 text-sm text-muted">PDF, Word, image, text & more — or</p>
              <button
                type="button"
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

      {text && (
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!!busy}
              onClick={() => callAi("name", "Suggesting a name")}
              className="rounded-xl bg-brand-500 px-4 py-2 font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
            >
              Suggest a name
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => callAi("tags", "Tagging")}
              className="rounded-xl border border-slate-300 px-4 py-2 font-semibold text-ink hover:bg-slate-50 disabled:opacity-60"
            >
              Auto-tag &amp; classify
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="mb-2 text-sm font-semibold text-ink">Extract structured data</p>
            <div className="flex flex-wrap items-center gap-2">
              {(["receipt", "invoice", "contract", "resume"] as ExtractType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setDocType(t)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize ${
                    docType === t
                      ? "border-brand-500 bg-brand-500 text-white"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {t}
                </button>
              ))}
              <button
                type="button"
                disabled={!!busy}
                onClick={() => callAi("extract", `Extracting ${docType} data`)}
                className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
              >
                Extract
              </button>
            </div>
          </div>
        </div>
      )}

      {busy && <p className="mt-4 text-sm text-muted">{busy}</p>}

      {result && (
        <SmartResultCard result={result} fileName={fileName} />
      )}
    </div>
  );
}

function SmartResultCard({ result, fileName }: { result: SmartResult; fileName: string }) {
  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-brand-600">
            {result.task === "extract" ? `${result.docType} extraction` : "AI result"}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-ink">{resultTitle(result)}</h2>
          {fileName && <p className="mt-1 text-sm text-muted">{fileName}</p>}
        </div>
      </div>

      <div className="p-5">
        {result.task === "name" && <NameTemplate data={asRecord(result.data)} />}
        {result.task === "tags" && <TagsTemplate data={asRecord(result.data)} />}
        {result.task === "extract" && (
          <ExtractTemplate docType={result.docType} data={asRecord(result.data)} />
        )}
      </div>
    </section>
  );
}

function NameTemplate({ data }: { data: Record<string, unknown> }) {
  const name = value(data.name) || "No name returned";
  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
      <p className="text-sm font-medium text-brand-700">Suggested file name</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <code className="rounded-lg bg-white px-3 py-2 text-base font-semibold text-ink shadow-sm">
          {name}
        </code>
      </div>
    </div>
  );
}

function TagsTemplate({ data }: { data: Record<string, unknown> }) {
  const tags = array(data.tags);
  return (
    <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
      <InfoTile label="Category" value={value(data.category) || "Unclassified"} icon="category" />
      <div className="rounded-xl border border-slate-200 p-4">
        <p className="text-sm font-semibold text-ink">Tags</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.length ? (
            tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700"
              >
                {tag}
              </span>
            ))
          ) : (
            <p className="text-sm text-muted">No tags returned.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ExtractTemplate({
  docType,
  data,
}: {
  docType: ExtractType;
  data: Record<string, unknown>;
}) {
  if (docType === "invoice") return <InvoiceTemplate data={data} />;
  if (docType === "receipt") return <ReceiptTemplate data={data} />;
  if (docType === "contract") return <ContractTemplate data={data} />;
  return <ResumeTemplate data={data} />;
}

function InvoiceTemplate({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <InfoTile label="Invoice #" value={value(data.invoiceNumber) || "-"} icon="tag" />
        <InfoTile label="Total" value={value(data.total) || "-"} icon="payments" emphasis />
        <InfoTile label="Currency" value={value(data.currency) || "-"} icon="attach_money" />
      </div>
      <FieldGrid
        fields={[
          ["Vendor", data.vendor],
          ["Billed to", data.billedTo],
          ["Issue date", data.issueDate],
          ["Due date", data.dueDate],
        ]}
      />
    </div>
  );
}

function ReceiptTemplate({ data }: { data: Record<string, unknown> }) {
  const items = array(data.items);
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <InfoTile label="Merchant" value={value(data.merchant) || "-"} icon="storefront" />
        <InfoTile label="Total" value={value(data.total) || "-"} icon="receipt_long" emphasis />
        <InfoTile label="Date" value={value(data.date) || "-"} icon="calendar_month" />
      </div>
      <FieldGrid fields={[["Currency", data.currency]]} />
      <ListPanel title="Line items" items={items} empty="No line items returned." />
    </div>
  );
}

function ContractTemplate({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="space-y-5">
      <FieldGrid
        fields={[
          ["Title", data.title],
          ["Effective date", data.effectiveDate],
          ["Term length", data.termLength],
          ["Governing law", data.governingLaw],
        ]}
      />
      <ListPanel title="Parties" items={array(data.parties)} empty="No parties returned." />
      {value(data.summary) && (
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-semibold text-ink">Summary</p>
          <p className="mt-2 leading-relaxed text-slate-700">{value(data.summary)}</p>
        </div>
      )}
    </div>
  );
}

function ResumeTemplate({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Candidate</p>
        <h3 className="mt-1 text-xl font-bold text-ink">{value(data.name) || "Unnamed candidate"}</h3>
        {value(data.title) && <p className="mt-1 text-sm font-medium text-brand-600">{value(data.title)}</p>}
      </div>
      <FieldGrid
        fields={[
          ["Email", data.email],
          ["Phone", data.phone],
          ["Experience", data.yearsExperience],
        ]}
      />
      <ListPanel title="Skills" items={array(data.skills)} empty="No skills returned." pill />
      <ListPanel title="Education" items={array(data.education)} empty="No education returned." />
      <p className="text-xs text-muted">
        AI extraction is a drafting aid. Review candidate details manually before using them.
      </p>
    </div>
  );
}

function InfoTile({
  label,
  value,
  icon,
  emphasis,
}: {
  label: string;
  value: string;
  icon: string;
  emphasis?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${emphasis ? "border-brand-200 bg-brand-50" : "border-slate-200"}`}>
      <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
        <span className="material-symbols-outlined text-[18px]" aria-hidden>
          {icon}
        </span>
        {label}
      </div>
      <p className={`mt-2 break-words font-semibold ${emphasis ? "text-xl text-brand-700" : "text-ink"}`}>
        {value}
      </p>
    </div>
  );
}

function FieldGrid({ fields }: { fields: [string, unknown][] }) {
  const visible = fields.filter(([, fieldValue]) => value(fieldValue));
  if (!visible.length) return null;
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {visible.map(([label, fieldValue]) => (
        <div key={label} className="rounded-xl border border-slate-200 p-4">
          <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</dt>
          <dd className="mt-1 break-words text-sm font-medium text-ink">{value(fieldValue)}</dd>
        </div>
      ))}
    </dl>
  );
}

function ListPanel({
  title,
  items,
  empty,
  pill,
}: {
  title: string;
  items: string[];
  empty: string;
  pill?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-sm font-semibold text-ink">{title}</p>
      {items.length ? (
        pill ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {items.map((item) => (
              <span key={item} className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700">
                {item}
              </span>
            ))}
          </div>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {items.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )
      ) : (
        <p className="mt-2 text-sm text-muted">{empty}</p>
      )}
    </div>
  );
}

function resultTitle(result: SmartResult): string {
  if (result.task === "name") return "Suggested document name";
  if (result.task === "tags") return "Classification and tags";
  return `Extracted ${result.docType} details`;
}

function asRecord(data: unknown): Record<string, unknown> {
  return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
}

function value(input: unknown): string {
  if (typeof input === "string") return input.trim();
  if (typeof input === "number" || typeof input === "boolean") return String(input);
  return "";
}

function array(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.map(value).filter(Boolean);
}
