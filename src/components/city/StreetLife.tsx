"use client";

import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useCityStore } from "@/state/useCityStore";
import { DISTRICTS, type DistrictId } from "@/world/districts";
import { playerState, registerNightGlow } from "@/world/env";
import { NPC_PEOPLE } from "@/world/outfits";
import { sfx } from "@/world/sfx";
import { emitBurst } from "./Particles";
import { Person } from "./Person";
import { Text } from "./Text3D";
import { useProximity } from "./useProximity";

/**
 * Everyday life on the streets:
 *  - dogs out for a walk with their owners (on a leash; they sit when the owner stops; click one
 *    and it barks and wags)
 *  - a street musician in the hub plaza playing maqam tunes; press E to drop a coin and hear one
 *  - the Ring Line: a city bus that drives each district's ring road and waits at its stop; press E
 *    while it's there to ride it to the next district
 */

// ---------------------------------------------------------------------------
// Dogs
// ---------------------------------------------------------------------------

const DOG = {
  sphere: new THREE.SphereGeometry(1, 14, 10),
  leg: new THREE.CylinderGeometry(0.022, 0.018, 0.2, 6).translate(0, -0.1, 0),
  tail: new THREE.CylinderGeometry(0.012, 0.022, 0.2, 6).translate(0, 0.1, 0),
  nose: new THREE.MeshStandardMaterial({ color: "#151216", roughness: 0.3 }),
  eye: new THREE.MeshStandardMaterial({ color: "#0b0a0c", roughness: 0.15 }),
  leash: new THREE.MeshStandardMaterial({ color: "#d53f8c", roughness: 0.6 }),
};

export const DOG_COATS = ["#c08a4e", "#2b2420", "#efe4d0", "#8a5a34"];
const coatMaterials = new Map<string, THREE.MeshStandardMaterial>();
const coat = (c: string) => {
  let m = coatMaterials.get(c);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
    coatMaterials.set(c, m);
  }
  return m;
};

/** Where the dog walks, in its owner's frame: a little behind and to the right. */
const DOG_AT = new THREE.Vector3(0.62, 0, -0.35);

/**
 * A dog on a leash, drawn in its owner's frame (the owner faces +z). `moving` is the owner's walking
 * speed, read every frame: the legs trot with it and the dog sits when it drops to zero.
 */
