# DocuScan Expansion Plan

> Generated during the "tools expansion" pass. Read alongside `HANDOFF.md` and
> `TODO.md` (the original backlog). This document records the **audit result**,
> what was **skipped because it already exists**, what was **improved**, and what
> is **net-new**, plus architecture/security/production notes.

---

## 1. Audit result — how DocuScan is built today

**Stack:** Next.js 15.3.3 (App Router), TypeScript, Tailwind v4, `@cantoo/pdf-lib`
(fork with in-browser encryption — _not_ stock pdf-lib), pdfjs-dist, tesseract.js,
OpenCV.js (CDN), jszip, qrcode, docx, fabric, `@anthropic-ai/sdk` + `openai`
(provider-agnostic, server-only), `@upstash/redis`, `@aws-sdk/client-s3`.

**Core architecture principles already established (and followed by this expansion):**

- **Client-side first / privacy-first.** PDF transforms, OCR, text extraction and
  rendering all run in the browser. AI tools extract text on-device (`lib/extractText.ts`)
  and send only the *text* to `/api/ai` — the raw file never uploads.
- **Each tool = a route under `app/<tool>/`** (a `"use client"` `page.tsx` + a tiny
  server `layout.tsx` that exports `toolMetadata(slug)` from `lib/seo.ts`).
- **Shared building blocks:** `components/Dropzone.tsx`, `components/PdfResult.tsx`,
  `lib/limits.ts` (file/size/type validation), `lib/useGuestTask.ts` (guest usage cap),
  `lib/toPdf.ts`, `lib/pdf.ts`, `components/ToolGrid.tsx` (the central tool registry).
- **AI layer** (`lib/ai.ts` + `app/api/ai/route.ts`): one provider-agnostic module,
  a `task` switch, structured JSON output, env-gated (`aiEnabled()` → 503 when no key),
  rate-limited 10/5min/IP.
- **Storage seams:** in-memory by default, env-selected Redis (usage/ratelimit) and
  S3/R2 (shares). No SQL database and **no auth yet** — this is intentional (no-signup
  for basic use). "Saved" data for logged-out users therefore lives in `localStorage`.
- **Cross-cutting:** rate limiting on every endpoint, analytics + Sentry (consent-gated),
  cookie consent, SEO/sitemap/robots, PWA + share target, i18n (en/es/fr/ar), referral,
  white-label, developer API.

### Existing routes (50+)
PDF: `/image-to-pdf` (scan + image→PDF), `/merge-pdf`, `/split-pdf`, `/compress-pdf`,
`/rotate-pdf`, `/organize-pdf` (reorder/delete), `/watermark-pdf`, `/page-numbers`,
`/protect-pdf`, `/unlock-pdf`, `/batch`, `/edit` (full overlay editor + AcroForm fill),
`/convert`, `/pdf-to-word`, `/pdf-to-excel`, `/pdf-to-image`, `/fillable-pdf`.
Scan: `/auto-crop`, `/enhance-scan`, `/clean-scan`, `/handwriting`, `/enhance`.
AI: `/ocr-pdf`, `/summarize` (16 modes), `/chat` (Ask PDF), `/reconstruct` (make editable),
`/redact`, `/translate`, `/compare`, `/extract` (any→table), `/analyze` (contract),
`/draft`, `/rewrite`, `/study`, `/audio`, `/slides`, `/smart` (name/tag/extract),
`/detect-document-type`, `/smart-rename`.
Sign: `/sign-pdf`. Share/infra: `/api/share`, `/api/cron/cleanup`, `/developers`,
`/security`, `/privacy`, `/terms`, `/guides`.

---

## 2. Requested tools mapped against what exists

