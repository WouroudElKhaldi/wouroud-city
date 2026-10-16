"use client";

import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useCityStore } from "@/state/useCityStore";
import { sfx } from "@/world/sfx";
import { SideChair, Table } from "../../Furniture";
import { Seats } from "../../StreetDetails";
import { Text } from "../../Text3D";
import { useProximity } from "../../useProximity";
import { flat } from "../finishKit";
import { burstAt, clicked, pointer, seatAt, useWorldPoint } from "../modules";
import { useHouse } from "../SkillHouse";
import type { SigComponent, SigProps } from "./types";

/** Signature pieces for the languages: JavaScript, TypeScript, PHP, Python, HTML, CSS. */

const toast = (text: string, title?: string) => useCityStore.getState().toast(text, title);

// ---------------------------------------------------------------------------
// JavaScript · The Event Loop (hero)
// ---------------------------------------------------------------------------

/**
 * A call stack tower in the middle, a ring-shaped callback queue circling it and a glowing loop
 * overhead. E runs a little program: frames push onto the stack and pop off, and when the stack is
 * empty the loop picks the next callback from the queue.
 */
const PROGRAM: ("push" | "pop" | "tick")[] = ["push", "push", "push", "pop", "pop", "pop", "tick", "pop", "tick", "pop"];
const FRAMES = ["main()", "greet('Tripoli')", "console.log()"];
const QUEUE = ["setTimeout cb", "fetch().then", "onClick", "Promise.then"];

function EventLoop({ toHouse }: SigProps) {
  const { palette, accent } = useHouse();
  const [stack, setStack] = useState<string[]>([]);
  const [queue, setQueue] = useState(QUEUE);
  const queueRef = useRef(QUEUE);
  const step = useRef(-1);
  const nextAt = useRef(0);
  const ring = useRef<THREE.Group>(null);
  const loop = useRef<THREE.Mesh>(null);
  const pushed = useRef(0);

  const run = () => {
    if (step.current >= 0) return;
    step.current = 0;
    pushed.current = 0;
    nextAt.current = performance.now() / 1000;
    sfx.click();
  };
  const where = useWorldPoint(toHouse, 0, 3.4);
  useProximity({ id: "js-event-loop", label: "Run the event loop", radius: 2.2, where, run });

  useFrame((_, delta) => {
    const t = performance.now() / 1000;
    if (ring.current) ring.current.rotation.y += delta * 0.35;
    if (loop.current) loop.current.rotation.z -= delta * (step.current >= 0 ? 2.4 : 0.5);
    if (step.current < 0 || t < nextAt.current) return;
    const op = PROGRAM[step.current];
    if (op === "push") {
      const frame = FRAMES[pushed.current++ % FRAMES.length];
      setStack((s) => [...s, frame]);
      sfx.pop();
    } else if (op === "pop") {
      setStack((s) => s.slice(0, -1));
      sfx.click();
    } else {
      // The stack is empty: the loop takes the oldest callback from the queue.
      const [first, ...rest] = queueRef.current;
      queueRef.current = [...rest, first];
      setQueue(queueRef.current);
      setStack([first]);
      sfx.chirp();
      burstAt(toHouse, 0, 2.6, 0, [accent, "#ffffff"], 16);
    }
    step.current++;
    nextAt.current = t + 0.6;
    if (step.current >= PROGRAM.length) {
      step.current = -1;
      toast("Call stack empty, queue served. That's the event loop: one thread, never blocked.", "🔁 Event loop");
    }
  });

  const glow = flat(accent, 0.3, 0, accent, 1.8);
  return (
    <group onClick={(e) => clicked(e) && run()} {...pointer}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.1, 0.3, 1.1]} position={[0, 0.3, 0]} />
      </RigidBody>
      {/* Base and the call stack */}
      <mesh position={[0, 0.15, 0]} material={flat(palette.ink, 0.3, 0.4)} castShadow receiveShadow>
        <cylinderGeometry args={[1.2, 1.35, 0.3, 40]} />
      </mesh>
      <Text position={[0, 0.32, 1.1]} rotation-x={-Math.PI / 2} fontSize={0.14} color={accent} anchorX="center">
        CALL STACK
      </Text>
      {stack.map((f, i) => (
        <group key={`${i}-${f}`} position={[0, 0.55 + i * 0.5, 0]}>
          <mesh material={flat(i === stack.length - 1 ? accent : palette.paper, 0.4)} castShadow>
            <boxGeometry args={[1.5, 0.42, 0.9]} />
          </mesh>
          <Text position={[0, 0, 0.46]} fontSize={0.15} color={palette.ink} anchorX="center" anchorY="middle">
            {f}
          </Text>
        </group>
      ))}
      {/* The callback queue: a ring of tickets circling the stack */}
      <group ref={ring} position={[0, 0.7, 0]}>
        <mesh rotation-x={Math.PI / 2} material={flat(palette.second, 0.4, 0.5)}>
          <torusGeometry args={[2.6, 0.06, 8, 64]} />
        </mesh>
        {queue.map((q, i) => {
          const a = (i / queue.length) * Math.PI * 2;
          return (
            <group key={q} position={[Math.cos(a) * 2.6, 0.25, Math.sin(a) * 2.6]} rotation-y={-a + Math.PI / 2}>
              <mesh material={flat(i === 0 ? accent : palette.paper, 0.5)} castShadow>
                <boxGeometry args={[1.1, 0.38, 0.12]} />
              </mesh>
              {[0.065, -0.065].map((z) => (
                <Text key={z} position={[0, 0, z]} rotation-y={z < 0 ? Math.PI : 0} fontSize={0.11} color={palette.ink} anchorX="center" anchorY="middle">
                  {q}
                </Text>
              ))}
            </group>
          );
        })}
      </group>
      {/* The loop itself, glowing overhead */}
      <mesh ref={loop} position={[0, 3.3, 0]} material={glow}>
        <torusGeometry args={[1.2, 0.05, 8, 48, Math.PI * 1.7]} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation-x={-Math.PI / 2} material={glow}>
        <ringGeometry args={[3.05, 3.15, 64]} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// JavaScript · Promise Café (room)
