"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { worldEnv } from "@/world/env";

/**
 * What lies beyond the city: a ring of mountains (like the hills behind Tripoli), lower toward the
 * south where the Mediterranean opens up, and the sea itself beyond the southern edge. Both are
 * outside the walkable world, drawn without fog but pre-tinted with haze, and darken at night.
 */

const RADIUS = 380;
const SEGMENTS = 360;
const ROWS = 6;

function ridgeHeight(a: number) {
  // A few overlapping waves make an irregular skyline; the south (+z, angle π/2) opens to the sea.
  const h =
    70 +
    Math.sin(a * 3 + 0.5) * 22 +
    Math.sin(a * 7 + 1.3) * 14 +
    Math.sin(a * 13 + 2.1) * 8 +
    Math.sin(a * 29 + 0.7) * 4;
  const toSea = Math.cos(a - Math.PI / 2); // 1 at due south
  return Math.max(4, h * (1 - Math.max(0, toSea - 0.35) * 1.4));
}

function mountainGeometry() {
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const rock = new THREE.Color("#6f7d88");
  const green = new THREE.Color("#5f7a5a");
  const snow = new THREE.Color("#eef2f6");
  const c = new THREE.Color();
  for (let i = 0; i <= SEGMENTS; i++) {
    const a = (i / SEGMENTS) * Math.PI * 2;
    const top = ridgeHeight(a);
    for (let r = 0; r <= ROWS; r++) {
      const t = r / ROWS;
      // Slopes lean outward: the base is closer, the crest further away.
      const radius = RADIUS - 60 + t * 60;
      const y = -8 + Math.pow(t, 0.8) * (top + 8);
      pos.push(Math.cos(a) * radius, y, Math.sin(a) * radius);
      c.copy(green).lerp(rock, Math.min(1, t * 1.3));
      if (y > 88) c.lerp(snow, Math.min(1, (y - 88) / 12));
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < SEGMENTS; i++) {
    for (let r = 0; r < ROWS; r++) {
      const a = i * (ROWS + 1) + r;
      const b = a + ROWS + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function Horizon() {
  const geometry = useMemo(() => mountainGeometry(), []);
  const mountains = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, fog: false, side: THREE.DoubleSide }),
    [],
  );
  const sea = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: "#2f6f8f", roughness: 0.18, metalness: 0.35, fog: false });
    const time = { value: 0 };
    m.userData.time = time;
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = time;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          transformed.z += sin(position.x * 0.05 + uTime * 0.8) * 0.4 + cos(position.y * 0.07 + uTime * 0.6) * 0.3;`,
        )
        .replace(
          "#include <beginnormal_vertex>",
          `#include <beginnormal_vertex>
          objectNormal = normalize(vec3(-cos(position.x * 0.05 + uTime * 0.8) * 0.02, sin(position.y * 0.07 + uTime * 0.6) * 0.02, 1.0));`,
        );
    };
    return m;
  }, []);
  const haze = useMemo(() => ({ day: new THREE.Color("#b9c4d3"), night: new THREE.Color("#1d1838"), seaDay: new THREE.Color("#2f6f8f"), seaNight: new THREE.Color("#0c1630") }), []);
  useFrame((_, delta) => {
    const n = worldEnv.night;
    // Atmospheric haze: far mountains take on the sky's color; much darker at night.
    mountains.color.copy(haze.day).lerp(haze.night, n);
    sea.color.copy(haze.seaDay).lerp(haze.seaNight, n);
    (sea.userData.time as { value: number }).value += delta;
  });
  return (
    <group>
      <mesh geometry={geometry} material={mountains} />
      {/* The sea beyond the southern edge of the world */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.6, 900]} material={sea}>
        <planeGeometry args={[2400, 1400, 120, 60]} />
      </mesh>
    </group>
  );
}
