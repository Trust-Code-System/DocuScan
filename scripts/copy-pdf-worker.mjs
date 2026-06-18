/**
 * Copy the pdf.js worker into public/ so it's served from a stable, same-origin
 * path (/pdf.worker.min.mjs) instead of relying on bundler `new URL(...,
 * import.meta.url)` resolution, which 404s under some Next dev/build setups.
 *
 * Runs on postinstall so the worker always matches the installed pdfjs-dist
 * version — a mismatch between the worker and the main lib throws at runtime.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

try {
  // Resolve the worker relative to the installed package (version-accurate).
  const pkg = dirname(require.resolve("pdfjs-dist/package.json"));
  const src = resolve(pkg, "build/pdf.worker.min.mjs");
  const dest = resolve(root, "public/pdf.worker.min.mjs");
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  console.log("[copy-pdf-worker] public/pdf.worker.min.mjs updated");
} catch (err) {
  console.warn("[copy-pdf-worker] skipped:", err?.message ?? err);
}
