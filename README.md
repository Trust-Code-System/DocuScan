# DocuScan

The simple, private, AI-native place to **scan, edit, convert, organize, sign,
summarize, fill, share and extract data from documents** — web-first and
mobile-first, no signup needed for basic use.

Most processing runs **in your browser**: PDF transforms, OCR and text extraction
happen on-device, and AI tools send only the extracted *text* to the API — your
files never leave your device.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind v4 · `@cantoo/pdf-lib` (fork with
in-browser encryption) · pdfjs-dist · tesseract.js · OpenCV.js (CDN) · jszip ·
qrcode · docx · fabric · provider-agnostic AI (`@anthropic-ai/sdk` / `openai`,
server-only) · `@upstash/redis` · `@aws-sdk/client-s3`.

> PDF code imports from **`@cantoo/pdf-lib`**, not stock `pdf-lib`. Don't re-add stock pdf-lib.

## Getting started

```bash
npm install
npm run dev -- -p 3939     # dev (port 3000 is often taken)
npm run build              # production build (type-check + lint)
npm run start -- -p 3939   # production server
```

Copy `.env.example` → `.env` and fill in what you need. Everything is optional;
with no keys set the app runs fully (AI features return 503 until a key is added).

### Pure-logic tests

```bash
node --experimental-strip-types scripts/test-smartnotes.mjs
node --experimental-strip-types scripts/test-templates.mjs
node --experimental-strip-types scripts/test-invoice.mjs
node --experimental-strip-types scripts/test-printready.mjs
node --experimental-strip-types scripts/test-expenses-reminders.mjs
# (plus the existing test-editor / test-docexport / test-deck scripts)
```

## Tools

**PDF:** Scan/Image → PDF, Edit, Merge, Split, Compress, Rotate, Organize
(reorder/delete), Watermark, Page numbers, Protect, Unlock, Batch, Convert,
Print Ready.
**Scan:** Auto-crop, Enhance scan, Clean scan, Handwriting → text, Enhance image.
**AI:** OCR, Summarize, Chat (Ask PDF), Make editable, Redact, Translate, Compare,
Extract to table, Analyze contract, Draft, Rewrite, Study aids, Audio, Slides,
Smart assistant (name/tag/extract), Resume Scanner, Receipt Scanner.
**Forms & signature:** Sign, Fillable PDF / Smart form fill, Saved Text Templates.
**Productivity:** **Smart Notes** (auto-format pasted text → PDF/Word/MD/TXT),
Document Reminders, Document QR Labels, Invoice Maker.
**Sharing:** secure temporary share links + QR, WhatsApp/Gmail/native share,
Dropbox/Drive save.

See [`docs/DOCUSCAN_EXPANSION_PLAN.md`](docs/DOCUSCAN_EXPANSION_PLAN.md) for the
audit + architecture, [`docs/DOCUSCAN_EXPANSION_TODO.md`](docs/DOCUSCAN_EXPANSION_TODO.md)
for the checklist, and [`docs/QA_CHECKLIST.md`](docs/QA_CHECKLIST.md) for QA.

## Architecture notes

- **Each tool = a route** under `app/<tool>/`: a `"use client"` `page.tsx` + a tiny
  server `layout.tsx` that exports `toolMetadata(slug)` from `lib/seo.ts`. Register
  new tools in `components/ToolGrid.tsx`.
- **AI** lives in one provider-agnostic module (`lib/ai.ts`) behind `app/api/ai`
  (a `task` switch, structured JSON, rate-limited 10/5min/IP, 503 without a key).
- **No database / no auth yet** (by design — no signup for basic use). "Saved" data
  for the productivity tools is device-local (`localStorage`), written behind small
  typed `lib/*` stores so the backend can later swap to an authenticated API.
- **Storage seams**: in-memory by default; env-selected Redis (usage/ratelimit) and
  S3/R2 (shares) activate when their env vars are set.

## Privacy

Files are processed in the browser and temporary shared files auto-delete after
expiry. AI tools transmit only extracted text. See `/privacy` and `/security`.
