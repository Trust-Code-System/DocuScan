# DocuScan — Build TODO

Living backlog. `[x]` = done, `[ ]` = todo. Ordered roughly by your roadmap §19.
Keep the **Now** section small; promote items up from the phases as you go.

---

## ✅ Done (MVP foundation)
- [x] Next.js + TypeScript + Tailwind project scaffold
- [x] App shell: header/footer layout, brand, globals
- [x] Home page: hero, tool grid, how-it-works
- [x] Core flow `/image-to-pdf`: camera capture, multi-upload, drag-drop
- [x] Page editing: reorder, rotate, delete
- [x] In-browser PDF generation (pdf-lib + canvas, JPEG compression)
- [x] PDF preview (embedded) + download
- [x] Guest usage limit API (5/day, cookie-based, server-enforced 429)
- [x] Temporary share links (1-hour auto-delete) — create + fetch
- [x] Privacy + Terms pages
- [x] Production build passes; runtime smoke test passes

---

## ⭐ Flagship editor + AI suite (built this session)
- [x] **`/edit` — overlay/annotate editor** (A1): fabric.js (dynamic-imported) on a pdf.js
  background. Add text/image/highlight/white-out/redact/shape/pen, fill AcroForm fields,
  undo/redo, zoom, multi-page. Serializable per-page model in `lib/editor.ts`; vector export
  via @cantoo/pdf-lib (`exportEditedPdf`). **Secure redact**: `lib/editorRaster.ts` flattens
  affected pages to images so hidden text is truly removed (vs fast "visual cover"). Form
  read/fill+flatten in `lib/editor.ts`. Node-tested coord math + export round-trip
  (`scripts/test-editor.mjs`). ⚠️ fabric drag/resize + secure-redact need real-browser QA.
- [x] **`/reconstruct` — AI "✨ Make editable"** (A2): browser text (pdf.js + OCR fallback) →
  `reconstruct` task → structured blocks → markdown editor → clean PDF/DOCX export
  (`lib/docExport.ts`, `docx` dynamic-imported). Node-tested (`scripts/test-docexport.mjs`).
- [x] **`/chat` — chat with your document** (B1): streamed `chat` task; doc text cached in a
  system prefix (prompt caching) across turns. Privacy line in UI.
- [x] **`/redact` — AI auto-redaction** (B2): `redact-detect` PII spans → `lib/redact.ts` maps
  spans to glyph boxes → secure rasterize export. ⚠️ box placement needs browser QA.
- [x] **`/translate` — AI translate** (B3): `translate` task → structured blocks → PDF/DOCX.
- [x] **`/compare` — document compare / redline** (B4): `compare` task → added/removed/changed
  + summary, rendered as a redline.
- [x] **PWA share target** (C1): `share_target` in `app/manifest.ts`; `public/sw.js` stashes the
  shared file → `/share-target` → `lib/sharedFile.ts` (IndexedDB) → `/edit?shared=1`.
  ⚠️ needs installed PWA + HTTPS + real device to verify.
- [x] New deps (dynamic-imported, kept out of main bundle): `fabric`, `docx`

## 🔜 Now (next sprint)
- [ ] Real-browser/device QA for the editor: fabric drag/resize/rotate, free-draw, zoom,
  secure-redact rasterize, AI-redaction box placement, form-field fill, PWA share→edit
- [ ] In-place text editing (the hard 20%): click a word → retype, layout untouched (A1 refinement)
- [x] Merge PDF tool (client-side, pdf-lib) — `/merge-pdf`
- [x] Compress PDF tool (pdf.js render + re-encode, 3 quality levels) — `/compress-pdf`
- [x] File validation hardening: size cap (20MB), page cap (20), MIME/type check, reject non-images
- [x] Friendly error states: bad image, huge file, wrong type, encrypted/corrupt PDF, over limit
- [x] Storage abstraction seam: async + env-driven backends (in-memory default), `.env.example`
- [x] Wire Redis backend in `lib/usage.ts` — env-selected (blind; needs Upstash creds + live test)
- [x] Wire object-storage backend in `lib/share.ts` — env-selected (blind; needs R2/S3 creds + live test)
- [ ] Mobile QA pass on real phone (camera, preview, share)

---

## Phase 2 — Finish MVP tools
- [x] Split PDF — `/split-pdf` (extract range + split-to-ZIP)
- [x] Manual crop / edge-adjust before PDF (drag corners) — ScanEditor
- [x] Auto edge detection + perspective correction (OpenCV.js) — needs on-device test
- [x] Image cleanup: B&W / grayscale "scan" filters (adaptive threshold)
- [x] Add page from camera/upload into an existing in-progress doc
- [x] PWA: manifest, service worker, offline shell, install prompt (SVG icon; add PNG icons later)
- [x] Per-tool SEO pages with copy — `lib/seo.ts` map + per-tool `layout.tsx` (title/desc/canonical/OG), `sitemap.ts`, `robots.ts`
- [ ] Basic admin dashboard (uploads count, jobs, storage, errors)

