"use client";

import { Text } from "@react-three/drei";
import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { registerNightGlow } from "@/world/env";
import { AVENUE } from "@/world/layout";
import { palette } from "@/world/palette";

const WORLD_HALF = 220;

/** Grass, the avenue, sidewalks, lane markings, the Central Plaza and the world's edges. */
export function Ground({ avenueEndZ }: { avenueEndZ: number }) {
  const length = AVENUE.startZ + 6 - avenueEndZ;
  const centerZ = (AVENUE.startZ + 6 + avenueEndZ) / 2;
  const sidewalkX = AVENUE.roadHalfWidth + AVENUE.sidewalkWidth / 2;

  const dashes = useMemo(() => {
    const out: number[] = [];
    for (let z = AVENUE.startZ; z > avenueEndZ; z -= 6) out.push(z);
    return out;
  }, [avenueEndZ]);

  const dashMesh = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = new THREE.Matrix4();
    dashes.forEach((z, i) => {
      m.makeTranslation(0, 0.025, z);
      dashMesh.current?.setMatrixAt(i, m);
    });
    if (dashMesh.current) dashMesh.current.instanceMatrix.needsUpdate = true;
  }, [dashes]);

  const ringMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({ color: palette.neon, emissive: palette.neon, emissiveIntensity: 0.3 }),
    [],
  );
  useEffect(() => registerNightGlow(ringMaterial, 0.3, 2.2), [ringMaterial]);

  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[WORLD_HALF, 0.5, WORLD_HALF]} position={[0, -0.5, 0]} />
        {/* Invisible walls at the edge of the world */}
        <CuboidCollider args={[WORLD_HALF, 10, 1]} position={[0, 10, WORLD_HALF]} />
        <CuboidCollider args={[WORLD_HALF, 10, 1]} position={[0, 10, -WORLD_HALF]} />
        <CuboidCollider args={[1, 10, WORLD_HALF]} position={[WORLD_HALF, 10, 0]} />
        <CuboidCollider args={[1, 10, WORLD_HALF]} position={[-WORLD_HALF, 10, 0]} />
        {/* Plaza monument */}
        <CylinderCollider args={[1.5, 2.2]} position={[0, 1.5, AVENUE.plazaCenterZ]} />
      </RigidBody>

      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[WORLD_HALF * 2, WORLD_HALF * 2]} />
        <meshStandardMaterial color={palette.grass} />
      </mesh>

      {/* Avenue */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, centerZ]} receiveShadow>
        <planeGeometry args={[AVENUE.roadHalfWidth * 2, length]} />
        <meshStandardMaterial color={palette.road} roughness={0.9} />
      </mesh>
      <instancedMesh ref={dashMesh} args={[undefined, undefined, dashes.length]} receiveShadow>
        <boxGeometry args={[0.25, 0.01, 2.6]} />
        <meshStandardMaterial color={palette.roadLine} />
      </instancedMesh>

      {/* Sidewalks */}
      {[-1, 1].map((side) => (
        <mesh key={side} rotation-x={-Math.PI / 2} position={[side * sidewalkX, 0.02, centerZ]} receiveShadow>
          <planeGeometry args={[AVENUE.sidewalkWidth, length]} />
          <meshStandardMaterial color={palette.sidewalk} />
        </mesh>
      ))}

      {/* Central Plaza */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.015, AVENUE.plazaCenterZ]} receiveShadow>
        <circleGeometry args={[AVENUE.plazaRadius, 64]} />
        <meshStandardMaterial color={palette.plaza} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, AVENUE.plazaCenterZ]} material={ringMaterial}>
        <ringGeometry args={[AVENUE.plazaRadius - 0.6, AVENUE.plazaRadius - 0.2, 96]} />
      </mesh>

      {/* Monument: a glowing code bracket on a pedestal */}
      <group position={[0, 0, AVENUE.plazaCenterZ]}>
        <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[2.2, 2.6, 1.5, 32]} />
          <meshStandardMaterial color="#4c1d95" />
        </mesh>
        <Text
          position={[0, 3.6, 0]}
          fontSize={3}
          color={palette.neon}
          outlineWidth={0.04}
          outlineColor="#2d1f52"
          anchorX="center"
          anchorY="middle"
          material={ringMaterial}
        >
          {"</>"}
        </Text>
        <Text
          position={[0, 1.6, 2.65]}
          fontSize={0.5}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          maxWidth={4}
          textAlign="center"
        >
          {"Wouroud's City\nCentral Plaza"}
        </Text>
      </group>
    </group>
  );
}
