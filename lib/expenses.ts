/**
 * Receipt Scanner expense log — device-local store of scanned/corrected
 * receipts so users can build a monthly expense report and export CSV.
 *
 * Pure helpers (toCsv) are DOM-free. Storage is localStorage (same no-account
 * model as the other new tools); the seam can later be swapped for an
 * authenticated API without changing the UI.
 */

const KEY = "ds-expenses";
export const EXPENSES_EVENT = "ds-expenses-change";

export interface Expense {
  id: string;
  merchant: string;
  date: string; // ISO-ish string as read/entered
  total: string;
  tax: string;
  currency: string;
  category: string;
  note: string;
  createdAt: number;
}

export function makeId(): string {
  return (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) || String(Date.now());
}

function read(): Expense[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Expense[]) : [];
  } catch {
    return [];
  }
}

function write(list: Expense[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(EXPENSES_EVENT));
  } catch {
    /* best effort */
  }
}

export function listExpenses(): Expense[] {
  return read().sort((a, b) => b.createdAt - a.createdAt);
}

export function addExpense(input: Omit<Expense, "id" | "createdAt">): Expense {
  const created: Expense = { ...input, id: makeId(), createdAt: Date.now() };
  write([created, ...read()]);
  return created;
}

export function deleteExpense(id: string): void {
  write(read().filter((e) => e.id !== id));
}

/** CSV-escape a single field. */
function esc(v: string): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build a CSV (with a UTF-8 BOM for Excel) from a list of expenses. */
export function toCsv(list: Expense[]): string {
  const headers = ["Date", "Merchant", "Category", "Total", "Tax", "Currency", "Note"];
  const rows = list.map((e) =>
    [e.date, e.merchant, e.category, e.total, e.tax, e.currency, e.note].map(esc).join(","),
  );
  return "﻿" + [headers.join(","), ...rows].join("\n") + "\n";
}

/** Sum of totals parsed leniently (ignores currency symbols/commas). */
export function sumTotals(list: Expense[]): number {
  return list.reduce((sum, e) => {
    const n = parseFloat(String(e.total).replace(/[^0-9.\-]/g, ""));
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}
