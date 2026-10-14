"use client";

import { Text } from "@react-three/drei";
import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import { useMemo } from "react";
import { DISTRICTS, HUB, landmarkPlacement } from "@/world/districts";
import { computeHubLayout, isHubLawn, WORLD_HALF } from "@/world/hubLayout";
import { accents, palette } from "@/world/palette";
import { Landmark } from "./Landmarks";
import { useGlowMaterial } from "./materials";
import { Fountain } from "./StreetDetails";
import { Foliage } from "./Foliage";
import { GrassField } from "./GrassField";
import { Beacons } from "./Guidance";
import { makeWalkers, Pedestrians } from "./Pedestrians";
import { Balls, Knockables, type ParkedCar, ParkedCars, Pigeons } from "./Playthings";
import { Seats } from "./StreetDetails";
import { StreetLamps } from "./StreetProps";
import type { Seat } from "@/state/useCityStore";

/** Central Plaza and the ring of district landmarks. */
export function HubScene() {
  const layout = useMemo(() => computeHubLayout(), []);
  const ring = useGlowMaterial(palette.neon, 0.3, 2.2);
  const goldRing = useGlowMaterial(accents.gold, 0.3, 2);
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
        <mesh key={r} rotation-x={-Math.PI / 2} position={[0, 0.025, 0]} material={r === 11 ? goldRing : ring}>
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
      <Foliage items={layout.foliage} />
      <GrassField isLawn={isHubLawn} radius={150} count={26000} seed={3} />
      <PlazaBenches />
      <Beacons />
      <Pigeons center={[0, 0]} radius={13} count={12} />
      <Balls
        spots={[
          { x: 9, z: 7, kind: "soccer" },
          { x: -10, z: -6, kind: "soccer" },
          { x: 11, z: -8, kind: "beach" },
          { x: -8, z: 10, kind: "beach" },
        ]}
      />
      <Knockables spots={HUB_CONES} />
      <ParkedCars cars={HUB_CARS} />
      <Pedestrians walkers={HUB_WALKERS} />
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

const HUB_WALKERS = makeWalkers("hub", "any", [
  { center: [0, 0], radius: 10.5, count: 3 },
  { center: [0, 0], radius: 15, count: 2 },
]);

/** Cones marking the start of a few roads, ready to be knocked over. */
const HUB_CONES: { x: number; z: number; kind: "cone" | "box" }[] = DISTRICTS.flatMap((d, i) => {
  if (i % 2 === 1) return [];
  const { angle } = landmarkPlacement(d.id);
  const r = HUB.plazaRadius + 3;
  const perp = { x: -Math.sin(angle), z: Math.cos(angle) };
  return [-1, 1].map((side) => ({
    x: Math.cos(angle) * r + perp.x * side * (HUB.roadHalfWidth - 0.8),
    z: Math.sin(angle) * r + perp.z * side * (HUB.roadHalfWidth - 0.8),
    kind: "cone" as "cone" | "box",
  }));
}).concat([
  { x: 24, z: 30, kind: "box" as const },
  { x: 25.4, z: 30.6, kind: "box" as const },
  { x: 24.6, z: 31.8, kind: "box" as const },
]);

/** A row of parked cars on the lawn between Business District and Skill Downtown roads. */
const HUB_CARS: ParkedCar[] = (() => {
  const models = ["sedan", "taxi", "suv", "police", "hatchback-sports", "van"];
  const a = -Math.PI / 2 + Math.PI / 8;
  return models.map((model, i) => {
    const r = 30 + i * 4.2;
    return { model, x: Math.cos(a) * r, z: Math.sin(a) * r, rot: -a };
  });
})();

/** Benches around the plaza, between the road openings. Press E next to one to sit. */
function PlazaBenches() {
  const seats = useMemo<Seat[]>(() => {
    const spokes = DISTRICTS.map((d) => landmarkPlacement(d.id).angle);
    return spokes.map((s, i) => {
      const a = s + Math.PI / DISTRICTS.length;
      const r = HUB.plazaRadius - 2.2;
      return { id: `plaza-bench-${i}`, x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r, facing: Math.atan2(-Math.cos(a), -Math.sin(a)) };
    });
  }, []);
  return (
    <group>
      <Seats seats={seats} />
      {seats.map((seat) => (
        <group key={seat.id} position={[seat.x, 0, seat.z]} rotation-y={seat.facing}>
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider args={[1.1, 0.5, 0.35]} position={[0, 0.5, -0.45]} />
          </RigidBody>
          <mesh position={[0, 0.48, -0.25]} castShadow receiveShadow>
            <boxGeometry args={[2.2, 0.1, 0.55]} />
            <meshStandardMaterial color="#d9a066" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.85, -0.52]} castShadow>
            <boxGeometry args={[2.2, 0.55, 0.08]} />
            <meshStandardMaterial color="#d9a066" roughness={0.6} />
          </mesh>
          {[-0.9, 0.9].map((x) => (
            <mesh key={x} position={[x, 0.24, -0.3]} castShadow>
              <boxGeometry args={[0.1, 0.48, 0.5]} />
              <meshStandardMaterial color={palette.lampPole} metalness={0.5} roughness={0.4} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
