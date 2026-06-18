"use client";

/**
 * Generic CDN <script> loader + vendor loaders, mirroring lib/opencv.ts and
 * lib/pptx.ts. Some browser libraries (SheetJS, mammoth, heic2any) either ship
 * Node builtins behind guards (webpack chokes) or are large; loading their
 * pre-built UMD bundles from a CDN on first use keeps them out of the main
 * bundle entirely. Each promise is cached so concurrent callers share one load.
 * Self-host to /public for offline/PWA use by swapping the URLs.
 */

const cache = new Map<string, Promise<void>>();

export function loadScript(id: string, src: string): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("This feature can only run in the browser."));
  }
  const cached = cache.get(id);
  if (cached) return cached;

  const p = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded) return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error(`Could not load ${id}.`)));
      return;
    }
    const s = document.createElement("script");
    s.id = id;
    s.src = src;
    s.async = true;
    s.onload = () => {
      s.dataset.loaded = "1";
      resolve();
    };
    s.onerror = () => {
      cache.delete(id); // allow a retry
      reject(new Error(`Could not load ${id}. Check your connection and try again.`));
    };
    document.body.appendChild(s);
  });
  cache.set(id, p);
  return p;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function loadXLSX(): Promise<any> {
  await loadScript("sheetjs", "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js");
  const x = (window as any).XLSX;
  if (!x) throw new Error("Spreadsheet library failed to initialise.");
  return x;
}

export async function loadMammoth(): Promise<any> {
  await loadScript("mammoth", "https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js");
  const m = (window as any).mammoth;
  if (!m) throw new Error("Word-reading library failed to initialise.");
  return m;
}

export async function loadHeic2any(): Promise<any> {
  await loadScript("heic2any", "https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js");
  const h = (window as any).heic2any;
  if (!h) throw new Error("HEIC decoder failed to initialise.");
  return h;
}
