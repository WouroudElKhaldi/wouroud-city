"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCityStore } from "@/state/useCityStore";
import { sfx } from "@/world/sfx";
import { Leaderboard } from "./Leaderboard";

/**
 * "Firewall Flyer": a city pigeon flaps through the gaps in scrolling firewalls.
 * Space, click or tap to flap; every wall passed is a point. The gaps narrow and the
 * walls speed up a little as the score grows. Best score stays in this browser.
 */

const BEST_KEY = "wouroud-city:flappy-best";
const W = 480;
const H = 640;
const GRAVITY = 1500;
const FLAP = -460;
const WALL_W = 70;
const BIRD_X = 130;
const BIRD_R = 15;

type Wall = { x: number; gap: number; size: number; passed: boolean };
type Game = { y: number; vy: number; walls: Wall[]; t: number; score: number; phase: "ready" | "playing" | "over"; ground: number };

function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

const newGame = (): Game => ({ y: H / 2, vy: 0, walls: [], t: 0, score: 0, phase: "ready", ground: 0 });

export function FlappyGame() {
  const setActivity = useCityStore((s) => s.setActivity);
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<Game>(newGame());
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(readBest);
  const [phase, setPhase] = useState<Game["phase"]>("ready");

  const flap = useCallback(() => {
    const g = game.current;
    if (g.phase === "over") return;
    if (g.phase === "ready") {
      g.phase = "playing";
      setPhase("playing");
    }
    g.vy = FLAP;
    sfx.chirp();
  }, []);

  const restart = useCallback(() => {
    game.current = newGame();
    setScore(0);
    setPhase("ready");
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActivity(null);
      else if (e.code === "Space" || e.key === "ArrowUp" || e.key === "w") {
        e.preventDefault();
        if (game.current.phase === "over") restart();
        else flap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flap, restart, setActivity]);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const g = game.current;
      const el = canvas.current;
      const ctx = el?.getContext("2d");
      if (!el || !ctx) {
        frame = requestAnimationFrame(tick);
        return;
      }
      // Fit the logical 480×640 field into the canvas, centered.
      const dpr = window.devicePixelRatio || 1;
      if (el.width !== el.clientWidth * dpr || el.height !== el.clientHeight * dpr) {
        el.width = el.clientWidth * dpr;
        el.height = el.clientHeight * dpr;
      }
      const scale = Math.min(el.width / W, el.height / H);
      const speed = 170 + Math.min(120, g.score * 6);

      if (g.phase === "playing") {
        g.t += dt;
        g.vy += GRAVITY * dt;
        g.y += g.vy * dt;
        g.ground = (g.ground + speed * dt) % 48;
        const lastWall = g.walls[g.walls.length - 1];
        if (!lastWall || lastWall.x < W - 230) {
          const size = Math.max(130, 190 - g.score * 3);
          g.walls.push({ x: W + 20, gap: 110 + Math.random() * (H - 260 - size) + size / 2, size, passed: false });
        }
        for (const w of g.walls) {
          w.x -= speed * dt;
          if (!w.passed && w.x + WALL_W < BIRD_X) {
            w.passed = true;
            g.score++;
            setScore(g.score);
            sfx.coin();
          }
          const hitX = BIRD_X + BIRD_R > w.x && BIRD_X - BIRD_R < w.x + WALL_W;
          const hitY = g.y - BIRD_R < w.gap - w.size / 2 || g.y + BIRD_R > w.gap + w.size / 2;
          if (hitX && hitY) g.phase = "over";
        }
        g.walls = g.walls.filter((w) => w.x > -WALL_W - 10);
        if (g.y > H - 60 - BIRD_R || g.y < BIRD_R) g.phase = "over";
        if (g.phase === "over") {
          sfx.clunk();
          setPhase("over");
          if (g.score > readBest()) {
            try {
              localStorage.setItem(BEST_KEY, String(g.score));
            } catch {
              // Storage can be blocked; the score still shows.
            }
          }
          setBest(Math.max(readBest(), g.score));
        }
      } else if (g.phase === "ready") {
        g.t += dt;
        g.y = H / 2 + Math.sin(g.t * 3) * 10;
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#0d0820";
      ctx.fillRect(0, 0, el.width, el.height);
      ctx.translate((el.width - W * scale) / 2, (el.height - H * scale) / 2);
      ctx.scale(scale, scale);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.clip();

      // Sky with a soft sunset and the city's skyline far away.
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#2b1d63");
      sky.addColorStop(0.65, "#b56fa8");
      sky.addColorStop(1, "#f6c27a");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgb(26 16 61 / 0.55)";
      for (let i = 0; i < 12; i++) {
        const x = ((i * 53 - g.t * 20) % (W + 60) + W + 60) % (W + 60) - 30;
        const h = 60 + ((i * 37) % 90);
        ctx.fillRect(x, H - 60 - h, 40, h);
      }

      // Firewalls: brick columns with a glowing gap edge.
      for (const w of g.walls) {
        for (const [y0, y1] of [
          [0, w.gap - w.size / 2],
          [w.gap + w.size / 2, H - 60],
        ]) {
          ctx.fillStyle = "#a3402e";
          ctx.fillRect(w.x, y0, WALL_W, y1 - y0);
          ctx.strokeStyle = "rgb(60 20 15 / 0.6)";
          ctx.lineWidth = 2;
          for (let y = y0; y < y1; y += 18) {
            ctx.beginPath();
            ctx.moveTo(w.x, y);
            ctx.lineTo(w.x + WALL_W, y);
            ctx.stroke();
            const off = (Math.floor(y / 18) % 2) * 17;
            for (let x = w.x + off; x < w.x + WALL_W; x += 35) {
              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(x, Math.min(y + 18, y1));
              ctx.stroke();
            }
          }
          // Flames on the edge facing the gap.
          ctx.fillStyle = "#fbbf24";
          const edge = y0 === 0 ? y1 : y0;
          for (let x = w.x; x < w.x + WALL_W; x += 10) {
            const f = 5 + Math.sin(g.t * 14 + x) * 3;
            ctx.beginPath();
            ctx.moveTo(x, edge);
            ctx.lineTo(x + 5, edge + (y0 === 0 ? f : -f));
            ctx.lineTo(x + 10, edge);
            ctx.fill();
          }
        }
        ctx.fillStyle = "#fde68a";
        ctx.font = "700 11px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("FIREWALL", w.x + WALL_W / 2, w.gap - w.size / 2 - 22);
      }

      // Ground: paving stones scrolling by.
      ctx.fillStyle = "#3a3540";
      ctx.fillRect(0, H - 60, W, 60);
      ctx.fillStyle = "#4b4553";
      for (let x = -g.ground; x < W; x += 48) ctx.fillRect(x + 2, H - 56, 44, 24);

      // The pigeon: grey body, green-purple neck, flapping wing.
      ctx.save();
      ctx.translate(BIRD_X, g.y);
      ctx.rotate(Math.max(-0.5, Math.min(1.1, g.vy / 600)));
      ctx.fillStyle = "#9aa1ae";
      ctx.beginPath();
      ctx.ellipse(0, 0, 19, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#5c7a6f";
      ctx.beginPath();
      ctx.ellipse(9, -6, 9, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#8e95a3";
      ctx.beginPath();
      ctx.arc(14, -10, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e0701c";
      ctx.beginPath();
      ctx.arc(16, -11, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2a2628";
      ctx.beginPath();
      ctx.moveTo(20, -9);
      ctx.lineTo(27, -7);
      ctx.lineTo(20, -6);
      ctx.fill();
      const flapAngle = g.phase === "over" ? 0 : Math.sin(g.t * 24) * 0.7;
      ctx.fillStyle = "#c3c8d1";
      ctx.save();
      ctx.rotate(flapAngle);
      ctx.beginPath();
      ctx.ellipse(-4, -2, 14, 7, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3e4350";
      ctx.fillRect(-12, -2, 12, 2);
      ctx.restore();
      ctx.fillStyle = "#3e4350";
      ctx.beginPath();
      ctx.moveTo(-17, -2);
      ctx.lineTo(-29, -6);
      ctx.lineTo(-29, 4);
      ctx.fill();
      ctx.restore();

      // Score.
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 44px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(g.score), W / 2, 70);
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
          <p className="text-xs tracking-[0.25em] text-amber-200 uppercase">Arcade Pier · Sky Hop</p>
          <h2 className="text-xl font-extrabold sm:text-2xl">Firewall Flyer</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="hud-panel text-center">
            <p className="text-[0.65rem] tracking-widest text-violet-200 uppercase">Walls</p>
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
          onPointerDown={() => (game.current.phase === "over" ? undefined : flap())}
          aria-label="Firewall Flyer. Tap, click or press Space to flap."
        />
        {phase === "ready" && (
          <div className="pointer-events-none absolute inset-x-0 top-1/4 text-center text-white">
            <p className="text-lg font-bold">Fly the pigeon through the firewalls</p>
            <p className="mt-1 text-violet-200">Tap, click or press Space to flap</p>
          </div>
        )}
        {phase === "over" && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0d0820]/50 p-4">
            <div className="welcome-card max-w-sm text-center">
              <p className="text-sm tracking-[0.25em] text-amber-200 uppercase">Blocked by the firewall!</p>
              <p className="mt-2 text-4xl font-extrabold text-white">{score}</p>
              <p className="text-violet-200">{score >= best && score > 0 ? "New best! 🎉" : `Best: ${best}`}</p>
              <Leaderboard game="flappy" score={score} />
              <div className="mt-5 flex justify-center gap-2">
                <button type="button" className="welcome-enter" onClick={restart}>
                  Fly again
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
