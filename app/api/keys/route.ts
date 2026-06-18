import { NextRequest, NextResponse } from "next/server";
import { issueKey, listKeys } from "@/lib/apikeys";

/**
 * API key administration. Admin-gated by ADMIN_API_SECRET (returns 503 if
 * unset, 401 if wrong) — until the auth + admin dashboard lands, this is how
 * keys are minted. Once accounts exist, move issuance behind the user session.
 *
 *   POST { label, rpm? }  -> { key, id }   (the raw key is shown ONCE)
 *   GET                   -> [{ id, label, createdAt, rpm }]  (metadata only)
 */

export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_API_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function guard(req: NextRequest): NextResponse | null {
  if (!process.env.ADMIN_API_SECRET)
    return NextResponse.json({ error: "Key admin disabled (ADMIN_API_SECRET unset)." }, { status: 503 });
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}

export async function POST(req: NextRequest) {
  const blocked = guard(req);
  if (blocked) return blocked;
  let body: { label?: string; rpm?: number } = {};
  try {
    body = await req.json();
  } catch {
    /* allow empty body */
  }
  const { key, id } = await issueKey(body.label || "untitled", body.rpm ?? 60);
  return NextResponse.json({
    key,
    id,
    note: "Store this key now — it won't be shown again.",
  });
}

export async function GET(req: NextRequest) {
  const blocked = guard(req);
  if (blocked) return blocked;
  const keys = await listKeys();
  return NextResponse.json(
    keys.map(({ id, label, createdAt, rpm }) => ({ id, label, createdAt, rpm })),
  );
}
