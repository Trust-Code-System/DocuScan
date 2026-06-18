import { NextRequest, NextResponse } from "next/server";
import { create, PUBLIC_TTL_MS } from "@/lib/share";
import { validateKey } from "@/lib/apikeys";
import { rateLimit, tooManyRequests } from "@/lib/ratelimit";
import { meter } from "@/lib/billing";
import {
  validatePdfUpload,
  safePdfName,
  parseMaxDownloads,
  sanitizeSharePassword,
} from "@/lib/serverValidation";

/**
 * Authenticated developer API: create a share link from raw PDF bytes.
 *
 *   POST /api/v1/share
 *   Authorization: Bearer ds_live_...
 *   Content-Type: application/pdf
 *   body: <pdf bytes>   ?name=<file>&public=1
 *
 * Per-key rate limiting (the key's rpm) + usage metering for billing. This is
 * the template for further /api/v1/* operations (compress, ocr, extract) once
 * those run server-side.
 */

export async function POST(req: NextRequest) {
  const key = await validateKey(req.headers.get("authorization"));
  if (!key) {
    return NextResponse.json(
      { error: "Invalid or missing API key. Send 'Authorization: Bearer ds_live_...'." },
      { status: 401 },
    );
  }

  // Per-key rate limit (requests per minute defined on the key).
  const rl = await rateLimit(`apikey:${key.id}`, { limit: key.rpm, windowSec: 60 });
  if (!rl.allowed) return tooManyRequests(rl);

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/pdf")) {
    return NextResponse.json({ error: "Expected application/pdf" }, { status: 415 });
  }

  const arrayBuffer = await req.arrayBuffer();
  const v = validatePdfUpload(arrayBuffer);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });

  const fileName = safePdfName(req.nextUrl.searchParams.get("name"));
  const isPublic = req.nextUrl.searchParams.get("public") === "1";
  const password = sanitizeSharePassword(req.headers.get("x-share-password"));
  const maxDownloads = parseMaxDownloads(req.headers.get("x-share-max-downloads"));

  const { id, expiresAt, manageToken } = await create(
    Buffer.from(arrayBuffer),
    fileName,
    { ttlMs: isPublic ? PUBLIC_TTL_MS : undefined, password, maxDownloads },
  );

  await meter(key.id, "share"); // usage-based billing seam

  return NextResponse.json({
    id,
    url: `${req.nextUrl.origin}/api/share/${id}`,
    expiresAt,
    public: isPublic,
    manageToken,
    passwordProtected: !!password,
    maxDownloads: maxDownloads ?? null,
  });
}
