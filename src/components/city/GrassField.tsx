"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { seeded } from "@/world/foliage";
import { isTouchDevice } from "@/world/touch";

/**
 * A lawn full of grass clumps and wildflowers, swaying in the wind. Two
 * instanced meshes (one draw call each); the sway happens in the vertex shader,
 * so thousands of tufts cost almost nothing per frame. Pass `isLawn` to keep
 * grass off roads, plazas and floors.
 */

// Natural lawn greens, from shaded deep green to sunlit straw-tipped blades.
const GRASS_COLORS = ["#5f8f3a", "#6b9a40", "#557f33", "#79a44a", "#62913c", "#86ad55", "#4f7a30"];
const FLOWER_COLORS = ["#f4f1ea", "#f4f1ea", "#f2c230", "#e36a8a", "#a88ad8", "#f08a4b", "#ffffff", "#d8344a"];

const wind = { value: 0 };

/** Phones get about a third of the grass blades (decided once, at load). */
export const GRASS_SCALE = isTouchDevice() ? 0.35 : 1;

/** Adds a gentle wind sway that grows with height above the ground. */
function windy(material: THREE.MeshStandardMaterial) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = wind;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uWind;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vec4 root = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float sway = max(position.y, 0.0);
        transformed.x += sin(uWind * 1.6 + root.x * 0.35 + root.z * 0.2) * 0.22 * sway;
        transformed.z += cos(uWind * 1.2 + root.z * 0.3) * 0.12 * sway;`,
      );
  };
  return material;
}

function clumpGeometry() {
  // Nine curved, tapered blades (three segments each) leaning outward, dark at the root.
  // Normals lean up so the lawn shades softly instead of showing every blade's flat side.
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + i * 1.7;
    const h = 0.26 + ((i * 7) % 5) * 0.045;
    const lean = 0.06 + (i % 3) * 0.05;
    const w = 0.022;
    const r = 0.03 + (i % 4) * 0.015;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const row = (t: number) => {
      const width = w * (1 - t * 0.92);
      const x = dx * (r + lean * t * t);
      const z = dz * (r + lean * t * t);
      return [x - dz * width, t * h, z + dx * width, x + dz * width, t * h, z - dx * width];
    };
    for (let k = 0; k < 3; k++) {
      const t0 = k / 3;
      const t1 = (k + 1) / 3;
      const [ax, ay, az, bx, by, bz] = row(t0);
      const [cx, cy, cz, ex, ey, ez] = row(t1);
      positions.push(ax, ay, az, bx, by, bz, ex, ey, ez, ax, ay, az, ex, ey, ez, cx, cy, cz);
      for (const t of [t0, t0, t1, t0, t1, t1]) {
        normals.push(dx * 0.35, 1, dz * 0.35);
        const v = 0.42 + t * 0.68;
        colors.push(v, v, v * (0.9 + t * 0.1));
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return g;
}

function flowerGeometry() {
  // A thin stem with a flat five-petal bloom and a golden eye: a daisy / buttercup in the lawn.
  const parts: THREE.BufferGeometry[] = [];
  const paint = (g: THREE.BufferGeometry, r: number, gr: number, b: number) => {
    const n = g.index ? g.toNonIndexed() : g;
    n.deleteAttribute("uv");
    n.setAttribute("color", new THREE.Float32BufferAttribute(new Array(n.attributes.position.count).fill([r, gr, b]).flat(), 3));
    return n;
  };
  parts.push(paint(new THREE.CylinderGeometry(0.006, 0.008, 0.36, 4).translate(0, 0.18, 0), 0.32, 0.5, 0.22));
  for (let k = 0; k < 5; k++) {
    const petal = new THREE.CircleGeometry(0.035, 8).scale(1, 0.45, 1).translate(0.04, 0, 0).rotateX(-Math.PI / 2 + 0.2).rotateY((k / 5) * Math.PI * 2);
    parts.push(paint(petal.translate(0, 0.365, 0), 1, 1, 1));
  }
  parts.push(paint(new THREE.SphereGeometry(0.016, 8, 6).scale(1, 0.6, 1).translate(0, 0.372, 0), 0.95, 0.72, 0.15));
  return mergeGeometries(parts)!;
}

export function GrassField({
  isLawn,
  radius,
  count,
  flowers = Math.round(count * 0.12),
  seed = 7,
}: {
  isLawn: (x: number, z: number) => boolean;
  /** Grass is scattered inside a circle of this radius around the origin */
  radius: number;
  count: number;
  flowers?: number;
  seed?: number;
}) {
  const grass = useRef<THREE.InstancedMesh>(null);
  const blooms = useRef<THREE.InstancedMesh>(null);
  const grassGeo = useMemo(() => clumpGeometry(), []);
  const flowerGeo = useMemo(() => flowerGeometry(), []);
  const grassMat = useMemo(() => windy(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85 })), []);
  const flowerMat = useMemo(() => windy(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.6 })), []);

  const spots = useMemo(() => {
    const random = seeded(seed);
    const pickSpots = (n: number) => {
      const out: [number, number][] = [];
      for (let i = 0; i < n * 4 && out.length < n; i++) {
        const a = random() * Math.PI * 2;
        // Denser toward the middle, where people walk.
        const r = random() ** 0.85 * radius;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        if (isLawn(x, z)) out.push([x, z]);
      }
      return out;
    };
    return { grass: pickSpots(count), flowers: pickSpots(flowers), random };
  }, [isLawn, radius, count, flowers, seed]);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const c = new THREE.Color();
    const { random } = spots;
    const fill = (mesh: THREE.InstancedMesh | null, list: [number, number][], colors: string[], minScale: number, spread: number) => {
      if (!mesh) return;
      list.forEach(([x, z], i) => {
        q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, random() * Math.PI * 2);
        const k = minScale + random() * spread;
        s.set(k, k * (0.8 + random() * 0.5), k);
        m.compose(p.set(x, 0, z), q, s);
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, c.set(colors[Math.floor(random() * colors.length)]));
      });
      mesh.count = list.length;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    };
    fill(grass.current, spots.grass, GRASS_COLORS, 0.55, 0.5);
    fill(blooms.current, spots.flowers, FLOWER_COLORS, 0.6, 0.45);
  }, [spots]);

  useFrame((_, delta) => {
    wind.value += delta;
  });

  return (
    <group>
      <instancedMesh ref={grass} args={[grassGeo, grassMat, Math.max(1, count)]} receiveShadow frustumCulled={false} />
      <instancedMesh ref={blooms} args={[flowerGeo, flowerMat, Math.max(1, flowers)]} frustumCulled={false} />
    </group>
  );
}
