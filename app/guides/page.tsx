import Link from "next/link";
import type { Metadata } from "next";
import { GUIDES } from "@/lib/guides";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Guides — How to Scan, Compress & Edit PDFs",
  description:
    "Short, practical how-to guides for scanning, compressing, OCR-ing, and protecting PDFs — all free and in your browser.",
  alternates: { canonical: `${SITE_URL}/guides` },
};

export default function GuidesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold sm:text-3xl">Guides</h1>
      <p className="mt-2 text-muted">
        Practical how-tos for getting documents done — no signup, all in your browser.
      </p>
      <div className="mt-6 grid gap-3">
        {GUIDES.map((g) => (
          <Link
            key={g.slug}
            href={`/guides/${g.slug}`}
            className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand-500 hover:shadow-sm"
          >
            <h2 className="font-semibold text-ink">{g.title}</h2>
            <p className="mt-1 text-sm text-muted">{g.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
