import Link from "next/link";

type Tool = {
  name: string;
  href: string;
  desc: string;
  tile: string; // tailwind classes for the icon tile (bg + text color)
  ai?: boolean;
  glyph?: string; // for text-based icons (e.g. #)
  msym?: string; // Material Symbols icon name (e.g. auto_awesome)
  paths?: string[]; // SVG path data (Heroicons outline)
};

// Ported from the Stitch "All Document Tools" redesign. Blue-family icon tiles
// remapped to warm/green hues per the no-blue brand direction.
export const ALL_TOOLS: Tool[] = [
  { name: "Edit PDF", href: "/edit", desc: "Add text, images, redact & more", tile: "bg-orange-50 text-orange-500", paths: ["M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"] },
  { name: "Scan to PDF", href: "/image-to-pdf", desc: "Photo or camera → clean PDF", tile: "bg-slate-100 text-slate-600", paths: ["M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z", "M15 13a3 3 0 11-6 0 3 3 0 016 0z"] },
  { name: "Image to PDF", href: "/image-to-pdf", desc: "Combine images into one PDF", tile: "bg-green-50 text-green-600", paths: ["M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"] },
  { name: "Enhance image", href: "/enhance", desc: "AI upscale photos to top quality", tile: "bg-cyan-50 text-cyan-600", ai: true, msym: "auto_fix_high" },
  { name: "Merge PDF", href: "/merge-pdf", desc: "Join multiple PDFs", tile: "bg-teal-50 text-teal-600", paths: ["M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"] },
  { name: "Convert documents", href: "/convert", desc: "PDF, Word, Excel, images, HEIC…", tile: "bg-sky-50 text-sky-600", paths: ["M8 7h12m0 0l-4-4m4 4l-4 4m4 6H4m0 0l4 4m-4-4l4-4"] },
  { name: "Compress PDF", href: "/compress-pdf", desc: "Shrink for email", tile: "bg-purple-50 text-purple-600", paths: ["M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"] },
  { name: "Split PDF", href: "/split-pdf", desc: "Extract pages", tile: "bg-red-50 text-red-500", paths: ["M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z"] },
  { name: "OCR PDF", href: "/ocr-pdf", desc: "Make text searchable", tile: "bg-emerald-50 text-emerald-600", paths: ["M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"] },
  { name: "Rotate PDF", href: "/rotate-pdf", desc: "Turn pages upright", tile: "bg-amber-50 text-amber-600", paths: ["M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"] },
  { name: "Watermark PDF", href: "/watermark-pdf", desc: "Stamp diagonal text", tile: "bg-lime-50 text-lime-600", paths: ["M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"] },
  { name: "Page numbers", href: "/page-numbers", desc: "Number every page", tile: "bg-brand-100 text-brand-600", glyph: "#" },
  { name: "Sign PDF", href: "/sign-pdf", desc: "Draw & place a signature", tile: "bg-yellow-50 text-yellow-600", paths: ["M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"] },
  { name: "Protect PDF", href: "/protect-pdf", desc: "Add a password", tile: "bg-amber-50 text-amber-600", paths: ["M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"] },
  { name: "Unlock PDF", href: "/unlock-pdf", desc: "Remove a password", tile: "bg-orange-50 text-orange-400", paths: ["M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"] },
  { name: "Batch compress", href: "/batch", desc: "Bulk-process many PDFs", tile: "bg-stone-100 text-stone-600", paths: ["M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"] },
  { name: "AI assistant", href: "/smart", desc: "Name, tag & extract data", tile: "bg-ai-50 text-ai-600", ai: true, paths: ["M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"] },
  { name: "Make editable", href: "/reconstruct", desc: "Scan → editable document", tile: "bg-rose-50 text-rose-500", ai: true, msym: "auto_awesome" },
  { name: "Chat with PDF", href: "/chat", desc: "Ask your document anything", tile: "bg-fuchsia-50 text-fuchsia-600", ai: true, paths: ["M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"] },
  { name: "AI redact", href: "/redact", desc: "Find & remove sensitive info", tile: "bg-slate-100 text-slate-700", ai: true, paths: ["M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4"] },
  { name: "Translate", href: "/translate", desc: "Translate a whole document", tile: "bg-teal-50 text-teal-600", ai: true, paths: ["M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"] },
  { name: "Compare", href: "/compare", desc: "Redline two versions", tile: "bg-orange-50 text-orange-500", ai: true, paths: ["M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"] },
  { name: "Extract to table", href: "/extract", desc: "Fields to Excel, CSV or PDF", tile: "bg-green-50 text-green-600", ai: true, paths: ["M3 10h18M3 14h18m-9-7v14M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"] },
  { name: "Listen to PDF", href: "/audio", desc: "Read aloud or AI narration", tile: "bg-purple-50 text-purple-600", ai: true, paths: ["M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"] },
  { name: "Make slides", href: "/slides", desc: "Document → PowerPoint deck", tile: "bg-rose-50 text-rose-500", ai: true, paths: ["M4 5a1 1 0 011-1h14a1 1 0 011 1v10a1 1 0 01-1 1H5a1 1 0 01-1-1V5z", "M8 21h8m-4-5v5"] },
  { name: "Summarize", href: "/summarize", desc: "TL;DR, key points & actions", tile: "bg-sky-50 text-sky-600", ai: true, paths: ["M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"] },
  { name: "Rewrite & simplify", href: "/rewrite", desc: "Plain language or new tone", tile: "bg-violet-50 text-violet-600", ai: true, paths: ["M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"] },
  { name: "Analyze contract", href: "/analyze", desc: "Key terms & risk review", tile: "bg-indigo-50 text-indigo-600", ai: true, paths: ["M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"] },
  { name: "Draft from doc", href: "/draft", desc: "Email reply, letter or memo", tile: "bg-pink-50 text-pink-600", ai: true, paths: ["M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"] },
  { name: "Study aids", href: "/study", desc: "Flashcards & quiz from a doc", tile: "bg-cyan-50 text-cyan-600", ai: true, paths: ["M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"] },
];

