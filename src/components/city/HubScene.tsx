"use client";

import { Text } from "@react-three/drei";
import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import { useMemo } from "react";
import { DISTRICTS, HUB, landmarkPlacement } from "@/world/districts";
import { computeHubLayout, WORLD_HALF } from "@/world/hubLayout";
import { palette } from "@/world/palette";
import { Landmark } from "./Landmarks";
import { useGlowMaterial } from "./materials";
import { Fountain } from "./StreetDetails";
import { StreetLamps, Trees } from "./StreetProps";

/** Central Plaza and the ring of district landmarks. */
export function HubScene() {
  const layout = useMemo(() => computeHubLayout(), []);
  const ring = useGlowMaterial(palette.neon, 0.3, 2.2);
  const monument = useGlowMaterial(palette.neon, 0.6, 3);

  return (
    <group>
      <WorldGround />

      {/* Plaza paving with concentric rings */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.015, 0]} receiveShadow>
        <circleGeometry args={[HUB.plazaRadius, 96]} />
        <meshStandardMaterial color={palette.plaza} roughness={0.75} />
      </mesh>
      {[HUB.plazaRadius - 0.5, 11, 7.5].map((r) => (
        <mesh key={r} rotation-x={-Math.PI / 2} position={[0, 0.025, 0]} material={ring}>
          <ringGeometry args={[r - 0.25, r, 128]} />
        </mesh>
      ))}

      {/* Roads to each district */}
      {layout.roads.map((road, i) => (
        <group key={i} position={[road.x, 0, road.z]} rotation-y={road.rotationY}>
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.012, 0]} receiveShadow>
            <planeGeometry args={[HUB.roadHalfWidth * 2, road.length]} />
            <meshStandardMaterial color={palette.road} roughness={0.9} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} rotation-x={-Math.PI / 2} position={[side * (HUB.roadHalfWidth + 0.15), 0.02, 0]}>
              <planeGeometry args={[0.3, road.length]} />
              <meshStandardMaterial color="#f5f0ff" />
            </mesh>
          ))}
          {Array.from({ length: Math.floor(road.length / 5) }, (_, k) => (
            <mesh key={k} rotation-x={-Math.PI / 2} position={[0, 0.02, -road.length / 2 + 2.5 + k * 5]}>
              <planeGeometry args={[0.22, 2.2]} />
              <meshStandardMaterial color={palette.roadLine} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Monument in the fountain */}
      <group>
        <Fountain />
        <RigidBody type="fixed" colliders={false}>
          <CylinderCollider args={[1.5, 2.2]} position={[0, 1.5, 0]} />
        </RigidBody>
        <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[2, 2.4, 1.8, 32]} />
          <meshStandardMaterial color="#4c1d95" />
        </mesh>
        <Text position={[0, 4.2, 0]} fontSize={3.2} material={monument} anchorX="center" anchorY="middle" outlineWidth={0.05} outlineColor="#2d1f52">
          {"</>"}
        </Text>
        {[0, Math.PI].map((r) => (
          <group key={r} rotation-y={r}>
            <Text position={[0, 1.15, 2.45]} fontSize={0.42} color="#ffffff" anchorX="center" anchorY="middle" textAlign="center">
              {"Wouroud's City\nCentral Plaza"}
            </Text>
          </group>
        ))}
      </group>

      {DISTRICTS.map((d) => {
        const p = landmarkPlacement(d.id);
        return (
          <group key={d.id} position={[p.x, 0, p.z]} rotation-y={p.rotationY}>
            <Landmark district={d} />
          </group>
        );
      })}

      <StreetLamps points={layout.lamps} />
      <Trees points={layout.trees} />
    </group>
  );
}

/** Grass for the whole world, the ground collider and invisible walls at the edges. */
export function WorldGround() {
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[WORLD_HALF, 0.5, WORLD_HALF]} position={[0, -0.5, 0]} />
        <CuboidCollider args={[WORLD_HALF, 10, 1]} position={[0, 10, WORLD_HALF]} />
        <CuboidCollider args={[WORLD_HALF, 10, 1]} position={[0, 10, -WORLD_HALF]} />
        <CuboidCollider args={[1, 10, WORLD_HALF]} position={[WORLD_HALF, 10, 0]} />
        <CuboidCollider args={[1, 10, WORLD_HALF]} position={[-WORLD_HALF, 10, 0]} />
      </RigidBody>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[WORLD_HALF * 2, WORLD_HALF * 2]} />
        <meshStandardMaterial color={palette.grass} roughness={1} />
      </mesh>
    </group>
  );
}
