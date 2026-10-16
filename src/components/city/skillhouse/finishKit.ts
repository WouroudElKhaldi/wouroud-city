"use client";

import * as THREE from "three";
import { worldMapped } from "../surfaces";

/**
 * Floors and walls for the skill houses, painted on canvases (nothing to download) and projected in
 * world space (`worldMapped`), so one material covers every floor or wall of any size and neighbors
 * line up. Each look is cached by its kind and colors.
 */

export type FloorKind =
  | "oak"
  | "walnut"
  | "parquet"
  | "concrete"
  | "terrazzo"
  | "checker"
  | "tiles"
  | "hex"
  | "carpet"
  | "grating"
  | "epoxy"
  | "tatami"
  | "turf"
  | "blueprint"
  | "rubber"
  | "stone";

export type WallKind = "plaster" | "brick" | "slats" | "subway" | "corrugated" | "blackboard" | "formwork" | "stone" | "panel" | "blueprint" | "tiles";

export type SurfaceSpec<K> = { kind: K; colors: string[] };

const SIZE = 512;

function rng(seed: number) {
  let s = seed % 2147483647 || 7;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const shade = (hex: string, k: number) => {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l + k, 0, 1));
  return `#${c.getHexString()}`;
};

function noise(g: CanvasRenderingContext2D, amount: number, seed: number, light = 255, dark = 0) {
  const r = rng(seed);
  for (let i = 0; i < amount; i++) {
    const v = r() < 0.5 ? light : dark;
    g.fillStyle = `rgba(${v},${v},${v},${0.03 + r() * 0.05})`;
    const s = 1 + r() * 3;
    g.fillRect(r() * SIZE, r() * SIZE, s, s);
  }
}

function blotches(g: CanvasRenderingContext2D, count: number, seed: number, alpha = 0.05) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const v = r() < 0.5 ? 255 : 30;
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, 40 + r() * 120);
    grad.addColorStop(0, `rgba(${v},${v},${v},${alpha})`);
    grad.addColorStop(1, `rgba(${v},${v},${v},0)`);
    g.save();
    g.translate(r() * SIZE, r() * SIZE);
    g.fillStyle = grad;
    g.fillRect(-160, -160, 320, 320);
    g.restore();
  }
}

