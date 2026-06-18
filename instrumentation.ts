/**
 * Server-side instrumentation hook (Next.js).
 *
 * `register` runs once at server startup; `onRequestError` fires for unhandled
 * errors in server components, route handlers, and middleware. We always log to
 * server output, and — when SENTRY_DSN is set — initialise the Sentry Node SDK
 * and forward exceptions to it.
 *
 * Split by design: CLIENT errors are captured by the Sentry browser Loader in
 * components/Analytics.tsx (CDN, consent-gated, zero bundle weight). This file
 * is the SERVER half only, so we do NOT add Sentry client/edge config or wrap
 * next.config — keeping First Load JS untouched. Everything stays dormant until
 * SENTRY_DSN is present, so dev/unconfigured builds ship nothing.
 */

export async function register(): Promise<void> {
  if (process.env.SENTRY_DSN && process.env.NEXT_RUNTIME === "nodejs") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      // Errors only — no performance tracing overhead unless you opt in later.
      tracesSampleRate: 0,
      environment: process.env.NODE_ENV,
    });
  }
}

export async function onRequestError(
  err: unknown,
  request: { path?: string; method?: string },
): Promise<void> {
  const path = request?.path ?? "?";
  const method = request?.method ?? "?";
  console.error(`[server-error] ${method} ${path}:`, err);

  if (process.env.SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureException(err);
  }
}
