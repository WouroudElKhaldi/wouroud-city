"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * One pooled particle system for every little burst in the city:
 * petals from a shaken tree, sparkles from a flower, water from the fountain.
 * Call `emitBurst` from anywhere; the <Particles /> component drains the queue.
 */

export type BurstKind = "petal" | "sparkle" | "splash" | "leaf";

type Burst = { position: THREE.Vector3; kind: BurstKind; count: number; colors: string[]; spread?: number };

const queue: Burst[] = [];

export function emitBurst(burst: Burst) {
  queue.push(burst);
}

const MAX = 600;

type Particle = {
  alive: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: THREE.Euler;
  spin: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  kind: BurstKind;
};

export function Particles() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: MAX }, () => ({
        alive: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        rot: new THREE.Euler(),
        spin: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        size: 1,
        kind: "petal" as BurstKind,
      })),
    [],
  );
  const cursor = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useLayoutEffect(() => {
    // Start with every instance hidden.
    const m = mesh.current;
    if (!m) return;
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    for (let i = 0; i < MAX; i++) m.setMatrixAt(i, dummy.matrix);
    m.instanceMatrix.needsUpdate = true;
  }, [dummy]);

  useFrame((_, rawDelta) => {
    const m = mesh.current;
    if (!m) return;
    const delta = Math.min(rawDelta, 0.05);

    while (queue.length) {
      const b = queue.shift()!;
      for (let i = 0; i < b.count; i++) {
        const index = cursor.current;
        const p = particles[index];
        cursor.current = (index + 1) % MAX;
        const spread = b.spread ?? 1.5;
        p.alive = true;
        p.kind = b.kind;
        p.pos.copy(b.position).add(new THREE.Vector3((Math.random() - 0.5) * spread, Math.random() * spread * 0.5, (Math.random() - 0.5) * spread));
        if (b.kind === "sparkle") p.vel.set((Math.random() - 0.5) * 3, 2 + Math.random() * 3, (Math.random() - 0.5) * 3);
        else if (b.kind === "splash") p.vel.set((Math.random() - 0.5) * 2.5, 3 + Math.random() * 2.5, (Math.random() - 0.5) * 2.5);
        else p.vel.set((Math.random() - 0.5) * 1.2, -0.4 - Math.random() * 0.6, (Math.random() - 0.5) * 1.2);
        p.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
        p.spin.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
        p.maxLife = b.kind === "sparkle" ? 0.9 : b.kind === "splash" ? 1 : 2.6 + Math.random() * 1.5;
        p.life = p.maxLife;
        p.size = b.kind === "sparkle" ? 0.12 : b.kind === "splash" ? 0.1 : 0.16 + Math.random() * 0.08;
        color.set(b.colors[Math.floor(Math.random() * b.colors.length)]);
        m.setColorAt(index, color);
      }
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }

    for (let i = 0; i < MAX; i++) {
      const p = particles[i];
      if (!p.alive) continue;
      p.life -= delta;
      if (p.life <= 0 || p.pos.y < 0) {
        p.alive = false;
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
        continue;
      }
      if (p.kind === "petal" || p.kind === "leaf") {
        // Drift and flutter down
        p.vel.x += Math.sin(p.life * 3 + i) * delta * 0.8;
        p.vel.y = Math.max(p.vel.y - delta * 0.3, -1.1);
      } else {
        p.vel.y -= delta * 9.8;
      }
      p.pos.addScaledVector(p.vel, delta);
      p.rot.x += p.spin.x * delta;
      p.rot.y += p.spin.y * delta;
      p.rot.z += p.spin.z * delta;
      const fade = Math.min(1, p.life / 0.4);
      dummy.position.copy(p.pos);
      dummy.rotation.copy(p.rot);
      dummy.scale.setScalar(p.size * fade);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, MAX]} frustumCulled={false}>
      <circleGeometry args={[1, 5]} />
      <meshStandardMaterial side={THREE.DoubleSide} emissive="#ffffff" emissiveIntensity={0.15} toneMapped={false} />
    </instancedMesh>
  );
}
