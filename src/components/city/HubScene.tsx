"use client";

import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import { Suspense, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { FoliageItem } from "@/world/foliage";
import { DISTRICTS, HUB, landmarkPlacement } from "@/world/districts";
import { computeHubLayout, isHubLawn, WORLD_HALF } from "@/world/hubLayout";
import { accents, palette } from "@/world/palette";
import { Landmark } from "./Landmarks";
import { useGlowMaterial } from "./materials";
import { paint, surface } from "./surfaces";
import { Fountain } from "./StreetDetails";
import { Foliage } from "./Foliage";
import { GRASS_SCALE, GrassField } from "./GrassField";
import { Beacons } from "./Guidance";
import { ChatGroups, type ChatGroup, makeWalkers, Pedestrians } from "./Pedestrians";
import { Statue } from "./Person";
import { WouroudGuide } from "./WouroudGuide";
import { GuestbookStand } from "./CityBoards";
import { Busker } from "./StreetLife";
import { Horizon } from "./Horizon";
import { NPC_PEOPLE } from "@/world/outfits";
import { Balls, Knockables, type ParkedCar, ParkedCars, Pigeons } from "./Playthings";
import { ParkBenches, Planters, planterPlants } from "./StreetDetails";
import { StreetLamps } from "./StreetProps";
import type { Seat } from "@/state/useCityStore";
import { TEXT_FONT } from "@/world/fonts";
import { Text } from "./Text3D";

/** Central Plaza and the ring of district landmarks. */
export function HubScene() {
  const layout = useMemo(() => computeHubLayout(), []);
  const foliage = useMemo(() => [...layout.foliage, ...planterPlants(PLAZA_PLANTERS)], [layout]);
  const ring = useGlowMaterial(palette.neon, 0.3, 2.2);
  const goldRing = useGlowMaterial(accents.gold, 0.3, 2);
  const monument = useGlowMaterial(palette.neon, 0.6, 3);

  return (
    <group>
      <WorldGround />

      {/* Plaza: travertine paving with a granite border and glowing inlaid rings */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.015, 0]} receiveShadow material={surface("stone")}>
        <circleGeometry args={[HUB.plazaRadius, 96]} />
      </mesh>
      <mesh position={[0, 0, 0]} receiveShadow castShadow material={surface("granite")}>
        <cylinderGeometry args={[HUB.plazaRadius + 0.35, HUB.plazaRadius + 0.35, 0.06, 96, 1, true]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]} receiveShadow material={surface("granite")}>
        <ringGeometry args={[HUB.plazaRadius, HUB.plazaRadius + 0.35, 96]} />
      </mesh>
      {[HUB.plazaRadius - 0.5, 11, 7.5].map((r) => (
        <mesh key={r} rotation-x={-Math.PI / 2} position={[0, 0.025, 0]} material={r === 11 ? goldRing : ring}>
          <ringGeometry args={[r - 0.25, r, 128]} />
        </mesh>
      ))}

      {/* Roads to each district: asphalt, painted edge lines, granite curbs */}
      <HubRoads roads={layout.roads} />

      {/* Monument in the fountain */}
      <group>
        <Fountain />
        <RigidBody type="fixed" colliders={false}>
          <CylinderCollider args={[1.5, 2.2]} position={[0, 1.5, 0]} />
        </RigidBody>
        <mesh position={[0, 0.9, 0]} castShadow receiveShadow material={surface("darkStone", "#5a3d96")}>
          <cylinderGeometry args={[2, 2.4, 1.8, 48]} />
        </mesh>
        <Text font={TEXT_FONT} position={[0, 4.2, 0]} fontSize={3.2} material={monument} anchorX="center" anchorY="middle" outlineWidth={0.05} outlineColor="#2d1f52">
          {"</>"}
        </Text>
        {[0, Math.PI].map((r) => (
          <group key={r} rotation-y={r}>
            <Text font={TEXT_FONT} position={[0, 1.15, 2.45]} fontSize={0.42} color="#ffffff" anchorX="center" anchorY="middle" textAlign="center">
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
      <Planters spots={PLAZA_PLANTERS} />
      <Corniche />
      <Foliage items={foliage} />
      <GrassField isLawn={isHubLawn} radius={150} count={GRASS_SCALE * 26000} seed={3} />
      <PlazaBenches />
      <PlazaStatues />
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
      <ChatGroups groups={HUB_CHATS} />
      <WouroudGuide x={3.2} z={9} facing={Math.atan2(-3.2, 3)} />
      <HubBusker />
      <GuestbookStand x={-3.6} z={9.6} facing={Math.atan2(3.6, 3.4)} />
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
      <mesh rotation-x={-Math.PI / 2} receiveShadow material={surface("grass")}>
        <planeGeometry args={[WORLD_HALF * 2, WORLD_HALF * 2]} />
      </mesh>
      <Horizon />
      {/* The seawall where the land meets the Mediterranean */}
      <mesh position={[0, -0.75, WORLD_HALF + 0.6]} material={surface("granite", "#cfc6b8")} receiveShadow>
        <boxGeometry args={[WORLD_HALF * 2, 1.7, 1.2]} />
      </mesh>
    </group>
  );
}

/** The street musician plays between the benches, facing the fountain. */
function HubBusker() {
  const a = landmarkPlacement(DISTRICTS[7].id).angle + Math.PI / DISTRICTS.length;
  const x = Math.cos(a) * 12.2;
  const z = Math.sin(a) * 12.2;
  return <Busker x={x} z={z} facing={Math.atan2(-x, -z)} />;
}

/** Little groups chatting on the plaza, between the benches. */
const HUB_CHATS: ChatGroup[] = [1, 5].map((k, i) => {
  const a = landmarkPlacement(DISTRICTS[k].id).angle + Math.PI / DISTRICTS.length;
  return {
    x: Math.cos(a) * 12.2,
    z: Math.sin(a) * 12.2,
    people: i === 0 ? [NPC_PEOPLE[2], NPC_PEOPLE[3], NPC_PEOPLE[8]] : [NPC_PEOPLE[4], NPC_PEOPLE[9]],
    district: "any",
  };
});

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
    return { id: `hub-${model}`, model, x: Math.cos(a) * r, z: Math.sin(a) * r, rot: -a };
  });
})();

