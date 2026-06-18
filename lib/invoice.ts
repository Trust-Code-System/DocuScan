import { PDFDocument, StandardFonts, rgb } from "@cantoo/pdf-lib";

const PROFILE_KEY = "ds-invoice-business-profile";
const INVOICE_KEY = "ds-invoices";
const SEQUENCE_KEY = "ds-invoice-sequence";

export type InvoiceStatus = "draft" | "unpaid" | "paid";

export interface BusinessProfile {
  name: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
  logoDataUrl?: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceClient {
  name: string;
  email: string;
  address: string;
}

export interface InvoiceDocument {
  id: string;
  number: string;
  status: InvoiceStatus;
  currency: string;
  issueDate: string;
  dueDate: string;
  business: BusinessProfile;
  client: InvoiceClient;
  items: InvoiceItem[];
  taxRate: number;
  discount: number;
  notes: string;
  updatedAt: number;
}

export interface InvoiceTotals {
  subtotal: number;
  discount: number;
  taxable: number;
  tax: number;
  total: number;
}

export const emptyBusinessProfile: BusinessProfile = {
  name: "",
  email: "",
  phone: "",
  address: "",
  taxId: "",
};

export const defaultInvoiceItem = (): InvoiceItem => ({
  id: makeId(),
  description: "",
  quantity: 1,
  unitPrice: 0,
});

export function makeId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return String(Date.now()) + "-" + Math.random().toString(16).slice(2);
}

export function calculateInvoiceTotals(
  items: InvoiceItem[],
  taxRate: number,
  discount: number,
): InvoiceTotals {
  const subtotal = roundMoney(
    items.reduce((sum, item) => {
      const quantity = Number.isFinite(item.quantity) ? Math.max(0, item.quantity) : 0;
      const unitPrice = Number.isFinite(item.unitPrice) ? Math.max(0, item.unitPrice) : 0;
      return sum + quantity * unitPrice;
    }, 0),
  );
  const safeDiscount = roundMoney(Math.min(Math.max(0, discount || 0), subtotal));
  const taxable = roundMoney(Math.max(0, subtotal - safeDiscount));
  const safeTaxRate = Number.isFinite(taxRate) ? Math.max(0, taxRate) : 0;
  const tax = roundMoney(taxable * (safeTaxRate / 100));
  return {
    subtotal,
    discount: safeDiscount,
    taxable,
    tax,
    total: roundMoney(taxable + tax),
  };
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function buildInvoiceNumber(sequence: number, date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `INV-${y}${m}${d}-${String(Math.max(1, sequence)).padStart(4, "0")}`;
}

export function peekNextInvoiceNumber(): string {
  if (typeof window === "undefined") return buildInvoiceNumber(1);
  const next = Number(localStorage.getItem(SEQUENCE_KEY) || "0") + 1;
  return buildInvoiceNumber(next);
}

export function reserveInvoiceNumber(): string {
  if (typeof window === "undefined") return buildInvoiceNumber(1);
  const next = Number(localStorage.getItem(SEQUENCE_KEY) || "0") + 1;
  localStorage.setItem(SEQUENCE_KEY, String(next));
  return buildInvoiceNumber(next);
}

export function loadBusinessProfile(): BusinessProfile {
  if (typeof window === "undefined") return emptyBusinessProfile;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return emptyBusinessProfile;
    return { ...emptyBusinessProfile, ...JSON.parse(raw) };
  } catch {
    return emptyBusinessProfile;
  }
}

export function saveBusinessProfile(profile: BusinessProfile): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function listInvoices(): InvoiceDocument[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(INVOICE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? (parsed as InvoiceDocument[]).sort((a, b) => b.updatedAt - a.updatedAt)
      : [];
  } catch {
    return [];
  }
}

export function saveInvoice(invoice: InvoiceDocument): void {
  if (typeof window === "undefined") return;
  const list = listInvoices();
  const next = [invoice, ...list.filter((item) => item.id !== invoice.id)];
  localStorage.setItem(INVOICE_KEY, JSON.stringify(next));
}

export function deleteInvoice(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(INVOICE_KEY, JSON.stringify(listInvoices().filter((invoice) => invoice.id !== id)));
}

export function validateInvoice(invoice: InvoiceDocument): string | null {
  if (!invoice.business.name.trim()) return "Add your business name.";
  if (!invoice.client.name.trim()) return "Add the client name.";
  if (!invoice.items.some((item) => item.description.trim() && item.quantity > 0)) {
    return "Add at least one invoice item.";
  }
  return null;
}

