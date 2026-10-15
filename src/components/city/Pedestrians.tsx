"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { CapsuleCollider, type RapierRigidBody, RigidBody } from "@react-three/rapier";
import { Suspense, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { seedContent } from "@/content/seed";
import { useCityStore } from "@/state/useCityStore";
import { playerState } from "@/world/env";
import { sfx } from "@/world/sfx";
import { NPC_PEOPLE } from "@/world/outfits";
import { Person, type PersonLook } from "./Person";
import type { CharacterAnimation } from "./Character";
import { useProximity } from "./useProximity";

export type Walker = {
  id: string;
  name: string;
  person: PersonLook;
  /** Closed loop of waypoints on the ground */
  path: [number, number][];
  speed: number;
  /** Which district's NPC lines they know ("any" lines are always included) */
  district: string;
};

/** People strolling around. Walk up to one and press E to chat. */
export function Pedestrians({ walkers }: { walkers: Walker[] }) {
  return (
    <group>
      {walkers.map((w) => (
        <Suspense key={w.id} fallback={null}>
          <Pedestrian walker={w} />
        </Suspense>
      ))}
    </group>
  );
}

function Pedestrian({ walker }: { walker: Walker }) {
  const body = useRef<RapierRigidBody>(null);
  const visual = useRef<THREE.Group>(null);
  const state = useRef({
    pos: new THREE.Vector3(walker.path[0][0], 0, walker.path[0][1]),
    target: 1,
    heading: 0,
    pause: 0,
  });
  const [animation, setAnimation] = useState<CharacterAnimation>("walk");
  const [line, setLine] = useState<string | null>(null);
  const talkingUntil = useRef(0);
  const toward = useMemo(() => new THREE.Vector3(), []);
  const lines = useMemo(
    () => seedContent.npcLines.filter((l) => l.district === "any" || l.district === walker.district),
    [walker.district],
  );
  const playGesture = useCityStore((s) => s.playGesture);

  useProximity({
    id: `talk-${walker.id}`,
    label: `Talk to ${walker.name}`,
    radius: 2.6,
    where: () => state.current.pos,
    run: () => {
      const text = lines[Math.floor(Math.random() * lines.length)].text;
      setLine(text);
      talkingUntil.current = performance.now() + 6000;
      setAnimation("emote-yes");
      playGesture("interact-right");
      sfx.talk();
    },
  });

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const s = state.current;
    const dx = playerState.position.x - s.pos.x;
    const dz = playerState.position.z - s.pos.z;
    const playerClose = dx * dx + dz * dz < 3.2 * 3.2;
    const talking = performance.now() < talkingUntil.current;
    if (!talking && line) setLine(null);

    let next: CharacterAnimation = "walk";
    if (playerClose || talking) {
      // Stop and turn to face the visitor.
      s.heading = lerpAngle(s.heading, Math.atan2(dx, dz), delta * 6);
      next = talking && animation === "emote-yes" ? "emote-yes" : "idle";
    } else if (s.pause > 0) {
      s.pause -= delta;
      next = "idle";
    } else {
      const [tx, tz] = walker.path[s.target];
      toward.set(tx - s.pos.x, 0, tz - s.pos.z);
      const dist = toward.length();
      if (dist < 0.3) {
        s.target = (s.target + 1) % walker.path.length;
        if (Math.random() < 0.35) s.pause = 1.5 + Math.random() * 2.5;
      } else {
        toward.normalize();
        s.pos.addScaledVector(toward, Math.min(dist, walker.speed * delta));
        s.heading = lerpAngle(s.heading, Math.atan2(toward.x, toward.z), delta * 5);
      }
    }
    if (next !== animation && !(animation === "emote-yes" && talking)) setAnimation(next);

    body.current?.setNextKinematicTranslation({ x: s.pos.x, y: 0.9, z: s.pos.z });
    if (visual.current) {
      visual.current.position.set(s.pos.x, 0, s.pos.z);
      visual.current.rotation.y = s.heading;
    }
  });

  return (
    <>
      <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[walker.path[0][0], 0.9, walker.path[0][1]]}>
        <CapsuleCollider args={[0.45, 0.35]} />
      </RigidBody>
      <group ref={visual}>
        <Person look={walker.person} animation={animation} detail={false} />
        {line && (
          <Html position={[0, 2.25, 0]} center distanceFactor={9} zIndexRange={[20, 0]}>
            <div className="npc-bubble">
              <p className="npc-name">{walker.name}</p>
              <p>{line}</p>
            </div>
          </Html>
        )}
      </group>
    </>
  );
}

function lerpAngle(from: number, to: number, t: number) {
  const diff = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + diff * Math.min(1, t);
}

const NAMES = ["Lina", "Omar", "Maya", "Karim", "Nour", "Rami", "Sara", "Hadi", "Yara", "Ziad", "Jana", "Tarek"];

/** A handful of walkers with loops around a center, for any scene. */
export function makeWalkers(
  prefix: string,
  district: string,
  loops: { center: [number, number]; radius: number; count: number }[],
  extraPaths: [number, number][][] = [],
): Walker[] {
  const walkers: Walker[] = [];
  let n = 0;
  for (const loop of loops) {
    for (let i = 0; i < loop.count; i++) {
      const offset = (i / loop.count) * Math.PI * 2;
      const dir = i % 2 === 0 ? 1 : -1;
      const path: [number, number][] = Array.from({ length: 10 }, (_, k) => {
        const a = offset + dir * (k / 10) * Math.PI * 2;
        return [loop.center[0] + Math.cos(a) * loop.radius, loop.center[1] + Math.sin(a) * loop.radius];
      });
      walkers.push(make(path));
    }
  }
  for (const path of extraPaths) walkers.push(make(path));
  return walkers;

  function make(path: [number, number][]): Walker {
    const i = n++;
    return {
      id: `${prefix}-${i}`,
      name: NAMES[(i + prefix.length) % NAMES.length],
      person: NPC_PEOPLE[(i * 3 + prefix.length) % NPC_PEOPLE.length],
      path,
      speed: 1.1 + (i % 3) * 0.25,
      district,
    };
  }
}
