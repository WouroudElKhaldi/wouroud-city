"use client";

import { Text } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { seedContent } from "@/content/seed";
import { type Seat, useCityStore } from "@/state/useCityStore";
import { playerState, registerNightGlow, worldEnv } from "@/world/env";
import { sfx } from "@/world/sfx";
import { emitBurst } from "./Particles";
import { useProximity } from "./useProximity";
import { type Billboard, type LampSpot, STREET } from "@/world/layout";
import { palette } from "@/world/palette";
import { surface } from "./surfaces";
import { TEXT_FONT } from "@/world/fonts";

function useInstanceMatrices(ref: React.RefObject<THREE.InstancedMesh | null>, matrices: THREE.Matrix4[]) {
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [ref, matrices]);
}

function at(x: number, y: number, z: number, rotY = 0) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)),
    new THREE.Vector3(1, 1, 1),
  );
}

/** Raised curbs along both edges of the avenue, and a zebra crossing at the plaza. */
export function Curbs({ avenueEndZ }: { avenueEndZ: number }) {
  const length = STREET.startZ + 6 - avenueEndZ;
  const centerZ = (STREET.startZ + 6 + avenueEndZ) / 2;
  const stripes = useMemo(() => {
    const out: number[] = [];
    for (let x = -STREET.roadHalfWidth + 0.8; x < STREET.roadHalfWidth - 0.4; x += 1.2) out.push(x);
    return out;
  }, []);
  return (
    <group>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (STREET.roadHalfWidth + 0.12), 0.08, centerZ]} receiveShadow castShadow>
          <boxGeometry args={[0.25, 0.16, length]} />
          <meshStandardMaterial color="#f5f0ff" roughness={0.8} />
        </mesh>
      ))}
      {stripes.map((x) => (
        <mesh key={x} position={[x, 0.025, STREET.startZ + 2.5]} receiveShadow>
          <boxGeometry args={[0.6, 0.01, 3]} />
          <meshStandardMaterial color="#f8f5ff" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Benches, planters and bins between the lamps, all instanced so dozens of them cost a few draw calls.
 */
export function StreetFurniture({ lamps }: { lamps: LampSpot[] }) {
  const seats = useRef<THREE.InstancedMesh>(null);
  const backs = useRef<THREE.InstancedMesh>(null);
  const legs = useRef<THREE.InstancedMesh>(null);
  const planters = useRef<THREE.InstancedMesh>(null);
  const flowers = useRef<THREE.InstancedMesh>(null);
  const bins = useRef<THREE.InstancedMesh>(null);

  const m = useMemo(() => {
    const seatM: THREE.Matrix4[] = [];
    const backM: THREE.Matrix4[] = [];
    const legM: THREE.Matrix4[] = [];
    const planterM: THREE.Matrix4[] = [];
    const flowerM: THREE.Matrix4[] = [];
    const binM: THREE.Matrix4[] = [];
    lamps.forEach(({ x: lx, z }, i) => {
      const side = Math.sign(lx);
      const x = side * (STREET.roadHalfWidth + STREET.sidewalkWidth - 0.7);
      const bz = z - 3.5;
      // Bench faces the road
      const rot = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      seatM.push(at(x, 0.48, bz, rot));
      backM.push(at(x + side * 0.28, 0.85, bz, rot));
      legM.push(at(x, 0.24, bz - 0.8, rot), at(x, 0.24, bz + 0.8, rot));
      planterM.push(at(x, 0.35, z - 10.5));
      flowerM.push(at(x, 0.85, z - 10.5, i));
      binM.push(at(lx - side * -0.2, 0.45, z + 1.2));
    });
    return { seatM, backM, legM, planterM, flowerM, binM };
  }, [lamps]);

  useInstanceMatrices(seats, m.seatM);
  useInstanceMatrices(backs, m.backM);
  useInstanceMatrices(legs, m.legM);
  useInstanceMatrices(planters, m.planterM);
  useInstanceMatrices(flowers, m.flowerM);
  useInstanceMatrices(bins, m.binM);

  const benchSeats = useMemo<Seat[]>(
    () =>
      lamps.map(({ x: lx, z }, i) => {
        const side = Math.sign(lx);
        const x = side * (STREET.roadHalfWidth + STREET.sidewalkWidth - 0.7);
        return { id: `bench-${i}`, x: x - side * 0.25, y: 0, z: z - 3.5, facing: side > 0 ? -Math.PI / 2 : Math.PI / 2 };
      }),
    [lamps],
  );

  return (
    <group>
      <Seats seats={benchSeats} />
      <instancedMesh ref={seats} args={[undefined, undefined, m.seatM.length]} castShadow receiveShadow>
        <boxGeometry args={[2, 0.1, 0.5]} />
        <meshStandardMaterial color="#d9a066" roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={backs} args={[undefined, undefined, m.backM.length]} castShadow>
        <boxGeometry args={[2, 0.55, 0.08]} />
        <meshStandardMaterial color="#d9a066" roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={legs} args={[undefined, undefined, m.legM.length]} castShadow>
        <boxGeometry args={[0.1, 0.48, 0.45]} />
        <meshStandardMaterial color={palette.lampPole} metalness={0.5} roughness={0.4} />
      </instancedMesh>
      <instancedMesh ref={planters} args={[undefined, undefined, m.planterM.length]} castShadow receiveShadow>
        <boxGeometry args={[1.4, 0.7, 1.4]} />
        <meshStandardMaterial color="#4c1d95" roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={flowers} args={[undefined, undefined, m.flowerM.length]} castShadow>
        <icosahedronGeometry args={[0.62, 0]} />
        <meshStandardMaterial color="#f0abfc" flatShading roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={bins} args={[undefined, undefined, m.binM.length]} castShadow>
        <cylinderGeometry args={[0.28, 0.24, 0.9, 12]} />
        <meshStandardMaterial color="#14b8a6" metalness={0.3} roughness={0.5} />
      </instancedMesh>
    </group>
  );
}

const CODE_LINES = [
  "const city = build(wouroud.skills);",
  "await deploy({ region: 'tripoli' });",
  "if (bug) { coffee++; fix(bug); }",
  "git commit -m \"ship it, not perfect\"",
  "SELECT * FROM dreams WHERE done = true;",
  "model.predict(nextBigThing);",
];

/** Free-standing holographic screens scrolling code: the city's software theme on every block. */
export function CodeBillboards({ spots }: { spots: Billboard[] }) {
  const screen = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#120a2b",
        emissive: "#3b1d8f",
        emissiveIntensity: 0.6,
        transparent: true,
        opacity: 0.88,
      }),
    [],
  );
  useEffect(() => registerNightGlow(screen, 0.6, 1.4), [screen]);

  return (
    <group>
      {spots.map((s, i) => (
        <group key={`${s.x}:${s.z}`} position={[s.x, 0, s.z]} rotation-y={s.rot}>
          <RigidBody type="fixed" colliders={false}>
            <CylinderCollider args={[1.5, 0.3]} position={[-1.6, 1.5, 0]} />
            <CylinderCollider args={[1.5, 0.3]} position={[1.6, 1.5, 0]} />
          </RigidBody>
          {[-1.6, 1.6].map((x) => (
            <mesh key={x} position={[x, 1.6, 0]} castShadow>
              <boxGeometry args={[0.14, 3.2, 0.14]} />
              <meshStandardMaterial color={palette.lampPole} metalness={0.5} roughness={0.4} />
            </mesh>
          ))}
          <mesh position={[0, 3.3, 0]} material={screen} castShadow>
            <boxGeometry args={[3.6, 1.7, 0.1]} />
          </mesh>
          <ScrollingCode start={i} />
        </group>
      ))}
    </group>
  );
}

