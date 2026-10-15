"use client";

import { Text } from "@react-three/drei";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { seedContent } from "@/content/seed";
import type { Seat } from "@/state/useCityStore";
import { useCityStore } from "@/state/useCityStore";
import { type DistrictId, districtById } from "@/world/districts";
import { computeDistrictLayout, districtLawn, doorPoint, RING, SPOKES } from "@/world/layout";
import { accents, palette } from "@/world/palette";
import { Building, DARK } from "./Building";
import { BuildingDoors } from "./BuildingDoors";
import { Foliage } from "./Foliage";
import { GrassField } from "./GrassField";
import { ParkedHorse } from "./Horse";
import { WorldGround } from "./HubScene";
import { useGlowMaterial } from "./materials";
import { paint, surface } from "./surfaces";
import { makeWalkers, Pedestrians } from "./Pedestrians";
import { Balls, Knockables, ParkedCars, Pigeons } from "./Playthings";
import { Portal } from "./Portal";
import { CodeBillboards, Fountain, ParkBenches, Planters, planterPlants } from "./StreetDetails";
import { StreetLamps } from "./StreetProps";
import { MarketStalls, Traffic } from "./Traffic";
import { TEXT_FONT } from "@/world/fonts";

/** A car waiting by each district's gate, ready to drive around the ring. */
const DISTRICT_CAR: Record<DistrictId, string> = {
  business: "suv",
  skills: "hatchback-sports",
  projects: "van",
  campus: "sedan",
  training: "taxi",
  languages: "sedan",
  hobbies: "hatchback-sports",
  arcade: "police",
};

/** Every car you can pick, in every district (the same set as the hub). */
/** Parking bays beside the walkway from the ring road to the plaza (its paving is 3.2 wide). */
const BAY_X = -3.7;

