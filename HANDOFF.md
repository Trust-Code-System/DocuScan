# DocuScan — Session Handoff Prompt

Copy everything below the line into a new session to continue.

---

I'm building **DocuScan**, a web-first, mobile-first document scanner + PDF toolkit
(think CamScanner / iLovePDF), no-signup for basic use, privacy-first. The project
lives at `c:\Users\Admin\Desktop\DocuScan` (Windows, PowerShell + Bash available,
Node 22, npm 11). Read `TODO.md` for the full backlog and `HANDOFF.md` for this brief.

## Stack (already set up)
Next.js 15.3.3 (App Router) · TypeScript · Tailwind v4 · **@cantoo/pdf-lib** (NOT stock
pdf-lib — see note) · pdfjs-dist · tesseract.js · OpenCV.js (lazy-loaded from CDN) ·
jszip · qrcode (dynamic import) · **@anthropic-ai/sdk** (server-only, lazy require) ·
@upstash/redis · @aws-sdk/client-s3.
NOTE 1: the folder name has capitals, so the npm package name is `docuscan` and the app
was hand-scaffolded (create-next-app rejects capitalized dir names).
NOTE 2: **PDF work uses `@cantoo/pdf-lib`, a drop-in pdf-lib fork that adds in-browser
encryption.** Stock `pdf-lib` was uninstalled. All `lib/*` import from `@cantoo/pdf-lib`.
Don't re-add stock pdf-lib.

## How to run
- `npm install`, then `npm run dev -- -p 3939` to develop, `npm run build` to type-check.
- PORT WARNING: 3000 is taken by another app. Also, **stale server processes have been
  seen holding 3939 and 3940** from past sessions (causing 404s from old builds). If output
  looks stale, kill those PIDs (`netstat -ano | grep :3939`) or just use a fresh port like
  3955+. `npm run start -- -p <port>` for a production server.

## What's BUILT (12 live tools on the home grid) — all client-side
- **Scan / Image→PDF** (`app/image-to-pdf`): camera capture, multi-upload, drag-drop,
  reorder/rotate/delete pages, in-browser PDF gen.
- **Crop & scan editor** (`components/ScanEditor.tsx`, `lib/scan.ts`, `lib/opencv.ts`):
  OpenCV.js edge auto-detect, draggable corners, perspective warp, Color/Grayscale/B&W.
- **Merge** (`/merge-pdf`), **Compress** (`/compress-pdf`, pdf.js re-encode, 3 levels),
  **Split** (`/split-pdf`, range extract + split-to-ZIP).
- **OCR** (`/ocr-pdf`, `lib/ocr.ts`): Tesseract.js, 8 languages, renders pages with pdf.js
  and uses Tesseract's PDF renderer (invisible text layer) → searchable PDF stitched with
  pdf-lib; also extracts plain text (copy / download .txt).
- **Rotate** (`/rotate-pdf`), **Watermark** (`/watermark-pdf`, diagonal text + opacity),
  **Page numbers** (`/page-numbers`, 3 formats × 3 positions) — all in `lib/pdf.ts`.
- **Sign** (`/sign-pdf`, `lib/sign.ts` + `components/SignaturePad.tsx`): draw OR type a
  signature → transparent PNG; live pdf.js page preview with a draggable/resizable overlay;
  stamps via fractional placement (origin-flip handled). Multi-page navigation.
- **Protect / Unlock** (`/protect-pdf`, `/unlock-pdf`, `lib/protect.ts`): password add/remove
  via @cantoo/pdf-lib encryption. Protect refuses already-encrypted files; Unlock
  distinguishes "not protected" from "wrong password".
- Shared: `lib/limits.ts` (20MB/20-page caps, validation), `lib/pdf.ts`, `lib/useGuestTask.ts`,
  `components/PdfResult.tsx` (preview/download/share).
