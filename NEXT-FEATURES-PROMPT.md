# DocuScan — Editor + AI-Native Features: New-Session Implementation Prompt

Copy everything below the line into a new session. It tells Claude exactly what to build and how.

---

I'm building **DocuScan**, a web-first, mobile-first, **privacy-first** document scanner + PDF toolkit
that runs **100% client-side** (no signup, no upload for core tools) and has **Claude wired in** for AI.
The project lives at `c:\Users\Admin\Desktop\DocuScan` (Windows, PowerShell + Bash, Node 22).
**Before doing anything, read `HANDOFF.md` and `TODO.md`** — they document the full current state, the
stack, the conventions, and everything already built. This prompt is the next big push.

## The mission (why these features)

I don't want to out-feature Adobe/WPS/iLovePDF — I want to win on a different axis they structurally
can't copy: **private (on-device) + AI-native + mobile/WhatsApp-first, no signup**. Every feature below
must reinforce that. Two hard rules:

- **Keep it private:** process on-device where possible. AI features extract **text in the browser**
  (`lib/pdfText.ts` / `lib/ocr.ts`) and send only that text to the server — never upload the raw file.
- **No auth, no signup, no payment, no pricing UI.** Everything stays anonymous (guest cookie). Do not
  add or surface accounts/billing. (Usage metering that already exists may keep counting silently, but
  nothing user-facing should mention payment.)

## Conventions you MUST follow (these already exist in the repo — match them)

