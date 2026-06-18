// Re-fetch Stitch screens and report which ones changed vs the local export.
// Usage: STITCH_API_KEY=... node scripts/diff-stitch.mjs
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const ENDPOINT = "https://stitch.googleapis.com/mcp";
const API_KEY = process.env.STITCH_API_KEY;
const PROJECT_ID = "904738707422753686";
const ROOT = "stitch-export";

if (!API_KEY) { console.error("Set STITCH_API_KEY."); process.exit(1); }

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
  let body = (await res.text()).trim();
  if (body.startsWith("event:") || body.startsWith("data:")) {
    body = body.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("");
  }
  return JSON.parse(body);
}
function unwrap(result) {
  if (result?.structuredContent) return result.structuredContent;
  const txt = result?.content?.find((c) => c.type === "text")?.text;
  if (txt) { try { return JSON.parse(txt); } catch { return {}; } }
  return result || {};
}
const slugify = (s) => s.toLowerCase().replace(/docuscan/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

async function listScreensRetry() {
  for (let i = 0; i < 6; i++) {
    const r = await rpc("tools/call", { name: "list_screens", arguments: { projectId: PROJECT_ID } });
    const screens = unwrap(r.result).screens || [];
    if (screens.length) return screens;
    await new Promise((res) => setTimeout(res, 1500));
  }
  return [];
}

// Map existing export folders by trailing key (strip "NN-" prefix).
const oldByKey = {};
for (const d of readdirSync(ROOT)) {
  const p = join(ROOT, d);
  if (statSync(p).isDirectory()) oldByKey[d.replace(/^\d+-/, "")] = d;
}

const screens = await listScreensRetry();
if (!screens.length) { console.error("No screens returned (rate limited?). Try again."); process.exit(1); }

const changed = [];
for (const s of screens) {
  const title = s.title || "untitled";
  const device = (s.deviceType || "asset").toLowerCase();
  const key = `${slugify(title) || "untitled"}-${device}`;
  const htmlUrl = s.htmlCode?.downloadUrl;
  if (!htmlUrl) continue;

  const newHtml = await (await fetch(htmlUrl, { redirect: "follow" })).text();
  const oldDir = oldByKey[key];
  const oldPath = oldDir ? join(ROOT, oldDir, "code.html") : null;
  const oldHtml = oldPath && existsSync(oldPath) ? readFileSync(oldPath, "utf8") : null;

  if (oldHtml === null) {
    changed.push({ key, title, status: "NEW", bytes: newHtml.length });
  } else if (oldHtml !== newHtml) {
    changed.push({ key, title, status: "CHANGED", delta: newHtml.length - oldHtml.length, oldPath });
    writeFileSync(oldPath, newHtml); // update local copy to latest
  }
}

if (!changed.length) {
  console.log("No changes — local export already matches Stitch.");
} else {
  console.log(`Changed screens (${changed.length}):`);
  for (const c of changed) {
    console.log(`  • ${c.status.padEnd(7)} ${c.title}  [${c.key}]` + (c.delta != null ? `  (${c.delta > 0 ? "+" : ""}${c.delta} bytes; updated on disk)` : ""));
  }
}
