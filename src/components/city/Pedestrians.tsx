"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { CapsuleCollider, type RapierRigidBody, RigidBody } from "@react-three/rapier";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { liveContent } from "@/content/live";
import { useCityStore } from "@/state/useCityStore";
import { playerState } from "@/world/env";
import { sfx } from "@/world/sfx";
import { NPC_PEOPLE } from "@/world/outfits";
import { Person, type PersonLook } from "./Person";
import type { CharacterAnimation } from "./Person";
import { useProximity } from "./useProximity";
import { track } from "@/state/progress";

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
  // A friendly wave the first time you walk up to someone (then not again for a while).
  const greet = useRef({ close: false, at: -1e9, until: 0 });
  const toward = useMemo(() => new THREE.Vector3(), []);
  const lines = useMemo(
    () => liveContent.npcLines.filter((l) => l.district === "any" || l.district === walker.district),
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
      track({ type: "talk" });
      sfx.talk();
    },
  });

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const s = state.current;
    const dx = playerState.position.x - s.pos.x;
    const dz = playerState.position.z - s.pos.z;
    const playerClose = dx * dx + dz * dz < 3.2 * 3.2;
    const now = performance.now();
    const talking = now < talkingUntil.current;
    if (!talking && line) setLine(null);
    const g = greet.current;
    if (playerClose && !g.close && now - g.at > 30000) {
      g.at = now;
      g.until = now + 1700;
    }
    g.close = playerClose;
    const waving = now < g.until;

    let next: CharacterAnimation = "walk";
    if (playerClose || talking) {
      // Stop and turn to face the visitor.
      s.heading = lerpAngle(s.heading, Math.atan2(dx, dz), delta * 6);
      next = (talking && animation === "emote-yes") || waving ? "emote-yes" : "idle";
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

export type ChatGroup = { x: number; z: number; people: PersonLook[]; district: string };

/**
 * People standing in a little circle, chatting: they take turns talking (speech dots over the
 * speaker, a nod), turn to look at you when you come close, and press E to hear what they say.
 */
export function ChatGroups({ groups }: { groups: ChatGroup[] }) {
  return (
    <group>
      {groups.map((g, i) => (
        <Suspense key={i} fallback={null}>
          <Chat group={g} index={i} />
        </Suspense>
      ))}
    </group>
  );
}

function Chat({ group, index }: { group: ChatGroup; index: number }) {
  const [speaker, setSpeaker] = useState(0);
  const [line, setLine] = useState<string | null>(null);
  const lines = useMemo(
    () => liveContent.npcLines.filter((l) => l.district === "any" || l.district === group.district),
    [group.district],
  );
  const heads = useRef<(THREE.Group | null)[]>([]);
  const where = useMemo(() => new THREE.Vector3(group.x, 0, group.z), [group.x, group.z]);
  useProximity({
    id: `chat-${index}`,
    label: "Join the conversation",
    radius: 2.8,
    where,
    run: () => {
      setLine(lines[Math.floor(Math.random() * lines.length)]?.text ?? "Welcome to Wouroud's City!");
      sfx.talk();
      track({ type: "talk" });
      window.setTimeout(() => setLine(null), 6000);
    },
  });
  useEffect(() => {
    const t = window.setInterval(() => setSpeaker((s) => (s + 1) % group.people.length), 3200 + index * 400);
    return () => window.clearInterval(t);
  }, [group.people.length, index]);
  const n = group.people.length;
  useFrame((_, delta) => {
    const dx = playerState.position.x - group.x;
    const dz = playerState.position.z - group.z;
    const close = dx * dx + dz * dz < 4 * 4;
    heads.current.forEach((h, i) => {
      if (!h) return;
      const a = (i / n) * Math.PI * 2;
      const px = group.x + Math.sin(a) * 0.75;
      const pz = group.z + Math.cos(a) * 0.75;
      // Face the middle of the circle, or the visitor when they come close.
      const target = close ? Math.atan2(playerState.position.x - px, playerState.position.z - pz) : a + Math.PI;
      h.rotation.y = lerpAngle(h.rotation.y, target, delta * 3);
    });
  });
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CapsuleCollider args={[0.45, 1]} position={[group.x, 0.9, group.z]} />
      </RigidBody>
      {group.people.map((look, i) => {
        const a = (i / n) * Math.PI * 2;
        return (
          <group
            key={i}
            ref={(el) => void (heads.current[i] = el)}
            position={[group.x + Math.sin(a) * 0.75, 0, group.z + Math.cos(a) * 0.75]}
            rotation-y={a + Math.PI}
          >
            <Person look={look} animation={i === speaker ? "emote-yes" : "idle"} detail={false} />
            {i === speaker && !line && (
              <Html position={[0, 2.05, 0]} center distanceFactor={9} zIndexRange={[20, 0]}>
                <div className="npc-bubble">…</div>
              </Html>
            )}
            {i === speaker && line && (
              <Html position={[0, 2.25, 0]} center distanceFactor={9} zIndexRange={[20, 0]}>
                <div className="npc-bubble">
                  <p>{line}</p>
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}
