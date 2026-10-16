"use client";

import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useCityStore } from "@/state/useCityStore";
import { sfx } from "@/world/sfx";
import { Batch, Bookcase, ExecChair, SideChair, Table, TallPlant } from "../../Furniture";
import { box, font, Panel, useCanvas, wrap } from "../../roomKit";
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

// ---------------------------------------------------------------------------
// Shared helpers for the pieces below
// ---------------------------------------------------------------------------

const now = () => performance.now() / 1000;
const damp = THREE.MathUtils.damp;
/** Smoothstep of a 0..1 progress (clamped). */
const ease = (k: number) => {
  const c = Math.min(1, Math.max(0, k));
  return c * c * (3 - 2 * c);
};
const mono = (px: number, weight = "") => `${weight} ${Math.round(px)}px ui-monospace, Menlo, Consolas, "Courier New", monospace`;

/** Blueprint paper: deep blue with a fine and a coarse white grid. */
function blueprintPaper(ctx: CanvasRenderingContext2D, w: number, h: number, step: number) {
  ctx.fillStyle = "#1d4f8c";
  ctx.fillRect(0, 0, w, h);
  for (let x = 0; x <= w; x += step) {
    ctx.fillStyle = x % (step * 5) === 0 ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.08)";
    ctx.fillRect(x, 0, x % (step * 5) === 0 ? 2 : 1, h);
  }
  for (let y = 0; y <= h; y += step) {
    ctx.fillStyle = y % (step * 5) === 0 ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.08)";
    ctx.fillRect(0, y, w, y % (step * 5) === 0 ? 2 : 1);
  }
}

// ---------------------------------------------------------------------------
// TypeScript · The Type Gate (hero)
// ---------------------------------------------------------------------------

type TsType = "string" | "number" | "boolean" | "undefined";
type TsValue = { literal: string; text: string; type: TsType; shape: "cube" | "sphere" | "cone" | "ghost"; color: string };
const TS_VALUES: TsValue[] = [
  { literal: "'hi'", text: "'hi': string", type: "string", shape: "sphere", color: "#f5c542" },
  { literal: "undefined", text: "undefined", type: "undefined", shape: "ghost", color: "#dbe7f5" },
  { literal: "42", text: "42: number", type: "number", shape: "cube", color: "#4f9cf9" },
  { literal: "true", text: "true: boolean", type: "boolean", shape: "cone", color: "#34c38f" },
];
const TS_GATE_TYPES: TsType[] = ["string", "number", "boolean"];
const BELT_TOP = 0.82;