| Requested tool | Status | Resolution |
| --- | --- | --- |
| **Tool 1 — AI PDF Summary / Ask PDF** | ✅ Exists | `/summarize` (16 modes, key points, action items, export) + `/chat` (Ask PDF). **Skipped** — already complete. |
| **Tool 2 — Study from PDF** | ✅ Exists | `/study` (flashcards + MCQ quiz). **Skipped.** |
| **Tool 3 — Invoice Maker** | ✅ Added | **New `/invoice`** with invoice PDF, business profile, logo, auto-numbering, local invoice records, status, currency, totals/tax/discount. (Invoice *scanner* is still pending/partially covered by `/smart` + `/extract`.) |
| **Tool 4 — Receipt Scanner** | ✅ Added | **New `/receipt-scanner`** — read a receipt, AI-extract merchant/date/total/tax/category (receipt schema extended), correct every field, save to a local expense log (`lib/expenses.ts`) and export CSV. |
| **Tool 5 — Secure PDF Share Links** | 🟡 Partial | `/api/share` already gives temp links + QR + 1h/7d TTL + cron cleanup. Password/download-limit/revoke = **planned improvement** (needs the share backend + live storage to test; deferred to avoid breaking working flows). |
| **Tool 6 — Print Ready PDF** | ✅ Added | **New `/print-ready`** (`lib/printReady.ts`) — normalize to A4/Letter/keep, even margins, page numbers (pure pdf-lib) + optional grayscale (pdf.js raster). |
| **Tool 7 — Smart Form Fill** | ✅ Exists | `/edit` fills AcroForm fields + manual placement; `/fillable-pdf` hub. A saved **form profile** is served by the new Saved Text Templates store. **Skipped/extended.** |
| **Tool 8 — Document QR Labels** | ✅ Added | **New `/qr-labels`** — QR for any link/note (`lib/qr.ts`), saved locally, with a printable label sheet (`print:` styles). |
| **Tool 9 — Resume Scanner** | ✅ Added | **New `/resume-scanner`** — `reviewResume` AI task (extract + summary + JD fit + strengths/gaps + interview questions) → candidate summary PDF, with a human-review disclaimer. |
| **Tool 10 — Document Reminders** | ✅ Added | **New `/reminders`** (`lib/reminders.ts`) — due dates per document, status buckets, browser notifications fired at most once. |
| **Tool 11 — Saved Text Templates** | ✅ Added | **New `/templates`** — reusable text snippets with `{variables}`, tags, search, fill, copy, `.txt` export and Smart Notes handoff. |
| **Tool 12 — Passwordless Login** | ⛔ N/A | No auth system exists yet (by design). Per instructions, not rebuilding auth. **Roadmap.** |
| **Tool 13 — Browser Extension** | ✅ Scaffold | `extension/` MV3 scaffold exists. **Roadmap** (no new work). |
| **Smart Notes** | 🆕 Missing | **New `/smart-notes`** — flagship. Paste rough text → auto-format headings/code/lists/checklists/quotes/tables; export PDF/DOCX/MD/TXT; receives OCR/summary output. |

---

## 3. What this expansion currently adds (net-new)

All completed net-new tools follow the established pattern: client-side, no server dependency,
`localStorage` for "saved" data, and reuse of existing export/handoff seams.

1. **Smart Notes** — `lib/smartNotes.ts` (pure, Node-tested formatter: heading / subheading /
   code-fence / language detection / numbered & bullet lists / checklists / quotes / tables /
   key-value alignment) + `/smart-notes` editor with live preview and PDF/DOCX/MD/TXT export.
   Integrations: "Send to Smart Notes" hook via sessionStorage key `ds-smartnotes-seed`.
2. **Saved Text Templates** — `lib/templates.ts` (localStorage CRUD, tag/search, `{variable}`
   interpolation) + `/templates` manager with create/edit/delete, search, variable fill, copy,
   text export and Smart Notes handoff. Pure helpers are covered by `scripts/test-templates.mjs`.
3. **Invoice Maker** — `lib/invoice.ts` (totals/tax/discount math, monotonic invoice numbering,
   local business profile/invoice store, pure pdf-lib PDF generator) + `/invoice` form. Covered by
   `scripts/test-invoice.mjs`.
