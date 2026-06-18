import { NextRequest, NextResponse } from "next/server";
import { saveFeedback } from "@/lib/feedback";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/ratelimit";

// POST { message, email?, source? } — store one feedback submission.
export async function POST(req: NextRequest) {
  // Spam guard: 5 submissions / 10 minutes / IP.
  const rl = await rateLimit(`feedback:${clientIp(req)}`, { limit: 5, windowSec: 600 });
  if (!rl.allowed) return tooManyRequests(rl);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { message, email, source } = (body ?? {}) as Record<string, unknown>;
  try {
    await saveFeedback({ message, email, source });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not save feedback.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
