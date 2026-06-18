"use client";

import { loadOpenCv, type CV } from "./opencv";

export type Pt = { x: number; y: number };
export type ScanFilter = "color" | "gray" | "bw";

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Order 4 points as [top-left, top-right, bottom-right, bottom-left].
 * Uses the classic sum/diff trick: tl has min(x+y), br has max(x+y),
 * tr has min(y-x), bl has max(y-x).
 */
export function orderCorners(pts: Pt[]): [Pt, Pt, Pt, Pt] {
  const bySum = [...pts].sort((a, b) => a.x + a.y - (b.x + b.y));
  const byDiff = [...pts].sort((a, b) => a.y - a.x - (b.y - b.x));
  return [bySum[0], byDiff[0], bySum[3], byDiff[3]];
}

/** A sensible default quad (inset 8%) used when auto-detect finds nothing. */
export function defaultCorners(w: number, h: number): [Pt, Pt, Pt, Pt] {
  const mx = w * 0.08;
  const my = h * 0.08;
  return [
    { x: mx, y: my },
    { x: w - mx, y: my },
    { x: w - mx, y: h - my },
    { x: mx, y: h - my },
  ];
}

/**
 * Detect the largest document-like quadrilateral in a canvas.
 * Returns ordered corners in canvas-pixel coordinates, or null if none found.
 */
export async function detectDocumentCorners(
  canvas: HTMLCanvasElement,
): Promise<[Pt, Pt, Pt, Pt] | null> {
  const cv: CV = await loadOpenCv();
  const src = cv.imread(canvas);
  const gray = new cv.Mat();
  const edges = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  let kernel: CV | null = null;

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
    cv.Canny(gray, edges, 75, 200);
    kernel = cv.Mat.ones(3, 3, cv.CV_8U);
    cv.dilate(edges, edges, kernel);

    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    const imgArea = src.rows * src.cols;
    let best: Pt[] | null = null;
    let bestArea = imgArea * 0.2; // must cover at least 20% of the frame

    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i);
      const area = cv.contourArea(c);
      if (area <= bestArea) {
        c.delete();
        continue;
      }
      const peri = cv.arcLength(c, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(c, approx, 0.02 * peri, true);

      if (approx.rows === 4 && cv.isContourConvex(approx)) {
        const d = approx.data32S;
        best = [
          { x: d[0], y: d[1] },
          { x: d[2], y: d[3] },
          { x: d[4], y: d[5] },
          { x: d[6], y: d[7] },
        ];
        bestArea = area;
      }
      approx.delete();
      c.delete();
    }

    return best ? orderCorners(best) : null;
  } finally {
    src.delete();
    gray.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();
    kernel?.delete();
  }
}

/**
 * Perspective-correct the quad defined by `corners` (canvas-pixel coords) from
 * `source` and apply an enhancement filter. Draws into `out` and returns it.
 */
export async function warpAndEnhance(
  source: HTMLCanvasElement,
  corners: [Pt, Pt, Pt, Pt],
  filter: ScanFilter,
  out: HTMLCanvasElement,
): Promise<HTMLCanvasElement> {
  const cv: CV = await loadOpenCv();
  const [tl, tr, br, bl] = corners;

  const maxW = Math.round(Math.max(dist(br, bl), dist(tr, tl)));
  const maxH = Math.round(Math.max(dist(tr, br), dist(tl, bl)));

  const src = cv.imread(source);
  const dst = new cv.Mat();
  const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y,
  ]);
  const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0, 0, maxW, 0, maxW, maxH, 0, maxH,
  ]);
  const M = cv.getPerspectiveTransform(srcTri, dstTri);

  try {
    cv.warpPerspective(
      src,
      dst,
      M,
      new cv.Size(maxW, maxH),
      cv.INTER_LINEAR,
      cv.BORDER_CONSTANT,
      new cv.Scalar(255, 255, 255, 255),
    );

    if (filter === "gray" || filter === "bw") {
      cv.cvtColor(dst, dst, cv.COLOR_RGBA2GRAY);
      if (filter === "bw") {
        cv.adaptiveThreshold(
          dst, dst, 255,
          cv.ADAPTIVE_THRESH_GAUSSIAN_C,
          cv.THRESH_BINARY,
          15, 12,
        );
      }
    }

    out.width = maxW;
    out.height = maxH;
    cv.imshow(out, dst);
    return out;
  } finally {
    src.delete();
    dst.delete();
    srcTri.delete();
    dstTri.delete();
    M.delete();
  }
}

/** Convert a canvas to a JPEG File for the PDF pipeline. */
export function canvasToFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(new File([b], name, { type: "image/jpeg" })) : reject(new Error("Encode failed."))),
      "image/jpeg",
      0.9,
    ),
  );
}
