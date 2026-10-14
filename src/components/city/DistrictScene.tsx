"use client";

import { Text } from "@react-three/drei";
import { useMemo } from "react";
import { seedContent } from "@/content/seed";
import { type DistrictId, districtById } from "@/world/districts";
import { computeDistrictLayout, STREET } from "@/world/layout";
import { palette } from "@/world/palette";
import { Building, DARK } from "./Building";
import { BuildingDoors } from "./BuildingDoors";
import { WorldGround } from "./HubScene";
import { useGlowMaterial } from "./materials";
import { Portal } from "./Portal";
import { useCityStore } from "@/state/useCityStore";
import { CodeBillboards, Curbs, StreetFurniture } from "./StreetDetails";
import { Foliage } from "./Foliage";
import { makeWalkers, Pedestrians } from "./Pedestrians";
import { Balls, Knockables, Pigeons } from "./Playthings";
import { StreetLamps } from "./StreetProps";

/** Spawn point inside a district: just past the entry gate, facing down the street. */
export const DISTRICT_SPAWN: [number, number, number] = [0, 2, STREET.startZ + 6];

/** One district on its own: a street lined with the buildings generated from its content. */
export function DistrictScene({ id }: { id: DistrictId }) {
  const layout = useMemo(() => computeDistrictLayout(seedContent, id), [id]);
  const district = districtById(id);
  const goTo = useCityStore((s) => s.goTo);
  const openPanel = useCityStore((s) => s.openPanel);
  const roadTopZ = STREET.startZ + 28;
  const length = roadTopZ - layout.streetEndZ;
  const centerZ = (roadTopZ + layout.streetEndZ) / 2;
  const sidewalkX = STREET.roadHalfWidth + STREET.sidewalkWidth / 2;
  const walkers = useMemo(
    () =>
      makeWalkers(id, id, [], [
        [
          [-sidewalkX + 0.4, STREET.startZ - 6],
          [-sidewalkX + 0.4, layout.streetEndZ + 14],
        ],
        [
          [sidewalkX - 0.4, layout.streetEndZ + 20],
          [sidewalkX - 0.4, STREET.startZ - 10],
        ],
        [
          [-sidewalkX + 0.4, (STREET.startZ + layout.streetEndZ) / 2],
          [-sidewalkX + 0.4, STREET.startZ - 8],
        ],
      ]),
    [id, sidewalkX, layout.streetEndZ],
  );

  return (
    <group>
      <WorldGround />

      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, centerZ]} receiveShadow>
        <planeGeometry args={[STREET.roadHalfWidth * 2, length]} />
        <meshStandardMaterial color={palette.road} roughness={0.9} />
      </mesh>
      {Array.from({ length: Math.floor(length / 6) }, (_, k) => (
        <mesh key={k} rotation-x={-Math.PI / 2} position={[0, 0.02, roadTopZ - 3 - k * 6]}>
          <planeGeometry args={[0.25, 2.6]} />
          <meshStandardMaterial color={palette.roadLine} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={side} rotation-x={-Math.PI / 2} position={[side * sidewalkX, 0.02, centerZ]} receiveShadow>
          <planeGeometry args={[STREET.sidewalkWidth, length]} />
          <meshStandardMaterial color={palette.sidewalk} />
        </mesh>
      ))}
      <Curbs avenueEndZ={layout.streetEndZ} />

      <DistrictArch name={district.name} tagline={district.tagline} accent={district.accent} color={district.color} />
      <Portal
        id="exit-district"
        prompt="Back to Central Plaza"
        onEnter={() => goTo("hub")}
        label="Back to Central Plaza"
        color={district.accent}
        position={[0, 0, STREET.startZ + 22]}
        rotationY={Math.PI}
        width={5}
      />

      {layout.buildings.map((spec) => (
        <group
          key={spec.id}
          onClick={(e) => {
            if (e.delta > 6) return;
            e.stopPropagation();
            openPanel({ district: id, id: spec.id });
          }}
        >
          <Building spec={spec} />
        </group>
      ))}
      <BuildingDoors district={id} buildings={layout.buildings} />
      {layout.signposts.map((s) => (
        <Signpost key={`${s.side}${s.z}`} label={s.label} x={s.x} z={s.z} side={s.side} />
      ))}

      <StreetLamps points={layout.lamps} />
      <Foliage items={layout.foliage} />
      <Pedestrians walkers={walkers} />
      <Pigeons center={[0, STREET.startZ - 4]} radius={4} count={6} />
      <Balls spots={[{ x: 2.5, z: layout.streetEndZ + 6, kind: "soccer" }, { x: -2.5, z: layout.streetEndZ + 8, kind: "beach" }]} />
      <Knockables
        spots={[-3, -1, 1, 3].map((x) => ({ x, z: layout.streetEndZ + 12, kind: "cone" as const }))}
      />
      <StreetFurniture lamps={layout.lamps} />
      <CodeBillboards spots={layout.billboards} />

      {/* Closing the street: a planted roundabout */}
      <group position={[0, 0, layout.streetEndZ - 2]}>
        <mesh position={[0, 0.3, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[5, 5.3, 0.6, 40]} />
          <meshStandardMaterial color="#4c1d95" />
        </mesh>
        <mesh position={[0, 0.62, 0]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[4.6, 40]} />
          <meshStandardMaterial color="#8fb98a" />
        </mesh>
      </group>
    </group>
  );
}

/** The district's name over the street, seen as you walk in. */
function DistrictArch({ name, tagline, accent, color }: { name: string; tagline: string; accent: string; color: string }) {
  const glow = useGlowMaterial(accent, 0.6, 2.8);
  const w = STREET.roadHalfWidth * 2 + 3;
  return (
    <group position={[0, 0, STREET.startZ + 1]}>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * w) / 2, 3.6, 0]} castShadow>
          <boxGeometry args={[0.6, 7.2, 0.6]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
      <mesh position={[0, 7.6, 0]} castShadow>
        <boxGeometry args={[w + 1, 1.8, 0.5]} />
        <meshStandardMaterial color={DARK} />
      </mesh>
      <mesh position={[0, 6.62, 0.27]} material={glow}>
        <boxGeometry args={[w + 0.8, 0.08, 0.04]} />
      </mesh>
      {[0.27, -0.27].map((dz) => (
        <group key={dz} position={[0, 0, dz]} rotation-y={dz > 0 ? 0 : Math.PI}>
          <Text position={[0, 7.85, 0]} fontSize={0.75} material={glow} anchorX="center" anchorY="middle">
            {name}
          </Text>
          <Text position={[0, 7.15, 0]} fontSize={0.34} color="#e9d8fd" anchorX="center" anchorY="middle">
            {tagline}
          </Text>
        </group>
      ))}
    </group>
  );
}

function Signpost({ label, x, z, side }: { label: string; x: number; z: number; side: 1 | -1 }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1.3, 0]} castShadow>
        <boxGeometry args={[0.14, 2.6, 0.14]} />
        <meshStandardMaterial color={palette.lampPole} />
      </mesh>
      <mesh position={[0, 2.75, 0]} castShadow>
        <boxGeometry args={[0.1, 0.6, 3]} />
        <meshStandardMaterial color="#4c1d95" />
      </mesh>
      <Text
        position={[side * -0.07, 2.75, 0]}
        rotation-y={side === -1 ? Math.PI / 2 : -Math.PI / 2}
        fontSize={0.3}
        maxWidth={2.8}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  );
}