## Phase 3 — Beta launch readiness
- [x] Analytics (PostHog) — `lib/analytics.ts` + `components/Analytics.tsx`, consent-gated, funnel events (tool_view/run/result/share/download); env-driven, CDN-loaded (zero bundle weight)
- [x] Error tracking (Sentry) — client via browser Loader (consent-gated), server seam in `instrumentation.ts`; env-driven, no-op without DSN
- [x] Uptime monitoring (Better Stack) — `/api/health` endpoint (status + wired-backend flags) + setup notes in the route
- [x] Cookie/consent notice — `components/CookieConsent.tsx`, only shows when analytics configured; gates all third-party scripts
- [x] Server-side upload validation — `lib/serverValidation.ts` (PDF magic-byte + size), wired into `/api/share`
- [x] Security page + data-deletion write-up — `/security` (linked in footer)
- [x] Content marketing how-to pages — `/guides` + 4 prerendered guides (`lib/guides.ts`), HowTo structured data
- [x] Feedback popup ("What PDF feature do you need most?") — `FeedbackPopup` + `/api/feedback` (`lib/feedback.ts`, pluggable memory/Redis)
- [x] Rate limiting on all endpoints — `lib/ratelimit.ts` (pluggable memory/Redis, per-IP) applied to usage/share POST/share GET/feedback
- [x] Storage cleanup job (cron) for expired files — `/api/cron/cleanup` (`purgeExpired()` in `lib/share.ts`), CRON_SECRET-guarded
- [ ] Beta test with students / office workers / small businesses
- [ ] Collect + triage feedback

## Phase 4 — V1 public launch
- [ ] Auth: email + Google login
- [ ] User dashboard: My Documents, Recent Files, Saved Scans
- [ ] Saved document history (logged-in, 7-day retention free tier)
- [ ] Pricing page (Free / Pro / Team)
- [ ] Payments: Stripe / Paystack + subscription plans
- [ ] Usage dashboard + plan limits enforcement
- [ ] Tiered limits (guest / free / pro / team per §13)
- [ ] Content marketing pages ("How to scan…", "Compress PDF for email", etc.)
- [ ] Transactional email (Resend/Postmark): welcome, receipts, resets
- [ ] Database: real schema (users, documents, document_pages, pdf_jobs, share_links, subscriptions, payments, usage_limits, audit_logs)
- [ ] Background job queue (BullMQ) for heavy tasks

