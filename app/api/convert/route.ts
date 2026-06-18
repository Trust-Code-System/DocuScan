import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/ratelimit";

/**
 * High-fidelity Office conversion seam (roadmap §8).
 *
 * In-browser conversions (lib/convert.ts) cover most needs privately, but
 * pixel-perfect Office ↔ PDF (DOCX/PPTX/XLSX) really wants a real office engine.
 * This route forwards the uploaded file to a self-hosted converter — e.g.
 * Gotenberg (https://gotenberg.dev) or a LibreOffice/unoconv service — and
 * streams the result back. It's inert (503) until CONVERT_SERVICE_URL is set, so
 * the rest of the app ships without it.
 *
 *   GET  /api/convert            → { enabled }   (UI capability probe)
 *   POST /api/convert (multipart: file, target)  → converted bytes
 *
 * Env (.env.example):
 *   CONVERT_SERVICE_URL    base URL of the converter (e.g. http://gotenberg:3000)
 *   CONVERT_SERVICE_TOKEN  optional bearer token sent as Authorization
 *
 * NOTE: the exact upstream contract varies by service; the default below targets
 * Gotenberg's LibreOffice route (→ PDF). Adjust `upstreamRequest` for yours.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

function serviceEnabled(): boolean {
  return !!process.env.CONVERT_SERVICE_URL;
}

function localWordEnabled(): boolean {
  return process.platform === "win32";
}

function enabled(): boolean {
  return serviceEnabled() || localWordEnabled();
}

export async function GET() {
  return NextResponse.json(
    { enabled: enabled(), service: serviceEnabled(), localWord: localWordEnabled() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: NextRequest) {
  if (!serviceEnabled() && !localWordEnabled()) {
    return NextResponse.json(
      {
        error:
          "High-fidelity Office conversion isn't enabled on this server. Most conversions run " +
          "in your browser; set CONVERT_SERVICE_URL (e.g. a Gotenberg instance) to enable this one.",
      },
      { status: 503 },
    );
  }

  const rl = await rateLimit(`convert:${clientIp(req)}`, { limit: 10, windowSec: 300 });
  if (!rl.allowed) return tooManyRequests(rl);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart form upload." }, { status: 400 });
  }
  const file = form.get("file");
  const target = String(form.get("target") || "pdf").toLowerCase();
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File is too large (max 25 MB)." }, { status: 413 });
  }
  if (!/^[a-z0-9]{2,5}$/.test(target)) {
    return NextResponse.json({ error: "Invalid target format." }, { status: 400 });
  }

  try {
    if (serviceEnabled()) {
      const upstream = await upstreamRequest(file, target);
      if (!upstream.ok) {
        const detail = await upstream.text().catch(() => "");
        return NextResponse.json(
          { error: `Conversion service error (${upstream.status}).`, detail: detail.slice(0, 300) },
          { status: 502 },
        );
      }
      const buf = await upstream.arrayBuffer();
      const contentType = upstream.headers.get("content-type") || "application/octet-stream";
      const base = file.name.replace(/\.[^.]+$/, "") || "converted";
      return new Response(buf, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${base}.${target}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const buf = await convertWithMicrosoftWord(file, target);
    const base = file.name.replace(/\.[^.]+$/, "") || "converted";
    return new Response(buf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${base}.${target}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not reach the conversion service." },
      { status: 502 },
    );
  }
}

/**
 * Forward to the converter. Default shape targets Gotenberg's LibreOffice route
 * (POST {base}/forms/libreoffice/convert, multipart "files", returns PDF). For a
 * different engine, change the URL/field names here.
 */
async function upstreamRequest(file: File, target: string): Promise<Response> {
  const base = process.env.CONVERT_SERVICE_URL!.replace(/\/$/, "");
  const token = process.env.CONVERT_SERVICE_TOKEN;
  const url = `${base}/forms/libreoffice/convert`;

  const fd = new FormData();
  fd.append("files", file, file.name);
  // Gotenberg infers the output (PDF) from the route; `target` is forwarded for
  // engines that support arbitrary output formats.
  fd.append("target", target);

  return fetch(url, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: fd,
  });
}

async function convertWithMicrosoftWord(file: File, target: string): Promise<Buffer> {
  if (target !== "pdf") {
    throw new Error("Local Microsoft Word conversion only supports PDF output.");
  }
  if (!/\.(docx?|rtf)$/i.test(file.name)) {
    throw new Error("Local Microsoft Word conversion only supports Word documents.");
  }

  const dir = join(tmpdir(), `docuscan-convert-${randomUUID()}`);
  const ext = file.name.match(/\.[^.]+$/)?.[0] || ".docx";
  const input = join(dir, `input${ext}`);
  const output = join(dir, "output.pdf");
  const script = join(dir, "convert.ps1");

  await mkdir(dir, { recursive: true });
  try {
    await writeFile(input, Buffer.from(await file.arrayBuffer()));
    await writeFile(
      script,
      `
param([string]$InputPath, [string]$OutputPath)
$ErrorActionPreference = "Stop"
$word = $null
$doc = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $doc = $word.Documents.Open($InputPath, $false, $true)
  $doc.ExportAsFixedFormat($OutputPath, 17)
} finally {
  if ($doc -ne $null) {
    $doc.Close($false)
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc)
  }
  if ($word -ne $null) {
    $word.Quit()
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($word)
  }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
`.trim(),
      "utf8",
    );

    await runPowerShell(script, input, output);
    return await readFile(output);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runPowerShell(script: string, input: string, output: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, input, output],
      { windowsHide: true },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else {
        const detail = (stderr || stdout || "No details returned.").slice(0, 500);
        reject(new Error(`Microsoft Word conversion failed${code == null ? "" : ` (${code})`}: ${detail}`));
      }
    });
  });
}
