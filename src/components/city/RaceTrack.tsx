"use client";

import { useFrame } from "@react-three/fiber";
import { CuboidCollider, type RapierRigidBody, RigidBody } from "@react-three/rapier";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { useCityStore } from "@/state/useCityStore";
import { playerState } from "@/world/env";
import { NPC_PEOPLE } from "@/world/outfits";
import { sfx } from "@/world/sfx";
import { CAR_SCALE, CarModel, type CarMotion } from "./CarModel";
import { Person } from "./Person";
import { Text } from "./Text3D";

/**
 * "Ring Road Rally" on the Arcade Pier: three bot drivers and you, three laps of the ring
 * road. The start line is where the entry avenue meets the ring (angle 0, +z), racing toward
 * +x (increasing angle). A gantry of lights counts down; a grandstand of people watches.
 *
 * Bots follow their lane at their own pace with a little rubber band (a bot far ahead eases
 * off, one far behind pushes), so races stay close. They are kinematic bodies: you can bump
 * them, they don't get knocked off line. Progress is measured as the angle travelled around
 * the ring, so cutting through the park doesn't skip a lap.
 */

const LAPS = 3;
const COUNTDOWN_MS = 3600;
const TAU = Math.PI * 2;
const BOTS = [
  { model: "police", pace: 18.5, lane: -1.9, start: -0.11 },
  { model: "taxi", pace: 17, lane: 1.9, start: -0.22 },
  { model: "sedan", pace: 19.5, lane: -1.9, start: -0.22 },
];

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const at = (a: number, r: number) => ({ x: Math.sin(a) * r, z: Math.cos(a) * r });
/** Heading (Player convention: velocity = (sin h, cos h)) of a car driving toward increasing angle. */
const headingAt = (a: number) => Math.atan2(Math.cos(a), -Math.sin(a));

type Bot = { progress: number; speed: number; finishedAt: number | null };

