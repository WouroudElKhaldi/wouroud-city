"use client";

import { useFrame } from "@react-three/fiber";
import { CapsuleCollider, RigidBody } from "@react-three/rapier";
import { Suspense, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useCityStore } from "@/state/useCityStore";
import { playerState } from "@/world/env";
import { WOUROUD_LOOK } from "@/world/outfits";
import { type CharacterAnimation, Person } from "./Person";
import { Text } from "./Text3D";
import { useProximity } from "./useProximity";

/**
 * Wouroud herself, waiting near the plaza: she waves when you walk up, turns to face you, and
 * "Talk to Wouroud" opens the Ask Wouroud chat (hud/AskWouroud.tsx).
 */
export function WouroudGuide({ x, z, facing }: { x: number; z: number; facing: number }) {
  const body = useRef<THREE.Group>(null);
  const [animation, setAnimation] = useState<CharacterAnimation>("idle");
  const greeted = useRef({ close: false, at: -1e9 });
  const where = useMemo(() => new THREE.Vector3(x, 0, z), [x, z]);
  useProximity({
    id: "talk-wouroud",
    label: "Talk to Wouroud",
    radius: 3,
    where,
    run: () => useCityStore.getState().setAsking(true),
  });
  useFrame((_, delta) => {
    const dx = playerState.position.x - x;
    const dz = playerState.position.z - z;
    const close = dx * dx + dz * dz < 5 * 5;
    const g = greeted.current;
    const now = performance.now();
    if (close && !g.close && now - g.at > 20000) {
      g.at = now;
      setAnimation("emote-yes");
      window.setTimeout(() => setAnimation("idle"), 1800);
    }
    g.close = close;
    if (body.current) {
      const target = close ? Math.atan2(dx, dz) : facing;
      const diff = Math.atan2(Math.sin(target - body.current.rotation.y), Math.cos(target - body.current.rotation.y));
      body.current.rotation.y += diff * Math.min(1, delta * 4);
    }
  });
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CapsuleCollider args={[0.45, 0.35]} position={[x, 0.9, z]} />
      </RigidBody>
      <group ref={body} position={[x, 0, z]} rotation-y={facing}>
        <Suspense fallback={null}>
          <Person look={WOUROUD_LOOK} animation={animation} />
        </Suspense>
      </group>
      <group position={[x, 2.15, z]}>
        <Text fontSize={0.2} color="#ffffff" anchorX="center" anchorY="bottom" outlineWidth={0.02} outlineColor="#1a103d">
          Wouroud
        </Text>
        <Text position={[0, -0.04, 0]} fontSize={0.12} color="#fde68a" anchorX="center" anchorY="top" outlineWidth={0.015} outlineColor="#1a103d">
          Ask me anything ✦
        </Text>
      </group>
    </group>
  );
}
