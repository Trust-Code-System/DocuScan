import Link from "next/link";
import type { ReactNode } from "react";

type Action = {
  href: string;
  label: string;
  icon?: string;
};

export default function WorkspaceToolPage({
  eyebrow,
  title,
  description,
  primary,
  secondary,
  steps,
  capabilities,
  note,
  ai = false,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  /** Primary CTA. Omit when a tool is embedded inline via `children`. */
  primary?: Action;
  secondary?: Action;
  steps: string[];
  capabilities: string[];
  note?: string;
  ai?: boolean;
  /**
   * When provided, the real tool is rendered inline below the intro instead of
   * the page linking away to it. The embedded tool brings its own layout
   * container, so it's rendered outside the narrow intro column.
   */
  children?: ReactNode;
}) {
  const embedded = Boolean(children);

  return (
    <>
      <div className="mx-auto max-w-5xl px-4 pt-10">
        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-brand-100 px-2 py-1 text-xs font-bold uppercase tracking-wide text-brand-700">
                {eyebrow}
              </span>
              {ai && (
                <span className="rounded-md bg-ai-100 px-2 py-1 text-xs font-bold uppercase tracking-wide text-ai-700">
                  AI
                </span>
              )}
            </div>
            <h1 className="max-w-3xl text-balance text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              {title}
            </h1>
            <p className="mt-4 max-w-2xl text-pretty text-lg leading-relaxed text-slate-600">
              {description}
            </p>
            {(primary || secondary) && (
              <div className="mt-7 flex flex-wrap gap-3">
                {/* When embedded, the tool is right below — no need for a primary nav button. */}
                {!embedded && primary && (
                  <Link
                    href={primary.href}
                    className="press inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-3 font-semibold text-white shadow-sm shadow-brand-500/20 transition-colors duration-150 hover:bg-brand-600"
                  >
                    <span className="material-symbols-outlined text-xl" aria-hidden>
                      {primary.icon ?? "arrow_forward"}
                    </span>
                    {primary.label}
                  </Link>
                )}
                {secondary && (
                  <Link
                    href={secondary.href}
                    className="press inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-ink transition-colors duration-150 hover:bg-slate-50"
                  >
                    <span className="material-symbols-outlined text-xl" aria-hidden>
                      {secondary.icon ?? "open_in_new"}
                    </span>
                    {secondary.label}
                  </Link>
                )}
              </div>
            )}
            {note && (
              <p className="mt-4 max-w-2xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
                {note}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <div className="mb-4 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-700">
                <span className="material-symbols-outlined" aria-hidden>
                  checklist
                </span>
              </span>
              <h2 className="font-semibold text-ink">Workspace flow</h2>
            </div>
            <ol className="space-y-3">
              {steps.map((step, index) => (
                <li key={step} className="flex gap-3 text-sm leading-relaxed text-slate-600">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>

      {embedded && (
        <section aria-label="Tool" className="mt-8 border-t border-slate-200 pt-2">
          {children}
        </section>
      )}

      <div className="mx-auto max-w-5xl px-4 pb-12 pt-10">
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
            Included capabilities
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4"
              >
                <span className="material-symbols-outlined mt-0.5 text-[20px] text-brand-600" aria-hidden>
                  check_circle
                </span>
                <p className="text-sm leading-relaxed text-slate-600">{item}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
