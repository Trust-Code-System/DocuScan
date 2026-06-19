import Link from "next/link";
import ToolGrid from "@/components/ToolGrid";

// Quick-action tiles (the Stitch "sub-hero" row).
const quickTools = [
  { name: "Scan", href: "/image-to-pdf", desc: "Photo or camera to clean PDF.", icon: "document_scanner" },
  { name: "Convert", href: "/convert", desc: "PDF, Word, Excel and images.", icon: "published_with_changes" },
  { name: "Organize", href: "/organize-pdf", desc: "Delete and reorder PDF pages.", icon: "view_carousel" },
  { name: "AI tools", href: "/smart", desc: "Rename, classify and extract data.", icon: "auto_awesome" },
];

// Curated AI tools highlighted on the home page (full set lives in ToolGrid).
const newAiTools = [
  { name: "Summarize", href: "/summarize", desc: "TL;DR, key points & action items from any document.", icon: "summarize", tile: "bg-sky-50 text-sky-600" },
  { name: "Analyze contract", href: "/analyze", desc: "Plain-English key terms, obligations & risk flags.", icon: "gavel", tile: "bg-indigo-50 text-indigo-600" },
  { name: "Draft from doc", href: "/draft", desc: "Email reply, follow-up, cover letter or memo.", icon: "mail", tile: "bg-pink-50 text-pink-600" },
  { name: "Rewrite & simplify", href: "/rewrite", desc: "Plain language or a new tone, export to PDF/Word.", icon: "edit_note", tile: "bg-violet-50 text-violet-600" },
  { name: "Study aids", href: "/study", desc: "Flashcards & a quick quiz from notes or a chapter.", icon: "school", tile: "bg-cyan-50 text-cyan-600" },
  { name: "Smart Notes", href: "/smart-notes", desc: "Paste rough notes — auto-format & export to PDF/Word.", icon: "edit_note", tile: "bg-yellow-50 text-yellow-600" },
];