/** Paints one tile of a surface. Returns the tile's size in meters. */
function paint(g: CanvasRenderingContext2D, kind: FloorKind | WallKind, colors: string[]): number {
  const [a = "#cccccc", b = shade(a, -0.12), c = shade(a, 0.1)] = colors;
  const S = SIZE;
  g.fillStyle = a;
  g.fillRect(0, 0, S, S);
  switch (kind) {
    case "oak":
    case "walnut": {
      // Boards 20 cm wide, staggered ends, grain streaks.
      const r = rng(kind.length * 7);
      const rows = 12;
      const h = S / rows;
      for (let i = 0; i < rows; i++) {
        let x = -r() * S * 0.5;
        while (x < S) {
          const len = S * (0.35 + r() * 0.4);
          g.fillStyle = shade(a, (r() - 0.5) * 0.08);
          g.fillRect(x, i * h, len, h);
          for (let k = 0; k < 6; k++) {
            g.strokeStyle = `rgba(0,0,0,${0.04 + r() * 0.05})`;
            g.lineWidth = 1;
            g.beginPath();
            const y = i * h + r() * h;
            g.moveTo(x, y);
            g.bezierCurveTo(x + len * 0.3, y + (r() - 0.5) * 6, x + len * 0.6, y + (r() - 0.5) * 6, x + len, y);
            g.stroke();
          }
          g.fillStyle = "rgba(0,0,0,0.35)";
          g.fillRect(x, i * h, 2, h);
          x += len;
        }
        g.fillStyle = "rgba(0,0,0,0.3)";
        g.fillRect(0, i * h, S, 2);
      }
      return 2.4;
    }
    case "parquet": {
      // Herringbone: 8 × 40 cm blocks.
      const r = rng(11);
      const bw = S / 16;
      const bl = bw * 4;
      g.save();
      for (let y = -S; y < S * 2; y += bw * 2) {
        for (let x = -S; x < S * 2; x += bl) {
          for (const [dx, dy, rot] of [
            [0, 0, Math.PI / 4],
            [bw * 1.41, 0, -Math.PI / 4],
          ] as const) {
            g.save();
            g.translate(x + dx + (y / 2) % bl, y + dy);
            g.rotate(rot);
            g.fillStyle = shade(r() < 0.5 ? a : b, (r() - 0.5) * 0.06);
            g.fillRect(0, 0, bl, bw);
            g.strokeStyle = "rgba(0,0,0,0.3)";
            g.strokeRect(0, 0, bl, bw);
            g.restore();
          }
        }
      }
      g.restore();
      return 1.6;
    }
    case "concrete":
    case "formwork": {
      blotches(g, 70, 3, 0.06);
      noise(g, 4000, 5);
      if (kind === "formwork") {
        // Panel joints and tie holes, like board-formed concrete.
        g.fillStyle = "rgba(0,0,0,0.12)";
        g.fillRect(0, 0, S, 2);
        g.fillRect(0, 0, 2, S);
        for (const [x, y] of [
          [0.25, 0.25],
          [0.75, 0.25],
          [0.25, 0.75],
          [0.75, 0.75],
        ]) {
          g.fillStyle = "rgba(0,0,0,0.35)";
          g.beginPath();
          g.arc(x * S, y * S, 5, 0, Math.PI * 2);
          g.fill();
        }
        return 2.4;
      }
      return 4;
    }
    case "terrazzo": {
      const r = rng(17);
      const chips = colors.slice(1).length ? colors.slice(1) : ["#ffffff", "#333333"];
      for (let i = 0; i < 900; i++) {
        g.fillStyle = chips[Math.floor(r() * chips.length)];
        g.globalAlpha = 0.6 + r() * 0.4;
        g.beginPath();
        const x = r() * S;
        const y = r() * S;
        const s = 1.5 + r() * 6;
        g.moveTo(x, y);
        for (let k = 0; k < 5; k++) g.lineTo(x + Math.cos(k * 1.3 + r()) * s, y + Math.sin(k * 1.3 + r()) * s);
        g.fill();
      }
      g.globalAlpha = 1;
      return 2;
    }
    case "checker": {
      const n = 4;
      const t = S / n;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          g.fillStyle = (i + j) % 2 ? b : a;
          g.fillRect(i * t, j * t, t, t);
        }
      noise(g, 1500, 9);
      return 2.4;
    }
    case "tiles":
    case "subway": {
      const cols = kind === "subway" ? 4 : 4;
      const rows = kind === "subway" ? 16 : 4;
      const tw = S / cols;
      const th = S / rows;
      const r = rng(23);
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols + 1; i++) {
          const x = i * tw - (kind === "subway" && j % 2 ? tw / 2 : 0);
          g.fillStyle = shade(a, (r() - 0.5) * 0.04);
          g.fillRect(x + 2, j * th + 2, tw - 4, th - 4);
        }
      g.globalCompositeOperation = "destination-over";
      g.fillStyle = b;
      g.fillRect(0, 0, S, S);
      g.globalCompositeOperation = "source-over";
      return kind === "subway" ? 1.2 : 2.4;
    }
    case "hex": {
      // Lozenges: two colors on offset diamond lattices (seamless).
      const step = S / 4;
      g.fillStyle = b;
      g.fillRect(0, 0, S, S);
      for (let i = -1; i <= 4; i++)
        for (let j = -1; j <= 4; j++)
          for (const [ox, oy, col] of [
            [0, 0, a],
            [step / 2, step / 2, c],
          ] as const) {
            const cx = i * step + ox;
            const cy = j * step + oy;
            g.fillStyle = col;
            g.beginPath();
            g.moveTo(cx, cy - step / 2 + 2);
            g.lineTo(cx + step / 2 - 2, cy);
            g.lineTo(cx, cy + step / 2 - 2);
            g.lineTo(cx - step / 2 + 2, cy);
            g.fill();
          }
      return 1.6;
    }
    case "carpet": {
      noise(g, 9000, 31, 255, 0);
      if (colors[1]) {
        // A quiet pattern woven in.
        g.strokeStyle = b;
        g.globalAlpha = 0.35;
        g.lineWidth = 6;
        for (let i = 0; i < 4; i++) {
          g.strokeRect(i * 128 + 24, 24, 80, S - 48);
        }
        g.globalAlpha = 1;
      }
      return 2;
    }
    case "grating": {
      g.fillStyle = shade(a, -0.35);
      g.fillRect(0, 0, S, S);
      const n = 16;
      const t = S / n;
      g.fillStyle = a;
      for (let i = 0; i <= n; i++) {
        g.fillRect(i * t - 3, 0, 6, S);
        g.fillRect(0, i * t - 2, S, 4);
      }
      return 1;
    }
    case "epoxy": {
      blotches(g, 30, 41, 0.035);
      noise(g, 1500, 43);
      return 4;
    }
    case "tatami": {
      // Mats 0.9 × 1.8 m with dark borders, in the classic staggered layout.
      g.fillStyle = a;
      g.fillRect(0, 0, S, S);
      const r = rng(47);
      for (let i = 0; i < 120; i++) {
        g.fillStyle = `rgba(80,70,30,${0.05 + r() * 0.05})`;
        g.fillRect(0, r() * S, S, 1);
      }
      g.strokeStyle = b;
      g.lineWidth = 8;
      g.strokeRect(4, 4, S / 2 - 8, S - 8);
      g.strokeRect(S / 2 + 4, 4, S / 2 - 8, S / 2 - 8);
      g.strokeRect(S / 2 + 4, S / 2 + 4, S / 2 - 8, S / 2 - 8);
      return 1.8;
    }
    case "turf": {
      const r = rng(53);
      for (let i = 0; i < 6000; i++) {
        g.fillStyle = shade(a, (r() - 0.5) * 0.18);
        g.fillRect(r() * S, r() * S, 1.5, 4);
      }
      return 2;
    }
    case "blueprint": {
      g.strokeStyle = "rgba(255,255,255,0.12)";
      g.lineWidth = 1;
      for (let i = 0; i <= 16; i++) {
        g.beginPath();
        g.moveTo(i * 32, 0);
        g.lineTo(i * 32, S);
        g.moveTo(0, i * 32);
        g.lineTo(S, i * 32);
        g.stroke();
      }
      g.strokeStyle = "rgba(255,255,255,0.28)";
      g.lineWidth = 2;
      for (let i = 0; i <= 4; i++) {
        g.beginPath();
        g.moveTo(i * 128, 0);
        g.lineTo(i * 128, S);
        g.moveTo(0, i * 128);
        g.lineTo(S, i * 128);
        g.stroke();
      }
      return 2;
    }
    case "rubber": {
      noise(g, 3000, 59);
      const r = rng(61);
      for (let i = 0; i < 260; i++) {
        g.fillStyle = colors.slice(1)[i % Math.max(1, colors.length - 1)] ?? c;
        g.fillRect(r() * S, r() * S, 3, 3);
      }
      return 2;
    }
    case "stone": {
      // Irregular flagstones (floors) or ashlar blocks (walls).
      const r = rng(67);
      const rows = 4;
      const h = S / rows;
      for (let j = 0; j < rows; j++) {
        let x = -r() * 80;
        while (x < S) {
          const w = 90 + r() * 120;
          g.fillStyle = shade(a, (r() - 0.5) * 0.12);
          g.fillRect(x + 3, j * h + 3, w - 6, h - 6);
          x += w;
        }
      }
      g.globalCompositeOperation = "destination-over";
      g.fillStyle = b;
      g.fillRect(0, 0, S, S);
      g.globalCompositeOperation = "source-over";
      noise(g, 3000, 71);
      return 2.4;
    }
    case "plaster": {
      blotches(g, 50, 73, 0.035);
      noise(g, 2500, 79);
      return 3;
    }
    case "brick": {
      const rows = 16;
      const h = S / rows;
      const w = S / 4;
      const r = rng(83);
      g.fillStyle = b;
      g.fillRect(0, 0, S, S);
      for (let j = 0; j < rows; j++)
        for (let i = -1; i < 5; i++) {
          const x = i * w + (j % 2 ? w / 2 : 0);
          g.fillStyle = shade(a, (r() - 0.5) * 0.14);
          g.fillRect(x + 3, j * h + 3, w - 6, h - 6);
        }
      noise(g, 3000, 89);
      return 1.3;
    }
    case "slats": {
      const n = 12;
      const w = S / n;
      const r = rng(97);
      g.fillStyle = shade(a, -0.35);
      g.fillRect(0, 0, S, S);
      for (let i = 0; i < n; i++) {
        g.fillStyle = shade(a, (r() - 0.5) * 0.08);
        g.fillRect(i * w + 3, 0, w - 6, S);
        for (let k = 0; k < 5; k++) {
          g.fillStyle = "rgba(0,0,0,0.05)";
          g.fillRect(i * w + 3 + r() * (w - 8), 0, 1, S);
        }
      }
      return 1.2;
    }
    case "corrugated": {
      for (let i = 0; i < 32; i++) {
        const grad = g.createLinearGradient(i * 16, 0, i * 16 + 16, 0);
        grad.addColorStop(0, shade(a, -0.1));
        grad.addColorStop(0.5, shade(a, 0.08));
        grad.addColorStop(1, shade(a, -0.1));
        g.fillStyle = grad;
        g.fillRect(i * 16, 0, 16, S);
      }
      noise(g, 1200, 101);
      return 1;
    }
    case "blackboard": {
      blotches(g, 40, 103, 0.04);
      const r = rng(107);
      g.strokeStyle = "rgba(255,255,255,0.05)";
      for (let i = 0; i < 30; i++) {
        g.lineWidth = 8 + r() * 20;
        g.beginPath();
        const x = r() * S;
        const y = r() * S;
        g.moveTo(x, y);
        g.quadraticCurveTo(x + 60, y + (r() - 0.5) * 60, x + 140, y);
        g.stroke();
      }
      return 3;
    }
    case "panel": {
      // Paneled wainscot-style squares.
      g.strokeStyle = b;
      g.lineWidth = 10;
      g.strokeRect(20, 20, S / 2 - 40, S / 2 - 40);
      g.strokeRect(S / 2 + 20, 20, S / 2 - 40, S / 2 - 40);
      g.strokeRect(20, S / 2 + 20, S / 2 - 40, S / 2 - 40);
      g.strokeRect(S / 2 + 20, S / 2 + 20, S / 2 - 40, S / 2 - 40);
      noise(g, 1500, 109);
      return 1.6;
    }
  }
  return 2;
}

