import { NextRequest, NextResponse } from "next/server";
import { newReferralCode, recordVisit, referralStats } from "@/lib/referral";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/ratelimit";

/**
 * Referral endpoints.
 *   GET                  -> { code } (mint a new shareable code)
 *   GET ?code=CODE       -> { code, visits, conversions } (stats)
 *   POST { code }        -> record a visit (called when a ?ref= link is opened)
 *
 * Conversions attach once accounts/signup exist (recordConversion at signup).
 */

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (code) return NextResponse.json(await referralStats(code));
  return NextResponse.json({ code: newReferralCode() });
}

export async function POST(req: NextRequest) {
  const rl = await rateLimit(`ref:${clientIp(req)}`, { limit: 20, windowSec: 60 });
  if (!rl.allowed) return tooManyRequests(rl);

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.code) return NextResponse.json({ error: "Missing code." }, { status: 400 });
  await recordVisit(body.code);
  return NextResponse.json({ ok: true });
}