/** One value riding the belt: a shape per type, with its type label floating above. */
function TsValueShape({ value }: { value: TsValue }) {
  const ghost = useMemo(
    () => new THREE.MeshStandardMaterial({ color: value.color, emissive: value.color, emissiveIntensity: 0.35, transparent: true, opacity: 0.4, roughness: 0.2, depthWrite: false, side: THREE.DoubleSide }),
    [value.color],
  );
  const solid = flat(value.color, 0.35, 0.1);
  return (
    <group>
      {value.shape === "cube" && (
        <mesh position={[0, 0.18, 0]} material={solid} castShadow>
          <boxGeometry args={[0.36, 0.36, 0.36]} />
        </mesh>
      )}
      {value.shape === "sphere" && (
        <mesh position={[0, 0.2, 0]} material={solid} castShadow>
          <sphereGeometry args={[0.2, 24, 16]} />
        </mesh>
      )}
      {value.shape === "cone" && (
        <mesh position={[0, 0.21, 0]} material={solid} castShadow>
          <coneGeometry args={[0.19, 0.42, 24]} />
        </mesh>
      )}
      {value.shape === "ghost" && (
        <group>
          <mesh position={[0, 0.3, 0]} material={ghost}>
            <sphereGeometry args={[0.17, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          <mesh position={[0, 0.17, 0]} material={ghost}>
            <cylinderGeometry args={[0.17, 0.2, 0.26, 20, 1, true]} />
          </mesh>
          {[-0.06, 0.06].map((x) => (
            <mesh key={x} position={[x, 0.33, 0.15]} material={flat("#0b2545", 0.4)}>
              <sphereGeometry args={[0.025, 8, 6]} />
            </mesh>
          ))}
        </group>
      )}
      <Text position={[0, 0.66, 0]} fontSize={0.12} color="#ffffff" outlineWidth={0.012} outlineColor="#0b2545" anchorX="center" anchorY="middle">
        {value.text}
      </Text>
    </group>
  );
}

/**
 * An airport-style security arch labeled "Type Checker" over a short conveyor belt. Values queue on
 * the belt as shapes with their types. E or a click sends the next one through: if its type matches
 * what the gate expects it passes under a green light, otherwise it bounces back to the end of the
 * line under a red light, with the real compiler error. The expected type cycles string, number,
 * boolean after each value that passes.
 */
function TypeGate({ w, d, toHouse }: SigProps) {
  const { palette, accent } = useHouse();
  const [gate, setGate] = useState(0);
  const [verdict, setVerdict] = useState<{ ok: boolean; text: string } | null>(null);
  const items = useRef<(THREE.Group | null)[]>([]);
  const line = useRef([0, 1, 2, 3]);
  const ride = useRef<{ vi: number; start: number; pass: boolean; expected: TsType; judged: boolean } | null>(null);
  const green = useRef<THREE.MeshStandardMaterial>(null);
  const red = useRef<THREE.MeshStandardMaterial>(null);
  const flash = useRef({ ok: true, until: 0 });
  const rollers = useRef<(THREE.Mesh | null)[]>([]);

  const half = Math.min(3.8, w / 2 - 0.4);
  const headX = -1.1;
  const spacing = Math.max(0.42, (half - 1.4) / 3);
  const slotX = (i: number) => headX - i * spacing;
  const expected = TS_GATE_TYPES[gate];

  const check = () => {
    if (ride.current) return;
    const [vi, ...rest] = line.current;
    line.current = rest;
    ride.current = { vi, start: now(), pass: TS_VALUES[vi].type === expected, expected, judged: false };
    setVerdict(null);
    sfx.click();
  };
  const where = useWorldPoint(toHouse, 0, Math.min(d / 2 - 0.4, 2.2));
  useProximity({ id: "ts-type-gate", label: `Check a value (expects ${expected})`, radius: 2.3, where, run: check });

  useFrame((_, delta) => {
    const t = now();
    const r = ride.current;
    items.current.forEach((g, vi) => {
      if (!g || (r && r.vi === vi)) return;
      g.position.x = damp(g.position.x, slotX(line.current.indexOf(vi)), 6, delta);
      g.position.y = BELT_TOP;
      g.scale.setScalar(damp(g.scale.x, 1, 6, delta));
    });
    const lit = t < flash.current.until;
    if (green.current) green.current.emissiveIntensity = lit && flash.current.ok ? 3.2 : 0.12;
    if (red.current) red.current.emissiveIntensity = lit && !flash.current.ok ? 3.2 : 0.12;
    rollers.current.forEach((m) => m && (m.rotation.y -= delta * (r ? 6 : 0.4)));
    if (!r) return;
    const g = items.current[r.vi];
    if (!g) return;
    const age = t - r.start;
    const from = slotX(0);
    if (age < 0.9) {
      g.position.x = from + (0 - from) * ease(age / 0.9);
    } else if (age < 1.4) {
      g.position.x = 0;
      g.position.y = BELT_TOP + Math.sin((age - 0.9) * 40) * 0.01;
      if (!r.judged) {
        r.judged = true;
        const v = TS_VALUES[r.vi];
        flash.current = { ok: r.pass, until: t + 1.8 };
        if (r.pass) {
          setVerdict({ ok: true, text: `✓ ${v.type}` });
          sfx.chirp();
          burstAt(toHouse, 0, 2.4, 0, ["#22c55e", "#ffffff", accent], 14);
          toast(`const value: ${r.expected} = ${v.literal}; checks out. The types vanish when it compiles: zero runtime cost.`, "🛂 Type Checker");
        } else {
          setVerdict({ ok: false, text: `✗ ${v.type}` });
          sfx.clunk();
          toast(`error TS2322: Type '${v.type}' is not assignable to type '${r.expected}'. Caught before the code ever runs.`, "🛂 Type Checker");
        }
      }
    } else if (age < 2.4) {
      const k = (age - 1.4) / 1;
      if (r.pass) {
        g.position.x = (half - 0.25) * ease(k);
        g.scale.setScalar(k > 0.7 ? Math.max(0.01, 1 - (k - 0.7) / 0.3) : 1);
      } else {
        g.position.x = slotX(line.current.length) * ease(k);
        g.position.y = BELT_TOP + Math.sin(Math.PI * k) * 0.7;
      }
    } else {
      line.current = [...line.current, r.vi];
      if (r.pass) {
        g.position.x = slotX(line.current.length - 1) - 0.4;
        g.scale.setScalar(0.01);
        setGate((n) => (n + 1) % TS_GATE_TYPES.length);
      }
      g.position.y = BELT_TOP;
      ride.current = null;
    }
  });

  const { texture: mat } = useCanvas(
    1024,
    320,
    (ctx, cw, ch) => {
      blueprintPaper(ctx, cw, ch, 32);
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 3;
      ctx.strokeRect(16, 16, cw - 32, ch - 32);
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = mono(26, "700");
      ctx.fillText("TYPE GATE · SECURITY LANE 1 · strict: true", 40, ch - 36);
      ctx.fillText("tsc --noEmit", cw - 240, ch - 36);
    },
    0,
  );

  const lamps = [
    { x: -1.12, color: "#22c55e", ref: green },
    { x: 1.12, color: "#ef4444", ref: red },
  ];
  const metal = flat("#c9d3df", 0.3, 0.8);
  const panel = flat(palette.paper, 0.4, 0.2);
  const blue = flat(palette.main, 0.4, 0.3);
  return (
    <group onClick={(e) => clicked(e) && check()} {...pointer}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[half, BELT_TOP / 2, 0.38]} position={[0, BELT_TOP / 2, 0]} />
        <CuboidCollider args={[0.28, 1.2, 0.08]} position={[0, 1.2, 0.74]} />
        <CuboidCollider args={[0.28, 1.2, 0.08]} position={[0, 1.2, -0.74]} />
      </RigidBody>
      {/* Blueprint floor mat */}
      <mesh position={[0, 0.006, 0]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[half * 2 + 1.2, 2.6]} />
        <meshStandardMaterial map={mat} roughness={0.9} />
      </mesh>
      {/* The conveyor: frame, rubber belt, rails, end rollers and legs */}
      <mesh position={[0, BELT_TOP - 0.09, 0]} material={blue} castShadow>
        <boxGeometry args={[half * 2, 0.14, 0.7]} />
      </mesh>
      <mesh position={[0, BELT_TOP - 0.01, 0]} material={flat("#1f2328", 0.85)}>
        <boxGeometry args={[half * 2 - 0.08, 0.02, 0.56]} />
      </mesh>
      {[-0.34, 0.34].map((z) => (
        <mesh key={z} position={[0, BELT_TOP + 0.03, z]} material={metal}>
          <boxGeometry args={[half * 2, 0.06, 0.03]} />
        </mesh>
      ))}
      {[-half, half].map((x, i) => (
        <mesh key={x} ref={(m) => void (rollers.current[i] = m)} position={[x, BELT_TOP - 0.06, 0]} rotation-x={Math.PI / 2} material={metal}>
          <cylinderGeometry args={[0.08, 0.08, 0.62, 16]} />
        </mesh>
      ))}
      {[-half + 0.2, 0.9, half - 0.2].flatMap((x) =>
        [-0.28, 0.28].map((z) => (
          <mesh key={`${x}${z}`} position={[x, (BELT_TOP - 0.16) / 2, z]} material={metal} castShadow>
            <boxGeometry args={[0.06, BELT_TOP - 0.16, 0.06]} />
          </mesh>
        )),
      )}
      {/* The values in line (one of them may be riding through) */}
      {TS_VALUES.map((v, vi) => (
        <group key={v.text} ref={(g) => void (items.current[vi] = g)} position={[slotX(vi), BELT_TOP, 0]}>
          <TsValueShape value={v} />
        </group>
      ))}
      {/* The arch: two scanner panels and a header */}
      {[-0.74, 0.74].map((z) => (
        <group key={z} position={[0, 0, z]}>
          <mesh position={[0, 0.02, 0]} material={flat(palette.ink, 0.5, 0.3)}>
            <boxGeometry args={[0.72, 0.04, 0.34]} />
          </mesh>
          <mesh position={[0, 1.2, 0]} material={panel} castShadow>
            <boxGeometry args={[0.56, 2.3, 0.14]} />
          </mesh>
          <mesh position={[0, 1.2, z < 0 ? 0.075 : -0.075]} material={flat(accent, 0.3, 0, accent, 0.9)}>
            <boxGeometry args={[0.08, 2.0, 0.01]} />
          </mesh>
          <mesh position={[0, 1.2, z < 0 ? -0.075 : 0.075]} material={blue}>
            <boxGeometry args={[0.4, 2.1, 0.01]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 2.47, 0]} material={panel} castShadow>
        <boxGeometry args={[0.6, 0.28, 1.62]} />
      </mesh>
      {/* The sign on top: name, expected type, verdict and the two lights */}
      <group position={[0, 3.05, 0]}>
        <mesh material={flat(palette.ink, 0.5, 0.2)} castShadow>
          <boxGeometry args={[2.7, 0.9, 0.12]} />
        </mesh>
        <mesh position={[0, -0.47, 0]} material={blue}>
          <boxGeometry args={[2.8, 0.06, 0.16]} />
        </mesh>
        <Text position={[0, 0.24, 0.07]} fontSize={0.22} color="#ffffff" anchorX="center" anchorY="middle" letterSpacing={0.08}>
          TYPE CHECKER
        </Text>
        <Text position={[0, -0.02, 0.07]} fontSize={0.15} color="#9cc7ff" anchorX="center" anchorY="middle">
          {`expects: ${expected}`}
        </Text>
        <Text position={[0, -0.26, 0.07]} fontSize={0.15} color={verdict ? (verdict.ok ? "#86efac" : "#fca5a5") : "#5f7a99"} anchorX="center" anchorY="middle">
          {verdict ? verdict.text : "waiting…"}
        </Text>
        {lamps.map((l) => (
          <group key={l.x} position={[l.x, 0, 0.07]}>
            <mesh rotation-x={Math.PI / 2} material={flat("#0a0f18", 0.4, 0.5)}>
              <cylinderGeometry args={[0.16, 0.16, 0.04, 24]} />
            </mesh>
            <mesh position={[0, 0, 0.02]} rotation-x={Math.PI / 2}>
              <sphereGeometry args={[0.12, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial ref={l.ref} color={l.color} emissive={l.color} emissiveIntensity={0.12} toneMapped={false} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// TypeScript · Drafting Room (room)
// ---------------------------------------------------------------------------

type TsDraft = { name: string; code: string[]; cells: string[]; dim: string; note: string };
const TS_DRAFTS: TsDraft[] = [
  {
    name: "interface Building",
    code: ["interface Building {", "  name: string;", "  floors: number;", "  readonly address: string;", "  architect?: string;", "}"],
    cells: ["name: string", "floors: number", "readonly address: string", "architect?: string"],
    dim: "4 members",
    note: "An interface is a contract for an object's shape. `?` makes a field optional, `readonly` stops it being reassigned.",
  },
  {
    name: "type Id (branded)",
    code: ["type Id = string & {", "  readonly __brand: 'Id';", "};", "", "const toId = (s: string) => s as Id;"],
    cells: ["string", "& { readonly __brand: 'Id' }"],
    dim: "1 intersection",
    note: "A branded type: still a plain string at runtime, but a raw string won't type-check where an Id is expected.",
  },
  {
    name: "function first<T>",
    code: ["function first<T>(items: T[]): T | undefined {", "  return items[0];", "}", "", "first([1, 2, 3]); // T = number"],
    cells: ["<T>", "items: T[]", "returns T | undefined"],
    dim: "1 type parameter",
    note: "A generic function: T is a type parameter, inferred at each call. first(['a']) returns string | undefined.",
  },
  {
    name: "Utility types",
    code: ["type Draft = Partial<Building>;", "type Card = Pick<Building, 'name' | 'floors'>;", "type Locked = Readonly<Building>;", "type ByFloor = Record<number, Building[]>;"],
    cells: ["Partial<T>: all optional", "Pick<T, K>: chosen keys", "Readonly<T>: no writes", "Record<K, V>: keys to values"],
    dim: "4 utilities",
    note: "Utility types build new types from existing ones. They're built into TypeScript: no imports needed.",
  },
];

/** The wall blueprint: a type drawn as a floor plan (members as rooms), its spec and a title block. */
function drawDraft(ctx: CanvasRenderingContext2D, w: number, h: number, draft: TsDraft, sheet: number) {
  blueprintPaper(ctx, w, h, 40);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, w - 40, h - 40);
  ctx.lineWidth = 1;
  ctx.strokeRect(30, 30, w - 60, h - 60);
  // The plan: an outer wall, one room per member
  const px = 90;
  const py = 150;
  const pw = 760;
  const ph = 420;
  ctx.fillStyle = "#ffffff";
  ctx.font = mono(40, "700");
  ctx.fillText(draft.name, px, 90);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 9;
  ctx.strokeRect(px, py, pw, ph);
  const n = draft.cells.length;
  const cols = n <= 2 ? n : 2;
  const rows = Math.ceil(n / cols);
  ctx.lineWidth = 4;
  for (let c = 1; c < cols; c++) {
    ctx.beginPath();
    ctx.moveTo(px + (pw / cols) * c, py);
    ctx.lineTo(px + (pw / cols) * c, py + ph);
    ctx.stroke();
  }
  for (let r = 1; r < rows; r++) {
    ctx.beginPath();
    ctx.moveTo(px, py + (ph / rows) * r);
    ctx.lineTo(px + pw, py + (ph / rows) * r);
    ctx.stroke();
  }
  // Door swings between the rooms
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  draft.cells.forEach((_, i) => {
    const cx = px + (pw / cols) * (i % cols);
    const cy = py + (ph / rows) * Math.floor(i / cols);
    ctx.beginPath();
    ctx.arc(cx + 18, cy + ph / rows - 18, 46, -Math.PI / 2, 0);
    ctx.stroke();
  });
  ctx.fillStyle = "#ffffff";
  draft.cells.forEach((cell, i) => {
    const cx = px + (pw / cols) * (i % cols) + pw / cols / 2;
    const cy = py + (ph / rows) * Math.floor(i / cols) + ph / rows / 2;
    ctx.font = mono(cell.length > 22 ? 24 : 30, "700");
    ctx.textAlign = "center";
    ctx.fillText(cell, cx, cy + 10);
    ctx.textAlign = "left";
  });
  // Dimension lines
  ctx.strokeStyle = "#9cc7ff";
  ctx.fillStyle = "#9cc7ff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px, py - 22);
  ctx.lineTo(px + pw, py - 22);
  ctx.moveTo(px, py - 34);
  ctx.lineTo(px, py - 10);
  ctx.moveTo(px + pw, py - 34);
  ctx.lineTo(px + pw, py - 10);
  ctx.moveTo(px - 30, py);
  ctx.lineTo(px - 30, py + ph);
  ctx.stroke();
  ctx.font = mono(22);
  ctx.textAlign = "center";
  ctx.fillText(draft.dim, px + pw / 2, py - 30);
  ctx.textAlign = "left";
  ctx.save();
  ctx.translate(px - 40, py + ph / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillText("compile time only", 0, 0);
  ctx.restore();
  // The spec: the code itself
  const sx = 900;
  box(ctx, sx, 120, w - sx - 50, 450, 6, "rgba(11,37,69,0.55)", "#ffffff");
  ctx.fillStyle = "#9cc7ff";
  ctx.font = font(24, "700");
  ctx.fillText("SPEC  ·  .ts", sx + 24, 160);
  ctx.fillStyle = "#ffffff";
  draft.code.forEach((l, i) => {
    ctx.font = mono(l.length > 30 ? 19 : 23);
    ctx.fillText(l, sx + 24, 210 + i * 46);
  });
  // Note and title block
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = font(24, "italic");
  wrap(ctx, draft.note, px - 40, 625, 760, 32);
  box(ctx, sx, 600, w - sx - 50, 120, 0, undefined, "#ffffff");
  ctx.fillStyle = "#ffffff";
  ctx.font = font(26, "800");
  ctx.fillText("BLUEPRINT OFFICE", sx + 20, 640);
  ctx.font = mono(21);
  ctx.fillText(`SHEET ${sheet + 1}/${TS_DRAFTS.length} · ${draft.name}`, sx + 20, 674);
  ctx.fillText("SCALE 1:1 · strict: true", sx + 20, 704);
}

/** A drafting table: an A-frame stand, a tilted board with a blueprint sheet and parallel rule, and a stool. Faces +z (the drafter's side). */
function DraftingTable({ x, z, face, sheet }: { x: number; z: number; face: number; sheet: THREE.Texture }) {
  const steel = flat("#2b3440", 0.4, 0.7);
  const wood = flat("#d9c7a3", 0.6);
  return (
    <group position={[x, 0, z]} rotation-y={face}>
      {[-0.52, 0.52].map((sx) => (
        <group key={sx} position={[sx, 0, 0]}>
          {[0.22, -0.22].map((r) => (
            <mesh key={r} position={[0, 0.45, 0]} rotation-x={r} material={steel} castShadow>
              <boxGeometry args={[0.04, 0.92, 0.04]} />
            </mesh>
          ))}
          <mesh position={[0, 0.02, 0]} material={steel}>
            <boxGeometry args={[0.06, 0.04, 0.56]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.38, 0]} material={steel}>
        <boxGeometry args={[1.04, 0.04, 0.04]} />
      </mesh>
      {/* The board, raised at the back */}
      <group position={[0, 0.94, 0]} rotation-x={0.3}>
        <mesh material={wood} castShadow receiveShadow>
          <boxGeometry args={[1.25, 0.03, 0.85]} />
        </mesh>
        <mesh position={[0, 0.0165, -0.02]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.92, 0.64]} />
          <meshBasicMaterial map={sheet} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.025, 0.16]} material={flat("#e8eef5", 0.3, 0.6)}>
          <boxGeometry args={[1.22, 0.012, 0.035]} />
        </mesh>
        <mesh position={[0, 0.02, 0.43]} material={steel}>
          <boxGeometry args={[1.25, 0.04, 0.02]} />
        </mesh>
        <mesh position={[0.3, 0.04, 0.4]} rotation-z={Math.PI / 2} rotation-y={0.3} material={flat("#f2b600", 0.5)}>
          <cylinderGeometry args={[0.006, 0.006, 0.17, 6]} />
        </mesh>
      </group>
      {/* Desk lamp clamped at the back */}
      <mesh position={[-0.55, 1.35, -0.32]} material={steel}>
        <boxGeometry args={[0.02, 0.5, 0.02]} />
      </mesh>
      <mesh position={[-0.42, 1.58, -0.18]} rotation-x={0.6} material={flat("#3178c6", 0.4, 0.3)}>
        <coneGeometry args={[0.08, 0.12, 16, 1, true]} />
      </mesh>
      {/* Stool */}
      <group position={[0, 0, 0.72]}>
        <mesh position={[0, 0.66, 0]} material={flat("#1e2a38", 0.6)} castShadow>
          <cylinderGeometry args={[0.19, 0.18, 0.06, 20]} />
        </mesh>
        <mesh position={[0, 0.34, 0]} material={steel}>
          <cylinderGeometry args={[0.025, 0.025, 0.62, 8]} />
        </mesh>
        <mesh position={[0, 0.28, 0]} rotation-x={Math.PI / 2} material={steel}>
          <torusGeometry args={[0.16, 0.012, 6, 20]} />
        </mesh>
        <mesh position={[0, 0.015, 0]} material={steel}>
          <cylinderGeometry args={[0.22, 0.24, 0.03, 20]} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Drafting tables with blueprint sheets along the side walls, and a big wall blueprint where a type
 * is drawn like an architectural plan. E (or a click on the wall) drafts the next type: an
 * interface, a branded Id, a generic function, utility types.
 */
function DraftingRoom({ w, d, toHouse }: SigProps) {
  const { palette } = useHouse();
  const [sheet, setSheet] = useState(0);
  const bw = Math.min(w - 1.6, 4.4);
  const bh = (bw * 760) / 1400;
  const { texture } = useCanvas(1400, 760, (ctx, cw, ch) => drawDraft(ctx, cw, ch, TS_DRAFTS[sheet], sheet), sheet);
  const { texture: small } = useCanvas(
    256,
    180,
    (ctx, cw, ch) => {
      blueprintPaper(ctx, cw, ch, 16);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.strokeRect(40, 40, 150, 90);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(115, 40);
      ctx.lineTo(115, 130);
      ctx.moveTo(40, 85);
      ctx.lineTo(115, 85);
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = mono(14, "700");
      ctx.fillText("interface Plan", 40, 28);
    },
    0,
  );
  const draft = () => {
    const k = (sheet + 1) % TS_DRAFTS.length;
    setSheet(k);
    sfx.rustle();
    burstAt(toHouse, 0, 2, -d / 2 + 0.4, ["#ffffff", "#9cc7ff", palette.main], 14);
    toast(TS_DRAFTS[k].note, `📐 Sheet ${k + 1}/${TS_DRAFTS.length} · ${TS_DRAFTS[k].name}`);
  };
  const where = useWorldPoint(toHouse, 0, -d / 2 + 1.9);
  useProximity({ id: "ts-drafting", label: "Draft the next type", radius: 2.2, where, run: draft });
  const tables = useMemo(() => {
    const out: { x: number; z: number; face: number }[] = [];
    const x = w / 2 - 1;
    for (let z = -d / 2 + 2.6; z <= d / 2 - 1; z += 2) out.push({ x: -x, z, face: Math.PI / 2 }, { x, z, face: -Math.PI / 2 });
    return out;
  }, [w, d]);
  return (
    <group>
      <Panel position={[0, 0.7 + bh / 2, -d / 2 + 0.12]} width={bw} height={bh} map={texture} frame={palette.ink} onClick={(e) => clicked(e) && draft()} />
      <Batch>
        {tables.map((t) => (
          <DraftingTable key={`${t.x}|${t.z}`} {...t} sheet={small} />
        ))}
      </Batch>
      {tables.map((t) => (
        <group key={`${t.x}|${t.z}`} position={[t.x, 0, t.z]} rotation-y={t.face}>
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider args={[0.64, 0.5, 0.42]} position={[0, 0.5, 0]} />
          </RigidBody>
        </group>
      ))}
      {w > 6 && [-1, 1].map((s) => <TallPlant key={s} position={[s * (w / 2 - 0.5), 0, -d / 2 + 0.5]} seed={s + 3} />)}
    </group>
  );
}

// ---------------------------------------------------------------------------
// PHP · The elePHPant (hero)
// ---------------------------------------------------------------------------

const PHP_FACTS = [
  "PHP began in 1995, when Rasmus Lerdorf released 'Personal Home Page Tools' to count visits to his online résumé.",
  "PHP 7 (2015) shipped the new PHPNG engine: typical apps ran about twice as fast as on PHP 5.6, with less memory.",
  "PHP 8 (2020) added a JIT compiler, match expressions, named arguments and union types. PHP 8.1 followed with enums.",
  "WordPress is written in PHP, and WordPress runs over 40% of all websites.",
  "Laravel, created by Taylor Otwell in 2011, is PHP's most popular framework: Eloquent, Blade and the artisan CLI.",
  "This plush is the elePHPant, PHP's mascot, designed by Vincent Pontier in 2007.",
];

/**
 * A big plush elePHPant (the PHP mascot) on a museum pedestal with a brass plaque, behind velvet
 * ropes. E or a click: it raises its trunk and trumpets, and the plaque's card tells a PHP fact.
 */
function Elephpant({ d, toHouse }: SigProps) {
  const { palette } = useHouse();
  const [fact, setFact] = useState(-1);
  const trunk = useRef<(THREE.Group | null)[]>([]);
  const head = useRef<THREE.Group>(null);
  const start = useRef(-10);
  const second = useRef(true);
  const R = Math.min(2.1, d / 2 - 1.3);

  const trumpet = () => {
    if (now() - start.current < 2.6) return;
    start.current = now();
    second.current = false;
    const k = (fact + 1) % PHP_FACTS.length;
    setFact(k);
    sfx.honk();
    toast(PHP_FACTS[k], "🐘 elePHPant");
  };
  const where = useWorldPoint(toHouse, 0, Math.min(d / 2 - 0.4, R + 0.9));
  useProximity({ id: "php-elephpant", label: "Pat the elePHPant", radius: 2.2, where, run: trumpet });

  useFrame(() => {
    const t = now();
    const age = t - start.current;
    // Up fast, hold, down slow
    const a = age < 0.5 ? ease(age / 0.5) : age < 1.6 ? 1 : 1 - ease((age - 1.6) / 1);
    if (!second.current && age > 0.35) {
      second.current = true;
      sfx.honk();
      burstAt(toHouse, 0.8, 3.1, 0.5, ["#ffffff", palette.main, "#c9a45a"], 18);
    }
    const sway = Math.sin(t * 1.3) * 0.04;
    trunk.current.forEach((g, i) => {
      if (g) g.rotation.z = i === 0 ? 0.2 + a * 1.7 + sway : 0.12 + a * 0.55 + sway * 0.5;
    });
    if (head.current) head.current.rotation.z = a * 0.14;
  });

  const plush = flat("#8892bf", 0.95);
  const plushDark = flat("#6f76ad", 0.95);
  const pad = flat("#4f5b93", 0.9);
  const brass = flat("#c9a45a", 0.3, 0.85);
  const posts = useMemo(() => Array.from({ length: 6 }, (_, i) => [Math.sin((i / 6) * Math.PI * 2) * R, Math.cos((i / 6) * Math.PI * 2) * R] as [number, number]), [R]);
  const ropes = useMemo(
    () =>
      posts.map((p, i) => {
        const q = posts[(i + 1) % posts.length];
        const a = new THREE.Vector3(p[0], 0.9, p[1]);
        const b = new THREE.Vector3(q[0], 0.9, q[1]);
        const mid = a.clone().lerp(b, 0.5).setY(0.66);
        return new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 16, 0.025, 6, false);
      }),
    [posts],
  );
  const segs = [0.13, 0.115, 0.1, 0.085];
  // The trunk: nested segments hanging from the front of the head, each bending a bit more
  const trunkChain = segs.reduceRight<React.ReactNode>(
    (inner, r, i) => (
      <group ref={(g) => void (trunk.current[i] = g)} position={[0, i === 0 ? 0 : -0.22, 0]}>
        <mesh position={[0, -0.11, 0]} material={plush} castShadow>
          <capsuleGeometry args={[r, 0.12, 4, 12]} />
        </mesh>
        {i === segs.length - 1 && (
          <mesh position={[0, -0.24, 0]} material={plushDark}>
            <cylinderGeometry args={[0.08, 0.09, 0.04, 14]} />
          </mesh>
        )}
        {inner}
      </group>
    ),
    null,
  );

  return (
    <group onClick={(e) => clicked(e) && trumpet()} {...pointer}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.55, R]} position={[0, 0.55, 0]} />
      </RigidBody>
      {/* The pedestal: octagonal plinth with brass trim and a plaque */}
      <group rotation-y={Math.PI / 8}>
        <mesh position={[0, 0.06, 0]} material={flat("#2c2645", 0.4, 0.2)} receiveShadow>
          <cylinderGeometry args={[1.42, 1.48, 0.12, 8]} />
        </mesh>
        <mesh position={[0, 0.5, 0]} material={flat("#f1ecf6", 0.35, 0.05)} castShadow receiveShadow>
          <cylinderGeometry args={[1.25, 1.25, 0.76, 8]} />
        </mesh>
        <mesh position={[0, 0.92, 0]} material={flat("#2c2645", 0.4, 0.2)} castShadow>
          <cylinderGeometry args={[1.33, 1.3, 0.08, 8]} />
        </mesh>
        <mesh position={[0, 0.86, 0]} material={brass}>
          <cylinderGeometry args={[1.27, 1.27, 0.03, 8]} />
        </mesh>
      </group>
      <group position={[0, 0.52, 1.17]}>
        <mesh material={brass} castShadow>
          <boxGeometry args={[0.9, 0.3, 0.02]} />
        </mesh>
        <Text position={[0, 0.05, 0.012]} fontSize={0.085} color="#2c2645" anchorX="center" anchorY="middle" letterSpacing={0.05}>
          THE elePHPant
        </Text>
        <Text position={[0, -0.07, 0.012]} fontSize={0.06} color="#2c2645" anchorX="center" anchorY="middle">
          PHP · Since 1995
        </Text>
      </group>
      {/* The plush, standing three-quarters on so its "php" side faces the visitor */}
      <group position={[-0.15, 0.96, -0.05]} rotation-y={-0.5}>
        {[
          [0.42, 0.27],
          [0.42, -0.27],
          [-0.42, 0.27],
          [-0.42, -0.27],
        ].map(([x, z]) => (
          <group key={`${x}${z}`} position={[x, 0, z]}>
            <mesh position={[0, 0.32, 0]} material={plush} castShadow>
              <capsuleGeometry args={[0.17, 0.3, 4, 14]} />
            </mesh>
            <mesh position={[0, 0.03, 0]} material={pad}>
              <cylinderGeometry args={[0.165, 0.17, 0.05, 18]} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 0.9, 0]} scale={[1.25, 0.95, 0.9]} material={plush} castShadow>
          <sphereGeometry args={[0.6, 32, 24]} />
        </mesh>
        <mesh position={[-0.78, 0.92, 0]} rotation-z={-0.7} material={plush}>
          <capsuleGeometry args={[0.04, 0.2, 4, 8]} />
        </mesh>
        <mesh position={[-0.88, 0.8, 0]} material={pad}>
          <sphereGeometry args={[0.06, 10, 8]} />
        </mesh>
        {[1, -1].map((s) => (
          <group key={s} rotation-y={s < 0 ? Math.PI : 0}>
            <Text position={[0, 0.92, 0.555]} fontSize={0.34} color="#ffffff" outlineWidth={0.012} outlineColor={palette.second} anchorX="center" anchorY="middle" fontStyle="italic">
              php
            </Text>
          </group>
        ))}
        {/* Head, ears and trunk tilt back together when it trumpets */}
        <group ref={head} position={[0.5, 1.15, 0]}>
          <mesh position={[0.28, 0.2, 0]} material={plush} castShadow>
            <sphereGeometry args={[0.45, 28, 20]} />
          </mesh>
          {[1, -1].map((s) => (
            <group key={s} position={[0.08, 0.26, s * 0.42]} rotation-y={s * 0.45}>
              <mesh scale={[0.22, 1, 1]} material={plush} castShadow>
                <sphereGeometry args={[0.42, 20, 16]} />
              </mesh>
              <mesh position={[0.06, -0.02, 0]} scale={[0.1, 0.8, 0.8]} material={plushDark}>
                <sphereGeometry args={[0.42, 18, 14]} />
              </mesh>
            </group>
          ))}
          {[1, -1].map((s) => (
            <group key={s} position={[0.66, 0.34, s * 0.17]}>
              <mesh material={flat("#ffffff", 0.3)}>
                <sphereGeometry args={[0.06, 12, 10]} />
              </mesh>
              <mesh position={[0.035, 0, 0]} material={flat("#14112a", 0.2)}>
                <sphereGeometry args={[0.035, 10, 8]} />
              </mesh>
            </group>
          ))}
          <group position={[0.66, 0.08, 0]}>{trunkChain}</group>
        </group>
      </group>
      {/* Velvet ropes on brass posts */}
      {posts.map(([x, z]) => (
        <group key={`${x}|${z}`} position={[x, 0, z]}>
          <mesh position={[0, 0.02, 0]} material={brass}>
            <cylinderGeometry args={[0.15, 0.16, 0.04, 18]} />
          </mesh>
          <mesh position={[0, 0.47, 0]} material={brass} castShadow>
            <cylinderGeometry args={[0.028, 0.028, 0.9, 10]} />
          </mesh>
          <mesh position={[0, 0.95, 0]} material={brass}>
            <sphereGeometry args={[0.05, 12, 10]} />
          </mesh>
        </group>
      ))}
      {ropes.map((g, i) => (
        <mesh key={i} geometry={g} material={flat("#7a1426", 0.8)} castShadow />
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// PHP · 1995 Personal Home Page (room)
// ---------------------------------------------------------------------------

type DialPhase = "page" | "dialing" | "connecting";

/** The CRT's screen: a 1995 personal home page, or the modem dialing up. */
function drawHomePage(ctx: CanvasRenderingContext2D, w: number, h: number, phase: DialPhase, hits: number) {
  if (phase !== "page") {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#c0c0c0";
    ctx.font = mono(26);
    const lines = ["ATDT 555-0199", phase === "dialing" ? "Dialing…" : "CARRIER 28800", phase === "dialing" ? "" : "CONNECT 28800/ARQ/V34"];
    lines.forEach((l, i) => ctx.fillText(l, 30, 60 + i * 40));
    box(ctx, 120, 260, 400, 110, 0, "#c0c0c0", "#ffffff");
    ctx.fillStyle = "#000080";
    ctx.fillRect(120, 260, 400, 28);
    ctx.fillStyle = "#ffffff";
    ctx.font = font(18, "700");
    ctx.fillText("Dial-Up Networking", 130, 280);
    ctx.fillStyle = "#000000";
    ctx.font = font(22);
    ctx.fillText(phase === "dialing" ? "Dialing…" : "Connecting… 28.8 kbps", 140, 325);
    ctx.fillStyle = "#000080";
    ctx.fillRect(140, 342, phase === "dialing" ? 120 : 330, 14);
    return;
  }
  // Tiled grey background with little stars
  for (let y = 0; y < h; y += 32)
    for (let x = 0; x < w; x += 32) {
      ctx.fillStyle = (x + y) % 64 === 0 ? "#c6c6c6" : "#d6d6d6";
      ctx.fillRect(x, y, 32, 32);
      ctx.fillStyle = "#b0b0b0";
      ctx.fillRect(x + 14, y + 10, 4, 12);
      ctx.fillRect(x + 10, y + 14, 12, 4);
    }
  ctx.textAlign = "center";
  ctx.fillStyle = "#000080";
  ctx.font = `bold 38px "Times New Roman", Times, serif`;
  ctx.fillText("Welcome to my Home Page!", w / 2, 56);
  const g = ctx.createLinearGradient(40, 0, w - 40, 0);
  ["#ff0000", "#ff9900", "#ffff00", "#00cc00", "#0000ff", "#9900cc"].forEach((c, i) => g.addColorStop(i / 5, c));
  ctx.fillStyle = g;
  ctx.fillRect(40, 72, w - 80, 6);
  // Under construction
  ctx.save();
  ctx.beginPath();
  ctx.rect(70, 98, w - 140, 60);
  ctx.clip();
  for (let x = 30; x < w; x += 40) {
    ctx.fillStyle = "#ffcc00";
    ctx.beginPath();
    ctx.moveTo(x, 98);
    ctx.lineTo(x + 20, 98);
    ctx.lineTo(x - 40, 158);
    ctx.lineTo(x - 60, 158);
    ctx.fill();
  }
  ctx.restore();
  box(ctx, 160, 110, w - 320, 36, 0, "#ffcc00", "#000000");
  ctx.fillStyle = "#000000";
  ctx.font = `bold 24px "Times New Roman", Times, serif`;
  ctx.fillText("🚧 UNDER CONSTRUCTION 🚧", w / 2, 137);
  // Links
  ctx.font = `22px "Times New Roman", Times, serif`;
  ctx.fillStyle = "#0000ee";
  ["My résumé", "Cool links", "Sign my guestbook!"].forEach((l, i) => {
    const x = w / 2 + (i - 1) * 190;
    ctx.fillText(l, x, 200);
    const m = ctx.measureText(l).width;
    ctx.fillRect(x - m / 2, 204, m, 2);
  });
  // The hit counter
  ctx.fillStyle = "#000000";
  ctx.font = `bold 22px "Times New Roman", Times, serif`;
  ctx.fillText("You are visitor number", w / 2, 262);
  const digits = String(hits).padStart(6, "0");
  const dx = w / 2 - (digits.length * 34) / 2;
  [...digits].forEach((c, i) => {
    box(ctx, dx + i * 34, 278, 30, 44, 2, "#111111", "#666666");
    ctx.fillStyle = "#33ff33";
    ctx.font = mono(32, "700");
    ctx.fillText(c, dx + i * 34 + 15, 312);
  });
  ctx.fillStyle = "#333333";
  ctx.font = `italic 17px "Times New Roman", Times, serif`;
  ctx.fillText("Best viewed with Netscape Navigator at 640×480", w / 2, 370);
  ctx.fillText("Made with Personal Home Page Tools", w / 2, 396);
  ctx.fillStyle = "#800080";
  ctx.fillText("Last updated: June 8, 1995", w / 2, 440);
  ctx.textAlign = "left";
}

/**
 * A 1995 home office: a wooden desk with a beige CRT, tower, keyboard and an external modem whose
 * lights blink. E dials up: the screen connects at 28.8 kbps (with the modem's squeal), then shows
 * the personal home page again with its hit counter one higher.
 */
function HomePage1995({ w, d, toHouse, rot }: SigProps) {
  const { palette } = useHouse();
  const [phase, setPhase] = useState<DialPhase>("page");
  const [hits, setHits] = useState(4271);
  const dialAt = useRef(0);
  const sounds = useRef(0);
  const connected = useRef(true);
  const leds = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const dial = () => {
    if (phase !== "page") return;
    dialAt.current = now();
    sounds.current = 0;
    connected.current = false;
    setPhase("dialing");
  };
  const z0 = -d / 2 + 0.55;
  const where = useWorldPoint(toHouse, 0, z0 + 1.5);
  useProximity({ id: "php-1995", label: phase === "page" ? "Dial up" : "Connecting…", radius: 1.9, where, run: dial });
  const DIAL_SOUNDS: [number, () => void][] = [
    [0, sfx.click],
    [0.15, sfx.vault],
    [0.85, sfx.chirp],
    [1.05, sfx.rustle],
    [1.4, sfx.rustle],
    [1.75, sfx.chirp],
  ];
  useFrame(() => {
    const t = now();
    const age = t - dialAt.current;
    const busy = phase !== "page";
    leds.current.forEach((m, i) => {
      if (!m) return;
      const on = i < 2 ? true : busy ? Math.sin(t * (18 + i * 5) + i) > 0 : i === 2 || Math.sin(t * 2 + i * 2) > 0.85;
      m.emissiveIntensity = on ? 2.4 : 0.1;
    });
    if (!busy || connected.current) return;
    while (sounds.current < DIAL_SOUNDS.length && age >= DIAL_SOUNDS[sounds.current][0]) DIAL_SOUNDS[sounds.current++][1]();
    if (phase === "dialing" && age > 0.9) setPhase("connecting");
    if (age > 2.3) {
      connected.current = true;
      setPhase("page");
      setHits((h) => h + 1);
      sfx.coin();
      burstAt(toHouse, 0, 1.3, z0, ["#33ff33", "#ffcc00", "#ffffff"], 12);
      toast("Connected at 28.8 kbps, and the hit counter ticks up. Counting visitors to his résumé page is why Rasmus Lerdorf wrote the first PHP.", "📟 1995");
    }
  });
  const { texture } = useCanvas(640, 480, (ctx, cw, ch) => drawHomePage(ctx, cw, ch, phase, hits), `${phase}|${hits}`);
  const seats = useMemo(() => [seatAt("php-1995-chair", toHouse, rot, 0, z0 + 0.85, Math.PI)], [toHouse, rot, z0]);

  const wood = flat("#8a5a34", 0.55);
  const beige = flat("#d8cfb6", 0.6);
  const beigeDark = flat("#bfb498", 0.6);
  const top = 0.77;
  return (
    <group>
      <group position={[0, 0, z0]}>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.85, 0.39, 0.4]} position={[0, 0.39, 0]} />
        </RigidBody>
        {/* Desk: top, a drawer pedestal and two legs */}
        <mesh position={[0, 0.75, 0]} material={wood} castShadow receiveShadow>
          <boxGeometry args={[1.7, 0.04, 0.8]} />
        </mesh>
        <mesh position={[0.58, 0.37, 0]} material={wood} castShadow>
          <boxGeometry args={[0.48, 0.73, 0.74]} />
        </mesh>
        {[0.18, 0.42].map((y) => (
          <mesh key={y} position={[0.58, y, 0.375]} material={flat("#c9a45a", 0.3, 0.8)}>
            <boxGeometry args={[0.12, 0.02, 0.02]} />
          </mesh>
        ))}
        {[-0.3, 0.3].map((z) => (
          <mesh key={z} position={[-0.79, 0.37, z]} material={wood}>
            <boxGeometry args={[0.05, 0.73, 0.05]} />
          </mesh>
        ))}
        {/* CRT monitor */}
        <group position={[0, top, -0.08]}>
          <mesh position={[0, 0.03, 0]} material={beigeDark}>
            <cylinderGeometry args={[0.16, 0.18, 0.06, 20]} />
          </mesh>
          <mesh position={[0, 0.31, 0]} material={beige} castShadow>
            <boxGeometry args={[0.54, 0.46, 0.3]} />
          </mesh>
          <mesh position={[0, 0.3, -0.27]} material={beigeDark} castShadow>
            <boxGeometry args={[0.4, 0.34, 0.26]} />
          </mesh>
          <mesh position={[0, 0.32, 0.152]} material={flat("#1a1a1a", 0.3)}>
            <boxGeometry args={[0.46, 0.36, 0.01]} />
          </mesh>
          <mesh position={[0, 0.32, 0.159]}>
            <planeGeometry args={[0.42, 0.315]} />
            <meshBasicMaterial map={texture} toneMapped={false} />
          </mesh>
          <mesh position={[0.22, 0.11, 0.152]} material={flat("#22c55e", 0.4, 0, "#22c55e", 2)}>
            <boxGeometry args={[0.015, 0.015, 0.01]} />
          </mesh>
        </group>
        {/* Tower with a floppy drive and a CD-ROM */}
        <group position={[-0.6, top, -0.05]}>
          <mesh position={[0, 0.22, 0]} material={beige} castShadow>
            <boxGeometry args={[0.2, 0.44, 0.44]} />
          </mesh>
          <mesh position={[0, 0.36, 0.222]} material={beigeDark}>
            <boxGeometry args={[0.16, 0.04, 0.005]} />
          </mesh>
          <mesh position={[0, 0.28, 0.222]} material={flat("#111111", 0.4)}>
            <boxGeometry args={[0.1, 0.008, 0.006]} />
          </mesh>
          <mesh position={[0.05, 0.08, 0.222]} material={flat("#22c55e", 0.4, 0, "#22c55e", 2)}>
            <boxGeometry args={[0.012, 0.012, 0.006]} />
          </mesh>
        </group>
        {/* Keyboard and mouse */}
        <mesh position={[0, top + 0.015, 0.25]} rotation-x={0.06} material={beige} castShadow>
          <boxGeometry args={[0.46, 0.03, 0.17]} />
        </mesh>
        {[-0.05, 0, 0.05].map((z) => (
          <mesh key={z} position={[-0.02, top + 0.033, 0.25 + z]} material={beigeDark}>
            <boxGeometry args={[0.38, 0.008, 0.035]} />
          </mesh>
        ))}
        <mesh position={[0.36, top + 0.015, 0.25]} scale={[0.6, 0.35, 1]} material={beige}>
          <sphereGeometry args={[0.05, 12, 8]} />
        </mesh>
        {/* External modem with its status lights (HS AA CD OH RD SD) */}
        <group position={[0.55, top, -0.12]} rotation-y={-0.3}>
          <mesh position={[0, 0.03, 0]} material={flat("#2a2a2a", 0.5, 0.2)} castShadow>
            <boxGeometry args={[0.24, 0.05, 0.17]} />
          </mesh>
          {Array.from({ length: 6 }, (_, i) => (
            <mesh key={i} position={[-0.075 + i * 0.03, 0.035, 0.086]}>
              <boxGeometry args={[0.012, 0.008, 0.004]} />
              <meshStandardMaterial ref={(m) => void (leds.current[i] = m)} color="#300" emissive={i === 0 ? "#22c55e" : "#ef4444"} emissiveIntensity={0.1} toneMapped={false} />
            </mesh>
          ))}
        </group>
        {/* A stack of floppies */}
        {["#1e3a8a", "#111111", "#b91c1c"].map((c, i) => (
          <mesh key={c} position={[-0.3, top + 0.005 + i * 0.006, 0.22]} rotation-y={i * 0.15} material={flat(c, 0.5)}>
            <boxGeometry args={[0.09, 0.005, 0.094]} />
          </mesh>
        ))}
      </group>
      <ExecChair position={[0, 0, z0 + 0.85]} facing={Math.PI} leather="grey" />
      <Seats seats={seats} />
      {/* A framed poster over the desk */}
      <group position={[0, 2.05, -d / 2 + 0.1]}>
        <mesh material={flat(palette.ink, 0.5)}>
          <boxGeometry args={[1.7, 0.6, 0.03]} />
        </mesh>
        <Text position={[0, 0.1, 0.02]} fontSize={0.12} color="#ffcc00" anchorX="center" anchorY="middle">
          Personal Home Page Tools
        </Text>
        <Text position={[0, -0.12, 0.02]} fontSize={0.08} color={palette.paper} anchorX="center" anchorY="middle">
          Rasmus Lerdorf · announced June 8, 1995
        </Text>
      </group>
      {w > 6 && <Bookcase position={[-w / 2 + 0.25, 0, z0 + 1.8]} rotationY={Math.PI / 2} width={1.6} seed={1995} />}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Python · The Snake Bench (hero)
// ---------------------------------------------------------------------------

/** PEP 20, the Zen of Python, as printed by `import this`. */
const ZEN = [
  "Beautiful is better than ugly.",
  "Explicit is better than implicit.",
  "Simple is better than complex.",
  "Complex is better than complicated.",
  "Flat is better than nested.",
  "Sparse is better than dense.",
  "Readability counts.",
  "Special cases aren't special enough to break the rules.",
  "Although practicality beats purity.",
  "Errors should never pass silently.",
  "Unless explicitly silenced.",
  "In the face of ambiguity, refuse the temptation to guess.",
  "There should be one-- and preferably only one --obvious way to do it.",
  "Although that way may not be obvious at first unless you're Dutch.",
  "Now is better than never.",
  "Although never is often better than *right* now.",
  "If the implementation is hard to explain, it's a bad idea.",
  "If the implementation is easy to explain, it may be a good idea.",
  "Namespaces are one honking great idea -- let's do more of those!",
];

/** Which coils of the snake are seats. */
const PY_SEATS = [3, 5, 7, 9];

/**
 * A long bench shaped like a python, winding in an S: rounded blue segments with a yellow belly
 * and spots, a raised head with eyes and a forked tongue. Four of its coils are seats. On a little
 * side table lies a book, "import this": E reads the next line of the Zen of Python, and the snake
 * turns its head and flicks its tongue.
 */
function SnakeBench({ w, d, toHouse, rot }: SigProps) {
  const { palette } = useHouse();
  const [line, setLine] = useState(-1);
  const head = useRef<THREE.Group>(null);
  const tongue = useRef<THREE.Group>(null);
  const look = useRef(0);
  const flickUntil = useRef(0);
  const X = Math.min(3.3, w / 2 - 0.9);
  const A = Math.min(0.8, d / 5);
  const N = 12;
  const body = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => {
        const x = -X + (2 * X * i) / (N - 1);
        const slope = ((A * Math.PI) / X) * Math.cos((Math.PI * x) / X);
        const size = i < 3 ? 0.55 + 0.15 * i : 1;
        return { x, z: A * Math.sin((Math.PI * x) / X), yaw: -Math.atan(slope), slope, size };
      }),
    [X, A],
  );
  const seats = useMemo(
    () =>
      PY_SEATS.map((i) => {
        const b = body[i];
        const len = Math.hypot(1, b.slope);
        const [nx, nz] = [-b.slope / len, 1 / len];
        return seatAt(`py-snake-${i}`, toHouse, rot, b.x + nx * 0.05, b.z + nz * 0.05, Math.atan2(nx, nz));
      }),
    [body, toHouse, rot],
  );
  const tableAt: [number, number] = [-X / 2, -A + 1.05];

  const read = () => {
    const k = (line + 1) % ZEN.length;
    setLine(k);
    look.current = k % 2 ? -0.55 : 0.45;
    flickUntil.current = now() + 0.9;
    sfx.rustle();
    toast(`${ZEN[k]}  (${k + 1}/${ZEN.length})`, "🐍 import this · The Zen of Python, by Tim Peters");
  };
  const where = useWorldPoint(toHouse, 0, Math.min(d / 2 - 0.4, A + 1.9));
  useProximity({ id: "py-snake-bench", label: "import this", radius: 2.4, where, run: read });

  useFrame((_, delta) => {
    const t = now();
    if (head.current) {
      head.current.rotation.y = damp(head.current.rotation.y, look.current + Math.sin(t * 0.7) * 0.08, 4, delta);
      head.current.position.y = 0.78 + Math.sin(t * 1.4) * 0.02;
    }
    if (tongue.current) {
      const flicking = t < flickUntil.current || Math.sin(t * 0.9) > 0.985;
      tongue.current.scale.x = flicking ? (Math.sin(t * 34) > 0 ? 1 : 0.35) : 0.01;
    }
  });

  const blue = flat(palette.main, 0.55, 0.05);
  const yellow = flat(palette.second, 0.6);
  const end = body[N - 1];
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        {body.map((b) => (
          <CuboidCollider key={b.x} args={[0.24, 0.26 * b.size, 0.24]} position={[b.x, 0.26 * b.size, b.z]} />
        ))}
      </RigidBody>
      {body.map((b, i) => (
        <group key={b.x} position={[b.x, 0, b.z]} rotation-y={b.yaw}>
          <mesh position={[0, 0.26 * b.size, 0]} scale={[0.42 * b.size, 0.26 * b.size, 0.32 * b.size]} material={blue} castShadow receiveShadow>
            <sphereGeometry args={[1, 24, 16]} />
          </mesh>
          <mesh position={[0, 0.11 * b.size, 0]} scale={[0.43 * b.size, 0.11 * b.size, 0.345 * b.size]} material={yellow}>
            <sphereGeometry args={[1, 20, 12]} />
          </mesh>
          {i % 2 === 0 && i > 0 && (
            <mesh position={[0, 0.5 * b.size, 0]} scale={[0.14, 0.03, 0.1]} material={yellow}>
              <sphereGeometry args={[1, 14, 8]} />
            </mesh>
          )}
        </group>
      ))}
      {/* Neck and head, raised at the far end */}
      <group position={[end.x + 0.28, 0, end.z]} rotation-y={end.yaw}>
        <mesh position={[0, 0.48, 0]} rotation-z={-0.5} scale={[0.22, 0.34, 0.24]} material={blue} castShadow>
          <sphereGeometry args={[1, 20, 14]} />
        </mesh>
        <group ref={head} position={[0.16, 0.78, 0]}>
          <mesh scale={[0.36, 0.19, 0.24]} material={blue} castShadow>
            <sphereGeometry args={[1, 24, 16]} />
          </mesh>
          <mesh position={[0.04, -0.08, 0]} scale={[0.3, 0.09, 0.2]} material={yellow}>
            <sphereGeometry args={[1, 18, 10]} />
          </mesh>
          {[1, -1].map((s) => (
            <group key={s} position={[0.12, 0.09, s * 0.15]}>
              <mesh material={flat("#ffffff", 0.3)}>
                <sphereGeometry args={[0.055, 12, 10]} />
              </mesh>
              <mesh position={[0.03, 0.005, s * 0.02]} material={flat("#101418", 0.15)}>
                <sphereGeometry args={[0.032, 10, 8]} />
              </mesh>
            </group>
          ))}
          <group ref={tongue} position={[0.34, -0.04, 0]}>
            <mesh position={[0.07, 0, 0]} material={flat("#d92b3a", 0.5)}>
              <boxGeometry args={[0.14, 0.012, 0.02]} />
            </mesh>
            {[1, -1].map((s) => (
              <mesh key={s} position={[0.16, 0, s * 0.02]} rotation-y={s * 0.5} material={flat("#d92b3a", 0.5)}>
                <boxGeometry args={[0.07, 0.01, 0.014]} />
              </mesh>
            ))}
          </group>
        </group>
      </group>
      <Seats seats={seats} />
      {/* Side table with the book */}
      <Table position={[tableAt[0], 0, tableAt[1]]} width={0.6} height={0.55} top="walnut" />
      <group position={[tableAt[0], 0.55, tableAt[1]]} rotation-y={0.3} onClick={(e) => clicked(e) && read()} {...pointer}>
        <mesh position={[0, 0.025, 0]} material={flat(palette.main, 0.6)} castShadow>
          <boxGeometry args={[0.3, 0.05, 0.22]} />
        </mesh>
        <mesh position={[0.005, 0.025, 0]} material={flat(palette.paper, 0.8)}>
          <boxGeometry args={[0.29, 0.04, 0.215]} />
        </mesh>
        <mesh position={[0, 0.051, 0]} material={flat(palette.main, 0.6)}>
          <boxGeometry args={[0.3, 0.004, 0.22]} />
        </mesh>
        <Text position={[0, 0.055, 0]} rotation-x={-Math.PI / 2} fontSize={0.036} color={palette.second} anchorX="center" anchorY="middle">
          {line < 0 ? ">>> import this" : `${line + 1}/${ZEN.length}`}
        </Text>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Python · Notebook Lab (room)
// ---------------------------------------------------------------------------

type NbCell = { code: string[]; out: "none" | "table" | "chart" | { print: string }; note: string };
const NB_LANGS: [string, number][] = [
  ["Python", 1991],
  ["JavaScript", 1995],
  ["PHP", 1995],
  ["Java", 1995],
  ["TypeScript", 2012],
];
const NB_YEAR = 2026;
const NB_CELLS: NbCell[] = [
  { code: ["import pandas as pd"], out: "none", note: "pandas is imported as pd by convention. Every cell shares one Python kernel, so pd now exists in all of them." },
  { code: ['df = pd.read_csv("languages.csv")', "df.head()"], out: "table", note: "df.head() shows the first 5 rows of a DataFrame. The last expression of a cell is displayed as Out[n]." },
  {
    code: [`df["age"] = ${NB_YEAR} - df["first_release"]`, 'df.plot.bar(x="lang", y="age")'],
    out: "chart",
    note: "Column maths is vectorised: one line computes every row. pandas draws its plots with matplotlib.",
  },
  {
    code: ['oldest = df.loc[df["age"].idxmax(), "lang"]', `print(f"Oldest: {oldest}, {df['age'].max()} years old")`],
    out: { print: `Oldest: Python, ${NB_YEAR - 1991} years old` },
    note: "f-strings (Python 3.6+) evaluate expressions right inside {braces}. print() writes to stdout, so there's no Out[n].",
  },
];
const NB_CODE_LINE = 30;

/** Height in canvas pixels of a cell, with its output once it ran. */
function nbCellHeight(cell: NbCell, ran: boolean) {
  const code = 26 + cell.code.length * NB_CODE_LINE;
  if (!ran || cell.out === "none") return code + 16;
  if (cell.out === "table") return code + 16 + 6 * 30 + 8;
  if (cell.out === "chart") return code + 16 + 36 + 220;
  return code + 16 + 34;
}

/** The notebook: a JupyterLab-like page, the cells run so far and the next one waiting. */
function drawNotebook(ctx: CanvasRenderingContext2D, w: number, h: number, ran: number, busy: boolean) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  box(ctx, 0, 0, w, 56, 0, "#f3f3f3");
  ctx.fillStyle = "#e0e0e0";
  ctx.fillRect(0, 56, w, 2);
  ctx.fillStyle = "#f37726";
  ctx.font = font(30, "800");
  ctx.fillText("jupyter", 24, 38);
  ctx.fillStyle = "#333333";
  ctx.font = font(24);
  ctx.fillText("languages.ipynb", 170, 37);
  ctx.textAlign = "right";
  ctx.fillText("Python 3 (ipykernel)", w - 64, 37);
  ctx.textAlign = "left";
  ctx.strokeStyle = "#616161";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(w - 36, 29, 10, 0, Math.PI * 2);
  if (busy) {
    ctx.fillStyle = "#616161";
    ctx.fill();
  }
  ctx.stroke();
  // Which cells show: the ones that ran, then the next one; scroll so the newest fits
  const shown = NB_CELLS.map((c, i) => ({ c, i, ran: i < ran })).filter((x) => x.i <= ran);
  let first = 0;
  const avail = h - 80;
  while (first < shown.length - 1 && shown.slice(first).reduce((s, x) => s + nbCellHeight(x.c, x.ran) + 12, 0) > avail) first++;
  let y = 72;
  shown.slice(first).forEach(({ c, i, ran: done }) => {
    const ch = 26 + c.code.length * NB_CODE_LINE;
    const active = busy ? i === ran - 1 : i === ran;
    if (active) box(ctx, 8, y, 6, nbCellHeight(c, done), 0, "#1976d2");
    ctx.fillStyle = "#307fc1";
    ctx.font = mono(22);
    ctx.textAlign = "right";
    ctx.fillText(done ? (busy && i === ran - 1 ? "[*]:" : `[${i + 1}]:`) : "[ ]:", 130, y + 32);
    ctx.textAlign = "left";
    box(ctx, 140, y + 6, w - 170, ch, 4, "#f5f5f5", "#e0e0e0");
    c.code.forEach((l, k) => {
      ctx.fillStyle = "#1a1a1a";
      ctx.font = mono(22);
      ctx.fillText(l, 154, y + 34 + k * NB_CODE_LINE);
    });
    let oy = y + ch + 16;
    if (done && !(busy && i === ran - 1)) {
      const outLabel = (label: string) => {
        ctx.fillStyle = "#d84315";
        ctx.font = mono(22);
        ctx.textAlign = "right";
        ctx.fillText(label, 130, oy + 22);
        ctx.textAlign = "left";
      };
      if (c.out === "table") {
        outLabel(`Out[${i + 1}]:`);
        const cols = [154, 214, 404];
        ctx.font = font(20, "700");
        ctx.fillStyle = "#000000";
        ["lang", "first_release"].forEach((t, k) => ctx.fillText(t, cols[k + 1], oy + 22));
        ctx.fillRect(154, oy + 30, 400, 2);
        NB_LANGS.forEach(([lang, year], r) => {
          const ry = oy + 32 + r * 30;
          if (r % 2 === 0) box(ctx, 154, ry, 400, 30, 0, "#f5f5f5");
          ctx.fillStyle = "#000000";
          ctx.font = font(20, "700");
          ctx.fillText(String(r), cols[0], ry + 22);
          ctx.font = font(20);
          ctx.fillText(lang, cols[1], ry + 22);
          ctx.fillText(String(year), cols[2], ry + 22);
        });
      } else if (c.out === "chart") {
        outLabel(`Out[${i + 1}]:`);
        ctx.fillStyle = "#000000";
        ctx.font = mono(20);
        ctx.fillText("<Axes: xlabel='lang'>", 154, oy + 22);
        const gx = 210;
        const gy = oy + 50;
        const gw = 520;
        const gh = 160;
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;
        ctx.strokeRect(gx, gy, gw, gh);
        ctx.font = font(16);
        ctx.textAlign = "right";
        [0, 10, 20, 30].forEach((v) => {
          const ty = gy + gh - (v / 40) * gh;
          ctx.fillText(String(v), gx - 8, ty + 5);
          ctx.fillRect(gx - 5, ty, 5, 1.5);
        });
        ctx.textAlign = "center";
        const bw = gw / NB_LANGS.length;
        NB_LANGS.forEach(([lang, year], k) => {
          const age = NB_YEAR - year;
          const bh = (age / 40) * gh;
          ctx.fillStyle = "#1f77b4";
          ctx.fillRect(gx + k * bw + bw * 0.25, gy + gh - bh, bw * 0.5, bh);
          ctx.fillStyle = "#000000";
          ctx.fillText(lang, gx + k * bw + bw / 2, gy + gh + 20);
        });
        ctx.fillText("lang", gx + gw / 2, gy + gh + 42);
        ctx.textAlign = "left";
        box(ctx, gx + gw - 86, gy + 10, 74, 32, 4, "#ffffff", "#cccccc");
        ctx.fillStyle = "#1f77b4";
        ctx.fillRect(gx + gw - 78, gy + 20, 22, 12);
        ctx.fillStyle = "#000000";
        ctx.fillText("age", gx + gw - 50, gy + 32);
      } else if (typeof c.out === "object") {
        ctx.fillStyle = "#000000";
        ctx.font = mono(22);
        ctx.fillText(c.out.print, 154, oy + 24);
      }
    }
    oy = y + nbCellHeight(c, done && !(busy && i === ran - 1));
    y = oy + 12;
  });
  if (ran >= NB_CELLS.length && !busy) {
    ctx.fillStyle = "#757575";
    ctx.font = font(20, "italic");
    ctx.fillText("All cells ran. Press E to restart the kernel.", 140, Math.min(h - 18, y + 24));
  }
}

/**
 * A Jupyter-style lab: a desk and chair facing a big wall screen with a notebook. E runs the next
 * cell (In [*] while the kernel is busy, then its output): pandas, a DataFrame table, a bar chart,
 * an f-string. After the last cell, E restarts the kernel and the counter starts again at [1].
 */
function NotebookLab({ w, d, toHouse, rot }: SigProps) {
  const { accent } = useHouse();
  const [ran, setRan] = useState(0);
  const [busy, setBusy] = useState(false);
  const doneAt = useRef(0);
  const run = () => {
    if (busy) return;
    if (ran >= NB_CELLS.length) {
      setRan(0);
      sfx.clunk();
      toast("Kernel restarted: variables are gone and the counter starts again at [1]. Running top to bottom keeps a notebook reproducible.", "📓 Notebook");
      return;
    }
    setRan(ran + 1);
    setBusy(true);
    doneAt.current = now() + 0.7;
    sfx.click();
  };
  useFrame(() => {
    if (!busy || now() < doneAt.current) return;
    doneAt.current = Infinity;
    setBusy(false);
    sfx.pop();
    burstAt(toHouse, 0, 2, -d / 2 + 0.3, [accent, "#f37726", "#ffffff"], 10);
    toast(NB_CELLS[ran - 1].note, `📓 In [${ran}]`);
  });
  const sw = Math.min(w - 1.6, 4.4);
  const sh = (sw * 720) / 1280;
  const { texture } = useCanvas(1280, 720, (ctx, cw, ch) => drawNotebook(ctx, cw, ch, ran, busy), `${ran}|${busy}`);
  const deskZ = -d / 2 + 1.6;
  const where = useWorldPoint(toHouse, 0, deskZ + 1.2);
  useProximity({ id: "py-notebook", label: busy ? "Running…" : ran >= NB_CELLS.length ? "Restart the kernel" : "Run the next cell", radius: 2, where, run });
  const seats = useMemo(() => [seatAt("py-notebook-chair", toHouse, rot, 0, deskZ + 0.62, Math.PI)], [toHouse, rot, deskZ]);
  return (
    <group>
      <Panel position={[0, 0.75 + sh / 2, -d / 2 + 0.12]} width={sw} height={sh} map={texture} frame="#1e2a38" onClick={(e) => clicked(e) && run()} />
      <Table position={[0, 0, deskZ]} width={1.4} depth={0.7} height={0.75} top="walnut" />
      {/* Laptop and a mug */}
      <group position={[0, 0.75, deskZ + 0.05]}>
        <mesh position={[0, 0.01, 0.05]} material={flat("#c0c4ca", 0.3, 0.8)} castShadow>
          <boxGeometry args={[0.34, 0.016, 0.23]} />
        </mesh>
        <mesh position={[0, 0.12, -0.07]} rotation-x={-0.25} material={flat("#c0c4ca", 0.3, 0.8)}>
          <boxGeometry args={[0.34, 0.22, 0.01]} />
        </mesh>
        <mesh position={[0, 0.12, -0.064]} rotation-x={-0.25} material={flat("#1e2a38", 0.3, 0, "#f37726", 0.25)}>
          <boxGeometry args={[0.31, 0.19, 0.002]} />
        </mesh>
        <mesh position={[0.45, 0.05, 0.05]} material={flat("#ffd43b", 0.4)} castShadow>
          <cylinderGeometry args={[0.04, 0.038, 0.1, 16]} />
        </mesh>
      </group>
      <ExecChair position={[0, 0, deskZ + 0.62]} facing={Math.PI} leather="navy" />
      <Seats seats={seats} />
      {w > 6 && <TallPlant position={[w / 2 - 0.5, 0, -d / 2 + 0.5]} seed={7} />}
      {w > 6 && <Bookcase position={[-w / 2 + 0.25, 0, deskZ + 0.6]} rotationY={Math.PI / 2} width={1.6} seed={3} />}
    </group>
  );
}

// ---------------------------------------------------------------------------
// HTML · The Skeleton (hero)
// ---------------------------------------------------------------------------

/** The DOM as scaffolding: each element an open steel frame (size w × h × d, standing at y). */
type TagFrame = { tag: string; size: [number, number, number]; y: number; beam: number; text: number };
const HTML_FRAMES: TagFrame[] = [
  { tag: "html", size: [6.4, 3.6, 4.2], y: 0, beam: 0.12, text: 0.3 },
  { tag: "body", size: [5.6, 3.1, 3.5], y: 0, beam: 0.1, text: 0.24 },
  { tag: "header", size: [4.8, 0.7, 2.8], y: 2.2, beam: 0.07, text: 0.17 },
  { tag: "main", size: [4.8, 1.2, 2.8], y: 0.8, beam: 0.07, text: 0.17 },
  { tag: "footer", size: [4.8, 0.5, 2.8], y: 0.15, beam: 0.07, text: 0.17 },
];
/** Closing order, as in the document: </header> </main> </footer> </body> </html>. */
const HTML_CLOSE_ORDER = [2, 3, 4, 1, 0];

/** The twelve edges of an open box frame. */
function OpenFrame({ fw, fh, fd, y, beam, material }: { fw: number; fh: number; fd: number; y: number; beam: number; material: THREE.Material }) {
  const edges: { p: [number, number, number]; s: [number, number, number] }[] = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) edges.push({ p: [(sx * fw) / 2, y + fh / 2, (sz * fd) / 2], s: [beam, fh, beam] });
  for (const sy of [y + beam / 2, y + fh - beam / 2]) {
    for (const sz of [-1, 1]) edges.push({ p: [0, sy, (sz * fd) / 2], s: [fw, beam, beam] });
    for (const sx of [-1, 1]) edges.push({ p: [(sx * fw) / 2, sy, 0], s: [beam, beam, fd] });
  }
  return (
    <>
      {edges.map((e, i) => (
        <mesh key={i} position={e.p} material={material} castShadow>
          <boxGeometry args={e.s} />
        </mesh>
      ))}
    </>
  );
}

/**
 * A page's DOM tree built as orange construction scaffolding: <html> holds <body>, which holds
 * <header>, <main> and <footer> stacked like a page, each frame tagged with its name. E closes the
 * tags: frames light up from the innermost outward and show their closing tags, ending at </html>.
 */
function HtmlSkeleton({ w, d, toHouse }: SigProps) {
  const { palette, accent } = useHouse();
  const [closed, setClosed] = useState(0);
  const shown = useRef(0);
  const start = useRef(-1);
  const S = Math.min(1, (w - 1) / 6.6, (d - 2.6) / 4.2);
  const close = () => {
    if (start.current >= 0) return;
    start.current = now();
    shown.current = 0;
    setClosed(0);
    sfx.click();
  };
  const D = 4.2 * S;
  const where = useWorldPoint(toHouse, 0, Math.min(d / 2 - 0.3, D / 2 + 1.1));
  useProximity({ id: "html-skeleton", label: "Close the tags", radius: 2.4, where, run: close });
  useFrame(() => {
    if (start.current < 0) return;
    const k = Math.min(HTML_CLOSE_ORDER.length, Math.floor((now() - start.current) / 0.7));
    if (k !== shown.current) {
      shown.current = k;
      setClosed(k);
      sfx.clunk();
      if (k === HTML_CLOSE_ORDER.length) {
        start.current = -1;
        sfx.sparkle();
        burstAt(toHouse, 0, 3.8, D / 2, [palette.main, palette.second, "#ffffff"], 22);
        toast(
          "Closed innermost first: </header> </main> </footer> </body> </html>. Semantic tags tell browsers, search engines and screen readers what each part of the page is, not just how it looks.",
          "🏗️ Under Construction",
        );
      }
    }
  });

  const steel = flat(palette.main, 0.45, 0.6);
  const lit = flat("#ffb066", 0.35, 0.5, palette.second, 1.5);
  const grey = flat("#6b6f76", 0.4, 0.8);
  const inner = HTML_FRAMES[2].size;
  const [ix, iz] = [(inner[0] * S) / 2, (inner[2] * S) / 2];
  const [W, H] = [HTML_FRAMES[0].size[0] * S, HTML_FRAMES[0].size[1]];
  const brace = Math.atan2(H, D);
  return (
    <group onClick={(e) => clicked(e) && close()} {...pointer}>
      <RigidBody type="fixed" colliders={false}>
        {HTML_FRAMES.slice(0, 3).flatMap((f, n) => {
          const [hx, hz] = [(f.size[0] * S) / 2, (f.size[2] * S) / 2];
          const h = n === 2 ? 1.45 : f.size[1] / 2;
          return [-1, 1].flatMap((sx) => [-1, 1].map((sz) => <CuboidCollider key={`${n}${sx}${sz}`} args={[0.08, h, 0.08]} position={[sx * hx, h, sz * hz]} />));
        })}
      </RigidBody>
      {HTML_FRAMES.map((f, fi) => {
        const isClosed = HTML_CLOSE_ORDER.indexOf(fi) < closed;
        const [fw, fh, fd] = [f.size[0] * S, f.size[1], f.size[2] * S];
        const outer = fi < 2;
        const ty = outer ? f.y + fh + 0.18 : f.y + fh - 0.2;
        const tz = fd / 2 + f.beam / 2 + 0.01;
        return (
          <group key={f.tag}>
            <OpenFrame fw={fw} fh={fh} fd={fd} y={f.y} beam={f.beam} material={isClosed ? lit : steel} />
            <Text position={[-fw / 2 + 0.1, ty, tz]} fontSize={f.text} color={isClosed ? "#ffffff" : palette.paper} outlineWidth={0.01} outlineColor={palette.ink} anchorX="left" anchorY="middle">
              {`<${f.tag}>`}
            </Text>
            {isClosed && (
              <Text position={[fw / 2 - 0.1, ty, tz]} fontSize={f.text} color={accent} outlineWidth={0.01} outlineColor={palette.ink} anchorX="right" anchorY="middle">
                {`</${f.tag}>`}
              </Text>
            )}
          </group>
        );
      })}
      {/* X-braces on the sides of <html>, base plates, couplers joining the inner column, deck planks */}
      {[-1, 1].flatMap((sx) =>
        [brace, -brace].map((r) => (
          <mesh key={`${sx}${r}`} position={[(sx * W) / 2, H / 2, 0]} rotation-x={r} material={grey} castShadow>
            <boxGeometry args={[0.05, 0.05, Math.hypot(H, D) - 0.2]} />
          </mesh>
        )),
      )}
      {HTML_FRAMES.slice(0, 2).flatMap((f) =>
        [-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) => (
            <mesh key={`${f.tag}${sx}${sz}`} position={[(sx * f.size[0] * S) / 2, 0.01, (sz * f.size[2] * S) / 2]} material={grey}>
              <boxGeometry args={[0.24, 0.02, 0.24]} />
            </mesh>
          )),
        ),
      )}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].flatMap((sz) =>
          [
            [0, 0.15],
            [0.65, 0.8],
            [2, 2.2],
          ].map(([a, b]) => (
            <mesh key={`${sx}${sz}${a}`} position={[sx * ix, (a + b) / 2, sz * iz]} material={grey}>
              <boxGeometry args={[0.09, b - a + 0.08, 0.09]} />
            </mesh>
          )),
        ),
      )}
      {[-0.32, 0, 0.32].map((z) => (
        <mesh key={z} position={[0, 0.86, z * iz * 2]} material={flat("#b9874f", 0.8)} castShadow receiveShadow>
          <boxGeometry args={[ix * 2 - 0.1, 0.04, 0.26]} />
        </mesh>
      ))}
      {/* Traffic cones at the front corners */}
      {[-1, 1].map((sx) => (
        <group key={sx} position={[sx * (W / 2 + 0.45), 0, D / 2 + 0.3]}>
          <mesh position={[0, 0.015, 0]} material={flat("#1b1b1b", 0.8)}>
            <boxGeometry args={[0.36, 0.03, 0.36]} />
          </mesh>
          <mesh position={[0, 0.28, 0]} material={flat("#f1662a", 0.6)} castShadow>
            <coneGeometry args={[0.15, 0.5, 20]} />
          </mesh>
          <mesh position={[0, 0.3, 0]} material={flat("#ffffff", 0.5)}>
            <cylinderGeometry args={[0.067, 0.083, 0.07, 20]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// HTML · <nav> (room)
// ---------------------------------------------------------------------------

type NavLink = { label: string; href: string; x: number; z: number };
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const NAV_TOP = 150;

/** The <nav> menu board: one link per room of the house, the current one marked. */
function drawNav(ctx: CanvasRenderingContext2D, w: number, h: number, links: NavLink[], here: number, sel: number, colors: { ink: string; paper: string; main: string }) {
  ctx.fillStyle = colors.ink;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = colors.main;
  ctx.fillRect(0, 0, w, 10);
  ctx.font = mono(34, "700");
  ctx.fillText("<nav>", 36, 66);
  ctx.fillStyle = colors.paper;
  ctx.font = font(52, "800");
  ctx.fillText("Where to?", 36, 126);
  const rowH = Math.min(90, (h - NAV_TOP - 60) / links.length);
  links.forEach((l, i) => {
    const y = NAV_TOP + i * rowH;
    if (i === sel) box(ctx, 20, y + 4, w - 40, rowH - 8, 10, colors.main);
    ctx.fillStyle = i === sel ? "#ffffff" : i === here ? "rgba(255,255,255,0.45)" : colors.paper;
    ctx.font = font(Math.min(40, rowH * 0.5), "700");
    ctx.fillText(l.label, 44, y + rowH * 0.62);
    ctx.font = mono(Math.min(24, rowH * 0.3));
    ctx.textAlign = "right";
    ctx.fillStyle = i === sel ? "#ffffff" : colors.main;
    ctx.fillText(i === here ? 'aria-current="page"' : `href="${l.href}"`, w - 44, y + rowH * 0.6);
    ctx.textAlign = "left";
  });
  ctx.fillStyle = colors.main;
  ctx.font = mono(34, "700");
  ctx.fillText("</nav>", 36, h - 24);
}

/**
 * A wayfinding room: signposts with arrow boards pointing at every room of this house, and a big
 * <nav> menu on the back wall. Click a link (or press E to follow the next one) and a waypoint
 * trail leads you to that room: real navigation.
 */
function NavRoom({ w, d, toHouse, rot, label }: SigProps) {
  const { plan, def, palette } = useHouse();
  const links = useMemo<NavLink[]>(
    () => [
      { label: "Entrance", href: "#entrance", x: 0, z: plan.D / 2 - 2 },
      ...plan.rooms.map((r) => {
        const name = def.rooms[r.slot].label;
        return { label: name, href: `#${slug(name)}`, x: r.x, z: r.z };
      }),
    ],
    [plan, def],
  );
  const here = links.findIndex((l) => l.label === label);
  const [sel, setSel] = useState(-1);
  let next = (sel + 1) % links.length;
  if (next === here) next = (next + 1) % links.length;
  const go = (i: number) => {
    const l = links[i];
    if (i === here) {
      sfx.pop();
      toast(`You're already here: this link carries aria-current="page".`, "🧭 <nav>");
      return;
    }
    setSel(i);
    useCityStore.getState().setWaypoint({ x: l.x, z: l.z, label: l.label });
    sfx.chirp();
    toast(`<a href="${l.href}"> → ${l.label}. Follow the glowing trail.`, "🧭 <nav>");
  };
  const where = useWorldPoint(toHouse, 0, -d / 2 + 1.8);
  useProximity({ id: "html-nav", label: `Follow the link to ${links[next].label}`, radius: 2.2, where, run: () => go(next) });

  const bw = Math.min(w - 1.6, 3.4);
  const bh = Math.min(2.8, 1.1 + links.length * 0.26);
  const pxW = Math.round(bw * 220);
  const pxH = Math.round(bh * 220);
  const colors = { ink: palette.ink, paper: palette.paper, main: palette.main };
  const { texture } = useCanvas(pxW, pxH, (ctx, cw, ch) => drawNav(ctx, cw, ch, links, here, sel, colors), `${sel}|${here}|${links.map((l) => l.label).join("|")}`);
  const pick = (e: ThreeEvent<MouseEvent>) => {
    if (!clicked(e) || !e.uv) return;
    const rowH = Math.min(90, (pxH - NAV_TOP - 60) / links.length);
    const i = Math.floor(((1 - e.uv.y) * pxH - NAV_TOP) / rowH);
    if (i >= 0 && i < links.length) go(i);
  };

  // Two signposts; each arrow turned toward its room (directions taken back into this room's frame)
  const posts = useMemo(() => {
    const others = links.map((l, i) => ({ ...l, i })).filter((l) => l.i !== here);
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    return [-1, 1].map((side, p) => {
      const px = side * (w / 2 - 1);
      const pz = -d / 2 + 1.7;
      const [wx, wz] = toHouse(px, pz);
      const arrows = others
        .filter((_, k) => k % 2 === p)
        .slice(0, 4)
        .map((l) => {
          const [dx, dz] = [l.x - wx, l.z - wz];
          return { label: l.label, yaw: Math.atan2(-(s * dx + c * dz), c * dx - s * dz) };
        });
      return { x: px, z: pz, arrows };
    });
  }, [links, here, rot, w, d, toHouse]);

  const wood = flat("#d9b38c", 0.7);
  return (
    <group>
      <Panel position={[0, 0.6 + bh / 2, -d / 2 + 0.12]} width={bw} height={bh} map={texture} frame={palette.main} onClick={pick} />
      {posts.map((p) => (
        <group key={p.x} position={[p.x, 0, p.z]}>
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider args={[0.12, 1.2, 0.12]} position={[0, 1.2, 0]} />
          </RigidBody>
          <mesh position={[0, 0.03, 0]} material={flat(palette.ink, 0.5, 0.3)}>
            <cylinderGeometry args={[0.22, 0.25, 0.06, 20]} />
          </mesh>
          <mesh position={[0, 1.3, 0]} material={flat("#3a3a3a", 0.4, 0.7)} castShadow>
            <cylinderGeometry args={[0.04, 0.045, 2.6, 12]} />
          </mesh>
          <mesh position={[0, 2.63, 0]} material={flat(palette.main, 0.4)}>
            <sphereGeometry args={[0.07, 12, 10]} />
          </mesh>
          {p.arrows.map((a, k) => (
            <group key={a.label} position={[0, 2.25 - k * 0.27, 0]} rotation-y={a.yaw}>
              <mesh position={[0.5, 0, 0]} material={k % 2 ? wood : flat(palette.main, 0.5)} castShadow>
                <boxGeometry args={[0.86, 0.19, 0.035]} />
              </mesh>
              <mesh position={[1.0, 0, 0]} rotation-z={-Math.PI / 2} scale={[1, 1, 0.18]} material={k % 2 ? wood : flat(palette.main, 0.5)}>
                <coneGeometry args={[0.13, 0.16, 3]} />
              </mesh>
              {[1, -1].map((side) => (
                <group key={side} rotation-y={side < 0 ? Math.PI : 0} position={[0.5, 0, 0]}>
                  <Text position={[0, 0, 0.02]} fontSize={0.085} maxWidth={0.8} color={k % 2 ? palette.ink : "#ffffff"} anchorX="center" anchorY="middle">
                    {a.label}
                  </Text>
                </group>
              ))}
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// CSS · Flexbox Court (room, open zone)
// ---------------------------------------------------------------------------

const JUSTIFY = ["flex-start", "center", "flex-end", "space-between", "space-around", "space-evenly"] as const;
const JUSTIFY_NOTES: Record<(typeof JUSTIFY)[number], string> = {
  "flex-start": "Items pack toward the start of the main axis (the default).",
  center: "Items pack in the middle: the free space splits equally between both ends.",
  "flex-end": "Items pack toward the end of the main axis.",
  "space-between": "First and last items touch the edges, with equal gaps between the items.",
  "space-around": "Equal space around every item, so the edge gaps are half the inner gaps.",
  "space-evenly": "Every gap, the two edges included, is exactly the same size.",
};
const ALIGN = ["stretch", "flex-start", "center", "flex-end"] as const;
const FLEX_ITEMS = [
  { w: 0.6, d: 0.45, color: "#264de4" },
  { w: 0.95, d: 0.7, color: "#e91e8c" },
  { w: 0.7, d: 0.5, color: "#f5b700" },
  { w: 1.1, d: 0.85, color: "#14b8a6" },
  { w: 0.8, d: 0.6, color: "#7c3aed" },
];

/** Where each item's center lands on the main axis, for a container of inner width `c`. */
function justifyCenters(mode: (typeof JUSTIFY)[number], c: number, widths: number[]) {
  const n = widths.length;
  const free = Math.max(0, c - widths.reduce((s, x) => s + x, 0));
  const [start, gap] =
    mode === "center" ? [free / 2, 0] : mode === "flex-end" ? [free, 0] : mode === "space-between" ? [0, free / (n - 1)] : mode === "space-around" ? [free / n / 2, free / n] : mode === "space-evenly" ? [free / (n + 1), free / (n + 1)] : [0, 0];
  let x = -c / 2 + start;
  return widths.map((wi) => {
    const center = x + wi / 2;
    x += wi + gap;
    return center;
  });
}

/**
 * A framed court on the floor (the flex container) with five colored blocks (the items). E or a
 * click on the court changes justify-content and the blocks glide to where the browser would put
 * them; a click on the sign changes align-items. The sign shows the CSS.
 */
function FlexboxCourt({ w, d, toHouse }: SigProps) {
  const { palette, accent } = useHouse();
  const [jc, setJc] = useState(0);
  const [ai, setAi] = useState(0);
  const blocks = useRef<(THREE.Group | null)[]>([]);
  const C = Math.min(w - 3.5, 10.5);
  const CD = Math.min(1.5, d / 2 - 0.45);
  const cz = -d / 2 + 0.35 + CD / 2;
  const pad = 0.1;
  const inner = C - pad * 2;
  const innerD = CD - pad * 2;

  const cycleJustify = () => {
    const k = (jc + 1) % JUSTIFY.length;
    setJc(k);
    sfx.pop();
    toast(`justify-content: ${JUSTIFY[k]}. ${JUSTIFY_NOTES[JUSTIFY[k]]}`, "📦 Flexbox Court");
  };
  const cycleAlign = () => {
    const k = (ai + 1) % ALIGN.length;
    setAi(k);
    sfx.click();
    toast(
      `align-items: ${ALIGN[k]}. It works on the cross axis${ALIGN[k] === "stretch" ? ": items without a fixed size grow to fill it (the default)." : ", here the court's depth."}`,
      "📦 Flexbox Court",
    );
  };
  const where = useWorldPoint(toHouse, 0, cz + CD / 2 + 0.9);
  useProximity({ id: "css-flexbox", label: `justify-content: ${JUSTIFY[(jc + 1) % JUSTIFY.length]}`, radius: 2.6, where, run: cycleJustify });

  useFrame((_, delta) => {
    const xs = justifyCenters(JUSTIFY[jc], inner, FLEX_ITEMS.map((it) => it.w));
    const mode = ALIGN[ai];
    FLEX_ITEMS.forEach((it, i) => {
      const g = blocks.current[i];
      if (!g) return;
      const depth = mode === "stretch" ? innerD : it.d;
      const z = mode === "flex-start" ? -innerD / 2 + it.d / 2 : mode === "flex-end" ? innerD / 2 - it.d / 2 : 0;
      g.position.x = damp(g.position.x, xs[i], 5, delta);
      g.position.z = damp(g.position.z, z, 5, delta);
      g.scale.z = damp(g.scale.z, depth / it.d, 5, delta);
    });
  });

  const frame = flat(palette.ink, 0.4, 0.4);
  const start = useMemo(() => justifyCenters("flex-start", inner, FLEX_ITEMS.map((it) => it.w)), [inner]);
  return (
    <group>
      {/* The container: a floor plate with a raised border */}
      <group position={[0, 0, cz]} onClick={(e) => clicked(e) && cycleJustify()} {...pointer}>
        <mesh position={[0, 0.012, 0]} material={flat(palette.paper, 0.7)} receiveShadow>
          <boxGeometry args={[C, 0.024, CD]} />
        </mesh>
        {[
          [0, -CD / 2, C + 0.08, 0.08],
          [0, CD / 2, C + 0.08, 0.08],
          [-C / 2, 0, 0.08, CD],
          [C / 2, 0, 0.08, CD],
        ].map(([x, z, bw, bd], i) => (
          <mesh key={i} position={[x, 0.05, z]} material={frame} castShadow>
            <boxGeometry args={[bw, 0.1, bd]} />
          </mesh>
        ))}
        {/* The main axis, drawn along the front edge */}
        <mesh position={[0, 0.026, CD / 2 - 0.05]} material={flat(accent, 0.4, 0, accent, 0.6)}>
          <boxGeometry args={[C - 0.4, 0.004, 0.02]} />
        </mesh>
        <mesh position={[C / 2 - 0.2, 0.03, CD / 2 - 0.05]} rotation-z={-Math.PI / 2} scale={[1, 1, 0.1]} material={flat(accent, 0.4, 0, accent, 0.6)}>
          <coneGeometry args={[0.05, 0.12, 3]} />
        </mesh>
        {FLEX_ITEMS.map((it, i) => (
          <group key={i} ref={(g) => void (blocks.current[i] = g)} position={[start[i], 0, 0]} scale={[1, 1, innerD / it.d]}>
            <mesh position={[0, 0.3, 0]} material={flat(it.color, 0.35, 0.1)} castShadow>
              <boxGeometry args={[it.w - 0.04, 0.55, it.d]} />
            </mesh>
            <Text position={[0, 0.32, it.d / 2 + 0.005]} fontSize={0.2} color="#ffffff" anchorX="center" anchorY="middle">
              {String(i + 1)}
            </Text>
          </group>
        ))}
      </group>
      {/* The sign: the rule in force (click it to change align-items) */}
      <group position={[0, 0, -d / 2 + 0.15]} onClick={(e) => clicked(e) && cycleAlign()} {...pointer}>
        {[-1.55, 1.55].map((x) => (
          <mesh key={x} position={[x, 1.2, 0]} material={frame}>
            <boxGeometry args={[0.06, 2.4, 0.06]} />
          </mesh>
        ))}
        <mesh position={[0, 2.05, 0]} material={flat(palette.ink, 0.5)} castShadow>
          <boxGeometry args={[3.3, 1.05, 0.05]} />
        </mesh>
        <Text position={[-1.45, 2.08, 0.03]} fontSize={0.13} color={palette.paper} anchorX="left" anchorY="middle" lineHeight={1.3}>
          {`.court {\n  display: flex;\n  justify-content: ${JUSTIFY[jc]};\n  align-items: ${ALIGN[ai]};\n}`}
        </Text>
        <Text position={[1.5, 1.62, 0.03]} fontSize={0.065} color={accent} anchorX="right" anchorY="middle">
          click: align-items
        </Text>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// CSS · Color Atelier (room, open zone)
// ---------------------------------------------------------------------------

const NAMED_COLORS: [string, string][] = [
  ["tomato", "#ff6347"],
  ["coral", "#ff7f50"],
  ["orangered", "#ff4500"],
  ["gold", "#ffd700"],
  ["khaki", "#f0e68c"],
  ["crimson", "#dc143c"],
  ["hotpink", "#ff69b4"],
  ["orchid", "#da70d6"],
  ["plum", "#dda0dd"],
  ["rebeccapurple", "#663399"],
  ["indigo", "#4b0082"],
  ["slateblue", "#6a5acd"],
  ["royalblue", "#4169e1"],
  ["dodgerblue", "#1e90ff"],
  ["steelblue", "#4682b4"],
  ["teal", "#008080"],
  ["turquoise", "#40e0d0"],
  ["aquamarine", "#7fffd4"],
  ["seagreen", "#2e8b57"],
  ["limegreen", "#32cd32"],
  ["olive", "#808000"],
  ["chocolate", "#d2691e"],
  ["sienna", "#a0522d"],
  ["peru", "#cd853f"],
];
const SWATCH_COLS = 8;
const SWATCH_ROWS = 3;
const SWATCH_HEAD = 70;
const PAINT_POTS: [string, string][] = [
  ["CSS blue", "#264de4"],
  ["magenta", "#ff00ff"],
  ["yellow", "#ffff00"],
];

const hexRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const rgbHex = (rgb: number[]) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
/** CSS hsl() for an sRGB color, rounded the way devtools shows it. */
function rgbHsl([r8, g8, b8]: number[]) {
  const [r, g, b] = [r8 / 255, g8 / 255, b8 / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const c = max - min;
  let h = 0;
  if (c > 0) h = max === r ? ((g - b) / c) % 6 : max === g ? (b - r) / c + 2 : (r - g) / c + 4;
  h = (h * 60 + 360) % 360;
  const s = c === 0 ? 0 : c / (1 - Math.abs(2 * l - 1));
  return `hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}
/** Equal parts of every drop, mixed in sRGB: what color-mix(in srgb, …) gives. */
function mixDrops(drops: string[]) {
  if (!drops.length) return "#ffffff";
  const sum = drops.map(hexRgb).reduce((a, c) => a.map((v, i) => v + c[i]), [0, 0, 0]);
  return rgbHex(sum.map((v) => v / drops.length));
}

function drawSwatches(ctx: CanvasRenderingContext2D, w: number, h: number, ink: string) {
  ctx.fillStyle = "#fbfaf7";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = ink;
  ctx.font = font(34, "800");
  ctx.fillText("CSS named colors", 24, 46);
  ctx.font = font(22);
  ctx.textAlign = "right";
  ctx.fillText("click one to add it to the mix", w - 24, 46);
  ctx.textAlign = "left";
  const cw = (w - 24) / SWATCH_COLS;
  const ch = (h - SWATCH_HEAD - 12) / SWATCH_ROWS;
  NAMED_COLORS.forEach(([name, hex], i) => {
    const x = 12 + (i % SWATCH_COLS) * cw;
    const y = SWATCH_HEAD + Math.floor(i / SWATCH_COLS) * ch;
    box(ctx, x + 6, y + 6, cw - 12, ch - 12, 8, hex);
    box(ctx, x + 6, y + ch - 52, cw - 12, 46, 0, "rgba(255,255,255,0.9)");
    ctx.fillStyle = "#1a1a1a";
    ctx.font = font(name.length > 11 ? 18 : 21, "700");
    ctx.fillText(name, x + 14, y + ch - 31);
    ctx.font = mono(16);
    ctx.fillText(hex, x + 14, y + ch - 13);
  });
}

/**
 * A color atelier: a wall of CSS named color swatches, a mixing table with three paint pots and an
 * easel. Click a pot (or a swatch) to add a drop to the mix; the big swatch and the easel show the
 * resulting color with its exact hex and hsl(). E cleans the palette.
 */
function ColorAtelier({ w, d, toHouse }: SigProps) {
  const { palette } = useHouse();
  const [drops, setDrops] = useState<string[]>([]);
  const mix = mixDrops(drops);
  const hsl = rgbHsl(hexRgb(mix));
  const wallW = Math.min(6, w / 2 - 1.6);
  const wallH = Math.min(2.1, wallW * 0.36);
  const wallX = -w / 4;
  const tableX = Math.min(3, w / 2 - 3);
  const tableZ = -d / 2 + 0.85;
  const easelX = Math.min(w / 2 - 1.2, tableX + 2.6);

  const add = (hex: string, name: string, x: number) => {
    const next = [...drops, hex];
    setDrops(next);
    sfx.splash();
    burstAt(toHouse, x, 1.1, tableZ, [hex, "#ffffff"], 8);
    const m = mixDrops(next);
    toast(`+ ${name} (${hex}) → ${m} · ${rgbHsl(hexRgb(m))}. Equal parts in sRGB, like color-mix(in srgb, …).`, `🎨 ${next.length} drop${next.length > 1 ? "s" : ""}`);
  };
  const clean = () => {
    setDrops([]);
    sfx.rustle();
    toast("Palette cleaned: back to a blank #ffffff canvas.", "🎨 Color Atelier");
  };
  const where = useWorldPoint(toHouse, tableX, tableZ + 1.1);
  useProximity({ id: "css-palette", label: "Clean the palette", radius: 2, where, run: clean });

  const { texture: swatches } = useCanvas(Math.round(wallW * 200), Math.round(wallH * 200), (ctx, cw, ch) => drawSwatches(ctx, cw, ch, palette.ink), `${wallW}|${palette.ink}`);
  const pickSwatch = (e: ThreeEvent<MouseEvent>) => {
    if (!clicked(e) || !e.uv) return;
    const pw = wallW * 200;
    const ph = wallH * 200;
    const col = Math.floor(((e.uv.x * pw - 12) / (pw - 24)) * SWATCH_COLS);
    const row = Math.floor(((1 - e.uv.y) * ph - SWATCH_HEAD) / ((ph - SWATCH_HEAD - 12) / SWATCH_ROWS));
    const c = NAMED_COLORS[row * SWATCH_COLS + col];
    if (c && col >= 0 && col < SWATCH_COLS && row >= 0) add(c[1], c[0], wallX);
  };
  const { texture: easel } = useCanvas(
    400,
    320,
    (ctx, cw, ch) => {
      ctx.fillStyle = "#f7f3ea";
      ctx.fillRect(0, 0, cw, ch);
      box(ctx, 24, 24, cw - 48, ch - 120, 6, mix, "rgba(0,0,0,0.15)");
      ctx.fillStyle = "#1a1a1a";
      ctx.font = mono(30, "700");
      ctx.fillText(drops.length ? mix : "#ffffff", 28, ch - 58);
      ctx.font = mono(22);
      ctx.fillText(drops.length ? hsl : "no paint yet", 28, ch - 24);
    },
    `${mix}|${drops.length}`,
  );

  const wood = flat("#a87b51", 0.6);
  return (
    <group>
      <Panel position={[wallX, 0.7 + wallH / 2, -d / 2 + 0.12]} width={wallW} height={wallH} map={swatches} frame={palette.ink} onClick={pickSwatch} />
      {/* The mixing table, its three pots and the mix card */}
      <group position={[tableX, 0, tableZ]}>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.9, 0.45, 0.4]} position={[0, 0.45, 0]} />
        </RigidBody>
        <mesh position={[0, 0.78, 0]} material={wood} castShadow receiveShadow>
          <boxGeometry args={[1.8, 0.05, 0.8]} />
        </mesh>
        {[-0.82, 0.82].flatMap((x) =>
          [-0.32, 0.32].map((z) => (
            <mesh key={`${x}${z}`} position={[x, 0.38, z]} material={wood} castShadow>
              <boxGeometry args={[0.06, 0.76, 0.06]} />
            </mesh>
          )),
        )}
        <mesh position={[0, 0.16, 0]} material={wood}>
          <boxGeometry args={[1.6, 0.03, 0.6]} />
        </mesh>
        {PAINT_POTS.map(([name, hex], i) => {
          const x = -0.55 + i * 0.55;
          return (
            <group key={hex} position={[x, 0.805, 0.15]} onClick={(e) => clicked(e) && add(hex, name, tableX + x)} {...pointer}>
              <mesh position={[0, 0.07, 0]} material={flat("#c7ccd3", 0.3, 0.85)} castShadow>
                <cylinderGeometry args={[0.11, 0.11, 0.14, 24]} />
              </mesh>
              <mesh position={[0, 0.142, 0]} rotation-x={Math.PI / 2} material={flat("#9aa1aa", 0.3, 0.85)}>
                <torusGeometry args={[0.105, 0.008, 6, 24]} />
              </mesh>
              <mesh position={[0, 0.135, 0]} rotation-x={-Math.PI / 2} material={flat(hex, 0.25)}>
                <circleGeometry args={[0.1, 24]} />
              </mesh>
              <mesh position={[0, 0.07, 0.111]} material={flat(hex, 0.4)}>
                <boxGeometry args={[0.12, 0.05, 0.004]} />
              </mesh>
              <Text position={[0, 0.22, 0]} fontSize={0.05} color={palette.ink} anchorX="center" anchorY="middle">
                {hex}
              </Text>
            </group>
          );
        })}
        {/* The mix: a big swatch card on a stand */}
        <group position={[0, 0.805, -0.24]}>
          <mesh position={[0, 0.02, 0]} material={wood}>
            <boxGeometry args={[0.8, 0.04, 0.12]} />
          </mesh>
          <mesh position={[0, 0.33, 0]} castShadow>
            <boxGeometry args={[0.72, 0.56, 0.02]} />
            <meshStandardMaterial color={mix} roughness={0.5} />
          </mesh>
          <Text position={[0, 0.7, 0]} fontSize={0.075} color={palette.ink} anchorX="center" anchorY="middle">
            {drops.length ? mix : "click a paint pot"}
          </Text>
        </group>
      </group>
      {/* The easel */}
      <group position={[easelX, 0, -d / 2 + 0.9]} rotation-y={-0.35}>
        {[-0.35, 0.35].map((x) => (
          <mesh key={x} position={[x, 0.85, 0.06]} rotation-z={x < 0 ? -0.08 : 0.08} material={wood} castShadow>
            <boxGeometry args={[0.04, 1.75, 0.04]} />
          </mesh>
        ))}
        <mesh position={[0, 0.8, -0.28]} rotation-x={0.3} material={wood}>
          <boxGeometry args={[0.04, 1.65, 0.04]} />
        </mesh>
        <mesh position={[0, 0.78, 0.1]} material={wood}>
          <boxGeometry args={[0.85, 0.04, 0.08]} />
        </mesh>
        <group position={[0, 1.22, 0.1]} rotation-x={-0.1}>
          <Panel position={[0, 0, 0]} width={0.9} height={0.72} map={easel} frame="#f3ede0" />
        </group>
      </group>
    </group>
  );
}

export const LANGUAGES: Record<string, SigComponent> = {
  "js-event-loop": EventLoop,
  "js-promise-cafe": PromiseCafe,
  "ts-type-gate": TypeGate,
  "ts-drafting": DraftingRoom,
  "php-elephpant": Elephpant,
  "php-1995": HomePage1995,
  "py-snake-bench": SnakeBench,
  "py-notebook": NotebookLab,
  "html-skeleton": HtmlSkeleton,
  "html-nav": NavRoom,
  "css-flexbox": FlexboxCourt,
  "css-palette": ColorAtelier,
};