const cache = new Map<string, THREE.MeshStandardMaterial>();

/** The material for a surface look. Floors and walls of every size share it. */
export function surfaceMaterial(spec: SurfaceSpec<FloorKind | WallKind>, extra: { roughness?: number; metalness?: number } = {}) {
  const key = `${spec.kind}|${spec.colors.join(",")}|${extra.roughness ?? ""}|${extra.metalness ?? ""}`;
  let m = cache.get(key);
  if (m || typeof document === "undefined") return m!;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const tile = paint(canvas.getContext("2d")!, spec.kind, spec.colors);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;
  const glossy = spec.kind === "epoxy" || spec.kind === "terrazzo" || spec.kind === "checker" || spec.kind === "subway" || spec.kind === "tiles";
  m = new THREE.MeshStandardMaterial({
    map,
    roughness: extra.roughness ?? (glossy ? 0.18 : spec.kind === "carpet" || spec.kind === "turf" || spec.kind === "tatami" ? 1 : 0.7),
    metalness: extra.metalness ?? (spec.kind === "grating" || spec.kind === "corrugated" ? 0.6 : 0.02),
    envMapIntensity: glossy ? 1.3 : 0.7,
  });
  worldMapped(m, tile, spec.kind === "concrete" || spec.kind === "plaster" ? 0.08 : 0.03);
  cache.set(key, m);
  return m;
}

/** A plain colored material (cached). */
const plainCache = new Map<string, THREE.MeshStandardMaterial>();
export function flat(color: string, roughness = 0.6, metalness = 0, emissive?: string, emissiveIntensity = 1) {
  const key = `${color}|${roughness}|${metalness}|${emissive ?? ""}|${emissiveIntensity}`;
  let m = plainCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...(emissive ? { emissive, emissiveIntensity, toneMapped: false } : {}) });
    plainCache.set(key, m);
  }
  return m;
}
