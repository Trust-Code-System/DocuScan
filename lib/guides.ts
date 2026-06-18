/**
 * Content-marketing "how-to" guides.
 *
 * Each guide is a short, SEO-targeted how-to that links to the relevant tool.
 * Stored as data here so the index page, the [slug] route, the sitemap, and
 * generateMetadata all stay in sync from one source. Add a guide = add an entry.
 */

export type GuideStep = { title: string; body: string };

export type Guide = {
  slug: string;
  title: string; // <title> / H1
  description: string; // meta description + intro
  tool: { href: string; label: string }; // primary CTA
  intro: string;
  steps: GuideStep[];
  tips?: string[];
  updated: string; // ISO date
};

export const GUIDES: Guide[] = [
  {
    slug: "scan-documents-with-your-phone",
    title: "How to Scan Documents With Your Phone (Free, No App)",
    description:
      "Turn your phone into a document scanner in seconds — capture, crop, clean up and save as a sharp PDF, right in your browser. No app, no signup.",
    tool: { href: "/image-to-pdf", label: "Open the Scan tool" },
    intro:
      "You don't need a dedicated scanner app to get a clean, professional PDF. DocuScan runs in your browser, so you can photograph a document and have a crisp, cropped PDF in under a minute — and the file never leaves your device.",
    steps: [
      { title: "Open the scanner", body: "Go to the Scan / Image-to-PDF tool and tap to use your camera, or upload photos you've already taken." },
      { title: "Capture each page", body: "Hold the phone flat above the page in good light. Add as many pages as you need — they queue up in order." },
      { title: "Crop and clean up", body: "Drag the corners to fit the page edges. Apply the Grayscale or Black & White filter for a true 'scanned' look that's easier to read and smaller in size." },
      { title: "Reorder and save", body: "Reorder, rotate or delete any page, then export. You get a single multi-page PDF you can download or share." },
    ],
    tips: [
      "Use a dark, contrasting surface behind white paper so edge detection finds the corners.",
      "Black & White mode makes text documents far smaller — great for emailing.",
    ],
    updated: "2026-06-16",
  },
  {
    slug: "compress-pdf-for-email",
    title: "How to Compress a PDF So It's Small Enough to Email",
    description:
      "Most email limits are 20–25MB. Here's how to shrink a large PDF in your browser so it sends without bouncing — in three clicks, no signup.",
    tool: { href: "/compress-pdf", label: "Open the Compress tool" },
    intro:
      "Hit an 'attachment too large' error? PDFs balloon when they contain scanned pages or high-resolution images. Compressing re-encodes those pages at a sensible quality so the file fits common 20–25MB email limits.",
    steps: [
      { title: "Open the compressor", body: "Go to the Compress PDF tool and drop in your file. Everything runs locally — your document isn't uploaded." },
      { title: "Pick a level", body: "Start with Balanced. Choose Strong for the smallest file (best for scans), or Light to preserve maximum quality." },
      { title: "Compress and check", body: "Run it and review the before/after size. If it's still too big, try a stronger level." },
      { title: "Download or share", body: "Download the smaller PDF, or create a 1-hour share link to send a download instead of an attachment." },
    ],
    tips: [
      "Compression flattens pages to images, so selectable text becomes non-selectable — run OCR afterwards if you need it searchable again.",
      "If your file is mostly text, it may already be small; a stronger level helps most with image-heavy scans.",
    ],
    updated: "2026-06-16",
  },
  {
    slug: "make-a-scanned-pdf-searchable",
    title: "How to Make a Scanned PDF Searchable (OCR)",
    description:
      "A scanned PDF is just images — you can't search or copy the text. Here's how to add a searchable text layer with OCR, free and in your browser.",
    tool: { href: "/ocr-pdf", label: "Open the OCR tool" },
    intro:
      "When you scan a document, the result is a picture of the page — so Ctrl+F finds nothing and you can't copy a sentence. OCR (optical character recognition) reads the image and adds an invisible, selectable text layer behind it.",
    steps: [
      { title: "Open the OCR tool", body: "Go to the OCR PDF tool and upload your scanned PDF." },
      { title: "Choose the language", body: "Pick the document's language for the best accuracy. Recognition runs in your browser; the first run downloads a small language file." },
      { title: "Run recognition", body: "Process the file. DocuScan rebuilds it as a searchable PDF with an invisible text layer, and also gives you the plain text to copy or download." },
      { title: "Save the result", body: "Download the searchable PDF — now Ctrl+F and copy/paste work everywhere." },
    ],
    tips: [
      "Sharper, higher-contrast scans OCR far more accurately — use Black & White when scanning.",
      "OCR is great before compressing, since compression removes any existing text layer.",
    ],
    updated: "2026-06-16",
  },
  {
    slug: "password-protect-a-pdf",
    title: "How to Password-Protect a PDF (Free, In Your Browser)",
    description:
      "Add a password so a PDF can't be opened without it — done entirely in your browser, so the file is never uploaded. No signup required.",
    tool: { href: "/protect-pdf", label: "Open the Protect tool" },
    intro:
      "Sending something sensitive — a contract, an ID, a payslip? Encrypting the PDF with a password means only someone with that password can open it. DocuScan does this locally, so your document and password never touch a server.",
    steps: [
      { title: "Open the Protect tool", body: "Go to Protect PDF and upload the file you want to secure." },
      { title: "Set a strong password", body: "Choose a password you can share with the recipient through a separate channel (not in the same email)." },
      { title: "Encrypt and download", body: "Apply protection and download. The new PDF will prompt for the password in any viewer." },
      { title: "Need to remove it later?", body: "Use the Unlock PDF tool with the password to produce an unprotected copy of a file you own." },
    ],
    tips: [
      "Never send the password in the same message as the file — text or tell it separately.",
      "For consumer 'require a password to open' this is ideal; enforced permissions/AES-256 are on our roadmap.",
    ],
    updated: "2026-06-16",
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
