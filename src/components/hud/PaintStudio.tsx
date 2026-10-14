"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCityStore } from "@/state/useCityStore";
import { sfx } from "@/world/sfx";

/**
 * The easel in the Hobby Quarter's gallery: paint your own piece with the
 * city's palette, then save it as a PNG. Works with a mouse, a finger or a pen
 * (pen pressure changes the stroke width).
 */

const COLORS = ["#1a103d", "#7c3aed", "#b794f4", "#f0abfc", "#d53f8c", "#ef4444", "#f6c453", "#fde68a", "#14b8a6", "#5eead4", "#60a5fa", "#6b4a3a", "#ffffff"];
const SIZES = [3, 8, 16, 32];
const PROMPTS = [
  "Paint the city at night",
  "Your favorite tech stack as a landscape",
  "A horse in a lilac field",
  "The view from your window",
  "Wouroud's café, from memory",
  "A bug you squashed this week",
  "Sunset over Tripoli",
];
const UNDO_LIMIT = 25;

export function PaintStudio() {
  const setActivity = useCityStore((s) => s.setActivity);
  const canvas = useRef<HTMLCanvasElement>(null);
  const history = useRef<ImageData[]>([]);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [color, setColor] = useState(COLORS[1]);
  const [size, setSize] = useState(SIZES[1]);
  const [eraser, setEraser] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [prompt, setPrompt] = useState(PROMPTS[0]);

  const ctx = () => canvas.current?.getContext("2d") ?? null;

  const fill = useCallback((c: string) => {
    const el = canvas.current;
    const g = el?.getContext("2d");
    if (!el || !g) return;
    g.fillStyle = c;
    g.fillRect(0, 0, el.width, el.height);
  }, []);

  // A fixed-size paper, scaled to fit the screen with CSS, so the saved image is the same everywhere.
  useEffect(() => {
    fill("#fffaf0");
  }, [fill]);


  const snapshot = () => {
    const el = canvas.current;
    const g = ctx();
    if (!el || !g) return;
    history.current.push(g.getImageData(0, 0, el.width, el.height));
    if (history.current.length > UNDO_LIMIT) history.current.shift();
    setCanUndo(true);
  };

  const undo = () => {
    const g = ctx();
    const img = history.current.pop();
    if (g && img) g.putImageData(img, 0, 0);
    setCanUndo(history.current.length > 0);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") setActivity(null);
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") undo();
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * el.width, y: ((e.clientY - r.top) / r.height) * el.height };
  };

  const stroke = (from: { x: number; y: number }, to: { x: number; y: number }, pressure: number) => {
    const g = ctx();
    if (!g) return;
    g.globalCompositeOperation = "source-over";
    g.strokeStyle = eraser ? "#fffaf0" : color;
    g.lineWidth = size * (0.4 + pressure * 0.9);
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    g.moveTo(from.x, from.y);
    g.lineTo(to.x, to.y);
    g.stroke();
  };

  const save = () => {
    const el = canvas.current;
    if (!el) return;
    const a = document.createElement("a");
    a.href = el.toDataURL("image/png");
    a.download = "my-painting-wouroud-city.png";
    a.click();
    sfx.sparkle();
  };

  return (
    <div className="activity-backdrop pointer-events-auto absolute inset-0 z-40 flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 text-white sm:p-4">
        <div>
          <p className="text-xs tracking-[0.25em] text-amber-200 uppercase">Hobby Quarter · Gallery easel</p>
          <h2 className="text-xl font-extrabold sm:text-2xl">Paint something</h2>
          <p className="text-sm text-violet-200">
            Idea: <button type="button" className="underline decoration-dotted" onClick={() => setPrompt(PROMPTS[(PROMPTS.indexOf(prompt) + 1) % PROMPTS.length])}>{prompt}</button>
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="hud-panel hud-button hud-gold" onClick={save}>
            💾 Save PNG
          </button>
          <button type="button" className="hud-panel hud-button" onClick={() => setActivity(null)}>
            Leave <kbd>Esc</kbd>
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center gap-3 px-3 pb-3 lg:flex-row lg:items-start lg:justify-center">
        <div className="paint-tools order-2 lg:order-1">
          <div className="flex flex-wrap justify-center gap-1.5 lg:grid lg:grid-cols-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                aria-pressed={!eraser && color === c}
                className="hud-swatch !h-7 !w-7"
                style={{ background: c }}
                onClick={() => {
                  setColor(c);
                  setEraser(false);
                }}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {SIZES.map((s) => (
              <button key={s} type="button" className="paint-size" aria-pressed={size === s} aria-label={`Brush ${s}`} onClick={() => setSize(s)}>
                <span style={{ width: Math.min(22, s), height: Math.min(22, s) }} />
              </button>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-1.5 text-sm text-white">
            <button type="button" className="hud-chip" aria-pressed={eraser} onClick={() => setEraser(!eraser)}>
              🧽 Eraser
            </button>
            <button type="button" className="hud-chip" disabled={!canUndo} onClick={undo}>
              ↶ Undo
            </button>
            <button
              type="button"
              className="hud-chip"
              onClick={() => {
                snapshot();
                fill(eraser ? "#fffaf0" : color);
              }}
            >
              🪣 Fill
            </button>
            <button
              type="button"
              className="hud-chip"
              onClick={() => {
                snapshot();
                fill("#fffaf0");
              }}
            >
              ✕ Clear
            </button>
          </div>
        </div>

        <div className="paint-easel order-1 lg:order-2">
          <canvas
            ref={canvas}
            width={1200}
            height={850}
            className="block h-auto w-full touch-none rounded-md bg-[#fffaf0] shadow-2xl"
            aria-label="Painting canvas"
            onPointerDown={(e) => {
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                // Not capturable (synthetic pointer); drawing still works while over the canvas.
              }
              snapshot();
              const p = point(e);
              last.current = p;
              stroke(p, { x: p.x + 0.01, y: p.y }, e.pressure || 0.5);
            }}
            onPointerMove={(e) => {
              if (!last.current) return;
              const p = point(e);
              stroke(last.current, p, e.pointerType === "pen" ? e.pressure : 0.5);
              last.current = p;
            }}
            onPointerUp={() => (last.current = null)}
            onPointerCancel={() => (last.current = null)}
          />
        </div>
      </div>
    </div>
  );
}