const CAR_CHOICES = ["sedan", "taxi", "suv", "police", "hatchback-sports", "van"];

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
  const lawn = useMemo(() => districtLawn(layout), [layout]);
  // The horse waits beside the stables, facing along the sidewalk.
  const horseSpot = useMemo(() => {
    const stables = layout.buildings.find((b) => b.id === "horse-riding");
    if (!stables) return null;
    const door = doorPoint(stables, 2.2);
    const side = stables.rotY;
    return { x: door.x + Math.sin(side) * (stables.depth / 2 + 1.5), z: door.z + Math.cos(side) * (stables.depth / 2 + 1.5), rot: side };
  }, [layout]);

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

  // An urn planter between the two benches of each pair.
  const planters = useMemo(
    () => SPOKES.map((s) => s + Math.PI / 4).map((a) => ({ x: Math.sin(a) * (RING.plazaRadius - 1.9), z: Math.cos(a) * (RING.plazaRadius - 1.9) })),
    [],
  );
  const foliage = useMemo(() => [...layout.foliage, ...planterPlants(planters)], [layout, planters]);

  const toys = useMemo(() => {
    const at = (a: number, r: number) => ({ x: Math.sin(a) * r, z: Math.cos(a) * r });
    const mid = (RING.plazaRadius + parkEdge) / 2;
    return {
      balls: [
        { ...at(Math.PI / 4, mid), kind: "soccer" as const },
        { ...at((Math.PI * 5) / 4, mid), kind: "beach" as const },
      ],
      stalls: [0.75, 1.25, 1.75].map((k) => {
        const a = Math.PI * k + 0.32;
        return { ...at(a, RING.plazaRadius + 6), rot: a };
      }),
      cones: [-3, -1, 1, 3].map((x) => ({ x, z: ringRadius + RING.roadHalfWidth + 3, kind: "cone" as const })),
    };
  }, [parkEdge, ringRadius]);

  // Every car to pick from, the district's own first: along the left curb of the entry
  // avenue, and the rest beside the walkway from the ring road in to the plaza.
  const cars = useMemo(() => {
    const slots: { x: number; z: number }[] = [];
    for (let z = gateZ - 13; z >= ringRadius + RING.roadHalfWidth + 12; z -= 6.4) slots.push({ x: -RING.roadHalfWidth + 1.6, z });
    for (let z = ringRadius - RING.roadHalfWidth - 5; z >= RING.plazaRadius + 6; z -= 6.4) slots.push({ x: BAY_X, z });
    const models = [DISTRICT_CAR[id], ...CAR_CHOICES.filter((m) => m !== DISTRICT_CAR[id])];
    return models
      .slice(0, slots.length)
      .map((model, i) => ({ id: `${id}-car-${model}`, model, ...slots[i], rot: Math.PI }));
  }, [id, ringRadius, gateZ]);

  return (
    <group>
      <WorldGround />

      {/* Outer sidewalk in front of the buildings, then the ring road */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.015, 0]} receiveShadow material={surface("pavers")}>
        <ringGeometry args={[ringRadius + RING.roadHalfWidth, innerRadius + 1, 128]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]} receiveShadow material={surface("asphalt")}>
        <ringGeometry args={[ringRadius - RING.roadHalfWidth, ringRadius + RING.roadHalfWidth, 128]} />
      </mesh>
      <RoadDashes radius={ringRadius} />
      {/* Raised granite curbs on both sides of the ring road */}
      <CurbRing radius={parkEdge - 0.12} />
      <CurbRing radius={ringRadius + RING.roadHalfWidth + 0.12} />

      {/* Entry avenue from the gate to the ring */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.021, (ringRadius + gateZ + 8) / 2]} receiveShadow material={surface("asphalt")}>
        <planeGeometry args={[RING.roadHalfWidth * 2, gateZ + 8 - ringRadius]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh rotation-x={-Math.PI / 2} position={[s * (RING.roadHalfWidth + 1.5), 0.016, (innerRadius + gateZ + 8) / 2]} receiveShadow material={surface("pavers")}>
            <planeGeometry args={[3, gateZ + 8 - innerRadius]} />
          </mesh>
          <mesh position={[s * (RING.roadHalfWidth + 0.12), 0.06, (ringRadius + RING.roadHalfWidth + gateZ + 8) / 2]} castShadow receiveShadow material={surface("granite")}>
            <boxGeometry args={[0.24, 0.12, gateZ + 8 - ringRadius - RING.roadHalfWidth]} />
          </mesh>
        </group>
      ))}
      {/* Zebra crossing where the avenue meets the ring */}
      {Array.from({ length: Math.floor((RING.roadHalfWidth * 2 - 0.6) / 1.1) }, (_, k) => (
        <mesh
          key={k}
          rotation-x={-Math.PI / 2}
          position={[-RING.roadHalfWidth + 0.85 + k * 1.1, 0.03, ringRadius + RING.roadHalfWidth + 3]}
          material={paint("#f4f1ea")}
          receiveShadow
        >
          <planeGeometry args={[0.55, 3.2]} />
        </mesh>
      ))}

      {/* Paved paths from the plaza through the park to the ring */}
      {SPOKES.map((a) => (
        <mesh
          key={a}
          rotation={[-Math.PI / 2, 0, a]}
          position={[Math.sin(a) * (RING.plazaRadius + parkEdge) * 0.5, 0.025, Math.cos(a) * (RING.plazaRadius + parkEdge) * 0.5]}
          receiveShadow
          material={surface("pavers")}
        >
          <planeGeometry args={[3.2, parkEdge - RING.plazaRadius]} />
        </mesh>
      ))}

      <CentralPlaza color={district.color} accent={district.accent} name={district.name} />
      <Fountain />
      <ParkBenches seats={benches} />

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
      <Planters spots={planters} />
      <Foliage items={foliage} />
      <GrassField isLawn={lawn} radius={layout.outerRadius + 40} count={16000} seed={id.length * 13} />
      <CodeBillboards spots={layout.billboards} />
      <Pedestrians walkers={walkers} />
      <Pigeons center={[0, RING.plazaRadius - 4]} radius={3} count={7} />
      <Balls spots={toys.balls} />
      <Knockables spots={toys.cones} />
      <MarketStalls spots={toys.stalls} />
      {horseSpot && <ParkedHorse id={`${id}-horse`} {...horseSpot} />}
      <ParkedCars cars={cars} />
      {/* Paved bays with white lines under the cars by the walkway */}
      {cars
        .filter((c) => c.x === BAY_X)
        .map((c) => (
          <group key={c.id} position={[BAY_X, 0, c.z]}>
            <mesh rotation-x={-Math.PI / 2} position={[0, 0.022, 0]} receiveShadow material={surface("asphalt")}>
              <planeGeometry args={[4, 6.4]} />
            </mesh>
            {[-3.1, 3.1].map((dz) => (
              <mesh key={dz} rotation-x={-Math.PI / 2} position={[0, 0.026, dz]} material={paint("#f4f1ea")}>
                <planeGeometry args={[3.6, 0.12]} />
              </mesh>
            ))}
          </group>
        ))}
      <Traffic radius={ringRadius} count={Math.max(4, Math.round(ringRadius / 7))} />
    </group>
  );
}

