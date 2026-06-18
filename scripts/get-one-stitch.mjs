// Download a single Stitch screen by title match.
// Usage: STITCH_API_KEY=... node scripts/get-one-stitch.mjs "All Tools - DocuScan (Redesign)"
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ENDPOINT = "https://stitch.googleapis.com/mcp";
const API_KEY = process.env.STITCH_API_KEY;
const PROJECT_ID = "904738707422753686";
const TITLE = process.argv[2];

let rpcId = 1;
async function rpc(method, params) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "X-Goog-Api-Key": API_KEY, "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: rpcId++, method, params }),
  });
  let b = (await res.text()).trim();
  if (b.startsWith("event:") || b.startsWith("data:")) b = b.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("");
  return JSON.parse(b);
}
const unwrap = (r) => r?.structuredContent || (r?.content?.find((c) => c.type === "text") ? JSON.parse(r.content.find((c) => c.type === "text").text) : r);

let screens = [];
for (let i = 0; i < 6 && !screens.length; i++) {
  const r = await rpc("tools/call", { name: "list_screens", arguments: { projectId: PROJECT_ID } });
  screens = unwrap(r.result).screens || [];
  if (!screens.length) await new Promise((res) => setTimeout(res, 1500));
}
const s = screens.find((x) => x.title === TITLE);
if (!s) { console.error("Not found:", TITLE, "\nAvailable:", screens.map((x) => x.title)); process.exit(1); }

const dir = join("stitch-export", "all-tools-redesign-desktop");
mkdirSync(dir, { recursive: true });
if (s.htmlCode?.downloadUrl) {
  const html = await (await fetch(s.htmlCode.downloadUrl)).text();
  writeFileSync(join(dir, "code.html"), html);
  console.log("saved code.html", html.length, "bytes ->", join(dir, "code.html"));
}
if (s.screenshot?.downloadUrl) {
  const buf = Buffer.from(await (await fetch(s.screenshot.downloadUrl)).arrayBuffer());
  writeFileSync(join(dir, "screenshot.png"), buf);
  console.log("saved screenshot.png", (buf.length / 1024) | 0, "kb");
}
console.log("device:", s.deviceType, "size:", s.width + "x" + s.height);
