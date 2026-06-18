import { UNIT_COST } from "@/lib/billing";
import { SITE_URL } from "@/lib/seo";

export const metadata = {
  title: "Developer API",
  description:
    "DocuScan's developer API: create share links programmatically with an API key. Per-key rate limits and usage-based billing.",
};

export default function DevelopersPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 prose-docuscan">
      <h1 className="text-2xl font-bold">Developer API</h1>
      <p className="mt-4 text-muted">
        Integrate DocuScan into your own apps. Authenticate with an API key, and
        every call is rate-limited per key and metered for usage-based billing.
        <span className="block text-sm">
          (Beta — endpoints expand as more tools move server-side.)
        </span>
      </p>

      <Section title="Get an API key">
        Keys are minted by an admin today (move to the dashboard once accounts
        ship). A key looks like <Code>ds_live_…</Code> and is shown only once.
        Send it as a bearer token on every request.
      </Section>

      <Section title="Create a share link">
        <Code block>{`curl -X POST "${SITE_URL}/api/v1/share?name=invoice.pdf&public=1" \\
  -H "Authorization: Bearer ds_live_xxx" \\
  -H "Content-Type: application/pdf" \\
  --data-binary @invoice.pdf`}</Code>
        <p className="mt-2 text-muted">
          Returns <Code>{`{ id, url, expiresAt, public }`}</Code>. Public links
          live 7 days; otherwise 1 hour. Uploads are validated (PDF + size).
        </p>
      </Section>

      <Section title="Rate limits">
        Each key has a requests-per-minute limit (default 60). Over the limit
        returns <Code>429</Code> with a <Code>Retry-After</Code> header.
      </Section>

      <Section title="Usage">
        The API is free while in beta — there's no billing or signup. We do count
        usage per operation (for capacity planning), in relative units:
        <ul className="mt-2 list-disc pl-5 text-muted">
          {Object.entries(UNIT_COST).map(([op, cost]) => (
            <li key={op}>
              <Code>{op}</Code> — {cost} unit{cost > 1 ? "s" : ""}
            </li>
          ))}
        </ul>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h2 className="font-semibold text-ink">{title}</h2>
      <div className="mt-1 text-muted">{children}</div>
    </div>
  );
}

function Code({ children, block }: { children: React.ReactNode; block?: boolean }) {
  if (block)
    return (
      <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
        <code>{children}</code>
      </pre>
    );
  return (
    <code className="rounded bg-slate-100 px-1 py-0.5 text-sm text-ink">{children}</code>
  );
}
