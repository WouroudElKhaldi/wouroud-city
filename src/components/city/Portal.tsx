"use client";

import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useGlowMaterial } from "./materials";
import { useProximity } from "./useProximity";

/**
 * A glowing doorway. Standing in front of it shows the "Press E" prompt.
 */
export function Portal({
  id,
  prompt,
  onEnter,
  label,
  color,
  width = 4,
  height = 4.6,
  position = [0, 0, 0],
  rotationY = 0,
}: {
  id: string;
  prompt: string;
  onEnter: () => void;
  label: string;
  color: string;
  width?: number;
  height?: number;
  position?: [number, number, number];
  rotationY?: number;
}) {
  const group = useRef<THREE.Group>(null);
  const doorstep = useMemo(() => new THREE.Vector3(), []);
  useProximity({
    id,
    label: prompt,
    run: onEnter,
    radius: width / 2 + 1.2,
    where: () => (group.current ? group.current.localToWorld(doorstep.set(0, 0, 1.4)) : doorstep),
  });
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
    <group ref={group} position={position} rotation-y={rotationY}>
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
    </group>
  );
}
