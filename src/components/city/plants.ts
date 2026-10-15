import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { type FoliageKey, seeded } from "@/world/foliage";
import { surface, surfaceTexture } from "./surfaces";

/**
 * Realistic plants, generated in code: bark-textured trunks and branches (tapered tubes along bent
 * paths) with crowns of leaf cards (alpha-tested twig textures), conifers with drooping needle
 * whorls, palms with arching fronds, leafy bushes, flower clumps, grass tufts, smooth mushrooms,
 * noise-shaped rocks, stumps and logs.
 *
 * Each species is built once and drawn instanced by Foliage.tsx, one draw call per part. Parts
 * flagged `isLeaf` are tinted per instance from the item's leaf palette (their textures are
 * near-white for that reason). Geometry is in "model units": Foliage scales it by
 * FOLIAGE[key].scale * size, the same contract the old Kenney models had (≈1 unit ≈ 4.5 m).
 */

export type PlantPart = { geometry: THREE.BufferGeometry; material: THREE.Material; isLeaf: boolean };

const cache = new Map<FoliageKey, PlantPart[]>();

export function plantParts(key: FoliageKey): PlantPart[] {
  let parts = cache.get(key);
  if (!parts) {
    parts = build(key);
    cache.set(key, parts);
  }
  return parts;
}

// ---------------------------------------------------------------------------------------------
// Shared materials
// ---------------------------------------------------------------------------------------------

const wind = { value: 0 };
/** Advanced by Foliage once per frame. */
export function advanceWind(delta: number) {
  wind.value += delta;
}

