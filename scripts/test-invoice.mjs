/**
 * Node test for lib/invoice.ts.
 * Run: node --experimental-strip-types scripts/test-invoice.mjs
 */
import assert from "node:assert";
import {
  buildInvoiceNumber,
  calculateInvoiceTotals,
  formatCurrency,
  generateInvoicePdf,
} from "../lib/invoice.ts";

let passed = 0;
const ok = (name) => {
  passed += 1;
  console.log("  OK " + name);
};

{
  const totals = calculateInvoiceTotals(
    [
      { id: "1", description: "Design", quantity: 2, unitPrice: 150 },
      { id: "2", description: "Hosting", quantity: 1, unitPrice: 50 },
    ],
    10,
    25,
  );
  assert.deepStrictEqual(totals, {
    subtotal: 350,
    discount: 25,
    taxable: 325,
    tax: 32.5,
    total: 357.5,
  });
  ok("invoice totals include discount and tax");
}

{
  const date = new Date("2026-06-18T12:00:00Z");
  assert.strictEqual(buildInvoiceNumber(7, date), "INV-20260618-0007");
  ok("invoice number is date-based and padded");
}

{
  assert.ok(formatCurrency(1200, "USD").includes("1,200") || formatCurrency(1200, "USD").includes("1200"));
  ok("currency formatter returns a display value");
}

{
  const bytes = await generateInvoicePdf({
    id: "test",
    number: "INV-20260618-0001",
    status: "unpaid",
    currency: "USD",
    issueDate: "2026-06-18",
    dueDate: "2026-07-02",
    business: {
      name: "DocuScan Ltd",
      email: "billing@example.com",
      phone: "+1 555 0100",
      address: "1 Market Street",
      taxId: "TAX-100",
    },
    client: { name: "Ada Client", email: "ada@example.com", address: "2 Client Road" },
    items: [{ id: "1", description: "Document processing", quantity: 3, unitPrice: 40 }],
    taxRate: 5,
    discount: 0,
    notes: "Thank you.",
    updatedAt: 1,
  });
  assert.ok(bytes.length > 500);
  assert.strictEqual(Buffer.from(bytes.slice(0, 4)).toString("utf8"), "%PDF");
  ok("PDF generation returns a valid PDF");
}

console.log(`\n${passed} checks passed.`);
