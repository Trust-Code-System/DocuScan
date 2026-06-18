# DocuScan QA Checklist

Use this checklist for manual QA after each tool expansion pass.

## Build and smoke
- [x] `npm run build` passes (type-check + lint clean)
- [x] `node --experimental-strip-types scripts/test-smartnotes.mjs` passes
- [x] `node --experimental-strip-types scripts/test-templates.mjs` passes
- [x] `node --experimental-strip-types scripts/test-invoice.mjs` passes
- [x] `node --experimental-strip-types scripts/test-printready.mjs` passes
- [x] `node --experimental-strip-types scripts/test-expenses-reminders.mjs` passes
- [ ] Browser QA completed on desktop
- [ ] Browser QA completed on mobile width

## Smart Notes
- [ ] Paste rough text and format it
- [ ] Verify heading, list, checklist, table, quote and code formatting
- [ ] Toggle checklist items
- [ ] Export PDF
- [ ] Export DOCX
- [ ] Export Markdown
- [ ] Export plain text
- [ ] Send OCR or summary output into Smart Notes

## Saved Text Templates
- [ ] Create a template with title, tags and `{variables}`
- [ ] Search by title, body and tag
- [ ] Edit an existing template
- [ ] Delete an existing template
- [ ] Fill variables and confirm preview updates
- [ ] Copy filled text
- [ ] Download filled text as `.txt`
- [ ] Send filled text to Smart Notes
- [ ] Refresh page and confirm templates persist locally

## Existing Core Tools Regression
- [ ] Image to PDF
- [ ] PDF upload and preview
- [ ] Merge PDF
- [ ] Split PDF
- [ ] Compress PDF
- [ ] Rotate PDF
- [ ] OCR PDF
- [ ] Summarize PDF
- [ ] Ask PDF
- [ ] Study aids
- [ ] Secure share link base flow

## Invoice Maker
- [ ] Save a business profile
- [ ] Add client details
- [ ] Add, edit and remove line items
- [ ] Confirm subtotal, discount, tax and total calculations
- [ ] Generate a PDF invoice
- [ ] Save invoice and reload it from the saved list
- [ ] Mark invoice draft/unpaid/paid
- [ ] Confirm a new invoice number does not duplicate the prior one

## Print Ready PDF
- [ ] Upload a PDF; reject a non-PDF file
- [ ] Normalize to A4 and to Letter; "keep original" preserves size
- [ ] Margins (none / small / standard / wide) apply and content is centered
- [ ] Landscape pages stay landscape
- [ ] Grayscale conversion produces a black & white PDF
- [ ] Page numbers appear centered at the bottom
- [ ] Result preview + download work

## Document QR Labels
- [ ] Add a label with name + link/text (+ optional note)
- [ ] QR renders and encodes the entered value (scan-test with a phone)
- [ ] Delete a label
- [ ] Print labels — only the label grid prints cleanly
- [ ] Labels persist after reload

## Resume Scanner
- [ ] Upload a CV (PDF / Word / image); OCR fallback works on a scan
- [ ] Extracted name/contact/skills/education/experience look right
- [ ] Summary and interview questions generated
- [ ] With a job description: fit / strengths / gaps appear
- [ ] Human-review disclaimer is visible
- [ ] Candidate summary PDF exports

## Receipt Scanner
- [ ] Scan a receipt photo/PDF; fields populate
- [ ] Every field is editable before saving
- [ ] Failed scan still lets you log manually
- [ ] Save to expenses; total and count update
- [ ] Delete an expense
- [ ] Export CSV opens cleanly in Excel (commas/quotes escaped, BOM present)
- [ ] Expenses persist after reload

## Document Reminders
- [ ] Add a reminder with type + due date
- [ ] Status chip shows overdue / today / soon / upcoming correctly
- [ ] Enable browser notifications (permission prompt)
- [ ] A due reminder fires a notification at most once (no duplicates)
- [ ] Delete a reminder
- [ ] Reminders persist after reload

## Security / privacy
- [ ] AI tools send only extracted text (file never uploads)
- [ ] AI routes return 503 when no API key is set
- [ ] Guest usage cap enforced on AI tools
- [ ] Locally-saved data (templates, invoices, expenses, reminders, labels) stays on device
