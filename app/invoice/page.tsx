"use client";

import { useEffect, useMemo, useState } from "react";
import {
  calculateInvoiceTotals,
  defaultInvoiceItem,
  deleteInvoice,
  emptyBusinessProfile,
  formatCurrency,
  generateInvoicePdf,
  listInvoices,
  loadBusinessProfile,
  makeId,
  peekNextInvoiceNumber,
  reserveInvoiceNumber,
  saveBusinessProfile,
  saveInvoice,
  validateInvoice,
  type BusinessProfile,
  type InvoiceClient,
  type InvoiceDocument,
  type InvoiceItem,
  type InvoiceStatus,
} from "@/lib/invoice";

const currencies = ["USD", "NGN", "EUR", "GBP", "CAD", "AUD", "GHS", "KES", "ZAR"];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function plusDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export default function InvoicePage() {
  const [business, setBusiness] = useState<BusinessProfile>(emptyBusinessProfile);
  const [client, setClient] = useState<InvoiceClient>({ name: "", email: "", address: "" });
  const [items, setItems] = useState<InvoiceItem[]>([defaultInvoiceItem()]);
  const [currency, setCurrency] = useState("USD");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [status, setStatus] = useState<InvoiceStatus>("unpaid");
  const [issueDate, setIssueDate] = useState(today());
  const [dueDate, setDueDate] = useState(plusDays(14));
  const [taxRate, setTaxRate] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("Thank you for your business.");
  const [invoiceId, setInvoiceId] = useState(makeId());
  const [saved, setSaved] = useState<InvoiceDocument[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBusiness(loadBusinessProfile());
    setInvoiceNumber(peekNextInvoiceNumber());
    setSaved(listInvoices());
  }, []);

  const totals = useMemo(
    () => calculateInvoiceTotals(items, taxRate, discount),
    [items, taxRate, discount],
  );

  const invoice: InvoiceDocument = {
    id: invoiceId,
    number: invoiceNumber,
    status,
    currency,
    issueDate,
    dueDate,
    business,
    client,
    items,
    taxRate,
    discount,
    notes,
    updatedAt: Date.now(),
  };

  function showMessage(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(null), 1800);
  }

  function updateItem(id: string, patch: Partial<InvoiceItem>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function removeItem(id: string) {
    setItems((current) => (current.length === 1 ? current : current.filter((item) => item.id !== id)));
  }

  function newInvoice() {
    setInvoiceId(makeId());
    setInvoiceNumber(peekNextInvoiceNumber());
    setClient({ name: "", email: "", address: "" });
    setItems([defaultInvoiceItem()]);
    setStatus("unpaid");
    setIssueDate(today());
    setDueDate(plusDays(14));
    setTaxRate(0);
    setDiscount(0);
    setNotes("Thank you for your business.");
    setError(null);
  }

  function persistBusiness() {
    saveBusinessProfile(business);
    showMessage("Business profile saved.");
  }

  function ensureReservedNumber() {
    if (invoiceNumber === peekNextInvoiceNumber()) {
      const reserved = reserveInvoiceNumber();
      setInvoiceNumber(reserved);
      return reserved;
    }
    return invoiceNumber;
  }

  function buildInvoice(): InvoiceDocument {
    return { ...invoice, number: ensureReservedNumber(), updatedAt: Date.now() };
  }

  function persistInvoice(): InvoiceDocument | null {
    const next = buildInvoice();
    const validation = validateInvoice(next);
    if (validation) {
      setError(validation);
      return null;
    }
    saveBusinessProfile(business);
    saveInvoice(next);
    setSaved(listInvoices());
    setError(null);
    showMessage("Invoice saved.");
    return next;
  }

  async function downloadPdf() {
    const next = persistInvoice();
    if (!next) return;
    setBusy("Building invoice PDF...");
    try {
      const bytes = await generateInvoicePdf(next);
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${next.number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not generate the invoice PDF.");
    } finally {
      setBusy(null);
    }
  }

  function loadInvoice(existing: InvoiceDocument) {
    setInvoiceId(existing.id);
    setInvoiceNumber(existing.number);
    setBusiness(existing.business);
    setClient(existing.client);
    setItems(existing.items.length ? existing.items : [defaultInvoiceItem()]);
    setCurrency(existing.currency);
    setIssueDate(existing.issueDate);
    setDueDate(existing.dueDate);
    setStatus(existing.status);
    setTaxRate(existing.taxRate);
    setDiscount(existing.discount);
    setNotes(existing.notes);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function removeInvoice(existing: InvoiceDocument) {
    if (!window.confirm(`Delete ${existing.number}?`)) return;
    deleteInvoice(existing.id);
    setSaved(listInvoices());
    showMessage("Invoice deleted.");
  }

  function handleLogo(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Use a PNG or JPG logo.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setBusiness((profile) => ({ ...profile, logoDataUrl: String(reader.result || "") }));
    reader.readAsDataURL(file);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">Invoice Maker</h1>
          <p className="mt-2 text-muted">
            Create a clean invoice PDF with client details, line items, tax, discount, local currency
            and a saved business profile. Invoice numbers are reserved locally so they do not repeat
            on this device.
          </p>
        </div>
        <button
          onClick={newInvoice}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
        >
          New invoice
        </button>
      </div>

      {message && (
        <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700">
          {message}
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Panel title="Business profile">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Business name" value={business.name} onChange={(value) => setBusiness((b) => ({ ...b, name: value }))} />
              <Field label="Email" value={business.email} onChange={(value) => setBusiness((b) => ({ ...b, email: value }))} />
              <Field label="Phone" value={business.phone} onChange={(value) => setBusiness((b) => ({ ...b, phone: value }))} />
              <Field label="Tax ID" value={business.taxId} onChange={(value) => setBusiness((b) => ({ ...b, taxId: value }))} />
            </div>
            <label className="mt-4 block">
              <span className="text-sm font-medium text-ink">Address</span>
              <textarea
                value={business.address}
                onChange={(event) => setBusiness((b) => ({ ...b, address: event.target.value }))}
                className="mt-1 h-20 w-full resize-y rounded-lg border border-slate-300 bg-white p-3 text-sm outline-none focus:border-brand-500"
              />
            </label>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-slate-50">
                Logo
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="sr-only"
                  onChange={(event) => handleLogo(event.target.files?.[0] || null)}
                />
              </label>
              {business.logoDataUrl && (
                <button
                  onClick={() => setBusiness((b) => ({ ...b, logoDataUrl: undefined }))}
                  className="text-sm font-medium text-red-600"
                >
                  Remove logo
                </button>
              )}
              <button
                onClick={persistBusiness}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
              >
                Save profile
              </button>
            </div>
          </Panel>

          <Panel title="Invoice details">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Invoice number" value={invoiceNumber} onChange={setInvoiceNumber} />
              <label className="block">
                <span className="text-sm font-medium text-ink">Status</span>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as InvoiceStatus)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
                >
                  <option value="draft">Draft</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="paid">Paid</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-ink">Currency</span>
                <select
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
                >
                  {currencies.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </label>
              <Field label="Issue date" type="date" value={issueDate} onChange={setIssueDate} />
              <Field label="Due date" type="date" value={dueDate} onChange={setDueDate} />
              <Field label="Tax rate (%)" type="number" value={String(taxRate)} onChange={(value) => setTaxRate(Number(value))} />
              <Field label="Discount" type="number" value={String(discount)} onChange={(value) => setDiscount(Number(value))} />
            </div>
          </Panel>

          <Panel title="Client">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Client name" value={client.name} onChange={(value) => setClient((c) => ({ ...c, name: value }))} />
              <Field label="Client email" value={client.email} onChange={(value) => setClient((c) => ({ ...c, email: value }))} />
            </div>
            <label className="mt-4 block">
              <span className="text-sm font-medium text-ink">Client address</span>
              <textarea
                value={client.address}
                onChange={(event) => setClient((c) => ({ ...c, address: event.target.value }))}
                className="mt-1 h-20 w-full resize-y rounded-lg border border-slate-300 bg-white p-3 text-sm outline-none focus:border-brand-500"
              />
            </label>
          </Panel>

          <Panel title="Items">
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_90px_120px_auto]">
                  <Field label="Description" value={item.description} onChange={(value) => updateItem(item.id, { description: value })} />
                  <Field label="Qty" type="number" value={String(item.quantity)} onChange={(value) => updateItem(item.id, { quantity: Number(value) })} />
                  <Field label="Unit price" type="number" value={String(item.unitPrice)} onChange={(value) => updateItem(item.id, { unitPrice: Number(value) })} />
                  <button
                    onClick={() => removeItem(item.id)}
                    disabled={items.length === 1}
                    className="self-end rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setItems((current) => [...current, defaultInvoiceItem()])}
              className="mt-3 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
            >
              Add item
            </button>
          </Panel>

          <Panel title="Notes">
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="h-28 w-full resize-y rounded-lg border border-slate-300 bg-white p-3 text-sm outline-none focus:border-brand-500"
            />
          </Panel>
        </div>

        <aside className="space-y-6">
          <div className="sticky top-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <h2 className="text-lg font-semibold text-ink">Preview total</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <Row label="Subtotal" value={formatCurrency(totals.subtotal, currency)} />
              <Row label="Discount" value={`-${formatCurrency(totals.discount, currency)}`} />
              <Row label={`Tax (${taxRate || 0}%)`} value={formatCurrency(totals.tax, currency)} />
              <div className="border-t border-slate-200 pt-3">
                <Row label="Total" value={formatCurrency(totals.total, currency)} strong />
              </div>
            </dl>
            {busy && <p className="mt-4 text-sm text-muted">{busy}</p>}
            <div className="mt-5 grid gap-2">
              <button
                onClick={downloadPdf}
                disabled={!!busy}
                className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
              >
                Download PDF
              </button>
              <button
                onClick={persistInvoice}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:bg-slate-50"
              >
                Save invoice
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <h2 className="text-lg font-semibold text-ink">Saved invoices</h2>
            {saved.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Saved invoices will appear here.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {saved.map((existing) => (
                  <div key={existing.id} className="rounded-lg border border-slate-200 p-3">
                    <button onClick={() => loadInvoice(existing)} className="block w-full text-left">
                      <p className="font-semibold text-ink">{existing.number}</p>
                      <p className="text-sm text-muted">{existing.client.name || "No client"}</p>
                    </button>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                        {existing.status}
                      </span>
                      <button
                        onClick={() => removeInvoice(existing)}
                        className="text-xs font-medium text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <h2 className="mb-4 text-lg font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink">{label}</span>
      <input
        type={type}
        value={value}
        step={type === "number" ? "0.01" : undefined}
        min={type === "number" ? "0" : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
      />
    </label>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${strong ? "text-base font-bold text-ink" : "text-slate-700"}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
