import { NextResponse } from "next/server";

/**
 * Health check for uptime monitoring (Better Stack, UptimeRobot, etc.).
 *
 * Point your monitor at GET /api/health and alert on non-200 or when the body's
 * `status` isn't "ok". Reports which production backends are wired (so a monitor
 * can also catch a missing-env misconfig in prod), without leaking secrets.
 *
 * Setup notes:
 *   - Better Stack → Monitors → HTTP, URL = https://<domain>/api/health,
 *     check every 1–3 min, expect status 200 + keyword "ok". Add an on-call /
 *     email / Slack escalation. Pair with a status page if you want public uptime.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const redis =
    !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;
  const shareObjectStore =
    !!process.env.S3_BUCKET &&
    !!process.env.S3_ACCESS_KEY_ID &&
    !!process.env.S3_SECRET_ACCESS_KEY;

  const backends = {
    usageRedis: redis,
    shareObjectStore,
    // Which backend share links actually use (mirrors the precedence in
    // lib/share.ts). "memory" is dev-only — it does NOT survive cold starts.
    shareStore: shareObjectStore ? "s3" : redis ? "redis" : "memory",
    cleanupCron: !!process.env.CRON_SECRET,
    analytics: !!process.env.NEXT_PUBLIC_POSTHOG_KEY,
    errorTracking: !!process.env.NEXT_PUBLIC_SENTRY_DSN || !!process.env.SENTRY_DSN,
  };

  return NextResponse.json(
    {
      status: "ok",
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      backends,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