const EXPANSION_TOOLS: Tool[] = [
  { name: "Auto crop", href: "/auto-crop", desc: "Detect edges and straighten scans", tile: "bg-amber-50 text-amber-600", msym: "document_scanner" },
  { name: "Enhance scan", href: "/enhance-scan", desc: "Color, grayscale and B&W cleanup", tile: "bg-lime-50 text-lime-600", msym: "tune" },
  { name: "Clean scan", href: "/clean-scan", desc: "Shadows, fingers and stains workflow", tile: "bg-rose-50 text-rose-500", ai: true, msym: "cleaning_services" },
  { name: "PDF to Word", href: "/pdf-to-word", desc: "Scan or PDF to editable DOCX", tile: "bg-blue-50 text-blue-600", ai: true, msym: "article" },
  { name: "PDF to Excel", href: "/pdf-to-excel", desc: "Tables and fields to CSV/Excel", tile: "bg-emerald-50 text-emerald-600", ai: true, msym: "table" },
  { name: "PDF to Image", href: "/pdf-to-image", desc: "Export pages as images", tile: "bg-cyan-50 text-cyan-600", msym: "image" },
  { name: "Organize PDF", href: "/organize-pdf", desc: "Delete and reorder pages", tile: "bg-stone-100 text-stone-600", msym: "view_carousel" },
  { name: "Handwriting to text", href: "/handwriting", desc: "Notes to Word or PDF", tile: "bg-violet-50 text-violet-600", ai: true, msym: "draw" },
  { name: "Fillable PDF", href: "/fillable-pdf", desc: "Prepare forms for typing and signing", tile: "bg-pink-50 text-pink-600", ai: true, msym: "edit_document" },
  { name: "Detect document type", href: "/detect-document-type", desc: "Classify files automatically", tile: "bg-indigo-50 text-indigo-600", ai: true, msym: "category" },
  { name: "Smart rename", href: "/smart-rename", desc: "Name files from content", tile: "bg-fuchsia-50 text-fuchsia-600", ai: true, msym: "drive_file_rename_outline" },
  { name: "Saved text templates", href: "/templates", desc: "Reusable text with variables", tile: "bg-stone-100 text-stone-700", msym: "text_snippet" },
  { name: "Invoice Maker", href: "/invoice", desc: "Create and save invoice PDFs", tile: "bg-emerald-50 text-emerald-700", msym: "receipt_long" },
  { name: "Smart Notes", href: "/smart-notes", desc: "Auto-format pasted notes", tile: "bg-yellow-50 text-yellow-600", ai: true, msym: "edit_note" },
  { name: "Print Ready PDF", href: "/print-ready", desc: "Optimize a PDF for printing", tile: "bg-slate-100 text-slate-600", msym: "print" },
  { name: "Document QR Labels", href: "/qr-labels", desc: "QR codes + printable labels", tile: "bg-indigo-50 text-indigo-600", msym: "qr_code_2" },
  { name: "Resume Scanner", href: "/resume-scanner", desc: "Parse a CV & summarize", tile: "bg-violet-50 text-violet-600", ai: true, msym: "badge" },
  { name: "Receipt Scanner", href: "/receipt-scanner", desc: "Receipt → expense + CSV", tile: "bg-teal-50 text-teal-600", ai: true, msym: "receipt" },
  { name: "Document Reminders", href: "/reminders", desc: "Due dates & renewals", tile: "bg-rose-50 text-rose-500", msym: "notifications_active" },
];

function ToolIcon({ tool }: { tool: Tool }) {
  if (tool.msym) {
    return (
      <span className="material-symbols-outlined text-[22px]" aria-hidden>
        {tool.msym}
      </span>
    );
  }
  if (tool.glyph) {
    return <span className="text-lg font-bold">{tool.glyph}</span>;
  }
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      {tool.paths?.map((d, i) => (
        <path key={i} d={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
      ))}
    </svg>
  );
}

export default function ToolGrid({ limit }: { limit?: number } = {}) {
  const sorted = [...ALL_TOOLS, ...EXPANSION_TOOLS].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const tools = typeof limit === "number" ? sorted.slice(0, limit) : sorted;
  return (
    <div
      data-translate="tools"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      {tools.map((tool, i) => (
        <Link
          key={tool.name}
          href={tool.href}
          style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
          className="group flex animate-rise items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 transition duration-200 ease-snappy will-change-transform hover:border-brand-400 hover:shadow-card active:translate-y-0 motion-safe:hover:-translate-y-0.5"
        >
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg transition-transform duration-200 ease-snappy group-hover:scale-110 ${tool.tile}`}
          >
            <ToolIcon tool={tool} />
          </span>
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <h3 className="font-semibold text-ink">{tool.name}</h3>
              {tool.ai && (
                <span className="rounded-md bg-ai-100 px-1.5 py-0.5 text-[10px] font-bold leading-none text-ai-700">
                  AI
                </span>
              )}
            </div>
            <p className="text-sm leading-snug text-slate-500">{tool.desc}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