- **Backend API**: `app/api/usage` (cookie guest limit, 5/day, 429-enforced),
  `app/api/share` + `app/api/share/[id]` (temp links, 1-hour auto-delete),
  `app/api/feedback` (POST survey/feedback → `lib/feedback.ts`),
  `app/api/cron/cleanup` (CRON_SECRET-guarded; purges expired shares).
- **Rate limiting** (`lib/ratelimit.ts`): per-IP, pluggable memory/Redis (same env
  seam as usage). Applied to every endpoint — usage POST (30/min), share POST
  (10/min), share GET (60/min), feedback (5/10min). Returns 429 + Retry-After.
- **Feedback popup** (`components/FeedbackPopup.tsx`): auto-prompts once after 25s
  ("What should we build next?"), persistent 💬 launcher after; stored via
  `lib/feedback.ts` (pluggable memory/Redis).
- **Analytics** (`lib/analytics.ts` + `components/Analytics.tsx`): PostHog, env-driven
  (NEXT_PUBLIC_POSTHOG_KEY), **consent-gated**, loaded from CDN (zero bundle weight).
  Funnel events: tool_view/run/result/error, share_created, download, feedback_submitted.
- **Error tracking**: Sentry client via browser Loader (NEXT_PUBLIC_SENTRY_DSN, consent-gated,
  CDN). Server seam in `instrumentation.ts` (`onRequestError`) — logs now; forwards to Sentry
  once `@sentry/nextjs` + SENTRY_DSN added (blind-wiring convention).
- **Cookie consent** (`components/CookieConsent.tsx` + `lib/consent.ts`): only shows when a
  PostHog/Sentry key is set; gates all third-party scripts. No key = no banner, no scripts.
- **Health/uptime**: `app/api/health` (status + which backends are wired) for Better Stack.
- **Server-side validation** (`lib/serverValidation.ts`): PDF magic-byte + size re-check on
  `/api/share` (client checks are bypassable).
