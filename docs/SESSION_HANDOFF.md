# DocuScan — Session Handoff Prompt

Copy everything below the line into a new session to continue.

---

I'm building **DocuScan**, a web-first, mobile-first document scanner + PDF + AI
toolkit (think Adobe Scan / iLovePDF / Smallpdf / CamScanner, but simpler and
AI-native). No signup for basic use, privacy-first. The project lives at
`c:\Users\Admin\Desktop\DocuScan` (Windows; PowerShell + Bash available; Node 22,
npm 11). It is **not** a git repo.

Read these first: `README.md`, `HANDOFF.md`, `TODO.md`, and
`docs/DOCUSCAN_EXPANSION_PLAN.md` + `docs/DOCUSCAN_EXPANSION_TODO.md` +
`docs/QA_CHECKLIST.md`.

## Stack (already set up — don't re-scaffold)
Next.js 15.3.3 (App Router) · TypeScript · Tailwind v4 · **@cantoo/pdf-lib** (a
drop-in pdf-lib fork with in-browser encryption — stock `pdf-lib` was removed;
ALL PDF code must import from `@cantoo/pdf-lib`) · pdfjs-dist · tesseract.js ·
OpenCV.js (lazy CDN) · jszip · qrcode · docx · fabric · **provider-agnostic AI**
(`@anthropic-ai/sdk` + `openai`, server-only, lazy-required) · @upstash/redis ·
@aws-sdk/client-s3.

## How to run
- `npm install`, then `npm run dev -- -p 3939` (port 3000 is often taken; stale
  servers have held 3939/3940 — use a fresh port like 3955+ if output looks stale).
- `npm run build` = production build (compiles + type-checks + lints; must stay clean).
- `npm run start -- -p <port>` = prod server.
- Pure-logic tests: `node --experimental-strip-types scripts/test-*.mjs`
  (existing: smartnotes, templates, invoice, printready, expenses-reminders,
  editor, docexport, deck).

## Architecture conventions (FOLLOW THESE — the codebase is consistent)
1. **Client-side / privacy-first.** PDF transforms, OCR, rendering and text
   extraction run in the browser. AI tools extract text on-device
   (`lib/extractText.ts`) and POST only the *text* to `/api/ai` — files never upload.
2. **Each tool = a route** `app/<tool>/`: a `"use client"` `page.tsx` + a tiny
   server `layout.tsx` that does `export const metadata = toolMetadata("<slug>")`
   from `lib/seo.ts`. Add an SEO entry to `TOOL_SEO` and a tile to
   `components/ToolGrid.tsx` (the central registry; it auto-sorts alphabetically).
3. **AI layer** = one provider-agnostic module `lib/ai.ts` (functions returning
   structured JSON) behind `app/api/ai/route.ts` (a `task` switch). Env-gated:
   `aiEnabled()` false → routes 503. Rate-limited 10/5min/IP. Add a new feature by
   adding a function + a `case`. Model `claude-opus-4-8`; OpenAI fallback supported.
4. **Shared building blocks:** `components/Dropzone.tsx`, `components/PdfResult.tsx`,
   `components/Select.tsx`, `lib/limits.ts` (file/size/type validation),
   `lib/useGuestTask.ts` (guest usage cap), `lib/docExport.ts`
   (`blocksToPdf` / `blocksToDocxBlob` / markdown round-trip), `lib/qr.ts`.
5. **No SQL DB and no auth yet — intentional.** "Saved" data is device-local
   (`localStorage`) behind small typed `lib/*` stores (namespaced `ds-*`), written so
   the backend can later swap to an authenticated API without touching the UI.
6. **Storage seams:** in-memory by default; env-selected Redis (usage/ratelimit) +
   S3/R2 (shares) activate when env vars are set. Mirror this seam for new backends.
7. **Pure logic gets a Node test** (`scripts/test-*.mjs`). Keep DOM/pdfjs imports out
   of the top level of any module you want to Node-test (import them lazily inside fns).
8. Match the surrounding code's style. Reuse before adding deps. Be honest about
   anything you can't verify headless (flag it for real-device QA).

## What's BUILT (do NOT recreate)
- **Core PDF:** `/image-to-pdf` (scan/image→PDF), `/edit` (overlay editor + AcroForm
  fill), `/merge-pdf`, `/split-pdf`, `/compress-pdf`, `/rotate-pdf`, `/organize-pdf`,
  `/watermark-pdf`, `/page-numbers`, `/protect-pdf`, `/unlock-pdf`, `/batch`,
  `/convert`, `/pdf-to-word|excel|image`, `/fillable-pdf`, **`/print-ready`**.
- **Scan:** `/auto-crop`, `/enhance-scan`, `/clean-scan`, `/handwriting`, `/enhance`.
- **AI:** `/ocr-pdf`, `/summarize` (16 modes), `/chat` (Ask PDF), `/reconstruct`
  (make editable), `/redact`, `/translate`, `/compare`, `/extract` (any→table),
  `/analyze` (contract), `/draft`, `/rewrite`, `/study`, `/audio`, `/slides`,
  `/smart` (name/tag/extract), `/detect-document-type`, `/smart-rename`,
  **`/resume-scanner`**, **`/receipt-scanner`**.
