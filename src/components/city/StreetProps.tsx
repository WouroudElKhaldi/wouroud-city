"use client";

import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { CylinderCollider, RigidBody } from "@react-three/rapier";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
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

const LANTERN_Y = 4.25;
const IRON = new THREE.MeshStandardMaterial({ color: "#17161b", metalness: 0.7, roughness: 0.35 });
const BRASS = new THREE.MeshStandardMaterial({ color: "#c9a24a", metalness: 0.9, roughness: 0.28 });
const DARK_GLASS = new THREE.MeshStandardMaterial({ color: "#3d3a44", roughness: 0.1, metalness: 0.2 });

function strip(g: THREE.BufferGeometry) {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (!["position", "normal", "uv"].includes(k)) n.deleteAttribute(k);
  return n;
}

/** Lamppost parts, built once. */
const LAMP = (() => {
  const v = (pts: number[][]) => pts.map(([x, y]) => new THREE.Vector2(x, y));
  // Post: flared base, plinth rings, slim fluted shaft, collar under the lantern.
  const post = new THREE.LatheGeometry(
    v([
      [0.0, 0],
      [0.26, 0],
      [0.26, 0.12],
      [0.2, 0.18],
      [0.2, 0.5],
      [0.15, 0.62],
      [0.09, 0.75],
      [0.075, 1.0],
      [0.065, 3.7],
      [0.09, 3.78],
      [0.07, 3.86],
      [0.12, 3.98],
      [0.12, 4.02],
      [0.0, 4.02],
    ]),
    16,
  );
  // Lantern frame: four corner bars, a roof and a finial.
  const frame: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    frame.push(new THREE.BoxGeometry(0.03, 0.5, 0.03).translate(Math.cos(a) * 0.19, LANTERN_Y, Math.sin(a) * 0.19));
  }
  frame.push(new THREE.CylinderGeometry(0.05, 0.3, 0.22, 4).rotateY(Math.PI / 4).translate(0, LANTERN_Y + 0.36, 0));
  frame.push(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 4).rotateY(Math.PI / 4).translate(0, LANTERN_Y - 0.27, 0));
  const finial = new THREE.SphereGeometry(0.05, 10, 8).translate(0, LANTERN_Y + 0.52, 0);
  const ring = new THREE.TorusGeometry(0.1, 0.018, 8, 20).rotateX(Math.PI / 2).translate(0, 3.8, 0);
  const merged = mergeGeometries([strip(post), ...frame.map(strip)])!;
  const trim = mergeGeometries([strip(finial), strip(ring)])!;
  // Glass: a tapered four-sided pane box, centered at the lantern's origin.
  const glass = new THREE.CylinderGeometry(0.2, 0.15, 0.48, 4).rotateY(Math.PI / 4);
  return { post: merged, trim, glass };
})();

/**
 * Street lamps: black cast-iron lampposts (fluted post on a flared base) with a glass lantern and
 * brass trim on top.
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
      // A classic lamppost: the lantern sits on top of the post, so the pool is right under it.
      poleM.push(at(x, 0, z, rot));
      armM.push(at(x, 0, z, rot));
      bulbM.push(at(x, LANTERN_Y, z, rot));
      poolM.push(at(x, 0.04, z));
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
    () =>
      new THREE.MeshStandardMaterial({
        color: "#fff6e0",
        emissive: palette.lampLight,
        emissiveIntensity: 0.2,
        roughness: 0.15,
        transparent: true,
        opacity: 0.92,
      }),
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
          <CylinderCollider key={`${x}:${z}`} args={[2.3, 0.14]} position={[x, 2.3, z]} />
        ))}
      </RigidBody>
      <instancedMesh ref={poles} args={[LAMP.post, IRON, points.length]} castShadow onClick={toggle} {...hover} />
      <instancedMesh ref={arms} args={[LAMP.trim, BRASS, points.length]} onClick={toggle} {...hover} />
      <instancedMesh ref={bulbs} args={[LAMP.glass, bulbMaterial, points.length]} onClick={toggle} {...hover} />
      <instancedMesh ref={darkBulbs} args={[LAMP.glass, DARK_GLASS, points.length]} onClick={toggle} {...hover} />
      <instancedMesh ref={pools} args={[undefined, undefined, points.length]} material={poolMaterial} renderOrder={2}>
        <cylinderGeometry args={[4.5, 4.5, 0.01, 32]} />
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
