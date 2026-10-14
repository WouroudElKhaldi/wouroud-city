"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCityStore } from "@/state/useCityStore";
import { sfx } from "@/world/sfx";

/**
 * "Full Stack": the Arcade Pier game. A block slides across; tap (or press Space)
 * to drop it on the stack. Whatever hangs over the edge is cut off, a perfect
 * drop keeps the full width and builds a combo. Every block is a layer of the
 * stack: HTML → CSS → JavaScript → ... → Docker → Git. Best score stays in this browser.
 */

const LABELS = [
  "HTML",
  "CSS",
  "JavaScript",
  "TypeScript",
  "React",
  "Next.js",
  "Tailwind",
  "Node.js",
  "Express",
  "NestJS",
  "Laravel",
  "REST API",
  "GraphQL",
  "Prisma",
  "PostgreSQL",
  "MongoDB",
  "Redis",
  "Docker",
  "CI/CD",
  "Git",
  "Tests",
  "AI agents",
];
const BLOCK_H = 34;
const START_W = 220;
const LIMIT = 260;
const PERFECT = 6;
const BEST_KEY = "wouroud-city:stack-best";

type Block = { x: number; w: number };
type Chip = { x: number; y: number; w: number; vy: number; vx: number; i: number; rot: number };
type Game = {
  stack: Block[];
  cur: Block & { dir: 1 | -1; speed: number };
  chips: Chip[];
  combo: number;
  cam: number;
  flash: number;
  phase: "ready" | "playing" | "over";
};

/** Violet → mint → gold along the stack, per the city's palette. */
function colorAt(i: number, light = 0) {
  const stops = [
    [124, 58, 237],
    [94, 234, 212],
    [246, 196, 83],
    [240, 171, 252],
  ];
  const t = (i % 24) / 6;
  const a = stops[Math.floor(t) % stops.length];
  const b = stops[(Math.floor(t) + 1) % stops.length];
  const k = t % 1;
  const c = a.map((v, j) => Math.round(v + (b[j] - v) * k + (255 - (v + (b[j] - v) * k)) * light));
  return `rgb(${c[0]} ${c[1]} ${c[2]})`;
}

function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function newGame(): Game {
  return {
    stack: [{ x: -START_W / 2, w: START_W }],
    cur: { x: -LIMIT, w: START_W, dir: 1, speed: 150 },
    chips: [],
    combo: 0,
    cam: 0,
    flash: 0,
    phase: "ready",
  };
}

