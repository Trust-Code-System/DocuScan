export const metadata = { title: "Terms of Use" };

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">Terms of Use</h1>
      <p className="mt-4 text-muted">
        By using DocuScan you agree to use it lawfully and not to upload content you do not have the
        right to process. This is an early MVP provided “as is”, without warranty.
      </p>

      <div className="mt-6 space-y-4 text-muted">
        <p>
          <span className="font-semibold text-ink">Fair use.</span> Free guest usage is limited to
          a small number of tasks per day to keep the service fast for everyone.
        </p>
        <p>
          <span className="font-semibold text-ink">No abuse.</span> Do not use the service to
          process malware, illegal content, or to attempt to overload the system.
        </p>
        <p>
          <span className="font-semibold text-ink">Availability.</span> As an MVP, features may
          change and downtime may occur. A full Terms document will follow before public launch.
        </p>
      </div>
    </article>
  );
}
