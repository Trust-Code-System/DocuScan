"use client";

import { useEffect, useRef, useState } from "react";

export type Signature = { dataUrl: string; bytes: Uint8Array; aspect: number };

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

const W = 600;
const H = 200;

/**
 * Lets the user create a signature by drawing or typing. Emits a transparent
 * PNG (with its aspect ratio) via onChange, or null when cleared/empty.
 */
export default function SignaturePad({
  onChange,
}: {
  onChange: (sig: Signature | null) => void;
}) {
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [typed, setTyped] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  function getCtx() {
    return canvasRef.current?.getContext("2d") ?? null;
  }

  function clearCanvas() {
    const ctx = getCtx();
    if (ctx) ctx.clearRect(0, 0, W, H);
  }

  function emit() {
    const canvas = canvasRef.current;
    if (!canvas || !dirty.current) {
      onChange(null);
      return;
    }
    const dataUrl = canvas.toDataURL("image/png");
    onChange({ dataUrl, bytes: dataUrlToBytes(dataUrl), aspect: W / H });
  }

  function clear() {
    clearCanvas();
    dirty.current = false;
    setTyped("");
    onChange(null);
  }

  // --- draw mode ---
  function canvasPos(e: React.PointerEvent) {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (W / r.width),
      y: (e.clientY - r.top) * (H / r.height),
    };
  }

  function onDown(e: React.PointerEvent) {
    if (mode !== "draw") return;
    const ctx = getCtx();
    if (!ctx) return;
    drawing.current = true;
    const p = canvasPos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function onMove(e: React.PointerEvent) {
    if (mode !== "draw" || !drawing.current) return;
    const ctx = getCtx();
    if (!ctx) return;
    const p = canvasPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    dirty.current = true;
  }

  function onUp() {
    if (mode !== "draw" || !drawing.current) return;
    drawing.current = false;
    emit();
  }

  // Style the stroke whenever the canvas is (re)mounted.
  useEffect(() => {
    const ctx = getCtx();
    if (!ctx) return;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
  }, [mode]);

  // --- type mode ---
  useEffect(() => {
    if (mode !== "type") return;
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, W, H);
    const text = typed.trim();
    if (!text) {
      dirty.current = false;
      onChange(null);
      return;
    }
    let size = 96;
    ctx.fillStyle = "#0f172a";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    // Shrink to fit the pad width.
    do {
      ctx.font = `italic ${size}px "Segoe Script", "Brush Script MT", cursive`;
      if (ctx.measureText(text).width <= W - 40) break;
      size -= 4;
    } while (size > 20);
    ctx.fillText(text, W / 2, H / 2);
    dirty.current = true;
    emit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed, mode]);

  function switchMode(next: "draw" | "type") {
    if (next === mode) return;
    clearCanvas();
    dirty.current = false;
    setTyped("");
    onChange(null);
    setMode(next);
  }

  return (
    <div>
      <div className="mb-3 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-sm">
        <button
          onClick={() => switchMode("draw")}
          className={`rounded-md px-3 py-1.5 font-medium ${
            mode === "draw" ? "bg-white text-ink shadow-sm" : "text-muted"
          }`}
        >
          Draw
        </button>
        <button
          onClick={() => switchMode("type")}
          className={`rounded-md px-3 py-1.5 font-medium ${
            mode === "type" ? "bg-white text-ink shadow-sm" : "text-muted"
          }`}
        >
          Type
        </button>
      </div>

      {mode === "type" && (
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          maxLength={40}
          placeholder="Type your name"
          className="mb-3 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-ink"
        />
      )}

      <div className="overflow-hidden rounded-xl border border-slate-300 bg-white">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          className={`block h-auto w-full ${mode === "draw" ? "cursor-crosshair touch-none" : ""}`}
          style={{
            backgroundImage:
              "linear-gradient(to right, transparent 0, transparent calc(100% - 1px)), linear-gradient(#e2e8f0, #e2e8f0)",
            backgroundSize: "100% 100%, 60% 1px",
            backgroundPosition: "0 0, 20% 78%",
            backgroundRepeat: "no-repeat",
          }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-muted">
          {mode === "draw" ? "Sign with your mouse or finger." : "We render your name as a signature."}
        </p>
        <button onClick={clear} className="text-sm font-medium text-brand-600 underline">
          Clear
        </button>
      </div>
    </div>
  );
}
