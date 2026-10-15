"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { BuildingSpec } from "@/world/layout";
import { surface } from "./surfaces";
import { Text } from "./Text3D";

/**
 * Street-facing details that make a block look lived in:
 *  - French balconies under the upper-floor windows: a stone ledge, an iron railing and, on most, a
 *    flower box. They line up with the windows of the facade texture (materials.ts tiles a 6×6 block of
 *    windows; the street face shows round(width / 3) columns, shifted by the building's seed).
 *  - For the neighborhood shops: striped awnings over the ground-floor windows and a hanging blade sign
 *    you can read from along the sidewalk.
 * Each building's pieces are merged per material, so this costs a few draw calls per building.
 */

const IRON = new THREE.MeshStandardMaterial({ color: "#26232c", metalness: 0.7, roughness: 0.45 });
const SOIL = new THREE.MeshStandardMaterial({ color: "#3d2a1c", roughness: 1 });
const LEAVES = new THREE.MeshStandardMaterial({ color: "#3f7a3a", roughness: 0.9 });
const BLOOMS = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.7, vertexColors: true });
const FLOWER_COLORS = ["#f472b6", "#ef4444", "#fbbf24", "#f8fafc", "#a78bfa"].map((c) => new THREE.Color(c));

/** Keeps only position/normal/uv (and color when asked) so mixed primitives merge. */
function merge(list: THREE.BufferGeometry[], withColor = false) {
  if (!list.length) return null;
  const keep = withColor ? ["position", "normal", "uv", "color"] : ["position", "normal", "uv"];
  return mergeGeometries(
    list.map((g) => {
      const n = g.index ? g.toNonIndexed() : g;
      for (const k of Object.keys(n.attributes)) if (!keep.includes(k)) n.deleteAttribute(k);
      return n;
    }),
  );
}

function tint(g: THREE.BufferGeometry, c: THREE.Color) {
  const n = g.attributes.position.count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(colors, i * 3);
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return g;
}

/** Window column centers along the street face, as z positions. */
function windowColumns(spec: BuildingSpec, seed: number) {
  const cols = Math.max(1, Math.round(spec.width / 3));
  const off = seed % 1;
  const out: number[] = [];
  for (let k = -6; k < 12; k++) {
    const u = (k + 0.5 - 6 * off) / cols;
    if (u <= 0.04 || u >= 0.96) continue;
    // BoxGeometry's +x face runs u from +z to -z, the -x face from -z to +z.
    out.push(spec.facing === 1 ? spec.depth / 2 - u * spec.depth : -spec.depth / 2 + u * spec.depth);
  }
  return { zs: out, colWidth: spec.depth / cols };
}