function Sym({ name, className }: { name: string; className?: string }) {
  return (
    <span className={`material-symbols-outlined ${className ?? ""}`} aria-hidden>
      {name}
    </span>
  );
}

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-8">
      {/* Hero */}
      <section className="pb-12 pt-6 text-center md:pb-20 md:pt-10">
        <div className="mb-7 flex justify-center">
          <div className="ai-flow" aria-label="AI document processing">
            <span className="ai-flow__document" aria-hidden>
              <Sym name="description" className="text-[22px] text-brand-600" />
              <span className="ai-flow__scan" />
            </span>
            <span className="ai-flow__rail" aria-hidden>
              <span className="ai-flow__pulse" />
              <span className="ai-flow__pulse ai-flow__pulse--late" />
            </span>
            <span className="ai-flow__core" aria-hidden>
              <Sym name="auto_awesome" className="text-[22px] text-ai-600" />
              <span className="ai-flow__orbit ai-flow__orbit--one" />
              <span className="ai-flow__orbit ai-flow__orbit--two" />
            </span>
          </div>
        </div>

        <h1 className="mx-auto max-w-3xl text-balance text-[36px] font-bold leading-[1.1] tracking-tight text-ink md:text-5xl">
          All-in-One AI Document Workspace.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-slate-600">
          Scan, clean, OCR, edit, convert, organize, sign, protect, and understand documents in one
          faster workspace. Think Adobe Scan, iLovePDF, Smallpdf, and CamScanner with simpler AI-first
          workflows.
        </p>

        {/* Drop zone / primary CTA */}
        <div className="group relative mt-12">
          <div
            aria-hidden
            className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-brand-500/20 to-ai-500/20 opacity-25 blur transition duration-700 group-hover:opacity-40"
          />
          <Link
            href="/image-to-pdf"
            className="relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 transition-colors duration-200 ease-snappy hover:border-brand-500 hover:bg-brand-50/40 md:p-20"
          >
            <span className="mb-6 grid h-16 w-16 place-items-center rounded-full bg-brand-50 text-brand-600">
              <Sym name="description" className="text-4xl" />
            </span>
            <h3 className="text-xl font-semibold text-ink">Drop your files here</h3>
            <p className="mt-2 text-sm text-slate-600">PDF, PNG, JPG or HEIC (Up to 25MB)</p>
            <span className="press mt-8 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-8 py-3 font-bold text-white shadow-lg shadow-brand-500/20 transition-colors duration-150 group-hover:bg-brand-600">
              Start Scanning
              <Sym name="arrow_forward" />
            </span>
          </Link>
        </div>
      </section>

      {/* Quick tools row */}
      <section className="mb-20 grid grid-cols-2 gap-4 md:grid-cols-4">
        {quickTools.map((tool, i) => (
          <Link
            key={tool.name}
            href={tool.href}
            style={{ animationDelay: `${i * 50}ms` }}
            className="group animate-rise rounded-2xl border border-slate-200 bg-white p-6 transition duration-200 ease-snappy will-change-transform hover:shadow-card active:translate-y-0 motion-safe:hover:-translate-y-1"
          >
            <span className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-600 transition-colors duration-200 group-hover:bg-brand-50 group-hover:text-brand-600">
              <Sym name={tool.icon} />
            </span>
            <h4 className="text-lg font-semibold text-ink">{tool.name}</h4>
            <p className="mt-1 text-sm text-slate-600">{tool.desc}</p>
          </Link>
        ))}
      </section>

      {/* Bento: AI & security features */}
      <section className="mb-20 grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* AI Vision (large) */}
        <Link
          href="/smart"
          className="group relative h-[360px] overflow-hidden rounded-2xl bg-slate-900 md:col-span-2"
        >
          <div className="doc-ai-card" aria-hidden>
            <div className="doc-ai-card__paper">
              <div className="doc-ai-card__paper-head">
                <span />
                <span />
                <span />
              </div>
              <div className="doc-ai-card__line doc-ai-card__line--wide" />
              <div className="doc-ai-card__line" />
              <div className="doc-ai-card__line doc-ai-card__line--short" />
              <div className="doc-ai-card__scan" />
            </div>
            <div className="doc-ai-card__stream">
              <span className="doc-ai-card__stream-line doc-ai-card__stream-line--one" />
              <span className="doc-ai-card__stream-line doc-ai-card__stream-line--two" />
              <span className="doc-ai-card__stream-line doc-ai-card__stream-line--three" />
            </div>
            <div className="doc-ai-card__answer">
              <div className="doc-ai-card__answer-top">
                <Sym name="auto_awesome" className="text-[20px] text-ai-300" />
                <span />
              </div>
              <div className="doc-ai-card__answer-line doc-ai-card__answer-line--wide" />
              <div className="doc-ai-card__answer-line" />
              <div className="doc-ai-card__answer-line doc-ai-card__answer-line--short" />
            </div>
          </div>
          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-ink/90 via-ink/30 to-transparent p-8">
            <span className="mb-4 w-fit rounded-full bg-ai-500 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">
              AI Assistant
            </span>
            <h3 className="max-w-[18rem] text-2xl font-bold leading-tight text-white md:max-w-lg md:text-[32px]">
              Ask Your Documents Anything
            </h3>
            <p className="mt-2 max-w-lg text-white/80">
              Get plain-language answers, summaries, and key takeaways from any file — no scrolling
              through pages to find what matters.
            </p>
          </div>
        </Link>

        {/* Zero-Cloud Policy */}
        <Link
          href="/security"
          className="flex flex-col items-center justify-center rounded-2xl bg-brand-600 p-8 text-center text-white transition-colors duration-200 hover:bg-brand-700"
        >
          <span className="mb-6 grid h-20 w-20 place-items-center rounded-full bg-white/10">
            <Sym name="shield_lock" className="text-5xl" />
          </span>
          <h3 className="text-2xl font-bold">Private by Design</h3>
          <p className="mt-4 text-sm text-white/70">
            Your documents stay under your control from upload to export. Sensitive files are never
            shared or used without your permission.
          </p>
          <div className="mt-8 flex -space-x-2">
            {["GDPR", "SOC2", "HIPAA"].map((b) => (
              <span
                key={b}
                className="grid h-8 w-8 place-items-center rounded-full border-2 border-brand-600 bg-slate-100 text-[10px] font-bold text-ink"
              >
                {b}
              </span>
            ))}
          </div>
        </Link>

        {/* Smart Organization */}
        <Link
          href="/smart"
          className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-8 transition-shadow duration-200 hover:shadow-card"
        >
          <div>
            <h3 className="text-xl font-semibold text-ink">Smart Organization</h3>
            <p className="mt-2 text-sm text-slate-600">
              Auto-categorize documents based on content analysis using lightweight transformer
              models.
            </p>
          </div>
          <div className="mt-8 space-y-3">
            <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
              <Sym name="description" className="shrink-0 text-brand-600" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">Tax_Return_2024.pdf</span>
              <span className="shrink-0 rounded bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-600">
                Financial
              </span>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 opacity-60">
              <Sym name="assignment" className="shrink-0 text-brand-600" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">Rent_Agreement.doc</span>
              <span className="shrink-0 rounded bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-600">
                Legal
              </span>
            </div>
          </div>
        </Link>

        {/* Multi-Language OCR */}
        <div className="glass-card flex flex-col items-center gap-8 overflow-hidden rounded-2xl p-8 md:col-span-2 md:flex-row">
          <div className="flex-1">
            <h3 className="flex items-center gap-2 text-2xl font-semibold text-ink md:text-[24px]">
              Multi-Language OCR
              <Sym name="auto_awesome" className="text-[22px] text-ai-500" />
            </h3>
            <p className="mt-3 text-slate-600">
              Support for over 120 languages with high-fidelity text extraction. Perfect for
              international business travel and receipt management.
            </p>
            <Link
              href="/ocr-pdf"
              className="mt-6 inline-flex items-center gap-2 font-bold text-brand-600 transition-transform duration-200 hover:translate-x-1"
            >
              Explore OCR capabilities
              <Sym name="east" />
            </Link>
          </div>
          <div className="relative w-full flex-1">
            <div className="relative overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-sm">
              {/* soft beam sweeping down implies live OCR scanning */}
              <div
                aria-hidden
                className="scan-beam pointer-events-none absolute inset-x-0 top-0 z-10 h-14 bg-gradient-to-b from-ai-500/20 via-ai-500/5 to-transparent"
              />
              <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
                <Sym name="document_scanner" className="text-[18px] text-ai-500" />
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">
                  invoice_45290.pdf
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-600">
                  <Sym name="check_circle" className="text-[12px]" />
                  Extracted
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-px bg-slate-100">
                <div className="bg-white p-3">
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Invoice</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-ink">#45290</dd>
                </div>
                <div className="bg-white p-3">
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Date</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-ink">Oct 12, 2024</dd>
                </div>
                <div className="col-span-2 bg-white p-3">
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Client</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-ink">ACME Corp</dd>
                </div>
                <div className="col-span-2 flex items-center justify-between bg-brand-50 p-3">
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-brand-600">Total</dt>
                  <dd className="text-base font-bold text-brand-700">$1,450.00</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* New AI document tools — curated highlight band */}
      <section className="mb-20">
        <div className="mb-4 flex items-center gap-2">
          <span className="rounded-md bg-ai-100 px-1.5 py-0.5 text-[10px] font-bold leading-none text-ai-700">
            NEW
          </span>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
            AI document tools
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...newAiTools].sort((a, b) => a.name.localeCompare(b.name)).map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 transition duration-200 ease-snappy hover:border-brand-400 hover:shadow-card motion-safe:hover:-translate-y-0.5"
            >
              <span className={`grid h-11 w-11 place-items-center rounded-xl ${t.tile}`}>
                <Sym name={t.icon} className="text-[22px]" />
              </span>
              <h3 className="mt-4 flex items-center gap-2 font-semibold text-ink">
                {t.name}
                <span className="rounded-md bg-ai-100 px-1.5 py-0.5 text-[10px] font-bold leading-none text-ai-700">
                  AI
                </span>
              </h3>
              <p className="mt-1 flex-1 text-sm leading-snug text-slate-500">{t.desc}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 transition-transform duration-200 group-hover:translate-x-0.5">
                Try it <Sym name="arrow_forward" className="text-base" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Full tool catalogue (Stitch "All Document Tools" redesign) */}
      <section className="pb-20">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">All tools</h2>
          <Link
            href="/tools"
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 transition-transform duration-200 hover:translate-x-0.5"
          >
            View all <Sym name="arrow_forward" className="text-base" />
          </Link>
        </div>
        <ToolGrid limit={8} />
      </section>
    </div>
  );
}
