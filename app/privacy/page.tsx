export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 prose-docuscan">
      <h1 className="text-2xl font-bold">Privacy Policy</h1>
      <p className="mt-4 text-muted">
        DocuScan is built privacy-first. This summary describes how the current MVP handles your
        documents.
      </p>

      <Section title="Processing happens in your browser">
        Image-to-PDF conversion runs entirely on your device. Your photos are not uploaded to our
        servers to create a PDF.
      </Section>

      <Section title="Share links auto-delete">
        If you choose to create a share link, the PDF is stored temporarily and automatically
        deleted after 1 hour. We do not index or publish your files.
      </Section>

      <Section title="Guest usage">
        We keep a small anonymous counter (via a cookie) to enforce daily free limits and prevent
        abuse. It is not used to identify you.
      </Section>

      <Section title="No accounts yet">
        The MVP has no sign-up, so we collect no name, email, or password. This will change when
        optional accounts are added — with clear notice.
      </Section>

      <p className="mt-8 text-sm text-muted">
        Questions? Contact the DocuScan team. This document will be expanded into a full legal
        policy before public launch.
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
