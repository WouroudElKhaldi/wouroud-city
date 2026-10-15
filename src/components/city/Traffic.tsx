"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { playerState, registerNightGlow } from "@/world/env";
import { sfx } from "@/world/sfx";
import { CAR_SCALE } from "./CarModel";

/**
 * Cars driving around a district's ring road, one lane each way. They are
 * polite: a car slows down and stops when you walk in front of it, and honks
 * if you stand there too long. No physics bodies, so they never shove you.
 */

const MODELS = ["sedan", "taxi", "suv", "hatchback-sports", "van", "police"];
const CRUISE = 6;

type Driver = { model: string; angle: number; lane: number; dir: 1 | -1; speed: number; blockedFor: number };

export function Traffic({ radius, count = 6 }: { radius: number; count?: number }) {
  const drivers = useMemo<Driver[]>(
    () =>
      Array.from({ length: count }, (_, i) => ({
        model: MODELS[i % MODELS.length],
        angle: (i / count) * Math.PI * 2 + (i % 2) * 0.3,
        dir: i % 2 === 0 ? 1 : -1,
        lane: i % 2 === 0 ? 1.9 : -1.9,
        speed: CRUISE,
        blockedFor: 0,
      })),
    [count],
  );
  return (
    <group>
      {drivers.map((d, i) => (
        <MovingCar key={i} driver={d} radius={radius} />
      ))}
    </group>
  );
}

function MovingCar({ driver, radius }: { driver: Driver; radius: number }) {
  const { scene } = useGLTF(`/models/cars/${driver.model}.glb`);
  const object = useMemo(() => {
    const m = scene.clone(true);
    m.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    return m;
  }, [scene]);
  const group = useRef<THREE.Group>(null);
  const lights = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#fef9c3", emissive: "#fef08a", emissiveIntensity: 0.2, toneMapped: false }),
    [],
  );
  useEffect(() => registerNightGlow(lights, 0.2, 5), [lights]);
  const ahead = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const d = driver;
    const r = radius + d.lane;
    // A point a few meters ahead: if the player is there, brake.
    const look = d.angle + (d.dir * 5) / r;
    ahead.set(Math.sin(look) * r, 0, Math.cos(look) * r);
    const blocked = ahead.distanceTo(playerState.position) < 3.6;
    d.speed = THREE.MathUtils.damp(d.speed, blocked ? 0 : CRUISE, blocked ? 6 : 1.2, delta);
    d.blockedFor = blocked ? d.blockedFor + delta : 0;
    if (d.blockedFor > 2.5) {
      sfx.honk();
      d.blockedFor = -3;
    }
    d.angle += (d.dir * d.speed * delta) / r;
    g.position.set(Math.sin(d.angle) * r, 0, Math.cos(d.angle) * r);
    // Face the direction of travel (the models face +z).
    g.rotation.y = Math.atan2(Math.cos(d.angle), -Math.sin(d.angle)) + (d.dir === 1 ? 0 : Math.PI);
  });

  return (
    <group ref={group}>
      <primitive object={object} scale={CAR_SCALE} position={[0, 0.3 * CAR_SCALE, 0]} />
      {[-0.45, 0.45].map((hx) => (
        <mesh key={hx} position={[hx * CAR_SCALE, 0.55 * CAR_SCALE, 1.28 * CAR_SCALE]} material={lights}>
          <sphereGeometry args={[0.16, 10, 10]} />
        </mesh>
      ))}
    </group>
  );
}

const STALLS = [
  { canopy: "#f472b6", goods: ["#fde047", "#fb923c", "#4ade80"], label: "Fruit" },
  { canopy: "#5eead4", goods: ["#a78bfa", "#f472b6", "#60a5fa"], label: "Crochet" },
  { canopy: "#f6c453", goods: ["#b45309", "#fde68a", "#fef3c7"], label: "Manakish" },
];

/** A little market in the park: striped canopies over crates of goods. */
export function MarketStalls({ spots }: { spots: { x: number; z: number; rot: number }[] }) {
  return (
    <group>
      {spots.map((s, i) => {
        const st = STALLS[i % STALLS.length];
        return (
          <group key={i} position={[s.x, 0, s.z]} rotation-y={s.rot}>
            <RigidBody type="fixed" colliders={false}>
              <CuboidCollider args={[1.6, 0.5, 0.7]} position={[0, 0.5, 0]} />
            </RigidBody>
            {/* Counter */}
            <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
              <boxGeometry args={[3.2, 1, 1.4]} />
              <meshStandardMaterial color="#8b5a3c" roughness={0.8} />
            </mesh>
            {/* Goods */}
            {st.goods.map((c, k) => (
              <group key={c} position={[-1 + k, 1.1, 0]}>
                {Array.from({ length: 5 }, (_, j) => (
                  <mesh key={j} position={[((j % 3) - 1) * 0.22, (j > 2 ? 0.18 : 0), (j % 2) * 0.2 - 0.1]} castShadow>
                    <sphereGeometry args={[0.13, 10, 8]} />
                    <meshStandardMaterial color={c} />
                  </mesh>
                ))}
              </group>
            ))}
            {/* Posts and striped canopy */}
            {[-1.5, 1.5].map((x) => (
              <mesh key={x} position={[x, 1.4, -0.6]} castShadow>
                <cylinderGeometry args={[0.06, 0.06, 2.8, 8]} />
                <meshStandardMaterial color="#f3e8ff" />
              </mesh>
            ))}
            {Array.from({ length: 7 }, (_, k) => (
              <mesh key={k} position={[-1.6 + k * (3.2 / 7) + 3.2 / 14, 2.75, 0]} rotation-x={0.28} castShadow>
                <boxGeometry args={[3.2 / 7, 0.06, 1.8]} />
                <meshStandardMaterial color={k % 2 ? "#ffffff" : st.canopy} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}
