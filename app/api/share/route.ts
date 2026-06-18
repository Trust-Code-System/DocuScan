import { NextRequest, NextResponse } from "next/server";
import { create, PUBLIC_TTL_MS } from "@/lib/share";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/ratelimit";
import {
  validatePdfUpload,
  safePdfName,
  parseMaxDownloads,
  sanitizeSharePassword,
} from "@/lib/serverValidation";

// POST raw PDF bytes (application/pdf). Returns a temporary share id + URL.
export async function POST(req: NextRequest) {
  // Uploads are the most expensive endpoint (bytes + storage): 10 / minute / IP.
  const rl = await rateLimit(`share:${clientIp(req)}`, { limit: 10, windowSec: 60 });
  if (!rl.allowed) return tooManyRequests(rl);

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/pdf")) {
    return NextResponse.json({ error: "Expected application/pdf" }, { status: 415 });
  }

  const arrayBuffer = await req.arrayBuffer();
  // Re-validate on the server (client checks are bypassable): size + PDF magic.
  const v = validatePdfUpload(arrayBuffer);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });

  const fileName = safePdfName(req.nextUrl.searchParams.get("name"));

  // "public" links live 7 days (for QR/WhatsApp sharing); default is 1 hour.
  const isPublic = req.nextUrl.searchParams.get("public") === "1";
  // Optional protections via headers (kept out of the URL so they don't end up
  // in logs/referrers): a viewing password and a download limit.
  const password = sanitizeSharePassword(req.headers.get("x-share-password"));
  const maxDownloads = parseMaxDownloads(req.headers.get("x-share-max-downloads"));

  const { id, expiresAt, manageToken } = await create(
    Buffer.from(arrayBuffer),
    fileName,
    { ttlMs: isPublic ? PUBLIC_TTL_MS : undefined, password, maxDownloads },
  );
  const origin = req.nextUrl.origin;

  return NextResponse.json({
    id,
    url: `${origin}/api/share/${id}`,
    expiresAt,
    public: isPublic,
    // Returned ONCE — the caller must keep it to revoke or inspect the link.
    manageToken,
    passwordProtected: !!password,
    maxDownloads: maxDownloads ?? null,
  });
}