/** A code screen. Click it and it types out the next line, one character at a time. */
function ScrollingCode({ start }: { start: number }) {
  const [index, setIndex] = useState(start % CODE_LINES.length);
  const [typed, setTyped] = useState(CODE_LINES[start % CODE_LINES.length].length);
  const caret = useRef<THREE.Mesh>(null);
  const typing = useRef(0);
  const line = CODE_LINES[index];
  useFrame(({ clock }, delta) => {
    if (caret.current) caret.current.visible = Math.floor(clock.elapsedTime * 2) % 2 === 0;
    if (typed < line.length) {
      typing.current += delta;
      if (typing.current > 0.035) {
        typing.current = 0;
        setTyped((n) => n + 1);
      }
    }
  });
  const next = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return;
    e.stopPropagation();
    setIndex((n) => (n + 1) % CODE_LINES.length);
    setTyped(0);
    sfx.click();
  };
  return (
    <group
      position={[0, 3.3, 0.07]}
      onClick={next}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "")}
    >
      <mesh position={[0, 0, -0.01]} visible={false}>
        <planeGeometry args={[3.6, 1.7]} />
      </mesh>
      <Text font={TEXT_FONT} position={[-1.65, 0.55, 0]} fontSize={0.17} color="#a78bfa" anchorX="left" anchorY="middle">
        {"● ● ●   wouroud.ts"}
      </Text>
      <Text font={TEXT_FONT}
        position={[-1.65, 0.05, 0]}
        fontSize={0.2}
        maxWidth={3.3}
        color="#f0abfc"
        anchorX="left"
        anchorY="middle"
      >
        {line.slice(0, typed) || " "}
      </Text>
      <mesh ref={caret} position={[-1.55, -0.45, 0]}>
        <planeGeometry args={[0.12, 0.24]} />
        <meshBasicMaterial color="#e9d8fd" toneMapped={false} />
      </mesh>
      <Text font={TEXT_FONT} position={[-1.35, -0.45, 0]} fontSize={0.16} color="#c4b5fd" anchorX="left" anchorY="middle">
        {"> ready"}
      </Text>
    </group>
  );
}