- **Forms/signature & productivity:** `/sign-pdf`, **`/smart-notes`** (flagship:
  paste rough text → auto-format headings/code/lists/checklists/quotes/tables →
  PDF/DOCX/MD/TXT), **`/templates`** (saved text w/ `{variables}`), **`/invoice`**
  (Invoice Maker), **`/qr-labels`**, **`/reminders`**.
- **Infra:** `/api/share` (temp links + QR, 1h/7d TTL, cron cleanup), `/api/ai`,
  `/api/usage` (guest cap), rate limiting on all endpoints, analytics (PostHog) +
  Sentry seams (consent-gated), cookie consent, SEO/sitemap/robots, PWA + share
  target, i18n (en/es/fr/ar), referral, white-label, developer API + keys,
  `/security` `/privacy` `/terms` `/guides`.
- **New libs this session:** `lib/smartNotes.ts`, `lib/printReady.ts`,
  `lib/templates.ts`, `lib/invoice.ts`, `lib/expenses.ts`, `lib/reminders.ts`.
  New AI: `reviewResume` task (`resume-review`); `extract(receipt)` schema gained
  `tax` + `category`.

The build is currently clean and all Node tests pass.

## REMAINING WORK (everything except auth/login itself)

### A. Prove it works — real-device/browser QA (highest value; code exists, untested headless)
- The 8 new expansion pages (use `docs/QA_CHECKLIST.md`).
- OCR recognition quality + selectable text layer (tune `RENDER_SCALE` in `lib/ocr.ts`).
- Sign tool drawing + drag/resize/place accuracy, multi-page.
- Protect/Unlock actually prompt/clear in Acrobat/Preview/Chrome.
- OpenCV scanner edge-detect/warp/B&W on-device (thresholds in `lib/scan.ts`).
- `/edit`: fabric drag/resize/rotate, free-draw, zoom, secure-redact rasterize, AcroForm fill.
- AI-redaction box placement (`lib/redact.ts` padding).
- PWA install/offline + share→edit handoff (needs HTTPS + phone).
- `/convert` browser conversions (HEIC, Office, SheetJS).
- Print Ready grayscale output, QR print sheet, single-fire reminder notifications.

### B. Wire live services (written blind, never run against real creds)
- Redis (Upstash) — usage/ratelimit survive restart.
- R2/S3 — share round-trips the bucket.
- Anthropic/OpenAI key — exercise every AI task end-to-end.
- PostHog analytics + Sentry errors (consent flow, CDN load).
- Dropbox/Drive save (app keys).
- Set `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET` (+ schedule cleanup cron).

### C. Finish deferred expansion items
- **Secure share links:** password protection, download limit + counter, expiry
  tracking, revoke. (Needs the live storage backend to test properly.)
- Smart Form Fill: saved **form profile** auto-insert (reuse the templates store).
- Invoice: payment link / QR on the invoice.
- Clean up the cosmetic markdown-lint nits in `docs/*`.

### D. Production-readiness & security
- HTTPS everywhere + encryption at rest + private buckets.
- Signed download URLs for all downloads.
- Virus/malware scanning on uploads.
- Basic **admin dashboard** (uploads, jobs, storage, failed jobs, errors) + authz.
- Audit logs + daily DB backups.
- Abuse protection beyond rate limiting (bot uploads, OCR spam).
- PNG app icons 192×192 + 512×512 (currently SVG only).
- Bundle-size pass (PDF routes ~350–500 kB First Load JS).

### E. Heavy-job infrastructure
- Background job queue (BullMQ) for OCR / AI / large compress / batch.
- Transactional email (Resend/Postmark) for receipts/notifications.

### F. Growth / content
- More `/guides` how-to pages for SEO.
- Chrome extension: real PNG icon + Web Store listing.
- Beta test with students / office workers / small businesses; triage feedback.

### G. Blocked by auth (NOT auth itself — listed for sequencing)
- Payments: Stripe/Paystack + pricing page + tiered limits + usage-based API
  billing + webhook tests.
- User dashboard (My Documents / Recent / saved history).
- Real Postgres schema + migrations (users, documents, share_links, subscriptions,
  audit_logs…).
- Cloud-sync the now-local data (templates, invoices, expenses, reminders, QR labels).
- Make team/folder/referral scaffolds real (`lib/workspace.ts`).

## My ask for this session
Start with **[CHOOSE ONE]**:
- Real-device/browser QA pass (A) + fix what's broken;
- Live-creds wiring (B): Redis, R2, Anthropic, PostHog/Sentry, Dropbox;
- Secure share-link controls (C): password + expiry + download limit + revoke;
- Admin dashboard + audit logs (D);
- Job queue + transactional email (E);
- Bundle-size / performance pass (D).

Keep the established patterns: client-side processing where possible, in-memory
stores with env-driven production seams, `@cantoo/pdf-lib` for PDFs, Node tests for
pure logic, and honest flagging of anything you can't verify headless. Don't
recreate features that already exist — improve them if they're incomplete.
