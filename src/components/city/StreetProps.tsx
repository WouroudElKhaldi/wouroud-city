"use client";

import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { CylinderCollider, RigidBody } from "@react-three/rapier";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { registerNightGlow, worldEnv } from "@/world/env";
import type { LampSpot } from "@/world/layout";
import { palette } from "@/world/palette";
import { sfx } from "@/world/sfx";
import { emitBurst } from "./Particles";

/** Fills an instanced mesh from a list of matrices once. */
function useInstances(ref: React.RefObject<THREE.InstancedMesh | null>, matrices: THREE.Matrix4[]) {
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [ref, matrices]);
}

function at(x: number, y: number, z: number, rotY = 0, scale = 1) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)),
    new THREE.Vector3(scale, scale, scale),
  );
}

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * Street lamps: a pole, an arm toward the road and a glowing bulb.
 * At night each lamp also paints a warm pool of light on the ground (a cheap fake
 * instead of dozens of real lights, so the frame rate stays high).
 * Click a lamp to switch it off or on.
 */
export function StreetLamps({ points }: { points: LampSpot[] }) {
  const poles = useRef<THREE.InstancedMesh>(null);
  const arms = useRef<THREE.InstancedMesh>(null);
  const bulbs = useRef<THREE.InstancedMesh>(null);
  const darkBulbs = useRef<THREE.InstancedMesh>(null);
  const pools = useRef<THREE.InstancedMesh>(null);
  const off = useRef(new Set<number>());

  const { poleM, armM, bulbM, poolM } = useMemo(() => {
    const poleM: THREE.Matrix4[] = [];
    const armM: THREE.Matrix4[] = [];
    const bulbM: THREE.Matrix4[] = [];
    const poolM: THREE.Matrix4[] = [];
    for (const { x, z, rot } of points) {
      // Unit vector of the arm direction in world space.
      const dx = Math.cos(rot);
      const dz = -Math.sin(rot);
      poleM.push(at(x, 2.5, z));
      armM.push(at(x + dx * 0.7, 4.9, z + dz * 0.7, rot));
      bulbM.push(at(x + dx * 1.35, 4.7, z + dz * 1.35));
      poolM.push(at(x + dx * 1.6, 0.04, z + dz * 1.6));
    }
    return { poleM, armM, bulbM, poolM };
  }, [points]);
  const hiddenM = useMemo(() => points.map(() => HIDDEN), [points]);

  useInstances(poles, poleM);
  useInstances(arms, armM);
  useInstances(bulbs, bulbM);
  useInstances(darkBulbs, hiddenM);
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

  const toggle = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6 || e.instanceId === undefined) return;
    e.stopPropagation();
    const i = e.instanceId;
    const nowOff = !off.current.has(i);
    if (nowOff) off.current.add(i);
    else off.current.delete(i);
    bulbs.current?.setMatrixAt(i, nowOff ? HIDDEN : bulbM[i]);
    darkBulbs.current?.setMatrixAt(i, nowOff ? bulbM[i] : HIDDEN);
    pools.current?.setMatrixAt(i, nowOff ? HIDDEN : poolM[i]);
    for (const m of [bulbs.current, darkBulbs.current, pools.current]) if (m) m.instanceMatrix.needsUpdate = true;
    sfx.click();
    if (!nowOff) {
      const p = new THREE.Vector3().setFromMatrixPosition(bulbM[i]);
      emitBurst({ position: p, kind: "sparkle", count: 10, colors: [palette.lampLight, "#ffffff"], spread: 0.3 });
    }
  };

  const hover = {
    onPointerOver: () => (document.body.style.cursor = "pointer"),
    onPointerOut: () => (document.body.style.cursor = ""),
  };

  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        {points.map(({ x, z }) => (
          <CylinderCollider key={`${x}:${z}`} args={[2.5, 0.15]} position={[x, 2.5, z]} />
        ))}
      </RigidBody>
      <instancedMesh ref={poles} args={[undefined, undefined, points.length]} castShadow onClick={toggle} {...hover}>
        <cylinderGeometry args={[0.08, 0.12, 5, 8]} />
        <meshStandardMaterial color={palette.lampPole} metalness={0.4} roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={arms} args={[undefined, undefined, points.length]} castShadow onClick={toggle} {...hover}>
        <boxGeometry args={[1.5, 0.08, 0.08]} />
        <meshStandardMaterial color={palette.lampPole} metalness={0.4} roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={bulbs} args={[undefined, undefined, points.length]} material={bulbMaterial} onClick={toggle} {...hover}>
        <sphereGeometry args={[0.22, 12, 12]} />
      </instancedMesh>
      <instancedMesh ref={darkBulbs} args={[undefined, undefined, points.length]} onClick={toggle} {...hover}>
        <sphereGeometry args={[0.22, 12, 12]} />
        <meshStandardMaterial color="#4b4560" roughness={0.3} />
      </instancedMesh>
      <instancedMesh ref={pools} args={[undefined, undefined, points.length]} material={poolMaterial} renderOrder={2}>
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