export async function generateInvoicePdf(invoice: InvoiceDocument): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595.28, 841.89]); // A4 portrait
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const totals = calculateInvoiceTotals(invoice.items, invoice.taxRate, invoice.discount);
  const margin = 48;
  let y = height - margin;

  page.drawText("INVOICE", { x: margin, y, size: 28, font: bold, color: rgb(0.12, 0.12, 0.12) });
  drawText(page, invoice.number, width - margin - 150, y + 4, 150, 10, font, rgb(0.32, 0.32, 0.32), "right");
  y -= 42;

  if (invoice.business.logoDataUrl) {
    try {
      const logoBytes = dataUrlToBytes(invoice.business.logoDataUrl);
      const logo = invoice.business.logoDataUrl.includes("image/png")
        ? await pdf.embedPng(logoBytes)
        : await pdf.embedJpg(logoBytes);
      const max = 54;
      const dims = logo.scale(Math.min(max / logo.width, max / logo.height, 1));
      page.drawImage(logo, { x: margin, y: y - dims.height + 12, width: dims.width, height: dims.height });
    } catch {
      // Ignore invalid local logo data and keep the invoice usable.
    }
  }

  drawLabel(page, "From", margin, y, bold);
  drawWrapped(page, businessLines(invoice.business), margin, y - 16, 220, font);
  drawLabel(page, "Bill to", width - margin - 220, y, bold);
  drawWrapped(page, clientLines(invoice.client), width - margin - 220, y - 16, 220, font);
  y -= 118;

  drawMeta(page, "Issue date", invoice.issueDate, margin, y, font, bold);
  drawMeta(page, "Due date", invoice.dueDate, margin + 150, y, font, bold);
  drawMeta(page, "Status", invoice.status.toUpperCase(), margin + 300, y, font, bold);
  y -= 42;

  page.drawRectangle({ x: margin, y: y - 22, width: width - margin * 2, height: 24, color: rgb(0.96, 0.96, 0.95) });
  drawText(page, "Description", margin + 10, y - 14, 250, 10, bold);
  drawText(page, "Qty", margin + 318, y - 14, 40, 10, bold, undefined, "right");
  drawText(page, "Unit", margin + 380, y - 14, 70, 10, bold, undefined, "right");
  drawText(page, "Amount", margin + 462, y - 14, 68, 10, bold, undefined, "right");
  y -= 36;

  for (const item of invoice.items.filter((it) => it.description.trim())) {
    const amount = roundMoney(Math.max(0, item.quantity) * Math.max(0, item.unitPrice));
    const descLines = wrapText(item.description, 46);
    const rowHeight = Math.max(24, descLines.length * 12 + 8);
    if (y - rowHeight < 180) {
      page = pdf.addPage([595.28, 841.89]);
      y = height - margin;
    }
    drawWrapped(page, descLines, margin + 10, y, 270, font, 10, 12);
    drawText(page, String(item.quantity), margin + 318, y, 40, 10, font, undefined, "right");
    drawText(page, formatCurrency(item.unitPrice, invoice.currency), margin + 365, y, 85, 10, font, undefined, "right");
    drawText(page, formatCurrency(amount, invoice.currency), margin + 448, y, 82, 10, font, undefined, "right");
    page.drawLine({ start: { x: margin, y: y - rowHeight + 6 }, end: { x: width - margin, y: y - rowHeight + 6 }, thickness: 0.5, color: rgb(0.88, 0.88, 0.86) });
    y -= rowHeight;
  }

  y = Math.min(y - 10, 240);
  const totalsX = width - margin - 210;
  drawTotal(page, "Subtotal", formatCurrency(totals.subtotal, invoice.currency), totalsX, y, font);
  y -= 20;
  drawTotal(page, "Discount", `-${formatCurrency(totals.discount, invoice.currency)}`, totalsX, y, font);
  y -= 20;
  drawTotal(page, `Tax (${invoice.taxRate || 0}%)`, formatCurrency(totals.tax, invoice.currency), totalsX, y, font);
  y -= 26;
  page.drawRectangle({ x: totalsX - 8, y: y - 8, width: 218, height: 30, color: rgb(0.99, 0.94, 0.88) });
  drawTotal(page, "Total", formatCurrency(totals.total, invoice.currency), totalsX, y, bold, 13);

  if (invoice.notes.trim()) {
    drawLabel(page, "Notes", margin, 132, bold);
    drawWrapped(page, wrapText(invoice.notes, 80), margin, 116, width - margin * 2, font, 10, 12);
  }

  page.drawText("Generated with DocuScan", {
    x: margin,
    y: 36,
    size: 9,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  return pdf.save();
}

function businessLines(profile: BusinessProfile): string[] {
  return [profile.name, profile.address, profile.email, profile.phone, profile.taxId && `Tax ID: ${profile.taxId}`].filter(Boolean);
}

function clientLines(client: InvoiceClient): string[] {
  return [client.name, client.address, client.email].filter(Boolean);
}

function drawLabel(page: any, text: string, x: number, y: number, font: any) {
  page.drawText(text, { x, y, size: 10, font, color: rgb(0.36, 0.36, 0.36) });
}

function drawMeta(page: any, label: string, value: string, x: number, y: number, font: any, bold: any) {
  page.drawText(label, { x, y, size: 9, font, color: rgb(0.45, 0.45, 0.45) });
  page.drawText(value || "-", { x, y: y - 15, size: 11, font: bold, color: rgb(0.12, 0.12, 0.12) });
}

function drawTotal(page: any, label: string, value: string, x: number, y: number, font: any, size = 10) {
  drawText(page, label, x, y, 90, size, font);
  drawText(page, value, x + 94, y, 110, size, font, undefined, "right");
}

function drawWrapped(
  page: any,
  lines: string[],
  x: number,
  y: number,
  width: number,
  font: any,
  size = 10,
  lineHeight = 13,
) {
  let cy = y;
  for (const line of lines) {
    drawText(page, line, x, cy, width, size, font);
    cy -= lineHeight;
  }
}

function drawText(
  page: any,
  text: string,
  x: number,
  y: number,
  width: number,
  size: number,
  font: any,
  color = rgb(0.15, 0.15, 0.15),
  align: "left" | "right" = "left",
) {
  const clean = String(text || "");
  const textWidth = font.widthOfTextAtSize(clean, size);
  const tx = align === "right" ? x + Math.max(0, width - textWidth) : x;
  page.drawText(clean.slice(0, 130), { x: tx, y, size, font, color });
}

function wrapText(text: string, maxChars: number): string[] {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > maxChars) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = (line + " " + word).trim();
    }
  }
  if (line) lines.push(line);
  return lines;
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] || "";
  if (typeof atob !== "undefined") {
    const binary = atob(base64);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }
  return Uint8Array.from(Buffer.from(base64, "base64"));
}