/** Leaves sway a little, more at the tips (uv.y) and with height; each plant has its own phase. */
function swaying(m: THREE.MeshStandardMaterial, amount: number) {
  m.customProgramCacheKey = () => `sway-${amount}`;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = wind;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uWind;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 plantRoot = instanceMatrix[3].xyz;
        #else
          vec3 plantRoot = vec3(0.0);
        #endif
        float swayH = max(position.y, 0.0);
        float phase = uWind * 1.3 + plantRoot.x * 0.21 + plantRoot.z * 0.17;
        transformed.x += sin(phase + position.y * 2.0) * ${amount.toFixed(3)} * swayH;
        transformed.z += cos(phase * 0.8 + position.x * 3.0) * ${(amount * 0.7).toFixed(3)} * swayH;`,
      );
  };
  return m;
}

const mats = new Map<string, THREE.MeshStandardMaterial>();
function cardMaterial(texture: "leaves" | "needles" | "frond" | "petals", sway: number, roughness = 0.75, color = "#ffffff") {
  const key = `${texture}-${sway}-${roughness}-${color}`;
  let m = mats.get(key);
  if (!m) {
    m = swaying(
      new THREE.MeshStandardMaterial({
        map: surfaceTexture(texture, true),
        alphaTest: 0.45,
        side: THREE.DoubleSide,
        roughness,
        color,
        // Leaves let some light through: a little self-light keeps shaded sides from going black.
        emissive: "#1d2a12",
        emissiveIntensity: 0.25,
      }),
      sway,
    );
    m.name = `plant-${texture}`;
    mats.set(key, m);
  }
  return m;
}

function plainMaterial(color: string, roughness: number, sway = 0) {
  const key = `plain-${color}-${roughness}-${sway}`;
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness });
    if (sway) swaying(m, sway);
    mats.set(key, m);
  }
  return m;
}

function barkMaterial(tint = "#ffffff") {
  return surface("bark", tint, [1, 1]);
}

// ---------------------------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------------------------

type Rand = () => number;

/** A tapered tube along a path, with bark UVs (u around, v along at ~1 repeat per 0.25 units). */
function taperedTube(path: THREE.Vector3[], r0: number, r1: number, sides = 7, vScale = 4) {
  const curve = new THREE.CatmullRomCurve3(path);
  const segs = Math.max(3, path.length * 3);
  const frames = curve.computeFrenetFrames(segs, false);
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const length = curve.getLength();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = curve.getPointAt(t);
    const r = THREE.MathUtils.lerp(r0, r1, t) * (i === 0 ? 1.15 : 1);
    const n = frames.normals[i];
    const b = frames.binormals[i];
    for (let k = 0; k <= sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      const dx = Math.cos(a) * n.x + Math.sin(a) * b.x;
      const dy = Math.cos(a) * n.y + Math.sin(a) * b.y;
      const dz = Math.cos(a) * n.z + Math.sin(a) * b.z;
      pos.push(p.x + dx * r, p.y + dy * r, p.z + dz * r);
      nor.push(dx, dy, dz);
      uv.push((k / sides) * Math.max(1, Math.round(r0 * 30)), t * length * vScale);
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let k = 0; k < sides; k++) {
      const a = i * (sides + 1) + k;
      const b2 = a + sides + 1;
      idx.push(a, b2, a + 1, b2, b2 + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** A bent path from `from` in direction `dir`, `length` long, drooping/curling by `bend`. */
function branchPath(from: THREE.Vector3, dir: THREE.Vector3, length: number, bend: THREE.Vector3, random: Rand, steps = 4) {
  const pts = [from.clone()];
  const d = dir.clone().normalize();
  const p = from.clone();
  for (let i = 0; i < steps; i++) {
    d.addScaledVector(bend, 1 / steps).add(new THREE.Vector3((random() - 0.5) * 0.25, (random() - 0.5) * 0.1, (random() - 0.5) * 0.25)).normalize();
    p.addScaledVector(d, length / steps);
    pts.push(p.clone());
  }
  return pts;
}

/**
 * Leaf cards: quads with random orientation around `center`, normals pointing out from the crown
 * center (soft, rounded shading like a real canopy), UVs on a 2x2 atlas cell.
 */
function cards(
  out: { pos: number[]; nor: number[]; uv: number[] },
  center: THREE.Vector3,
  crown: THREE.Vector3,
  count: number,
  spread: number,
  size: number,
  random: Rand,
  atlas = 2,
) {
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const corners = [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0.5, 0.5],
    [-0.5, 0.5],
  ];
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const c = center
      .clone()
      .add(new THREE.Vector3(random() - 0.5, (random() - 0.5) * 0.8, random() - 0.5).normalize().multiplyScalar(random() ** 0.5 * spread));
    e.set(random() * Math.PI, random() * Math.PI * 2, random() * Math.PI);
    q.setFromEuler(e);
    const s = size * (0.75 + random() * 0.5);
    const n = c.clone().sub(crown).normalize();
    n.y += 0.35;
    n.normalize();
    const cell = Math.floor(random() * atlas * atlas);
    const u0 = (cell % atlas) / atlas;
    const v0 = Math.floor(cell / atlas) / atlas;
    const quad = corners.map(([x, y]) => v.set(x * s, y * s, 0).applyQuaternion(q).add(c).toArray());
    const uvs = corners.map(([x, y]) => [u0 + (x + 0.5) / atlas, v0 + (y + 0.5) / atlas]);
    for (const k of [0, 1, 2, 0, 2, 3]) {
      out.pos.push(...quad[k]);
      out.nor.push(n.x, n.y, n.z);
      out.uv.push(...uvs[k]);
    }
  }
}

function fromArrays(a: { pos: number[]; nor: number[]; uv: number[] }) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(a.pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(a.nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(a.uv, 2));
  return g;
}

function merge(list: THREE.BufferGeometry[]) {
  const clean = list.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const name of Object.keys(n.attributes)) if (!["position", "normal", "uv"].includes(name)) n.deleteAttribute(name);
    return n;
  });
  return mergeGeometries(clean, false)!;
}

// ---------------------------------------------------------------------------------------------
// Species
// ---------------------------------------------------------------------------------------------

type Broadleaf = {
  height: number;
  trunk: number;
  crown: number;
  /** Crown height relative to its width (0.5 = flat umbrella, 1.4 = tall oval) */
  shape: number;
  branches: number;
  leaves: number;
  leafSize: number;
  bark?: string;
  lean?: number;
};

function broadleaf(p: Broadleaf, random: Rand): PlantPart[] {
  const wood: THREE.BufferGeometry[] = [];
  const leaf = { pos: [] as number[], nor: [] as number[], uv: [] as number[] };
  const forkY = p.height * (p.shape < 0.7 ? 0.62 : 0.42);
  const lean = new THREE.Vector3((random() - 0.5) * (p.lean ?? 0.15), 1, (random() - 0.5) * (p.lean ?? 0.15));
  const trunkPath = branchPath(new THREE.Vector3(0, -0.02, 0), lean, forkY, new THREE.Vector3(), random, 4);
  wood.push(taperedTube(trunkPath, p.trunk, p.trunk * 0.7, 9));
  const top = trunkPath[trunkPath.length - 1];
  const crownCenter = new THREE.Vector3(top.x, forkY + p.crown * p.shape * 0.75, top.z);

  for (let i = 0; i < p.branches; i++) {
    const a = (i / p.branches) * Math.PI * 2 + random() * 0.6;
    const up = p.shape < 0.7 ? 0.35 : 0.9 + random() * 0.6;
    const dir = new THREE.Vector3(Math.cos(a), up, Math.sin(a));
    const len = p.crown * (0.75 + random() * 0.4) * (p.shape < 0.7 ? 1.2 : 1);
    const from = trunkPath[2 + Math.floor(random() * (trunkPath.length - 2))].clone();
    const path = branchPath(from, dir, len, new THREE.Vector3(0, p.shape < 0.7 ? -0.2 : 0.15, 0), random, 3);
    wood.push(taperedTube(path, p.trunk * 0.55, p.trunk * 0.12, 6));
    // Twigs off each branch, ending in leaf clusters.
    const tips = [path[path.length - 1]];
    for (let k = 0; k < 2; k++) {
      const base = path[1 + k];
      const tdir = dir.clone().add(new THREE.Vector3((random() - 0.5) * 1.6, 0.4 + random() * 0.6, (random() - 0.5) * 1.6));
      const twig = branchPath(base, tdir, len * 0.5, new THREE.Vector3(), random, 2);
      wood.push(taperedTube(twig, p.trunk * 0.22, p.trunk * 0.06, 5));
      tips.push(twig[twig.length - 1]);
    }
    for (const tip of tips) cards(leaf, tip, crownCenter, Math.round(p.leaves / (p.branches * 3)), p.crown * 0.42, p.leafSize, random);
  }
  // Fill the middle of the crown so it reads as a full canopy.
  cards(leaf, crownCenter, crownCenter, Math.round(p.leaves * 0.25), p.crown * 0.7, p.leafSize * 1.1, random);

  return [
    { geometry: merge(wood), material: barkMaterial(p.bark), isLeaf: false },
    { geometry: fromArrays(leaf), material: cardMaterial("leaves", 0.025), isLeaf: true },
  ];
}

function conifer(p: { height: number; trunk: number; radius: number; whorls: number; round?: boolean }, random: Rand): PlantPart[] {
  const wood: THREE.BufferGeometry[] = [];
  const needles = { pos: [] as number[], nor: [] as number[], uv: [] as number[] };
  wood.push(taperedTube([new THREE.Vector3(0, -0.02, 0), new THREE.Vector3(0, p.height * 0.5, 0), new THREE.Vector3(0, p.height, 0)], p.trunk, p.trunk * 0.15, 8));
  const center = new THREE.Vector3(0, p.height * 0.45, 0);
  for (let w = 0; w < p.whorls; w++) {
    const t = w / (p.whorls - 1);
    const y = p.height * (0.18 + t * 0.78);
    // Cone (or rounded cone) silhouette: wide at the bottom, narrow at the top.
    const r = p.radius * (p.round ? Math.sin((1 - t) * Math.PI * 0.55 + 0.25) : 1 - t * 0.9);
    const arms = Math.max(4, Math.round(7 - t * 3));
    for (let k = 0; k < arms; k++) {
      const a = (k / arms) * Math.PI * 2 + w * 0.7 + random() * 0.4;
      const from = new THREE.Vector3(0, y, 0);
      const dir = new THREE.Vector3(Math.cos(a), -0.15 + t * 0.4, Math.sin(a));
      const path = branchPath(from, dir, r, new THREE.Vector3(0, -0.25, 0), random, 2);
      wood.push(taperedTube(path, p.trunk * 0.3, p.trunk * 0.05, 4));
      // Needle cards along the arm, hanging slightly.
      for (const pt of path.slice(1)) cards(needles, pt, center, 4, r * 0.28 + 0.03, p.radius * 0.55, random, 1);
    }
  }
  // Leader at the top.
  cards(needles, new THREE.Vector3(0, p.height * 0.97, 0), center, 5, p.radius * 0.12, p.radius * 0.4, random, 1);
  return [
    { geometry: merge(wood), material: barkMaterial("#c9b8a8"), isLeaf: false },
    { geometry: fromArrays(needles), material: cardMaterial("needles", 0.015), isLeaf: true },
  ];
}

function palm(p: { height: number; trunk: number; bend: number; fronds: number; frondLength: number }, random: Rand): PlantPart[] {
  const path: THREE.Vector3[] = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    path.push(new THREE.Vector3(Math.sin(t * 1.2) * p.bend, t * p.height, 0));
  }
  const trunk = taperedTube(path, p.trunk, p.trunk * 0.7, 9, 9);
  const top = path[path.length - 1];
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const seg = 7;
  for (let f = 0; f < p.fronds; f++) {
    const a = (f / p.fronds) * Math.PI * 2 + random() * 0.3;
    const rise = 0.5 + random() * 0.5 - (f % 3) * 0.2;
    const len = p.frondLength * (0.8 + random() * 0.35);
    const width = len * 0.42;
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const side = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
    const ring: THREE.Vector3[] = [];
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      // Arch up then droop.
      const y = Math.sin(t * Math.PI * 0.9) * rise * len * 0.35 - t * t * len * 0.45;
      ring.push(top.clone().addScaledVector(dir, t * len).add(new THREE.Vector3(0, y, 0)));
    }
    for (let i = 0; i < seg; i++) {
      const w0 = width * Math.sin(Math.max(0.15, i / seg) * Math.PI) * 0.5;
      const w1 = width * Math.sin(Math.max(0.15, (i + 1) / seg) * Math.PI) * 0.5;
      // Leaflets droop down at the sides (a shallow V).
      const droop = new THREE.Vector3(0, -width * 0.12, 0);
      const quad = [
        ring[i].clone().addScaledVector(side, -w0).add(droop),
        ring[i].clone().addScaledVector(side, w0).add(droop),
        ring[i + 1].clone().addScaledVector(side, w1).add(droop),
        ring[i + 1].clone().addScaledVector(side, -w1).add(droop),
      ];
      const uvs = [
        [0, 1 - i / seg],
        [1, 1 - i / seg],
        [1, 1 - (i + 1) / seg],
        [0, 1 - (i + 1) / seg],
      ];
      for (const k of [0, 1, 2, 0, 2, 3]) {
        pos.push(quad[k].x, quad[k].y, quad[k].z);
        nor.push(0, 1, 0);
        uv.push(uvs[k][0], uvs[k][1]);
      }
    }
  }
  return [
    { geometry: trunk, material: barkMaterial("#d8c3a5"), isLeaf: false },
    { geometry: fromArrays({ pos, nor, uv }), material: cardMaterial("frond", 0.02), isLeaf: true },
  ];
}

function bush(p: { radius: number; height: number; leaves: number; leafSize: number }, random: Rand): PlantPart[] {
  const leaf = { pos: [] as number[], nor: [] as number[], uv: [] as number[] };
  const center = new THREE.Vector3(0, p.height * 0.35, 0);
  for (let i = 0; i < 7; i++) {
    const a = random() * Math.PI * 2;
    const c = new THREE.Vector3(Math.cos(a) * p.radius * 0.45, p.height * (0.35 + random() * 0.35), Math.sin(a) * p.radius * 0.45);
    cards(leaf, c, center, Math.round(p.leaves / 7), p.radius * 0.6, p.leafSize, random);
  }
  // Keep the bottom on the ground.
  const pos = leaf.pos;
  for (let i = 1; i < pos.length; i += 3) pos[i] = Math.max(pos[i], 0.01);
  return [{ geometry: fromArrays(leaf), material: cardMaterial("leaves", 0.03), isLeaf: true }];
}

/** Grass blades as curved, tapered strips. */
function bladeClump(count: number, height: number, spread: number, random: Rand) {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  for (let b = 0; b < count; b++) {
    const a = random() * Math.PI * 2;
    const h = height * (0.6 + random() * 0.6);
    const w = height * 0.045;
    const lean = 0.15 + random() * 0.35;
    const ox = Math.cos(a) * spread * random();
    const oz = Math.sin(a) * spread * random();
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const pts: number[][] = [];
    for (let s = 0; s <= 3; s++) {
      const t = s / 3;
      const width = w * (1 - t * 0.9);
      const x = ox + dx * lean * h * t * t;
      const z = oz + dz * lean * h * t * t;
      pts.push([x - dz * width, t * h, z + dx * width, x + dz * width, t * h, z - dx * width, t]);
    }
    for (let s = 0; s < 3; s++) {
      const [ax, ay, az, bx, by, bz, ta] = pts[s];
      const [cx, cy, cz, ex, ey, ez, tb] = pts[s + 1];
      const quad = [
        [ax, ay, az, ta],
        [bx, by, bz, ta],
        [ex, ey, ez, tb],
        [cx, cy, cz, tb],
      ];
      for (const k of [0, 1, 2, 0, 2, 3]) {
        pos.push(quad[k][0], quad[k][1], quad[k][2]);
        nor.push(dx * 0.3, 1, dz * 0.3);
        uv.push(0.5, quad[k][3]);
      }
    }
  }
  return fromArrays({ pos, nor, uv });
}

/** Tints a geometry darker toward the root via vertex colors (uses uv.y as height 0..1). */
function rootShade(g: THREE.BufferGeometry, dark: number) {
  const uv = g.attributes.uv;
  const col = new Float32Array(uv.count * 3);
  for (let i = 0; i < uv.count; i++) {
    const v = dark + (1 - dark) * Math.min(1, uv.getY(i));
    col.set([v, v, v], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

const BLADE_MATERIAL = () => {
  const key = "blades";
  let m = mats.get(key);
  if (!m) {
    m = swaying(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85 }), 0.06);
    mats.set(key, m);
  }
  return m;
};

const BLOOMS: Partial<Record<FoliageKey, { color: string; cell: number; size: number; count: number }>> = {
  flowerPurpleA: { color: "#8f6fd8", cell: 0, size: 0.07, count: 7 },
  flowerPurpleB: { color: "#b48be8", cell: 2, size: 0.06, count: 9 },
  flowerPurpleC: { color: "#6f4fc0", cell: 3, size: 0.05, count: 12 },
  flowerRed: { color: "#d8344a", cell: 1, size: 0.08, count: 6 },
  flowerYellowA: { color: "#f2c230", cell: 0, size: 0.07, count: 8 },
  flowerYellowB: { color: "#f5a524", cell: 3, size: 0.055, count: 11 },
};

function flower(spec: { color: string; cell: number; size: number; count: number }, random: Rand): PlantPart[] {
  const stems: THREE.BufferGeometry[] = [];
  const heads = { pos: [] as number[], nor: [] as number[], uv: [] as number[] };
  for (let i = 0; i < spec.count; i++) {
    const a = random() * Math.PI * 2;
    const r = random() * 0.09;
    const h = 0.12 + random() * 0.12;
    const tip = new THREE.Vector3(Math.cos(a) * r * 1.6, h, Math.sin(a) * r * 1.6);
    stems.push(taperedTube([new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r), tip.clone().multiplyScalar(0.5).setY(h * 0.5), tip], 0.006, 0.004, 3));
    // Flower head: a petal card facing mostly up.
    const s = spec.size * (0.8 + random() * 0.4);
    const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2 + (random() - 0.5) * 0.6, random() * Math.PI * 2, 0, "YXZ"));
    const u0 = (spec.cell % 2) / 2;
    const v0 = Math.floor(spec.cell / 2) / 2;
    const corners = [
      [-0.5, -0.5],
      [0.5, -0.5],
      [0.5, 0.5],
      [-0.5, 0.5],
    ];
    const quad = corners.map(([x, y]) => new THREE.Vector3(x * s, y * s, 0).applyQuaternion(tilt).add(tip));
    for (const k of [0, 1, 2, 0, 2, 3]) {
      heads.pos.push(quad[k].x, quad[k].y, quad[k].z);
      heads.nor.push(0, 1, 0);
      heads.uv.push(u0 + (corners[k][0] + 0.5) / 2, v0 + (corners[k][1] + 0.5) / 2);
    }
  }
  const leaves = rootShade(bladeClump(8, 0.13, 0.07, random), 0.45);
  const headMat = cardMaterial("petals", 0.05, 0.6, spec.color);
  return [
    { geometry: merge([...stems, stripColor(leaves)]), material: plainMaterial("#ffffff", 0.8, 0.05), isLeaf: true },
    { geometry: fromArrays(heads), material: headMat, isLeaf: false },
  ];
}

function stripColor(g: THREE.BufferGeometry) {
  g.deleteAttribute("color");
  return g;
}

function mushrooms(spec: { color: string; count: number; spots: boolean }, random: Rand): PlantPart[] {
  const stems: THREE.BufferGeometry[] = [];
  const caps: THREE.BufferGeometry[] = [];
  for (let i = 0; i < spec.count; i++) {
    const a = random() * Math.PI * 2;
    const r = i === 0 ? 0 : 0.05 + random() * 0.05;
    const s = i === 0 ? 1 : 0.55 + random() * 0.35;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const stem = new THREE.LatheGeometry(
      [
        [0.018, 0],
        [0.016, 0.04],
        [0.013, 0.08],
        [0.012, 0.1],
      ].map(([u, v]) => new THREE.Vector2(u * s, v * s)),
      12,
    ).translate(x, 0, z);
    const cap = new THREE.LatheGeometry(
      [
        [0.0, 0.095],
        [0.012, 0.094],
        [0.045, 0.098],
        [0.058, 0.115],
        [0.05, 0.135],
        [0.03, 0.148],
        [0.0, 0.152],
      ].map(([u, v]) => new THREE.Vector2(u * s, v * s)),
      18,
    ).translate(x, 0, z);
    stems.push(stem);
    caps.push(cap);
  }
  return [
    { geometry: merge(stems), material: plainMaterial("#efe6d6", 0.7), isLeaf: false },
    { geometry: merge(caps), material: plainMaterial(spec.color, spec.spots ? 0.35 : 0.6), isLeaf: false },
  ];
}

function rock(p: { size: number; flat: number }, random: Rand): PlantPart[] {
  const g = new THREE.IcosahedronGeometry(p.size, 3);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  const o = [random() * 10, random() * 10, random() * 10];
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = Math.sin(v.x * 9 + o[0]) * Math.sin(v.y * 7 + o[1]) * Math.sin(v.z * 8 + o[2]);
    const k = 1 + n * 0.22 + Math.sin(v.x * 23 + o[1]) * 0.03;
    v.multiplyScalar(k);
    v.y = v.y * p.flat;
    if (v.y < 0) v.y *= 0.3;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return [{ geometry: g, material: surface("granite", "#b9b1a6"), isLeaf: false }];
}

function stump(p: { radius: number; height: number }): PlantPart[] {
  const side = taperedTube([new THREE.Vector3(0, -0.01, 0), new THREE.Vector3(0, p.height, 0)], p.radius * 1.2, p.radius, 12, 6);
  const top = new THREE.CircleGeometry(p.radius, 20).rotateX(-Math.PI / 2).translate(0, p.height, 0);
  return [
    { geometry: side, material: barkMaterial(), isLeaf: false },
    { geometry: top, material: surface("wood", "#e2c9a2", [0.3, 0.3]), isLeaf: false },
  ];
}

function logs(count: number, random: Rand): PlantPart[] {
  const sides: THREE.BufferGeometry[] = [];
  const ends: THREE.BufferGeometry[] = [];
  const rows = count > 1 ? [3, 2, 1] : [1];
  rows.forEach((inRow, row) => {
    for (let i = 0; i < inRow; i++) {
      const r = 0.035 + random() * 0.006;
      const y = r + row * r * 1.75;
      const z = (i - (inRow - 1) / 2) * r * 2.05;
      const len = 0.32 + random() * 0.04;
      sides.push(taperedTube([new THREE.Vector3(-len / 2, y, z), new THREE.Vector3(len / 2, y, z)], r, r * 0.95, 10, 5));
      for (const s of [-1, 1]) ends.push(new THREE.CircleGeometry(r, 14).rotateY((s * Math.PI) / 2).translate((s * len) / 2, y, z));
    }
  });
  return [
    { geometry: merge(sides), material: barkMaterial(), isLeaf: false },
    { geometry: merge(ends), material: surface("wood", "#e8cfa6", [0.2, 0.2]), isLeaf: false },
  ];
}

// ---------------------------------------------------------------------------------------------

function build(key: FoliageKey): PlantPart[] {
  const random = seeded(
    [...key].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 100000, 7) + 11,
  );
  switch (key) {
    case "oak":
      return broadleaf({ height: 1.45, trunk: 0.06, crown: 0.62, shape: 0.95, branches: 6, leaves: 300, leafSize: 0.24 }, random);
    case "round":
      return broadleaf({ height: 1.35, trunk: 0.05, crown: 0.52, shape: 1.05, branches: 5, leaves: 240, leafSize: 0.22 }, random);
    case "detailed":
      return broadleaf({ height: 1.5, trunk: 0.055, crown: 0.55, shape: 1.15, branches: 6, leaves: 280, leafSize: 0.22 }, random);
    case "fat":
      return broadleaf({ height: 1.3, trunk: 0.07, crown: 0.66, shape: 0.9, branches: 7, leaves: 320, leafSize: 0.25 }, random);
    case "plateau":
      return broadleaf({ height: 1.3, trunk: 0.05, crown: 0.72, shape: 0.5, branches: 7, leaves: 260, leafSize: 0.24 }, random);
    case "blocks":
      return broadleaf({ height: 1.4, trunk: 0.055, crown: 0.5, shape: 1.2, branches: 5, leaves: 240, leafSize: 0.22 }, random);
    case "cone":
      return broadleaf({ height: 1.6, trunk: 0.045, crown: 0.32, shape: 2.1, branches: 6, leaves: 220, leafSize: 0.18 }, random);
    case "simple":
      return broadleaf({ height: 1.25, trunk: 0.045, crown: 0.46, shape: 1.0, branches: 5, leaves: 200, leafSize: 0.22 }, random);
    case "small":
      return broadleaf({ height: 1.05, trunk: 0.04, crown: 0.4, shape: 1.0, branches: 4, leaves: 160, leafSize: 0.2 }, random);
    case "tall":
      return broadleaf({ height: 1.75, trunk: 0.05, crown: 0.42, shape: 1.6, branches: 6, leaves: 240, leafSize: 0.2 }, random);
    case "thin":
      // Birch: pale bark, airy crown.
      return broadleaf({ height: 1.65, trunk: 0.035, crown: 0.36, shape: 1.5, branches: 5, leaves: 170, leafSize: 0.18, bark: "#f1ece4", lean: 0.25 }, random);
    case "palm":
      return palm({ height: 1.55, trunk: 0.045, bend: 0.12, fronds: 11, frondLength: 0.55 }, random);
    case "palmBend":
      return palm({ height: 1.35, trunk: 0.045, bend: 0.45, fronds: 10, frondLength: 0.52 }, random);
    case "palmShort":
      return palm({ height: 0.8, trunk: 0.06, bend: 0.06, fronds: 12, frondLength: 0.5 }, random);
    case "pineRound":
      return conifer({ height: 1.35, trunk: 0.045, radius: 0.42, whorls: 9, round: true }, random);
    case "pineRoundC":
      return conifer({ height: 1.4, trunk: 0.045, radius: 0.46, whorls: 10, round: true }, random);
    case "pineTall":
      return conifer({ height: 1.6, trunk: 0.04, radius: 0.36, whorls: 12 }, random);
    case "pineSmall":
      return conifer({ height: 1.0, trunk: 0.035, radius: 0.32, whorls: 7 }, random);
    case "pine":
      return conifer({ height: 1.35, trunk: 0.045, radius: 0.4, whorls: 10 }, random);
    case "bush":
      return bush({ radius: 0.16, height: 0.2, leaves: 70, leafSize: 0.1 }, random);
    case "bushDetailed":
      return bush({ radius: 0.15, height: 0.22, leaves: 80, leafSize: 0.09 }, random);
    case "bushLarge":
      return bush({ radius: 0.22, height: 0.28, leaves: 110, leafSize: 0.12 }, random);
    case "bushSmall":
      return bush({ radius: 0.1, height: 0.13, leaves: 40, leafSize: 0.08 }, random);
    case "bushTriangle":
      return bush({ radius: 0.13, height: 0.3, leaves: 70, leafSize: 0.09 }, random);
    case "grass":
      return [{ geometry: rootShade(bladeClump(14, 0.12, 0.05, random), 0.4), material: BLADE_MATERIAL(), isLeaf: true }];
    case "grassLarge":
      return [{ geometry: rootShade(bladeClump(20, 0.17, 0.07, random), 0.4), material: BLADE_MATERIAL(), isLeaf: true }];
    case "grassLeafs":
      return [{ geometry: rootShade(bladeClump(12, 0.1, 0.06, random), 0.4), material: BLADE_MATERIAL(), isLeaf: true }];
    case "mushroomRed":
      return mushrooms({ color: "#c0392b", count: 3, spots: true }, random);
    case "mushroomTan":
      return mushrooms({ color: "#b98a5a", count: 4, spots: false }, random);
    case "mushroom":
      return mushrooms({ color: "#c0392b", count: 1, spots: true }, random);
    case "rockA":
      return rock({ size: 0.07, flat: 0.75 }, random);
    case "rockC":
      return rock({ size: 0.06, flat: 0.6 }, random);
    case "rockFlat":
      return rock({ size: 0.08, flat: 0.35 }, random);
    case "rockLarge":
      return rock({ size: 0.16, flat: 0.7 }, random);
    case "stump":
      return stump({ radius: 0.06, height: 0.08 });
    case "log":
      return logs(1, random);
    case "logStack":
      return logs(6, random);
    default: {
      const bloom = BLOOMS[key];
      if (bloom) return flower(bloom, random);
      return bush({ radius: 0.15, height: 0.2, leaves: 60, leafSize: 0.1 }, random);
    }
  }
}