/**
 * A circular fountain around the plaza monument, with rippling water and jets.
 * Stand next to it and press E to toss a coin: it arcs in, splashes, and the
 * fountain grants a fun fact about Wouroud.
 */
export function Fountain() {
  const water = useRef<THREE.Mesh>(null);
  const jets = useRef<THREE.Group>(null);
  const coin = useRef<THREE.Mesh>(null);
  const flight = useRef<{ from: THREE.Vector3; to: THREE.Vector3; t: number } | null>(null);
  const toast = useCityStore((st) => st.toast);
  const playGesture = useCityStore((st) => st.playGesture);
  const center = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  useProximity({
    id: "fountain",
    label: "Toss a coin and make a wish",
    radius: 7.2,
    where: center,
    run: () => {
      if (flight.current) return;
      const from = playerState.position.clone().add(new THREE.Vector3(0, 1.4, 0));
      const to = from.clone().setY(0.55).multiplyScalar(0.45);
      to.y = 0.55;
      flight.current = { from, to, t: 0 };
      playGesture("interact-right");
      sfx.coin();
      sfx.splash();
    },
  });
  const waterMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#5eead4",
        emissive: "#0d9488",
        emissiveIntensity: 0.15,
        metalness: 0.2,
        roughness: 0.05,
        transparent: true,
        opacity: 0.82,
      }),
    [],
  );
  useEffect(() => registerNightGlow(waterMat, 0.15, 0.9), [waterMat]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (water.current) water.current.position.y = 0.55 + Math.sin(t * 1.4) * 0.02;
    if (jets.current) {
      jets.current.children.forEach((jet, i) => {
        jet.scale.y = 0.85 + Math.sin(t * 3 + i) * 0.15;
      });
    }
    waterMat.opacity = 0.8 + worldEnv.night * 0.1;

    const f = flight.current;
    if (f && coin.current) {
      f.t += 0.016 / 0.55;
      const k = Math.min(1, f.t);
      coin.current.visible = true;
      coin.current.position.lerpVectors(f.from, f.to, k);
      coin.current.position.y += Math.sin(k * Math.PI) * 2.2;
      coin.current.rotation.x += 0.4;
      if (k >= 1) {
        coin.current.visible = false;
        flight.current = null;
        emitBurst({ position: f.to, kind: "splash", count: 30, colors: ["#5eead4", "#ccfbf1", "#ffffff"], spread: 0.4 });
        const facts = seedContent.npcLines;
        toast(facts[Math.floor(Math.random() * facts.length)].text, "✨ The fountain whispers…");
      }
    }
  });

  const jetAngles = useMemo(() => Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2), []);

  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.6, 5.2]} position={[0, 0.6, 0]} />
      </RigidBody>
      {/* Basin rim */}
      <mesh position={[0, 0.5, 0]} rotation-x={Math.PI / 2} castShadow receiveShadow>
        <torusGeometry args={[5, 0.35, 12, 64]} />
        <meshStandardMaterial color="#f5f0ff" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.25, 0]} receiveShadow>
        <cylinderGeometry args={[5, 5, 0.5, 64]} />
        <meshStandardMaterial color="#3b2d63" />
      </mesh>
      <mesh ref={water} position={[0, 0.55, 0]} rotation-x={-Math.PI / 2} material={waterMat}>
        <circleGeometry args={[4.85, 64]} />
      </mesh>
      <mesh ref={coin} visible={false}>
        <cylinderGeometry args={[0.12, 0.12, 0.03, 16]} />
        <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.2} emissive="#f59e0b" emissiveIntensity={0.4} />
      </mesh>
      <group ref={jets}>
        {jetAngles.map((a) => (
          <mesh key={a} position={[Math.cos(a) * 3.6, 1.1, Math.sin(a) * 3.6]} rotation-z={Math.cos(a) * 0.25} rotation-x={-Math.sin(a) * 0.25}>
            <cylinderGeometry args={[0.04, 0.12, 1.2, 8]} />
            <meshStandardMaterial color="#ccfbf1" transparent opacity={0.6} emissive="#5eead4" emissiveIntensity={0.4} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/**
 * Offers "Sit down" at the nearest free seat. Sitting is handled by the Player,
 * which snaps to the seat and plays the sit animation until you move or press E.
 */
export function Seats({ seats }: { seats: Seat[] }) {
  const sit = useCityStore((st) => st.sit);
  const nearest = useRef<Seat | null>(null);
  const point = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    let best: Seat | null = null;
    let bestD = 2.2 * 2.2;
    for (const seat of seats) {
      const d = (seat.x - playerState.position.x) ** 2 + (seat.z - playerState.position.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = seat;
      }
    }
    nearest.current = best;
    if (best) point.set(best.x, 0, best.z);
    else point.set(1e6, 0, 1e6);
  });
  useProximity({
    id: "seat",
    label: "Sit down",
    radius: 2.2,
    where: point,
    run: () => {
      if (nearest.current) sit(nearest.current);
    },
  });
  return null;
}

/** One bench's geometry, split into wooden slats and the cast-iron frame (local: you sit facing +z). */
function benchGeometry() {
  const wood: THREE.BufferGeometry[] = [];
  const iron: THREE.BufferGeometry[] = [];
  // Seat: five slats with small gaps, sloping slightly back.
  for (let i = 0; i < 5; i++) {
    const z = -0.04 - i * 0.095;
    wood.push(new THREE.BoxGeometry(1.9, 0.035, 0.08).translate(0, 0.45 - i * 0.006, z));
  }
  // Backrest: three slats leaning back.
  for (let i = 0; i < 3; i++) {
    const y = 0.6 + i * 0.12;
    wood.push(new THREE.BoxGeometry(1.9, 0.09, 0.03).rotateX(-0.22).translate(0, y, -0.52 - (y - 0.6) * 0.22));
  }
  // Two cast-iron ends: front leg, rear leg rising into the backrest support, seat rail, armrest.
  for (const x of [-0.84, 0.84]) {
    iron.push(new THREE.BoxGeometry(0.05, 0.44, 0.05).translate(x, 0.22, -0.02));
    iron.push(new THREE.BoxGeometry(0.05, 0.92, 0.05).rotateX(-0.22).translate(x, 0.46, -0.48));
    iron.push(new THREE.BoxGeometry(0.05, 0.05, 0.5).translate(x, 0.41, -0.25));
    iron.push(new THREE.BoxGeometry(0.06, 0.04, 0.5).translate(x, 0.66, -0.22));
    iron.push(new THREE.CylinderGeometry(0.03, 0.03, 0.24, 10).translate(x, 0.55, 0.0));
    // Feet.
    iron.push(new THREE.BoxGeometry(0.09, 0.03, 0.12).translate(x, 0.015, -0.02));
    iron.push(new THREE.BoxGeometry(0.09, 0.03, 0.12).translate(x, 0.015, -0.58));
  }
  const strip = (g: THREE.BufferGeometry) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (!["position", "normal", "uv"].includes(k)) n.deleteAttribute(k);
    return n;
  };
  return { wood: mergeGeometries(wood.map(strip))!, iron: mergeGeometries(iron.map(strip))! };
}

