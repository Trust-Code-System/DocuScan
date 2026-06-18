/**
 * Derives a stable "owner id" for scaffolded workspace/folder features.
 *
 * Until real auth exists, we reuse the anonymous guest cookie (ds_guest, set by
 * /api/usage) as the owner key. When accounts ship, replace this with the
 * authenticated user id from the session — callers don't change.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

const COOKIE = "ds_guest";

export function ownerFrom(req: NextRequest): { ownerId: string; setId?: string } {
  const existing = req.cookies.get(COOKIE)?.value;
  if (existing) return { ownerId: existing };
  const id = randomBytes(12).toString("base64url");
  return { ownerId: id, setId: id };
}

export function withOwnerCookie(res: NextResponse, setId?: string): NextResponse {
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
