"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { registerNightGlow } from "@/world/env";
import { palette } from "@/world/palette";

// ---------------------------------------------------------------------------
// Facade textures
// ---------------------------------------------------------------------------

/** Windows per side of the shared facade tile. */
const TILE = 6;
let facadeTextures: { color: THREE.CanvasTexture; glow: THREE.CanvasTexture } | null = null;

/**
 * A 6×6 block of windows tiled across every facade. The color map gives glass in
 * daylight; the glow map lights a random mix of windows at night (some bright,
 * some dim, some dark) so buildings look lived in rather than floodlit.
 */
function getFacadeTextures() {
  if (facadeTextures) return facadeTextures;
  const cell = 64;
  const size = cell * TILE;
  const make = () => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    return [canvas, canvas.getContext("2d")!] as const;
  };
  const [colorCanvas, color] = make();
  const [glowCanvas, glow] = make();
  color.fillStyle = "#ffffff";
  color.fillRect(0, 0, size, size);
  glow.fillStyle = "#000000";
  glow.fillRect(0, 0, size, size);

  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let row = 0; row < TILE; row++) {
    // Floor slab line between storeys
    color.fillStyle = "rgba(30,20,60,0.18)";
    color.fillRect(0, row * cell, size, 5);
    for (let col = 0; col < TILE; col++) {
      const x = col * cell + 10;
      const y = row * cell + 14;
      const w = cell - 20;
      const h = cell - 22;
      const grad = color.createLinearGradient(x, y, x + w, y + h);
      grad.addColorStop(0, "#dde4ff");
      grad.addColorStop(1, "#9fa8e8");
      color.fillStyle = grad;
      color.fillRect(x, y, w, h);
      color.fillStyle = "rgba(255,255,255,0.5)";
      color.fillRect(x + 3, y + 3, w * 0.25, h - 6);
      color.fillStyle = "rgba(40,30,80,0.55)";
      color.fillRect(x + w / 2 - 1, y, 2, h);
      const r = random();
      const level = r < 0.3 ? 0 : r < 0.55 ? 0.35 : r < 0.85 ? 0.75 : 1;
      glow.fillStyle = `rgba(255, ${Math.round(200 + 40 * random())}, ${Math.round(150 + 60 * random())}, ${level})`;
      glow.fillRect(x, y, w, h);
    }
  }

  const finish = (canvas: HTMLCanvasElement) => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    return tex;
  };
  facadeTextures = { color: finish(colorCanvas), glow: finish(glowCanvas) };
  return facadeTextures;
}

export function makeFacade(color: string, width: number, floors: number, seed: number, glass = false) {
  const { color: colorTex, glow: glowTex } = getFacadeTextures();
  const repeat = (t: THREE.CanvasTexture) => {
    const c = t.clone();
    c.repeat.set(Math.max(1, Math.round(width / 3)) / TILE, floors / TILE);
    c.offset.set(seed % 1, 0);
    c.needsUpdate = true;
    return c;
  };
  return new THREE.MeshStandardMaterial({
    color,
    map: repeat(colorTex),
    emissive: palette.window,
    emissiveMap: repeat(glowTex),
    emissiveIntensity: 0,
    roughness: glass ? 0.12 : 0.5,
    metalness: glass ? 0.65 : 0.15,
    envMapIntensity: glass ? 1.4 : 0.6,
  });
}

/** A material whose emissive glow follows the night factor. */
export function useGlowMaterial(color: string, day: number, night: number, base = "#ffffff") {
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: base, emissive: color, emissiveIntensity: day, toneMapped: false }),
    [color, day, base],
  );
  useEffect(() => registerNightGlow(material, day, night), [material, day, night]);
  return material;
}

export function useFacade(color: string, width: number, floors: number, seed: number, glass = false) {
  const material = useMemo(() => makeFacade(color, width, floors, seed, glass), [color, width, floors, seed, glass]);
  useEffect(() => registerNightGlow(material, 0, 0.95), [material]);
  return material;
}

