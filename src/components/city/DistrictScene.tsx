"use client";

import { Text } from "@react-three/drei";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useMemo } from "react";
import { seedContent } from "@/content/seed";
import type { Seat } from "@/state/useCityStore";
import { useCityStore } from "@/state/useCityStore";
import { type DistrictId, districtById } from "@/world/districts";
import { computeDistrictLayout, RING, SPOKES } from "@/world/layout";
import { accents, palette } from "@/world/palette";
import { Building, DARK } from "./Building";
import { BuildingDoors } from "./BuildingDoors";
import { Foliage } from "./Foliage";
import { WorldGround } from "./HubScene";
import { useGlowMaterial } from "./materials";
import { makeWalkers, Pedestrians } from "./Pedestrians";
import { Balls, Knockables, Pigeons } from "./Playthings";
import { Portal } from "./Portal";
import { CodeBillboards, Fountain, Seats } from "./StreetDetails";
import { StreetLamps } from "./StreetProps";

/**
 * One district on its own: a round neighborhood. A plaza with a fountain in the
 * middle, a park around it, a ring road, and the content buildings in clusters
 * outside the ring, all facing the center. The entry avenue comes in from the south.
 */
export function DistrictScene({ id }: { id: DistrictId }) {
  const layout = useMemo(() => computeDistrictLayout(seedContent, id), [id]);
  const district = districtById(id);
  const goTo = useCityStore((s) => s.goTo);
  const openPanel = useCityStore((s) => s.openPanel);
  const { ringRadius, innerRadius, gateZ } = layout;
  const parkEdge = ringRadius - RING.roadHalfWidth;

  const walkers = useMemo(
    () =>
      makeWalkers(id, id, [
        { center: [0, 0], radius: RING.plazaRadius - 2.5, count: 2 },
        { center: [0, 0], radius: parkEdge - 1, count: 2 },
        { center: [0, 0], radius: innerRadius - RING.sidewalk / 2, count: 3 },
      ]),
    [id, parkEdge, innerRadius],
  );

  const benches = useMemo<Seat[]>(
    () =>
      SPOKES.map((s) => s + Math.PI / 4).flatMap((a, i) =>
        [-0.22, 0.22].map((d, k) => {
          const r = RING.plazaRadius - 1.6;
          const b = a + d;
          return { id: `${id}-bench-${i}-${k}`, x: Math.sin(b) * r, y: 0, z: Math.cos(b) * r, facing: b + Math.PI };
        }),
      ),
    [id],
  );

  const toys = useMemo(() => {
    const at = (a: number, r: number) => ({ x: Math.sin(a) * r, z: Math.cos(a) * r });
    const mid = (RING.plazaRadius + parkEdge) / 2;
    return {
      balls: [
        { ...at(Math.PI / 4, mid), kind: "soccer" as const },
        { ...at((Math.PI * 5) / 4, mid), kind: "beach" as const },
      ],
      cones: [-3, -1, 1, 3].map((x) => ({ x, z: ringRadius + RING.roadHalfWidth + 3, kind: "cone" as const })),
    };
  }, [parkEdge, ringRadius]);

  return (
    <group>
      <WorldGround />

      {/* Outer sidewalk in front of the buildings, then the ring road */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.015, 0]} receiveShadow>
        <ringGeometry args={[ringRadius + RING.roadHalfWidth, innerRadius + 1, 128]} />
        <meshStandardMaterial color={palette.sidewalk} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]} receiveShadow>
        <ringGeometry args={[ringRadius - RING.roadHalfWidth, ringRadius + RING.roadHalfWidth, 128]} />
        <meshStandardMaterial color={palette.road} roughness={0.9} />
      </mesh>
      <RoadDashes radius={ringRadius} />
      {/* Inner curb ring around the park */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
        <ringGeometry args={[parkEdge - 0.5, parkEdge, 128]} />
        <meshStandardMaterial color="#e9dcc6" />
      </mesh>

      {/* Entry avenue from the gate to the ring */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, (ringRadius + gateZ + 8) / 2]} receiveShadow>
        <planeGeometry args={[RING.roadHalfWidth * 2, gateZ + 8 - ringRadius]} />
        <meshStandardMaterial color={palette.road} roughness={0.9} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} rotation-x={-Math.PI / 2} position={[s * (RING.roadHalfWidth + 1.5), 0.015, (innerRadius + gateZ + 8) / 2]} receiveShadow>
          <planeGeometry args={[3, gateZ + 8 - innerRadius]} />
          <meshStandardMaterial color={palette.sidewalk} />
        </mesh>
      ))}

      {/* Paved paths from the plaza through the park to the ring */}
      {SPOKES.map((a) => (
        <mesh
          key={a}
          rotation={[-Math.PI / 2, 0, a]}
          position={[Math.sin(a) * (RING.plazaRadius + parkEdge) * 0.5, 0.025, Math.cos(a) * (RING.plazaRadius + parkEdge) * 0.5]}
          receiveShadow
        >
          <planeGeometry args={[3.2, parkEdge - RING.plazaRadius]} />
          <meshStandardMaterial color={palette.sidewalk} />
        </mesh>
      ))}

      <CentralPlaza color={district.color} accent={district.accent} name={district.name} />
      <Fountain />
      <Seats seats={benches} />
      {benches.map((seat) => (
        <Bench key={seat.id} seat={seat} />
      ))}

      <DistrictArch name={district.name} tagline={district.tagline} accent={district.accent} color={district.color} z={gateZ - 2} />
      <Portal
        id="exit-district"
        prompt="Back to Central Plaza"
        onEnter={() => goTo("hub")}
        label="Back to Central Plaza"
        color={district.accent}
        position={[layout.exit.x, 0, layout.exit.z]}
        rotationY={Math.PI}
        width={5}
      />

      {layout.buildings.map((spec) =>
        spec.filler ? (
          <Building key={spec.id} spec={spec} />
        ) : (
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
        ),
      )}
      <BuildingDoors district={id} buildings={layout.buildings} />
      {layout.signposts.map((s) => (
        <Signpost key={`${s.label}-${s.rot}`} label={s.label} x={s.x} z={s.z} rot={s.rot} color={district.color} />
      ))}

      <StreetLamps points={layout.lamps} />
      <Foliage items={layout.foliage} />
      <CodeBillboards spots={layout.billboards} />
      <Pedestrians walkers={walkers} />
      <Pigeons center={[0, RING.plazaRadius - 4]} radius={3} count={7} />
      <Balls spots={toys.balls} />
      <Knockables spots={toys.cones} />
    </group>
  );
}

