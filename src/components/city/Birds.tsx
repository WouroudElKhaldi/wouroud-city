"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { worldEnv } from "@/world/env";

/**
 * Flocks of birds circling high over the city by day: one instanced mesh of simple gull shapes
 * whose wings flap in the vertex shader. They fly home at night.
 */

const FLOCKS = [
  { cx: 30, cz: -40, r: 55, y: 34, speed: 0.06, count: 14 },
  { cx: -60, cz: 30, r: 40, y: 28, speed: -0.08, count: 10 },
  { cx: 10, cz: 80, r: 70, y: 42, speed: 0.05, count: 12 },
];
const COUNT = FLOCKS.reduce((n, f) => n + f.count, 0);

function birdGeometry() {
  // A body and two wings; the wing tips (|x| large) get the flap in the shader.
  const g = new THREE.BufferGeometry();
  const v = [
    // left wing
    0, 0, 0.12, -0.9, 0.05, -0.05, 0, 0, -0.18,
    // right wing
    0, 0, 0.12, 0, 0, -0.18, 0.9, 0.05, -0.05,
    // body
    -0.06, 0, 0.3, 0.06, 0, 0.3, 0, -0.04, -0.3,
  ];
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

const flap = { value: 0 };

export function Birds() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => birdGeometry(), []);
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: "#3a3540", roughness: 0.8, side: THREE.DoubleSide });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uFlap = flap;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uFlap;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          float phase = uFlap * 9.0 + float(gl_InstanceID) * 1.7;
          transformed.y += sin(phase) * abs(position.x) * 0.7;`,
        );
    };
    return m;
  }, []);
  const birds = useMemo(
    () =>
      FLOCKS.flatMap((f) =>
        Array.from({ length: f.count }, (_, i) => ({ f, offset: (i / f.count) * 0.6, lane: (i % 4) * 2.2, rise: (i % 3) * 1.4 })),
      ),
    [],
  );
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const e = useMemo(() => new THREE.Euler(), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const s = useMemo(() => new THREE.Vector3(1.4, 1.4, 1.4), []);

  useFrame(({ clock }, delta) => {
    flap.value += delta;
    const el = mesh.current;
    if (!el) return;
    el.visible = worldEnv.night < 0.6;
    if (!el.visible) return;
    const t = clock.elapsedTime;
    birds.forEach((b, i) => {
      const a = t * b.f.speed + b.offset;
      const r = b.f.r + b.lane;
      p.set(b.f.cx + Math.cos(a) * r, b.f.y + b.rise + Math.sin(t * 0.5 + i) * 0.8, b.f.cz + Math.sin(a) * r);
      // Head along the circle, banking into the turn.
      const dir = Math.sign(b.f.speed);
      e.set(0, Math.atan2(-Math.sin(a) * dir, Math.cos(a) * dir), -0.25 * dir);
      q.setFromEuler(e);
      m.compose(p, q, s);
      el.setMatrixAt(i, m);
    });
    el.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geometry, material, COUNT]} frustumCulled={false} />;
}
