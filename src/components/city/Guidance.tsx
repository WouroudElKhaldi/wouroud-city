"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useCityStore } from "@/state/useCityStore";
import { DISTRICTS, landmarkPlacement } from "@/world/districts";
import { playerState } from "@/world/env";
import { accents } from "@/world/palette";
import { PERSONAS } from "@/world/personas";
import { sfx } from "@/world/sfx";

/**
 * Tall beams of light over the districts recommended for the visitor's persona,
 * visible from anywhere in the hub, with a slowly spinning marker on top.
 */
export function Beacons() {
  const persona = useCityStore((s) => s.persona);
  const highlights = persona ? PERSONAS[persona].highlights : [];
  return (
    <group>
      {DISTRICTS.filter((d) => highlights.includes(d.id)).map((d) => {
        const p = landmarkPlacement(d.id);
        return <Beacon key={d.id} x={p.x} z={p.z} color={d.accent} />;
      })}
    </group>
  );
}

function Beacon({ x, z, color }: { x: number; z: number; color: string }) {
  const marker = useRef<THREE.Mesh>(null);
  const beam = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [color],
  );
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    beam.opacity = 0.12 + Math.sin(t * 2 + x) * 0.04;
    if (marker.current) {
      marker.current.rotation.y = t * 1.2;
      marker.current.position.y = 46 + Math.sin(t * 1.5 + z) * 1.2;
    }
  });
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 30, 0]} material={beam}>
        <cylinderGeometry args={[1.6, 3.2, 60, 24, 1, true]} />
      </mesh>
      <mesh ref={marker} position={[0, 46, 0]}>
        <octahedronGeometry args={[2.2, 0]} />
        <meshStandardMaterial color={accents.gold} emissive={accents.gold} emissiveIntensity={1.6} toneMapped={false} />
      </mesh>
    </group>
  );
}

const DOTS = 60;
const SPACING = 1.6;

/**
 * A trail of glowing dots on the ground from the player to the current waypoint,
 * flowing toward it, plus a pulsing ring at the destination. Arriving clears it.
 */
export function WaypointGuide() {
  const waypoint = useCityStore((s) => s.waypoint);
  const setWaypoint = useCityStore((s) => s.setWaypoint);
  const toast = useCityStore((s) => s.toast);
  const dots = useRef<THREE.InstancedMesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (waypoint) sfx.sparkle();
  }, [waypoint]);

  useFrame(({ clock }) => {
    const mesh = dots.current;
    if (!mesh) return;
    if (!waypoint) {
      mesh.visible = false;
      if (ring.current) ring.current.visible = false;
      return;
    }
    const from = playerState.position;
    const dx = waypoint.x - from.x;
    const dz = waypoint.z - from.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 4) {
      setWaypoint(null);
      toast(`You've arrived at ${waypoint.label}.`, "📍 Destination reached");
      return;
    }
    mesh.visible = true;
    const flow = (clock.elapsedTime * 2.2) % SPACING;
    for (let i = 0; i < DOTS; i++) {
      const d = 1.2 + i * SPACING + flow;
      if (d > dist - 1) {
        dummy.scale.setScalar(0);
      } else {
        dummy.position.set(from.x + (dx / dist) * d, 0.08, from.z + (dz / dist) * d);
        const fade = Math.min(1, (dist - d) / 6) * Math.min(1, d / 3);
        dummy.scale.setScalar(0.18 + fade * 0.12);
      }
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (ring.current) {
      ring.current.visible = true;
      ring.current.position.set(waypoint.x, 0.1, waypoint.z);
      const s = 1 + ((clock.elapsedTime * 0.8) % 1) * 1.5;
      ring.current.scale.set(s, s, s);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 1 - ((clock.elapsedTime * 0.8) % 1);
    }
  });

  return (
    <>
      <instancedMesh ref={dots} args={[undefined, undefined, DOTS]} frustumCulled={false}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshBasicMaterial color={accents.gold} toneMapped={false} />
      </instancedMesh>
      <mesh ref={ring} rotation-x={-Math.PI / 2} visible={false}>
        <ringGeometry args={[1.4, 1.8, 48]} />
        <meshBasicMaterial color={accents.gold} transparent toneMapped={false} depthWrite={false} />
      </mesh>
    </>
  );
}
