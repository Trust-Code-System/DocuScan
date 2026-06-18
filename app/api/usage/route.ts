import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { peek, checkAndConsume } from "@/lib/usage";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/ratelimit";

const COOKIE = "ds_guest";

function guestKey(req: NextRequest): { key: string; setId?: string } {
  const existing = req.cookies.get(COOKIE)?.value;
  if (existing) return { key: existing };
  const id = randomBytes(12).toString("base64url");
  return { key: id, setId: id };
}

function withCookie(res: NextResponse, setId?: string) {
  if (setId) {
    res.cookies.set(COOKIE, setId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return res;
}

// GET — how many tasks the guest has left today.
export async function GET(req: NextRequest) {
  const { key, setId } = guestKey(req);
  return withCookie(NextResponse.json(await peek(key)), setId);
}

// POST — consume one task. Returns 429 when the daily limit is reached.
export async function POST(req: NextRequest) {
  // Anti-abuse cap on top of the daily quota: no more than 30 task-consume
  // calls per minute from one IP (protects against scripted hammering).
  const rl = await rateLimit(`usage:${clientIp(req)}`, { limit: 30, windowSec: 60 });
  if (!rl.allowed) return tooManyRequests(rl);

  const { key, setId } = guestKey(req);
  const result = await checkAndConsume(key);
  const res = NextResponse.json(result, { status: result.allowed ? 200 : 429 });
  return withCookie(res, setId);
}