/** Dashed center line around the ring road. */
function RoadDashes({ radius }: { radius: number }) {
  const count = Math.round((Math.PI * 2 * radius) / 6);
  return (
    <group>
      {Array.from({ length: count }, (_, k) => {
        const a = (k / count) * Math.PI * 2;
        return (
          <mesh key={k} rotation={[-Math.PI / 2, 0, a]} position={[Math.sin(a) * radius, 0.03, Math.cos(a) * radius]}>
            <planeGeometry args={[2.6, 0.22]} />
            <meshStandardMaterial color={palette.roadLine} />
          </mesh>
        );
      })}
    </group>
  );
}

/** The paved plaza in the middle with a glowing ring and the district's colors. */
function CentralPlaza({ color, accent, name }: { color: string; accent: string; name: string }) {
  const glow = useGlowMaterial(accent, 0.5, 2.2);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]} receiveShadow>
        <circleGeometry args={[RING.plazaRadius, 64]} />
        <meshStandardMaterial color={palette.plaza} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.04, 0]} receiveShadow>
        <ringGeometry args={[RING.plazaRadius - 3.6, RING.plazaRadius - 3, 64]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.045, 0]} material={glow}>
        <ringGeometry args={[RING.plazaRadius - 0.35, RING.plazaRadius, 96]} />
      </mesh>
      {/* Four obelisks with the district name, at the plaza's diagonals */}
      {SPOKES.map((s) => s + Math.PI / 4).map((a) => (
        <group key={a} position={[Math.sin(a) * (RING.plazaRadius + 1.2), 0, Math.cos(a) * (RING.plazaRadius + 1.2)]} rotation-y={a + Math.PI}>
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider args={[0.5, 2, 0.5]} position={[0, 2, 0]} />
          </RigidBody>
          <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.4, 0.6, 1.4]} />
            <meshStandardMaterial color={DARK} />
          </mesh>
          <mesh position={[0, 2.3, 0]} castShadow>
            <cylinderGeometry args={[0.28, 0.5, 3.6, 4]} />
            <meshStandardMaterial color={color} metalness={0.3} roughness={0.4} />
          </mesh>
          <mesh position={[0, 4.35, 0]} material={glow}>
            <octahedronGeometry args={[0.38]} />
          </mesh>
          <Text position={[0, 0.32, 0.71]} fontSize={0.16} maxWidth={1.3} color={accents.honey} anchorX="center" anchorY="middle">
            {name}
          </Text>
        </group>
      ))}
    </group>
  );
}