- **SEO**: `lib/seo.ts` (per-tool title/desc/canonical/OG) + a tiny `layout.tsx` per tool
  folder (tool pages are client components, can't export metadata); `app/sitemap.ts`,
  `app/robots.ts`, root `metadataBase` + title template. Set NEXT_PUBLIC_SITE_URL (build-time).
- **Content marketing**: `/guides` index + `/guides/[slug]` (4 prerendered how-tos in
  `lib/guides.ts`, with HowTo JSON-LD). Linked in footer.
- **Optional branding** (`lib/branding.ts`): "Created with DocuScan" credit on `PdfResult`,
  guest default-on + removable (hook for stamping exported PDFs / off-for-paid later).

## Phase 5/6/7 features (built this session — growth, business, AI)
- **Sharing** (`components/ShareActions.tsx`): WhatsApp (wa.me), Gmail compose + mailto, native
  Web Share, copy, and a **QR code** (`lib/qr.ts`, qrcode dynamic-imported). Public links = 7-day
  TTL (`?public=1`, `PUBLIC_TTL_MS` in `lib/share.ts`).
- **Cloud save** (`components/CloudSave.tsx`): Dropbox Saver (functional with NEXT_PUBLIC_DROPBOX_APP_KEY,
  uses the public link); Google Drive is an OAuth seam (NEXT_PUBLIC_GOOGLE_CLIENT_ID).
- **Batch** (`/batch`): multi-PDF compress → single ZIP (jszip).
- **AI assistant** (`/smart`, `lib/ai.ts`, `/api/ai`): name / tag / extract (receipt·invoice·contract)
  via **claude-opus-4-8**, structured JSON output, effort low. Env-gated on ANTHROPIC_API_KEY (503
  when unset); text is extracted in-browser (`lib/pdfText.ts`) so docs never upload. Rate-limited 10/5min.
- **Developer API** (`lib/apikeys.ts`, `/api/keys`, `/api/v1/share`, `/developers`): SHA-256-hashed keys
  (`ds_live_…`), admin-gated issuance (ADMIN_API_SECRET), Bearer auth + per-key rpm limit, usage metering
  (`lib/billing.ts`, units/op/month) as the billing seam.
- **Localization** (`lib/i18n.ts`, `LocaleSwitcher`): en/es/fr/ar incl. RTL; cookie-driven, translated
  server-side (nav/footer/hero). NOTE: reading the locale cookie in the root layout makes pages render
  **dynamically** (ƒ) instead of static — acceptable for these shells; `[locale]` routing is the upgrade
  path for fully static per-locale SEO.
- **White-label** (`lib/brand.ts`): env-driven brand name/tagline/logo (NEXT_PUBLIC_BRAND_*, build-time).
- **Referral** (`lib/referral.ts`, `/api/referral`, `ReferralCapture`): captures `?ref=`, counts visits;
  conversions attach at signup once auth exists.
- **Workspace SCAFFOLDS** (`lib/workspace.ts`, `/api/teams`, `/api/folders`): teams + folders, in-memory,
  owner = guest cookie as a stand-in for a user id. Functional but become DB tables once auth lands.
- **Chrome extension** (`extension/`): MV3 popup + PDF-link context menu (needs a PNG icon + store listing).
- **Storage abstraction** (`lib/usage.ts`, `lib/share.ts`): async, env-selected backends.
  In-memory default; Redis (usage) + S3/R2 (share) activate when env vars are set.
- **PWA**: `app/manifest.ts`, `public/sw.js`, `components/Pwa.tsx`, `public/icon.svg`.
  Privacy + Terms pages. `.env.example` documents env.

## Flagship editor + AI suite (built this session — the moat: private + AI-native)
- **`/edit` — overlay editor** (`app/edit`, `lib/editor.ts`, `lib/editorRaster.ts`): fabric.js
  (`npm i fabric`, dynamic-imported, out of the main bundle) on a pdf.js-rendered background.
  Toolbar: add text, insert image, highlight, white-out, redact, shapes, pen/free-draw; fill
  **AcroForm** fields (`readFormFields`/`fillAndFlattenForm`); undo/redo, zoom, multi-page nav.
  Source of truth = a serialisable per-page JSON model (top-left fractional coords, like the sign
  tool); fabric is just the editing surface. **Export** = vector composite via @cantoo/pdf-lib
  (`exportEditedPdf`: drawText/Rectangle/Image/Line, y-flip handled). **Redaction**: "visual
  cover" (fast black box, text NOT removed) vs **"secure redact"** (rasterises affected pages to
  images via `rasterizeRedactedPage` so the original text is genuinely gone) — the UI explains the
  difference. Node-tested coord math + export round-trip (`scripts/test-editor.mjs`).
- **`/reconstruct` — AI "✨ Make editable"** (`app/reconstruct`, `lib/docExport.ts`): browser text
  (pdf.js, OCR fallback for scans) → AI `reconstruct` task → structured blocks → markdown editor →
  clean **PDF or DOCX** export (`docx`, `npm i docx`, dynamic-imported; `blocksToPdf` is a pure
  pdf-lib layout engine, Node-tested in `scripts/test-docexport.mjs`). Linked from `/edit`.
- **`/chat`** (B1): streamed `chat` task; doc text cached in a `cache_control` system prefix so
  multi-turn chat reuses it cheaply. **`/redact`** (B2): `redact-detect` PII spans → `lib/redact.ts`
  maps spans to glyph boxes (pdf.js `getTextContent` transforms) → secure rasterize export.
  **`/translate`** (B3): `translate` task → blocks → PDF/DOCX. **`/compare`** (B4): `compare` task →
  added/removed/changed + summary redline.
