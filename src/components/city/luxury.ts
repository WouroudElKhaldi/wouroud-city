import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Shared finishes for the luxury interiors (walnut, leather, velvet, brass, marble,
 * glass) and a helper that merges static furniture into a few meshes so a big office
 * stays cheap to draw. Textures are drawn on canvases, so nothing is downloaded.
 */

function seeded(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, random: () => number) => void, seed: number) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  draw(ctx, seeded(seed));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

/** Walnut grain: long wavy streaks in browns, with a few darker figure lines. */
function grain(base: string, light: string, dark: string, seed: number) {
  return canvasTexture(
    512,
    (ctx, random) => {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 90; i++) {
        ctx.strokeStyle = random() < 0.5 ? light : dark;
        ctx.globalAlpha = 0.08 + random() * 0.18;
        ctx.lineWidth = 1 + random() * 5;
        const y0 = random() * 512;
        const amp = 3 + random() * 10;
        const freq = 0.004 + random() * 0.01;
        ctx.beginPath();
        for (let x = 0; x <= 512; x += 8) {
          const y = y0 + Math.sin(x * freq + i) * amp;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
    seed,
  );
}

/** Polished marble with soft grey and gold veins. */
export function marbleTexture(base = "#f3eee6", veinA = "#9a9187", veinB = "#c9a45a", seed = 11, joints = true) {
  return canvasTexture(
    1024,
    (ctx, random) => {
      const size = 1024;
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 260; i++) {
        ctx.fillStyle = `rgba(${200 + random() * 30},${195 + random() * 30},${190 + random() * 30},0.05)`;
        ctx.beginPath();
        ctx.arc(random() * size, random() * size, 40 + random() * 140, 0, Math.PI * 2);
        ctx.fill();
      }
      const vein = (color: string, width: number, alpha: number) => {
        ctx.strokeStyle = color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = width;
        let x = random() * size;
        let y = random() * size;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let k = 0; k < 14; k++) {
          x += (random() - 0.3) * 110;
          y += (random() - 0.5) * 90;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      };
      for (let i = 0; i < 16; i++) vein(veinA, 1 + random() * 2.5, 0.25);
      for (let i = 0; i < 7; i++) vein(veinB, 1 + random() * 1.5, 0.35);
      if (joints) {
        ctx.strokeStyle = "rgba(120,110,100,0.45)";
        ctx.lineWidth = 3;
        for (const p of [0, size / 2, size]) {
          ctx.beginPath();
          ctx.moveTo(p, 0);
          ctx.lineTo(p, size);
          ctx.moveTo(0, p);
          ctx.lineTo(size, p);
          ctx.stroke();
        }
      }
    },
    seed,
  );
}

/** Fine leather or fabric: a soft speckle that breaks up flat color. */
function speckle(base: string, seed: number, contrast = 0.06) {
  return canvasTexture(
    256,
    (ctx, random) => {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 2600; i++) {
        ctx.fillStyle = random() < 0.5 ? `rgba(255,255,255,${contrast})` : `rgba(0,0,0,${contrast * 1.6})`;
        ctx.fillRect(random() * 256, random() * 256, 1 + random() * 2, 1 + random() * 2);
      }
    },
    seed,
  );
}

type Finishes = ReturnType<typeof makeFinishes>;
let cache: Finishes | null = null;

