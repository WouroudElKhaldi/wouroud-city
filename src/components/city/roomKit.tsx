"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Batch, plain } from "./Furniture";
import { useRoom } from "./InteriorScene";
import { finishes } from "./luxury";
import { canvasTexture } from "./TradingFloor";

/**
 * Shared pieces for the brand-styled rooms (Develeb, Codi Tech, Life Sculptor, the Reltrix
 * showroom): canvas drawing helpers for "website sections" on walls, a framed canvas panel,
 * and a modern room shell whose colors come from the brand.
 */

// ---------------------------------------------------------------------------
// Canvas helpers
// ---------------------------------------------------------------------------

export const FONT = `"Segoe UI", Helvetica, Arial, sans-serif`;
export const font = (px: number, weight = "") => `${weight} ${Math.round(px)}px ${FONT}`;

/** Draws text wrapped to `max` px wide; returns the y below the last line. */
export function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, line: number) {
  let row = "";
  for (const word of text.split(" ")) {
    const next = row ? `${row} ${word}` : word;
    if (ctx.measureText(next).width > max && row) {
      ctx.fillText(row, x, y);
      y += line;
      row = word;
    } else row = next;
  }
  if (row) ctx.fillText(row, x, y);
  return y + line;
}

/** A rounded rectangle, filled and/or outlined. */
export function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill?: string, stroke?: string, lineWidth = 2) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

