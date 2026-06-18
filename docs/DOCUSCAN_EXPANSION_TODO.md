# DocuScan Expansion — TODO Checklist

Living checklist for the tools-expansion pass. `[x]` done, `[ ]` todo.
See `DOCUSCAN_EXPANSION_PLAN.md` for the audit + rationale.

## Audit & planning
- [x] Audit existing codebase (routes, libs, components, AI layer, storage)
- [x] Map the 13 requested tools + Smart Notes against existing routes
- [x] Write `/docs/DOCUSCAN_EXPANSION_PLAN.md`
- [x] Write `/docs/DOCUSCAN_EXPANSION_TODO.md`

## Already existing — verified, not recreated
- [x] AI PDF Summary → `/summarize` (skipped, complete)
- [x] Ask PDF → `/chat` (skipped)
- [x] Study from PDF → `/study` (skipped)
- [x] Smart Form Fill → `/edit` + `/fillable-pdf` (skipped; extended via form profile)
- [x] Core PDF tools: merge/split/compress/rotate/organize/watermark/protect/unlock (verified present)
- [x] Image/Scan to PDF → `/image-to-pdf` (verified present)
- [x] OCR → `/ocr-pdf` (verified present)
- [x] Secure share links (base) → `/api/share` + QR (verified present)
- [x] Browser extension scaffold → `extension/` (roadmap)

## New tools — build
- [x] **Smart Notes** — `lib/smartNotes.ts` (formatter) + `/smart-notes` page
  - [x] Heading / subheading detection
  - [x] Code + language detection → code blocks
  - [x] Numbered / bullet / checklist detection
  - [x] Quote, link, table, key-value, date detection
  - [x] Live preview + manual editing
  - [x] Export PDF / DOCX / Markdown / plain text
  - [x] "Format", "Summarize note", "To checklist", "To flashcards" actions
  - [x] "Send to Smart Notes" handoff from OCR / summary
  - [x] Node test `scripts/test-smartnotes.mjs`
- [x] **Saved Text Templates** — `lib/templates.ts` + `/templates`
  - [x] CRUD, tags, search
  - [x] `{variable}` interpolation with fill form
  - [x] Insert/copy; Node test `scripts/test-templates.mjs`
- [x] **Invoice Maker** — `lib/invoice.ts` + `/invoice`
  - [x] Business profile (logo, name, address) persisted
  - [x] Client details, line items, auto totals, tax, discount
  - [x] Monotonic, non-duplicating invoice numbers
  - [x] Currency support
  - [x] PDF export (pure pdf-lib) + Node test `scripts/test-invoice.mjs`
- [x] **Print Ready PDF** — `lib/printReady.ts` + `/print-ready`
  - [x] Grayscale / B&W, margins, page-size normalize, page numbers
  - [x] Node test `scripts/test-printready.mjs`
- [x] **Document QR Labels** — `/qr-labels`
  - [x] QR for a link/note, printable label sheet
- [x] **Resume Scanner** — `/resume-scanner` + `resume-review` AI task
  - [x] Extract name/email/phone/skills/education/experience
  - [x] Summary, JD compare, interview questions, candidate PDF
  - [x] Human-review disclaimer
- [x] **Receipt Scanner** — `/receipt-scanner` + `lib/expenses.ts`
  - [x] OCR/extract vendor/date/amount/tax/category (receipt schema extended)
  - [x] Editable fields, CSV export, local expense log
- [x] **Document Reminders** — `lib/reminders.ts` + `/reminders`
  - [x] Add reminder per document, due dates, browser notification
  - [x] Dashboard list, no duplicate fires (`notified` flag)
  - [x] Node test `scripts/test-expenses-reminders.mjs`

## Wiring & polish
- [x] Register new tools in `components/ToolGrid.tsx`
- [x] Add SEO entries in `lib/seo.ts` + per-tool `layout.tsx`
- [x] Highlight Smart Notes on home page band
- [x] Add new AI task (`resume-review`) to `lib/ai.ts` + `app/api/ai/route.ts` validation
- [x] Extend receipt extraction schema with `tax` + `category`
- [x] Update `.env.example` (no new required vars; documented)
- [x] Create `README.md` with the full feature list
- [x] Write/extend `/docs/QA_CHECKLIST.md` (now covers all new tools)

## Build / verification
- [x] `npm run build` compiles, type-checks and lints clean
- [x] Node tests pass (`smartnotes`, `templates`, `invoice`, `printready`, `expenses-reminders`)
- [ ] Real-browser QA of new pages (manual — see QA_CHECKLIST.md)

## Deferred / roadmap
- [x] Secure share links: password (scrypt), download limit + counter, revoke, expiry tracking — `lib/share.ts` + `/api/share`, `/api/share/[id]`, `/api/v1/share`, tested by `scripts/test-share.mjs`. Per-link `manageToken` revokes/inspects without accounts. Storage backend precedence: **S3/R2 → Redis → in-memory** (in-memory is dev-only; it does NOT survive serverless cold starts). The Redis backend (Upstash) auto-expires links via PX TTL and was verified live end-to-end (download, password gate, limit, revoke). `GET /api/health` reports the active `shareStore`. For large PDFs near the 20 MB cap, configure S3/R2 (keeps big blobs out of Redis, stays under Upstash request-size limits). Counter `update` is last-write-wins, not transactional — may over-count by one under truly simultaneous downloads, never under-count.
- [ ] Passwordless login / accounts (Phase 4 auth + DB)
- [ ] Cloud sync of saved templates/invoices/reminders (needs accounts)
- [ ] Print-shop integration, NFC labels, WhatsApp OTP (roadmap)
