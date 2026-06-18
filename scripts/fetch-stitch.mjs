// One-off: pull all Stitch screens (code + screenshots) for the DocuScan project.
// Usage: node scripts/fetch-stitch.mjs
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ENDPOINT = "https://stitch.googleapis.com/mcp";
const API_KEY = process.env.STITCH_API_KEY;
const PROJECT_ID = "904738707422753686";
const OUT = "stitch-export";

if (!API_KEY) {
  console.error("Set STITCH_API_KEY env var first.");
  process.exit(1);
}

let rpcId = 1;
async function rpc(method, params) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "X-Goog-Api-Key": API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: rpcId++, method, params }),
  });
  const text = await res.text();
  // Server may answer as plain JSON or SSE (data: lines). Handle both.
  let body = text.trim();
  if (body.startsWith("event:") || body.startsWith("data:")) {
    body = body
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .join("");
  }
  return JSON.parse(body);
}

function unwrap(result) {
  // tools/call results: prefer structuredContent, else parse content[].text JSON.
  if (result?.structuredContent) return result.structuredContent;
  const txt = result?.content?.find((c) => c.type === "text")?.text;
  if (txt) {
    try {
      return JSON.parse(txt);
    } catch {
      return { _raw: txt };
    }
  }
  return result;
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/docuscan/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

async function download(url, dest) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  return buf.length;
}

const main = async () => {
  console.log("→ tools/call list_screens");
  const r = await rpc("tools/call", {
    name: "list_screens",
    arguments: { projectId: PROJECT_ID },
  });
  if (r.error) throw new Error(JSON.stringify(r.error));
  const data = unwrap(r.result);
  const screens = data.screens || [];
  console.log(`  ${screens.length} entries returned`);

  await mkdir(OUT, { recursive: true });
  const manifest = [];
  let idx = 0;

  for (const s of screens) {
    idx++;
    const id = s.name?.split("/").pop() || `entry-${idx}`;
    const title = s.title || id;
    const device = (s.deviceType || "asset").toLowerCase();
    const dirName = `${String(idx).padStart(2, "0")}-${slugify(title) || "untitled"}-${device}`;
    const dir = join(OUT, dirName);
    await mkdir(dir, { recursive: true });

    const entry = {
      idx,
      id,
      title,
      device,
      width: s.width,
      height: s.height,
      dir: dirName,
      files: {},
    };

    const htmlUrl = s.htmlCode?.downloadUrl;
    if (htmlUrl) {
      try {
        const n = await download(htmlUrl, join(dir, "code.html"));
        entry.files.html = `${dirName}/code.html`;
        console.log(`  ✓ ${dirName}/code.html (${n}b)`);
      } catch (e) {
        console.log(`  ✗ ${dirName}/code.html — ${e.message}`);
      }
    }
    const shotUrl = s.screenshot?.downloadUrl;
    if (shotUrl) {
      try {
        const n = await download(shotUrl, join(dir, "screenshot.png"));
        entry.files.screenshot = `${dirName}/screenshot.png`;
        console.log(`  ✓ ${dirName}/screenshot.png (${(n / 1024) | 0}kb)`);
      } catch (e) {
        console.log(`  ✗ ${dirName}/screenshot.png — ${e.message}`);
      }
    }
    manifest.push(entry);
  }

  // Also try to capture the design system definition.
  try {
    console.log("→ tools/call list_design_systems");
    const ds = await rpc("tools/call", {
      name: "list_design_systems",
      arguments: { projectId: PROJECT_ID },
    });
    if (!ds.error) {
      await writeFile(
        join(OUT, "design-systems.json"),
        JSON.stringify(unwrap(ds.result), null, 2),
      );
      console.log("  ✓ design-systems.json");
    } else {
      console.log("  ✗ list_design_systems —", JSON.stringify(ds.error));
    }
  } catch (e) {
    console.log("  ✗ design systems —", e.message);
  }

  await writeFile(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`\nDone. ${manifest.length} screens → ${OUT}/manifest.json`);
};

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