// ---------------------------------------------------------------------------

/**
 * Order at the counter and you get a promise: the ticket says <pending> while a cup slides along;
 * a moment later it resolves into your coffee (or, now and then, rejects: out of beans).
 */
function PromiseCafe({ d, w, toHouse, rot, label }: SigProps) {
  const { palette, accent } = useHouse();
  const [state, setState] = useState<"idle" | "pending" | "fulfilled" | "rejected">("idle");
  const settleAt = useRef(0);
  const orders = useRef(0);
  const cup = useRef<THREE.Group>(null);
  const order = () => {
    if (state === "pending") return;
    orders.current++;
    setState("pending");
    settleAt.current = performance.now() / 1000 + 2.4;
    sfx.click();
  };
  useFrame(() => {
    const t = performance.now() / 1000;
    if (state === "pending" && t >= settleAt.current) {
      const rejected = orders.current % 5 === 0;
      setState(rejected ? "rejected" : "fulfilled");
      if (rejected) {
        sfx.clunk();
        toast("Promise rejected: out of beans. .catch() gets you a tea instead.", "☕ Promise Café");
      } else {
        sfx.coin();
        burstAt(toHouse, 0, 1.4, -d / 2 + 0.9, ["#ffffff", "#e7d3b5", accent], 16);
        toast("Promise fulfilled: one flat white, .then(enjoy).", "☕ Promise Café");
      }
    }
    if (cup.current) {
      const k = state === "pending" ? 1 - Math.max(0, settleAt.current - t) / 2.4 : state === "idle" ? 0 : 1;
      cup.current.position.x = -0.9 + k * 1.3;
      cup.current.visible = state !== "idle" && state !== "rejected";
    }
  });
  const where = useWorldPoint(toHouse, 0, -d / 2 + 2);
  useProximity({ id: "js-promise-cafe", label: state === "pending" ? "Waiting for your promise…" : "Order a coffee (await it)", radius: 1.9, where, run: order });
  const ticket = state === "idle" ? "new Promise(order)" : state === "pending" ? "Promise { <pending> }" : state === "fulfilled" ? "Promise { 'flat white' }" : "Promise { <rejected> }";
  const tables: [number, number][] = w > 5.2 ? [[-w / 4, d / 2 - 1.9], [w / 4, d / 2 - 1.9]] : [[0, d / 2 - 1.9]];
  const seats = useMemo(() => tables.flatMap(([x, z], i) => [seatAt(`promise-${i}a`, toHouse, rot, x - 0.55, z, Math.PI / 2), seatAt(`promise-${i}b`, toHouse, rot, x + 0.55, z, -Math.PI / 2)]), [tables.length, toHouse, rot]); // eslint-disable-line react-hooks/exhaustive-deps
  const cw = Math.min(w - 1, 3);
  return (
    <group>
      <group position={[0, 0, -d / 2 + 0.6]} onClick={(e) => clicked(e) && order()} {...pointer}>
        <mesh position={[0, 0.5, 0]} material={flat(palette.ink, 0.35, 0.2)} castShadow>
          <boxGeometry args={[cw, 1, 0.7]} />
        </mesh>
        <mesh position={[0, 1.02, 0]} material={flat(accent, 0.3, 0.1)}>
          <boxGeometry args={[cw + 0.06, 0.04, 0.76]} />
        </mesh>
        {/* The pass: a little conveyor the cup rides along while the promise is pending */}
        <mesh position={[0.2, 1.06, 0.15]} material={flat("#2b2b2b", 0.5, 0.5)}>
          <boxGeometry args={[1.6, 0.03, 0.22]} />
        </mesh>
        <group ref={cup} position={[-0.9, 1.08, 0.15]}>
          <mesh position={[0, 0.06, 0]} material={flat("#ffffff", 0.35)}>
            <cylinderGeometry args={[0.06, 0.045, 0.12, 14]} />
          </mesh>
          <mesh position={[0, 0.115, 0]} rotation-x={-Math.PI / 2} material={flat("#b07a4a", 0.6)}>
            <circleGeometry args={[0.052, 14]} />
          </mesh>
        </group>
        <mesh position={[-cw / 2 + 0.4, 1.3, -0.1]} material={flat("#c0c4ca", 0.2, 0.9)} castShadow>
          <boxGeometry args={[0.5, 0.5, 0.4]} />
        </mesh>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[cw / 2, 0.52, 0.38]} position={[0, 0.52, 0]} />
        </RigidBody>
      </group>
      {/* The order ticket board */}
      <group position={[0, 2.2, -d / 2 + 0.14]}>
        <mesh material={flat(palette.ink, 0.6)}>
          <boxGeometry args={[Math.min(cw, 2.8), 0.9, 0.03]} />
        </mesh>
        <Text position={[0, 0.2, 0.02]} fontSize={0.2} color={accent} anchorX="center" anchorY="middle">
          {label}
        </Text>
        <Text position={[0, -0.15, 0.02]} fontSize={0.13} color={state === "rejected" ? "#f87171" : state === "fulfilled" ? "#86efac" : palette.paper} anchorX="center" anchorY="middle">
          {ticket}
        </Text>
      </group>
      {tables.map(([x, z], i) => (
        <group key={i}>
          <Table position={[x, 0, z]} width={0.7} top="marbleBlack" />
          <SideChair position={[x - 0.55, 0, z]} facing={Math.PI / 2} leather="black" />
          <SideChair position={[x + 0.55, 0, z]} facing={-Math.PI / 2} leather="black" />
        </group>
      ))}
      <Seats seats={seats} />
    </group>
  );
}

export const LANGUAGES: Record<string, SigComponent> = {
  "js-event-loop": EventLoop,
  "js-promise-cafe": PromiseCafe,
};
