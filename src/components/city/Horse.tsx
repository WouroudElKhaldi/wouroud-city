"use client";

import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { type CarSpot, useCityStore } from "@/state/useCityStore";
import { playerState } from "@/world/env";
import { useProximity } from "./useProximity";

/**
 * A friendly low-poly horse built from simple shapes, with a violet and gold
 * saddle. Its legs walk or gallop with the rider's speed; standing still it
 * swishes its tail and nods, now and then lowering its head to graze.
 * Faces +z. About 2.4 m from nose to tail, saddle at ~1.45 m.
 */

const COAT = "#8b5a3c";
const DARK = "#3f2a1d";
export const SADDLE_HEIGHT = 1.45;

type Leg = { x: number; z: number; phase: number };
const LEGS: Leg[] = [
  { x: -0.22, z: 0.62, phase: 0 },
  { x: 0.22, z: 0.62, phase: Math.PI },
  { x: -0.22, z: -0.62, phase: Math.PI * 0.5 },
  { x: 0.22, z: -0.62, phase: Math.PI * 1.5 },
];

export function HorseModel({ ridden = false }: { ridden?: boolean }) {
  const legs = useRef<(THREE.Group | null)[]>([]);
  const head = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const cycle = useRef(0);
  const coat = useMemo(() => new THREE.MeshStandardMaterial({ color: COAT, roughness: 0.7 }), []);
  const dark = useMemo(() => new THREE.MeshStandardMaterial({ color: DARK, roughness: 0.8 }), []);

  useFrame(({ clock }, delta) => {
    const speed = ridden ? playerState.speed : 0;
    const gallop = speed > 7;
    cycle.current += delta * (speed > 0.3 ? 2.2 + speed * (gallop ? 0.75 : 0.9) : 0);
    const amp = Math.min(0.75, speed * 0.09);
    legs.current.forEach((g, i) => {
      if (!g) return;
      const phase = gallop ? (i < 2 ? 0 : Math.PI) + (i % 2) * 0.4 : LEGS[i].phase;
      g.rotation.x = Math.sin(cycle.current + phase) * amp;
    });
    const t = clock.elapsedTime;
    if (body.current) body.current.position.y = Math.abs(Math.sin(cycle.current)) * amp * 0.12;
    if (head.current) {
      // Idle: occasionally graze; moving: bob with the stride.
      const graze = speed < 0.3 && Math.sin(t * 0.35) > 0.7 ? 0.9 : 0;
      head.current.rotation.x = THREE.MathUtils.damp(head.current.rotation.x, graze + Math.sin(cycle.current * 2) * amp * 0.15, 3, delta);
    }
    if (tail.current) tail.current.rotation.z = Math.sin(t * 2.4) * 0.25;
  });

  return (
    <group>
      <group ref={body}>
        {/* Barrel and chest */}
        <mesh material={coat} position={[0, 1.25, 0]} scale={[0.55, 0.62, 1.25]} castShadow>
          <sphereGeometry args={[0.75, 18, 14]} />
        </mesh>
        {/* Neck and head */}
        <group ref={head} position={[0, 1.45, 0.75]}>
          <mesh material={coat} position={[0, 0.35, 0.22]} rotation-x={-0.55} castShadow>
            <cylinderGeometry args={[0.17, 0.28, 0.95, 12]} />
          </mesh>
          <mesh material={coat} position={[0, 0.78, 0.55]} rotation-x={0.9} castShadow>
            <boxGeometry args={[0.28, 0.62, 0.32]} />
          </mesh>
          <mesh material={dark} position={[0, 0.62, 0.8]} rotation-x={0.9}>
            <boxGeometry args={[0.24, 0.18, 0.26]} />
          </mesh>
          {[-1, 1].map((s) => (
            <group key={s}>
              <mesh material={coat} position={[s * 0.1, 1.08, 0.38]} rotation-x={-0.2}>
                <coneGeometry args={[0.05, 0.18, 6]} />
              </mesh>
              <mesh position={[s * 0.145, 0.85, 0.58]}>
                <sphereGeometry args={[0.035, 8, 6]} />
                <meshStandardMaterial color="#120a08" />
              </mesh>
            </group>
          ))}
          {/* Mane */}
          <mesh material={dark} position={[0, 0.5, 0.05]} rotation-x={-0.55}>
            <boxGeometry args={[0.08, 0.95, 0.2]} />
          </mesh>
        </group>
        {/* Saddle */}
        <mesh position={[0, 1.72, -0.05]} castShadow>
          <boxGeometry args={[0.62, 0.12, 0.7]} />
          <meshStandardMaterial color="#6d28d9" roughness={0.6} />
        </mesh>
        <mesh position={[0, 1.66, -0.05]}>
          <boxGeometry args={[0.7, 0.05, 0.8]} />
          <meshStandardMaterial color="#f6c453" metalness={0.4} roughness={0.4} />
        </mesh>
        {/* Tail */}
        <group ref={tail} position={[0, 1.45, -0.9]}>
          <mesh material={dark} position={[0, -0.35, -0.15]} rotation-x={0.4}>
            <cylinderGeometry args={[0.06, 0.13, 0.8, 8]} />
          </mesh>
        </group>
      </group>
      {/* Legs pivot at the hips and shoulders */}
      {LEGS.map((l, i) => (
        <group key={i} ref={(g) => void (legs.current[i] = g)} position={[l.x, 1.0, l.z]}>
          <mesh material={coat} position={[0, -0.45, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.1, 0.9, 8]} />
          </mesh>
          <mesh material={dark} position={[0, -0.93, 0.02]}>
            <cylinderGeometry args={[0.085, 0.09, 0.12, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** A horse waiting by the stables. Walk up and press E to ride; it stays where you leave it. */
export function ParkedHorse({ id, x, z, rot }: { id: string } & CarSpot) {
  const driving = useCityStore((s) => s.driving);
  const parked = useCityStore((s) => s.parked[id]);
  const startDriving = useCityStore((s) => s.startDriving);
  const spot = parked ?? { x, z, rot };
  const where = useMemo(() => new THREE.Vector3(spot.x, 0, spot.z), [spot.x, spot.z]);
  useProximity({
    id: `horse-${id}`,
    label: "Ride the horse",
    radius: 3,
    where,
    enabled: driving?.id !== id,
    run: () => startDriving({ id, model: "horse", from: spot }),
  });
  if (driving?.id === id) return null;
  return (
    <group position={[spot.x, 0, spot.z]} rotation-y={spot.rot}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.35, 0.8, 1.1]} position={[0, 0.8, 0]} />
      </RigidBody>
      <HorseModel />
    </group>
  );
}
