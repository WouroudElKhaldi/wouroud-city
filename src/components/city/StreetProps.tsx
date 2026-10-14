"use client";

import { useFrame } from "@react-three/fiber";
import { CylinderCollider, RigidBody } from "@react-three/rapier";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { registerNightGlow, worldEnv } from "@/world/env";
import { palette } from "@/world/palette";

type Point = [number, number];

/** Fills an instanced mesh from a list of matrices once. */
function useInstances(ref: React.RefObject<THREE.InstancedMesh | null>, matrices: THREE.Matrix4[], colors?: THREE.Color[]) {
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((m, i) => {
      mesh.setMatrixAt(i, m);
      if (colors) mesh.setColorAt(i, colors[i]);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [ref, matrices, colors]);
}

function at(x: number, y: number, z: number, rotY = 0, scale = 1) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)),
    new THREE.Vector3(scale, scale, scale),
  );
}

/**
 * Street lamps: a pole, an arm toward the road and a glowing bulb.
 * At night each lamp also paints a warm pool of light on the ground — a cheap fake
 * instead of dozens of real lights, so the frame rate stays high.
 */
export function StreetLamps({ points }: { points: Point[] }) {
  const poles = useRef<THREE.InstancedMesh>(null);
  const arms = useRef<THREE.InstancedMesh>(null);
  const bulbs = useRef<THREE.InstancedMesh>(null);
  const pools = useRef<THREE.InstancedMesh>(null);

  const { poleM, armM, bulbM, poolM } = useMemo(() => {
    const poleM: THREE.Matrix4[] = [];
    const armM: THREE.Matrix4[] = [];
    const bulbM: THREE.Matrix4[] = [];
    const poolM: THREE.Matrix4[] = [];
    for (const [x, z] of points) {
      const inward = x > 0 ? -1 : 1;
      poleM.push(at(x, 2.5, z));
      armM.push(at(x + inward * 0.7, 4.9, z));
      bulbM.push(at(x + inward * 1.35, 4.7, z));
      poolM.push(at(x + inward * 1.35, 0.04, z));
    }
    return { poleM, armM, bulbM, poolM };
  }, [points]);

  useInstances(poles, poleM);
  useInstances(arms, armM);
  useInstances(bulbs, bulbM);
  useInstances(pools, poolM);

  const bulbMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: palette.lampLight, emissive: palette.lampLight, emissiveIntensity: 0.2 }),
    [],
  );
  useEffect(() => registerNightGlow(bulbMaterial, 0.2, 4), [bulbMaterial]);

  const poolMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: palette.lampPool,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        map: makeRadialTexture(),
      }),
    [],
  );
  useFrame(() => {
    poolMaterial.opacity = worldEnv.night * 0.55;
    if (pools.current) pools.current.visible = worldEnv.night > 0.02;
  });

  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        {points.map(([x, z]) => (
          <CylinderCollider key={`${x}:${z}`} args={[2.5, 0.15]} position={[x, 2.5, z]} />
        ))}
      </RigidBody>
      <instancedMesh ref={poles} args={[undefined, undefined, points.length]} castShadow>
        <cylinderGeometry args={[0.08, 0.12, 5, 8]} />
        <meshStandardMaterial color={palette.lampPole} metalness={0.4} roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={arms} args={[undefined, undefined, points.length]} castShadow>
        <boxGeometry args={[1.5, 0.08, 0.08]} />
        <meshStandardMaterial color={palette.lampPole} metalness={0.4} roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={bulbs} args={[undefined, undefined, points.length]} material={bulbMaterial}>
        <sphereGeometry args={[0.22, 12, 12]} />
      </instancedMesh>
      <instancedMesh
        ref={pools}
        args={[undefined, undefined, points.length]}
        material={poolMaterial}
        rotation-x={0}
        renderOrder={2}
      >
        <cylinderGeometry args={[4, 4, 0.01, 32]} />
      </instancedMesh>
    </group>
  );
}

function makeRadialTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.5, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Low-poly lilac trees: a trunk and two stacked cones, varied in size and color. */
export function Trees({ points }: { points: Point[] }) {
  const trunks = useRef<THREE.InstancedMesh>(null);
  const crowns = useRef<THREE.InstancedMesh>(null);
  const tops = useRef<THREE.InstancedMesh>(null);

  const data = useMemo(() => {
    const trunkM: THREE.Matrix4[] = [];
    const crownM: THREE.Matrix4[] = [];
    const topM: THREE.Matrix4[] = [];
    const colors: THREE.Color[] = [];
    points.forEach(([x, z], i) => {
      const s = 0.85 + ((i * 37) % 10) / 25;
      const r = (i * 1.7) % Math.PI;
      trunkM.push(at(x, 0.9 * s, z, r, s));
      crownM.push(at(x, 2.6 * s, z, r, s));
      topM.push(at(x, 3.8 * s, z, r + 0.6, s));
      colors.push(new THREE.Color(palette.foliage[i % palette.foliage.length]));
    });
    return { trunkM, crownM, topM, colors };
  }, [points]);

  useInstances(trunks, data.trunkM);
  useInstances(crowns, data.crownM, data.colors);
  useInstances(tops, data.topM, data.colors);

  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        {points.map(([x, z]) => (
          <CylinderCollider key={`${x}:${z}`} args={[1.5, 0.3]} position={[x, 1.5, z]} />
        ))}
      </RigidBody>
      <instancedMesh ref={trunks} args={[undefined, undefined, points.length]} castShadow>
        <cylinderGeometry args={[0.18, 0.26, 1.8, 6]} />
        <meshStandardMaterial color={palette.trunk} flatShading />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, undefined, points.length]} castShadow>
        <coneGeometry args={[1.6, 2.6, 7]} />
        <meshStandardMaterial flatShading />
      </instancedMesh>
      <instancedMesh ref={tops} args={[undefined, undefined, points.length]} castShadow>
        <coneGeometry args={[1.1, 1.9, 7]} />
        <meshStandardMaterial flatShading />
      </instancedMesh>
    </group>
  );
}