## Phase 5 — AI & advanced tools
- [x] OCR (Tesseract.js client, in-browser) — `/ocr-pdf` (needs on-device accuracy test)
- [x] Searchable PDF output (Tesseract PDF renderer → invisible text layer, stitched with pdf-lib)
- [x] E-signature — `/sign-pdf` (draw/type signature, drag-place on page preview; needs on-device test)
- [x] Password protect / unlock PDF — `/protect-pdf` + `/unlock-pdf` (client-side via @cantoo/pdf-lib; replaced pdf-lib across the app)
- [x] Watermark (`/watermark-pdf`, diagonal text) + page numbers (`/page-numbers`)
- [x] Rotate PDF (standalone tool page) — `/rotate-pdf`
- [x] AI auto document naming — `lib/ai.ts` (claude-opus-4-8, structured output) + `/api/ai` + `/smart` page
- [x] AI tagging / classification — same (`task: "tags"`)
- [x] Receipt / invoice / contract data extraction — same (`task: "extract"`, 3 schemas). Env-gated on ANTHROPIC_API_KEY; text extracted client-side (pdf.js) so docs stay on device
- [x] **Extract anything to a table** (§5) — `/extract` (`task: "extract-table"` in `lib/ai.ts`): 14 presets (invoice/receipt/bank statement/attendance/results/business cards/ID/…) + custom columns + freeform instruction. Multi-record → one row each, per-row confidence dot. Editable grid; export Excel/CSV (BOM), JSON, PDF report (`blocksToPdf`), copy as TSV. Client-side text extraction (file stays on device).
- [x] **Summary modes** (§4) — `summarize()` extended from 3 lengths to 16 modes (short/standard/detailed/bullets, executive, professional, ELI10, email, student notes, action items, meeting notes, risk, contract, financial, research, policy); grouped dropdown in `/summarize`. Same `{tldr,keyPoints,actionItems}` contract (legacy `length` still accepted). `SUMMARY_MODE_KEYS` validates the route.
- [x] **Document → audio** (§16) — `/audio` (`task: "narrate"` + `lib/speech.ts`): Web Speech read-aloud (voice picker, 0.5–2× speed, play/pause/stop, segment progress) — fully on-device, no API cost. AI styles: short summary / explainer / study / podcast. Editable script + .txt download. (MP3 export = future cloud-TTS seam; browser speech can't be captured to a file.)
- [x] **Convert documents hub** (§8) — `/convert` (`lib/convert.ts` engine + `lib/loadScript.ts` CDN loaders + `/api/convert` server seam): auto-detects source kind and offers only valid targets; batch (many files of one type) + download-all ZIP. **In-browser** (file never uploads): PDF→PNG/JPG/ZIP/TXT/MD/HTML/Word(text); image↔PNG/JPG/WebP & →PDF; HEIC→JPG/PNG/PDF (heic2any); Excel↔CSV↔JSON & →PDF and CSV/JSON→PDF (SheetJS); TXT/MD/HTML→PDF/DOCX/HTML; Word→PDF/HTML/TXT (mammoth). **Server seam** (`CONVERT_SERVICE_URL`, Gotenberg/LibreOffice, 503 when unset): high-fidelity DOCX/PPTX/XLSX↔PDF. SheetJS/mammoth/heic2any are CDN-loaded (kept out of the bundle, dodges their node: builtins) like OpenCV/pptx. ⚠️ browser conversions need real-device QA.
- [x] **Document → presentation** (§17) — `/slides` (`task: "slides"` + `lib/deck.ts`): AI builds an editable deck (title/bullets/speaker notes), 4 styles (professional/academic/pitch/simple). Export **PPTX** (pptxgenjs, CDN-loaded via `lib/pptx.ts` like OpenCV — keeps it out of the bundle & dodges its `node:` builtins) and **PDF** (pure @cantoo/pdf-lib, one landscape page/slide, Node-tested in `scripts/test-deck.mjs`).

## Phase 6 — Growth
- [x] WhatsApp share — `ShareActions` (wa.me + Web Share API)
- [x] Public share links + QR code — 7-day public mode (`?public=1`) + client-side QR (`lib/qr.ts`)
- [x] Google Drive + Dropbox save — `CloudSave` (Dropbox Saver functional w/ app key; Drive = OAuth seam)
- [x] Gmail attachment tool — Gmail compose + mailto buttons in `ShareActions`
- [x] Chrome extension — `extension/` MV3 scaffold (popup + PDF-link context menu; needs PNG icon + store listing)
- [x] Referral system — `lib/referral.ts` + `/api/referral` + `ReferralCapture` (?ref= capture; conversions attach at signup once auth exists)
- [x] "Created with DocuScan" optional branding (off for paid) — `lib/branding.ts` + toggle in `PdfResult` (guest default on, removable; hook for PDF footer stamp later)
- [x] Localization / multi-language — `lib/i18n.ts` (en/es/fr/ar, RTL) + `LocaleSwitcher`, cookie-driven server render (foundation; [locale] routing = full static i18n upgrade)
- [x] White-label config — `lib/brand.ts` (env-driven name/tagline/logo)

## Phase 7 — Business & API
- [~] Team accounts + shared workspace — `lib/workspace.ts` + `/api/teams` SCAFFOLD (in-memory, owner=guest cookie; lights up with auth/DB)
- [~] Document folders / organization — `lib/workspace.ts` + `/api/folders` SCAFFOLD (same)
- [ ] Admin controls + audit logs
- [x] Batch / bulk upload + processing — `/batch` (multi-PDF compress → ZIP)
- [x] Developer API + API keys (per-key limits) — `lib/apikeys.ts` + `/api/keys` (admin-gated issue) + `/api/v1/share` (Bearer auth, per-key rpm) + `/developers` docs
- [~] Usage-based billing for API — `lib/billing.ts` metering seam (units/op, monthly); invoicing needs payments/DB
- [ ] White-label option

---

## 🔒 Security & infra (ongoing, must-have before public)
- [ ] HTTPS everywhere
- [ ] File encryption at rest + private buckets (no public exposure)
- [ ] Signed URLs for all downloads
- [ ] Virus scanning on uploads
- [x] File type + size validation server-side — `lib/serverValidation.ts` (magic-byte + size) on `/api/share`
- [ ] Secure admin dashboard (authz)
- [ ] Audit logs
- [ ] Daily DB backups
- [~] Abuse protection: rate limiting on all endpoints DONE; bot uploads/OCR spam/fake accounts/payment bypass still TODO
- [x] Cookie notice (once analytics/ads added) — `components/CookieConsent.tsx`
- [x] Data deletion process + Security page — `/security`

## 🚀 Pre-launch checklist (§17)
- [ ] All tools work on mobile
- [ ] Camera/upload/preview/download/share verified
- [x] File-deletion job verified — cron endpoint returns purge count; in-memory sweep verified (live S3 purge still needs creds)
- [x] Rate limiting verified — per-IP 429s confirmed on /api/feedback (memory backend; Redis backend untested w/o creds)
- [ ] Payments + webhooks verified (incl. delayed webhook)
- [ ] Emails verified
- [ ] Analytics + monitoring + backups verified
- [ ] Edge cases: large PDF, wrong type, slow net, failed compress/OCR, expired link, limit reached, payment fail/success
