"use client";

import { Text } from "@react-three/drei";
import type { CityLayout } from "@/world/layout";
import { AVENUE } from "@/world/layout";
import { palette } from "@/world/palette";
import { Building } from "./Building";

/** The two districts along the main avenue, plus their category signposts. */
export function Districts({ layout }: { layout: CityLayout }) {
  return (
    <group>
      {layout.experience.map((spec) => (
        <Building key={spec.id} spec={spec} />
      ))}
      {layout.skills.map((spec) => (
        <Building key={spec.id} spec={spec} />
      ))}

      {layout.skillBlocks.map((block) => (
        <group key={block.category} position={[block.x, 0, block.z]}>
          <mesh position={[0, 1.2, 0]} castShadow>
            <boxGeometry args={[0.15, 2.4, 0.15]} />
            <meshStandardMaterial color={palette.lampPole} />
          </mesh>
          <Text
            position={[-0.1, 2.6, 0]}
            rotation-y={-Math.PI / 2}
            fontSize={0.55}
            color="#ffffff"
            outlineWidth={0.03}
            outlineColor="#2d1f52"
            anchorX="center"
            anchorY="bottom"
          >
            {block.label}
          </Text>
        </group>
      ))}

      <DistrictGate x={-(AVENUE.roadHalfWidth + AVENUE.sidewalkWidth / 2)} label="Business District" sub="Work experience" />
      <DistrictGate x={AVENUE.roadHalfWidth + AVENUE.sidewalkWidth / 2} label="Skill Downtown" sub="Skills · height = level" />
    </group>
  );
}

function DistrictGate({ x, label, sub }: { x: number; label: string; sub: string }) {
  const z = AVENUE.startZ;
  return (
    <group position={[x, 0, z]}>
      {[-1.6, 1.6].map((dx) => (
        <mesh key={dx} position={[dx, 2, 0]} castShadow>
          <boxGeometry args={[0.3, 4, 0.3]} />
          <meshStandardMaterial color="#4c1d95" />
        </mesh>
      ))}
      <mesh position={[0, 4.2, 0]} castShadow>
        <boxGeometry args={[3.8, 0.9, 0.3]} />
        <meshStandardMaterial color="#4c1d95" />
      </mesh>
      <Text position={[0, 4.32, 0.17]} fontSize={0.36} color="#ffffff" anchorX="center" anchorY="middle">
        {label}
      </Text>
      <Text position={[0, 3.98, 0.17]} fontSize={0.2} color="#e9d8fd" anchorX="center" anchorY="middle">
        {sub}
      </Text>
    </group>
  );
}
