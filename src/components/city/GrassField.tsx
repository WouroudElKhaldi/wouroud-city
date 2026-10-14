"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { seeded } from "@/world/foliage";

/**
 * A lawn full of grass clumps and wildflowers, swaying in the wind. Two
 * instanced meshes (one draw call each); the sway happens in the vertex shader,
 * so thousands of tufts cost almost nothing per frame. Pass `isLawn` to keep
 * grass off roads, plazas and floors.
 */

const GRASS_COLORS = ["#4ade80", "#22c55e", "#65a30d", "#84cc16", "#16a34a", "#a3e635"];
const FLOWER_COLORS = ["#f472b6", "#fb7185", "#facc15", "#fb923c", "#a78bfa", "#38bdf8", "#ffffff", "#f0abfc"];

const wind = { value: 0 };

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
  // Five slim blades leaning outward, darker at the root.
  const positions: number[] = [];
  const colors: number[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + i * 0.4;
    const lean = 0.08 + (i % 2) * 0.06;
    const h = 0.38 + (i % 3) * 0.1;
    const w = 0.035;
    const cx = Math.cos(a) * 0.05;
    const cz = Math.sin(a) * 0.05;
    const px = -Math.sin(a) * w;
    const pz = Math.cos(a) * w;
    positions.push(cx - px, 0, cz - pz, cx + px, 0, cz + pz, cx + Math.cos(a) * lean, h, cz + Math.sin(a) * lean);
    colors.push(0.55, 0.55, 0.55, 0.55, 0.55, 0.55, 1, 1, 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

function flowerGeometry() {
  // A stem with a little round bloom on top.
  const stem = new THREE.CylinderGeometry(0.012, 0.012, 0.4, 4).translate(0, 0.2, 0);
  const bloom = new THREE.IcosahedronGeometry(0.075, 0).translate(0, 0.42, 0);
  const paint = (g: THREE.BufferGeometry, v: number) =>
    g.setAttribute("color", new THREE.Float32BufferAttribute(new Array(g.attributes.position.count * 3).fill(v), 3));
  // Stem tinted green by keeping it dark; the bloom takes the instance color.
  paint(stem, 0.35);
  paint(bloom, 1);
  const merged = new THREE.BufferGeometry();
  const pos = [...stem.toNonIndexed().attributes.position.array, ...bloom.toNonIndexed().attributes.position.array];
  const col = [...stem.toNonIndexed().attributes.color.array, ...bloom.toNonIndexed().attributes.color.array];
  merged.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  merged.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  merged.computeVertexNormals();
  return merged;
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
  const grassMat = useMemo(() => windy(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 })), []);
  const flowerMat = useMemo(() => windy(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 })), []);

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
