"use client";

/**
 * Lazy pptxgenjs loader (CDN), mirroring lib/opencv.ts.
 *
 * pptxgenjs is a browser-capable library but its npm build references Node
 * builtins (`node:fs`/`node:https`) behind environment guards, which webpack
 * resolves statically and rejects. Rather than fight the bundler, we load the
 * pre-built UMD bundle from a CDN on first use (the same approach the project
 * uses for OpenCV) — it never touches the main bundle and the global
 * `window.PptxGenJS` constructor is returned. Self-host to public/ for offline.
 */

const CDN_URL = "https://cdn.jsdelivr.net/npm/pptxgenjs@4.0.1/dist/pptxgen.bundle.js";

// The real constructor has a large API; callers in lib/deck.ts type it locally.
type PptxCtor = new () => unknown;

declare global {
  interface Window {
    PptxGenJS?: PptxCtor;
  }
}

let loadPromise: Promise<PptxCtor> | null = null;

export function loadPptxGenJS(): Promise<PptxCtor> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("PowerPoint export can only run in the browser."));
  }
  if (window.PptxGenJS) return Promise.resolve(window.PptxGenJS);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<PptxCtor>((resolve, reject) => {
    const finish = () => {
      if (window.PptxGenJS) resolve(window.PptxGenJS);
      else reject(new Error("PowerPoint library failed to initialise."));
    };
    const existing = document.getElementById("pptxgenjs") as HTMLScriptElement | null;
    if (existing) {
      if (window.PptxGenJS) return finish();
      existing.addEventListener("load", finish);
      existing.addEventListener("error", () => reject(new Error("Could not load the PowerPoint library.")));
      return;
    }
    const script = document.createElement("script");
    script.id = "pptxgenjs";
    script.src = CDN_URL;
    script.async = true;
    script.onload = finish;
    script.onerror = () => {
      loadPromise = null; // allow a retry
      reject(new Error("Could not load the PowerPoint library. Check your connection and try again."));
    };
    document.body.appendChild(script);
  });

  return loadPromise;
}