/** Urn planters on both sides of every plaza bench. */
const PLAZA_PLANTERS = DISTRICTS.flatMap((d) => {
  const a = landmarkPlacement(d.id).angle + Math.PI / DISTRICTS.length;
  const r = HUB.plazaRadius - 2.4;
  return [-1, 1].map((side) => ({ x: Math.cos(a + side * 0.17) * r, z: Math.sin(a + side * 0.17) * r }));
});

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
  return <ParkBenches seats={seats} />;
}

type Road = ReturnType<typeof computeHubLayout>["roads"][number];

/** All hub roads; dashes and curbs are instanced (a few draw calls for the whole network). */
function HubRoads({ roads }: { roads: Road[] }) {
  const dashes = useRef<THREE.InstancedMesh>(null);
  const curbs = useRef<THREE.InstancedMesh>(null);
  const edges = useRef<THREE.InstancedMesh>(null);
  const m = useMemo(() => {
    const dash: THREE.Matrix4[] = [];
    const curb: THREE.Matrix4[] = [];
    const edge: THREE.Matrix4[] = [];
    const q = new THREE.Quaternion();
    const place = (road: Road, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, road.rotationY);
      const off = new THREE.Vector3(x, y, z).applyQuaternion(q);
      return new THREE.Matrix4().compose(new THREE.Vector3(road.x + off.x, off.y, road.z + off.z), q, new THREE.Vector3(sx, sy, sz));
    };
    for (const road of roads) {
      for (let k = 0; k < Math.floor(road.length / 5); k++) dash.push(place(road, 0, 0.02, -road.length / 2 + 2.5 + k * 5, 0.16, 1, 2.2));
      for (const side of [-1, 1]) {
        curb.push(place(road, side * (HUB.roadHalfWidth + 0.12), 0.06, 0, 0.24, 0.12, road.length));
        edge.push(place(road, side * (HUB.roadHalfWidth - 0.3), 0.021, 0, 0.14, 1, road.length));
      }
    }
    return { dash, curb, edge };
  }, [roads]);
  useLayoutEffect(() => {
    for (const [ref, list] of [
      [dashes, m.dash],
      [curbs, m.curb],
      [edges, m.edge],
    ] as const) {
      const mesh = ref.current;
      if (!mesh) continue;
      list.forEach((mat, i) => mesh.setMatrixAt(i, mat));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [m]);
  const flat = useMemo(() => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), []);
  return (
    <group>
      {roads.map((road, i) => (
        <mesh key={i} position={[road.x, 0.012, road.z]} rotation={[-Math.PI / 2, 0, road.rotationY]} receiveShadow material={surface("asphalt")}>
          <planeGeometry args={[HUB.roadHalfWidth * 2, road.length]} />
        </mesh>
      ))}
      <instancedMesh ref={dashes} args={[flat, paint(palette.roadLine), m.dash.length]} receiveShadow />
      <instancedMesh ref={edges} args={[flat, paint("#f4f1ea"), m.edge.length]} receiveShadow />
      <instancedMesh ref={curbs} args={[undefined, surface("granite"), m.curb.length]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
    </group>
  );
}

/** Two bronze statues on granite plinths beside the fountain: a developer waving, one looking on. */
function PlazaStatues() {
  const spots = useMemo(() => {
    const a = landmarkPlacement(DISTRICTS[0].id).angle + Math.PI / 2 + Math.PI / DISTRICTS.length;
    return [0, Math.PI].map((d) => ({ x: Math.cos(a + d) * 8.6, z: Math.sin(a + d) * 8.6, facing: Math.atan2(-Math.cos(a + d), -Math.sin(a + d)) + Math.PI }));
  }, []);
  return (
    <group>
      {spots.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]} rotation-y={p.facing}>
          <RigidBody type="fixed" colliders={false}>
            <CylinderCollider args={[0.6, 0.75]} position={[0, 0.6, 0]} />
          </RigidBody>
          <mesh position={[0, 0.45, 0]} material={surface("darkStone")} castShadow receiveShadow>
            <cylinderGeometry args={[0.7, 0.8, 0.9, 32]} />
          </mesh>
          <mesh position={[0, 0.92, 0]} material={surface("granite")} receiveShadow>
            <cylinderGeometry args={[0.75, 0.75, 0.06, 32]} />
          </mesh>
          <group position={[0, 0.95, 0]}>
            <Suspense fallback={null}>
              <Statue look={NPC_PEOPLE[i === 0 ? 0 : 1]} pose={i === 0 ? "wave" : "idle"} at={i === 0 ? 0.45 : 0.2} />
            </Suspense>
          </group>
          <Text position={[0, 0.5, 0.81]} fontSize={0.09} color="#e2c27a" anchorX="center" anchorY="middle" maxWidth={1.2} textAlign="center">
            {i === 0 ? "To every developer\nwho shipped it anyway" : "To the mentors\nwho believed in us"}
          </Text>
        </group>
      ))}
    </group>
  );
}

