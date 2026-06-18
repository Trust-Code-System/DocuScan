import { NextRequest, NextResponse } from "next/server";
import { download, revoke, getStatus } from "@/lib/share";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/ratelimit";

// Minimal, self-contained password prompt served straight from the API route
// so a protected link works in any browser without a separate page. The form
// re-submits the password as `?pw=` to this same URL.
function passwordPrompt(id: string, wrong: boolean): NextResponse {
  const action = `/api/share/${encodeURIComponent(id)}`;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>Protected link · DocuScan</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100vh; display:grid; place-items:center;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    background:#f8fafc; color:#0f172a; }
  .card { width:min(92vw,360px); background:#fff; border:1px solid #e2e8f0;
    border-radius:16px; padding:24px; box-shadow:0 1px 3px rgba(0,0,0,.06); }
  h1 { font-size:18px; margin:0 0 4px; }
  p { font-size:14px; color:#64748b; margin:0 0 16px; }
  input { width:100%; box-sizing:border-box; padding:10px 12px; font-size:15px;
    border:1px solid #cbd5e1; border-radius:10px; margin-bottom:12px; }
  button { width:100%; padding:10px 12px; font-size:15px; font-weight:600;
    color:#fff; background:#4f46e5; border:0; border-radius:10px; cursor:pointer; }
  .err { color:#dc2626; font-size:13px; margin:0 0 12px; }
</style></head>
<body><form class="card" method="get" action="${action}">
  <h1>🔒 Password required</h1>
  <p>This DocuScan link is protected. Enter its password to view the file.</p>
  ${wrong ? '<p class="err">Incorrect password. Please try again.</p>' : ""}
  <input type="password" name="pw" placeholder="Password" autofocus required />
  <button type="submit">Open file</button>
</form></body></html>`;
  return new NextResponse(html, {
    status: 401,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

// GET — download a shared PDF (enforcing password / limit / revoke), OR return
// owner-facing JSON status when called with `?token=<manageToken>`.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Guard against link-enumeration / scraping: 60 downloads / minute / IP.
  const rl = await rateLimit(`share-get:${clientIp(req)}`, { limit: 60, windowSec: 60 });
  if (!rl.allowed) return tooManyRequests(rl);

  const { id } = await params;
  const sp = req.nextUrl.searchParams;

  // Owner status check (no bytes) — used by the share UI to show the counter.
  const token = sp.get("token");
  if (token) {
    const status = await getStatus(id, token);
    if (!status) {
      return NextResponse.json(
        { error: "Not found, or invalid manage token." },
        { status: 404 },
      );
    }
    return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
  }

  const pw = sp.get("pw") ?? undefined;
  const result = await download(id, pw);

  if (result.ok) {
    return new NextResponse(new Uint8Array(result.bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${result.fileName}"`,
        "Cache-Control": "no-store",
        ...(result.remaining != null
          ? { "X-Share-Remaining": String(result.remaining) }
          : {}),
      },
    });
  }

  switch (result.reason) {
    case "password-required":
      return passwordPrompt(id, false);
    case "bad-password":
      return passwordPrompt(id, true);
    case "revoked":
      return NextResponse.json(
        { error: "This link has been revoked by its owner." },
        { status: 410 },
      );
    case "limit-reached":
      return NextResponse.json(
        { error: "This link has reached its download limit." },
        { status: 410 },
      );
    default:
      return NextResponse.json(
        { error: "This link has expired or does not exist." },
        { status: 404 },
      );
  }
}

// DELETE — revoke a link. Requires the manage token (query `?token=` or a
// Bearer header) returned when the link was created.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rl = await rateLimit(`share-del:${clientIp(req)}`, { limit: 30, windowSec: 60 });
  if (!rl.allowed) return tooManyRequests(rl);

  const { id } = await params;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const token = req.nextUrl.searchParams.get("token") || bearer || "";
  if (!token) {
    return NextResponse.json({ error: "Missing manage token." }, { status: 400 });
  }

  const r = await revoke(id, token);
  if (r.ok) return NextResponse.json({ ok: true, revoked: true });
  return NextResponse.json(
    { error: r.reason === "not-found" ? "Link not found." : "Invalid manage token." },
    { status: r.reason === "not-found" ? 404 : 403 },
  );
}
