/**
 * Node test for lib/templates.ts.
 * Run: node --experimental-strip-types scripts/test-templates.mjs
 */
import assert from "node:assert";
import {
  extractVariables,
  fillTemplate,
  matchesQuery,
  normalizeTags,
} from "../lib/templates.ts";

let passed = 0;
const ok = (name) => {
  passed += 1;
  console.log("  OK " + name);
};

{
  const vars = extractVariables("Hi {name}, send {document_name} to {name} by {due date}.");
  assert.deepStrictEqual(vars, ["name", "document_name", "due date"]);
  ok("extractVariables keeps order and removes duplicates");
}

{
  const filled = fillTemplate("Dear {name}, invoice {invoice_number} is due {date}.", {
    name: "Ada",
    invoice_number: "INV-1001",
  });
  assert.strictEqual(filled, "Dear Ada, invoice INV-1001 is due {date}.");
  ok("fillTemplate replaces known values and leaves unknown placeholders");
}

{
  assert.deepStrictEqual(normalizeTags("Invoice, client, invoice,  urgent "), [
    "invoice",
    "client",
    "urgent",
  ]);
  ok("normalizeTags trims, lowercases and deduplicates");
}

{
  const template = {
    id: "1",
    title: "Signature block",
    body: "Best,\n{name}",
    tags: ["forms", "signature"],
    updatedAt: 1,
  };
  assert.strictEqual(matchesQuery(template, "sign"), true);
  assert.strictEqual(matchesQuery(template, "forms"), true);
  assert.strictEqual(matchesQuery(template, "missing"), false);
  assert.strictEqual(matchesQuery(template, ""), true);
  ok("matchesQuery searches title, body and tags");
}

console.log(`\n${passed} checks passed.`);