function makeFinishes() {
  const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p);
  const walnutMap = grain("#5a3824", "#7a4e32", "#2e1a10", 3);
  const lightOakMap = grain("#b88a5c", "#d1a777", "#8a5f3a", 5);
  return {
    walnut: std({ map: walnutMap, roughness: 0.42, metalness: 0.05 }),
    walnutDark: std({ map: grain("#3a2316", "#55341f", "#1c0f08", 4), roughness: 0.4 }),
    oak: std({ map: lightOakMap, roughness: 0.5 }),
    ebony: std({ color: "#17110e", roughness: 0.3, metalness: 0.1 }),
    leatherBlack: std({ map: speckle("#1d1816", 7), roughness: 0.48, metalness: 0.05 }),
    leatherCognac: std({ map: speckle("#8a5230", 8), roughness: 0.45, metalness: 0.05 }),
    leatherOxblood: std({ map: speckle("#5e1a1d", 9), roughness: 0.45 }),
    leatherCream: std({ map: speckle("#e9dfcc", 10, 0.04), roughness: 0.5 }),
    velvetEmerald: std({ map: speckle("#1f5a47", 12, 0.08), roughness: 0.95 }),
    velvetNavy: std({ map: speckle("#1e2a4d", 13, 0.08), roughness: 0.95 }),
    velvetBlush: std({ map: speckle("#c99a92", 14, 0.06), roughness: 0.95 }),
    fabricGrey: std({ map: speckle("#8d8a86", 15, 0.08), roughness: 0.95 }),
    brass: std({ color: "#c9a45a", metalness: 0.9, roughness: 0.22 }),
    brassDark: std({ color: "#8f6f35", metalness: 0.85, roughness: 0.35 }),
    chrome: std({ color: "#dfe3e8", metalness: 1, roughness: 0.12 }),
    blackMetal: std({ color: "#18181b", metalness: 0.6, roughness: 0.35 }),
    marbleWhite: std({ map: marbleTexture("#f4f1ec", "#a39b92", "#c9a45a", 21, false), roughness: 0.1, metalness: 0.05 }),
    marbleBlack: std({ map: marbleTexture("#16161a", "#6b6660", "#c9a45a", 22, false), roughness: 0.1, metalness: 0.1 }),
    marbleGreen: std({ map: marbleTexture("#1d3b33", "#7fa596", "#d9c9a0", 23, false), roughness: 0.12 }),
    glass: std({
      color: "#d7e9ee",
      transparent: true,
      opacity: 0.16,
      roughness: 0.04,
      metalness: 0.2,
      envMapIntensity: 1.6,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    frostGlass: std({ color: "#eef4f5", transparent: true, opacity: 0.55, roughness: 0.6, depthWrite: false }),
    paper: std({ color: "#f8f5ee", roughness: 0.9 }),
    screenBlack: std({ color: "#08090c", roughness: 0.2, metalness: 0.4 }),
    plastic: std({ color: "#202226", roughness: 0.5 }),
    ivory: std({ color: "#f6f0e4", roughness: 0.8 }),
    soil: std({ color: "#3b2a1e", roughness: 1 }),
    leaf: std({ color: "#3f6b3a", roughness: 0.85, flatShading: true }),
    leafLight: std({ color: "#5b8a4a", roughness: 0.85, flatShading: true }),
    bulb: std({ color: "#fff7e6", emissive: "#ffd79a", emissiveIntensity: 2.2, toneMapped: false }),
    shade: std({ color: "#f4ead6", emissive: "#ffd8a0", emissiveIntensity: 0.9, side: THREE.DoubleSide }),
    greenShade: std({ color: "#0f5a3a", emissive: "#0a3d27", emissiveIntensity: 0.6, metalness: 0.3, roughness: 0.2 }),
  };
}

/** The shared luxury materials (created once, on first use in the browser). */
export function finishes(): Finishes {
  return (cache ??= makeFinishes());
}

// ---------------------------------------------------------------------------
// Static batching
// ---------------------------------------------------------------------------

/** Built-in geometries that can be merged (troika text and custom geometry are left alone). */
const MERGEABLE = new Set([
  "BoxGeometry",
  "PlaneGeometry",
  "CylinderGeometry",
  "SphereGeometry",
  "TorusGeometry",
  "CircleGeometry",
  "RingGeometry",
  "CapsuleGeometry",
  "ConeGeometry",
  "IcosahedronGeometry",
  "OctahedronGeometry",
  "DodecahedronGeometry",
  "LatheGeometry",
  "ExtrudeGeometry",
  "ShapeGeometry",
]);

function materialKey(m: THREE.Material) {
  const s = m as THREE.MeshStandardMaterial;
  return [
    m.type,
    s.color?.getHexString(),
    s.emissive?.getHexString(),
    s.emissiveIntensity,
    s.roughness,
    s.metalness,
    s.map?.uuid,
    m.transparent,
    m.opacity,
    m.side,
    m.toneMapped,
    s.flatShading,
    m.depthWrite,
  ].join("|");
}

/**
 * Merges every static mesh under `root` into one mesh per material (and shadow setting),
 * added to `target`, and hides the originals. Returns a function that undoes it.
 */
export function batchStatic(root: THREE.Object3D, target: THREE.Object3D) {
  root.updateWorldMatrix(true, true);
  target.updateWorldMatrix(true, false);
  const inverse = target.matrixWorld.clone().invert();
  const buckets = new Map<string, { material: THREE.Material; geometries: THREE.BufferGeometry[]; cast: boolean; receive: boolean }>();
  const hidden: THREE.Object3D[] = [];
  const matrix = new THREE.Matrix4();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || (mesh as THREE.SkinnedMesh).isSkinnedMesh || mesh.userData.live) return;
    if (!MERGEABLE.has(mesh.geometry.type) || Array.isArray(mesh.material)) return;
    let g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) {
      g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    }
    if (!g.attributes.normal) g.computeVertexNormals();
    g.morphAttributes = {};
    g = g.applyMatrix4(matrix.multiplyMatrices(inverse, mesh.matrixWorld));
    const key = `${materialKey(mesh.material)}|${mesh.castShadow}|${mesh.receiveShadow}`;
    let bucket = buckets.get(key);
    if (!bucket) buckets.set(key, (bucket = { material: mesh.material, geometries: [], cast: mesh.castShadow, receive: mesh.receiveShadow }));
    bucket.geometries.push(g);
    mesh.visible = false;
    hidden.push(mesh);
  });
  // The originals never move: skip their per-frame matrix updates, and when nothing
  // under the source is left to draw (no text or live meshes), skip it in rendering too.
  let leftToDraw = false;
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o.visible) leftToDraw = true;
  });
  root.matrixWorldAutoUpdate = false;
  if (!leftToDraw) root.visible = false;
  const merged: THREE.Mesh[] = [];
  for (const b of buckets.values()) {
    const geometry = mergeGeometries(b.geometries, false);
    b.geometries.forEach((g) => g.dispose());
    if (!geometry) continue;
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, b.material);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.receive;
    target.add(mesh);
    merged.push(mesh);
  }
  return () => {
    for (const m of merged) {
      target.remove(m);
      m.geometry.dispose();
    }
    for (const o of hidden) o.visible = true;
    root.matrixWorldAutoUpdate = true;
    root.visible = true;
  };
}