- **Stack:** Next.js 15.3.3 (App Router) · TypeScript · Tailwind v4 · **@cantoo/pdf-lib** (NOT stock
  pdf-lib — it's the encryption fork; all PDF writes import from it) · pdfjs-dist · tesseract.js ·
  OpenCV.js (CDN) · jszip · qrcode · **@anthropic-ai/sdk** (server-only, lazy `require`).
- **Run:** `npm run dev -- -p 3955` (3000 is taken; stale servers may squat 3939–3972 — kill them
  `netstat -ano | grep :PORT` then `taskkill //F //PID`, or use a fresh port). `npm run build` to verify.
- **New tool = 4 edits:** `app/<tool>/page.tsx` (`"use client"`), `app/<tool>/layout.tsx`
  (`export const metadata = toolMetadata("<tool>")`), an entry in `lib/seo.ts` `TOOL_SEO` (title +
  description; sitemap/robots auto-include it), and a tile in `app/page.tsx`'s `tools` array.
- **API routes:** rate-limit every one via `lib/ratelimit.ts` (`rateLimit`/`clientIp`/`tooManyRequests`).
  Anything needing a key must return **503** when the env var is missing (see `aiEnabled()` pattern).
- **AI calls:** model **`claude-opus-4-8`**, structured JSON via `output_config: { format: { type:
  "json_schema", schema } }`, `effort: "low"` (or `"medium"` for reasoning-heavy), size `max_tokens`,
  **stream** long outputs. All AI logic lives server-side in `lib/ai.ts` + `app/api/ai/route.ts`
  (extend the existing `task` switch — don't scatter new routes unless a feature is large). The SDK is
  lazy-`require`d and env-gated on `ANTHROPIC_API_KEY`. **If you build/extend any LLM feature, first run
  the `claude-api` skill** to confirm current model IDs + SDK syntax — do not guess.
- **Heavy tools** call `useGuestTask().consume()` for the daily quota; show results via
  `components/PdfResult.tsx`; share via `components/ShareActions.tsx`.
- **PDF coordinate math:** @cantoo/pdf-lib origin is bottom-left; the existing sign tool
  (`lib/sign.ts`) already handles the y-flip + fractional placement — reuse that approach for any
  stamping/overlay export.
- **Pluggable backends:** any new server state uses the in-memory-default / Redis-when-env pattern
  (see `lib/usage.ts`, `lib/ratelimit.ts`).
- **Keep the bundle lean:** dynamic-`import()` heavy libs (like the editor canvas lib) so they don't
  land in the main bundle.
- **Honest verification:** `npm run build` must pass; Node-test coordinate math + AI schemas against
  real sample PDFs; **explicitly flag** anything that needs a real browser, device, or live API key.
- **Don't churn** the cosmetic Markdown lint warnings in HANDOFF.md / TODO.md (intentional style).
- When done, update `TODO.md`, `HANDOFF.md`, and `.env.example`, and add any new env vars.

---

## BUILD ORDER & SPECS

### ⭐ Phase A — The Editor (the flagship; build first)

This is the #1 gap vs. the paid tools. Deliver it in two tiers.

**A1. `/edit` — overlay / annotate editor (no AI; works on every PDF; ship-able now)**
- Route `app/edit/page.tsx`. Render each PDF page with pdf.js to a canvas, with an **editable object
  layer** on top. Recommend **fabric.js** (`npm i fabric`, dynamic-imported) as the per-page editing
  surface — it gives draggable/resizable/rotatable text, rectangles, images, and free-draw out of the
  box. (Alternative: hand-rolled DOM overlay reusing the sign tool's drag/resize patterns — only if you
  want zero deps.)
- Toolbar: **Add text** (edit content, font family from a safe set, size, color, bold), **Insert image**
  (upload/photo), **Highlight** (semi-transparent rect), **White-out** (opaque white rect), **Redact**
  (black rect — see redaction caveat below), **Pen/draw**, **Shapes**, and **Fill form fields**
  (detect AcroForm fields via `@cantoo/pdf-lib` `form.getFields()` and render inputs that write back).
- State: keep a JSON object model per page (so it's serializable) → enables **undo/redo** and zoom.
  Multi-page navigation.
- **Export:** composite the object model onto each page with @cantoo/pdf-lib — `drawText`,
  `drawImage`, `drawRectangle` at coordinates mapped from canvas→PDF space (handle the y-flip). Output
  via `PdfResult`.
- **Redaction caveat (flag this clearly):** a black rectangle on top does NOT remove the underlying
  text — it's still selectable/extractable. For *true* redaction, on export **rasterize the affected
  page region(s) to an image** (render page to canvas, paint the black boxes, re-embed as an image
  page) so the original text is genuinely gone. Offer "visual cover" (fast) vs "secure redact"
  (rasterized) and explain the difference in the UI.
- Verify: Node-test the coordinate mapping + a stamp round-trip on a real PDF; **flag** the
  canvas/drag interactions as needing real-browser QA.

**A2. AI "✨ Make editable" — reflow any document into an editable doc (the novel one)**
- A button in `/edit` (and/or its own `/reconstruct` route) that makes **any** document editable —
  including flat PDFs and **scans with no text layer**.
- Pipeline: get the document's text — `lib/pdfText.ts` for text PDFs, or run OCR (`lib/ocr.ts`) for
  scans/images. Send the text to Claude (extend `lib/ai.ts` with a `reconstruct` task) asking for a
  **structured document** via structured output: an array of blocks `{ type: "heading"|"paragraph"|
  "list"|"table", level?, text?, items?, rows? }`. Render that into a **lightweight rich-text editor**
  (MVP: a markdown/`contentEditable` editor; nicer: TipTap/ProseMirror, dynamic-imported). Let the user
  edit freely, then **export** to a clean PDF (@cantoo/pdf-lib layout) and/or **DOCX** (`npm i docx`).
- Be explicit in the UI: this produces a **clean, editable document, not a pixel-perfect clone** — same
  trade-off as Adobe's "export to Word," but private and one-tap.
- Env-gated on `ANTHROPIC_API_KEY` (503 when unset). Verify the schema parse in Node with a sample;
  flag the editor + export for browser QA.

**Note on the hard 20% (do NOT block launch on this):** true *in-place* text editing (click a word in
the original, retype it, layout untouched) is genuinely hard in-browser (PDFs are positioned glyphs;
font matching is the problem). It's approximatable (extract the run's position+font via pdf.js,
white-out, restamp with the nearest font) and fine for short fixes — implement it later as a refinement
of A1, not as the initial bet.

### Phase B — AI-native private features (your real moat)

All extend `lib/ai.ts` + `app/api/ai/route.ts` with new `task`s; all extract text client-side first;
all rate-limited + 503 without a key.

**B1. Chat with your document** — `/chat` (or a panel in `/smart`). Extract text in-browser, then a
`chat` task: `{ text, question, history }` → answer. **Stream** the response (SDK streaming) for UX.
opus-4-8 has a 1M context so most docs fit; use prompt caching for the doc prefix across turns. Privacy
line in the UI: "only the document's text is sent."

**B2. AI auto-redaction** — `/redact`. Extract text **with positions** (pdf.js `getTextContent` items
carry transforms). A `redact-detect` task returns PII spans `{ text, type }` (names, emails, phones,
card/ID numbers, addresses). Map spans back to glyph positions, draw the boxes, and on export use the
**secure rasterize** path from A1 so the text is truly removed. This — private, AI-driven, genuinely
removing data — is something no incumbent offers. Verify detection schema in Node; flag placement for
browser.

**B3. AI translate document** — `/translate`. Extract text → `translate` task `{ text, targetLang }`
(reuse the locale list in `lib/i18n.ts`) → translated structured blocks → re-render to PDF. Keep
paragraph structure via structured output.

**B4. Document compare / redline** — `/compare`. Two PDFs → extract both texts → a `compare` task
returning structured changes `{ added[], removed[], changed[] }` + a plain-language summary. Render a
side-by-side / redline view. Great for contracts.

### Phase C — Reach (after A & B)

**C1. PWA share target** — add `share_target` to `app/manifest.ts` so the OS share sheet (and WhatsApp
on Android) can send a file straight into DocuScan; handle the shared file on a landing route. Deepens
the WhatsApp-first loop (wa.me share already exists in `ShareActions`).

**C2. (Optional/advanced) Voice & handwriting → document** — Web Speech API dictation → formatted PDF;
handwriting via OCR (note: Tesseract handles printed text well, cursive poorly — flag the limitation).

---

## Dependencies you'll likely add (dynamic-import the heavy ones)
`fabric` (editor canvas) · `docx` (DOCX export) · optionally `@tiptap/*` or ProseMirror (rich-text
editor for A2). Keep them out of the main bundle.

## New env vars to document in `.env.example`
None required beyond the existing `ANTHROPIC_API_KEY` (already documented) — the editor and B-features
reuse it. Add any you introduce.

## My ask for this session
Start with **Phase A (the editor)** — A1 first (private overlay editor that matches the paid tools),
then A2 (AI "make editable"). Then Phase B in order (B1 chat, B2 redaction, B3 translate, B4 compare).
Phase C last. Build incrementally, run `npm run build` after each feature, smoke-test on a fresh port,
and **honestly flag** what needs a real browser / device / live `ANTHROPIC_API_KEY` that you can't
verify here. Keep every established pattern above. PDF writes import from `@cantoo/pdf-lib`. No auth,
no payment, no signup anywhere.