/** A grid of small dots. */
export function dots(ctx: CanvasRenderingContext2D, x: number, y: number, cols: number, rows: number, gap: number, color = "rgba(255,255,255,0.8)") {
  ctx.fillStyle = color;
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++) {
      ctx.beginPath();
      ctx.arc(x + c * gap, y + r * gap, gap * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
}

/** A canvas texture drawn once; a new `key` draws it again. */
export function useCanvas(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, key: string | number = 0) {
  const made = useMemo(() => {
    const { ctx, texture } = canvasTexture(w, h);
    draw(ctx, w, h);
    texture.needsUpdate = true;
    return { ctx, texture };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, h, key]);
  useEffect(() => () => made.texture.dispose(), [made]);
  return made;
}

/** A flat canvas panel with a slim frame. Faces +z. */
export function Panel({
  position,
  rotationY = 0,
  width,
  height,
  map,
  frame = "#0b1b2b",
  onClick,
}: {
  position: [number, number, number];
  rotationY?: number;
  width: number;
  height: number;
  map: THREE.Texture;
  frame?: string;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
}) {
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh position={[0, 0, -0.025]} material={plain(frame, 0.4)}>
        <boxGeometry args={[width + 0.08, height + 0.08, 0.04]} />
      </mesh>
      <mesh onClick={onClick}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={map} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Floors
// ---------------------------------------------------------------------------

const floorCache = new Map<string, THREE.CanvasTexture>();

function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Polished concrete: soft clouds and fine aggregate, 4 m slabs. */
function concrete(size: number) {
  const { ctx, texture } = canvasTexture(size, size);
  const r = seeded(7);
  ctx.fillStyle = "#c9ccce";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 160; i++) {
    const v = r() < 0.5 ? 255 : 90;
    ctx.fillStyle = `rgba(${v},${v},${v + 4},0.025)`;
    ctx.beginPath();
    ctx.arc(r() * size, r() * size, 30 + r() * 90, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 5000; i++) {
    const v = r() < 0.5 ? 255 : 70;
    ctx.fillStyle = `rgba(${v},${v},${v},0.12)`;
    ctx.fillRect(r() * size, r() * size, 1 + r() * 1.5, 1 + r() * 1.5);
  }
  ctx.strokeStyle = "rgba(60,64,70,0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, size, size);
  return texture;
}

/** Light oak planks, staggered. The texture covers 4 m. */
function oak(size: number) {
  const { ctx, texture } = canvasTexture(size, size);
  const r = seeded(13);
  const plank = size / 20;
  for (let row = 0; row < 20; row++) {
    let x = -(r() * size) / 2;
    while (x < size) {
      const len = size * (0.3 + r() * 0.4);
      const tone = 200 + r() * 26;
      ctx.fillStyle = `rgb(${tone},${tone * 0.8},${tone * 0.6})`;
      ctx.fillRect(x, row * plank, len, plank);
      for (let k = 0; k < 6; k++) {
        ctx.strokeStyle = `rgba(120,80,40,${0.05 + r() * 0.08})`;
        ctx.lineWidth = 1;
        const y = row * plank + r() * plank;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(x + len / 3, y + (r() - 0.5) * 6, x + (2 * len) / 3, y + (r() - 0.5) * 6, x + len, y);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(90,60,30,0.35)";
      ctx.strokeRect(x, row * plank, len, plank);
      x += len;
    }
  }
  return texture;
}

/** Pale terrazzo with colored chips. */
function terrazzo(size: number, chips: string[]) {
  const { ctx, texture } = canvasTexture(size, size);
  const r = seeded(19);
  ctx.fillStyle = "#eef2f1";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = chips[Math.floor(r() * chips.length)];
    ctx.globalAlpha = 0.35 + r() * 0.5;
    ctx.beginPath();
    const x = r() * size;
    const y = r() * size;
    const s = 1.5 + r() * 5;
    ctx.moveTo(x, y);
    ctx.lineTo(x + s, y + r() * s);
    ctx.lineTo(x + r() * s, y + s);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return texture;
}

export type FloorKind = "concrete" | "oak" | "terrazzo";

function floorTexture(kind: FloorKind, W: number, D: number, chips: string[]) {
  const key = `${kind}:${W}x${D}:${chips.join()}`;
  let t = floorCache.get(key);
  if (!t) {
    t = kind === "oak" ? oak(1024) : kind === "terrazzo" ? terrazzo(512, chips) : concrete(512);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(W / 4, D / 4);
    t.needsUpdate = true;
    floorCache.set(key, t);
  }
  return t;
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

export type ShellLook = {
  floor: FloorKind;
  /** Chip colors for terrazzo. */
  chips?: string[];
  wall: string;
  /** The band along the bottom of the walls, and the one under the ceiling. */
  wainscot: string;
  /** The glowing line on top of the wainscot. */
  line: string;
  ceiling: string;
  column: string;
  /** Joists across the ceiling (dark steel), or a clean ceiling. */
  joists?: boolean;
  /** Column positions along both side walls. */
  columnsZ: number[];
  /** Clerestory window centers along both side walls (8 m long each). */
  windowsZ: number[];
  /** Pendant LED bars: x and z rows. */
  lightsX: number[];
  lightsZ: number[];
  /** Where the room's point lights hang. */
  lamps: [number, number][];
  lampColor?: string;
};

/** A modern room in a brand's colors: floor, walls with a wainscot and glowing line, ceiling, windows, lights. */
export function ModernShell({ look }: { look: ShellLook }) {
  const { width: W, depth: D, height: H } = useRoom();
  const f = finishes();
  const floor = useMemo(() => floorTexture(look.floor, W, D, look.chips ?? []), [look.floor, look.chips, W, D]);
  const walls = [
    { side: "back" as const, pos: [0, 0, -D / 2] as const, rot: 0, len: W },
    { side: "front" as const, pos: [0, 0, D / 2] as const, rot: Math.PI, len: W },
    { side: "left" as const, pos: [-W / 2, 0, 0] as const, rot: Math.PI / 2, len: D },
    { side: "right" as const, pos: [W / 2, 0, 0] as const, rot: -Math.PI / 2, len: D },
  ];
  const glow = useMemo(() => new THREE.MeshStandardMaterial({ color: look.line, emissive: look.line, emissiveIntensity: 1.4, toneMapped: false }), [look.line]);
  const ledBar = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#f6fbff", emissiveIntensity: 2, toneMapped: false }), []);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[W / 2 + 1, 0.5, D / 2 + 1]} position={[0, -0.5, 0]} />
        <CuboidCollider args={[W / 2 + 1, H, 0.5]} position={[0, H, -D / 2 - 0.5]} />
        <CuboidCollider args={[W / 2 + 1, H, 0.5]} position={[0, H, D / 2 + 0.5]} />
        <CuboidCollider args={[0.5, H, D / 2 + 1]} position={[-W / 2 - 0.5, H, 0]} />
        <CuboidCollider args={[0.5, H, D / 2 + 1]} position={[W / 2 + 0.5, H, 0]} />
      </RigidBody>
      <Batch>
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[W, D]} />
          <meshStandardMaterial map={floor} roughness={look.floor === "oak" ? 0.45 : 0.32} metalness={0.05} envMapIntensity={1.2} />
        </mesh>
        {walls.map(({ side, pos, rot, len }) => (
          <group key={side} position={[pos[0], pos[1], pos[2]]} rotation-y={rot}>
            <mesh position={[0, H / 2, 0]} material={plain(look.wall, 0.85)} receiveShadow>
              <planeGeometry args={[len, H]} />
            </mesh>
            <mesh position={[0, 0.6, 0.012]} material={plain(look.wainscot, 0.6)}>
              <planeGeometry args={[len, 1.2]} />
            </mesh>
            <mesh position={[0, 0.05, 0.016]} material={plain("#0b1220", 0.5)}>
              <planeGeometry args={[len, 0.1]} />
            </mesh>
            <mesh position={[0, H - 0.2, 0.012]} material={plain(look.wainscot, 0.6)}>
              <planeGeometry args={[len, 0.4]} />
            </mesh>
          </group>
        ))}
        <mesh rotation-x={Math.PI / 2} position={[0, H, 0]} material={plain(look.ceiling, 0.9)}>
          <planeGeometry args={[W, D]} />
        </mesh>
        {look.joists &&
          Array.from({ length: Math.floor(W / 3) }, (_, i) => -W / 2 + 1.5 + i * 3).map((x) => (
            <mesh key={x} position={[x, H - 0.18, 0]} material={f.blackMetal}>
              <boxGeometry args={[0.14, 0.36, D]} />
            </mesh>
          ))}
        {look.columnsZ.flatMap((z) =>
          [-1, 1].map((s) => (
            <mesh key={`${z}${s}`} position={[s * (W / 2 - 0.2), H / 2, z]} material={plain(look.column, 0.5)} castShadow>
              <boxGeometry args={[0.4, H, 0.4]} />
            </mesh>
          )),
        )}
        {[-1, 1].flatMap((s) =>
          look.windowsZ.map((z) => (
            <group key={`${s}${z}`} position={[s * (W / 2 - 0.02), H - 0.72, z]} rotation-y={-s * (Math.PI / 2)}>
              <mesh>
                <planeGeometry args={[8, 0.8]} />
                <meshStandardMaterial color="#a9d6f5" emissive="#d6efff" emissiveIntensity={0.9} />
              </mesh>
              {Array.from({ length: 9 }, (_, k) => (
                <mesh key={k} position={[-4 + k, 0, 0.02]} material={f.blackMetal}>
                  <boxGeometry args={[0.05, 0.85, 0.04]} />
                </mesh>
              ))}
              {[-0.4, 0, 0.4].map((y) => (
                <mesh key={y} position={[0, y, 0.02]} material={f.blackMetal}>
                  <boxGeometry args={[8.05, 0.05, 0.04]} />
                </mesh>
              ))}
            </group>
          )),
        )}
      </Batch>
      {walls.map(({ side, pos, rot, len }) => (
        <mesh
          key={side}
          position={[pos[0] + (side === "left" ? 0.02 : side === "right" ? -0.02 : 0), 1.21, pos[2] + (side === "back" ? 0.02 : side === "front" ? -0.02 : 0)]}
          rotation-y={rot}
          material={glow}
        >
          <planeGeometry args={[len, 0.035]} />
        </mesh>
      ))}
      {look.lightsZ.flatMap((z) =>
        look.lightsX.map((x) => (
          <group key={`${x}${z}`} position={[x, H - 1.1, z]}>
            <mesh material={f.blackMetal}>
              <boxGeometry args={[4, 0.07, 0.12]} />
            </mesh>
            <mesh position={[0, -0.04, 0]} material={ledBar}>
              <boxGeometry args={[3.9, 0.012, 0.08]} />
            </mesh>
            {[-1.8, 1.8].map((dx) => (
              <mesh key={dx} position={[dx, 0.55, 0]} material={f.blackMetal}>
                <cylinderGeometry args={[0.004, 0.004, 1.1, 4]} />
              </mesh>
            ))}
          </group>
        )),
      )}
      {look.lamps.map(([x, z]) => (
        <pointLight key={`${x}${z}`} position={[x, H - 1.4, z]} intensity={11} distance={13} decay={2} color={look.lampColor ?? "#f4fbff"} />
      ))}
    </group>
  );
}