function Bench({ seat }: { seat: Seat }) {
  return (
    <group position={[seat.x, 0, seat.z]} rotation-y={seat.facing}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.1, 0.5, 0.35]} position={[0, 0.5, -0.45]} />
      </RigidBody>
      <mesh position={[0, 0.48, -0.25]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 0.1, 0.55]} />
        <meshStandardMaterial color={palette.bench} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.85, -0.52]} castShadow>
        <boxGeometry args={[2.2, 0.55, 0.08]} />
        <meshStandardMaterial color={palette.bench} roughness={0.6} />
      </mesh>
      {[-0.9, 0.9].map((x) => (
        <mesh key={x} position={[x, 0.24, -0.3]} castShadow>
          <boxGeometry args={[0.1, 0.48, 0.5]} />
          <meshStandardMaterial color={palette.lampPole} metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

/** The district's name over the entry avenue, seen as you walk in. */
function DistrictArch({ name, tagline, accent, color, z }: { name: string; tagline: string; accent: string; color: string; z: number }) {
  const glow = useGlowMaterial(accent, 0.6, 2.8);
  const w = RING.roadHalfWidth * 2 + 5;
  return (
    <group position={[0, 0, z]}>
      {[-1, 1].map((side) => (
        <group key={side}>
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider args={[0.3, 3.6, 0.3]} position={[(side * w) / 2, 3.6, 0]} />
          </RigidBody>
          <mesh position={[(side * w) / 2, 3.6, 0]} castShadow>
            <boxGeometry args={[0.6, 7.2, 0.6]} />
            <meshStandardMaterial color={color} />
          </mesh>
        </group>
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

/** A cluster's name board on the sidewalk, facing the ring road. */
function Signpost({ label, x, z, rot, color }: { label: string; x: number; z: number; rot: number; color: string }) {
  return (
    <group position={[x, 0, z]} rotation-y={rot + Math.PI}>
      {[-1.5, 1.5].map((px) => (
        <mesh key={px} position={[px, 1.3, 0]} castShadow>
          <boxGeometry args={[0.14, 2.6, 0.14]} />
          <meshStandardMaterial color={palette.lampPole} />
        </mesh>
      ))}
      <mesh position={[0, 2.75, 0]} castShadow>
        <boxGeometry args={[3.6, 0.7, 0.12]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 3.14, 0]}>
        <boxGeometry args={[3.6, 0.06, 0.14]} />
        <meshStandardMaterial color={accents.gold} emissive={accents.gold} emissiveIntensity={0.4} />
      </mesh>
      {[0.07, -0.07].map((dz) => (
        <Text
          key={dz}
          position={[0, 2.75, dz]}
          rotation-y={dz > 0 ? 0 : Math.PI}
          fontSize={0.32}
          maxWidth={3.3}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
        >
          {label}
        </Text>
      ))}
    </group>
  );
}