export function Balconies({ spec, seed }: { spec: BuildingSpec; seed: number }) {
  const parts = useMemo(() => {
    const { width, height, floors, facing } = spec;
    const front = (facing * width) / 2;
    const out = (d: number) => front + facing * d;
    const storey = (height - 0.4) / floors;
    const { zs, colWidth } = windowColumns(spec, seed);
    const w = Math.min(colWidth * 0.78, 1.9);
    const stone: THREE.BufferGeometry[] = [];
    const iron: THREE.BufferGeometry[] = [];
    const soil: THREE.BufferGeometry[] = [];
    const leaves: THREE.BufferGeometry[] = [];
    const blooms: THREE.BufferGeometry[] = [];
    let n = Math.floor(seed * 7);
    // The ground floor has the shop/lobby and the first floor the name sign: balconies start above.
    for (let f = 2; f < floors; f++) {
      zs.forEach((z, k) => {
        n++;
        // A checkerboard, with a few gaps so it isn't too regular.
        if ((k + f) % 2 === 1 || n % 7 === 3) return;
        const y = 0.4 + f * storey + 0.32;
        stone.push(new THREE.BoxGeometry(0.62, 0.12, w + 0.2).translate(out(0.3), y, z));
        // Railing: top and bottom bars and balusters on the three open sides.
        iron.push(new THREE.BoxGeometry(0.04, 0.04, w + 0.1).translate(out(0.58), y + 0.95, z));
        iron.push(new THREE.BoxGeometry(0.03, 0.03, w + 0.1).translate(out(0.58), y + 0.18, z));
        for (const side of [-1, 1]) iron.push(new THREE.BoxGeometry(0.56, 0.04, 0.04).translate(out(0.3), y + 0.95, z + (side * (w + 0.1)) / 2));
        const bars = Math.max(3, Math.round(w / 0.16));
        for (let b = 0; b <= bars; b++) iron.push(new THREE.BoxGeometry(0.02, 0.9, 0.02).translate(out(0.58), y + 0.5, z - w / 2 - 0.05 + ((w + 0.1) * b) / bars));
        for (const side of [-1, 1]) for (const d of [0.12, 0.3, 0.46]) iron.push(new THREE.BoxGeometry(0.02, 0.9, 0.02).translate(out(d), y + 0.5, z + (side * (w + 0.1)) / 2));
        // A flower box hung on the railing on most balconies.
        if (n % 4 !== 0) {
          stone.push(new THREE.BoxGeometry(0.2, 0.18, w * 0.8).translate(out(0.72), y + 0.86, z));
          soil.push(new THREE.BoxGeometry(0.17, 0.02, w * 0.78).translate(out(0.72), y + 0.95, z));
          const tufts = Math.max(3, Math.round(w / 0.22));
          for (let t = 0; t < tufts; t++) {
            const tz = z - (w * 0.36) + ((w * 0.72) * t) / Math.max(1, tufts - 1);
            leaves.push(new THREE.IcosahedronGeometry(0.1 + ((t + n) % 3) * 0.02, 0).translate(out(0.72), y + 1.03, tz));
            if ((t + n) % 2 === 0) blooms.push(tint(new THREE.IcosahedronGeometry(0.055, 0).translate(out(0.75), y + 1.12, tz), FLOWER_COLORS[(n + t) % FLOWER_COLORS.length]));
          }
        }
      });
    }
    return { stone: merge(stone), iron: merge(iron), soil: merge(soil), leaves: merge(leaves), blooms: merge(blooms, true) };
  }, [spec, seed]);
  useEffect(() => () => Object.values(parts).forEach((g) => g?.dispose()), [parts]);
  return (
    <group>
      {parts.stone && <mesh geometry={parts.stone} material={surface("granite", "#e7e1d6")} castShadow receiveShadow />}
      {parts.iron && <mesh geometry={parts.iron} material={IRON} castShadow />}
      {parts.soil && <mesh geometry={parts.soil} material={SOIL} />}
      {parts.leaves && <mesh geometry={parts.leaves} material={LEAVES} castShadow />}
      {parts.blooms && <mesh geometry={parts.blooms} material={BLOOMS} />}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Shop fronts
// ---------------------------------------------------------------------------

let stripes: THREE.CanvasTexture | null = null;
/** White and light-grey awning stripes; the material color tints them. */
function stripeTexture() {
  if (stripes) return stripes;
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 8;
  const g = c.getContext("2d")!;
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? "#ffffff" : "#7a7a7a";
    g.fillRect(i * 16, 0, 16, 8);
  }
  stripes = new THREE.CanvasTexture(c);
  stripes.colorSpace = THREE.SRGBColorSpace;
  stripes.wrapS = THREE.RepeatWrapping;
  return stripes;
}

const awningMaterials = new Map<string, THREE.MeshStandardMaterial>();
function awningMaterial(color: string) {
  let m = awningMaterials.get(color);
  if (!m) {
    const c = new THREE.Color(color);
    // Light colors would wash out to white; keep the stripes readable.
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    c.setHSL(hsl.h, Math.max(0.55, hsl.s), Math.min(0.5, hsl.l));
    m = new THREE.MeshStandardMaterial({ color: c, map: stripeTexture(), roughness: 0.85, side: THREE.DoubleSide });
    awningMaterials.set(color, m);
  }
  return m;
}

/** Awnings either side of the door and a blade sign at the corner, for the neighborhood shops. */
export function Shopfront({ spec }: { spec: BuildingSpec }) {
  const { width, depth, facing, color, label } = spec;
  const front = (facing * width) / 2;
  const doorWidth = Math.min(3.2, depth * 0.45);
  const start = doorWidth / 2 + 1.05;
  const end = depth / 2 - 0.35;
  const span = end - start;
  const material = awningMaterial(color);
  const awning = useMemo(() => {
    if (span < 1) return null;
    // A sloped canvas with a short valance at the front, one per side.
    const parts: THREE.BufferGeometry[] = [];
    for (const side of [-1, 1]) {
      const z = side * (start + span / 2);
      const slope = new THREE.PlaneGeometry(span, 1.25);
      // Map the stripes along the awning's length.
      const uv = slope.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (span / 0.9));
      slope.rotateX(-Math.PI / 2 + 0.42).rotateY(facing === 1 ? Math.PI / 2 : -Math.PI / 2);
      slope.translate(front + facing * 0.58, 2.66, z);
      const valance = new THREE.PlaneGeometry(span, 0.22);
      const vuv = valance.attributes.uv;
      for (let i = 0; i < vuv.count; i++) vuv.setX(i, vuv.getX(i) * (span / 0.9));
      valance.rotateY(facing === 1 ? Math.PI / 2 : -Math.PI / 2).translate(front + facing * 1.15, 2.31, z);
      parts.push(slope, valance);
    }
    return merge(parts);
  }, [front, facing, start, span]);
  useEffect(() => () => awning?.dispose(), [awning]);

  // The blade sign hangs at the corner of the shop, perpendicular to the facade.
  const bladeZ = depth / 2 - 0.5;
  const bladeX = front + facing * 0.95;
  const name = label.length > 14 ? label.split(" ")[0] : label;
  return (
    <group>
      {awning && <mesh geometry={awning} material={material} castShadow receiveShadow />}
      <mesh position={[front + facing * 0.55, 3.72, bladeZ]} material={IRON}>
        <boxGeometry args={[1.1, 0.05, 0.05]} />
      </mesh>
      {[-0.32, 0.32].map((dx) => (
        <mesh key={dx} position={[bladeX + dx, 3.6, bladeZ]} material={IRON}>
          <boxGeometry args={[0.015, 0.2, 0.015]} />
        </mesh>
      ))}
      <mesh position={[bladeX, 3.18, bladeZ]} castShadow>
        <boxGeometry args={[0.86, 0.66, 0.06]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      <mesh position={[bladeX, 3.18, bladeZ]}>
        <boxGeometry args={[0.92, 0.72, 0.04]} />
        <meshStandardMaterial color="#c9a24a" metalness={0.85} roughness={0.3} />
      </mesh>
      {[1, -1].map((s) => (
        <Text
          key={s}
          position={[bladeX, 3.18, bladeZ + s * 0.035]}
          rotation-y={s === 1 ? 0 : Math.PI}
          fontSize={Math.min(0.17, 1.3 / Math.max(6, name.length))}
          maxWidth={0.76}
          textAlign="center"
          anchorX="center"
          anchorY="middle"
          color="#ffffff"
          outlineWidth={0.008}
          outlineColor="#1a103d"
        >
          {name}
        </Text>
      ))}
    </group>
  );
}