- **AI plumbing** (`lib/ai.ts` + `app/api/ai/route.ts`): new tasks `reconstruct`, `redact-detect`,
  `translate`, `compare`, `chat` added to the existing `task` switch. Model `claude-opus-4-8`,
  structured JSON via `output_config.format`, streaming (`messages.stream`/`finalMessage`) for long
  outputs, prompt caching for chat. Rate-limited 10/5min, text extracted client-side first (file
  never uploads). **Provider-agnostic**: `lib/ai.ts` also supports OpenAI (`npm i openai`, lazy-
  required) — `AI_PROVIDER=openai|anthropic` (auto-picks Anthropic if its key is set, else OpenAI),
  `OPENAI_MODEL` (default `gpt-5.5`, env-overridable since the id isn't verified here). `aiEnabled()`
  is true if *either* `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` is set; 503 only when neither is.
- **PWA share target** (C1): `share_target` in `app/manifest.ts`; `public/sw.js` (bumped to v2)
  catches the share POST, stashes the file in a Cache, redirects to `/share-target`, which moves it
  to IndexedDB (`lib/sharedFile.ts`) and hands off to `/edit?shared=1`.

### ⚠️ New items needing real-browser/device QA (can't verify headless here)
- fabric drag/resize/rotate, free-draw, zoom, text editing, image insert in `/edit`
- secure-redact rasterize output (visual + that text is truly gone) — `/edit` and `/redact`
- AI-redaction box placement accuracy (pdf.js glyph geometry is approximate — tune padding in
  `lib/redact.ts`)
- AcroForm field fill on real forms; markdown↔block export fidelity on messy real docs
- PWA share→edit handoff (needs installed PWA + HTTPS + a phone)
- All AI tasks need a live `ANTHROPIC_API_KEY` (route returns 503 here; schemas/streaming verified
  structurally + via build, not against the live API)

## Verification status
- **Type-checks + builds clean**; every route serves 200 (smoke-tested on a fresh prod server).
- **PDF transforms verified in Node** (against real PDFs): rotate (scoped + all), page numbers,
  watermark, sign placement math (origin flip + round-trip), protect/unlock round-trip
  (encrypt blocks no-password load; unlock reopens plaintext). All re-verified on @cantoo.
- **Rate limiting + cron + feedback verified on a live prod server** (port 3970, smoke test):
  per-IP 429 after the cap on /api/feedback (5/10min); cron rejects no-auth/wrong-key (401)
  and runs on Bearer + `?key=` (200 w/ purge count); feedback validates empty/bad-JSON (400).
  Memory backends only — Redis/S3 paths still untested (no creds).
- **Analytics/SEO/content batch verified on a live prod server** (port 3971): /api/health 200
  with backend flags; /security, /guides + guide detail (HowTo JSON-LD) 200; robots.txt +
  sitemap.xml (20 URLs) serve; per-tool titles + canonicals are unique; server-side PDF
  magic-byte reject (spoofed non-PDF → 415, real %PDF → 200, empty → 400).
  PostHog/Sentry not exercised end-to-end (need keys + a browser for consent/CDN load).
- **Phase 5/6/7 verified on a live prod server** (port 3972): developer API end-to-end (admin-gated
  key issue → Bearer `/api/v1/share` 200 → per-key rpm 429); referral mint/record/stats; folders +
  teams create (in-memory); `/api/ai` 503 without key; i18n renders es/fr translations + `lang`/RTL
  `dir` per the locale cookie; `/smart`, `/batch`, `/developers` serve 200. AI generation itself
  unrun (needs ANTHROPIC_API_KEY); Dropbox/Drive save unrun (need app keys + a browser).

## ⚠️ Built but UNVERIFIED in a real browser (do these first)
1. **OCR recognition quality** — Tesseract is WASM + canvas + CDN traineddata; can't run
   headless. First run downloads a few MB. Verify accuracy and that the text layer is
   selectable/searchable. Tune `RENDER_SCALE` in `lib/ocr.ts` if weak.
2. **Sign tool UI** — canvas drawing + pointer drag/resize + preview are DOM behaviors not
   testable headless (the math is verified). Confirm the signature lands exactly where placed,
   incl. multi-page and after resize. Quirk: pages with non-zero /Rotate display unrotated in
   the placement preview (output is still correct).
3. **Protect/Unlock on-device** — confirm a protected file actually prompts for a password in
   Acrobat/Preview/Chrome viewer, and unlock removes it. (Uses @cantoo's default cipher; fine
   for consumer "require password to open"; AES-256 + enforced permissions would be a future
   server-side qpdf upgrade.)
4. **OpenCV scanner** — never executed in a real browser. Verify detection/warp/B&W on-device
   (threshold consts `15, 12` in `lib/scan.ts` may need tuning).
5. **PWA** — files serve but install/offline untested; needs HTTPS. Verify install banner +
   standalone launch on a real phone.
6. **Redis + R2 wiring** — written blind, never run against live services. Add creds, then
   confirm usage survives restart (Redis) and share round-trips the bucket (R2).
7. **Icons SVG-only** — generate PNG 192×192 + 512×512 for iOS/Android.
8. **Bundle size** — First Load JS is ~350–460 kB on PDF routes (@cantoo + pdfjs/tesseract).
   Worth a perf pass before launch.

## REMAINING WORK (priority order)
**A. Prove it works (highest value):** real-device QA (scanner, sign, OCR, protect, PWA);
wire+test Redis and R2 with creds; PNG icons.

**B. Tools — DONE.** All "soon" tiles shipped (OCR, sign, protect/unlock, watermark, page
numbers, rotate). Remaining AI extras live in Phase 5 below (auto-naming, tagging, extraction).

**C. Launch-readiness (Phase 3–4):** ✅ DONE across the last two sessions: rate limiting on ALL
endpoints, expired-file cleanup cron, feedback popup, PostHog analytics + funnel, Sentry (client
Loader + server seam), /api/health for uptime, cookie consent, server-side upload validation,
Security/data-deletion page, per-tool SEO + sitemap/robots, /guides content pages, branding toggle.
To activate in prod: set NEXT_PUBLIC_SITE_URL (build-time), NEXT_PUBLIC_POSTHOG_KEY,
NEXT_PUBLIC_SENTRY_DSN, CRON_SECRET (+ schedule the cron). Still TODO before V1:
auth (email + Google), user dashboard + saved history, pricing page, payments
(Stripe/Paystack), tiered limits, real Postgres schema (users, documents, document_pages,
pdf_jobs, ocr_results, share_links, subscriptions, payments, usage_limits, audit_logs),
BullMQ job queue, transactional email (Resend/Postmark), per-tool SEO + how-to pages,
basic admin dashboard.

**D. Security (must-have before public):** HTTPS everywhere, encryption at rest + private
buckets, signed download URLs, virus scanning on upload, server-side type/size validation,
audit logs, daily DB backups, abuse protection, cookie notice, Security page, data-deletion.

**E. Growth (Phase 6):** WhatsApp share, public links + QR, Google Drive/Dropbox save,
Gmail tool, Chrome extension, referral system, localization.

**F. Business/API (Phase 7):** team accounts, document folders, admin controls + audit logs,
batch/bulk upload, developer API + keys, usage-based billing.

**Phase 5 AI extras (optional):** AI auto document naming, AI tagging/classification,
receipt/invoice/contract data extraction.

## My ask for this session
Start with **[CHOOSE: auth + Postgres + user dashboard (KEYSTONE — turns the teams/folders/referral/
billing scaffolds real) / payments (Stripe/Paystack) + pricing + tiered limits / admin dashboard +
audit logs / real-device QA pass / live creds wiring (Redis, R2, PostHog, Sentry, Anthropic, Dropbox)
/ ___]**. Keep the established patterns: client-side
processing where possible, in-memory stores with env-driven production seams, honest flagging
of anything you can't actually test here. PDF code imports from `@cantoo/pdf-lib`.