const IRON = new THREE.MeshStandardMaterial({ color: "#1c1b20", metalness: 0.75, roughness: 0.38 });
const GOLD_TRIM = new THREE.MeshStandardMaterial({ color: "#c9a24a", metalness: 0.9, roughness: 0.3 });

/**
 * Park benches: walnut slats on black cast-iron ends with brass caps, instanced (three draw calls
 * for every bench in the scene). Press E next to one to sit.
 */
export function ParkBenches({ seats }: { seats: Seat[] }) {
  const geo = useMemo(() => benchGeometry(), []);
  const caps = useMemo(() => {
    const g = new THREE.SphereGeometry(0.035, 10, 8);
    return mergeGeometries([g.clone().translate(-0.84, 0.69, 0.03), g.clone().translate(0.84, 0.69, 0.03)])!;
  }, []);
  const wood = useRef<THREE.InstancedMesh>(null);
  const iron = useRef<THREE.InstancedMesh>(null);
  const gold = useRef<THREE.InstancedMesh>(null);
  const matrices = useMemo(() => seats.map((s) => at(s.x, s.y, s.z, s.facing)), [seats]);
  useInstanceMatrices(wood, matrices);
  useInstanceMatrices(iron, matrices);
  useInstanceMatrices(gold, matrices);
  return (
    <group>
      <Seats seats={seats} />
      <RigidBody type="fixed" colliders={false}>
        {seats.map((s) => (
          <CuboidCollider
            key={s.id}
            args={[1.0, 0.5, 0.33]}
            position={[s.x - Math.sin(s.facing) * 0.3, 0.5, s.z - Math.cos(s.facing) * 0.3]}
            rotation={[0, s.facing, 0]}
          />
        ))}
      </RigidBody>
      <instancedMesh ref={wood} args={[geo.wood, surface("wood", "#a8744a", [2, 0.25]), seats.length]} castShadow receiveShadow />
      <instancedMesh ref={iron} args={[geo.iron, IRON, seats.length]} castShadow />
      <instancedMesh ref={gold} args={[caps, GOLD_TRIM, seats.length]} />
    </group>
  );
}
