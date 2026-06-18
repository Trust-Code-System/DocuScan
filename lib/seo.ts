/**
 * Per-tool SEO metadata.
 *
 * Tool pages are client components, so they can't export `metadata` directly.
 * Each tool folder has a tiny server `layout.tsx` that does:
 *
 *   import { toolMetadata } from "@/lib/seo";
 *   export const metadata = toolMetadata("compress-pdf");
 *   export default function Layout({ children }) { return children; }
 *
 * Keeping the copy here (one map) means titles/descriptions/canonicals stay
 * consistent and are easy to tune for search. SITE_URL drives canonical + OG
 * URLs; set NEXT_PUBLIC_SITE_URL in production.
 */

import type { Metadata } from "next";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://docuscan.app";

type ToolSeo = { title: string; description: string };

export const TOOL_SEO: Record<string, ToolSeo> = {
  enhance: {
    title: "Enhance Image — AI Upscale Photos to Top Quality",
    description:
      "Sharpen and upscale photos 2× or 4× with AI super-resolution (Real-ESRGAN). Runs entirely in your browser — your image never leaves your device. Free, no signup.",
  },
  edit: {
    title: "Edit PDF — Add Text, Images, Highlights & Redact",
    description:
      "Annotate and edit any PDF in your browser: add text and images, highlight, white-out, draw, fill forms and truly redact. Free, private, no signup — your file never leaves your device.",
  },
  reconstruct: {
    title: "Make PDF Editable — AI Convert Scan to Editable Doc",
    description:
      "Turn any PDF or scan into a clean, editable document with AI, then export to PDF or Word. Text is read in your browser (with OCR for scans) — the file never leaves your device.",
  },
  chat: {
    title: "Chat with Your PDF — Ask Questions with AI",
    description:
      "Ask questions and get answers grounded in your document. Only the text is sent to the AI — your file stays on your device. Free, no signup.",
  },
  redact: {
    title: "AI Redact PDF — Find & Truly Remove Personal Data",
    description:
      "AI finds names, emails, phone numbers and IDs, then truly removes them (not just a black box). Private — redaction happens in your browser. Free, no signup.",
  },
  translate: {
    title: "Translate PDF — AI Document Translation",
    description:
      "Translate a document into another language while keeping its structure, then export to PDF or Word. Only the text is sent to the AI; the file stays on your device.",
  },
  compare: {
    title: "Compare PDFs — AI Redline & Diff",
    description:
      "See what changed between two document versions — additions, removals and reworded passages with a plain-language summary. Private, AI-powered, no signup.",
  },
  extract: {
    title: "Extract Data to Table — AI PDF to Excel/CSV",
    description:
      "Pull invoices, receipts, bank statements, line items, names and any custom fields out of a document into an editable table — export to Excel/CSV or a PDF report. Only the text is sent to the AI; the file stays on your device.",
  },
  audio: {
    title: "Document to Audio — Listen to Your PDF (Text to Speech)",
    description:
      "Have any document read aloud in your browser, or let AI turn it into a short audio summary, explainer or podcast-style narration. Adjustable voice and speed, free and private — the file stays on your device.",
  },
  slides: {
    title: "Document to Presentation — AI PDF to PowerPoint & PDF Slides",
    description:
      "Turn a report, proposal or paper into an editable slide deck with AI, then export to PowerPoint (PPTX) or PDF. Choose a professional, academic, pitch or simple style. Only the text is sent to the AI; the file stays on your device.",
  },
  convert: {
    title: "Convert Documents — PDF, Word, Excel, Images, HEIC & More",
    description:
      "Convert between PDF, Word, Excel, PowerPoint, images, HEIC, CSV, JSON, text, Markdown and HTML. Most conversions run right in your browser — fast, free and private, your file never leaves your device.",
  },
  "image-to-pdf": {
    title: "Scan to PDF — Photos & Images to PDF",
    description:
      "Turn phone photos or image files into a clean, multi-page PDF in your browser. Crop, rotate, reorder — no signup, files never leave your device.",
  },
  "merge-pdf": {
    title: "Merge PDF — Combine PDF Files Online",
    description:
      "Join multiple PDFs into one document, right in your browser. Reorder before merging. Free, private, no signup.",
  },
  "compress-pdf": {
    title: "Compress PDF — Shrink PDF Size for Email",
    description:
      "Reduce PDF file size so it's small enough to email or upload. Three quality levels, all processed locally in your browser.",
  },
  "split-pdf": {
    title: "Split PDF — Extract or Split Pages",
    description:
      "Extract a page range from a PDF or split it into separate files (ZIP). Fast, private, in-browser. No signup needed.",
  },
  "ocr-pdf": {
    title: "OCR PDF — Make Scanned PDFs Searchable",
    description:
      "Run OCR on a scanned PDF to add a searchable, selectable text layer — and copy the recognised text. 8 languages, all in your browser.",
  },
  "rotate-pdf": {
    title: "Rotate PDF — Turn Pages Upright",
    description:
      "Rotate some or all pages of a PDF and save the result. Free, private, in-browser — no upload to a server.",
  },
  "watermark-pdf": {
    title: "Watermark PDF — Add a Text Watermark",
    description:
      "Stamp a diagonal text watermark across every page of a PDF, with adjustable opacity. Processed locally in your browser.",
  },
  "page-numbers": {
    title: "Add Page Numbers to PDF",
    description:
      "Add page numbers to a PDF in three formats and three positions. Free and private — runs entirely in your browser.",
  },
  "sign-pdf": {
    title: "Sign PDF — Draw & Place a Signature",
    description:
      "Draw or type a signature and drag it onto your PDF pages. Multi-page, in-browser, no signup. Your document never leaves your device.",
  },
  "protect-pdf": {
    title: "Protect PDF — Add a Password",
    description:
      "Encrypt a PDF with a password so it can't be opened without it. Done in your browser — the file isn't uploaded anywhere.",
  },
  "unlock-pdf": {
    title: "Unlock PDF — Remove a Password",
    description:
      "Remove a known password from a PDF you own, in your browser. Private and fast — nothing is sent to a server.",
  },
  batch: {
    title: "Batch Compress PDFs — Bulk Process Files",
    description:
      "Upload many PDFs at once, compress them all, and download a single ZIP. Bulk processing in your browser — no signup, files stay on your device.",
  },
  smart: {
    title: "AI Document Assistant — Name, Tag & Extract",
    description:
      "Let AI name your document, tag and classify it, and pull structured data from receipts, invoices and contracts. Text is extracted in your browser first.",
  },
  summarize: {
    title: "Summarize PDF — AI TL;DR, Key Points & Action Items",
    description:
      "Get a TL;DR, key points and action items from any long document with AI. Only the text is sent to the AI — your file stays on your device. Free, no signup.",
  },
  rewrite: {
    title: "Rewrite & Simplify PDF — AI Plain Language & Tone",
    description:
      "Rewrite a document in plain language or a new tone (simplify, shorten, formal, friendly), keeping its structure, then export to PDF or Word. Private — only the text is sent to the AI.",
  },
  analyze: {
    title: "Analyze Contract — AI Key Terms & Risk Review",
    description:
      "Get a plain-English breakdown of a contract: parties, key terms, obligations and clauses worth a closer look. Private — only the text is sent to the AI. Informational, not legal advice.",
  },
  draft: {
    title: "Draft from PDF — AI Email Reply, Cover Letter & Memo",
    description:
      "Turn a document into a ready-to-send email reply, follow-up, cover letter or memo with AI. Private — only the text is sent to the AI; your file stays on your device.",
  },
  study: {
    title: "Study Aids from PDF — AI Flashcards & Quiz",
    description:
      "Turn notes or a textbook chapter into flashcards and a multiple-choice quiz with AI. Private — only the text is sent to the AI; your file stays on your device. Free, no signup.",
  },
  "auto-crop": {
    title: "Auto Crop Document Scans",
    description:
      "Detect document edges, straighten phone photos, and crop scans before exporting a clean PDF. Uses the private browser-based Scan to PDF workflow.",
  },
  "enhance-scan": {
    title: "Enhance Scanned Documents",
    description:
      "Improve document scans with color, grayscale, and black-and-white filters before exporting to PDF or running OCR.",
  },
  "clean-scan": {
    title: "Clean Scans - Remove Shadows, Fingers & Stains",
    description:
      "Clean up scanned documents with crop, enhancement, and PDF editing workflows, with a clear path for AI shadow, finger, and stain removal.",
  },
  handwriting: {
    title: "Handwriting to Text - Notes to Word or PDF",
    description:
      "Extract handwritten notes from scans into editable text, then export to Word or PDF through DocuScan's editable document workflow.",
  },
  "organize-pdf": {
    title: "Organize PDF - Delete & Reorder Pages",
    description:
      "Delete pages by leaving them out, reorder pages in any sequence, and export a new organized PDF in your browser.",
  },
  "pdf-to-word": {
    title: "PDF to Word - Convert Scans to DOCX",
    description:
      "Convert PDFs and scans into editable Word documents using OCR and AI reconstruction, then export a DOCX file.",
  },
  "pdf-to-excel": {
    title: "PDF to Excel - Extract Tables to CSV",
    description:
      "Extract PDF tables, invoices, receipts, bank statements, and custom fields into spreadsheet-ready CSV for Excel.",
  },
  "pdf-to-image": {
    title: "PDF to Image",
    description:
      "Convert PDF pages into image outputs through DocuScan's universal document converter.",
  },
  "detect-document-type": {
    title: "Detect Document Type Automatically",
    description:
      "Classify documents as invoices, receipts, contracts, resumes, IDs, reports and more using DocuScan's AI document assistant.",
  },
  "smart-rename": {
    title: "Smart Rename Documents",
    description:
      "Generate clean, descriptive, filesystem-safe filenames from document content with AI-powered smart rename.",
  },
  "fillable-pdf": {
    title: "Fillable PDF Forms",
    description:
      "Prepare scanned forms for typing, signing, and form-field extraction with DocuScan's PDF editor and AI table tools.",
  },
  templates: {
    title: "Saved Text Templates - Reusable Document Text",
    description:
      "Save reusable document text, signature blocks, invoice notes and form snippets with variables like name, date and company. Private, device-local, and ready to copy into documents.",
  },
  invoice: {
    title: "Invoice Maker - Create Invoice PDFs",
    description:
      "Create professional invoice PDFs with business details, client details, line items, tax, discount, currency support and locally saved invoice records.",
  },
  "smart-notes": {
    title: "Smart Notes - Auto-Format Pasted Notes to PDF & Word",
    description:
      "Paste rough notes and DocuScan formats them automatically — headings, code blocks, lists, checklists, quotes and tables — then export to PDF, Word, Markdown or text. Runs entirely in your browser.",
  },
  "print-ready": {
    title: "Print Ready PDF - Optimize a PDF for Printing",
    description:
      "Prepare any PDF for the print shop: convert to black & white, normalize to A4 or Letter, add margins and page numbers. Processed locally in your browser — your file never leaves your device.",
  },
  "qr-labels": {
    title: "Document QR Labels - Printable QR Code Label Sheets",
    description:
      "Generate QR codes for documents, files or folders and print a clean label sheet to stick on physical paperwork. QR codes are created in your browser — free, no signup.",
  },
  "resume-scanner": {
    title: "Resume Scanner - AI CV Parser & Candidate Summary",
    description:
      "Extract a candidate's name, contact, skills, education and experience from a CV, summarize it, compare it to a job description and generate interview questions. AI assists; a human should review.",
  },
  "receipt-scanner": {
    title: "Receipt Scanner - Extract Expenses to CSV",
    description:
      "Scan or upload a receipt, pull out the vendor, date, total, tax and category, correct any field, and export your expenses to CSV. Text is read in your browser; only text is sent to the AI.",
  },
  reminders: {
    title: "Document Reminders - Due Dates & Renewals",
    description:
      "Never miss a document deadline. Set reminders for renewals, expiries, signatures and invoice follow-ups, with browser notifications. Saved on your device — private and free.",
  },
};

/** Build full Next.js Metadata (title, description, canonical, OG/Twitter). */
export function toolMetadata(slug: string): Metadata {
  const seo = TOOL_SEO[slug];
  if (!seo) return {};
  const url = `${SITE_URL}/${slug}`;
  const fullTitle = `${seo.title} | DocuScan`;
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: url },
    openGraph: {
      title: fullTitle,
      description: seo.description,
      url,
      siteName: "DocuScan",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: seo.description,
    },
  };
}
