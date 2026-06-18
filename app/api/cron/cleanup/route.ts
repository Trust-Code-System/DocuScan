import { NextRequest, NextResponse } from "next/server";
import { purgeExpired } from "@/lib/share";

/**
 * Expired-file cleanup cron.
 *
 * Deletes share-link payloads whose 1-hour TTL has passed. The in-memory
 * backend already sweeps on access, but a scheduled purge guarantees stale
 * bytes don't linger when traffic is quiet; the S3 backend relies on this
 * (plus a bucket lifecycle rule) to actively reclaim storage.
 *
 * Schedule it however you deploy:
 *   - Vercel Cron: add to vercel.json → { "crons": [{ "path": "/api/cron/cleanup",
 *     "schedule": "*\/15 * * * *" }] } (Vercel sends an authorized request).
 *   - External cron / uptime pinger: GET this URL with
 *     `Authorization: Bearer $CRON_SECRET` or `?key=$CRON_SECRET`.
 *
 * Protected by CRON_SECRET. If CRON_SECRET is unset, the endpoint is disabled
 * (returns 503) so it can never be triggered anonymously in production.
 */

export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  // Vercel Cron sends this header automatically on scheduled invocations.
  if (req.headers.get("x-vercel-cron")) return true;
  if (req.nextUrl.searchParams.get("key") === secret) return true;
  return false;
}

async function handle(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "Cleanup cron is disabled (CRON_SECRET not set)." },
      { status: 503 },
    );
  }
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const removed = await purgeExpired();
  return NextResponse.json({ ok: true, removed, ranAt: new Date().toISOString() });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

// POST supported too, for cron providers that prefer it.
export async function POST(req: NextRequest) {
  return handle(req);
}