/**
 * The Corniche: Tripoli's seaside promenade along the southern edge of the hub. Wide paving, a
 * white railing over the sea, palms and lampposts every few meters, and benches facing the water.
 */
const CORNICHE = { z0: WORLD_HALF - 12, z1: WORLD_HALF, half: 120 };
const CORNICHE_LAMPS = Array.from({ length: 13 }, (_, i) => ({ x: -CORNICHE.half + 10 + i * 19, z: CORNICHE.z1 - 2.2, rot: -Math.PI / 2 }));
const CORNICHE_PALMS: FoliageItem[] = Array.from({ length: 12 }, (_, i) => ({
  key: i % 3 === 0 ? "palmBend" : "palm",
  x: -CORNICHE.half + 19 + i * 19,
  z: CORNICHE.z0 + 2,
  rot: i * 1.7,
  size: 0.95 + (i % 3) * 0.1,
  palette: "spring",
}));
const CORNICHE_BENCHES: Seat[] = Array.from({ length: 12 }, (_, i) => ({
  id: `corniche-bench-${i}`,
  x: -CORNICHE.half + 19 + i * 19 + 4,
  y: 0,
  z: CORNICHE.z1 - 4.2,
  facing: 0,
}));

function Corniche() {
  const { z0, z1, half } = CORNICHE;
  const rail = useMemo(() => {
    const posts: THREE.BufferGeometry[] = [];
    for (let x = -half; x <= half; x += 2.4) posts.push(new THREE.BoxGeometry(0.1, 1.05, 0.1).translate(x, 0.52, z1 - 0.5));
    posts.push(new THREE.BoxGeometry(half * 2, 0.08, 0.14).translate(0, 1.05, z1 - 0.5));
    posts.push(new THREE.BoxGeometry(half * 2, 0.05, 0.08).translate(0, 0.6, z1 - 0.5));
    return mergeGeometries(posts.map((g) => g.toNonIndexed()))!;
  }, [half, z1]);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, (z0 + z1) / 2]} receiveShadow material={surface("pavers")}>
        <planeGeometry args={[half * 2, z1 - z0]} />
      </mesh>
      <mesh position={[0, 0.06, z0 - 0.12]} castShadow receiveShadow material={surface("granite")}>
        <boxGeometry args={[half * 2, 0.12, 0.24]} />
      </mesh>
      <mesh geometry={rail} castShadow>
        <meshStandardMaterial color="#f4f1ea" roughness={0.4} metalness={0.3} />
      </mesh>
      <StreetLamps points={CORNICHE_LAMPS} />
      <Foliage items={CORNICHE_PALMS} />
      <ParkBenches seats={CORNICHE_BENCHES} />
      <Text position={[0, 1.6, z1 - 0.45]} rotation-y={Math.PI} fontSize={0.5} color="#fde68a" anchorX="center">
        Corniche · Tripoli
      </Text>
    </group>
  );
}
