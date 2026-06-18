"use client";

/**
 * Lazy OpenCV.js loader.
 *
 * OpenCV is ~8MB of WASM, so we load it from a CDN only when the scan editor is
 * first opened — it never touches the main bundle. The promise is cached, so
 * concurrent callers share one load. Self-hosting the script (public/opencv.js)
 * is a sensible follow-up for offline/PWA use; just change CDN_URL.
 *
 * NOTE: only runs in the browser. Verify behaviour on a real device.
 */

const CDN_URL = "https://docs.opencv.org/4.10.0/opencv.js";

// Minimal shape we rely on; the real cv object has hundreds of members.
export type CV = any; // eslint-disable-line @typescript-eslint/no-explicit-any

declare global {
  interface Window {
    cv?: CV;
  }
}

let loadPromise: Promise<CV> | null = null;

export function loadOpenCv(): Promise<CV> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("OpenCV can only load in the browser."));
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<CV>((resolve, reject) => {
    // Already present (e.g. hot reload).
    if (window.cv && window.cv.Mat) {
      resolve(window.cv);
      return;
    }

    const finish = () => {
      const cv = window.cv;
      if (!cv) {
        reject(new Error("OpenCV failed to initialise."));
        return;
      }
      // Newer builds expose a Promise/module; older use onRuntimeInitialized.
      if (cv.Mat) {
        resolve(cv);
      } else if (typeof cv.then === "function") {
        cv.then((ready: CV) => {
          window.cv = ready;
          resolve(ready);
        }).catch(reject);
      } else {
        cv.onRuntimeInitialized = () => resolve(window.cv);
      }
    };

    const existing = document.getElementById("opencv-js") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", finish);
      existing.addEventListener("error", () => reject(new Error("Could not load OpenCV.")));
      if (window.cv) finish();
      return;
    }

    const script = document.createElement("script");
    script.id = "opencv-js";
    script.src = CDN_URL;
    script.async = true;
    script.onload = finish;
    script.onerror = () => {
      loadPromise = null; // allow a retry
      reject(new Error("Could not load OpenCV. Check your connection and try again."));
    };
    document.body.appendChild(script);
  });

  return loadPromise;
}
