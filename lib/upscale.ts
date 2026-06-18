"use client";

/**
 * In-browser AI image super-resolution.
 *
 * Wraps UpscalerJS (TensorFlow.js) running a Real-ESRGAN ("thick") model. The
 * heavy runtime (TF.js, ~a few MB) and the model weights (fetched from the
 * jsDelivr CDN the first time, then HTTP-cached) only load when this module is
 * dynamically imported — keep the import inside an event handler so visiting
 * the page doesn't pull TF.js. Everything runs client-side; the image never
 * leaves the browser, matching the app's privacy-first stance.
 *
 * Large images are processed in tiles (`patchSize` + `padding`) so memory stays
 * bounded and big seams are avoided. We still cap the *output* resolution to
 * keep the browser from OOM-ing when producing the final PNG.
 */

import Upscaler from "upscaler";
import x2 from "@upscalerjs/esrgan-thick/2x";
import x4 from "@upscalerjs/esrgan-thick/4x";

export type UpscaleFactor = 2 | 4;

/** Refuse jobs whose output would exceed this — protects against tab crashes. */
const MAX_OUTPUT_MEGAPIXELS = 32;

// One Upscaler (and thus one loaded model) per factor, reused across runs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const instances: Partial<Record<UpscaleFactor, any>> = {};

function getUpscaler(factor: UpscaleFactor) {
  if (!instances[factor]) {
    instances[factor] = new Upscaler({ model: factor === 4 ? x4 : x2 });
  }
  return instances[factor]!;
}

export interface UpscaleProgress {
  /** "model" while weights download/compile; "enhance" during inference. */
  stage: "model" | "enhance";
  /** 0..1 progress through the tiles (only during the "enhance" stage). */
  ratio?: number;
}

export interface EnhanceResult {
  /** PNG data URL of the upscaled image. */
  dataUrl: string;
  width: number;
  height: number;
  /** Source dimensions, for a before/after comparison. */
  sourceWidth: number;
  sourceHeight: number;
}

function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new Error(
          "Couldn't decode this image in the browser. Try a JPG, PNG or WebP (HEIC isn't supported here).",
        ),
      );
    };
    img.src = url;
  });
}

/**
 * Upscale `file` by `factor` (2× or 4×) with a Real-ESRGAN model. Reports
 * progress through `onProgress`. Resolves to a PNG data URL + dimensions.
 */
export async function enhanceImage(
  file: File,
  factor: UpscaleFactor,
  onProgress?: (p: UpscaleProgress) => void,
): Promise<EnhanceResult> {
  const img = await fileToImage(file);
  const sourceWidth = img.naturalWidth;
  const sourceHeight = img.naturalHeight;

  const outMegapixels = (sourceWidth * factor * (sourceHeight * factor)) / 1_000_000;
  if (outMegapixels > MAX_OUTPUT_MEGAPIXELS) {
    URL.revokeObjectURL(img.src);
    throw new Error(
      `That would produce a ${Math.round(outMegapixels)}-megapixel image, which can crash the browser. ` +
        `Try the 2× option or a smaller source image.`,
    );
  }

  try {
    const upscaler = getUpscaler(factor);
    // No progress callback has fired yet → we're still loading/compiling weights.
    onProgress?.({ stage: "model" });
    const dataUrl: string = await upscaler.upscale(img, {
      output: "base64",
      patchSize: 64,
      padding: 6,
      progress: (ratio: number) => onProgress?.({ stage: "enhance", ratio }),
    });
    return {
      dataUrl,
      width: sourceWidth * factor,
      height: sourceHeight * factor,
      sourceWidth,
      sourceHeight,
    };
  } finally {
    URL.revokeObjectURL(img.src);
  }
}
