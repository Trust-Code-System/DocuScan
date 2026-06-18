"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteTemplate,
  extractVariables,
  fillTemplate,
  listTemplates,
  matchesQuery,
  normalizeTags,
  saveTemplate,
  TEMPLATES_EVENT,
  type TextTemplate,
} from "@/lib/templates";

const SAMPLE_TEMPLATES = [
  {
    title: "Invoice note",
    tags: ["invoice", "business"],
    body: "Thank you for your business, {client}. Payment is due by {due_date}. Please reference invoice {invoice_number}.",
  },
  {
    title: "Signature block",
    tags: ["signature"],
    body: "{name}\n{role}\n{company}\n{phone}\n{email}",
  },
  {
    title: "Document follow-up",
    tags: ["email", "follow-up"],
    body: "Hi {name},\n\nI am following up on {document_name}. Please review and send any changes by {date}.\n\nBest,\n{sender}",
  },
];

type Draft = {
  id?: string;
  title: string;
  tags: string;
  body: string;
};

const emptyDraft: Draft = { title: "", tags: "", body: "" };

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<TextTemplate[]>([]);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function refresh() {
    setTemplates(listTemplates());
  }

  useEffect(() => {
    refresh();
    window.addEventListener(TEMPLATES_EVENT, refresh);
    return () => window.removeEventListener(TEMPLATES_EVENT, refresh);
  }, []);

  const filtered = useMemo(
    () => templates.filter((template) => matchesQuery(template, query)),
    [templates, query],
  );

  const selected = useMemo(
    () => templates.find((template) => template.id === selectedId) || filtered[0] || null,
    [templates, selectedId, filtered],
  );

  const variables = useMemo(() => extractVariables(selected?.body || ""), [selected]);
  const filled = useMemo(
    () => (selected ? fillTemplate(selected.body, values) : ""),
    [selected, values],
  );

  useEffect(() => {
    if (!selected) return;
    setSelectedId(selected.id);
    setValues((current) => {
      const next: Record<string, string> = {};
      for (const variable of extractVariables(selected.body)) next[variable] = current[variable] || "";
      return next;
    });
  }, [selected?.id, selected?.body]);

  function showMessage(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(null), 1800);
  }

  function resetDraft() {
    setDraft(emptyDraft);
  }

  function editTemplate(template: TextTemplate) {
    setDraft({
      id: template.id,
      title: template.title,
      tags: template.tags.join(", "),
      body: template.body,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleSave() {
    const title = draft.title.trim();
    const body = draft.body.trim();
    if (!title || !body) {
      showMessage("Add a title and template text first.");
      return;
    }
    const saved = saveTemplate({
      id: draft.id,
      title,
      body,
      tags: normalizeTags(draft.tags),
    });
    setSelectedId(saved.id);
    resetDraft();
    refresh();
    showMessage(draft.id ? "Template updated." : "Template saved.");
  }

  function handleDelete(template: TextTemplate) {
    const ok = window.confirm(`Delete "${template.title}"?`);
    if (!ok) return;
    deleteTemplate(template.id);
    if (selectedId === template.id) setSelectedId(null);
    refresh();
    showMessage("Template deleted.");
  }

  function addSamples() {
    for (const sample of SAMPLE_TEMPLATES) {
      saveTemplate({ title: sample.title, body: sample.body, tags: sample.tags });
    }
    refresh();
    showMessage("Sample templates added.");
  }

  async function copyFilled() {
    if (!filled) return;
    await navigator.clipboard.writeText(filled);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  function downloadText() {
    if (!selected) return;
    const blob = new Blob([filled], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selected.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "template"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function sendToSmartNotes() {
    if (!filled) return;
    try {
      sessionStorage.setItem("ds-smartnotes-seed", filled);
    } catch {
      /* best effort */
    }
    router.push("/smart-notes");
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Saved Text Templates</h1>
        <p className="mt-2 text-muted">
          Store reusable document text for forms, letters, invoices and signature blocks. Use
          variables like {"{name}"} or {"{date}"}, fill them in, then copy the finished text.
        </p>
        <p className="mt-2 text-xs text-muted">
          Private: templates are saved on this device only until DocuScan accounts are added.
        </p>
      </div>

      {message && (
        <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700">
          {message}
        </div>
      )}

      <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">
                {draft.id ? "Edit template" : "Create template"}
              </h2>
              <p className="text-sm text-muted">Add placeholders with braces, for example {"{client}"}.</p>
            </div>
            {draft.id && (
              <button
                onClick={resetDraft}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-slate-50"
              >
                New
              </button>
            )}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-ink">Title</span>
              <input
                value={draft.title}
                onChange={(event) => setDraft((d) => ({ ...d, title: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
                placeholder="Client follow-up"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">Tags</span>
              <input
                value={draft.tags}
                onChange={(event) => setDraft((d) => ({ ...d, tags: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
                placeholder="forms, invoice, signature"
              />
            </label>
          </div>

          <label className="mt-4 block">
            <span className="text-sm font-medium text-ink">Template text</span>
            <textarea
              value={draft.body}
              onChange={(event) => setDraft((d) => ({ ...d, body: event.target.value }))}
              className="mt-1 h-56 w-full resize-y rounded-lg border border-slate-300 bg-white p-3 font-mono text-sm leading-relaxed text-ink outline-none focus:border-brand-500"
              placeholder={"Hi {name},\n\nPlease review {document_name} by {date}.\n\nBest,\n{sender}"}
            />
          </label>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={handleSave}
              className="press rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
            >
              {draft.id ? "Update template" : "Save template"}
            </button>
            {templates.length === 0 && (
              <button
                onClick={addSamples}
                className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-slate-50"
              >
                Add samples
              </button>
            )}
          </div>
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <h2 className="text-lg font-semibold text-ink">Fill variables</h2>
          {!selected ? (
            <p className="mt-3 text-sm text-muted">Save or select a template to fill its variables.</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted">{selected.title}</p>
              {variables.length ? (
                <div className="mt-4 space-y-3">
                  {variables.map((variable) => (
                    <label key={variable} className="block">
                      <span className="text-sm font-medium text-ink">{variable}</span>
                      <input
                        value={values[variable] || ""}
                        onChange={(event) =>
                          setValues((current) => ({ ...current, [variable]: event.target.value }))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
                      />
                    </label>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted">This template has no variables.</p>
              )}

              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Preview
                </p>
                <pre className="max-h-64 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">
                  {filled}
                </pre>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={copyFilled}
                  className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
                <button
                  onClick={downloadText}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-slate-50"
                >
                  Text file
                </button>
                <button
                  onClick={sendToSmartNotes}
                  className="col-span-2 rounded-lg border border-ai-200 bg-ai-50 px-3 py-2 text-sm font-medium text-ai-700 hover:bg-ai-100"
                >
                  Send to Smart Notes
                </button>
              </div>
            </>
          )}
        </aside>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">Your templates</h2>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 sm:w-72"
            placeholder="Search templates"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-muted">
            {templates.length === 0
              ? "No templates yet. Create one or add the samples above."
              : "No templates match your search."}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((template) => (
              <article
                key={template.id}
                className={`rounded-xl border bg-white p-4 transition hover:shadow-card ${
                  selected?.id === template.id ? "border-brand-400" : "border-slate-200"
                }`}
              >
                <button
                  onClick={() => setSelectedId(template.id)}
                  className="block w-full text-left"
                >
                  <h3 className="font-semibold text-ink">{template.title}</h3>
                  <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                    {template.body}
                  </p>
                </button>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {template.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted">
                    {new Date(template.updatedAt).toLocaleDateString()}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => editTemplate(template)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(template)}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