4. **Print Ready PDF** — `lib/printReady.ts` (pure pdf-lib re-layout: size normalize + margins +
   page numbers, Node-tested; browser-only grayscale raster) + `/print-ready`. Covered by
   `scripts/test-printready.mjs`.
5. **Document QR Labels** — `/qr-labels` (reuses `lib/qr.ts`; localStorage labels; printable sheet).
6. **Resume Scanner** — `reviewResume` AI task in `lib/ai.ts` + `/resume-scanner` + candidate PDF
   (`lib/docExport` `blocksToPdf`).
7. **Receipt Scanner** — `/receipt-scanner` + `lib/expenses.ts` (CSV with BOM/escaping +
   sum, Node-tested) + the extended `extract(receipt)` schema (adds `tax`, `category`).
8. **Document Reminders** — `lib/reminders.ts` (date helpers Node-tested, single-fire notifications)
   + `/reminders`.

### New / extended AI
- **`resume-review`** task added to `lib/ai.ts` + `app/api/ai/route.ts` (extract + summary + JD fit +
  interview questions in one structured call).
- **`extract(receipt)`** schema extended with `tax` and `category` (additive — existing `/smart`
  and `/extract` callers unaffected).

### Tests
- `scripts/test-smartnotes.mjs`, `test-templates.mjs`, `test-invoice.mjs`, `test-printready.mjs`,
  `test-expenses-reminders.mjs` — all passing. `npm run build` compiles, type-checks and lints clean.

---

## 4. Product structure / navigation

The home `ToolGrid` is the catalogue. New tools are registered there (alphabetical,
auto-sorted) and given SEO entries. A new **`/smart-notes`** gets a nav highlight on
the home "AI document tools" band. Categories from the brief map onto existing routes;
no duplicate sidebars/navbars are introduced (the app uses a single header + footer).

---

## 5. Database / storage decisions

- **No new SQL tables** are introduced — the project has no DB/ORM yet. Adding one is a
  larger Phase-4 effort (auth + Postgres + migrations) already tracked in `TODO.md`.
- "Saved" data for completed local tools (templates, business profile and invoices today; future
  reminders and expense log later) is stored in **`localStorage`** behind small typed modules in `lib/`, each
  written so the storage backend can later be swapped for an authenticated API without
  touching the UI (same seam philosophy as `lib/usage.ts`).
- Each `lib/*` store namespaces its key under `ds-*` to match existing conventions
  (`ds-branding`, etc.).

---

## 6. Security & privacy decisions

- New tools keep the **client-side / file-never-uploads** guarantee. The AI ones send only
  extracted text and reuse the existing rate-limited, env-gated `/api/ai`.
- Reminders use the browser **Notification API** (permission-gated) — no server push, no PII
  leaves the device.
- The standard trust line ("Your files are processed securely…") is shown on tool pages that
  touch files, consistent with existing pages.
- No secrets added to code; any new env vars are documented in `.env.example`.

---

## 7. Production-readiness decisions

- Pure-logic modules (`smartNotes`, `templates`, `invoice`) ship with `scripts/test-*.mjs`
  Node tests (run with `node --experimental-strip-types`), matching the existing test
  convention.
- All new pages have loading / error / empty / success states and validate file input via
  `lib/limits.ts`.
- AI tools respect the guest usage cap (`useGuestTask`) and the server rate limit.
- Type-check (`npm run build`) must pass; new tools are wired into SEO + the tool grid.

---

## 8. Known limitations / deferred

- **Share-link password / download-limit / revoke / auto-expiry tracking:** the current
  `/api/share` is in-memory by default; adding these properly needs the live storage backend
  and is deferred (documented in `DOCUSCAN_EXPANSION_TODO.md`).
- **Passwordless login / accounts / cloud sync of saved data:** requires the Phase-4 auth +
  DB workstream; saved data is device-local until then.
- **Print-shop integration, NFC labels, WhatsApp OTP:** roadmap only, per the brief.
- **OCR accuracy / on-device behaviours** still need real-device QA (see `QA_CHECKLIST.md`).
