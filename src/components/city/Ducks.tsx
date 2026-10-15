"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useCityStore } from "@/state/useCityStore";
import { DUCKS, track, useProgress } from "@/state/progress";
import { sfx } from "@/world/sfx";
import { emitBurst } from "./Particles";
import { useProximity } from "./useProximity";

/**
 * Golden rubber ducks hidden around the city (the "Duck hunt" quest). Each scene lists its own in
 * DUCK_SPOTS; walk up and press E, or click one, to pick it up.
 */
export const DUCK_SPOTS: Record<string, { id: string; x: number; y?: number; z: number }[]> = {
  hub: [
    { id: "hub-lawn", x: 31, z: 24 },
    { id: "hub-lawn-west", x: -30, z: -24 },
  ],
  skills: [{ id: "skills-plaza", x: -9.5, z: 9.5 }],
  arcade: [{ id: "arcade-plaza", x: 9.5, z: -9.5 }],
  "room:business:codi": [{ id: "codi-corner", x: -13.6, z: 9.6 }],
};

export function Ducks({ scene }: { scene: string }) {
  const spots = DUCK_SPOTS[scene] ?? [];
  return (
    <group>
      {spots.map((d) => (
        <Duck key={d.id} {...d} />
      ))}
    </group>
  );
}

const GOLD = new THREE.MeshStandardMaterial({ color: "#f2c230", metalness: 0.9, roughness: 0.22, emissive: "#6b4a00", emissiveIntensity: 0.25 });
const BEAK = new THREE.MeshStandardMaterial({ color: "#f97316", roughness: 0.4 });
const EYE = new THREE.MeshStandardMaterial({ color: "#111111", roughness: 0.2 });

function Duck({ id, x, y = 0, z }: { id: string; x: number; y?: number; z: number }) {
  const found = useProgress((s) => s.progress.ducks.includes(id));
  const group = useRef<THREE.Group>(null);
  const where = useMemo(() => new THREE.Vector3(x, 0, z), [x, z]);
  const pick = () => {
    if (useProgress.getState().progress.ducks.includes(id)) return;
    track({ type: "duck", id });
    const n = useProgress.getState().progress.ducks.length;
    sfx.coin();
    emitBurst({ position: new THREE.Vector3(x, y + 0.5, z), kind: "sparkle", count: 30, colors: ["#f2c230", "#fde68a", "#ffffff"], spread: 0.8 });
    useCityStore.getState().toast(n >= DUCKS ? "You found every golden duck!" : `Golden duck ${n} of ${DUCKS}. Keep looking!`, "🦆 Quack!");
  };
  useProximity({ id: `duck-${id}`, label: "Pick up the golden duck", radius: 1.8, where, run: pick, enabled: !found });
  useFrame(({ clock }) => {
    if (group.current) {
      group.current.rotation.y = clock.elapsedTime * 1.2;
      group.current.position.y = y + 0.05 + Math.sin(clock.elapsedTime * 2) * 0.04;
    }
  });
  if (found) return null;
  return (
    <group
      ref={group}
      position={[x, y, z]}
      scale={1.6}
      onClick={(e) => {
        if (e.delta > 6) return;
        e.stopPropagation();
        pick();
      }}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "")}
    >
      <mesh position={[0, 0.09, 0]} scale={[1, 0.8, 1.25]} material={GOLD} castShadow>
        <sphereGeometry args={[0.1, 20, 16]} />
      </mesh>
      <mesh position={[0, 0.2, 0.07]} material={GOLD} castShadow>
        <sphereGeometry args={[0.062, 18, 14]} />
      </mesh>
      <mesh position={[0, 0.19, 0.135]} scale={[1, 0.45, 1]} material={BEAK}>
        <sphereGeometry args={[0.032, 12, 8]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.03, 0.225, 0.118]} material={EYE}>
          <sphereGeometry args={[0.009, 8, 6]} />
        </mesh>
      ))}
      <mesh position={[0, 0.12, -0.12]} rotation-x={-0.6} material={GOLD}>
        <coneGeometry args={[0.035, 0.07, 10]} />
      </mesh>
    </group>
  );
}