export function Dog({ color, moving }: { color: string; moving: { current: number } }) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const legs = useRef<(THREE.Mesh | null)[]>([]);
  const tail = useRef<THREE.Mesh>(null);
  const head = useRef<THREE.Group>(null);
  const t = useRef(color.charCodeAt(2) % 10);
  const wagUntil = useRef(0);
  const sit = useRef(0);
  const mat = coat(color);
  const leash = useMemo(() => {
    // From the owner's hand to the collar, sagging a little.
    const hand = new THREE.Vector3(0.24, 0.86, 0.05);
    const collar = DOG_AT.clone().add(new THREE.Vector3(0, 0.4, 0.2));
    const mid = hand.clone().lerp(collar, 0.5).add(new THREE.Vector3(0, -0.22, 0));
    return new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(hand, mid, collar), 12, 0.006, 4);
  }, []);
  useEffect(() => () => leash.dispose(), [leash]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const speed = moving.current;
    t.current += delta * (4 + speed * 5);
    sit.current = THREE.MathUtils.damp(sit.current, speed > 0.1 ? 0 : 1, 4, delta);
    const s = sit.current;
    const swing = Math.sin(t.current) * 0.6 * (1 - s);
    legs.current.forEach((l, i) => {
      if (!l) return;
      const front = i < 2;
      const phase = i === 0 || i === 3 ? 1 : -1;
      // Sitting: back legs fold forward, front legs stay straight.
      l.rotation.x = swing * phase + (front ? 0 : -s * 1.2);
    });
    if (body.current) {
      body.current.rotation.x = -s * 0.45;
      body.current.position.y = 0.36 - s * 0.08 + Math.abs(Math.sin(t.current)) * 0.015 * (1 - s);
    }
    const wag = performance.now() < wagUntil.current ? 22 : 9;
    if (tail.current) tail.current.rotation.z = Math.sin(performance.now() / 1000 * wag) * 0.5;
    if (head.current) head.current.rotation.y = Math.sin(t.current * 0.13) * 0.3 * s;
  });

  const pet = () => {
    sfx.bark();
    wagUntil.current = performance.now() + 2500;
    const p = new THREE.Vector3();
    root.current?.getWorldPosition(p);
    emitBurst({ position: p.add(new THREE.Vector3(0, 0.7, 0)), kind: "sparkle", count: 12, colors: ["#f472b6", "#ffffff"], spread: 0.3 });
  };

  return (
    <group position={DOG_AT}>
      <group
        ref={root}
        onClick={(e) => {
          if (e.delta > 6) return;
          e.stopPropagation();
          pet();
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <group ref={body} position={[0, 0.36, 0]}>
          <mesh scale={[0.13, 0.13, 0.27]} geometry={DOG.sphere} material={mat} castShadow />
          <mesh position={[0, 0.02, 0.1]} scale={[0.135, 0.135, 0.15]} geometry={DOG.sphere} material={mat} castShadow />
          <group ref={head} position={[0, 0.16, 0.27]}>
            <mesh scale={[0.1, 0.1, 0.11]} geometry={DOG.sphere} material={mat} castShadow />
            <mesh position={[0, -0.03, 0.1]} scale={[0.055, 0.05, 0.08]} geometry={DOG.sphere} material={mat} />
            <mesh position={[0, -0.01, 0.175]} scale={0.022} geometry={DOG.sphere} material={DOG.nose} />
            {[-1, 1].map((sx) => (
              <group key={sx}>
                <mesh position={[sx * 0.045, 0.03, 0.08]} scale={0.014} geometry={DOG.sphere} material={DOG.eye} />
                <mesh position={[sx * 0.08, 0.03, -0.01]} rotation-z={sx * 0.5} scale={[0.025, 0.07, 0.045]} geometry={DOG.sphere} material={mat} />
              </group>
            ))}
            <mesh position={[0, -0.07, 0]} rotation-x={Math.PI / 2} material={DOG.leash}>
              <torusGeometry args={[0.075, 0.012, 6, 16]} />
            </mesh>
          </group>
          <mesh ref={tail} position={[0, 0.06, -0.25]} rotation-x={-0.7} geometry={DOG.tail} material={mat} />
          {[
            [0.07, 0.17],
            [-0.07, 0.17],
            [0.07, -0.17],
            [-0.07, -0.17],
          ].map(([x, z], i) => (
            <mesh key={i} ref={(el) => void (legs.current[i] = el)} position={[x, -0.1, z]} geometry={DOG.leg} material={mat} castShadow />
          ))}
        </group>
      </group>
      <mesh geometry={leash} material={DOG.leash} position={[-DOG_AT.x, 0, -DOG_AT.z]} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// The street musician
// ---------------------------------------------------------------------------

const noteMat = ["#f472b6", "#fde68a", "#5eead4"].map((c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false }));

/** A musician with an oud and an open case for coins. Faces +z. */
export function Busker({ x, z, facing }: { x: number; z: number; facing: number }) {
  const [playing, setPlaying] = useState(false);
  const tips = useRef(0);
  const notes = useRef<THREE.Group>(null);
  const where = useMemo(() => new THREE.Vector3(x, 0, z), [x, z]);
  useProximity({
    id: "busker",
    label: "Drop a coin for the musician",
    radius: 2.6,
    where,
    run: () => {
      sfx.coin();
      tips.current += 1;
      sfx.busk(tips.current + Math.floor(Date.now() / 60000));
      setPlaying(true);
      window.setTimeout(() => setPlaying(false), 3600);
      emitBurst({ position: where.clone().add(new THREE.Vector3(0, 1.6, 0)), kind: "sparkle", count: 18, colors: ["#fde68a", "#f472b6", "#ffffff"], spread: 0.6 });
    },
  });
  useFrame(({ clock }) => {
    const g = notes.current;
    if (!g) return;
    g.children.forEach((n, i) => {
      const k = (clock.elapsedTime * 0.5 + i / g.children.length) % 1;
      n.position.set(Math.sin(k * 6 + i) * 0.3, 1.5 + k * 1.1, 0.2);
      n.scale.setScalar((playing ? 1.4 : 1) * Math.sin(k * Math.PI) * 0.9);
    });
  });
  return (
    <group position={[x, 0, z]} rotation-y={facing}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.4, 0.6, 0.4]} position={[0, 0.6, 0]} />
      </RigidBody>
      {/* A folding stool */}
      <mesh position={[0, 0.46, -0.05]} castShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.05, 16]} />
        <meshStandardMaterial color="#5b3a22" roughness={0.7} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.12, 0.22, -0.05]} rotation-z={s * 0.35}>
          <cylinderGeometry args={[0.015, 0.015, 0.5, 6]} />
          <meshStandardMaterial color="#23222a" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      <group position={[0, 0.02, -0.05]}>
        <Suspense fallback={null}>
          <Person look={NPC_PEOPLE[7 % NPC_PEOPLE.length]} animation="sit" detail={false} />
        </Suspense>
      </group>
      {/* The oud: a pear-shaped bowl, a short bent neck */}
      <group position={[0.04, 0.82, 0.24]} rotation={[0.2, 0, -0.9]}>
        <mesh scale={[0.2, 0.26, 0.11]}>
          <sphereGeometry args={[1, 18, 14]} />
          <meshStandardMaterial color="#8a4b22" roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.02, 0.095]} scale={[0.17, 0.23, 0.02]}>
          <sphereGeometry args={[1, 18, 10]} />
          <meshStandardMaterial color="#e6c79a" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.37, 0.05]}>
          <boxGeometry args={[0.05, 0.24, 0.03]} />
          <meshStandardMaterial color="#3b2416" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.5, 0.0]} rotation-x={-0.9}>
          <boxGeometry args={[0.055, 0.12, 0.025]} />
          <meshStandardMaterial color="#3b2416" roughness={0.5} />
        </mesh>
      </group>
      {/* The open case with a few coins */}
      <group position={[0.15, 0, 0.75]} rotation-y={0.3}>
        <mesh position={[0, 0.05, 0]} receiveShadow>
          <boxGeometry args={[0.42, 0.1, 0.8]} />
          <meshStandardMaterial color="#1c1b20" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.101, 0]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.36, 0.74]} />
          <meshStandardMaterial color="#6b1d3c" roughness={0.95} />
        </mesh>
        {[
          [0.05, 0.1],
          [-0.08, -0.12],
          [0.1, -0.2],
          [-0.04, 0.22],
        ].map(([cx, cz], i) => (
          <mesh key={i} position={[cx, 0.108, cz]}>
            <cylinderGeometry args={[0.025, 0.025, 0.006, 12]} />
            <meshStandardMaterial color="#e2b84a" metalness={0.9} roughness={0.3} />
          </mesh>
        ))}
      </group>
      {/* Music notes drifting up */}
      <group ref={notes}>
        {[0, 1, 2].map((i) => (
          <group key={i}>
            <mesh position={[0, 0, 0]} rotation-z={0.4} scale={[0.07, 0.05, 0.03]} geometry={DOG.sphere} material={noteMat[i]} />
            <mesh position={[0.06, 0.13, 0]} material={noteMat[i]}>
              <boxGeometry args={[0.014, 0.26, 0.014]} />
            </mesh>
            <mesh position={[0.1, 0.24, 0]} rotation-z={-0.6} material={noteMat[i]}>
              <boxGeometry args={[0.08, 0.025, 0.014]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// The Ring Line bus
// ---------------------------------------------------------------------------

/** Where the bus is on its ring right now, so traffic behind it can wait while it's at the stop. */
export const busState = { angle: 0, lane: 1.9, present: false, stopped: false };

const BUS_CRUISE = 5;
const DWELL = 7;
/**
 * The stop's angle on the ring (the entry avenue is at 0): about -0.62 rad, snapped halfway between
 * two of the ring's lampposts (they stand every 16 m, at half steps; see districtDecor in layout.ts).
 */
function stopAngle(radius: number) {
  const step = (Math.PI * 2) / Math.round((Math.PI * 2 * radius) / 16);
  return Math.round(-0.62 / step) * step;
}
const BUS_LANE = 1.9;

const BUS_MAT = {
  body: new THREE.MeshStandardMaterial({ color: "#6b46c1", roughness: 0.35, metalness: 0.3 }),
  stripe: new THREE.MeshStandardMaterial({ color: "#f6c453", roughness: 0.4, metalness: 0.2 }),
  roof: new THREE.MeshStandardMaterial({ color: "#f4f1fa", roughness: 0.5 }),
  glass: new THREE.MeshStandardMaterial({ color: "#1b2433", roughness: 0.08, metalness: 0.6 }),
  tire: new THREE.MeshStandardMaterial({ color: "#151417", roughness: 0.85 }),
  hub: new THREE.MeshStandardMaterial({ color: "#b8b8c2", roughness: 0.3, metalness: 0.9 }),
  door: new THREE.MeshStandardMaterial({ color: "#2a3346", roughness: 0.1, metalness: 0.6 }),
};

function nextDistrict(id: DistrictId) {
  const i = DISTRICTS.findIndex((d) => d.id === id);
  return DISTRICTS[(i + 1) % DISTRICTS.length];
}

/** The bus and its stop on a district's ring road. */
export function BusLine({ radius, district }: { radius: number; district: DistrictId }) {
  const bus = useRef<THREE.Group>(null);
  const doors = useRef<THREE.Group>(null);
  const stopA = useMemo(() => stopAngle(radius), [radius]);
  const state = useRef({ angle: -2, speed: BUS_CRUISE, dwell: 0, served: false });
  const [atStop, setAtStop] = useState(false);
  const next = nextDistrict(district);
  const lights = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#fef9c3", emissive: "#fef08a", emissiveIntensity: 0.2, toneMapped: false }),
    [],
  );
  useEffect(() => registerNightGlow(lights, 0.2, 5), [lights]);
  useEffect(() => {
    busState.present = true;
    return () => {
      busState.present = false;
    };
  }, []);
  const ahead = useMemo(() => new THREE.Vector3(), []);
  const stopSpot = useMemo(() => {
    const r = radius + 5.6;
    return { x: Math.sin(stopA) * r, z: Math.cos(stopA) * r, rot: stopA };
  }, [radius, stopA]);
  const stopWhere = useMemo(() => new THREE.Vector3(stopSpot.x, 0, stopSpot.z), [stopSpot]);

  useProximity({
    id: "bus-stop",
    label: atStop ? `Ride the Ring Line to ${next.name}` : "Bus stop · the Ring Line comes by every minute",
    radius: 3.2,
    where: stopWhere,
    run: () => {
      if (!busState.stopped) {
        useCityStore.getState().toast("The bus is on its way. Wait here, it comes by every minute.", "🚌 Ring Line");
        return;
      }
      sfx.bus();
      useCityStore.getState().toast(`Next stop: ${next.name}`, "🚌 Ring Line");
      useCityStore.getState().goTo(next.id);
    },
  });

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const s = state.current;
    const r = radius + BUS_LANE;
    // Distance (along the road) to the stop, ahead of the bus.
    let toStop = (stopA - s.angle) % (Math.PI * 2);
    if (toStop < 0) toStop += Math.PI * 2;
    const meters = toStop * r;
    if (meters < 0.3 && !s.served) {
      s.served = true;
      s.dwell = DWELL;
      s.speed = 0;
      sfx.bus();
    }
    if (meters > 5) s.served = false;
    let target = BUS_CRUISE;
    if (s.dwell > 0) {
      s.dwell -= delta;
      target = 0;
    } else if (!s.served && meters < 14) target = Math.max(0.6, BUS_CRUISE * (meters / 14));
    // Don't run anyone over either.
    const look = s.angle + 6.5 / r;
    ahead.set(Math.sin(look) * r, 0, Math.cos(look) * r);
    if (ahead.distanceTo(playerState.position) < 3.6) target = 0;
    s.speed = s.dwell > 0 ? 0 : THREE.MathUtils.damp(s.speed, target, 1.4, delta);
    s.angle += (s.speed * delta) / r;
    const stopped = s.dwell > 0;
    busState.angle = s.angle;
    busState.stopped = stopped;
    if (stopped !== atStop) setAtStop(stopped);
    const g = bus.current;
    if (g) {
      g.position.set(Math.sin(s.angle) * r, 0, Math.cos(s.angle) * r);
      g.rotation.y = Math.atan2(Math.cos(s.angle), -Math.sin(s.angle));
    }
    if (doors.current) doors.current.position.z = THREE.MathUtils.damp(doors.current.position.z, stopped ? 0.55 : 0, 5, delta);
  });

  return (
    <group>
      <group ref={bus}>
        <BusBody lights={lights} doors={doors} sign={`Ring Line · ${next.name}`} />
      </group>
      <BusStop x={stopSpot.x} z={stopSpot.z} rot={stopSpot.rot} next={next.name} />
    </group>
  );
}

/** An 11 m city bus, front toward +z, door on its right side (-x). */
function BusBody({ lights, doors, sign }: { lights: THREE.Material; doors: React.RefObject<THREE.Group | null>; sign: string }) {
  const L = 10.5;
  const W = 2.5;
  return (
    <group>
      <mesh position={[0, 1.15, 0]} material={BUS_MAT.body} castShadow receiveShadow>
        <boxGeometry args={[W, 1.5, L]} />
      </mesh>
      <mesh position={[0, 0.72, 0]} material={BUS_MAT.stripe}>
        <boxGeometry args={[W + 0.02, 0.16, L + 0.02]} />
      </mesh>
      {/* Window band and roof */}
      <mesh position={[0, 2.35, 0]} material={BUS_MAT.glass} castShadow>
        <boxGeometry args={[W - 0.04, 0.95, L - 0.1]} />
      </mesh>
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={i} position={[0, 2.35, -L / 2 + 0.8 + i * 1.5]} material={BUS_MAT.body}>
          <boxGeometry args={[W + 0.01, 0.95, 0.12]} />
        </mesh>
      ))}
      <mesh position={[0, 2.9, 0]} material={BUS_MAT.roof} castShadow>
        <boxGeometry args={[W, 0.18, L]} />
      </mesh>
      <mesh position={[0, 3.08, -1.5]} material={BUS_MAT.roof} castShadow>
        <boxGeometry args={[1.6, 0.22, 3]} />
      </mesh>
      {/* Windshield and destination display */}
      <mesh position={[0, 1.95, L / 2 + 0.01]} material={BUS_MAT.glass}>
        <boxGeometry args={[W - 0.2, 1.5, 0.04]} />
      </mesh>
      <mesh position={[0, 2.78, L / 2 + 0.02]}>
        <boxGeometry args={[W - 0.3, 0.26, 0.03]} />
        <meshStandardMaterial color="#0b0a10" />
      </mesh>
      <Text position={[0, 2.78, L / 2 + 0.04]} fontSize={0.13} color="#fbbf24" anchorX="center" anchorY="middle" maxWidth={2.1}>
        {sign}
      </Text>
      {[-1, 1].map((s) => (
        <Text key={s} position={[s * (W / 2 + 0.015), 1.25, 0.5]} rotation-y={(s * Math.PI) / 2} fontSize={0.36} color="#ffffff" anchorX="center" anchorY="middle">
          RING LINE
        </Text>
      ))}
      {[-0.85, 0.85].map((hx) => (
        <mesh key={hx} position={[hx, 0.75, L / 2 + 0.02]} material={lights}>
          <boxGeometry args={[0.36, 0.16, 0.04]} />
        </mesh>
      ))}
      {/* The front door slides open at the stop */}
      <group position={[-W / 2 - 0.01, 0, L / 2 - 1.6]}>
        <group ref={doors}>
          <mesh position={[0, 1.45, 0]} material={BUS_MAT.door}>
            <boxGeometry args={[0.04, 2.3, 1.1]} />
          </mesh>
        </group>
      </group>
      {/* Wheels */}
      {[
        [1, 3.4],
        [-1, 3.4],
        [1, -3.2],
        [-1, -3.2],
      ].map(([sx, z], i) => (
        <group key={i} position={[sx * (W / 2 - 0.12), 0.48, z]} rotation-z={Math.PI / 2}>
          <mesh material={BUS_MAT.tire} castShadow>
            <cylinderGeometry args={[0.48, 0.48, 0.32, 20]} />
          </mesh>
          <mesh position={[0, sx * 0.165, 0]} material={BUS_MAT.hub}>
            <cylinderGeometry args={[0.26, 0.26, 0.02, 16]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** A glass shelter with a bench, a route map and the stop's sign. Faces the road. */
function BusStop({ x, z, rot, next }: { x: number; z: number; rot: number; next: string }) {
  return (
    <group position={[x, 0, z]} rotation-y={rot + Math.PI}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.6, 1.2, 0.08]} position={[0, 1.2, -0.7]} />
      </RigidBody>
      {/* Roof, back glass, posts */}
      <mesh position={[0, 2.5, 0]} castShadow>
        <boxGeometry args={[3.4, 0.08, 1.7]} />
        <meshStandardMaterial color="#2a2733" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, 1.3, -0.7]}>
        <boxGeometry args={[3.2, 2.2, 0.03]} />
        <meshStandardMaterial color="#cfe7f5" transparent opacity={0.28} roughness={0.05} metalness={0.2} />
      </mesh>
      {[-1.6, 1.6].map((px) => (
        <mesh key={px} position={[px, 1.25, -0.7]} castShadow>
          <boxGeometry args={[0.07, 2.5, 0.07]} />
          <meshStandardMaterial color="#2a2733" metalness={0.6} roughness={0.35} />
        </mesh>
      ))}
      {/* Bench */}
      <mesh position={[0, 0.45, -0.45]} castShadow>
        <boxGeometry args={[2.2, 0.06, 0.38]} />
        <meshStandardMaterial color="#8a5a34" roughness={0.6} />
      </mesh>
      {/* The sign on a pole */}
      <group position={[1.9, 0, 0.3]}>
        <mesh position={[0, 1.3, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 2.6, 8]} />
          <meshStandardMaterial color="#2a2733" metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position={[0, 2.4, 0]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.3, 0.3, 0.04, 24]} />
          <meshStandardMaterial color="#6b46c1" />
        </mesh>
        <Text position={[0, 2.4, 0.03]} fontSize={0.16} color="#ffffff" anchorX="center" anchorY="middle">
          BUS
        </Text>
      </group>
      {[0.86, -0.86].map((tz) => (
        <Text key={tz} position={[0, 2.62, tz]} rotation-y={tz > 0 ? 0 : Math.PI} fontSize={0.16} color="#fde68a" anchorX="center" anchorY="middle">
          RING LINE · next: {next}
        </Text>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// E-scooters
// ---------------------------------------------------------------------------

const SCOOTER = {
  deck: new THREE.MeshStandardMaterial({ color: "#1f1d24", roughness: 0.6 }),
  stem: new THREE.MeshStandardMaterial({ color: "#d4d4d8", metalness: 0.8, roughness: 0.3 }),
  tire: new THREE.MeshStandardMaterial({ color: "#121114", roughness: 0.9 }),
};
const SCOOTER_COLORS = ["#22c55e", "#f97316", "#06b6d4"].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, metalness: 0.3 }));

/** A kick scooter with its rider standing on the deck, front toward +z. */
function ScooterRider({ index }: { index: number }) {
  const accent = SCOOTER_COLORS[index % SCOOTER_COLORS.length];
  return (
    <group>
      <mesh position={[0, 0.16, 0]} material={SCOOTER.deck} castShadow>
        <boxGeometry args={[0.16, 0.05, 0.75]} />
      </mesh>
      <mesh position={[0, 0.19, 0]} material={accent}>
        <boxGeometry args={[0.165, 0.012, 0.6]} />
      </mesh>
      <mesh position={[0, 0.66, 0.38]} rotation-x={-0.12} material={SCOOTER.stem} castShadow>
        <cylinderGeometry args={[0.022, 0.022, 1.0, 8]} />
      </mesh>
      <mesh position={[0, 1.15, 0.44]} rotation-z={Math.PI / 2} material={SCOOTER.stem}>
        <cylinderGeometry args={[0.016, 0.016, 0.5, 8]} />
      </mesh>
      {[0.36, -0.36].map((z) => (
        <mesh key={z} position={[0, 0.1, z]} rotation-z={Math.PI / 2} material={SCOOTER.tire} castShadow>
          <cylinderGeometry args={[0.1, 0.1, 0.05, 14]} />
        </mesh>
      ))}
      <group position={[0, 0.19, -0.08]}>
        <Suspense fallback={null}>
          <Person look={NPC_PEOPLE[(index * 5 + 2) % NPC_PEOPLE.length]} animation="idle" detail={false} />
        </Suspense>
      </group>
    </group>
  );
}

/**
 * People on e-scooters riding a district's ring road along the inner curb, the same way as the inner
 * lane's traffic, far enough over that the cars pass them. Like the cars, they stop for you.
 */
export function ScooterRiders({ radius, count = 2 }: { radius: number; count?: number }) {
  const riders = useRef<(THREE.Group | null)[]>([]);
  const state = useRef(Array.from({ length: count }, (_, i) => ({ angle: (i / count) * Math.PI * 2 + 1.1, speed: 3.6 })));
  const ahead = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const r = radius - 3.3;
    state.current.forEach((s, i) => {
      const look = s.angle - 3 / r;
      ahead.set(Math.sin(look) * r, 0, Math.cos(look) * r);
      const blocked = ahead.distanceTo(playerState.position) < 2.4;
      s.speed = THREE.MathUtils.damp(s.speed, blocked ? 0 : 3.6 + i * 0.4, blocked ? 6 : 1, delta);
      s.angle -= (s.speed * delta) / r;
      const g = riders.current[i];
      if (g) {
        g.position.set(Math.sin(s.angle) * r, 0, Math.cos(s.angle) * r);
        g.rotation.y = Math.atan2(Math.cos(s.angle), -Math.sin(s.angle)) + Math.PI;
      }
    });
  });
  return (
    <group>
      {Array.from({ length: count }, (_, i) => (
        <group key={i} ref={(el) => void (riders.current[i] = el)}>
          <ScooterRider index={i} />
        </group>
      ))}
    </group>
  );
}