/** Dashed center line around the ring road. */
function RoadDashes({ radius }: { radius: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = Math.round((Math.PI * 2 * radius) / 6);
  const geometry = useMemo(() => new THREE.PlaneGeometry(2.6, 0.16).rotateX(-Math.PI / 2), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2;
      m.makeRotationY(a).setPosition(Math.sin(a) * radius, 0.03, Math.cos(a) * radius);
      mesh.setMatrixAt(k, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [count, radius]);
  return <instancedMesh ref={ref} args={[geometry, paint(palette.roadLine), count]} receiveShadow />;
}

/** A raised granite curb all the way round (a lathe of the curb's square profile). */
function CurbRing({ radius }: { radius: number }) {
  const geometry = useMemo(
    () =>
      new THREE.LatheGeometry(
        [
          [radius - 0.12, 0],
          [radius - 0.12, 0.12],
          [radius + 0.12, 0.12],
          [radius + 0.12, 0],
        ].map(([x, y]) => new THREE.Vector2(x, y)),
        160,
      ),
    [radius],
  );
  return <mesh geometry={geometry} material={surface("granite")} castShadow receiveShadow />;
}

/** The paved plaza in the middle with a glowing ring and the district's colors. */
function CentralPlaza({ color, accent, name }: { color: string; accent: string; name: string }) {
  const glow = useGlowMaterial(accent, 0.5, 2.2);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]} receiveShadow material={surface("stone")}>
        <circleGeometry args={[RING.plazaRadius, 64]} />
      </mesh>
      {/* A band of polished stone in the district's color */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.04, 0]} receiveShadow material={surface("darkStone", color)}>
        <ringGeometry args={[RING.plazaRadius - 3.6, RING.plazaRadius - 3, 64]} />
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
          <mesh position={[0, 0.3, 0]} castShadow receiveShadow material={surface("darkStone")}>
            <boxGeometry args={[1.4, 0.6, 1.4]} />
          </mesh>
          <mesh position={[0, 2.3, 0]} castShadow>
            <cylinderGeometry args={[0.28, 0.5, 3.6, 4]} />
            <meshStandardMaterial color={color} metalness={0.3} roughness={0.4} />
          </mesh>
          <mesh position={[0, 4.35, 0]} material={glow}>
            <octahedronGeometry args={[0.38]} />
          </mesh>
          <Text font={TEXT_FONT} position={[0, 0.32, 0.71]} fontSize={0.16} maxWidth={1.3} color={accents.honey} anchorX="center" anchorY="middle">
            {name}
          </Text>
        </group>
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
          <Text font={TEXT_FONT} position={[0, 7.85, 0]} fontSize={0.75} material={glow} anchorX="center" anchorY="middle">
            {name}
          </Text>
          <Text font={TEXT_FONT} position={[0, 7.15, 0]} fontSize={0.34} color="#e9d8fd" anchorX="center" anchorY="middle">
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
        <Text font={TEXT_FONT}
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
