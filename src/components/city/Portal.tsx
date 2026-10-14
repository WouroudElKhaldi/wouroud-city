"use client";

import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { type Interactable, useCityStore } from "@/state/useCityStore";
import { useGlowMaterial } from "./materials";

/**
 * A glowing doorway with a sensor in front of it. Standing in the sensor shows
 * the "Press E" prompt; leaving it hides the prompt.
 */
export function Portal({
  action,
  label,
  color,
  width = 4,
  height = 4.6,
  position = [0, 0, 0],
  rotationY = 0,
}: {
  action: Interactable;
  label: string;
  color: string;
  width?: number;
  height?: number;
  position?: [number, number, number];
  rotationY?: number;
}) {
  const setNearby = useCityStore((s) => s.setNearby);
  const clearNearby = useCityStore((s) => s.clearNearby);
  const frame = useGlowMaterial(color, 0.8, 3);
  const veil = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
      }),
    [color],
  );
  const shimmer = useRef(0);
  useFrame((_, delta) => {
    shimmer.current += delta;
    veil.opacity = 0.28 + Math.sin(shimmer.current * 2.4) * 0.1;
  });

  return (
    <group position={position} rotation-y={rotationY}>
      {/* Frame */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * width) / 2, height / 2, 0]} material={frame}>
          <boxGeometry args={[0.28, height, 0.28]} />
        </mesh>
      ))}
      <mesh position={[0, height, 0]} material={frame}>
        <boxGeometry args={[width + 0.28, 0.28, 0.28]} />
      </mesh>
      <mesh position={[0, height / 2, 0]} material={veil}>
        <planeGeometry args={[width, height]} />
      </mesh>
      <Text
        position={[0, height + 0.55, 0.05]}
        fontSize={0.42}
        color="#ffffff"
        outlineWidth={0.025}
        outlineColor="#1a103d"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          sensor
          args={[width / 2 + 0.6, 1.5, 2.2]}
          position={[0, 1.5, 1.6]}
          onIntersectionEnter={() => setNearby(action)}
          onIntersectionExit={() => clearNearby(action)}
        />
      </RigidBody>
    </group>
  );
}
