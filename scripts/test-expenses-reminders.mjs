/**
 * Node tests for the pure helpers in lib/expenses.ts and lib/reminders.ts.
 * Run: node --experimental-strip-types scripts/test-expenses-reminders.mjs
 */
import assert from "node:assert";
import { toCsv, sumTotals } from "../lib/expenses.ts";
import { daysUntil, dueStatus } from "../lib/reminders.ts";

let passed = 0;
const ok = (n) => {
  passed++;
  console.log("  ✓ " + n);
};

// --- expenses ---
{
  const rows = [
    { id: "1", merchant: "Cafe, Bistro", date: "2026-06-01", total: "$12.50", tax: "1.00", currency: "USD", category: "Meals", note: 'said "hi"', createdAt: 1 },
    { id: "2", merchant: "Taxi", date: "2026-06-02", total: "30", tax: "", currency: "USD", category: "Travel", note: "", createdAt: 2 },
  ];
  const csv = toCsv(rows);
  assert.ok(csv.startsWith("﻿"), "CSV has a UTF-8 BOM for Excel");
  assert.ok(csv.includes('"Cafe, Bistro"'), "field with comma is quoted");
  assert.ok(csv.includes('"said ""hi"""'), "quotes are escaped");
  assert.ok(csv.includes("Date,Merchant,Category,Total,Tax,Currency,Note"), "header row present");
  ok("toCsv quoting + header + BOM");

  assert.strictEqual(sumTotals(rows), 42.5, "sumTotals parses $ and plain numbers");
  ok("sumTotals lenient parsing");
}

// --- reminders ---
{
  const now = new Date(2026, 5, 18); // 2026-06-18 local
  assert.strictEqual(daysUntil("2026-06-18", now), 0, "same day = 0");
  assert.strictEqual(daysUntil("2026-06-20", now), 2, "two days ahead");
  assert.strictEqual(daysUntil("2026-06-15", now), -3, "three days ago");
  ok("daysUntil local-date math");

  assert.strictEqual(dueStatus("2026-06-15", now), "overdue");
  assert.strictEqual(dueStatus("2026-06-18", now), "today");
  assert.strictEqual(dueStatus("2026-06-23", now), "soon");
  assert.strictEqual(dueStatus("2026-08-01", now), "upcoming");
  ok("dueStatus buckets (overdue/today/soon/upcoming)");
}

console.log(`\n${passed} checks passed.`);
