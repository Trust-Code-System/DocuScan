export const metadata = {
  title: "Security & Data Deletion",
  description:
    "How DocuScan protects your documents: in-browser processing, short-lived storage, rate limiting, and how to request data deletion.",
};

export default function SecurityPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 prose-docuscan">
      <h1 className="text-2xl font-bold">Security &amp; Data Deletion</h1>
      <p className="mt-4 text-muted">
        DocuScan is built privacy-first. Most tools never send your file anywhere —
        they run entirely in your browser. This page explains how we protect the
        small amount of data that does touch our servers, and how to have it removed.
      </p>

      <Section title="Processing happens on your device">
        Scanning, conversion, compression, OCR, signing, watermarking and
        password protection all run locally in your browser. Your documents are
        not uploaded to our servers to perform these tasks.
      </Section>

      <Section title="Share links are short-lived">
        If you choose to create a share link, the PDF is stored temporarily and
        automatically deleted after 1 hour. A scheduled cleanup job also actively
        purges anything expired. We never index, publish, or read your files.
      </Section>

      <Section title="Abuse protection">
        Every API endpoint is rate-limited per client to prevent scripted abuse,
        and uploads are validated server-side (type and size) — a spoofed file
        type or oversized payload is rejected before it is stored.
      </Section>

      <Section title="In transit & at rest">
        The production app is served over HTTPS. When share-link storage is
        enabled, files live in a private bucket (never publicly listable) and are
        served only through our app, behind expiry checks. Hardening on the
        roadmap before public launch: signed download URLs, encryption at rest,
        and upload virus scanning.
      </Section>

      <Section title="What we store about you">
        No accounts yet, so we collect no name, email, or password. We keep a
        small anonymous cookie counter to enforce daily free limits. If you opt in
        to analytics, we record privacy-friendly, aggregated usage events — no ad
        tracking and no selling of data. You can decline analytics at any time.
      </Section>

      <Section title="Requesting data deletion">
        Because guest files auto-delete within an hour and we hold no account
        data, there is usually nothing to remove. If you submitted feedback with
        an email, or want any record associated with you deleted, email{" "}
        <a href="mailto:privacy@docuscan.app" className="font-medium text-brand-600 underline">
          privacy@docuscan.app
        </a>{" "}
        from the address in question. We will confirm and complete deletion within
        30 days. To clear locally-stored preferences (consent, dismissed prompts),
        clear this site&apos;s data in your browser settings.
      </Section>

      <p className="mt-8 text-sm text-muted">
        Found a vulnerability? Please report it responsibly to{" "}
        <a href="mailto:security@docuscan.app" className="font-medium text-brand-600 underline">
          security@docuscan.app
        </a>{" "}
        and give us a reasonable window to fix it before disclosure. This page
        will be expanded into a full policy before public launch.
      </p>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h2 className="font-semibold text-ink">{title}</h2>
      <p className="mt-1 text-muted">{children}</p>
    </div>
  );
}