export function StackGame() {
  const setActivity = useCityStore((s) => s.setActivity);
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<Game>(newGame());
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(readBest);
  const [phase, setPhase] = useState<Game["phase"]>("ready");
  const [combo, setCombo] = useState(0);

  const drop = useCallback(() => {
    const g = game.current;
    if (g.phase === "over") return;
    if (g.phase === "ready") {
      g.phase = "playing";
      setPhase("playing");
    }
    const prev = g.stack[g.stack.length - 1];
    const cur = g.cur;
    const level = g.stack.length;
    const left = Math.max(cur.x, prev.x);
    const right = Math.min(cur.x + cur.w, prev.x + prev.w);
    const overlap = right - left;
    if (overlap <= 0) {
      g.chips.push({ x: cur.x, y: level, w: cur.w, vy: 0, vx: cur.dir * 40, i: level, rot: 0 });
      g.phase = "over";
      setPhase("over");
      sfx.clunk();
      const s = g.stack.length - 1;
      if (s > readBest()) {
        try {
          localStorage.setItem(BEST_KEY, String(s));
        } catch {
          // Private mode: the best score just isn't kept.
        }
        setBest(s);
      }
      return;
    }
    let placed: Block;
    if (Math.abs(cur.x - prev.x) < PERFECT) {
      g.combo++;
      // Three perfect drops in a row widen the block a little.
      const grow = g.combo >= 3 ? Math.min(12, START_W - prev.w) : 0;
      placed = { x: prev.x - grow / 2, w: prev.w + grow };
      g.flash = 1;
      sfx.sparkle();
    } else {
      g.combo = 0;
      placed = { x: left, w: overlap };
      const chipX = cur.x < prev.x ? cur.x : right;
      g.chips.push({ x: chipX, y: level, w: cur.w - overlap, vy: 0, vx: cur.x < prev.x ? -60 : 60, i: level, rot: 0 });
      sfx.pop();
    }
    g.stack.push(placed);
    const dir = level % 2 === 0 ? 1 : -1;
    g.cur = { x: dir === 1 ? -LIMIT : LIMIT - placed.w, w: placed.w, dir, speed: Math.min(420, 150 + level * 9) };
    setScore(g.stack.length - 1);
    setCombo(g.combo);
  }, []);

  const restart = useCallback(() => {
    game.current = newGame();
    setScore(0);
    setCombo(0);
    setPhase("ready");
  }, []);

  // Keyboard: Space / Enter / ArrowDown drop, Escape leaves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") setActivity(null);
      else if (e.code === "Space" || e.code === "Enter" || e.code === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        if (game.current.phase === "over") restart();
        else drop();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [drop, restart, setActivity]);

  // Animation and drawing.
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = el.clientWidth;
      const H = el.clientHeight;
      if (el.width !== Math.round(W * dpr) || el.height !== Math.round(H * dpr)) {
        el.width = Math.round(W * dpr);
        el.height = Math.round(H * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const g = game.current;
      // Fit the stack to narrow phone screens.
      const zoom = Math.min(1, (W - 24) / (LIMIT * 2 + 40));

      if (g.phase !== "over") {
        const c = g.cur;
        c.x += c.dir * c.speed * dt;
        if (c.x > LIMIT - c.w * 0.2) c.dir = -1;
        if (c.x < -LIMIT) c.dir = 1;
      }
      for (const chip of g.chips) {
        chip.vy += 900 * dt;
        chip.y -= (chip.vy * dt) / BLOCK_H;
        chip.x += chip.vx * dt;
        chip.rot += chip.vx * 0.0004;
      }
      g.chips = g.chips.filter((c) => c.y > -30);
      const target = Math.max(0, g.stack.length * BLOCK_H - H * 0.45 / zoom);
      g.cam += (target - g.cam) * Math.min(1, dt * 4);
      g.flash = Math.max(0, g.flash - dt * 2.5);

      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#1a103d");
      sky.addColorStop(1, "#3b1d8f");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgb(255 255 255 / 0.5)";
      for (let i = 0; i < 40; i++) {
        const sx = (i * 97) % W;
        const sy = ((i * 53 + g.cam * 0.2) % H + H) % H;
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }

      ctx.save();
      ctx.translate(W / 2, H - 70);
      ctx.scale(zoom, zoom);
      const yOf = (level: number) => -(level * BLOCK_H) + g.cam;
      const drawBlock = (x: number, level: number, w: number, i: number, label?: string, rot = 0) => {
        const y = yOf(level);
        ctx.save();
        ctx.translate(x + w / 2, y);
        ctx.rotate(rot);
        const d = 14;
        // Top face
        ctx.fillStyle = colorAt(i, 0.35);
        ctx.beginPath();
        ctx.moveTo(-w / 2, -BLOCK_H);
        ctx.lineTo(-w / 2 + d, -BLOCK_H - d * 0.6);
        ctx.lineTo(w / 2 + d, -BLOCK_H - d * 0.6);
        ctx.lineTo(w / 2, -BLOCK_H);
        ctx.fill();
        // Side face
        ctx.beginPath();
        ctx.moveTo(w / 2, -BLOCK_H);
        ctx.lineTo(w / 2 + d, -BLOCK_H - d * 0.6);
        ctx.lineTo(w / 2 + d, -d * 0.6);
        ctx.lineTo(w / 2, 0);
        ctx.fillStyle = colorAt(i);
        ctx.fill();
        ctx.fillStyle = "rgb(26 16 61 / 0.3)";
        ctx.fill();
        // Front face
        ctx.fillStyle = colorAt(i);
        ctx.fillRect(-w / 2, -BLOCK_H, w, BLOCK_H);
        ctx.strokeStyle = "rgb(26 16 61 / 0.35)";
        ctx.strokeRect(-w / 2, -BLOCK_H, w, BLOCK_H);
        if (label && w > 34) {
          ctx.fillStyle = "#1a103d";
          ctx.font = `700 ${Math.min(15, w / 5)}px system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(label, 0, -BLOCK_H / 2);
        }
        ctx.restore();
      };

      // Pier base
      ctx.fillStyle = "#2d1f52";
      ctx.fillRect(-LIMIT - 20, g.cam, LIMIT * 2 + 40, 400);
      g.stack.forEach((b, i) => drawBlock(b.x, i, b.w, i, i === 0 ? "Wouroud's stack" : LABELS[(i - 1) % LABELS.length]));
      if (g.phase !== "over") drawBlock(g.cur.x, g.stack.length, g.cur.w, g.stack.length, LABELS[(g.stack.length - 1) % LABELS.length]);
      for (const chip of g.chips) drawBlock(chip.x, chip.y, chip.w, chip.i, undefined, chip.rot);
      if (g.flash > 0) {
        const top = g.stack[g.stack.length - 1];
        ctx.strokeStyle = `rgb(253 230 138 / ${g.flash})`;
        ctx.lineWidth = 4;
        ctx.strokeRect(top.x - 6, yOf(g.stack.length - 1) - BLOCK_H - 6, top.w + 12, BLOCK_H + 12);
      }
      ctx.restore();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="activity-backdrop pointer-events-auto absolute inset-0 z-40 flex flex-col">
      <div className="flex items-center justify-between gap-3 p-3 text-white sm:p-4">
        <div>
          <p className="text-xs tracking-[0.25em] text-amber-200 uppercase">Arcade Pier</p>
          <h2 className="text-xl font-extrabold sm:text-2xl">Full Stack</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="hud-panel text-center">
            <p className="text-[0.65rem] tracking-widest text-violet-200 uppercase">Height</p>
            <p className="text-xl font-extrabold">{score}</p>
          </div>
          <div className="hud-panel text-center">
            <p className="text-[0.65rem] tracking-widest text-amber-200 uppercase">Best</p>
            <p className="text-xl font-extrabold text-amber-200">{best}</p>
          </div>
          <button type="button" className="hud-panel hud-button" onClick={() => setActivity(null)}>
            Leave <kbd>Esc</kbd>
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <canvas
          ref={canvas}
          className="absolute inset-0 h-full w-full touch-none select-none"
          onPointerDown={() => (game.current.phase === "over" ? undefined : drop())}
          aria-label="Full Stack game. Tap or press Space to drop the block."
        />
        {combo >= 2 && phase === "playing" && (
          <p className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-amber-300 px-3 py-1 text-sm font-extrabold text-[#1a103d]">
            Perfect ×{combo}
          </p>
        )}
        {phase === "ready" && (
          <div className="pointer-events-none absolute inset-x-0 top-1/4 text-center text-white">
            <p className="text-lg font-bold">Stack the full stack as high as you can</p>
            <p className="mt-1 text-violet-200">Tap or press Space to drop · perfect drops build a combo</p>
          </div>
        )}
        {phase === "over" && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0d0820]/50 p-4">
            <div className="welcome-card max-w-sm text-center">
              <p className="text-sm tracking-[0.25em] text-amber-200 uppercase">Stack overflow!</p>
              <p className="mt-2 text-4xl font-extrabold text-white">{score}</p>
              <p className="text-violet-200">
                {score >= best && score > 0 ? "New best! 🎉" : `Best: ${best}`}
                {score >= 12 ? " · Senior-level stacking." : score >= 6 ? " · Solid full stack." : " · Every senior started with HTML."}
              </p>
              <div className="mt-5 flex justify-center gap-2">
                <button type="button" className="welcome-enter" onClick={restart}>
                  Play again
                </button>
                <button type="button" className="hud-chip text-white" onClick={() => setActivity(null)}>
                  Back to the pier
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