export function RaceTrack({ radius }: { radius: number }) {
  const race = useCityStore((s) => s.race);
  const bots = useRef<Bot[]>(BOTS.map((b) => ({ progress: b.start, speed: 0, finishedAt: null })));
  const player = useRef({ progress: -0.11, last: 0, finishedAt: null as number | null });
  const bodies = useRef<(RapierRigidBody | null)[]>([]);
  const motions = useMemo(() => BOTS.map(() => ({ current: { speed: 0, steer: 0 } as CarMotion })), []);
  const lights = useRef<THREE.MeshStandardMaterial[]>([]);
  const q = useMemo(() => new THREE.Quaternion(), []);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const store = useCityStore.getState();
    const r = store.race;
    if (!r) return;
    const now = performance.now();

    if (r.phase === "grid") {
      // Line up: the player in the sports car on the outer lane, bots around.
      bots.current = BOTS.map((b) => ({ progress: b.start, speed: 0, finishedAt: null }));
      const a = -0.11;
      const p = at(a, radius + 1.9);
      player.current = { progress: a, last: a, finishedAt: null };
      store.startDriving({ id: "race-car", model: "hatchback-sports", from: { x: p.x, z: p.z, rot: headingAt(a) } });
      store.updateRace({ phase: "countdown", goAt: now + COUNTDOWN_MS, lap: 0, position: 4, racers: BOTS.length + 1 });
      sfx.click();
      return;
    }

    // Start lights: three reds count down, all green at go.
    const left = (r.goAt - now) / 1000;
    lights.current.forEach((m, i) => {
      const green = left <= 0;
      const on = green || left <= 3 - i;
      m.color.set(green ? "#22c55e" : on ? "#ef4444" : "#2a2a30");
      m.emissive.set(green ? "#22c55e" : on ? "#ef4444" : "#000000");
    });
    if (r.phase === "countdown") {
      if (left <= 0) {
        store.updateRace({ phase: "racing" });
        sfx.honk();
      }
    }

    // The player's progress around the ring.
    const pa = Math.atan2(playerState.position.x, playerState.position.z);
    const pl = player.current;
    if (r.phase === "racing" && pl.finishedAt === null) {
      pl.progress += wrap(pa - pl.last);
    }
    pl.last = pa;

    // Bots.
    const racing = r.phase === "racing" || r.phase === "finished";
    bots.current.forEach((b, i) => {
      const spec = BOTS[i];
      if (racing && b.finishedAt === null) {
        const gap = b.progress - pl.progress;
        const band = gap > 0.6 ? 0.9 : gap < -0.6 ? 1.1 : 1;
        const wobble = 1 + Math.sin(now / 1700 + i * 2) * 0.05;
        const target = spec.pace * band * wobble;
        b.speed = THREE.MathUtils.damp(b.speed, target, 1.2, delta);
        b.progress += (b.speed * delta) / (radius + spec.lane);
        if (b.progress >= LAPS * TAU) b.finishedAt = now;
      } else if (b.finishedAt !== null) {
        // Over the line: coast to a stop.
        b.speed = THREE.MathUtils.damp(b.speed, 0, 1.5, delta);
        b.progress += (b.speed * delta) / (radius + spec.lane);
      }
      motions[i].current.speed = b.speed;
      const pos = at(b.progress, radius + spec.lane);
      const body = bodies.current[i];
      if (body) {
        body.setNextKinematicTranslation({ x: pos.x, y: 0, z: pos.z });
        body.setNextKinematicRotation(q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, headingAt(b.progress)));
      }
    });

    if (r.phase === "racing") {
      // Laps and place.
      const lap = Math.max(0, Math.floor(pl.progress / TAU));
      const ahead = bots.current.filter((b) => b.progress > pl.progress || (b.finishedAt !== null && pl.finishedAt === null)).length;
      const position = ahead + 1;
      if (pl.progress >= LAPS * TAU) {
        pl.finishedAt = now;
        store.updateRace({ phase: "finished", position, lap: LAPS, time: (now - r.goAt) / 1000 });
        if (position === 1) sfx.coin();
        else sfx.clunk();
      } else if (lap !== r.lap || position !== r.position) {
        if (lap > r.lap) sfx.chirp();
        store.updateRace({ lap, position });
      }
    }
  });

  const start = at(0, radius);
  return (
    <group>
      {/* Bot cars */}
      {BOTS.map((b, i) => {
        const p = at(b.start, radius + b.lane);
        return (
          <RigidBody
            key={b.model}
            ref={(el) => void (bodies.current[i] = el)}
            type="kinematicPosition"
            colliders={false}
            position={[p.x, 0, p.z]}
            rotation={[0, headingAt(b.start), 0]}
          >
            <CuboidCollider args={[0.75 * CAR_SCALE, 0.6 * CAR_SCALE, 1.27 * CAR_SCALE]} position={[0, 0.6 * CAR_SCALE, 0]} />
            <group scale={CAR_SCALE} position={[0, 0.3 * CAR_SCALE, 0]}>
              <Suspense fallback={null}>
                <CarModel id={`race-bot-${i}`} model={b.model} motion={motions[i]} />
              </Suspense>
            </group>
          </RigidBody>
        );
      })}

      {/* Start/finish line: a checkered strip across the road and a gantry of lights */}
      <group position={[start.x, 0, start.z]} rotation-y={headingAt(0)}>
        {Array.from({ length: 16 }, (_, k) =>
          [0, 1].map((row) => (
            <mesh key={`${k}-${row}`} rotation-x={-Math.PI / 2} position={[-4 + k * 0.5 + 0.25, 0.035, row * 0.5 - 0.25]}>
              <planeGeometry args={[0.5, 0.5]} />
              <meshStandardMaterial color={(k + row) % 2 ? "#111111" : "#f4f4f4"} roughness={0.6} />
            </mesh>
          )),
        )}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 5.2, 2.7, 0]} castShadow>
            <boxGeometry args={[0.25, 5.4, 0.25]} />
            <meshStandardMaterial color="#1c1b20" metalness={0.7} roughness={0.35} />
          </mesh>
        ))}
        <mesh position={[0, 5.2, 0]} castShadow>
          <boxGeometry args={[10.6, 0.7, 0.4]} />
          <meshStandardMaterial color="#1c1b20" metalness={0.6} roughness={0.4} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[-0.9 + i * 0.9, 5.2, 0.22]}>
            <circleGeometry args={[0.25, 24]} />
            <meshStandardMaterial
              ref={(m) => void (m && (lights.current[i] = m))}
              color="#2a2a30"
              emissive="#000000"
              emissiveIntensity={2}
              toneMapped={false}
            />
          </mesh>
        ))}
        {[0.23, -0.23].map((dz) => (
          <Text key={dz} position={[3.2, 5.2, dz]} rotation-y={dz > 0 ? 0 : Math.PI} fontSize={0.34} color="#fde68a" anchorX="center" anchorY="middle">
            {race ? "RING ROAD RALLY" : "START · FINISH"}
          </Text>
        ))}
      </group>

      <Grandstand radius={radius} />
    </group>
  );
}

/** A small grandstand beside the start line with people watching the race. */
function Grandstand({ radius }: { radius: number }) {
  const spot = at(0.2, radius + 10.5);
  const facing = Math.atan2(-spot.x, -spot.z);
  return (
    <group position={[spot.x, 0, spot.z]} rotation-y={facing}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[4.2, 0.9, 1.6]} position={[0, 0.9, -0.4]} />
      </RigidBody>
      {[0, 1, 2].map((row) => (
        <mesh key={row} position={[0, 0.25 + row * 0.5, -row * 0.8]} castShadow receiveShadow>
          <boxGeometry args={[8.4, 0.5 + row * 0.0, 0.8]} />
          <meshStandardMaterial color={["#d53f8c", "#f6c453", "#5eead4"][row]} roughness={0.6} />
        </mesh>
      ))}
      {[-3, -1, 1, 3].map((x, i) => (
        <group key={x} position={[x, 0.5 + (i % 3) * 0.5, -(i % 3) * 0.8]}>
          <Suspense fallback={null}>
            <Person look={NPC_PEOPLE[(i * 3 + 1) % NPC_PEOPLE.length]} animation="idle" detail={false} />
          </Suspense>
        </group>
      ))}
    </group>
  );
}
