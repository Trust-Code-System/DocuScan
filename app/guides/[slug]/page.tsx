import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GUIDES, getGuide } from "@/lib/guides";
import { SITE_URL } from "@/lib/seo";

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return {};
  const url = `${SITE_URL}/guides/${slug}`;
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: url },
    openGraph: {
      title: `${guide.title} | DocuScan`,
      description: guide.description,
      url,
      siteName: "DocuScan",
      type: "article",
    },
  };
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  // HowTo structured data for rich results.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: guide.title,
    description: guide.description,
    step: guide.steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.title,
      text: s.body,
    })),
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 prose-docuscan">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <p className="text-sm text-muted">
        <Link href="/guides" className="text-brand-600 hover:underline">
          Guides
        </Link>{" "}
        / {guide.title}
      </p>
      <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{guide.title}</h1>
      <p className="mt-3 text-muted">{guide.intro}</p>

      <div className="mt-6">
        <Link
          href={guide.tool.href}
          className="inline-block rounded-xl bg-brand-500 px-5 py-2.5 font-semibold text-white hover:bg-brand-600"
        >
          {guide.tool.label}
        </Link>
      </div>

      <ol className="mt-8 space-y-4">
        {guide.steps.map((s, i) => (
          <li key={i} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="font-semibold text-ink">
              {i + 1}. {s.title}
            </p>
            <p className="mt-1 text-muted">{s.body}</p>
          </li>
        ))}
      </ol>

      {guide.tips && guide.tips.length > 0 && (
        <div className="mt-8">
          <h2 className="font-semibold text-ink">Tips</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            {guide.tips.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-10 rounded-xl bg-brand-50 p-4 text-center">
        <p className="font-semibold text-ink">Ready to try it?</p>
        <Link
          href={guide.tool.href}
          className="mt-3 inline-block rounded-xl bg-brand-500 px-5 py-2.5 font-semibold text-white hover:bg-brand-600"
        >
          {guide.tool.label}
        </Link>
      </div>
    </article>
  );
}
