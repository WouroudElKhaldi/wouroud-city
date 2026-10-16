"use client";

import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { Suspense, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useCityStore } from "@/state/useCityStore";
import { NPC_PEOPLE } from "@/world/outfits";
import { sfx } from "@/world/sfx";
import { Batch, Desk, ExecChair, Rug, SideChair, Table, TallPlant } from "../../Furniture";
import { Person } from "../../Person";
import { box, font, Panel, useCanvas, wrap } from "../../roomKit";
import { Seats } from "../../StreetDetails";
import { Text } from "../../Text3D";
import { useProximity } from "../../useProximity";
import { flat } from "../finishKit";
import { burstAt, clicked, pointer, seatAt, useWorldPoint } from "../modules";
import { useHouse } from "../SkillHouse";
import type { SigComponent, SigProps } from "./types";

/**
 * Signature pieces for state (Redux, Zustand), hosting (GCP, cPanel, aaPanel), design (Figma, UI/UX),
 * architecture, system design, API development and n8n.
 */

type V3 = [number, number, number];

const toast = (text: string, title?: string) => useCityStore.getState().toast(text, title);
const now = () => performance.now() / 1000;
/** Smoothstep on [0, 1], clamped. */
const ease = (k: number) => {
  const c = Math.min(1, Math.max(0, k));
  return c * c * (3 - 2 * c);
};
const UP = new THREE.Vector3(0, 1, 0);
/** Where a limb (a capsule or cylinder along y) from a to b goes: its middle, its turn and its length. */
function between(a: V3, b: V3) {
  const from = new THREE.Vector3(...a);
  const dir = new THREE.Vector3(...b).sub(from);
  const length = dir.length();
  const mid = from.add(dir.clone().multiplyScalar(0.5));
  return { position: [mid.x, mid.y, mid.z] as V3, quaternion: new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()), length };
}
/** "10:42:07.118" for a clock time (event handlers only). */
const stamp = (date: Date) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}.${String(date.getMilliseconds()).padStart(3, "0")}`;

/**
 * A canvas board sized for small panels (fonts scale with the board, unlike the hall's big
 * WallBoard): a kicker, a title and lines, the current line highlighted. Faces +z.
 */
function NoteBoard({ position, rotationY = 0, width, height, kicker, title, lines, current = -1, dark = false }: { position: V3; rotationY?: number; width: number; height: number; kicker?: string; title: string; lines: string[]; current?: number; dark?: boolean }) {
  const { palette, accent } = useHouse();
  const px = 320;
  const { texture } = useCanvas(
    Math.round(width * px),
    Math.round(height * px),
    (ctx, cw, ch) => {
      ctx.fillStyle = dark ? palette.ink : palette.paper;
      ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = accent;
      ctx.fillRect(0, 0, cw, 8);
      let y = 44;
      if (kicker) {
        ctx.font = font(22, "700");
        ctx.fillText(kicker.toUpperCase(), 24, y);
        y += 44;
      }
      ctx.fillStyle = dark ? palette.paper : palette.ink;
      ctx.font = font(38, "800");
      y = wrap(ctx, title, 24, y, cw - 48, 44) + 6;
      ctx.font = font(24);
      lines.forEach((line, i) => {
        if (y > ch - 12) return;
        const on = i === current;
        if (on) box(ctx, 14, y - 25, cw - 28, 34, 8, accent);
        ctx.fillStyle = on ? (dark ? palette.ink : "#ffffff") : dark ? palette.paper : palette.ink;
        y = wrap(ctx, `• ${line}`, 24, y, cw - 48, 30) + 8;
      });
    },
    `${kicker}|${title}|${lines.join("|")}|${current}|${dark}|${accent}`,
  );
  return <Panel position={position} rotationY={rotationY} width={width} height={height} map={texture} frame={palette.ink} />;
}

// ---------------------------------------------------------------------------
// Redux · The Time Machine clock (hero)
// ---------------------------------------------------------------------------

/**
 * A tall astronomical clock tower in purple and brass: a big dial with hands, a pendulum behind
 * glass and, around the dial, a ring of the actions dispatched so far. E time-travels: the hands
 * spin backwards while the side panel steps the store back through its earlier states (the cart
 * empties), then replays them forward, the way Redux DevTools does.
 */
const REDUX_STATES = [
  { action: "@@INIT", payload: "", items: [] as string[], filter: "all" },
  { action: "ADD_ITEM", payload: "'Mug'", items: ["Mug"], filter: "all" },
  { action: "ADD_ITEM", payload: "'Tee'", items: ["Mug", "Tee"], filter: "all" },
  { action: "SET_FILTER", payload: "'sale'", items: ["Mug", "Tee"], filter: "sale" },
  { action: "REMOVE_ITEM", payload: "'Mug'", items: ["Tee"], filter: "sale" },
  { action: "ADD_ITEM", payload: "'Cap'", items: ["Tee", "Cap"], filter: "sale" },
];

function TimeMachineClock({ w, d, toHouse }: SigProps) {
  const { palette, accent } = useHouse();
  const last = REDUX_STATES.length - 1;
  const [at, setAt] = useState(last);
  const [dir, setDir] = useState(0);
  const travel = useRef({ dir: 0, at: last, next: 0 });
  const minute = useRef<THREE.Group>(null);
  const hour = useRef<THREE.Group>(null);
  const pendulum = useRef<THREE.Group>(null);
  const gears = useRef<THREE.Group>(null);

  const run = () => {
    if (travel.current.dir !== 0) return;
    travel.current = { dir: -1, at: last, next: now() + 0.6 };
    setDir(-1);
    sfx.gong();
  };
  const where = useWorldPoint(toHouse, 0, Math.min(d / 2 - 0.4, 2.8));
  useProximity({ id: "redux-clock", label: dir === 0 ? "Time travel" : "Travelling through time…", radius: 2.2, where, run });

  useFrame((_, dt) => {
    const t = now();
    const tr = travel.current;
    // Clockwise (forward) is a negative turn around z when seen from the front.
    const speed = tr.dir === 0 ? 0.1 : tr.dir * 4.5;
    if (minute.current) minute.current.rotation.z -= dt * speed;
    if (hour.current) hour.current.rotation.z -= (dt * speed) / 12;
    if (pendulum.current) pendulum.current.rotation.z = Math.sin(t * 2.4) * (tr.dir === 0 ? 0.2 : 0.34);
    if (gears.current) gears.current.rotation.z += dt * (tr.dir === 0 ? 0.08 : tr.dir * -0.7);
    if (tr.dir === 0 || t < tr.next) return;
    tr.at += tr.dir;
    setAt(tr.at);
    sfx.click();
    tr.next = t + 0.7;
    if (tr.at === 0 && tr.dir === -1) {
      tr.dir = 1;
      setDir(1);
      sfx.chirp();
    } else if (tr.at === last && tr.dir === 1) {
      tr.dir = 0;
      setDir(0);
      sfx.sparkle();
      burstAt(toHouse, 0, 2.9, 0.7, [accent, palette.second, "#ffffff"], 18);
      toast("Rewound to @@INIT and replayed every action. Reducers are pure, so the same actions always rebuild the same state: that's how Redux DevTools time-travels.", "⏳ Time travel");
    }
  });

  const shown = REDUX_STATES[at];
  const { texture } = useCanvas(
    640,
    470,
    (ctx, cw, ch) => {
      ctx.fillStyle = "#1b1029";
      ctx.fillRect(0, 0, cw, ch);
      box(ctx, 0, 0, cw, 56, 0, accent);
      ctx.fillStyle = "#ffffff";
      ctx.font = font(28, "700");
      ctx.fillText("Redux DevTools · State", 24, 38);
      ctx.fillStyle = palette.second;
      ctx.font = font(26, "700");
      ctx.fillText(`#${at}  ${shown.action}${shown.payload ? `(${shown.payload})` : ""}`, 24, 102);
      ctx.font = font(26);
      const items = shown.items.length ? shown.items.map((i) => `'${i}'`).join(", ") : "";
      ["{", "  cart: {", `    items: [${items}]`, "  },", `  filter: '${shown.filter}'`, "}"].forEach((line, i) => {
        ctx.fillStyle = i === 2 || i === 4 ? "#e9d5ff" : "#a78bfa";
        ctx.fillText(line, 30, 152 + i * 38);
      });
      // The timeline of states, the current one in brass
      const y = 420;
      ctx.strokeStyle = "#5b4380";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(60, y);
      ctx.lineTo(cw - 60, y);
      ctx.stroke();
      REDUX_STATES.forEach((_, i) => {
        const x = 60 + (i * (cw - 120)) / last;
        ctx.fillStyle = i === at ? palette.second : i < at ? "#a78bfa" : "#3b2a55";
        ctx.beginPath();
        ctx.arc(x, y, i === at ? 15 : 10, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = "#cbb8ea";
      ctx.font = font(22, "600");
      ctx.fillText(dir < 0 ? "◀◀ rewinding" : dir > 0 ? "▶ replaying" : "● live", cw - 190, 372);
    },
    `${at}|${dir}|${accent}`,
  );

  const brass = flat(palette.second, 0.3, 0.85);
  const tower = flat(palette.main, 0.55, 0.1);
  const ring = 1.0;
  const panelX = Math.min(2.4, w / 2 - 0.8);
  return (
    <group onClick={(e) => clicked(e) && run()} {...pointer}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.1, 1.5, 0.95]} position={[0, 1.5, 0]} />
      </RigidBody>
      {/* Plinth with a brass band */}
      <mesh position={[0, 0.15, 0]} material={flat(palette.ink, 0.4, 0.2)} castShadow receiveShadow>
        <boxGeometry args={[2.2, 0.3, 1.8]} />
      </mesh>
      <mesh position={[0, 0.31, 0]} material={brass}>
        <boxGeometry args={[2.26, 0.05, 1.86]} />
      </mesh>
      {/* The tower, its brass pilasters and a pyramid roof */}
      <mesh position={[0, 2.1, 0]} material={tower} castShadow>
        <boxGeometry args={[1.5, 3.6, 1.0]} />
      </mesh>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * 0.76, 2.1, sz * 0.51]} material={brass} castShadow>
            <boxGeometry args={[0.08, 3.6, 0.08]} />
          </mesh>
        )),
      )}
      <mesh position={[0, 3.94, 0]} material={brass}>
        <boxGeometry args={[1.66, 0.08, 1.16]} />
      </mesh>
      <mesh position={[0, 4.18, 0]} rotation-y={Math.PI / 4} material={tower} castShadow>
        <coneGeometry args={[0.98, 0.42, 4]} />
      </mesh>
      <mesh position={[0, 4.44, 0]} material={brass}>
        <sphereGeometry args={[0.07, 12, 10]} />
      </mesh>
      {/* The action log ring around the dial */}
      <group position={[0, 2.9, 0.52]}>
        <mesh material={flat(palette.ink, 0.5, 0.3)}>
          <ringGeometry args={[0.7, 1.28, 48]} />
        </mesh>
        <mesh position={[0, 0, 0.005]} material={brass}>
          <torusGeometry args={[1.28, 0.035, 8, 64]} />
        </mesh>
        <group ref={gears} position={[0, 0, 0.02]}>
          <mesh material={brass}>
            <torusGeometry args={[1.12, 0.012, 6, 64]} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[Math.cos((i * Math.PI * 2) / 3) * 1.12, Math.sin((i * Math.PI * 2) / 3) * 1.12, 0]} material={brass}>
              <sphereGeometry args={[0.04, 10, 8]} />
            </mesh>
          ))}
        </group>
        {REDUX_STATES.map((s, i) => {
          const a = Math.PI / 2 - (i * Math.PI * 2) / REDUX_STATES.length;
          const turn = Math.sin(a) >= -0.01 ? a - Math.PI / 2 : a + Math.PI / 2;
          return (
            <Text key={i} position={[Math.cos(a) * ring, Math.sin(a) * ring, 0.03]} rotation-z={turn} fontSize={0.1} color={i === at ? palette.second : i < at ? palette.paper : "#7d6a99"} anchorX="center" anchorY="middle" outlineWidth={i === at ? 0.004 : 0} outlineColor={palette.second}>
              {s.action}
            </Text>
          );
        })}
        {/* The dial */}
        <mesh position={[0, 0, 0.01]} material={brass}>
          <torusGeometry args={[0.64, 0.055, 10, 48]} />
        </mesh>
        <mesh position={[0, 0, 0.005]} material={flat(palette.paper, 0.5)}>
          <circleGeometry args={[0.62, 48]} />
        </mesh>
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * Math.PI) / 6;
          return (
            <mesh key={i} position={[Math.sin(a) * 0.52, Math.cos(a) * 0.52, 0.015]} rotation-z={-a} material={flat(palette.ink, 0.5)}>
              <boxGeometry args={[0.025, i % 3 === 0 ? 0.12 : 0.06, 0.01]} />
            </mesh>
          );
        })}
        <group ref={hour} position={[0, 0, 0.03]} rotation-z={-1.1}>
          <mesh position={[0, 0.16, 0]} material={flat(palette.ink, 0.4, 0.5)}>
            <boxGeometry args={[0.05, 0.34, 0.012]} />
          </mesh>
        </group>
        <group ref={minute} position={[0, 0, 0.045]}>
          <mesh position={[0, 0.23, 0]} material={brass}>
            <boxGeometry args={[0.03, 0.5, 0.012]} />
          </mesh>
        </group>
        <mesh position={[0, 0, 0.06]} rotation-x={Math.PI / 2} material={brass}>
          <cylinderGeometry args={[0.05, 0.05, 0.03, 16]} />
        </mesh>
      </group>
      {/* Pendulum behind its glass window */}
      <mesh position={[0, 1.0, 0.505]} material={flat("#140b20", 0.15, 0.4)}>
        <boxGeometry args={[0.84, 1.1, 0.02]} />
      </mesh>
      <mesh position={[0, 1.0, 0.5]} material={brass}>
        <boxGeometry args={[0.94, 1.2, 0.01]} />
      </mesh>
      <group ref={pendulum} position={[0, 1.5, 0.54]}>
        <mesh position={[0, -0.38, 0]} material={brass}>
          <boxGeometry args={[0.025, 0.76, 0.02]} />
        </mesh>
        <mesh position={[0, -0.8, 0]} rotation-x={Math.PI / 2} material={brass}>
          <cylinderGeometry args={[0.14, 0.14, 0.04, 28]} />
        </mesh>
      </group>
      {/* DevTools panel on a brass stand */}
      <group position={[panelX, 0, 0.5]} rotation-y={-0.3}>
        <mesh position={[0, 0.55, 0]} material={brass} castShadow>
          <cylinderGeometry args={[0.04, 0.05, 1.1, 12]} />
        </mesh>
        <mesh position={[0, 0.02, 0]} material={brass}>
          <cylinderGeometry args={[0.28, 0.32, 0.04, 24]} />
        </mesh>
        <Panel position={[0, 1.6, 0]} width={1.36} height={1.0} map={texture} frame={palette.second} />
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Redux · The Action Log (room)
// ---------------------------------------------------------------------------

/**
 * A long parchment ledger between brass rollers on the back wall: every dispatched action with
 * its timestamp, type and payload, newest on top. E (or the brass button on the lectern) calls
 * dispatch(): a new action lands at the top and glows for a moment.
 */
type LogEntry = { time: string; type: string; payload: string };
const LOG_START: LogEntry[] = [
  { time: "10:42:19.884", type: "cart/addItem", payload: "{ id: 7, name: 'Mug', price: 12 }" },
  { time: "10:42:11.302", type: "filters/setFilter", payload: "'sale'" },
  { time: "10:41:58.017", type: "cart/addItem", payload: "{ id: 3, name: 'Tee', price: 18 }" },
  { time: "10:41:40.560", type: "user/loggedIn", payload: "{ id: 42, name: 'Wouroud' }" },
  { time: "10:41:39.912", type: "products/fetchAll/fulfilled", payload: "[24 products]" },
  { time: "10:41:39.205", type: "products/fetchAll/pending", payload: "undefined" },
  { time: "10:41:39.001", type: "@@INIT", payload: "undefined" },
];
const LOG_NEXT: Omit<LogEntry, "time">[] = [
  { type: "cart/removeItem", payload: "{ id: 7 }" },
  { type: "cart/addItem", payload: "{ id: 12, name: 'Cap', price: 15 }" },
  { type: "cart/checkout/pending", payload: "undefined" },
  { type: "cart/checkout/fulfilled", payload: "{ orderId: 1042, total: 33 }" },
  { type: "filters/setFilter", payload: "'all'" },
  { type: "ui/toggleTheme", payload: "undefined" },
];
const LOG_ROWS = 8;

function ActionLog({ w, d, toHouse, label }: SigProps) {
  const { palette, accent } = useHouse();
  const [log, setLog] = useState(LOG_START);
  const sent = useRef(0);
  const flashAt = useRef(-10);
  const glow = useRef<THREE.MeshBasicMaterial>(null);
  const button = useRef<THREE.Mesh>(null);
  const dispatch = () => {
    const next = LOG_NEXT[sent.current++ % LOG_NEXT.length];
    setLog((l) => [{ ...next, time: stamp(new Date()) }, ...l].slice(0, LOG_ROWS + 2));
    flashAt.current = now();
    sfx.pop();
    if (sent.current === 1) toast("dispatch(action) sends a plain object { type, payload } to the store; the reducer returns the next state and the log keeps the history.", "📜 Action log");
  };
  const where = useWorldPoint(toHouse, 0, -d / 2 + 2.3);
  useProximity({ id: "redux-log", label: "dispatch()", radius: 1.8, where, run: dispatch });

  const sw = Math.min(w - 1.4, 3.8);
  const sh = 2.5;
  const ch = Math.round((1024 * sh) / sw);
  const top = 150;
  const rowH = (ch - top - 30) / LOG_ROWS;
  const { texture } = useCanvas(
    1024,
    ch,
    (ctx, cw, h) => {
      ctx.fillStyle = "#f4ead3";
      ctx.fillRect(0, 0, cw, h);
      ctx.fillStyle = "rgba(120,80,30,0.08)";
      for (let y = 0; y < h; y += 9) ctx.fillRect(0, y, cw, 1);
      ctx.fillStyle = accent;
      ctx.font = font(54, "800");
      ctx.fillText(label, 40, 72);
      ctx.fillStyle = "#7a6440";
      ctx.font = font(28, "600");
      ctx.fillText("store.dispatch() · newest first", 40, 118);
      log.slice(0, LOG_ROWS).forEach((e, i) => {
        const y = top + i * rowH;
        if (i === 0) box(ctx, 20, y + 4, cw - 40, rowH - 8, 10, "rgba(201,164,90,0.35)");
        ctx.fillStyle = "#8b7653";
        ctx.font = font(26);
        ctx.fillText(e.time, 40, y + rowH * 0.42);
        ctx.fillStyle = i === 0 ? accent : "#3a2456";
        ctx.font = font(32, "700");
        ctx.fillText(e.type, 240, y + rowH * 0.42);
        ctx.fillStyle = "#5a4a3a";
        ctx.font = font(26);
        ctx.fillText(`payload: ${e.payload}`, 240, y + rowH * 0.8);
        ctx.fillStyle = "rgba(90,60,30,0.2)";
        ctx.fillRect(30, y + rowH - 2, cw - 60, 2);
      });
    },
    `${log[0].time}|${accent}|${label}`,
  );

  useFrame(() => {
    const k = Math.max(0, 1 - (now() - flashAt.current) / 1.4);
    if (glow.current) glow.current.opacity = k * 0.55;
    if (button.current) button.current.position.y = 0.035 - (k > 0.85 ? 0.02 : 0);
  });

  const brass = flat(palette.second, 0.3, 0.85);
  const wallZ = -d / 2 + 0.14;
  const cy = 1.75;
  const rowY = cy + sh / 2 - ((top + rowH / 2) / ch) * sh;
  return (
    <group>
      {/* The ledger and its rollers */}
      <mesh position={[0, cy, wallZ + 0.02]}>
        <planeGeometry args={[sw, sh]} />
        <meshStandardMaterial map={texture} roughness={0.9} />
      </mesh>
      <mesh position={[0, rowY, wallZ + 0.03]}>
        <planeGeometry args={[sw - 0.04, (rowH / ch) * sh]} />
        <meshBasicMaterial ref={glow} color={palette.second} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {[cy + sh / 2 + 0.05, cy - sh / 2 - 0.05].map((y) => (
        <group key={y} position={[0, y, wallZ + 0.06]}>
          <mesh rotation-z={Math.PI / 2} material={flat("#6b4a2e", 0.5)} castShadow>
            <cylinderGeometry args={[0.06, 0.06, sw + 0.16, 20]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * (sw / 2 + 0.12), 0, 0]} material={brass}>
              <sphereGeometry args={[0.08, 14, 10]} />
            </mesh>
          ))}
        </group>
      ))}
      {/* The lectern with the dispatch button */}
      <group position={[0, 0, -d / 2 + 1.5]} onClick={(e) => clicked(e) && dispatch()} {...pointer}>
        <mesh position={[0, 0.5, 0]} material={flat(palette.main, 0.5)} castShadow>
          <boxGeometry args={[0.45, 1.0, 0.38]} />
        </mesh>
        <mesh position={[0, 0.02, 0]} material={brass}>
          <boxGeometry args={[0.6, 0.04, 0.5]} />
        </mesh>
        <group position={[0, 1.06, 0.02]} rotation-x={0.35}>
          <mesh material={flat("#4a2e1c", 0.45)} castShadow>
            <boxGeometry args={[0.66, 0.05, 0.5]} />
          </mesh>
          <mesh position={[0, 0.03, -0.02]} material={brass}>
            <cylinderGeometry args={[0.11, 0.12, 0.03, 24]} />
          </mesh>
          <mesh ref={button} position={[0, 0.035, -0.02]} material={flat(accent, 0.35, 0.1, accent, 0.5)}>
            <cylinderGeometry args={[0.08, 0.08, 0.05, 24]} />
          </mesh>
          <Text position={[0, 0.03, 0.17]} rotation-x={-Math.PI / 2} fontSize={0.06} color={palette.second} anchorX="center" anchorY="middle">
            dispatch()
          </Text>
        </group>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.3, 0.55, 0.25]} position={[0, 0.55, 0]} />
        </RigidBody>
      </group>
      <Rug position={[0, -d / 2 + 2.6]} width={Math.min(w - 1.6, 3)} depth={Math.min(d - 4, 4.4)} color={palette.main} border={palette.second} />
      <TallPlant position={[-w / 2 + 0.5, 0, -d / 2 + 0.5]} seed={3} />
      <TallPlant position={[w / 2 - 0.5, 0, -d / 2 + 0.5]} seed={5} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Zustand · The bear and its honey pot (hero)
// ---------------------------------------------------------------------------

/**
 * A friendly brown bear sitting on a log slice, hugging a glass honey jar labeled "store". E runs
 * set((s) => ({ honey: s.honey + 1 })): the honey rises, the bear nods, and the little sign
 * beside it shows the store's new state.
 */
const BEAR_ARMS = [-1, 1].map((s) => between([s * 0.74, 1.85, 0.12], [s * 0.36, 1.22, 0.82]));
const BEAR_LEGS = [-1, 1].map((s) => between([s * 0.52, 0.62, 0.05], [s * 0.6, 0.56, 0.92]));
const JAR = { y: 0.8, r: 0.33, h: 0.62, z: 0.85 };
const HONEY_FULL = 8;

function HoneyBear({ w, d, toHouse }: SigProps) {
  const { palette, accent } = useHouse();
  const [honey, setHoney] = useState(3);
  const level = useRef(3 / HONEY_FULL);
  const nodAt = useRef(-10);
  const head = useRef<THREE.Group>(null);
  const fill = useRef<THREE.Mesh>(null);
  const feed = () => {
    const next = honey + 1;
    setHoney(next);
    nodAt.current = now();
    sfx.pop();
    burstAt(toHouse, 0, JAR.y + JAR.h + 0.1, JAR.z, [palette.second, "#ffe08a", "#ffffff"], 12);
    toast(`set() merged { honey: ${next} } into the store. Components that select s.honey re-render; the rest don't even notice.`, "🍯 Zustand");
  };
  const where = useWorldPoint(toHouse, 0, Math.min(d / 2 - 0.4, 2.6));
  useProximity({ id: "zustand-bear", label: "set((s) => ({ honey: s.honey + 1 }))", radius: 2.2, where, run: feed });

  useFrame((_, dt) => {
    const target = (((honey - 1) % HONEY_FULL) + 1) / HONEY_FULL;
    level.current += (target - level.current) * Math.min(1, dt * 3);
    if (fill.current) {
      fill.current.scale.y = Math.max(0.02, level.current);
      fill.current.position.y = (JAR.h - 0.06) * level.current * 0.5;
    }
    const k = (now() - nodAt.current) / 0.9;
    if (head.current) head.current.rotation.x = k < 1 ? Math.sin(k * Math.PI * 2) * 0.22 : Math.sin(now() * 0.8) * 0.03;
  });

  const fur = flat("#7a4a26", 0.95);
  const light = flat("#c99a6a", 0.9);
  const dark = flat("#2a1a10", 0.35);
  const honeyMat = flat("#f2a81d", 0.2, 0, "#b86e00", 0.35);
  const wood = flat("#8a5f3a", 0.8);
  const signX = Math.min(2.1, w / 2 - 0.6);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.4, 0.8, 1.4]} position={[0, 0.8, 0]} />
      </RigidBody>
      {/* The log slice it sits on */}
      <mesh position={[0, 0.15, 0]} material={flat("#4a3220", 0.95)} castShadow receiveShadow>
        <cylinderGeometry args={[1.55, 1.6, 0.3, 40]} />
      </mesh>
      <mesh position={[0, 0.302, 0]} rotation-x={-Math.PI / 2} material={flat("#c9975e", 0.8)} receiveShadow>
        <circleGeometry args={[1.48, 40]} />
      </mesh>
      {[0.5, 0.95, 1.3].map((r) => (
        <mesh key={r} position={[0, 0.305, 0]} rotation-x={-Math.PI / 2} material={flat("#a8784a", 0.85)}>
          <ringGeometry args={[r, r + 0.025, 40]} />
        </mesh>
      ))}
      {/* Body and belly */}
      <mesh position={[0, 1.25, -0.12]} scale={[1, 1.12, 0.88]} material={fur} castShadow>
        <sphereGeometry args={[0.95, 32, 24]} />
      </mesh>
      <mesh position={[0, 1.2, 0.42]} scale={[0.85, 1, 0.45]} material={light}>
        <sphereGeometry args={[0.66, 24, 18]} />
      </mesh>
      {BEAR_LEGS.map((l, i) => (
        <group key={i}>
          <mesh position={l.position} quaternion={l.quaternion} material={fur} castShadow>
            <capsuleGeometry args={[0.28, l.length, 6, 16]} />
          </mesh>
          <mesh position={[(i ? 1 : -1) * 0.6, 0.56, 1.21]} material={light}>
            <circleGeometry args={[0.19, 20]} />
          </mesh>
        </group>
      ))}
      {/* The honey jar it hugs */}
      <group position={[0, JAR.y, JAR.z]} onClick={(e) => clicked(e) && feed()} {...pointer}>
        <mesh position={[0, 0.02, 0]} material={flat("#d9c7a0", 0.6)}>
          <cylinderGeometry args={[JAR.r, JAR.r, 0.04, 28]} />
        </mesh>
        <mesh ref={fill} material={honeyMat}>
          <cylinderGeometry args={[JAR.r - 0.025, JAR.r - 0.025, JAR.h - 0.06, 28]} />
        </mesh>
        <mesh position={[0, JAR.h / 2, 0]}>
          <cylinderGeometry args={[JAR.r, JAR.r, JAR.h, 28, 1, true]} />
          <meshStandardMaterial color="#fff6dc" transparent opacity={0.25} roughness={0.05} metalness={0.1} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, JAR.h, 0]} rotation-x={Math.PI / 2} material={flat("#b07a3a", 0.5, 0.2)}>
          <torusGeometry args={[JAR.r, 0.03, 8, 28]} />
        </mesh>
        {/* Honey dripping over the rim */}
        {[-0.5, 0.15, 0.7].map((a, i) => (
          <mesh key={a} position={[Math.sin(a) * (JAR.r + 0.02), JAR.h - 0.06 - i * 0.03, Math.cos(a) * (JAR.r + 0.02)]} material={honeyMat}>
            <capsuleGeometry args={[0.025, 0.1 + i * 0.05, 4, 8]} />
          </mesh>
        ))}
        <mesh position={[0, JAR.h * 0.42, 0]}>
          <cylinderGeometry args={[JAR.r + 0.006, JAR.r + 0.006, 0.17, 28, 1, true, -0.85, 1.7]} />
          <meshStandardMaterial color={palette.paper} roughness={0.8} side={THREE.DoubleSide} />
        </mesh>
        <Text position={[0, JAR.h * 0.42, JAR.r + 0.02]} fontSize={0.085} color={palette.ink} anchorX="center" anchorY="middle">
          store
        </Text>
        {/* A honey dipper in the jar */}
        <group position={[0.12, JAR.h + 0.1, -0.05]} rotation-z={-0.35}>
          <mesh position={[0, 0.12, 0]} material={wood}>
            <cylinderGeometry args={[0.015, 0.015, 0.5, 8]} />
          </mesh>
          {[0, 1, 2].map((k) => (
            <mesh key={k} position={[0, -0.12 + k * 0.035, 0]} rotation-x={Math.PI / 2} material={wood}>
              <torusGeometry args={[0.04, 0.014, 6, 14]} />
            </mesh>
          ))}
        </group>
      </group>
      {BEAR_ARMS.map((a, i) => (
        <group key={i}>
          <mesh position={a.position} quaternion={a.quaternion} material={fur} castShadow>
            <capsuleGeometry args={[0.18, a.length, 6, 14]} />
          </mesh>
          <mesh position={[(i ? 1 : -1) * 0.34, 1.2, 0.86]} material={fur}>
            <sphereGeometry args={[0.19, 16, 12]} />
          </mesh>
        </group>
      ))}
      {/* Head: nods when the store changes */}
      <group ref={head} position={[0, 2.12, 0]}>
        <mesh position={[0, 0.38, 0.08]} material={fur} castShadow>
          <sphereGeometry args={[0.6, 28, 22]} />
        </mesh>
        <mesh position={[0, 0.25, 0.58]} scale={[1.1, 0.8, 0.85]} material={light}>
          <sphereGeometry args={[0.26, 20, 14]} />
        </mesh>
        <mesh position={[0, 0.34, 0.81]} scale={[1.2, 0.85, 0.8]} material={dark}>
          <sphereGeometry args={[0.075, 14, 10]} />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh position={[s * 0.21, 0.53, 0.58]} material={dark}>
              <sphereGeometry args={[0.055, 12, 10]} />
            </mesh>
            <mesh position={[s * 0.42, 0.85, 0.02]} material={fur}>
              <sphereGeometry args={[0.19, 16, 12]} />
            </mesh>
            <mesh position={[s * 0.42, 0.85, 0.15]} scale={[1, 1, 0.4]} material={light}>
              <sphereGeometry args={[0.11, 12, 10]} />
            </mesh>
          </group>
        ))}
      </group>
      {/* The sign with the store's state */}
      <group position={[signX, 0, 0.9]} rotation-y={-0.35}>
        <mesh position={[0, 0.55, 0]} material={wood} castShadow>
          <boxGeometry args={[0.08, 1.1, 0.08]} />
        </mesh>
        <mesh position={[0, 1.25, 0]} material={wood} castShadow>
          <boxGeometry args={[1.0, 0.56, 0.06]} />
        </mesh>
        <mesh position={[0, 1.25, 0.032]} material={flat(palette.paper, 0.8)}>
          <boxGeometry args={[0.9, 0.46, 0.005]} />
        </mesh>
        <Text position={[0, 1.37, 0.04]} fontSize={0.07} color="#8a5f3a" anchorX="center" anchorY="middle">
          useBearStore.getState()
        </Text>
        <Text position={[0, 1.2, 0.04]} fontSize={0.12} color={palette.ink} anchorX="center" anchorY="middle" outlineWidth={0.002} outlineColor={accent}>
          {`{ honey: ${honey} }`}
        </Text>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// GCP · The Cloud Run launch pad (hero)
// ---------------------------------------------------------------------------

/**
 * A round launch pad with four beacons in Google's colors and a container-shaped capsule docked
 * between two tall rails. E runs `gcloud run deploy`: a countdown on the console, the capsule rides
 * the rails up to the ceiling with a light trail, comes back down, and the new revision is live.
 */
const GOOGLE = ["#4285f4", "#ea4335", "#fbbc05", "#34a853"];
type LaunchPhase = "idle" | "3" | "2" | "1" | "rise" | "live";

function LaunchPad({ w, d, toHouse }: SigProps) {
  const { plan, palette } = useHouse();
  const [phase, setPhase] = useState<LaunchPhase>("idle");
  const [revision, setRevision] = useState(41);
  const startAt = useRef(-1);
  const phaseRef = useRef<LaunchPhase>("idle");
  const capsule = useRef<THREE.Group>(null);
  const trail = useRef<THREE.Mesh>(null);
  const trailMat = useRef<THREE.MeshBasicMaterial>(null);
  const beacons = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const dock = 1.08;
  // Up to just under the hall banner that hangs over the centerpiece.
  const peak = Math.min(plan.H - 2.6, 4.0);

  const deploy = () => {
    if (startAt.current >= 0) return;
    startAt.current = now();
    setRevision((r) => r + 1);
    sfx.click();
  };
  const where = useWorldPoint(toHouse, 0, Math.min(d / 2 - 0.4, 2.8));
  useProximity({ id: "gcp-launch", label: phase === "idle" || phase === "live" ? "gcloud run deploy" : "Deploying…", radius: 2.3, where, run: deploy });

  useFrame(() => {
    const t = now();
    const e = startAt.current < 0 ? -1 : t - startAt.current;
    let next: LaunchPhase = phaseRef.current;
    let y = dock;
    if (e >= 0) {
      if (e < 3) next = String(3 - Math.floor(e)) as LaunchPhase;
      else if (e < 7.4) {
        next = "rise";
        y = e < 5 ? dock + (peak - dock) * ease((e - 3) / 2) : e < 5.6 ? peak : peak - (peak - dock) * ease((e - 5.6) / 1.8);
      } else {
        next = "live";
        startAt.current = -1;
        sfx.sparkle();
        burstAt(toHouse, 0, 1.6, 0, GOOGLE, 22);
        toast("Cloud Run built the container, created a new revision and moved 100% of the traffic to it. The old revision stays around for a quick rollback.", "☁️ Cloud Run");
      }
    }
    if (next !== phaseRef.current) {
      phaseRef.current = next;
      setPhase(next);
      if (next === "3" || next === "2" || next === "1") sfx.click();
      if (next === "rise") sfx.bus();
    }
    if (capsule.current) capsule.current.position.y = y;
    const lift = y - dock;
    if (trail.current) {
      trail.current.visible = lift > 0.05;
      trail.current.scale.y = Math.max(0.01, lift);
      trail.current.position.y = dock - 0.6 + lift / 2;
    }
    if (trailMat.current) trailMat.current.opacity = Math.min(0.6, lift * 0.4) * (e > 5.6 ? 0.5 : 1);
    beacons.current.forEach((m, i) => {
      if (!m) return;
      const counting = e >= 0 && e < 3;
      const chase = counting ? (Math.floor(t * 8) % 4 === i ? 2.6 : 0.4) : e >= 3 ? 2.4 : 0.8 + Math.sin(t * 2 + i * 1.6) * 0.5;
      m.emissiveIntensity = chase;
    });
  });

  const service = "portfolio";
  const rev = `${service}-${String(revision).padStart(5, "0")}-${["kx7", "q2m", "t9d", "b4w"][revision % 4]}`;
  const { texture } = useCanvas(
    560,
    330,
    (ctx, cw, ch) => {
      ctx.fillStyle = "#202124";
      ctx.fillRect(0, 0, cw, ch);
      GOOGLE.forEach((c, i) => box(ctx, (i * cw) / 4, 0, cw / 4, 10, 0, c));
      ctx.font = font(22);
      ctx.fillStyle = "#9aa0a6";
      ctx.fillText(`$ gcloud run deploy ${service} --source .`, 20, 50);
      if (phase === "idle") {
        ctx.fillStyle = "#e8eaed";
        ctx.font = font(30, "700");
        ctx.fillText("Ready to deploy", 20, 130);
        ctx.font = font(22);
        ctx.fillStyle = "#9aa0a6";
        wrap(ctx, `Serving revision ${service}-${String(revision).padStart(5, "0")} · region europe-west1`, 20, 180, cw - 40, 30);
      } else if (phase === "rise") {
        ctx.fillStyle = "#8ab4f8";
        ctx.font = font(26, "700");
        ["✓ Building Container", "✓ Creating Revision", "… Routing traffic"].forEach((l, i) => ctx.fillText(l, 20, 120 + i * 46));
      } else if (phase === "live") {
        ctx.fillStyle = "#81c995";
        ctx.font = font(36, "800");
        ctx.fillText("Revision live ✓", 20, 120);
        ctx.font = font(21);
        ctx.fillStyle = "#e8eaed";
        wrap(ctx, `Service [${service}] revision [${rev}] has been deployed and is serving 100 percent of traffic.`, 20, 170, cw - 40, 30);
        ctx.fillStyle = "#8ab4f8";
        ctx.fillText(`https://${service}-…-ew.a.run.app`, 20, 300);
      } else {
        ctx.fillStyle = "#fbbc05";
        ctx.font = font(150, "800");
        ctx.fillText(phase, cw / 2 - 40, 250);
      }
    },
    `${phase}|${revision}`,
  );

  const steel = flat("#9aa0a6", 0.35, 0.8);
  const railTop = peak + 1.0;
  const consoleX = Math.min(2.4, w / 2 - 0.6);
  return (
    <group onClick={(e) => clicked(e) && deploy()} {...pointer}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.7, 0.6, 1.7]} position={[0, 0.6, 0]} />
      </RigidBody>
      {/* The pad */}
      <mesh position={[0, 0.12, 0]} material={flat("#3c4043", 0.5, 0.4)} castShadow receiveShadow>
        <cylinderGeometry args={[1.75, 1.85, 0.24, 48]} />
      </mesh>
      <mesh position={[0, 0.242, 0]} rotation-x={-Math.PI / 2} material={flat("#5f6368", 0.6, 0.3)} receiveShadow>
        <circleGeometry args={[1.62, 48]} />
      </mesh>
      {GOOGLE.map((c, i) => (
        <mesh key={c} position={[0, 0.246, 0]} rotation-x={-Math.PI / 2} rotation-z={(i * Math.PI) / 2} material={flat(c, 0.4, 0, c, 0.8)}>
          <ringGeometry args={[1.2, 1.32, 24, 1, 0.1, Math.PI / 2 - 0.2]} />
        </mesh>
      ))}
      <Text position={[0, 0.25, 0.8]} rotation-x={-Math.PI / 2} fontSize={0.2} color="#e8eaed" anchorX="center" anchorY="middle">
        CLOUD RUN
      </Text>
      {/* Four beacons, one per color */}
      {GOOGLE.map((c, i) => {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        return (
          <group key={c} position={[Math.cos(a) * 1.5, 0.24, Math.sin(a) * 1.5]}>
            <mesh position={[0, 0.45, 0]} material={steel} castShadow>
              <cylinderGeometry args={[0.05, 0.07, 0.9, 12]} />
            </mesh>
            <mesh position={[0, 0.98, 0]}>
              <sphereGeometry args={[0.15, 18, 14]} />
              <meshStandardMaterial
                ref={(m) => {
                  beacons.current[i] = m;
                }}
                color={c}
                emissive={c}
                emissiveIntensity={0.8}
                roughness={0.25}
              />
            </mesh>
            <mesh position={[0, 0.88, 0]} material={steel}>
              <cylinderGeometry args={[0.12, 0.12, 0.05, 16]} />
            </mesh>
          </group>
        );
      })}
      {/* The rails and their braces */}
      {[-0.68, 0.68].map((x) => (
        <mesh key={x} position={[x, 0.24 + (railTop - 0.24) / 2, -0.15]} material={steel} castShadow>
          <boxGeometry args={[0.1, railTop - 0.24, 0.12]} />
        </mesh>
      ))}
      {[1.6, 2.8, 4.0].filter((y) => y < railTop - 0.3).map((y) => (
        <mesh key={y} position={[0, y, -0.24]} material={steel}>
          <boxGeometry args={[1.36, 0.06, 0.06]} />
        </mesh>
      ))}
      <mesh position={[0, railTop, -0.15]} material={flat(palette.main, 0.3, 0.3, palette.main, 1.2)}>
        <boxGeometry args={[1.5, 0.1, 0.18]} />
      </mesh>
      {/* The light trail and the capsule */}
      <mesh ref={trail} position={[0, dock, 0]} visible={false}>
        <cylinderGeometry args={[0.3, 0.12, 1, 20, 1, true]} />
        <meshBasicMaterial ref={trailMat} color="#8ab4f8" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </mesh>
      <group ref={capsule} position={[0, dock, 0]}>
        <mesh material={flat(palette.main, 0.35, 0.3)} castShadow>
          <capsuleGeometry args={[0.45, 0.7, 8, 24]} />
        </mesh>
        {[-0.25, 0.25].map((y) => (
          <mesh key={y} position={[0, y, 0]} rotation-x={Math.PI / 2} material={flat("#ffffff", 0.4)}>
            <torusGeometry args={[0.455, 0.03, 8, 32]} />
          </mesh>
        ))}
        {[-0.16, -0.05, 0.05, 0.16].map((x) => (
          <mesh key={x} position={[x, 0, 0.44]} material={flat("#2b62c8", 0.4, 0.3)}>
            <boxGeometry args={[0.04, 0.4, 0.04]} />
          </mesh>
        ))}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.56, 0, -0.1]} material={steel}>
            <boxGeometry args={[0.16, 0.3, 0.14]} />
          </mesh>
        ))}
        <mesh position={[0, -0.85, 0]} material={flat("#e8eaed", 0.3, 0.7, "#8ab4f8", phase === "rise" ? 2 : 0.2)}>
          <cylinderGeometry args={[0.18, 0.26, 0.12, 20]} />
        </mesh>
      </group>
      {/* The console */}
      <group position={[consoleX, 0, 1.3]} rotation-y={-0.4}>
        <mesh position={[0, 0.5, 0]} material={flat(palette.ink, 0.4, 0.3)} castShadow>
          <boxGeometry args={[0.5, 1.0, 0.4]} />
        </mesh>
        <group position={[0, 1.2, 0]} rotation-x={-0.25}>
          <mesh position={[0, 0, -0.03]} material={flat(palette.ink, 0.4, 0.3)}>
            <boxGeometry args={[0.98, 0.62, 0.06]} />
          </mesh>
          <mesh>
            <planeGeometry args={[0.9, 0.54]} />
            <meshBasicMaterial map={texture} toneMapped={false} />
          </mesh>
        </group>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.3, 0.6, 0.25]} position={[0, 0.6, 0]} />
        </RigidBody>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// GCP · Pub/Sub post office (room)
// ---------------------------------------------------------------------------

/**
 * A publisher's desk with a pneumatic terminal, a glass topic hub hanging overhead and three
 * subscriber mailboxes, all joined by tubes. E publishes: a capsule flies up to the topic, and
 * from there copies shoot down every tube at once (fan-out); each mailbox raises its flag.
 */
const SUBSCRIBERS = ["billing-sub", "email-sub", "analytics-sub"];

function PubSubPost({ w, d, toHouse, label }: SigProps) {
  const { plan, palette, accent } = useHouse();
  const sentAt = useRef(-10);
  const arrived = useRef(true);
  const [count, setCount] = useState(0);
  const pod = useRef<THREE.Mesh>(null);
  const copies = useRef<(THREE.Mesh | null)[]>([]);
  const flags = useRef<(THREE.Group | null)[]>([]);
  const { deskX, deskZ, mailX, zs, hub, curves } = useMemo(() => {
    const dx = -w / 2 + 1.25;
    const dz = -d / 2 + 1.0;
    const mx = w / 2 - 0.6;
    const boxes = SUBSCRIBERS.map((_, i) => -d / 2 + 1.0 + (i * (d - 3.6)) / 2);
    const h: V3 = [0.2, 2.95, -d / 2 + 1.6];
    const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const up = new THREE.CatmullRomCurve3([v(dx + 0.45, 1.2, dz), v(dx + 0.45, 2.5, dz), v(dx + 1.0, 2.95, dz + 0.2), v(h[0] - 0.35, h[1], h[2])]);
    const out = boxes.map((z) => new THREE.CatmullRomCurve3([v(h[0] + 0.35, h[1], h[2]), v((h[0] + mx) / 2, h[1] + 0.05, (h[2] + z) / 2), v(mx - 0.15, h[1] - 0.1, z), v(mx, 2.4, z), v(mx, 1.5, z)]));
    return { deskX: dx, deskZ: dz, mailX: mx, zs: boxes, hub: h, curves: { up, out } };
  }, [w, d]);

  const publish = () => {
    if (now() - sentAt.current < 2.4) return;
    sentAt.current = now();
    arrived.current = false;
    setCount((c) => c + 1);
    sfx.kick();
  };
  const where = useWorldPoint(toHouse, deskX + 0.4, deskZ + 1.2);
  useProximity({ id: "gcp-pubsub", label: "Publish", radius: 1.8, where, run: publish });

  useFrame((_, dt) => {
    const e = now() - sentAt.current;
    const p = new THREE.Vector3();
    if (pod.current) {
      pod.current.visible = e < 0.9;
      if (e < 0.9) pod.current.position.copy(curves.up.getPointAt(ease(e / 0.9), p));
    }
    copies.current.forEach((m, i) => {
      if (!m) return;
      const k = (e - 0.9) / 1.2;
      m.visible = k >= 0 && k < 1;
      if (m.visible) m.position.copy(curves.out[i].getPointAt(ease(k), p));
    });
    if (!arrived.current && e > 2.1) {
      arrived.current = true;
      sfx.chirp();
      zs.forEach((z) => burstAt(toHouse, mailX, 1.6, z, [accent, "#ffffff"], 8));
      toast(`One message, ${SUBSCRIBERS.length} subscriptions: Pub/Sub delivered a copy to each (fan-out). Every subscriber acks on its own, so a slow one never holds up the others.`, "📮 Pub/Sub");
    }
    flags.current.forEach((f) => {
      if (!f) return;
      const target = count > 0 && e >= 2.1 ? -Math.PI / 2 : 0;
      f.rotation.x += (target - f.rotation.x) * Math.min(1, dt * 8);
    });
  });

  const tube = useMemo(() => ({ color: "#bfe3ff", transparent: true, opacity: 0.35, roughness: 0.05, depthWrite: false }), []);
  const brass = flat("#c9a45a", 0.3, 0.8);
  const glowMat = flat(accent, 0.2, 0, accent, 2.2);
  return (
    <group>
      {/* Publisher desk with the pneumatic terminal */}
      <group position={[deskX, 0, deskZ]} onClick={(e) => clicked(e) && publish()} {...pointer}>
        <Desk width={1.5} depth={0.75} pedestal={false} />
        <mesh position={[0.45, 0.95, 0]} material={brass} castShadow>
          <cylinderGeometry args={[0.12, 0.14, 0.4, 20]} />
        </mesh>
        <mesh position={[-0.2, 0.8, 0.1]} material={flat(palette.ink, 0.4)} castShadow>
          <boxGeometry args={[0.36, 0.1, 0.24]} />
        </mesh>
        <mesh position={[-0.2, 0.87, 0.1]} material={flat("#ea4335", 0.35, 0, "#ea4335", 0.6)}>
          <cylinderGeometry args={[0.06, 0.06, 0.04, 20]} />
        </mesh>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.75, 0.4, 0.38]} position={[0, 0.4, 0]} />
        </RigidBody>
      </group>
      <NoteBoard
        position={[deskX + 0.3, 1.9, -d / 2 + 0.12]}
        width={Math.min(1.9, w / 2 - 0.3)}
        height={1.1}
        kicker={label}
        title="topic: orders"
        lines={[`message #${1041 + count}: { orderId: ${1041 + count} }`, "attributes: { type: 'order.created' }", `${SUBSCRIBERS.length} subscriptions, a copy each`]}
        current={count > 0 ? 0 : -1}
      />
      {/* The topic hub */}
      <mesh position={[hub[0], (hub[1] + plan.H) / 2, hub[2]]} material={brass}>
        <cylinderGeometry args={[0.015, 0.015, plan.H - hub[1], 6]} />
      </mesh>
      <mesh position={hub}>
        <sphereGeometry args={[0.38, 24, 18]} />
        <meshStandardMaterial {...tube} opacity={0.5} />
      </mesh>
      <mesh position={hub} material={glowMat}>
        <sphereGeometry args={[0.12, 14, 10]} />
      </mesh>
      <Text position={[hub[0], hub[1] - 0.55, hub[2]]} fontSize={0.13} color={palette.ink} anchorX="center" anchorY="middle" outlineWidth={0.006} outlineColor="#ffffff">
        topic: orders
      </Text>
      {/* Tubes */}
      {[curves.up, ...curves.out].map((c, i) => (
        <mesh key={i}>
          <tubeGeometry args={[c, 48, 0.07, 10, false]} />
          <meshStandardMaterial {...tube} />
        </mesh>
      ))}
      <mesh ref={pod} material={glowMat} visible={false}>
        <capsuleGeometry args={[0.05, 0.12, 4, 10]} />
      </mesh>
      {SUBSCRIBERS.map((_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            copies.current[i] = m;
          }}
          material={glowMat}
          visible={false}
        >
          <capsuleGeometry args={[0.05, 0.12, 4, 10]} />
        </mesh>
      ))}
      {/* The subscribers' mailboxes */}
      {SUBSCRIBERS.map((name, i) => (
        <group key={name} position={[mailX, 0, zs[i]]} rotation-y={-Math.PI / 2}>
          <mesh position={[0, 0.55, 0]} material={flat("#3c4043", 0.5, 0.5)} castShadow>
            <boxGeometry args={[0.08, 1.1, 0.08]} />
          </mesh>
          <mesh position={[0, 1.22, 0]} material={flat(palette.main, 0.4, 0.2)} castShadow>
            <boxGeometry args={[0.46, 0.26, 0.6]} />
          </mesh>
          <mesh position={[0, 1.35, 0]} rotation-x={Math.PI / 2} material={flat(palette.main, 0.4, 0.2)}>
            <cylinderGeometry args={[0.23, 0.23, 0.6, 20, 1, false, 0, Math.PI]} />
          </mesh>
          <mesh position={[0, 1.3, 0.305]} material={flat("#2b62c8", 0.4)}>
            <boxGeometry args={[0.38, 0.3, 0.02]} />
          </mesh>
          <Text position={[0, 1.24, 0.32]} fontSize={0.06} color="#ffffff" anchorX="center" anchorY="middle">
            {name}
          </Text>
          <group
            ref={(g) => {
              flags.current[i] = g;
            }}
            position={[0.24, 1.25, -0.1]}
          >
            <mesh position={[0, 0, 0.18]} rotation-x={Math.PI / 2} material={flat("#3c4043", 0.5, 0.5)}>
              <boxGeometry args={[0.02, 0.36, 0.03]} />
            </mesh>
            <mesh position={[0, 0.06, 0.32]} material={flat("#ea4335", 0.4)}>
              <boxGeometry args={[0.02, 0.12, 0.1]} />
            </mesh>
          </group>
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider args={[0.25, 0.75, 0.32]} position={[0, 0.75, 0]} />
          </RigidBody>
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// cPanel · The icon kiosk (hero)
// ---------------------------------------------------------------------------

/**
 * A freestanding retro control panel: a cream wall on feet with an orange header and a grid of
 * big framed icon tiles, the way cPanel's home screen looks. Clicking a tile presses it in and
 * tells what that tool does; E opens the tiles one after another.
 */
type ToolIcon = "folder" | "mail" | "db" | "globe" | "lock" | "clock" | "box" | "php";
const CPANEL_TOOLS: { name: string; icon: ToolIcon; info: string }[] = [
  { name: "File Manager", icon: "folder", info: "Browse, upload, edit and set permissions on your files, with public_html as the site's web root." },
  { name: "Email Accounts", icon: "mail", info: "Create mailboxes like hello@example.com, with webmail and the IMAP/SMTP settings for any mail app." },
  { name: "MySQL Databases", icon: "db", info: "Create a database and a user, then add the user to the database with the privileges it needs." },
  { name: "Domains", icon: "globe", info: "Add domains and subdomains, each pointing to its own document root folder." },
  { name: "SSL/TLS", icon: "lock", info: "Manage certificates for HTTPS. AutoSSL issues free certificates and renews them before they expire." },
  { name: "Cron Jobs", icon: "clock", info: "Run commands on a schedule: 0 3 * * * runs a backup script every day at 3 am." },
  { name: "Backup", icon: "box", info: "Download a full account backup or just your home directory, databases or email forwarders." },
  { name: "MultiPHP Manager", icon: "php", info: "Pick the PHP version per domain, e.g. PHP 8.3 for a modern Laravel or WordPress site." },
];

function drawToolIcon(ctx: CanvasRenderingContext2D, icon: ToolIcon, cx: number, cy: number, s: number, color: string) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = s * 0.09;
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (icon === "folder") {
    box(ctx, cx - s * 0.5, cy - s * 0.38, s * 0.42, s * 0.2, s * 0.05, color);
    box(ctx, cx - s * 0.5, cy - s * 0.28, s, s * 0.66, s * 0.06, color);
  } else if (icon === "mail") {
    ctx.strokeRect(cx - s * 0.5, cy - s * 0.34, s, s * 0.68);
    ctx.moveTo(cx - s * 0.5, cy - s * 0.34);
    ctx.lineTo(cx, cy + s * 0.08);
    ctx.lineTo(cx + s * 0.5, cy - s * 0.34);
    ctx.stroke();
  } else if (icon === "db") {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(cx, cy - s * 0.3 + i * s * 0.3, s * 0.42, s * 0.13, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (icon === "globe") {
    ctx.arc(cx, cy, s * 0.45, 0, Math.PI * 2);
    ctx.moveTo(cx - s * 0.45, cy);
    ctx.lineTo(cx + s * 0.45, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy, s * 0.2, s * 0.45, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (icon === "lock") {
    ctx.arc(cx, cy - s * 0.12, s * 0.24, Math.PI, 0);
    ctx.stroke();
    box(ctx, cx - s * 0.38, cy - s * 0.12, s * 0.76, s * 0.56, s * 0.06, color);
  } else if (icon === "clock") {
    ctx.arc(cx, cy, s * 0.45, 0, Math.PI * 2);
    ctx.moveTo(cx, cy - s * 0.3);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + s * 0.22, cy + s * 0.12);
    ctx.stroke();
  } else if (icon === "box") {
    box(ctx, cx - s * 0.5, cy - s * 0.38, s, s * 0.2, s * 0.04, color);
    ctx.strokeRect(cx - s * 0.44, cy - s * 0.14, s * 0.88, s * 0.52);
    box(ctx, cx - s * 0.14, cy - s * 0.04, s * 0.28, s * 0.1, s * 0.04, color);
  } else {
    ctx.ellipse(cx, cy, s * 0.52, s * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = font(s * 0.3, "800");
    ctx.textAlign = "center";
    ctx.fillText("php", cx, cy + s * 0.1);
    ctx.textAlign = "left";
  }
}

function ToolTile({ tool, index, at, press, width, height, onPress }: { tool: (typeof CPANEL_TOOLS)[number]; index: number; at: V3; press: { index: number; n: number }; width: number; height: number; onPress: (i: number) => void }) {
  const { palette, accent } = useHouse();
  const on = press.index === index;
  const face = useRef<THREE.Group>(null);
  const seen = useRef(0);
  const pressedAt = useRef(-10);
  const { texture } = useCanvas(
    320,
    Math.round((320 * height) / width),
    (ctx, cw, ch) => {
      ctx.fillStyle = on ? "#fff0e6" : "#ffffff";
      ctx.fillRect(0, 0, cw, ch);
      drawToolIcon(ctx, tool.icon, cw / 2, ch * 0.4, ch * 0.42, on ? accent : "#2a6db0");
      ctx.fillStyle = palette.ink;
      ctx.font = font(30, "700");
      ctx.textAlign = "center";
      ctx.fillText(tool.name, cw / 2, ch - 30);
      ctx.textAlign = "left";
    },
    `${on}|${accent}`,
  );
  useFrame(() => {
    if (on && press.n !== seen.current) {
      seen.current = press.n;
      pressedAt.current = now();
    }
    const k = (now() - pressedAt.current) / 0.35;
    if (face.current) face.current.position.z = k < 1 ? -0.04 * Math.sin(k * Math.PI) : 0;
  });
  return (
    <group position={at} onClick={(e) => clicked(e) && onPress(index)} {...pointer}>
      <mesh position={[0, 0, -0.03]} material={flat(on ? accent : "#c9bfb2", 0.5, 0.1)} castShadow>
        <boxGeometry args={[width + 0.08, height + 0.08, 0.06]} />
      </mesh>
      <group ref={face}>
        <mesh position={[0, 0, 0.01]} material={flat("#efe7dc", 0.6)}>
          <boxGeometry args={[width, height, 0.03]} />
        </mesh>
        <mesh position={[0, 0, 0.027]}>
          <planeGeometry args={[width - 0.04, height - 0.04]} />
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

function IconKiosk({ w, d, toHouse }: SigProps) {
  const { palette, accent } = useHouse();
  const [press, setPress] = useState({ index: -1, n: 0 });
  const open = (i: number) => {
    setPress((p) => ({ index: i, n: p.n + 1 }));
    sfx.click();
    const t = CPANEL_TOOLS[i];
    toast(t.info, `🧰 ${t.name}`);
  };
  const where = useWorldPoint(toHouse, 0, Math.min(d / 2 - 0.4, 2.2));
  useProximity({ id: "cpanel-icons", label: press.index < 0 ? "Open a tool" : "Open the next tool", radius: 2.3, where, run: () => open((press.index + 1) % CPANEL_TOOLS.length) });

  const kw = Math.min(w - 1, 4.6);
  const cols = 4;
  const tw = (kw - 0.4) / cols - 0.1;
  const th = 0.74;
  const cream = flat(palette.paper, 0.7);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[kw / 2 + 0.1, 1.5, 0.4]} position={[0, 1.5, -0.05]} />
      </RigidBody>
      {/* Feet, the wall and its header */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (kw / 2 - 0.3), 0.06, 0]} material={flat(palette.ink, 0.5, 0.3)} castShadow>
          <boxGeometry args={[0.5, 0.12, 0.8]} />
        </mesh>
      ))}
      <mesh position={[0, 1.55, -0.12]} material={cream} castShadow receiveShadow>
        <boxGeometry args={[kw + 0.2, 2.9, 0.22]} />
      </mesh>
      <mesh position={[0, 0.16, -0.12]} material={flat(accent, 0.4)}>
        <boxGeometry args={[kw + 0.24, 0.08, 0.26]} />
      </mesh>
      <mesh position={[0, 2.78, -0.005]} material={flat(accent, 0.45)}>
        <boxGeometry args={[kw + 0.2, 0.44, 0.02]} />
      </mesh>
      <Text position={[-kw / 2 + 0.12, 2.78, 0.01]} fontSize={0.3} color="#ffffff" anchorX="left" anchorY="middle">
        cPanel
      </Text>
      <Text position={[kw / 2 - 0.12, 2.78, 0.01]} fontSize={0.11} color="#ffffff" anchorX="right" anchorY="middle">
        Tools · click a tile
      </Text>
      {CPANEL_TOOLS.map((t, i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);
        const x = -kw / 2 + 0.2 + (c + 0.5) * (tw + 0.1);
        return <ToolTile key={t.name} tool={t} index={i} at={[x, 2.05 - r * (th + 0.16), 0.02]} press={press} width={tw} height={th} onPress={open} />;
      })}
      <mesh position={[0, 0.85, 0.0]} material={flat("#e6dccd", 0.7)}>
        <boxGeometry args={[kw - 0.2, 0.3, 0.02]} />
      </mesh>
      <Text position={[0, 0.85, 0.02]} fontSize={0.09} color={palette.ink} anchorX="center" anchorY="middle" maxWidth={kw - 0.4}>
        {press.index < 0 ? "Hosting control panel · pick a tool" : `${CPANEL_TOOLS[press.index].name} opened`}
      </Text>
    </group>
  );
}

// ---------------------------------------------------------------------------
// cPanel · The File Manager (room)
// ---------------------------------------------------------------------------

/**
 * Steel filing cabinets along the back wall, one per folder of a hosting account: public_html,
 * mail, logs and backups. Click a drawer (or press E) and it slides out while the board above
 * lists that folder: names, sizes and Unix permissions.
 */
type HostFile = { perm: string; mode: string; name: string; size: string };
const HOST_FOLDERS: { name: string; path: string; files: HostFile[] }[] = [
  {
    name: "public_html",
    path: "/home/wouroud/public_html",
    files: [
      { perm: "drwxr-xr-x", mode: "755", name: "assets/", size: "4 KB" },
      { perm: "drwxr-xr-x", mode: "755", name: "wp-content/", size: "4 KB" },
      { perm: "-rw-r--r--", mode: "644", name: "index.php", size: "405 B" },
      { perm: "-rw-r--r--", mode: "644", name: ".htaccess", size: "1.2 KB" },
      { perm: "-rw-r--r--", mode: "644", name: "robots.txt", size: "68 B" },
      { perm: "-rw-r--r--", mode: "644", name: "favicon.ico", size: "15 KB" },
    ],
  },
  {
    name: "mail",
    path: "/home/wouroud/mail/example.com/hello",
    files: [
      { perm: "drwx------", mode: "700", name: "cur/", size: "4 KB" },
      { perm: "drwx------", mode: "700", name: "new/", size: "4 KB" },
      { perm: "drwx------", mode: "700", name: "tmp/", size: "4 KB" },
      { perm: "-rw-------", mode: "600", name: "maildirsize", size: "312 B" },
      { perm: "-rw-------", mode: "600", name: "dovecot.index.cache", size: "18 KB" },
    ],
  },
  {
    name: "logs",
    path: "/home/wouroud/logs",
    files: [
      { perm: "-rw-r--r--", mode: "644", name: "example.com-Oct-2026.gz", size: "1.8 MB" },
      { perm: "-rw-r--r--", mode: "644", name: "example.com-ssl_log-Oct-2026.gz", size: "212 KB" },
      { perm: "-rw-r--r--", mode: "644", name: "example.com-Sep-2026.gz", size: "2.1 MB" },
      { perm: "-rw-r--r--", mode: "644", name: "ftp.example.com-ftp_log-Oct-2026.gz", size: "3.4 KB" },
    ],
  },
  {
    name: "backups",
    path: "/home/wouroud/backups",
    files: [
      { perm: "-rw-------", mode: "600", name: "backup-10.15.2026_02-00-01_wouroud.tar.gz", size: "486 MB" },
      { perm: "-rw-------", mode: "600", name: "backup-10.08.2026_02-00-01_wouroud.tar.gz", size: "479 MB" },
      { perm: "-rw-r--r--", mode: "644", name: "example_wp.sql.gz", size: "12 MB" },
      { perm: "drwxr-xr-x", mode: "755", name: "uploads-archive/", size: "4 KB" },
    ],
  },
];
const DRAWERS = 3;

function Drawer({ open, y, onClick }: { open: boolean; y: number; onClick: () => void }) {
  const tray = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!tray.current) return;
    const target = open ? 0.42 : 0;
    tray.current.position.z += (target - tray.current.position.z) * Math.min(1, dt * 7);
  });
  const steel = flat("#d3d6da", 0.4, 0.6);
  return (
    <group ref={tray} position={[0, y, 0]} onClick={(e) => clicked(e) && onClick()} {...pointer}>
      <mesh position={[0, 0, 0.315]} material={steel} castShadow>
        <boxGeometry args={[0.5, 0.36, 0.03]} />
      </mesh>
      <mesh position={[0, -0.06, 0.34]} material={flat("#7b8088", 0.3, 0.9)}>
        <boxGeometry args={[0.2, 0.03, 0.03]} />
      </mesh>
      <mesh position={[0, 0.09, 0.332]} material={flat("#fffdf6", 0.8)}>
        <boxGeometry args={[0.16, 0.07, 0.005]} />
      </mesh>
      {/* The tray and its hanging folders, seen when it's open */}
      <mesh position={[0, -0.05, 0.03]} material={flat("#b9bdc3", 0.5, 0.5)}>
        <boxGeometry args={[0.46, 0.24, 0.54]} />
      </mesh>
      {[-0.12, 0.02, 0.16].map((z, i) => (
        <mesh key={z} position={[0, 0.1, z]} material={flat(["#f3d38b", "#f7e2ad", "#e9c46a"][i], 0.8)}>
          <boxGeometry args={[0.42, 0.06, 0.012]} />
        </mesh>
      ))}
    </group>
  );
}

function FileRoom({ w, d, toHouse, label }: SigProps) {
  const { palette, accent } = useHouse();
  const [open, setOpen] = useState<{ cab: number; drawer: number } | null>(null);
  const pull = (cab: number, drawer: number) => {
    setOpen((o) => (o && o.cab === cab && o.drawer === drawer ? null : { cab, drawer }));
    sfx.clunk();
  };
  const where = useWorldPoint(toHouse, 0, -d / 2 + 2.0);
  useProximity({ id: "cpanel-files", label: "Open the next folder", radius: 1.9, where, run: () => pull(open ? (open.cab + 1) % HOST_FOLDERS.length : 0, 0) });

  const gap = Math.min(0.8, (w - 1.0) / HOST_FOLDERS.length);
  const bw = Math.min(w - 1, 3.4);
  const bh = 1.4;
  const folder = open ? HOST_FOLDERS[open.cab] : null;
  const { texture } = useCanvas(
    1024,
    Math.round((1024 * bh) / bw),
    (ctx, cw, ch) => {
      ctx.fillStyle = "#1d1f24";
      ctx.fillRect(0, 0, cw, ch);
      box(ctx, 0, 0, cw, 64, 0, accent);
      ctx.fillStyle = "#ffffff";
      ctx.font = font(32, "700");
      ctx.fillText(`${label} · ${folder ? folder.path : "pick a drawer"}`, 24, 44);
      const files = folder?.files ?? [];
      ctx.font = font(24, "700");
      ctx.fillStyle = "#9aa0a6";
      ["Permissions", "Mode", "Name", "Size"].forEach((h, i) => ctx.fillText(h, [24, 210, 300, cw - 140][i], 104));
      const rowH = Math.min(48, (ch - 130) / Math.max(1, files.length));
      files.forEach((f, i) => {
        const y = 150 + i * rowH;
        if (i % 2 === 0) box(ctx, 12, y - rowH * 0.7, cw - 24, rowH, 6, "#262a31");
        ctx.font = font(24);
        ctx.fillStyle = "#86efac";
        ctx.fillText(f.perm, 24, y);
        ctx.fillStyle = "#fbbf24";
        ctx.fillText(f.mode, 210, y);
        ctx.fillStyle = f.name.endsWith("/") ? "#93c5fd" : "#e5e7eb";
        let name = f.name;
        while (ctx.measureText(name).width > cw - 480 && name.length > 4) name = name.slice(0, -2);
        ctx.fillText(name === f.name ? name : `${name}…`, 300, y);
        ctx.fillStyle = "#cbd5e1";
        ctx.fillText(f.size, cw - 140, y);
      });
      if (!folder) {
        ctx.fillStyle = "#cbd5e1";
        ctx.font = font(30);
        wrap(ctx, "Click a drawer to list a folder. 644 = owner writes, everyone reads (files); 755 = owner writes, everyone can enter (folders).", 24, 170, cw - 48, 42);
      }
    },
    `${open?.cab ?? -1}|${accent}|${label}`,
  );
  return (
    <group>
      <Panel position={[0, 2.35, -d / 2 + 0.12]} width={bw} height={bh} map={texture} frame={palette.ink} />
      {HOST_FOLDERS.map((f, c) => {
        const x = (c - (HOST_FOLDERS.length - 1) / 2) * gap;
        return (
          <group key={f.name} position={[x, 0, -d / 2 + 0.46]}>
            <mesh position={[0, 0.66, -0.01]} material={flat("#aeb3ba", 0.45, 0.6)} castShadow receiveShadow>
              <boxGeometry args={[0.55, 1.32, 0.62]} />
            </mesh>
            <mesh position={[0, 1.33, 0]} material={flat("#8d939b", 0.4, 0.6)}>
              <boxGeometry args={[0.57, 0.03, 0.64]} />
            </mesh>
            {Array.from({ length: DRAWERS }, (_, k) => (
              <Drawer key={k} y={1.1 - k * 0.41} open={open?.cab === c && open.drawer === k} onClick={() => pull(c, k)} />
            ))}
            <Text position={[0, 1.42, 0.2]} fontSize={0.075} color={palette.ink} anchorX="center" anchorY="middle" outlineWidth={0.004} outlineColor="#ffffff">
              {f.name}
            </Text>
            <mesh position={[0, 1.42, 0.18]} rotation-x={-0.3} material={flat(open?.cab === c ? accent : palette.paper, 0.7)}>
              <boxGeometry args={[0.46, 0.12, 0.01]} />
            </mesh>
            <RigidBody type="fixed" colliders={false}>
              <CuboidCollider args={[0.28, 0.66, 0.32]} position={[0, 0.66, 0]} />
            </RigidBody>
          </group>
        );
      })}
      <Rug position={[0, -d / 2 + 2.1]} width={Math.min(w - 1.4, 3)} depth={1.8} color={palette.second} border={accent} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// aaPanel · The Nginx intersection (hero)
// ---------------------------------------------------------------------------

/**
 * A table-top road model: requests drive in as little cars, and at the intersection Nginx sends
 * them in turn to two upstream gates, app:3000 and app:3001, with a counter over each. E runs
 * `nginx -s reload`: the lights cycle, the counters reset, and traffic carries on round robin.
 */
const CAR_COLORS = ["#ef4444", "#3b82f6", "#f59e0b", "#e5e7eb", "#8b5cf6", "#22c55e"];
type Light = "red" | "yellow" | "green";

function NginxCrossing({ w, d, toHouse }: SigProps) {
  const { palette, accent } = useHouse();
  const pw = Math.min(w - 1, 5.6);
  const pd = Math.min(d - 2.6, 3.4);
  const top = 0.72;
  const roadZ = -0.3;
  const gateX = pw / 2 - 0.45;
  const [counts, setCounts] = useState<[number, number]>([0, 0]);
  const [light, setLight] = useState<Light>("green");
  const lightRef = useRef<Light>("green");
  const reloadAt = useRef(-10);
  const rr = useRef(0);
  const cars = useRef(CAR_COLORS.map((_, i) => ({ t: i / CAR_COLORS.length, side: i % 2 })));
  const carMeshes = useRef<(THREE.Group | null)[]>([]);
  const lamps = useRef<(THREE.MeshStandardMaterial | null)[]>([]);

  const routes = useMemo(
    () =>
      [-1, 1].map(
        (s) =>
          new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, top, pd / 2 - 0.1),
            new THREE.Vector3(0, top, roadZ + 0.6),
            new THREE.Vector3(s * 0.3, top, roadZ + 0.05),
            new THREE.Vector3(s * 0.8, top, roadZ),
            new THREE.Vector3(s * (gateX + 0.2), top, roadZ),
          ]),
      ),
    [pd, gateX, roadZ],
  );

  const reload = () => {
    if (now() - reloadAt.current < 1.8) return;
    reloadAt.current = now();
    lightRef.current = "red";
    setLight("red");
    setCounts([0, 0]);
    sfx.click();
  };
  const where = useWorldPoint(toHouse, 0, Math.min(d / 2 - 0.4, pd / 2 + 0.9));
  useProximity({ id: "aapanel-nginx", label: "nginx -s reload", radius: 2.2, where, run: reload });

  useFrame((_, dt) => {
    const e = now() - reloadAt.current;
    const next: Light = e < 0.9 ? "red" : e < 1.5 ? "yellow" : "green";
    if (next !== lightRef.current) {
      lightRef.current = next;
      setLight(next);
      if (next === "green") {
        sfx.chirp();
        toast("Reloaded without dropping a request: old workers finish their connections while new ones read the config. upstream app { server app:3000; server app:3001; } shares the traffic round robin.", "🚦 nginx -s reload");
      }
    }
    const go = lightRef.current === "green";
    const p = new THREE.Vector3();
    const tan = new THREE.Vector3();
    cars.current.forEach((car, i) => {
      if (go) car.t += dt * 0.16;
      if (car.t >= 1) {
        car.t -= 1;
        const side = car.side;
        setCounts((c) => (side ? [c[0], c[1] + 1] : [c[0] + 1, c[1]]));
        car.side = rr.current++ % 2;
      }
      const g = carMeshes.current[i];
      if (!g) return;
      const route = routes[car.side];
      route.getPointAt(car.t, p);
      route.getTangentAt(car.t, tan);
      g.position.copy(p);
      g.rotation.y = Math.atan2(tan.x, tan.z);
      g.visible = car.t < 0.97;
    });
    lamps.current.forEach((m, i) => {
      if (m) m.emissiveIntensity = (["red", "yellow", "green"] as Light[])[i] === lightRef.current ? 2.4 : 0.08;
    });
  });

  const asphalt = flat("#2d3436", 0.85);
  const road = flat("#4b5563", 0.8);
  const white = flat("#f8fafc", 0.6);
  const steel = flat("#6b7280", 0.4, 0.7);
  const signZ = -pd / 2 - 0.25;
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[pw / 2 + 0.1, 0.4, pd / 2 + 0.1]} position={[0, 0.4, 0]} />
      </RigidBody>
      {/* The model table */}
      <mesh position={[0, 0.34, 0]} material={flat(palette.ink, 0.6, 0.2)} castShadow receiveShadow>
        <boxGeometry args={[pw, 0.68, pd]} />
      </mesh>
      <mesh position={[0, 0.69, 0]} material={flat(accent, 0.4)}>
        <boxGeometry args={[pw + 0.06, 0.04, pd + 0.06]} />
      </mesh>
      <mesh position={[0, 0.712, 0]} material={asphalt} receiveShadow>
        <boxGeometry args={[pw - 0.1, 0.01, pd - 0.1]} />
      </mesh>
      {/* Roads and lane marks */}
      <mesh position={[0, 0.718, (pd / 2 + roadZ) / 2]} material={road}>
        <boxGeometry args={[0.42, 0.006, pd / 2 - roadZ - 0.06]} />
      </mesh>
      <mesh position={[0, 0.718, roadZ]} material={road}>
        <boxGeometry args={[pw - 0.3, 0.006, 0.42]} />
      </mesh>
      {Array.from({ length: 5 }, (_, i) => (
        <mesh key={`v${i}`} position={[0, 0.722, roadZ + 0.4 + i * ((pd / 2 - roadZ - 0.5) / 5)]} material={white}>
          <boxGeometry args={[0.03, 0.004, 0.14]} />
        </mesh>
      ))}
      {[-1, 1].flatMap((s) =>
        [0.7, 1.2, 1.7].filter((x) => x < gateX - 0.2).map((x) => (
          <mesh key={`${s}${x}`} position={[s * x, 0.722, roadZ]} material={white}>
            <boxGeometry args={[0.14, 0.004, 0.03]} />
          </mesh>
        )),
      )}
      <mesh position={[0, 0.722, roadZ + 0.32]} material={white}>
        <boxGeometry args={[0.4, 0.004, 0.04]} />
      </mesh>
      {/* The traffic light */}
      <group position={[0.42, top, roadZ + 0.5]}>
        <mesh position={[0, 0.35, 0]} material={steel}>
          <cylinderGeometry args={[0.02, 0.025, 0.7, 8]} />
        </mesh>
        <mesh position={[0, 0.8, 0]} material={flat("#111827", 0.5)} castShadow>
          <boxGeometry args={[0.14, 0.38, 0.12]} />
        </mesh>
        {(["#ef4444", "#facc15", "#22c55e"] as const).map((c, i) => (
          <mesh key={c} position={[0, 0.92 - i * 0.12, 0.062]}>
            <circleGeometry args={[0.04, 16]} />
            <meshStandardMaterial
              ref={(m) => {
                lamps.current[i] = m;
              }}
              color={c}
              emissive={c}
              emissiveIntensity={i === 2 ? 2.4 : 0.08}
            />
          </mesh>
        ))}
      </group>
      {/* The two upstream gates and their counters */}
      {[-1, 1].map((s, i) => (
        <group key={s} position={[s * gateX, top, roadZ]}>
          {[-0.26, 0.26].map((z) => (
            <mesh key={z} position={[0, 0.25, z]} material={steel}>
              <boxGeometry args={[0.05, 0.5, 0.05]} />
            </mesh>
          ))}
          <mesh position={[0, 0.52, 0]} material={flat(accent, 0.4)}>
            <boxGeometry args={[0.08, 0.06, 0.6]} />
          </mesh>
          <mesh position={[0, 0.82, 0]} material={flat(palette.ink, 0.5)}>
            <boxGeometry args={[0.7, 0.42, 0.04]} />
          </mesh>
          <Text position={[0, 0.9, 0.025]} fontSize={0.1} color={palette.paper} anchorX="center" anchorY="middle">
            {`app:${3000 + i}`}
          </Text>
          <Text position={[0, 0.74, 0.025]} fontSize={0.1} color={accent} anchorX="center" anchorY="middle">
            {`${counts[i]} req`}
          </Text>
        </group>
      ))}
      {/* Requests */}
      {CAR_COLORS.map((c, i) => (
        <group
          key={c}
          ref={(g) => {
            carMeshes.current[i] = g;
          }}
        >
          <mesh position={[0, 0.045, 0]} material={flat(c, 0.35, 0.3)} castShadow>
            <boxGeometry args={[0.13, 0.06, 0.26]} />
          </mesh>
          <mesh position={[0, 0.1, -0.02]} material={flat("#1f2937", 0.2, 0.4)}>
            <boxGeometry args={[0.11, 0.05, 0.13]} />
          </mesh>
        </group>
      ))}
      {/* The big nginx sign */}
      <group position={[0, 0, signZ]}>
        {[-1.3, 1.3].map((x) => (
          <mesh key={x} position={[x, 1.5, 0]} material={steel} castShadow>
            <boxGeometry args={[0.1, 3.0, 0.1]} />
          </mesh>
        ))}
        <mesh position={[0, 2.65, 0]} material={flat("#009639", 0.45)} castShadow>
          <boxGeometry args={[2.9, 0.8, 0.08]} />
        </mesh>
        <Text position={[0, 2.74, 0.05]} fontSize={0.42} color="#ffffff" anchorX="center" anchorY="middle">
          NGINX
        </Text>
        <Text position={[0, 2.38, 0.05]} fontSize={0.08} color="#d1fae5" anchorX="center" anchorY="middle">
          {`upstream app { server app:3000; server app:3001; }  ·  lights: ${light}`}
        </Text>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// aaPanel · The certificate wall (room)
// ---------------------------------------------------------------------------

/**
 * Framed Let's Encrypt certificates on the back wall, each with a bar of the days it has left,
 * and a console stand. E runs `certbot renew`: the certificates close to expiry are renewed (the
 * bars refill green) and the rest are left alone because they're not due yet.
 */
const CERTS = [
  { domain: "example.com", days: 12 },
  { domain: "api.example.com", days: 47 },
  { domain: "shop.example.com", days: 3 },
  { domain: "mail.example.com", days: 71 },
];
const barColor = (days: number) => (days < 15 ? "#ef4444" : days < 30 ? "#f59e0b" : "#22c55e");

function CertFrame({ domain, days, at, width }: { domain: string; days: number; at: V3; width: number }) {
  const { palette, accent } = useHouse();
  const height = width * 0.72;
  const bar = useRef<THREE.Mesh>(null);
  const barMat = useRef<THREE.MeshStandardMaterial>(null);
  const shown = useRef(days);
  const { texture } = useCanvas(
    480,
    346,
    (ctx, cw, ch) => {
      ctx.fillStyle = "#fbf8ef";
      ctx.fillRect(0, 0, cw, ch);
      ctx.strokeStyle = "#c8b98a";
      ctx.lineWidth = 6;
      ctx.strokeRect(14, 14, cw - 28, ch - 28);
      ctx.fillStyle = "#2c3e50";
      ctx.font = font(22, "700");
      ctx.fillText("CERTIFICATE · Let's Encrypt R11", 34, 58);
      ctx.fillStyle = palette.ink;
      ctx.font = font(34, "800");
      ctx.fillText(domain, 34, 120);
      ctx.font = font(22);
      ctx.fillStyle = "#475569";
      ctx.fillText("TLS · RSA 2048 · valid 90 days", 34, 160);
      ctx.fillStyle = barColor(days);
      ctx.font = font(30, "700");
      ctx.fillText(`${days} days left`, 34, 220);
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(cw - 80, ch - 80, 44, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = font(22, "800");
      ctx.textAlign = "center";
      ctx.fillText("SSL", cw - 80, ch - 72);
      ctx.textAlign = "left";
    },
    `${domain}|${days}|${accent}`,
  );
  useFrame((_, dt) => {
    shown.current += (days - shown.current) * Math.min(1, dt * 2.5);
    const k = Math.max(0.02, shown.current / 90);
    if (bar.current) {
      bar.current.scale.x = k;
      bar.current.position.x = (-(width - 0.08) / 2) * (1 - k);
    }
    barMat.current?.color.set(barColor(shown.current));
    barMat.current?.emissive.set(barColor(shown.current));
  });
  return (
    <group position={at}>
      <mesh position={[0, 0, -0.03]} material={flat("#5b4636", 0.5)} castShadow>
        <boxGeometry args={[width + 0.1, height + 0.1, 0.04]} />
      </mesh>
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      <mesh position={[0, -height / 2 - 0.16, -0.01]} material={flat("#1f2937", 0.6)}>
        <boxGeometry args={[width, 0.09, 0.02]} />
      </mesh>
      <mesh ref={bar} position={[0, -height / 2 - 0.16, 0.005]}>
        <boxGeometry args={[width - 0.08, 0.05, 0.01]} />
        <meshStandardMaterial ref={barMat} color={barColor(days)} emissive={barColor(days)} emissiveIntensity={0.7} />
      </mesh>
    </group>
  );
}

function CertificateWall({ w, d, toHouse, label }: SigProps) {
  const { palette, accent } = useHouse();
  const n = w > 5.4 ? 4 : 3;
  const [days, setDays] = useState(() => CERTS.slice(0, n).map((c) => c.days));
  const [ran, setRan] = useState(false);
  const renew = () => {
    const due = CERTS.slice(0, n).filter((_, i) => days[i] <= 30);
    setDays((ds) => ds.map((x) => (x <= 30 ? 90 : x)));
    setRan(true);
    sfx.chirp();
    burstAt(toHouse, 0, 1.9, -d / 2 + 0.4, ["#22c55e", accent, "#ffffff"], 18);
    toast(
      due.length
        ? `Congratulations, all renewals succeeded: ${due.map((c) => c.domain).join(", ")}. The others aren't due yet: certbot renews within 30 days of expiry.`
        : "No renewals were attempted: every certificate has more than 30 days left.",
      "🔒 certbot renew",
    );
  };
  const where = useWorldPoint(toHouse, 0, -d / 2 + 1.8);
  useProximity({ id: "aapanel-ssl", label: "certbot renew", radius: 1.8, where, run: renew });

  const fw = Math.min(0.95, (w - 1.0) / n - 0.15);
  const { texture } = useCanvas(
    512,
    300,
    (ctx, cw, ch) => {
      ctx.fillStyle = "#0b1410";
      ctx.fillRect(0, 0, cw, ch);
      ctx.font = font(22);
      ctx.fillStyle = "#86efac";
      ctx.fillText("$ sudo certbot renew", 18, 40);
      const lines = ran ? ["Renewing an existing certificate…", "Congratulations, all renewals", "succeeded.", `${days.filter((x) => x === 90).length} renewed · ${days.filter((x) => x !== 90).length} not yet due`] : [`${label}: ${n} certificates`, "Press E to renew the ones due", "(30 days or less left)"];
      ctx.fillStyle = "#d1fae5";
      lines.forEach((l, i) => ctx.fillText(l, 18, 90 + i * 40));
    },
    `${ran}|${days.join(",")}|${label}`,
  );
  return (
    <group>
      {CERTS.slice(0, n).map((c, i) => (
        <CertFrame key={c.domain} domain={c.domain} days={days[i]} width={fw} at={[(i - (n - 1) / 2) * (fw + 0.15), 1.8, -d / 2 + 0.14]} />
      ))}
      <Text position={[0, 2.55, -d / 2 + 0.13]} fontSize={0.16} color={palette.ink} anchorX="center" anchorY="middle" outlineWidth={0.006} outlineColor={palette.paper}>
        {label}
      </Text>
      {/* The console stand */}
      <group position={[-w / 2 + 0.6, 0, Math.max(-d / 2 + 1.7, d / 2 - 2.6)]} rotation-y={Math.PI / 2} onClick={(e) => clicked(e) && renew()} {...pointer}>
        <mesh position={[0, 0.5, 0]} material={flat("#1f2b22", 0.5, 0.4)} castShadow>
          <boxGeometry args={[0.45, 1.0, 0.4]} />
        </mesh>
        <mesh position={[0, 1.01, 0]} material={flat(accent, 0.4)}>
          <boxGeometry args={[0.5, 0.03, 0.45]} />
        </mesh>
        <group position={[0, 1.3, -0.05]} rotation-x={-0.2}>
          <mesh position={[0, 0, -0.02]} material={flat("#111", 0.5)}>
            <boxGeometry args={[0.66, 0.42, 0.04]} />
          </mesh>
          <mesh>
            <planeGeometry args={[0.6, 0.36]} />
            <meshBasicMaterial map={texture} toneMapped={false} />
          </mesh>
        </group>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.25, 0.55, 0.22]} position={[0, 0.55, 0]} />
        </RigidBody>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Figma · The multiplayer canvas (hero)
// ---------------------------------------------------------------------------

/**
 * A low white canvas platform with frames and shapes drawn on it, a few shapes standing on it,
 * and four colored cursors with name tags gliding around above it, the way collaborators move in a
 * shared Figma file. E (or a click on the canvas) drops a sticky note with a short comment.
 */
const FIGMA_CURSORS = [
  { name: "Wouroud", color: "#a259ff", fx: -0.25, fz: -0.1, rx: 0.2, rz: 0.22, speed: 0.33, phase: 0 },
  { name: "Omar", color: "#1abcfe", fx: 0.22, fz: -0.15, rx: 0.18, rz: 0.18, speed: 0.27, phase: 1.7 },
  { name: "Lina", color: "#0acf83", fx: 0.05, fz: 0.18, rx: 0.3, rz: 0.12, speed: 0.22, phase: 3.1 },
  { name: "Rami", color: "#f24e1e", fx: -0.1, fz: 0.05, rx: 0.34, rz: 0.25, speed: 0.18, phase: 4.4 },
];
const STICKY_SPOTS: [number, number][] = [
  [-0.32, 0.22],
  [0.28, -0.18],
  [0.04, 0.3],
  [-0.12, -0.26],
  [0.38, 0.2],
  [-0.4, -0.05],
];
const STICKY_NOTES = ["Love this layout!", "Try an 8px radius?", "Is the contrast AA?", "Use auto layout here", "Align to the 8pt grid", "Ship it!"];
const ARROW = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(0, -0.46);
  s.lineTo(0.11, -0.35);
  s.lineTo(0.2, -0.55);
  s.lineTo(0.28, -0.51);
  s.lineTo(0.19, -0.32);
  s.lineTo(0.34, -0.32);
  s.closePath();
  return s;
})();
const ARROW_EXTRUDE = { depth: 0.04, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.012, bevelSegments: 1 };

function StickyNote({ at, text, author, color }: { at: V3; text: string; author: string; color: string }) {
  const note = useRef<THREE.Group>(null);
  const bornAt = useRef(-1);
  useFrame(() => {
    if (bornAt.current < 0) bornAt.current = now();
    const k = ease((now() - bornAt.current) / 0.35);
    note.current?.scale.setScalar(0.01 + k * 0.99);
  });
  return (
    <group ref={note} position={at} rotation-x={-0.9}>
      <mesh position={[0, 0.21, 0]} material={flat("#ffd966", 0.85)} castShadow>
        <boxGeometry args={[0.44, 0.42, 0.012]} />
      </mesh>
      <Text position={[-0.19, 0.38, 0.008]} fontSize={0.035} color={color} anchorX="left" anchorY="middle">
        {author}
      </Text>
      <Text position={[0, 0.2, 0.008]} fontSize={0.05} color="#1e1e1e" anchorX="center" anchorY="middle" maxWidth={0.38} textAlign="center">
        {text}
      </Text>
    </group>
  );
}

function MultiplayerCanvas({ w, d, toHouse }: SigProps) {
  const { palette, accent } = useHouse();
  const pw = Math.min(w - 0.8, 8);
  const pd = Math.min(d - 2.2, 5.2);
  const [stickies, setStickies] = useState<number[]>([]);
  const dropped = useRef(0);
  const cursors = useRef<(THREE.Group | null)[]>([]);
  const drop = () => {
    const n = dropped.current++;
    setStickies((s) => [...s, n].slice(-STICKY_SPOTS.length));
    sfx.pop();
    const [fx, fz] = STICKY_SPOTS[n % STICKY_SPOTS.length];
    burstAt(toHouse, fx * pw, 0.5, fz * pd, ["#ffd966", accent], 10);
    if (n === 0) toast("Sticky dropped. Everyone in the file sees it at once: Figma syncs every change to all collaborators live.", "🗒️ Multiplayer");
  };
  const where = useWorldPoint(toHouse, 0, Math.min(d / 2 - 0.4, pd / 2 + 0.8));
  useProximity({ id: "figma-cursors", label: "Drop a sticky", radius: 2.4, where, run: drop });

  useFrame(() => {
    const t = now();
    FIGMA_CURSORS.forEach((c, i) => {
      const g = cursors.current[i];
      if (!g) return;
      const a = t * c.speed * Math.PI * 2 * 0.25 + c.phase;
      g.position.set((c.fx + Math.sin(a) * c.rx) * pw, 1.25 + Math.sin(a * 1.7 + i) * 0.25 + i * 0.12, (c.fz + Math.sin(a * 2 + c.phase) * c.rz) * pd);
      g.rotation.z = Math.sin(a * 1.3) * 0.12;
    });
  });

  const ch = Math.round((1024 * pd) / pw);
  const { texture } = useCanvas(
    1024,
    ch,
    (ctx, cw, h) => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, cw, h);
      ctx.fillStyle = "#d9d9d9";
      for (let x = 16; x < cw; x += 32) for (let y = 16; y < h; y += 32) ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
      const frames = [
        { name: "Home", x: 0.06, y: 0.12, w: 0.26, h: 0.62 },
        { name: "Profile", x: 0.38, y: 0.12, w: 0.26, h: 0.62 },
        { name: "Checkout", x: 0.7, y: 0.12, w: 0.24, h: 0.44 },
      ];
      frames.forEach((f, i) => {
        const x = f.x * cw;
        const y = f.y * h;
        const fw = f.w * cw;
        const fh = f.h * h;
        ctx.fillStyle = "#8a8a8a";
        ctx.font = font(22, "600");
        ctx.fillText(f.name, x, y - 10);
        box(ctx, x, y, fw, fh, 0, "#ffffff", i === 1 ? "#0d99ff" : "#e5e5e5", i === 1 ? 4 : 2);
        box(ctx, x + 14, y + 14, fw - 28, fh * 0.22, 8, ["#f3e8ff", "#e0f2fe", "#dcfce7"][i]);
        box(ctx, x + 14, y + fh * 0.3, fw * 0.6, 14, 7, "#e5e5e5");
        box(ctx, x + 14, y + fh * 0.3 + 26, fw * 0.8, 14, 7, "#e5e5e5");
        box(ctx, x + 14, y + fh - 60, fw - 28, 42, 21, i === 2 ? "#14ae5c" : palette.main);
      });
      ctx.fillStyle = "#f24e1e";
      ctx.beginPath();
      ctx.arc(cw * 0.82, h * 0.78, h * 0.08, 0, Math.PI * 2);
      ctx.fill();
      box(ctx, cw * 0.7, h * 0.68, h * 0.12, h * 0.12, 6, "#1abcfe");
      ctx.strokeStyle = "#0d99ff";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(cw * 0.37, h * 0.1, cw * 0.28, h * 0.66);
      ctx.setLineDash([]);
    },
    `${pw}|${pd}|${palette.main}`,
  );

  return (
    <group>
      {/* The canvas platform */}
      <group onClick={(e) => clicked(e) && drop()} {...pointer}>
        <mesh position={[0, 0.04, 0]} material={flat("#e5e5e5", 0.5)} castShadow receiveShadow>
          <boxGeometry args={[pw + 0.08, 0.08, pd + 0.08]} />
        </mesh>
        <mesh position={[0, 0.082, 0]} rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[pw, pd]} />
          <meshStandardMaterial map={texture} roughness={0.7} />
        </mesh>
      </group>
      {/* Shapes standing on it */}
      <mesh position={[pw * 0.32, 0.3, pd * 0.28]} material={flat(palette.main, 0.35)} castShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.44, 32]} />
      </mesh>
      <mesh position={[-pw * 0.38, 0.28, pd * 0.32]} rotation-y={0.5} material={flat("#f24e1e", 0.4)} castShadow>
        <boxGeometry args={[0.38, 0.38, 0.38]} />
      </mesh>
      <mesh position={[pw * 0.42, 0.34, -pd * 0.3]} material={flat("#0acf83", 0.35)} castShadow>
        <sphereGeometry args={[0.26, 24, 18]} />
      </mesh>
      {/* Live cursors */}
      {FIGMA_CURSORS.map((c, i) => (
        <group
          key={c.name}
          ref={(g) => {
            cursors.current[i] = g;
          }}
        >
          <mesh position={[-0.03, 0.035, -0.02]} scale={1.2} material={flat("#ffffff", 0.5)}>
            <extrudeGeometry args={[ARROW, ARROW_EXTRUDE]} />
          </mesh>
          <mesh material={flat(c.color, 0.35, 0, c.color, 0.35)} castShadow>
            <extrudeGeometry args={[ARROW, ARROW_EXTRUDE]} />
          </mesh>
          <mesh position={[0.32 + c.name.length * 0.03, -0.64, 0.02]} material={flat(c.color, 0.4, 0, c.color, 0.3)}>
            <boxGeometry args={[0.12 + c.name.length * 0.062, 0.15, 0.03]} />
          </mesh>
          <Text position={[0.32 + 0.03, -0.64, 0.04]} fontSize={0.09} color="#ffffff" anchorX="left" anchorY="middle">
            {c.name}
          </Text>
        </group>
      ))}
      {stickies.map((n) => {
        const [fx, fz] = STICKY_SPOTS[n % STICKY_SPOTS.length];
        const who = FIGMA_CURSORS[n % FIGMA_CURSORS.length];
        return <StickyNote key={n} at={[fx * pw, 0.1, fz * pd]} text={STICKY_NOTES[n % STICKY_NOTES.length]} author={who.name} color={who.color} />;
      })}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Figma · The component library (room)
// ---------------------------------------------------------------------------

/**
 * A library cabinet on the back wall with instances of a button on its shelves, and the main
 * component (purple dashed outline) on a pedestal in front. Click it or press E to switch its
 * variant: every instance updates with it, in a little wave.
 */
const BUTTON_VARIANTS = [
  { name: "Primary", fill: "#a259ff", ink: "#ffffff" },
  { name: "Danger", fill: "#f24e1e", ink: "#ffffff" },
  { name: "Success", fill: "#14ae5c", ink: "#ffffff" },
  { name: "Dark", fill: "#1e1e1e", ink: "#ffffff" },
  { name: "Outline", fill: "#ffffff", ink: "#1e1e1e" },
];

function drawButton(ctx: CanvasRenderingContext2D, cw: number, ch: number, v: (typeof BUTTON_VARIANTS)[number], main: boolean) {
  ctx.fillStyle = "#f5f5f5";
  ctx.fillRect(0, 0, cw, ch);
  ctx.fillStyle = main ? "#9747ff" : "#8a8a8a";
  ctx.font = font(26, "700");
  ctx.fillText(main ? `❖ Button / ${v.name}` : `◇ Button`, 22, 40);
  box(ctx, cw * 0.14, ch * 0.34, cw * 0.72, ch * 0.42, ch * 0.21, v.fill, v.fill === "#ffffff" ? "#1e1e1e" : undefined, 4);
  ctx.fillStyle = v.ink;
  ctx.font = font(ch * 0.15, "700");
  ctx.textAlign = "center";
  ctx.fillText("Get started", cw / 2, ch * 0.61);
  ctx.textAlign = "left";
  if (main) {
    ctx.strokeStyle = "#9747ff";
    ctx.lineWidth = 6;
    ctx.setLineDash([16, 10]);
    ctx.strokeRect(8, 56, cw - 16, ch - 66);
    ctx.setLineDash([]);
  }
}

function ComponentLibrary({ w, d, toHouse, label }: SigProps) {
  const { palette, accent } = useHouse();
  const [variant, setVariant] = useState(0);
  const changedAt = useRef(-10);
  const instances = useRef<(THREE.Group | null)[]>([]);
  const v = BUTTON_VARIANTS[variant];
  const cabW = Math.min(w - 2, 4.4);
  const perShelf = cabW > 3 ? 3 : 2;
  const count = perShelf * 2;
  const change = () => {
    setVariant((x) => (x + 1) % BUTTON_VARIANTS.length);
    changedAt.current = now();
    sfx.sparkle();
    toast(`Main component edited: ${count} instances updated at once. Overrides you made on an instance (like its text) are kept.`, "❖ Components");
  };
  const where = useWorldPoint(toHouse, 0, -d / 2 + 2.3);
  useProximity({ id: "figma-components", label: "Switch the main component's variant", radius: 1.9, where, run: change });

  const main = useCanvas(480, 300, (ctx, cw, ch) => drawButton(ctx, cw, ch, v, true), `main|${variant}`);
  const copy = useCanvas(400, 240, (ctx, cw, ch) => drawButton(ctx, cw, ch, v, false), `copy|${variant}`);
  useFrame(() => {
    const t = now();
    instances.current.forEach((g, i) => {
      if (!g) return;
      const k = (t - changedAt.current - 0.15 - i * 0.08) / 0.35;
      g.scale.setScalar(k > 0 && k < 1 ? 1 + Math.sin(k * Math.PI) * 0.15 : 1);
    });
  });

  const wood = flat("#f2f2f2", 0.6);
  const cabZ = -d / 2 + 0.34;
  const shelves = [0.62, 1.24, 1.86];
  return (
    <group>
      {/* The cabinet */}
      <group position={[0, 0, cabZ]}>
        <mesh position={[0, 1.1, -0.19]} material={flat(palette.ink, 0.6)} receiveShadow>
          <boxGeometry args={[cabW, 2.2, 0.03]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * (cabW / 2 - 0.02), 1.1, 0]} material={wood} castShadow>
            <boxGeometry args={[0.04, 2.2, 0.42]} />
          </mesh>
        ))}
        {[0.05, ...shelves, 2.2].map((y) => (
          <mesh key={y} position={[0, y, 0]} material={wood} castShadow receiveShadow>
            <boxGeometry args={[cabW, 0.04, 0.42]} />
          </mesh>
        ))}
        <mesh position={[0, 2.22, 0.2]} material={flat(accent, 0.4, 0, accent, 0.6)}>
          <boxGeometry args={[cabW, 0.03, 0.02]} />
        </mesh>
        {Array.from({ length: count }, (_, i) => {
          const shelf = Math.floor(i / perShelf);
          const slot = i % perShelf;
          const x = (slot - (perShelf - 1) / 2) * (cabW / perShelf);
          return (
            <group
              key={i}
              ref={(g) => {
                instances.current[i] = g;
              }}
              position={[x, shelves[shelf] + 0.2, 0.02]}
              rotation-x={-0.08}
            >
              <mesh position={[0, 0, -0.012]} material={flat("#d4d4d4", 0.6)}>
                <boxGeometry args={[0.56, 0.35, 0.02]} />
              </mesh>
              <mesh>
                <planeGeometry args={[0.52, 0.31]} />
                <meshBasicMaterial map={copy.texture} toneMapped={false} />
              </mesh>
            </group>
          );
        })}
        <Text position={[0, shelves[2] + 0.17, 0.05]} fontSize={0.12} color={palette.paper} anchorX="center" anchorY="middle">
          {`${label} · ${count} instances`}
        </Text>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[cabW / 2, 1.1, 0.22]} position={[0, 1.1, 0]} />
        </RigidBody>
      </group>
      {/* The main component on its pedestal */}
      <group position={[0, 0, -d / 2 + 1.5]} onClick={(e) => clicked(e) && change()} {...pointer}>
        <mesh position={[0, 0.5, 0]} material={flat("#ffffff", 0.5)} castShadow>
          <boxGeometry args={[0.4, 1.0, 0.4]} />
        </mesh>
        <mesh position={[0, 1.02, 0]} material={flat(accent, 0.4)}>
          <boxGeometry args={[0.5, 0.04, 0.5]} />
        </mesh>
        <group position={[0, 1.3, 0]} rotation-x={-0.2}>
          <mesh position={[0, 0, -0.015]} material={flat("#9747ff", 0.5)}>
            <boxGeometry args={[0.82, 0.53, 0.02]} />
          </mesh>
          <mesh>
            <planeGeometry args={[0.78, 0.49]} />
            <meshBasicMaterial map={main.texture} toneMapped={false} />
          </mesh>
        </group>
        <Text position={[0, 0.75, 0.21]} fontSize={0.06} color={palette.ink} anchorX="center" anchorY="middle">
          {`Main component · ${v.name}`}
        </Text>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.25, 0.55, 0.25]} position={[0, 0.55, 0]} />
        </RigidBody>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Figma · The prototype room (room)
// ---------------------------------------------------------------------------

/**
 * Two phone frames on easels joined by a blue prototype noodle, from the Continue button on the
 * sign-in screen to the home screen. E presents the prototype: a dot runs along the noodle and the
 * second screen lights up as the destination.
 */
function Easel({ x, z, map, title, glow }: { x: number; z: number; map: THREE.Texture; title: string; glow?: React.Ref<THREE.MeshBasicMaterial> }) {
  const { palette } = useHouse();
  const wood = flat("#b08a5a", 0.7);
  return (
    <group position={[x, 0, z]}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.32, 0.95, 0.06]} rotation={[-0.08, 0, s * 0.12]} material={wood} castShadow>
          <boxGeometry args={[0.05, 1.95, 0.05]} />
        </mesh>
      ))}
      <mesh position={[0, 0.85, -0.32]} rotation-x={0.35} material={wood}>
        <boxGeometry args={[0.05, 1.75, 0.05]} />
      </mesh>
      <mesh position={[0, 0.86, 0.11]} material={wood}>
        <boxGeometry args={[0.8, 0.05, 0.12]} />
      </mesh>
      <group position={[0, 1.55, 0.1]} rotation-x={-0.08}>
        {glow && (
          <mesh position={[0, 0, -0.04]}>
            <planeGeometry args={[0.86, 1.48]} />
            <meshBasicMaterial ref={glow} color="#0d99ff" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
        )}
        <mesh position={[0, 0, -0.02]} material={flat("#1e1e1e", 0.3, 0.3)} castShadow>
          <boxGeometry args={[0.68, 1.3, 0.04]} />
        </mesh>
        <mesh position={[0, 0, 0.001]}>
          <planeGeometry args={[0.6, 1.2]} />
          <meshBasicMaterial map={map} toneMapped={false} />
        </mesh>
      </group>
      <Text position={[0, 2.35, 0.06]} fontSize={0.09} color={palette.ink} anchorX="center" anchorY="middle">
        {title}
      </Text>
    </group>
  );
}

function PrototypeRoom({ w, d, toHouse }: SigProps) {
  const { palette, accent } = useHouse();
  const ex = Math.min(1.7, w / 2 - 1.0);
  const ez = -d / 2 + 1.2;
  const presentAt = useRef(-10);
  const reached = useRef(true);
  const dot = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.MeshBasicMaterial>(null);
  const noodle = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-ex + 0.2, 1.17, ez + 0.16),
        new THREE.Vector3(-ex + 0.6, 1.5, ez + 0.5),
        new THREE.Vector3(0, 2.45, ez + 0.6),
        new THREE.Vector3(ex - 0.7, 1.9, ez + 0.4),
        new THREE.Vector3(ex - 0.34, 1.75, ez + 0.14),
      ]),
    [ex, ez],
  );
  const tip = useMemo(() => {
    const end = noodle.getPointAt(1);
    const dir = noodle.getTangentAt(1);
    return { position: [end.x, end.y, end.z] as V3, quaternion: new THREE.Quaternion().setFromUnitVectors(UP, dir) };
  }, [noodle]);
  const present = () => {
    presentAt.current = now();
    reached.current = false;
    sfx.click();
  };
  const where = useWorldPoint(toHouse, 0, ez + 1.6);
  useProximity({ id: "figma-prototype", label: "Present", radius: 2, where, run: present });

  useFrame(() => {
    const e = now() - presentAt.current;
    if (dot.current) {
      dot.current.visible = e < 1.2;
      if (e < 1.2) noodle.getPointAt(ease(e / 1.2), dot.current.position);
    }
    if (glow.current) glow.current.opacity = e > 1.2 && e < 3.2 ? 0.7 * Math.sin(((e - 1.2) / 2) * Math.PI) : 0;
    if (!reached.current && e > 1.2) {
      reached.current = true;
      sfx.chirp();
      burstAt(toHouse, ex, 1.6, ez + 0.3, ["#0d99ff", accent, "#ffffff"], 14);
      toast("On click → Navigate to · Smart animate. Layers with the same name in both frames are matched and animated between them.", "▶ Prototype");
    }
  });

  const signIn = useCanvas(360, 720, (ctx, cw, ch) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = "#1e1e1e";
    ctx.font = font(40, "800");
    ctx.fillText("Sign in", 30, 150);
    ctx.fillStyle = "#8a8a8a";
    ctx.font = font(22);
    ctx.fillText("Welcome back to the city", 30, 190);
    ["Email", "Password"].forEach((f, i) => {
      ctx.fillStyle = "#8a8a8a";
      ctx.fillText(f, 30, 270 + i * 110);
      box(ctx, 30, 285 + i * 110, cw - 60, 54, 10, "#f5f5f5", "#e5e5e5");
    });
    box(ctx, 30, 560, cw - 60, 64, 32, palette.main);
    ctx.fillStyle = "#ffffff";
    ctx.font = font(26, "700");
    ctx.textAlign = "center";
    ctx.fillText("Continue", cw / 2, 602);
    ctx.textAlign = "left";
    ctx.strokeStyle = "#0d99ff";
    ctx.lineWidth = 4;
    ctx.strokeRect(24, 554, cw - 48, 76);
  });
  const home = useCanvas(360, 720, (ctx, cw, ch) => {
    ctx.fillStyle = "#faf5ff";
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = "#1e1e1e";
    ctx.font = font(34, "800");
    ctx.fillText("Hi, Wouroud", 30, 120);
    box(ctx, 30, 160, cw - 60, 180, 20, palette.main);
    ctx.fillStyle = "#ffffff";
    ctx.font = font(24, "700");
    ctx.fillText("Today's projects", 52, 210);
    [0, 1, 2].forEach((i) => box(ctx, 30, 380 + i * 100, cw - 60, 80, 16, "#ffffff", "#e9d5ff"));
    ctx.fillStyle = "#8a8a8a";
    ctx.font = font(22);
    ["Portfolio city", "Design review", "Prototype test"].forEach((l, i) => ctx.fillText(l, 52, 428 + i * 100));
    ctx.fillStyle = "#e5e5e5";
    ctx.fillRect(0, ch - 80, cw, 80);
  });

  return (
    <group>
      <Easel x={-ex} z={ez} map={signIn.texture} title="Frame 1 · Sign in" />
      <Easel x={ex} z={ez} map={home.texture} title="Frame 2 · Home" glow={glow} />
      <mesh>
        <tubeGeometry args={[noodle, 64, 0.016, 8, false]} />
        <meshStandardMaterial color="#0d99ff" emissive="#0d99ff" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={noodle.getPointAt(0)} material={flat("#0d99ff", 0.3, 0, "#0d99ff", 0.8)}>
        <sphereGeometry args={[0.035, 12, 10]} />
      </mesh>
      <mesh position={tip.position} quaternion={tip.quaternion} material={flat("#0d99ff", 0.3, 0, "#0d99ff", 0.8)}>
        <coneGeometry args={[0.045, 0.1, 12]} />
      </mesh>
      <mesh ref={dot} visible={false} material={flat("#ffffff", 0.2, 0, "#7cc4ff", 3)}>
        <sphereGeometry args={[0.05, 14, 10]} />
      </mesh>
      <Rug position={[0, ez + 1.5]} width={Math.min(w - 1.5, 4.4)} depth={1.6} color="#f5f5f5" border={accent} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// UI/UX · The journey you can walk (hero)
// ---------------------------------------------------------------------------

/**
 * A walkable path with five stations, Discover to Recommend, and above it a flowing ribbon that
 * traces how the user feels along the way: it dips at Sign up. E walks the journey: the stations
 * light one by one and the board says what was learned at each.
 */
const JOURNEY = [
  { name: "Discover", mood: 0.45, insight: "A friend shares the link. People judge a page in a fraction of a second: a clear headline beats decoration." },
  { name: "Sign up", mood: -0.85, insight: "The low point: a nine-field form. Ask only for an email now; the rest can wait until it's needed." },
  { name: "First use", mood: 0.1, insight: "Show one quick win. Empty states should teach the next step, not just say \"nothing here\"." },
  { name: "Habit", mood: 0.6, insight: "Small rewards and timely reminders bring people back; remove friction from the path they repeat daily." },
  { name: "Recommend", mood: 0.95, insight: "Delighted users tell friends. Ask for a review right after a success moment, not at random." },
];

function JourneyPath({ w, d, toHouse }: SigProps) {
  const { palette, accent } = useHouse();
  const span = Math.min(w - 1.6, 7.4);
  const pz = 0.5;
  const xs = JOURNEY.map((_, i) => -span / 2 + (i * span) / (JOURNEY.length - 1));
  const ys = JOURNEY.map((s) => 2.35 + s.mood * 0.7);
  const [stage, setStage] = useState(-1);
  const walk = useRef({ on: false, at: -1, next: 0 });
  const discs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const beads = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const ribbon = useMemo(() => {
    const y = (i: number) => 2.35 + JOURNEY[i].mood * 0.7;
    const last = JOURNEY.length - 1;
    const pts = JOURNEY.map((_, i) => new THREE.Vector3(-span / 2 + (i * span) / last, y(i), 0));
    return new THREE.CatmullRomCurve3([new THREE.Vector3(-span / 2 - 0.7, y(0) - 0.15, 0), ...pts, new THREE.Vector3(span / 2 + 0.7, y(last) + 0.1, 0)]);
  }, [span]);

  const start = () => {
    if (walk.current.on) return;
    walk.current = { on: true, at: -1, next: now() };
    setStage(-1);
  };
  const where = useWorldPoint(toHouse, 0, Math.min(d / 2 - 0.4, 2.6));
  useProximity({ id: "ux-journey", label: "Walk the journey", radius: 2.4, where, run: start });

  useFrame(() => {
    const t = now();
    const wk = walk.current;
    if (wk.on && t >= wk.next) {
      wk.at++;
      if (wk.at >= JOURNEY.length) {
        wk.on = false;
        toast("Journey walked. The dip at Sign up is where a fix pays off most: smooth the lowest point first.", "🧭 User journey");
        sfx.sparkle();
      } else {
        setStage(wk.at);
        sfx.chirp();
        burstAt(toHouse, xs[wk.at], ys[wk.at], pz - 0.42, [accent, palette.second], 10);
        wk.next = t + 2.2;
      }
    }
    const lit = wk.on || stage >= JOURNEY.length - 1 ? stage : -1;
    discs.current.forEach((m, i) => {
      if (m) m.emissiveIntensity = i === lit ? 2.2 + Math.sin(t * 6) * 0.4 : i <= lit ? 0.9 : 0.15;
    });
    beads.current.forEach((m, i) => {
      if (m) m.emissiveIntensity = i <= lit ? 1.8 : 0.2;
    });
  });

  const info = stage >= 0 ? JOURNEY[stage] : null;
  const bw = Math.min(2.8, w - 2);
  const { texture } = useCanvas(
    900,
    Math.round((900 * 1.05) / bw),
    (ctx, cw, ch) => {
      ctx.fillStyle = palette.paper;
      ctx.fillRect(0, 0, cw, ch);
      box(ctx, 0, 0, cw, 14, 0, palette.main);
      ctx.fillStyle = palette.main;
      ctx.font = font(30, "700");
      ctx.fillText(info ? `STAGE ${stage + 1} OF ${JOURNEY.length}` : "USER JOURNEY", 32, 64);
      ctx.fillStyle = palette.ink;
      ctx.font = font(52, "800");
      ctx.fillText(info ? info.name : "Walk it with a user", 32, 130);
      ctx.font = font(30);
      ctx.fillStyle = "#4b3f66";
      wrap(ctx, info ? info.insight : "Five stages, one emotion curve. Press E to see what we learned at each stage.", 32, 190, cw - 64, 42);
    },
    `${stage}|${palette.main}`,
  );

  const pole = flat("#d4d4d8", 0.3, 0.8);
  const bz = -Math.min(d / 2 - 0.6, 2.2);
  return (
    <group>
      {/* The floor path */}
      <mesh position={[0, 0.006, pz]} rotation-x={-Math.PI / 2} material={flat(palette.second, 0.7)} receiveShadow>
        <planeGeometry args={[span + 1.4, 0.7]} />
      </mesh>
      {JOURNEY.map((s, i) => (
        <group key={s.name} position={[xs[i], 0, pz]}>
          <mesh position={[0, 0.02, 0]} material={flat(palette.ink, 0.5)}>
            <cylinderGeometry args={[0.46, 0.48, 0.04, 32]} />
          </mesh>
          <mesh position={[0, 0.043, 0]} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[0.3, 0.42, 32]} />
            <meshStandardMaterial
              ref={(m) => {
                discs.current[i] = m;
              }}
              color={palette.main}
              emissive={palette.main}
              emissiveIntensity={0.15}
            />
          </mesh>
          {/* The stalk up to the ribbon, and the station's sign */}
          <mesh position={[0, ys[i] / 2, -0.42]} material={pole}>
            <cylinderGeometry args={[0.018, 0.022, ys[i], 8]} />
          </mesh>
          <mesh position={[0, 0.95, -0.4]} material={flat(palette.ink, 0.5)} castShadow>
            <boxGeometry args={[0.9, 0.28, 0.04]} />
          </mesh>
          <Text position={[0, 0.95, -0.375]} fontSize={0.1} color={palette.paper} anchorX="center" anchorY="middle">
            {`${i + 1}  ${s.name}`}
          </Text>
          <mesh position={[0, ys[i], -0.42]}>
            <sphereGeometry args={[0.13, 18, 14]} />
            <meshStandardMaterial
              ref={(m) => {
                beads.current[i] = m;
              }}
              color={palette.second}
              emissive={palette.second}
              emissiveIntensity={0.2}
              roughness={0.3}
            />
          </mesh>
        </group>
      ))}
      {/* The emotion ribbon */}
      <mesh scale={[1, 1, 0.35]} position={[0, 0, pz - 0.42]} castShadow>
        <tubeGeometry args={[ribbon, 96, 0.09, 12, false]} />
        <meshStandardMaterial color={palette.main} emissive={palette.main} emissiveIntensity={0.35} roughness={0.35} metalness={0.2} />
      </mesh>
      {/* The insight board */}
      <group position={[0, 0, bz]}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * (bw / 2 - 0.1), 0.5, -0.03]} material={pole}>
            <boxGeometry args={[0.05, 1.0, 0.05]} />
          </mesh>
        ))}
        <Panel position={[0, 1.5, 0]} width={bw} height={1.05} map={texture} frame={palette.ink} />
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[bw / 2, 1, 0.1]} position={[0, 1, 0]} />
        </RigidBody>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// UI/UX · The usability test room (room)
// ---------------------------------------------------------------------------

/**
 * A test room: a participant at a desk with a laptop, a one-way mirror (dark reflective glass)
 * along the side with a recording light, and the observers' notes on the back wall. E starts the
 * session: the tasks are tried one by one and the notes fill in, success or not.
 */
const UX_TASKS = [
  { task: "Task 1: Sign up with email", result: "✓ done in 0:42" },
  { task: "Task 2: Save a draft", result: "✗ couldn't find Save" },
  { task: "Task 3: Change the profile photo", result: "✓ done in 1:10" },
  { task: "Task 4: Share the portfolio", result: "✓ done, hesitated at the icon" },
];

function UsabilityRoom({ w, d, toHouse, label }: SigProps) {
  const { palette, accent } = useHouse();
  const [step, setStep] = useState(-1);
  const [running, setRunning] = useState(false);
  const session = useRef({ on: false, at: -1, next: 0 });
  const rec = useRef<THREE.MeshStandardMaterial>(null);
  const start = () => {
    if (session.current.on) return;
    session.current = { on: true, at: -1, next: now() + 0.6 };
    setStep(-1);
    setRunning(true);
    sfx.click();
  };
  const deskX = w / 2 - 1.1;
  const deskZ = -d / 2 + 2.2;
  const where = useWorldPoint(toHouse, deskX - 1.6, deskZ + 0.9);
  useProximity({ id: "ux-mirror", label: running ? "Session running…" : "Start the session", radius: 2, where, run: start });

  useFrame(() => {
    const t = now();
    const s = session.current;
    if (rec.current) rec.current.emissiveIntensity = s.on ? (Math.sin(t * 5) > 0 ? 2.5 : 0.6) : 0.1;
    if (!s.on || t < s.next) return;
    s.at++;
    setStep(s.at);
    s.next = t + 1.9;
    if (UX_TASKS[s.at]?.result.startsWith("✗")) sfx.clunk();
    else sfx.pop();
    if (s.at >= UX_TASKS.length - 1) {
      s.on = false;
      setRunning(false);
      toast("Insight: the icon-only Save button was missed. Give it a visible label. Testing with about five people already shows most of the big problems.", "🪞 Usability test");
    }
  });

  const mirrorLen = Math.min(4.2, d - 1.6);
  const mx = -w / 2 + 0.45;
  const mz = -d / 2 + 0.7 + mirrorLen / 2;
  const bw = Math.min(3.4, w / 2 - 0.8);
  const laptop = useCanvas(
    400,
    250,
    (ctx, cw, ch) => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, cw, ch);
      box(ctx, 0, 0, cw, 30, 0, "#ede9fe");
      ctx.fillStyle = palette.ink;
      ctx.font = font(24, "800");
      ctx.fillText(step < 0 ? "Prototype v3" : UX_TASKS[Math.min(step, UX_TASKS.length - 1)].task.replace(/^Task \d: /, ""), 16, 70);
      box(ctx, 16, 92, cw - 32, 36, 6, "#f4f4f5");
      box(ctx, 16, 140, cw - 32, 70, 6, "#f4f4f5");
      // The icon-only Save button participants keep missing
      box(ctx, cw - 34, 6, 18, 18, 3, "#d4d4d8");
    },
    `${step}|${palette.ink}`,
  );
  const lines = UX_TASKS.map((t, i) => (i <= step ? `${t.task} · ${t.result}` : `${t.task} · …`));
  const glass = useMemo(() => ({ color: "#10141b", metalness: 0.95, roughness: 0.05 }), []);
  const frame = flat("#3f3f46", 0.4, 0.6);
  return (
    <group>
      <NoteBoard position={[-w / 2 + 0.7 + bw / 2, 1.75, -d / 2 + 0.12]} width={bw} height={1.8} kicker="Observers' notes" title={label} lines={lines} current={step} />
      {/* The one-way mirror */}
      <group position={[mx, 0, mz]} rotation-y={Math.PI / 2}>
        <mesh position={[0, 0.45, 0]} material={flat(palette.paper, 0.7)} castShadow>
          <boxGeometry args={[mirrorLen, 0.9, 0.12]} />
        </mesh>
        <mesh position={[0, 1.6, 0]}>
          <boxGeometry args={[mirrorLen - 0.1, 1.4, 0.04]} />
          <meshStandardMaterial {...glass} />
        </mesh>
        {[0.9, 2.32].map((y) => (
          <mesh key={y} position={[0, y, 0]} material={frame}>
            <boxGeometry args={[mirrorLen, 0.06, 0.14]} />
          </mesh>
        ))}
        {[-1, 0, 1].map((s) => (
          <mesh key={s} position={[(s * (mirrorLen - 0.05)) / 2, 1.6, 0]} material={frame}>
            <boxGeometry args={[0.06, 1.44, 0.14]} />
          </mesh>
        ))}
        <mesh position={[mirrorLen / 2 - 0.3, 2.45, 0.05]}>
          <sphereGeometry args={[0.05, 12, 10]} />
          <meshStandardMaterial ref={rec} color="#ef4444" emissive="#ef4444" emissiveIntensity={0.1} />
        </mesh>
        <Text position={[mirrorLen / 2 - 0.55, 2.45, 0.08]} fontSize={0.06} color={palette.ink} anchorX="right" anchorY="middle">
          REC
        </Text>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[mirrorLen / 2, 1.2, 0.08]} position={[0, 1.2, 0]} />
        </RigidBody>
      </group>
      {/* The participant's desk */}
      <Table position={[deskX, 0, deskZ]} width={0.8} depth={1.3} top="walnut" />
      <group position={[deskX + 0.02, 0.745, deskZ]} rotation-y={-Math.PI / 2}>
        <mesh position={[0, 0.01, 0]} material={flat("#d4d4d8", 0.3, 0.8)}>
          <boxGeometry args={[0.34, 0.02, 0.24]} />
        </mesh>
        <group position={[0, 0.02, -0.12]} rotation-x={-0.25}>
          <mesh position={[0, 0.11, -0.006]} material={flat("#a1a1aa", 0.3, 0.8)}>
            <boxGeometry args={[0.34, 0.22, 0.01]} />
          </mesh>
          <mesh position={[0, 0.11, 0]}>
            <planeGeometry args={[0.31, 0.19]} />
            <meshBasicMaterial map={laptop.texture} toneMapped={false} />
          </mesh>
        </group>
      </group>
      <SideChair position={[deskX - 0.62, 0, deskZ]} facing={Math.PI / 2} leather="grey" />
      <group position={[deskX - 0.72, 0.05, deskZ]} rotation-y={Math.PI / 2}>
        <Suspense fallback={null}>
          <Person look={NPC_PEOPLE[2]} animation="sit" detail={false} floor={0} />
        </Suspense>
      </group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.42, 0.4, 0.66]} position={[deskX, 0.4, deskZ]} />
      </RigidBody>
      <TallPlant position={[w / 2 - 0.5, 0, -d / 2 + 0.5]} seed={7} />
      <mesh position={[deskX, 1.9, -d / 2 + 0.13]} material={flat(accent, 0.5)}>
        <boxGeometry args={[0.9, 0.04, 0.02]} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// UI/UX · The persona wall (room)
// ---------------------------------------------------------------------------

/**
 * A cork wall with three persona cards: who they are, what they want and what annoys them.
 * Click a card (or press E to go through them) to hear that persona's key need.
 */
const PERSONAS = [
  { name: "Rania", role: "Recruiter", color: "#7c3aed", goals: ["Judge skills in two minutes", "Find the CV and contact fast"], pains: ["Long intros", "Broken links"], quote: "Show me what you did, not what you like.", need: "A clear summary up front and a one-click CV." },
  { name: "Omar", role: "Developer", color: "#0ea5e9", goals: ["See real code and architecture", "Check the stack and decisions"], pains: ["Buzzwords without repos", "Screenshots of code"], quote: "Where's the repo?", need: "Links to code, live demos and the reasons behind the tech choices." },
  { name: "Lina", role: "Visitor", color: "#f59e0b", goals: ["Explore and have fun", "Understand who Wouroud is"], pains: ["Confusing controls", "Slow loading"], quote: "Just tell me where to go next.", need: "Obvious controls, fast loading and a guided path." },
];

function PersonaCard({ p, at, width, on, onPick }: { p: (typeof PERSONAS)[number]; at: V3; width: number; on: boolean; onPick: () => void }) {
  const { palette } = useHouse();
  const height = width * 1.36;
  const { texture } = useCanvas(
    600,
    816,
    (ctx, cw, ch) => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, cw, ch);
      box(ctx, 0, 0, cw, 150, 0, p.color);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(90, 150, 62, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.color;
      ctx.font = font(64, "800");
      ctx.textAlign = "center";
      ctx.fillText(p.name[0], 90, 172);
      ctx.textAlign = "left";
      ctx.fillStyle = "#ffffff";
      ctx.font = font(48, "800");
      ctx.fillText(p.name, 170, 80);
      ctx.font = font(30, "600");
      ctx.fillText(p.role, 170, 122);
      let y = 270;
      const section = (title: string, items: string[], color: string) => {
        ctx.fillStyle = color;
        ctx.font = font(26, "800");
        ctx.fillText(title.toUpperCase(), 40, y);
        y += 44;
        ctx.fillStyle = palette.ink;
        ctx.font = font(28);
        items.forEach((it) => (y = wrap(ctx, `• ${it}`, 40, y, cw - 80, 36) + 4));
        y += 22;
      };
      section("Goals", p.goals, "#16a34a");
      section("Frustrations", p.pains, "#dc2626");
      ctx.fillStyle = "#6b7280";
      ctx.font = font(28, "italic 400");
      wrap(ctx, `"${p.quote}"`, 40, Math.min(y + 10, ch - 80), cw - 80, 36);
    },
    `${p.name}|${palette.ink}`,
  );
  return (
    <group position={at} onClick={(e) => clicked(e) && onPick()} {...pointer}>
      <mesh position={[0, 0, -0.012]} material={flat(on ? p.color : "#e7e5e4", 0.6)} castShadow>
        <boxGeometry args={[width + 0.06, height + 0.06, 0.015]} />
      </mesh>
      <mesh position={[0, 0, 0.001]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      <mesh position={[0, height / 2 - 0.03, 0.02]} material={flat(p.color, 0.3, 0.3)}>
        <sphereGeometry args={[0.025, 10, 8]} />
      </mesh>
    </group>
  );
}

function PersonaWall({ w, d, toHouse, rot, label }: SigProps) {
  const { palette } = useHouse();
  const [picked, setPicked] = useState(-1);
  const pick = (i: number) => {
    setPicked(i);
    sfx.chirp();
    const p = PERSONAS[i];
    toast(`${p.name}, ${p.role.toLowerCase()}, needs: ${p.need}`, `👤 ${label}`);
  };
  const where = useWorldPoint(toHouse, 0, -d / 2 + 1.9);
  useProximity({ id: "ux-personas", label: picked < 0 ? "Meet the personas" : "Next persona", radius: 1.9, where, run: () => pick((picked + 1) % PERSONAS.length) });

  const corkW = Math.min(w - 0.8, 4.4);
  const cw = Math.min(1.2, (corkW - 0.4) / PERSONAS.length - 0.12);
  const bench = d > 4.6;
  const benchZ = -d / 2 + 2.3;
  const seats = useMemo(() => (bench ? [-0.4, 0.4].map((x, i) => seatAt(`ux-personas-${i}`, toHouse, rot, x, benchZ, Math.PI)) : []), [bench, toHouse, rot, benchZ]);
  return (
    <group>
      <mesh position={[0, 1.6, -d / 2 + 0.1]} material={flat("#b98b5b", 0.95)} receiveShadow>
        <boxGeometry args={[corkW, 2.0, 0.04]} />
      </mesh>
      <mesh position={[0, 1.6, -d / 2 + 0.085]} material={flat(palette.ink, 0.5)}>
        <boxGeometry args={[corkW + 0.08, 2.08, 0.03]} />
      </mesh>
      <Text position={[0, 2.75, -d / 2 + 0.13]} fontSize={0.16} color={palette.ink} anchorX="center" anchorY="middle">
        {label}
      </Text>
      {PERSONAS.map((p, i) => (
        <PersonaCard key={p.name} p={p} width={cw} on={picked === i} at={[(i - 1) * (cw + 0.16), 1.58, -d / 2 + 0.14]} onPick={() => pick(i)} />
      ))}
      {bench && (
        <>
          <Batch>
            <mesh position={[0, 0.44, benchZ]} material={flat("#c8a77e", 0.6)} castShadow>
              <boxGeometry args={[1.5, 0.06, 0.42]} />
            </mesh>
            {[-0.65, 0.65].map((x) => (
              <mesh key={x} position={[x, 0.21, benchZ]} material={flat(palette.ink, 0.5, 0.3)}>
                <boxGeometry args={[0.06, 0.42, 0.38]} />
              </mesh>
            ))}
          </Batch>
          <Seats seats={seats} />
        </>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// System design · The ERD floor (hero)
// ---------------------------------------------------------------------------

/**
 * An entity-relationship diagram you can walk around: User, Order, Product and Payment as low
 * glowing plinths with their attributes on glass cards, joined by lines on the floor with
 * crow's-foot ends. E shows the cardinality: the lines light one by one with 1—*, *—* and 1—1.
 */
const ENTITIES = [
  { name: "User", attrs: ["id  PK", "name", "email  UNIQUE", "created_at"], fx: -1, front: false },
  { name: "Order", attrs: ["id  PK", "user_id  FK", "status", "total", "created_at"], fx: 0, front: false },
  { name: "Product", attrs: ["id  PK", "name", "price", "stock"], fx: 1, front: false },
  { name: "Payment", attrs: ["id  PK", "order_id  FK UNIQUE", "amount", "provider", "paid_at"], fx: 0, front: true },
];
type End = "one" | "many";
const RELATIONS: { a: number; b: number; ends: [End, End]; label: string }[] = [
  { a: 0, b: 1, ends: ["one", "many"], label: "1—*" },
  { a: 1, b: 2, ends: ["many", "many"], label: "*—*" },
  { a: 1, b: 3, ends: ["one", "one"], label: "1—1" },
];
const PLINTH = { hx: 0.75, hz: 0.5, h: 0.3 };

/** A flat strip on the floor between two local (x, z) points. */
function FloorStrip({ from, to, width, material }: { from: [number, number]; to: [number, number]; width: number; material: THREE.Material }) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  return (
    <mesh position={[(from[0] + to[0]) / 2, 0.012, (from[1] + to[1]) / 2]} rotation-y={-Math.atan2(dz, dx)} material={material}>
      <boxGeometry args={[Math.hypot(dx, dz), 0.012, width]} />
    </mesh>
  );
}

/** The end of a relationship line: a crow's foot for "many", two bars for "exactly one". */
function EndMark({ x, s, end, material }: { x: number; s: number; end: End; material: THREE.Material }) {
  if (end === "many")
    return (
      <>
        {[-0.2, 0, 0.2].map((z) => (
          <FloorStrip key={z} from={[x - s * 0.32, 0]} to={[x, z]} width={0.04} material={material} />
        ))}
      </>
    );
  return (
    <>
      {[0.14, 0.24].map((o) => (
        <FloorStrip key={o} from={[x - s * o, -0.16]} to={[x - s * o, 0.16]} width={0.04} material={material} />
      ))}
    </>
  );
}

function ErdFloor({ w, d, toHouse }: SigProps) {
  const { palette, accent } = useHouse();
  const X = Math.min(2.9, w / 2 - 0.95);
  const zb = -Math.min(0.9, d / 2 - 1.5);
  const zf = Math.min(1.6, d / 2 - 1.4);
  const spots = ENTITIES.map((e) => [e.fx * X, e.front ? zf : zb] as [number, number]);
  const [lit, setLit] = useState(-1);
  const show = useRef({ on: false, at: -1, next: 0 });
  const mats = useMemo(() => RELATIONS.map(() => new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.25, roughness: 0.4 })), [accent]);
  const run = () => {
    if (show.current.on) return;
    show.current = { on: true, at: -1, next: now() };
    setLit(-1);
  };
  const where = useWorldPoint(toHouse, 0, Math.min(d / 2 - 0.4, zf + 1.5));
  useProximity({ id: "sd-erd", label: "Show cardinality", radius: 2.3, where, run });

  useFrame(() => {
    const t = now();
    const s = show.current;
    if (s.on && t >= s.next) {
      s.at++;
      if (s.at >= RELATIONS.length) {
        s.on = false;
        sfx.sparkle();
        toast("User 1—* Order: orders.user_id points to one user. Order *—* Product: a join table, order_items, holds the pairs. Order 1—1 Payment: payments.order_id is UNIQUE.", "🧩 Cardinality");
      } else {
        setLit(s.at);
        sfx.chirp();
        s.next = t + 1.4;
      }
    }
    mats.forEach((m, i) => {
      m.emissiveIntensity = i === lit && s.on ? 2.4 + Math.sin(t * 8) * 0.5 : i <= lit ? 1.4 : 0.25;
    });
  });

  return (
    <group>
      {ENTITIES.map((e, i) => {
        const [x, z] = spots[i];
        return (
          <group key={e.name} position={[x, 0, z]}>
            <mesh position={[0, PLINTH.h / 2, 0]} material={flat(palette.ink, 0.5, 0.2)} castShadow receiveShadow>
              <boxGeometry args={[PLINTH.hx * 2, PLINTH.h, PLINTH.hz * 2]} />
            </mesh>
            <mesh position={[0, PLINTH.h + 0.005, 0]} material={flat(accent, 0.3, 0, accent, 0.9)}>
              <boxGeometry args={[PLINTH.hx * 2 - 0.08, 0.012, PLINTH.hz * 2 - 0.08]} />
            </mesh>
            <mesh position={[0, PLINTH.h + 0.008, 0]} material={flat(palette.ink, 0.6)}>
              <boxGeometry args={[PLINTH.hx * 2 - 0.16, 0.012, PLINTH.hz * 2 - 0.16]} />
            </mesh>
            <Text position={[0, PLINTH.h + 0.02, 0.12]} rotation-x={-Math.PI / 2} fontSize={0.2} color={accent} anchorX="center" anchorY="middle">
              {e.name}
            </Text>
            {/* The glass attribute card */}
            <mesh position={[0, PLINTH.h + 0.62, -PLINTH.hz + 0.08]}>
              <boxGeometry args={[1.3, 1.1, 0.02]} />
              <meshStandardMaterial color={palette.second} transparent opacity={0.35} roughness={0.1} depthWrite={false} />
            </mesh>
            <Text position={[-0.55, PLINTH.h + 1.06, -PLINTH.hz + 0.1]} fontSize={0.13} color={palette.paper} anchorX="left" anchorY="middle" outlineWidth={0.004} outlineColor={palette.ink}>
              {`${e.name.toLowerCase()}s`}
            </Text>
            <Text position={[-0.55, PLINTH.h + 0.9, -PLINTH.hz + 0.1]} fontSize={0.075} lineHeight={1.35} color={palette.paper} anchorX="left" anchorY="top" outlineWidth={0.003} outlineColor={palette.ink}>
              {e.attrs.join("\n")}
            </Text>
            <RigidBody type="fixed" colliders={false}>
              <CuboidCollider args={[PLINTH.hx, 0.6, PLINTH.hz]} position={[0, 0.6, 0]} />
            </RigidBody>
          </group>
        );
      })}
      {RELATIONS.map((r, i) => {
        const [ax, az] = spots[r.a];
        const [bx, bz] = spots[r.b];
        const along = az === bz;
        const from: [number, number] = along ? [ax + PLINTH.hx, az] : [ax, az + PLINTH.hz];
        const to: [number, number] = along ? [bx - PLINTH.hx, bz] : [bx, bz - PLINTH.hz];
        const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
        const angle = -Math.atan2(to[1] - from[1], to[0] - from[0]);
        return (
          <group key={r.label}>
            <group position={[(from[0] + to[0]) / 2, 0, (from[1] + to[1]) / 2]} rotation-y={angle}>
              <FloorStrip from={[-len / 2, 0]} to={[len / 2, 0]} width={0.05} material={mats[i]} />
              <EndMark x={-len / 2} s={-1} end={r.ends[0]} material={mats[i]} />
              <EndMark x={len / 2} s={1} end={r.ends[1]} material={mats[i]} />
            </group>
            <Text position={[(from[0] + to[0]) / 2 + (along ? 0 : 0.35), 0.5, (from[1] + to[1]) / 2]} fontSize={0.22} color={i <= lit ? accent : "#6d5f99"} anchorX="center" anchorY="middle" outlineWidth={0.006} outlineColor={palette.ink}>
              {r.label}
            </Text>
          </group>
        );
      })}
    </group>
  );
}

// ---------------------------------------------------------------------------
// System design · The data flow room (room)
// ---------------------------------------------------------------------------

/**
 * A data flow diagram across the back wall: external entities (boxes), processes (circles), data
 * stores (open-ended boxes) and labeled arrows, with a legend on a stand and a bench to study it
 * from. E traces the data: a glowing dot runs along each flow in turn.
 */
type DfdNode = { id: string; kind: "entity" | "process" | "store"; label: string; x: number; y: number };
const DFD_NODES: DfdNode[] = [
  { id: "customer", kind: "entity", label: "Customer", x: 110, y: 270 },
  { id: "p1", kind: "process", label: "1.0 Take order", x: 380, y: 160 },
  { id: "p2", kind: "process", label: "2.0 Take payment", x: 700, y: 160 },
  { id: "psp", kind: "entity", label: "Payment provider", x: 1050, y: 160 },
  { id: "d1", kind: "store", label: "D1  Orders", x: 380, y: 450 },
  { id: "p3", kind: "process", label: "3.0 Ship order", x: 700, y: 450 },
  { id: "courier", kind: "entity", label: "Courier", x: 1050, y: 450 },
];
const DFD_FLOWS: { from: string; to: string; label: string }[] = [
  { from: "customer", to: "p1", label: "order details" },
  { from: "p1", to: "p2", label: "amount due" },
  { from: "p2", to: "psp", label: "charge request" },
  { from: "psp", to: "p2", label: "receipt" },
  { from: "p1", to: "d1", label: "new order" },
  { from: "d1", to: "p3", label: "pick list" },
  { from: "p3", to: "courier", label: "shipment details" },
];
const DFD_W = 1200;
const DFD_H = 600;
const dfdNode = (id: string) => DFD_NODES.find((n) => n.id === id)!;
/** A flow's ends in canvas pixels, pulled back to the edges of its two nodes. */
function flowEnds(f: (typeof DFD_FLOWS)[number]) {
  const a = dfdNode(f.from);
  const b = dfdNode(f.to);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const pad = (n: DfdNode) => (n.kind === "process" ? 82 : n.kind === "store" ? 70 : 96);
  // Two flows between the same pair run side by side.
  const twin = DFD_FLOWS.some((g) => g.from === f.to && g.to === f.from);
  const off = twin ? (f.from < f.to ? 14 : -14) : 0;
  return { x1: a.x + ux * pad(a) - uy * off, y1: a.y + uy * pad(a) + ux * off, x2: b.x - ux * pad(b) - uy * off, y2: b.y - uy * pad(b) + ux * off };
}

function DataFlowRoom({ w, d, toHouse, rot, label }: SigProps) {
  const { palette, accent } = useHouse();
  const [flow, setFlow] = useState(-1);
  const trace = useRef({ on: false, at: -1, start: 0 });
  const dot = useRef<THREE.Mesh>(null);
  const bw = Math.min(w - 1.2, 5.2);
  const bh = bw / 2;
  const cy = 0.6 + bh / 2;
  const wallZ = -d / 2 + 0.12;
  const run = () => {
    if (trace.current.on) return;
    trace.current = { on: true, at: 0, start: now() };
    setFlow(0);
    sfx.click();
  };
  const where = useWorldPoint(toHouse, 0, -d / 2 + 2.4);
  useProximity({ id: "sd-dfd", label: "Trace the data", radius: 2, where, run });

  useFrame(() => {
    const tr = trace.current;
    if (!dot.current) return;
    dot.current.visible = tr.on;
    if (!tr.on) return;
    const k = (now() - tr.start) / 1.1;
    if (k >= 1) {
      tr.at++;
      tr.start = now();
      if (tr.at >= DFD_FLOWS.length) {
        tr.on = false;
        setFlow(-1);
        sfx.sparkle();
        toast("Every flow starts or ends at a process: data never jumps straight from one store or entity to another. That rule keeps a DFD honest.", "🌊 Data flow");
        return;
      }
      setFlow(tr.at);
      sfx.pop();
    }
    const e = flowEnds(DFD_FLOWS[tr.at]);
    const q = ease(Math.min(1, k));
    const px = e.x1 + (e.x2 - e.x1) * q;
    const py = e.y1 + (e.y2 - e.y1) * q;
    dot.current.position.set((px / DFD_W - 0.5) * bw, cy + (0.5 - py / DFD_H) * bh, wallZ + 0.05);
  });

  const { texture } = useCanvas(
    DFD_W,
    DFD_H,
    (ctx, cw, ch) => {
      ctx.fillStyle = palette.paper;
      ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = accent;
      ctx.font = font(30, "800");
      ctx.fillText(`${label} · Level 1 DFD: orders`, 24, 44);
      DFD_FLOWS.forEach((f, i) => {
        const e = flowEnds(f);
        const on = i === flow;
        ctx.strokeStyle = on ? accent : "#6b6390";
        ctx.fillStyle = on ? accent : "#6b6390";
        ctx.lineWidth = on ? 6 : 3;
        ctx.beginPath();
        ctx.moveTo(e.x1, e.y1);
        ctx.lineTo(e.x2, e.y2);
        ctx.stroke();
        const a = Math.atan2(e.y2 - e.y1, e.x2 - e.x1);
        ctx.beginPath();
        ctx.moveTo(e.x2, e.y2);
        ctx.lineTo(e.x2 - 18 * Math.cos(a - 0.4), e.y2 - 18 * Math.sin(a - 0.4));
        ctx.lineTo(e.x2 - 18 * Math.cos(a + 0.4), e.y2 - 18 * Math.sin(a + 0.4));
        ctx.fill();
        ctx.font = font(20, on ? "700" : "500");
        const mx = (e.x1 + e.x2) / 2;
        const my = (e.y1 + e.y2) / 2;
        const tw = ctx.measureText(f.label).width;
        const ly = my + (Math.abs(e.y2 - e.y1) < 5 ? (f.from < f.to ? -14 : 30) : 6);
        box(ctx, mx - tw / 2 - 6, ly - 20, tw + 12, 26, 6, palette.paper);
        ctx.fillStyle = on ? accent : palette.ink;
        ctx.fillText(f.label, mx - tw / 2, ly);
      });
      DFD_NODES.forEach((n) => {
        ctx.lineWidth = 4;
        if (n.kind === "entity") {
          box(ctx, n.x - 95, n.y - 50, 190, 100, 4, "#ffffff", palette.ink, 4);
        } else if (n.kind === "process") {
          ctx.fillStyle = "#ede9fe";
          ctx.strokeStyle = palette.second;
          ctx.beginPath();
          ctx.arc(n.x, n.y, 80, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(n.x - 110, n.y - 36, 220, 72);
          ctx.strokeStyle = palette.ink;
          ctx.beginPath();
          ctx.moveTo(n.x + 110, n.y - 36);
          ctx.lineTo(n.x - 110, n.y - 36);
          ctx.lineTo(n.x - 110, n.y + 36);
          ctx.lineTo(n.x + 110, n.y + 36);
          ctx.moveTo(n.x - 60, n.y - 36);
          ctx.lineTo(n.x - 60, n.y + 36);
          ctx.stroke();
        }
        ctx.fillStyle = palette.ink;
        ctx.font = font(22, "700");
        ctx.textAlign = "center";
        const words = n.label.split(" ");
        if (n.kind === "process") {
          ctx.fillText(words[0], n.x, n.y - 14);
          ctx.fillText(words.slice(1).join(" "), n.x, n.y + 16);
        } else if (n.kind === "store") {
          ctx.fillText(words[0], n.x - 85, n.y + 8);
          ctx.fillText(words.slice(1).join(" ").trim(), n.x + 25, n.y + 8);
        } else ctx.fillText(n.label, n.x, n.y + 8);
        ctx.textAlign = "left";
      });
    },
    `${flow}|${accent}|${label}`,
  );

  const current = flow >= 0 ? DFD_FLOWS[flow] : null;
  const benchZ = -d / 2 + 4.0;
  const seats = useMemo(() => [-0.45, 0.45].map((x, i) => seatAt(`sd-dfd-${i}`, toHouse, rot, x, benchZ, Math.PI)), [toHouse, rot, benchZ]);
  const legendX = w / 2 - 0.95;
  return (
    <group>
      <Panel position={[0, cy, wallZ]} width={bw} height={bh} map={texture} frame={palette.ink} />
      <mesh ref={dot} visible={false} material={flat("#ffffff", 0.2, 0, accent, 3)}>
        <sphereGeometry args={[0.06, 16, 12]} />
      </mesh>
      <Text position={[0, cy + bh / 2 + 0.22, wallZ + 0.02]} fontSize={0.14} color={palette.ink} anchorX="center" anchorY="middle">
        {current ? `${current.label}: ${dfdNode(current.from).label} → ${dfdNode(current.to).label}` : "Press E to trace the data"}
      </Text>
      {/* The legend on its stand */}
      <group position={[legendX, 0, -d / 2 + 2.4]} rotation-y={-0.7}>
        {[-0.5, 0.5].map((x) => (
          <mesh key={x} position={[x, 0.55, -0.03]} material={flat(palette.ink, 0.4, 0.5)}>
            <boxGeometry args={[0.04, 1.1, 0.04]} />
          </mesh>
        ))}
        <NoteBoard position={[0, 1.5, 0]} width={1.3} height={1.0} kicker="Legend" title="DFD symbols" lines={["Box: external entity", "Circle: a process", "Open box: a data store", "Arrow: labeled data flow"]} />
      </group>
      <Batch>
        <mesh position={[0, 0.44, benchZ]} material={flat("#d9d2f3", 0.6)} castShadow>
          <boxGeometry args={[1.6, 0.06, 0.42]} />
        </mesh>
        {[-0.7, 0.7].map((x) => (
          <mesh key={x} position={[x, 0.21, benchZ]} material={flat(palette.ink, 0.5, 0.3)}>
            <boxGeometry args={[0.06, 0.42, 0.38]} />
          </mesh>
        ))}
      </Batch>
      <Seats seats={seats} />
      <Rug position={[0, benchZ - 1]} width={Math.min(w - 2, 3.6)} depth={3} color={palette.ink} border={accent} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// API development · The rate-limited turnstile (hero)
// ---------------------------------------------------------------------------

/**
 * A stone gate with a tripod turnstile, a brass API-key reader and a rate-limit display on the
 * lintel: 5 calls per minute. E calls the API: the turnstile turns and the count goes up, until
 * the 6th call in the window gets a red 429 with Retry-After; the calls age out and it refills.
 */
const RATE_LIMIT = 5;
const RATE_WINDOW = 60;

function RateLimitGate({ w, d, toHouse }: SigProps) {
  const { palette, accent } = useHouse();
  const calls = useRef<number[]>([]);
  const spin = useRef({ target: 0, now: 0 });
  const rotor = useRef<THREE.Group>(null);
  const lamp = useRef<THREE.MeshStandardMaterial>(null);
  const [left, setLeft] = useState(RATE_LIMIT);
  const [status, setStatus] = useState<{ code: number; retry: number }>({ code: 0, retry: 0 });
  const lastTick = useRef(0);
  const prune = (t: number) => {
    calls.current = calls.current.filter((c) => t - c < RATE_WINDOW);
  };
  const call = () => {
    const t = now();
    prune(t);
    if (calls.current.length < RATE_LIMIT) {
      calls.current.push(t);
      spin.current.target += (Math.PI * 2) / 3;
      setLeft(RATE_LIMIT - calls.current.length);
      setStatus({ code: 200, retry: 0 });
      sfx.coin();
      burstAt(toHouse, 0.2, 1.2, 0.3, [accent, "#86efac"], 8);
    } else {
      const retry = Math.ceil(RATE_WINDOW - (t - calls.current[0]));
      setStatus({ code: 429, retry });
      sfx.clunk();
      toast(`429 Too Many Requests · Retry-After: ${retry}. The limit is ${RATE_LIMIT} calls a minute per key; it protects the API from bursts. Clients should wait, then retry.`, "🚧 Rate limit");
    }
  };
  const where = useWorldPoint(toHouse, 0.2, Math.min(d / 2 - 0.4, 1.8));
  useProximity({ id: "api-turnstile", label: "Call the API", radius: 2, where, run: call });

  useFrame((_, dt) => {
    const t = now();
    const s = spin.current;
    s.now += (s.target - s.now) * Math.min(1, dt * 6);
    if (rotor.current) rotor.current.rotation.x = s.now;
    if (lamp.current) {
      const c = status.code === 429 ? "#ef4444" : status.code === 200 ? "#22c55e" : "#facc15";
      lamp.current.color.set(c);
      lamp.current.emissive.set(c);
    }
    if (t - lastTick.current < 0.5) return;
    lastTick.current = t;
    prune(t);
    const n = RATE_LIMIT - calls.current.length;
    if (n !== left) setLeft(n);
    if (status.code === 429 && calls.current.length < RATE_LIMIT) setStatus({ code: 0, retry: 0 });
  });

  const { texture } = useCanvas(
    1024,
    280,
    (ctx, cw, ch) => {
      ctx.fillStyle = "#1c120a";
      ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = palette.second;
      ctx.font = font(30, "700");
      ctx.fillText("RATE LIMIT · per API key", 30, 50);
      ctx.fillStyle = "#ffffff";
      ctx.font = font(90, "800");
      ctx.fillText(`${RATE_LIMIT} / min`, 30, 150);
      for (let i = 0; i < RATE_LIMIT; i++) {
        ctx.fillStyle = i < left ? accent : "#3a2a1c";
        ctx.beginPath();
        ctx.arc(560 + i * 90, 110, 32, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#b9a58a";
      ctx.font = font(24);
      ctx.fillText(`X-RateLimit-Remaining: ${left}`, 560, 180);
      const line = status.code === 429 ? `429 Too Many Requests · Retry-After: ${status.retry}` : status.code === 200 ? `200 OK · ${left} left in this window` : "Ready · press E to call GET /v1/orders";
      box(ctx, 20, 206, cw - 40, 58, 10, status.code === 429 ? "#7f1d1d" : status.code === 200 ? "#14532d" : "#2a1d12");
      ctx.fillStyle = status.code === 429 ? "#fecaca" : status.code === 200 ? "#bbf7d0" : "#e7d8c3";
      ctx.font = font(34, "700");
      ctx.fillText(line, 40, 247);
    },
    `${left}|${status.code}|${status.retry}|${accent}`,
  );

  const stone = flat("#e8dcc6", 0.85);
  const brass = flat(palette.second, 0.3, 0.85);
  const steel = flat("#c0c4ca", 0.25, 0.9);
  const px = Math.min(1.6, w / 2 - 0.5);
  return (
    <group onClick={(e) => clicked(e) && call()} {...pointer}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[px + 0.3, 1.3, 0.35]} position={[0, 1.3, 0]} />
      </RigidBody>
      {/* The gate */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * px, 0, 0]}>
          <mesh position={[0, 0.12, 0]} material={stone} castShadow>
            <boxGeometry args={[0.7, 0.24, 0.7]} />
          </mesh>
          <mesh position={[0, 1.45, 0]} material={stone} castShadow>
            <boxGeometry args={[0.5, 2.5, 0.5]} />
          </mesh>
          <mesh position={[0, 2.72, 0]} material={brass}>
            <boxGeometry args={[0.58, 0.06, 0.58]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 3.2, 0]} material={stone} castShadow>
        <boxGeometry args={[px * 2 + 0.7, 0.92, 0.55]} />
      </mesh>
      <mesh position={[0, 3.68, 0]} material={brass}>
        <boxGeometry args={[px * 2 + 0.8, 0.05, 0.6]} />
      </mesh>
      <mesh position={[0, 3.2, 0.28]}>
        <planeGeometry args={[Math.min(2.9, px * 2 + 0.4), 0.8]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      {/* The turnstile housing and its tripod rotor */}
      <group position={[-0.45, 0, 0]}>
        <mesh position={[0, 0.5, 0]} material={steel} castShadow>
          <boxGeometry args={[0.3, 1.0, 0.65]} />
        </mesh>
        <mesh position={[0, 1.01, 0]} material={flat(palette.ink, 0.4, 0.4)}>
          <boxGeometry args={[0.34, 0.04, 0.7]} />
        </mesh>
        <group position={[0.16, 0.92, 0]} rotation-z={Math.PI / 5}>
          <group ref={rotor}>
            <mesh rotation-z={Math.PI / 2} material={steel}>
              <cylinderGeometry args={[0.07, 0.07, 0.12, 16]} />
            </mesh>
            {[0, 1, 2].map((k) => (
              <group key={k} rotation-x={(k * Math.PI * 2) / 3}>
                <mesh position={[0.02, 0.32, 0]} material={steel} castShadow>
                  <cylinderGeometry args={[0.022, 0.022, 0.58, 10]} />
                </mesh>
              </group>
            ))}
          </group>
        </group>
        {/* The brass API-key reader */}
        <group position={[0, 1.2, 0.2]} rotation-x={-0.3}>
          <mesh material={brass} castShadow>
            <boxGeometry args={[0.24, 0.32, 0.08]} />
          </mesh>
          <mesh position={[0, 0.04, 0.042]} material={flat("#1c120a", 0.5)}>
            <boxGeometry args={[0.14, 0.02, 0.01]} />
          </mesh>
          <mesh position={[0, -0.08, 0.045]}>
            <circleGeometry args={[0.03, 14]} />
            <meshStandardMaterial ref={lamp} color="#facc15" emissive="#facc15" emissiveIntensity={1.6} />
          </mesh>
          <Text position={[0, 0.12, 0.045]} fontSize={0.035} color="#1c120a" anchorX="center" anchorY="middle">
            API KEY
          </Text>
        </group>
        <mesh position={[0, 1.07, 0.15]} material={brass}>
          <cylinderGeometry args={[0.02, 0.02, 0.1, 8]} />
        </mesh>
      </group>
      {/* The lane's floor mark */}
      <mesh position={[0.45, 0.005, 0.6]} rotation-x={-Math.PI / 2} material={flat(accent, 0.5)}>
        <planeGeometry args={[1.2, 0.08]} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// API development · The contract room (room)
// ---------------------------------------------------------------------------

/**
 * A signing desk under a large hanging scroll that shows the OpenAPI 3.1 contract for /orders,
 * with a quill in an inkwell. E signs the contract: the quill dips and writes on the desk's
 * sheet, then a red wax seal stamped "v1" appears on the scroll.
 */
const OPENAPI = [
  "openapi: 3.1.0",
  "info:",
  "  title: Orders API",
  "  version: 1.0.0",
  "paths:",
  "  /orders:",
  "    get:",
  "      summary: List orders",
  "      parameters:",
  "        - name: status",
  "          in: query",
  "          schema: { type: string }",
  "      responses:",
  "        '200': { description: A page of orders }",
  "    post:",
  "      summary: Create an order",
  "      requestBody:",
  "        required: true",
  "        content:",
  "          application/json:",
  "            schema: { $ref: '#/components/schemas/Order' }",
  "      responses:",
  "        '201': { description: Created }",
  "        '422': { description: Invalid order }",
];

function ContractRoom({ w, d, toHouse, label }: SigProps) {
  const { palette, accent } = useHouse();
  const [signed, setSigned] = useState(false);
  const signAt = useRef(-10);
  const sealed = useRef(true);
  const quill = useRef<THREE.Group>(null);
  const seal = useRef<THREE.Group>(null);
  const deskZ = -d / 2 + 1.9;
  const ink: V3 = [0.55, 0.78, 0.15];
  const sign = () => {
    if (now() - signAt.current < 2.8) return;
    signAt.current = now();
    sealed.current = false;
    setSigned(false);
    sfx.rustle();
  };
  const where = useWorldPoint(toHouse, 0, deskZ + 1.0);
  useProximity({ id: "api-contract", label: "Sign the contract", radius: 1.9, where, run: sign });

  useFrame(() => {
    const e = now() - signAt.current;
    if (quill.current) {
      // Dip, write a few strokes on the sheet, then back in the inkwell.
      const k = e < 0.5 ? ease(e / 0.5) : e < 1.9 ? 1 : 1 - ease((e - 1.9) / 0.5);
      const wx = e > 0.5 && e < 1.9 ? Math.sin((e - 0.5) * 14) * 0.05 + (e - 0.5) * 0.1 - 0.07 : 0;
      quill.current.position.set(ink[0] + (-0.05 + wx - ink[0]) * k, ink[1] + 0.12 + Math.sin(k * Math.PI) * 0.12 - k * 0.08, ink[2] + (0.1 - ink[2]) * k);
      quill.current.rotation.z = 0.35 + k * 0.15;
    }
    if (!sealed.current && e > 2.0) {
      sealed.current = true;
      setSigned(true);
      sfx.gong();
      burstAt(toHouse, 0, 1.4, -d / 2 + 0.4, ["#b91c1c", accent, palette.second], 14);
      toast("Contract v1 signed: clients can build against this OpenAPI spec today. Breaking changes ship as /v2 while v1 keeps working until clients move.", "📜 API contract");
    }
    const s = (now() - signAt.current - 2.0) / 0.3;
    if (seal.current) seal.current.scale.setScalar(signed ? (s < 1 ? 1 + Math.sin(s * Math.PI) * 0.4 : 1) : 0.001);
  });

  const sw = Math.min(2.4, w - 2.2);
  const sh = 2.4;
  const { texture } = useCanvas(
    900,
    Math.round((900 * sh) / sw),
    (ctx, cw, ch) => {
      ctx.fillStyle = "#f6ecd6";
      ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = "rgba(140,100,40,0.07)";
      for (let y = 0; y < ch; y += 7) ctx.fillRect(0, y, cw, 1);
      ctx.fillStyle = accent;
      ctx.font = font(44, "800");
      ctx.fillText(label, 40, 70);
      ctx.fillStyle = "#7a5a2a";
      ctx.font = font(24, "600");
      ctx.fillText("orders.openapi.yaml", 40, 108);
      const lh = Math.min(40, (ch - 230) / OPENAPI.length);
      ctx.font = `${Math.round(lh * 0.72)}px "Courier New", monospace`;
      OPENAPI.forEach((line, i) => {
        const y = 160 + i * lh;
        const m = line.match(/^(\s*-?\s*)([^:]+:)(.*)$/);
        if (!m) {
          ctx.fillStyle = "#3b2a1a";
          ctx.fillText(line, 40, y);
          return;
        }
        const indent = ctx.measureText(m[1]).width;
        ctx.fillStyle = "#3b2a1a";
        ctx.fillText(m[1], 40, y);
        ctx.fillStyle = "#9a3412";
        ctx.fillText(m[2], 40 + indent, y);
        ctx.fillStyle = "#1e40af";
        ctx.fillText(m[3], 40 + indent + ctx.measureText(m[2]).width, y);
      });
      ctx.strokeStyle = "#7a5a2a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(40, ch - 50);
      ctx.lineTo(cw * 0.55, ch - 50);
      ctx.stroke();
      ctx.fillStyle = "#7a5a2a";
      ctx.font = font(22);
      ctx.fillText(signed ? "Signed · API team & clients" : "Signature", 40, ch - 22);
    },
    `${signed}|${accent}|${label}`,
  );

  const wood = flat("#6b3e1f", 0.55);
  const brass = flat(palette.second, 0.3, 0.85);
  const scrollY = 2.15;
  const wallZ = -d / 2 + 0.14;
  return (
    <group>
      {/* The hanging scroll and its wax seal */}
      <mesh position={[0, scrollY, wallZ]}>
        <planeGeometry args={[sw, sh]} />
        <meshStandardMaterial map={texture} roughness={0.9} />
      </mesh>
      {[scrollY + sh / 2 + 0.04, scrollY - sh / 2 - 0.04].map((y) => (
        <group key={y} position={[0, y, wallZ + 0.04]}>
          <mesh rotation-z={Math.PI / 2} material={wood} castShadow>
            <cylinderGeometry args={[0.05, 0.05, sw + 0.14, 16]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * (sw / 2 + 0.1), 0, 0]} material={brass}>
              <sphereGeometry args={[0.065, 12, 10]} />
            </mesh>
          ))}
        </group>
      ))}
      <group ref={seal} position={[sw / 2 - 0.35, scrollY - sh / 2 + 0.3, wallZ + 0.03]} scale={0.001}>
        <mesh rotation-x={Math.PI / 2} material={flat("#9f1239", 0.35, 0.1)} castShadow>
          <cylinderGeometry args={[0.16, 0.17, 0.03, 24]} />
        </mesh>
        <mesh position={[0, 0, 0.016]} material={flat("#7f1d1d", 0.4)}>
          <ringGeometry args={[0.1, 0.12, 24]} />
        </mesh>
        <Text position={[0, 0, 0.02]} fontSize={0.1} color="#fecdd3" anchorX="center" anchorY="middle">
          v1
        </Text>
      </group>
      {/* The signing desk */}
      <group position={[0, 0, deskZ]} onClick={(e) => clicked(e) && sign()} {...pointer}>
        <Desk width={1.6} depth={0.8} pedestal={false} />
        <mesh position={[-0.05, 0.753, 0.1]} rotation-y={0.08} material={flat("#fbf5e6", 0.8)}>
          <boxGeometry args={[0.32, 0.004, 0.42]} />
        </mesh>
        {/* Inkwell */}
        <mesh position={[ink[0], 0.8, ink[2]]} material={flat("#14213d", 0.1, 0.3)} castShadow>
          <cylinderGeometry args={[0.05, 0.06, 0.09, 16]} />
        </mesh>
        <mesh position={[ink[0], 0.85, ink[2]]} material={brass}>
          <cylinderGeometry args={[0.025, 0.03, 0.02, 12]} />
        </mesh>
        {/* The quill */}
        <group ref={quill} position={[ink[0], ink[1] + 0.12, ink[2]]} rotation-z={0.35}>
          <mesh position={[0, 0.12, 0]} material={flat("#3b2a1a", 0.4)}>
            <cylinderGeometry args={[0.005, 0.003, 0.3, 6]} />
          </mesh>
          <mesh position={[0, 0.2, 0]} scale={[0.35, 1, 0.06]} material={flat("#f5f0e6", 0.8)}>
            <sphereGeometry args={[0.08, 12, 10]} />
          </mesh>
        </group>
        {/* The seal stamp */}
        <mesh position={[-0.55, 0.79, 0.15]} material={brass} castShadow>
          <cylinderGeometry args={[0.035, 0.045, 0.08, 14]} />
        </mesh>
        <mesh position={[-0.55, 0.87, 0.15]} material={wood}>
          <sphereGeometry args={[0.04, 12, 10]} />
        </mesh>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.8, 0.4, 0.4]} position={[0, 0.4, 0]} />
        </RigidBody>
      </group>
      <ExecChair position={[0, 0, deskZ - 0.78]} facing={0} leather="cognac" />
      <Rug position={[0, deskZ + 0.6]} width={Math.min(w - 2, 3.4)} depth={2.4} color="#7c2d12" border={palette.second} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// n8n · The workflow conveyor (hero)
// ---------------------------------------------------------------------------

/**
 * A roller conveyor running through four node machines (Webhook, AI Agent, IF, Slack), each with
 * an icon panel and a status lamp. E executes the workflow: a data packet rides the rollers, every
 * machine lights as it runs, and at IF the packet goes on to Slack (high priority) or drops into
 * the Done bin (low priority), alternately.
 */
type N8nNode = "webhook" | "agent" | "if" | "slack";
const N8N_NODES: { kind: N8nNode; name: string; detail: string }[] = [
  { kind: "webhook", name: "Webhook", detail: "POST /new-lead" },
  { kind: "agent", name: "AI Agent", detail: "summarize + tag" },
  { kind: "if", name: "IF", detail: "priority = high?" },
  { kind: "slack", name: "Slack", detail: "post to #sales" },
];

function drawN8nIcon(ctx: CanvasRenderingContext2D, kind: N8nNode, cx: number, cy: number, s: number, color: string) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = s * 0.1;
  ctx.lineCap = "round";
  ctx.beginPath();
  if (kind === "webhook") {
    ctx.arc(cx, cy - s * 0.15, s * 0.22, Math.PI * 0.8, Math.PI * 2.2);
    ctx.moveTo(cx - s * 0.32, cy + s * 0.35);
    ctx.lineTo(cx - s * 0.1, cy);
    ctx.moveTo(cx + s * 0.32, cy + s * 0.35);
    ctx.lineTo(cx - s * 0.32, cy + s * 0.35);
    ctx.stroke();
  } else if (kind === "agent") {
    box(ctx, cx - s * 0.36, cy - s * 0.28, s * 0.72, s * 0.58, s * 0.12, undefined, color, s * 0.1);
    ctx.arc(cx - s * 0.14, cy, s * 0.06, 0, Math.PI * 2);
    ctx.arc(cx + s * 0.14, cy, s * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.28);
    ctx.lineTo(cx, cy - s * 0.45);
    ctx.stroke();
  } else if (kind === "if") {
    ctx.moveTo(cx, cy - s * 0.4);
    ctx.lineTo(cx + s * 0.4, cy);
    ctx.lineTo(cx, cy + s * 0.4);
    ctx.lineTo(cx - s * 0.4, cy);
    ctx.closePath();
    ctx.stroke();
  } else {
    for (const o of [-0.13, 0.13]) {
      ctx.moveTo(cx + s * o, cy - s * 0.4);
      ctx.lineTo(cx + s * o, cy + s * 0.4);
      ctx.moveTo(cx - s * 0.4, cy + s * o);
      ctx.lineTo(cx + s * 0.4, cy + s * o);
    }
    ctx.stroke();
  }
}

function NodeMachine({ node, x, lampRef }: { node: (typeof N8N_NODES)[number]; x: number; lampRef: (m: THREE.MeshStandardMaterial | null) => void }) {
  const { palette, accent } = useHouse();
  const { texture } = useCanvas(
    400,
    360,
    (ctx, cw, ch) => {
      ctx.fillStyle = "#2a1621";
      ctx.fillRect(0, 0, cw, ch);
      box(ctx, 20, 20, cw - 40, 210, 26, "#ffffff");
      drawN8nIcon(ctx, node.kind, cw / 2, 125, 150, accent);
      ctx.fillStyle = "#ffffff";
      ctx.font = font(44, "800");
      ctx.textAlign = "center";
      ctx.fillText(node.name, cw / 2, 290);
      ctx.fillStyle = "#f9a8c0";
      ctx.font = font(26);
      ctx.fillText(node.detail, cw / 2, 332);
      ctx.textAlign = "left";
    },
    `${node.kind}|${accent}`,
  );
  const body = flat(palette.ink, 0.45, 0.3);
  return (
    <group position={[x, 0, 0]}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 0.82, s * 0.45]} material={body} castShadow>
          <boxGeometry args={[0.9, 1.64, 0.12]} />
        </mesh>
      ))}
      <mesh position={[0, 1.76, 0]} material={body} castShadow>
        <boxGeometry args={[0.96, 0.26, 1.04]} />
      </mesh>
      <mesh position={[0, 1.62, 0]} material={flat(accent, 0.4)}>
        <boxGeometry args={[0.98, 0.04, 1.06]} />
      </mesh>
      <mesh position={[0, 1.15, 0.512]}>
        <planeGeometry args={[0.76, 0.68]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.98, 0.2]}>
        <sphereGeometry args={[0.09, 16, 12]} />
        <meshStandardMaterial ref={lampRef} color="#22c55e" emissive="#22c55e" emissiveIntensity={0.15} roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.9, 0.2]} material={flat("#9ca3af", 0.3, 0.8)}>
        <cylinderGeometry args={[0.07, 0.08, 0.04, 14]} />
      </mesh>
    </group>
  );
}

type Key = { t: number; p: V3 };

function WorkflowConveyor({ w, d, toHouse }: SigProps) {
  const { palette, accent } = useHouse();
  const L = Math.min(w - 0.6, 8.4);
  const beltY = 0.85;
  const xs = N8N_NODES.map((_, i) => -L / 2 + (L * (i + 0.5)) / N8N_NODES.length);
  const binZ = 1.05;
  const binX = (xs[2] + xs[3]) / 2;
  const [running, setRunning] = useState(false);
  const run = useRef({ start: -1, keys: [] as Key[], arrivals: [] as number[], high: false, n: 0 });
  const packet = useRef<THREE.Group>(null);
  const lamps = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const rollers = useRef<(THREE.Mesh | null)[]>([]);
  const lampRefs = useMemo(
    () =>
      N8N_NODES.map((_, i) => (m: THREE.MeshStandardMaterial | null) => {
        lamps.current[i] = m;
      }),
    [],
  );

  const execute = () => {
    const r = run.current;
    if (r.start >= 0) return;
    const high = r.n % 2 === 0;
    r.n++;
    const y = beltY + 0.13;
    const keys: Key[] = [{ t: 0, p: [-L / 2 + 0.15, y, 0] }];
    const arrivals: number[] = [];
    let t = 0;
    let x = -L / 2 + 0.15;
    const visit = (i: number) => {
      t += Math.abs(xs[i] - x) / 1.8;
      x = xs[i];
      keys.push({ t, p: [x, y, 0] });
      arrivals[i] = t;
      t += 0.7;
      keys.push({ t, p: [x, y, 0] });
    };
    [0, 1, 2].forEach(visit);
    if (high) {
      visit(3);
      t += (L / 2 - 0.15 - x) / 1.8;
      keys.push({ t, p: [L / 2 - 0.15, y, 0] });
    } else {
      t += (binX - x) / 1.8;
      keys.push({ t, p: [binX, y, 0] });
      t += 0.4;
      keys.push({ t, p: [binX, y + 0.05, 0.6] });
      t += 0.45;
      keys.push({ t, p: [binX, 0.35, binZ] });
    }
    r.start = now();
    r.keys = keys;
    r.arrivals = arrivals;
    r.high = high;
    setRunning(true);
    sfx.click();
  };
  const where = useWorldPoint(toHouse, 0, Math.min(d / 2 - 0.4, 2.2));
  useProximity({ id: "n8n-conveyor", label: running ? "Workflow running…" : "Execute workflow", radius: 2.4, where, run: execute });

  useFrame((_, dt) => {
    const r = run.current;
    const e = r.start < 0 ? -1 : now() - r.start;
    rollers.current.forEach((m) => {
      if (m) m.rotation.y -= dt * (e >= 0 ? 6 : 0.6);
    });
    lamps.current.forEach((m, i) => {
      if (!m) return;
      const a = r.arrivals[i];
      m.emissiveIntensity = e >= 0 && a !== undefined && e >= a ? (e < a + 0.7 ? 2.6 : 1.0) : 0.15;
    });
    if (!packet.current) return;
    packet.current.visible = e >= 0;
    if (e < 0) return;
    const keys = r.keys;
    const end = keys[keys.length - 1].t;
    if (e >= end + 0.4) {
      r.start = -1;
      setRunning(false);
      sfx.sparkle();
      toast(
        r.high
          ? "Executed: Webhook → AI Agent → IF (true) → Slack. 4 nodes succeeded; #sales got the high-priority lead."
          : "Executed: Webhook → AI Agent → IF (false). The lead was low priority, so it took the false branch and ended there, no Slack ping.",
        "⚙️ n8n workflow",
      );
      return;
    }
    let k = 1;
    while (k < keys.length - 1 && keys[k].t < e) k++;
    const a = keys[k - 1];
    const b = keys[k];
    const q = b.t > a.t ? Math.min(1, Math.max(0, (e - a.t) / (b.t - a.t))) : 1;
    packet.current.position.set(a.p[0] + (b.p[0] - a.p[0]) * q, a.p[1] + (b.p[1] - a.p[1]) * q, a.p[2] + (b.p[2] - a.p[2]) * q);
  });

  const steel = flat("#9ca3af", 0.3, 0.85);
  const frame = flat("#374151", 0.5, 0.6);
  const rollerCount = Math.floor(L / 0.4);
  const legs = Math.max(2, Math.round(L / 1.4) + 1);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[L / 2, 1.0, 0.55]} position={[0, 1.0, 0]} />
        <CuboidCollider args={[0.33, 0.3, 0.27]} position={[binX, 0.3, binZ]} />
      </RigidBody>
      {/* The frame, its legs and the rollers */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, beltY - 0.04, s * 0.34]} material={frame} castShadow>
          <boxGeometry args={[L, 0.12, 0.05]} />
        </mesh>
      ))}
      {Array.from({ length: legs }, (_, i) => {
        const x = -L / 2 + 0.1 + (i * (L - 0.2)) / (legs - 1);
        return [-1, 1].map((s) => (
          <mesh key={`${i}${s}`} position={[x, (beltY - 0.1) / 2, s * 0.32]} material={frame}>
            <boxGeometry args={[0.06, beltY - 0.1, 0.06]} />
          </mesh>
        ));
      })}
      {Array.from({ length: rollerCount }, (_, i) => (
        <group key={i} position={[-L / 2 + 0.2 + (i * (L - 0.4)) / (rollerCount - 1), beltY, 0]} rotation-x={Math.PI / 2}>
          <mesh
            ref={(m) => {
              rollers.current[i] = m;
            }}
            material={steel}
          >
            <cylinderGeometry args={[0.05, 0.05, 0.64, 12]} />
          </mesh>
        </group>
      ))}
      {N8N_NODES.map((n, i) => (
        <NodeMachine key={n.kind} node={n} x={xs[i]} lampRef={lampRefs[i]} />
      ))}
      {/* The data packet */}
      <group ref={packet} visible={false}>
        <mesh material={flat(accent, 0.3, 0, accent, 1.4)} castShadow>
          <boxGeometry args={[0.22, 0.16, 0.22]} />
        </mesh>
        <mesh position={[0, 0.081, 0]} rotation-x={-Math.PI / 2} material={flat("#ffffff", 0.4)}>
          <planeGeometry args={[0.14, 0.03]} />
        </mesh>
      </group>
      {/* The Done bin for the IF node's false branch */}
      <group position={[binX, 0, binZ]}>
        <mesh position={[0, 0.03, 0]} material={frame}>
          <boxGeometry args={[0.62, 0.06, 0.5]} />
        </mesh>
        {[
          [0, 0.25, 0.24, 0.62, 0.5, 0.03],
          [0, 0.25, -0.24, 0.62, 0.5, 0.03],
          [0.3, 0.25, 0, 0.03, 0.5, 0.5],
          [-0.3, 0.25, 0, 0.03, 0.5, 0.5],
        ].map(([x, y, z, bx, by, bz], i) => (
          <mesh key={i} position={[x, y, z]} material={flat(palette.second, 0.5)} castShadow>
            <boxGeometry args={[bx, by, bz]} />
          </mesh>
        ))}
        <Text position={[0, 0.3, 0.26]} fontSize={0.1} color="#ffffff" anchorX="center" anchorY="middle">
          Done (false)
        </Text>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// n8n · The AI agent booth (room)
// ---------------------------------------------------------------------------

/**
 * A friendly robot behind a desk, with four tools on stands around it: Search, Database, Email
 * and Calendar. E asks it something: it thinks, turns to the tool that fits, the tool lights up,
 * and it answers, the way an AI Agent node picks a tool for each task.
 */
type AgentTool = "Search" | "Database" | "Email" | "Calendar";
const AGENT_TOOLS: AgentTool[] = ["Search", "Database", "Email", "Calendar"];
const AGENT_TASKS: { q: string; tool: number; a: string }[] = [
  { q: "Find the latest Next.js release notes", tool: 0, a: "searched the web and summed up the top result in three bullets." },
  { q: "How many leads came in this week?", tool: 1, a: "queried the leads table and counted this week's rows." },
  { q: "Email the summary to Omar", tool: 2, a: "drafted the email and sent it to Omar." },
  { q: "Book a call with Lina on Friday", tool: 3, a: "found a free slot on Friday at 10:00 and sent the invite." },
];

function ToolIconMesh({ tool, material }: { tool: AgentTool; material: THREE.Material }) {
  if (tool === "Search")
    return (
      <group>
        <mesh material={material}>
          <torusGeometry args={[0.1, 0.025, 8, 24]} />
        </mesh>
        <mesh position={[0.1, -0.1, 0]} rotation-z={Math.PI / 4} material={material}>
          <cylinderGeometry args={[0.02, 0.02, 0.14, 8]} />
        </mesh>
      </group>
    );
  if (tool === "Database")
    return (
      <group>
        {[-0.08, 0, 0.08].map((y) => (
          <mesh key={y} position={[0, y, 0]} material={material}>
            <cylinderGeometry args={[0.11, 0.11, 0.06, 20]} />
          </mesh>
        ))}
      </group>
    );
  if (tool === "Email")
    return (
      <group>
        <mesh material={material}>
          <boxGeometry args={[0.26, 0.17, 0.03]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.065, 0.035, 0.018]} rotation-z={s * 0.55} material={flat("#ffffff", 0.5)}>
            <boxGeometry args={[0.15, 0.012, 0.005]} />
          </mesh>
        ))}
      </group>
    );
  return (
    <group>
      <mesh material={material}>
        <boxGeometry args={[0.24, 0.22, 0.04]} />
      </mesh>
      <mesh position={[0, 0.08, 0.022]} material={flat("#ef4444", 0.5)}>
        <boxGeometry args={[0.24, 0.06, 0.005]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.06, 0.12, 0]} material={flat("#d1d5db", 0.3, 0.8)}>
          <cylinderGeometry args={[0.012, 0.012, 0.06, 6]} />
        </mesh>
      ))}
    </group>
  );
}

function AgentBooth({ w, d, toHouse }: SigProps) {
  const { palette, accent } = useHouse();
  const robotZ = -d / 2 + 0.55;
  const deskZ = -d / 2 + 1.25;
  const spots: [number, number][] = [
    [-w / 2 + 0.6, -d / 2 + 0.7],
    [-w / 2 + 0.6, -d / 2 + 2.2],
    [w / 2 - 0.6, -d / 2 + 0.7],
    [w / 2 - 0.6, -d / 2 + 2.2],
  ];
  const [face, setFace] = useState<"idle" | "think" | "happy">("idle");
  const [active, setActive] = useState(-1);
  const ask = useRef({ start: -1, task: 0, n: 0, picked: false, answered: false });
  const head = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const toolMats = useMemo(() => AGENT_TOOLS.map(() => new THREE.MeshStandardMaterial({ color: "#9ca3af", emissive: accent, emissiveIntensity: 0, roughness: 0.4, metalness: 0.3 })), [accent]);
  const askAgent = () => {
    const a = ask.current;
    if (a.start >= 0) return;
    a.task = a.n++ % AGENT_TASKS.length;
    a.start = now();
    a.picked = false;
    a.answered = false;
    setFace("think");
    setActive(-1);
    sfx.talk();
  };
  const where = useWorldPoint(toHouse, 0, deskZ + 1.1);
  useProximity({ id: "n8n-agent", label: "Ask the agent", radius: 1.8, where, run: askAgent });

  useFrame((_, dt) => {
    const t = now();
    const a = ask.current;
    const e = a.start < 0 ? -1 : t - a.start;
    const task = AGENT_TASKS[a.task];
    if (e >= 0.9 && !a.picked) {
      a.picked = true;
      setActive(task.tool);
      sfx.chirp();
    }
    if (e >= 2.0 && !a.answered) {
      a.answered = true;
      setFace("happy");
      sfx.pop();
      toast(`"${task.q}" → picked the ${AGENT_TOOLS[task.tool]} tool and ${task.a}`, "🤖 AI Agent");
    }
    if (e >= 3.4) {
      a.start = -1;
      setFace("idle");
      setActive(-1);
    }
    let target = Math.sin(t * 0.5) * 0.15;
    if (e >= 0 && e < 0.9) target = Math.sin(e * 9) * 0.6;
    else if (e >= 0.9) {
      const [tx, tz] = spots[task.tool];
      target = Math.atan2(tx, tz - robotZ);
      target = Math.max(-1.7, Math.min(1.7, target));
    }
    if (head.current) head.current.rotation.y += (target * 0.6 - head.current.rotation.y) * Math.min(1, dt * 6);
    if (torso.current) torso.current.rotation.y += (target * 0.4 - torso.current.rotation.y) * Math.min(1, dt * 4);
    toolMats.forEach((m, i) => {
      m.emissiveIntensity = i === active ? 1.6 + Math.sin(t * 8) * 0.4 : 0;
      m.color.set(i === active ? accent : "#9ca3af");
    });
  });

  const screen = useCanvas(
    256,
    160,
    (ctx, cw, ch) => {
      ctx.fillStyle = "#0b1020";
      ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = "#7dd3fc";
      ctx.strokeStyle = "#7dd3fc";
      ctx.lineWidth = 10;
      ctx.lineCap = "round";
      if (face === "think") {
        [-50, 0, 50].forEach((o) => {
          ctx.beginPath();
          ctx.arc(cw / 2 + o, ch / 2, 12, 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (face === "happy") {
        [-50, 50].forEach((o) => {
          ctx.beginPath();
          ctx.arc(cw / 2 + o, ch / 2 + 6, 22, Math.PI * 1.1, Math.PI * 1.9);
          ctx.stroke();
        });
      } else {
        [-50, 50].forEach((o) => box(ctx, cw / 2 + o - 14, ch / 2 - 26, 28, 52, 14, "#7dd3fc"));
      }
    },
    face,
  );

  const white = flat("#f3f4f6", 0.35, 0.2);
  const joint = flat(palette.ink, 0.4, 0.5);
  return (
    <group>
      {/* The robot */}
      <group position={[0, 0, robotZ]}>
        <mesh position={[0, 0.04, 0]} material={joint}>
          <cylinderGeometry args={[0.3, 0.34, 0.08, 24]} />
        </mesh>
        <mesh position={[0, 0.45, 0]} material={joint}>
          <cylinderGeometry args={[0.08, 0.1, 0.8, 12]} />
        </mesh>
        <group ref={torso} position={[0, 1.15, 0]}>
          <mesh material={white} castShadow>
            <boxGeometry args={[0.56, 0.66, 0.36]} />
          </mesh>
          <mesh position={[0, 0.06, 0.185]} material={flat(accent, 0.3, 0, accent, 0.9)}>
            <circleGeometry args={[0.07, 18]} />
          </mesh>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.34, 0.24, 0]}>
              <mesh material={joint}>
                <sphereGeometry args={[0.08, 14, 10]} />
              </mesh>
              <mesh position={[s * 0.02, -0.2, 0.14]} rotation-x={-0.9} material={white} castShadow>
                <capsuleGeometry args={[0.055, 0.32, 4, 10]} />
              </mesh>
              <mesh position={[s * 0.02, -0.34, 0.33]} material={joint}>
                <sphereGeometry args={[0.065, 12, 10]} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 0.38, 0]} material={joint}>
            <cylinderGeometry args={[0.06, 0.06, 0.1, 10]} />
          </mesh>
        </group>
        <group ref={head} position={[0, 1.72, 0]}>
          <mesh material={white} castShadow>
            <boxGeometry args={[0.5, 0.38, 0.38]} />
          </mesh>
          <mesh position={[0, 0, 0.192]}>
            <planeGeometry args={[0.42, 0.27]} />
            <meshBasicMaterial map={screen.texture} toneMapped={false} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.27, 0, 0]} rotation-z={Math.PI / 2} material={joint}>
              <cylinderGeometry args={[0.06, 0.06, 0.05, 14]} />
            </mesh>
          ))}
          <mesh position={[0, 0.27, 0]} material={joint}>
            <cylinderGeometry args={[0.01, 0.01, 0.16, 6]} />
          </mesh>
          <mesh position={[0, 0.36, 0]} material={flat(accent, 0.3, 0, accent, face === "think" ? 2.5 : 1)}>
            <sphereGeometry args={[0.04, 12, 10]} />
          </mesh>
        </group>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.32, 1, 0.25]} position={[0, 1, 0]} />
        </RigidBody>
      </group>
      {/* The desk */}
      <group position={[0, 0, deskZ]} onClick={(e) => clicked(e) && askAgent()} {...pointer}>
        <Desk width={1.4} depth={0.7} pedestal={false} />
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.7, 0.4, 0.35]} position={[0, 0.4, 0]} />
        </RigidBody>
      </group>
      <Text position={[0, 0.6, deskZ + 0.36]} fontSize={0.09} color={palette.paper} anchorX="center" anchorY="middle" outlineWidth={0.004} outlineColor={palette.ink}>
        AI Agent · tools: 4
      </Text>
      {/* The tools on their stands */}
      {AGENT_TOOLS.map((tool, i) => {
        const [x, z] = spots[i];
        return (
          <group key={tool} position={[x, 0, z]} rotation-y={x < 0 ? Math.PI / 2 - 0.4 : -Math.PI / 2 + 0.4}>
            <mesh position={[0, 0.02, 0]} material={joint}>
              <cylinderGeometry args={[0.2, 0.22, 0.04, 20]} />
            </mesh>
            <mesh position={[0, 0.55, 0]} material={flat("#d1d5db", 0.3, 0.8)}>
              <cylinderGeometry args={[0.025, 0.025, 1.05, 8]} />
            </mesh>
            <mesh position={[0, 1.08, 0]} material={joint}>
              <cylinderGeometry args={[0.18, 0.18, 0.03, 20]} />
            </mesh>
            <group position={[0, 1.32, 0]}>
              <ToolIconMesh tool={tool} material={toolMats[i]} />
            </group>
            <Text position={[0, 0.95, 0.04]} fontSize={0.08} color={i === active ? accent : palette.paper} anchorX="center" anchorY="middle" outlineWidth={0.004} outlineColor={palette.ink}>
              {tool}
            </Text>
          </group>
        );
      })}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Architecture · The scale model (room)
// ---------------------------------------------------------------------------

/**
 * A glass display table with a layered scale model of a system: clients on top, then the API
 * gateway, the services, a queue and the database, each a translucent plate with tiny blocks on it.
 * E traces a request: a glowing dot drops through the layers and back up while the board explains
 * each hop.
 */
const ARCH_LAYERS = [
  { name: "Clients", hop: "The browser sends POST /orders with a JWT." },
  { name: "API gateway", hop: "The gateway checks the token and the rate limit, then routes to the orders service." },
  { name: "Services", hop: "The orders service validates the order and puts a job on the queue." },
  { name: "Queue", hop: "The queue absorbs spikes; a worker takes the job when it's free." },
  { name: "Database", hop: "The worker writes the order to Postgres in one transaction." },
];

function ScaleModel({ w, d, toHouse, label }: SigProps) {
  const { palette, accent } = useHouse();
  const tw = Math.min(w - 3, 3.2);
  const td = 1.8;
  const tz = -d / 2 + 2.6;
  const pw = tw - 0.5;
  const pd = td - 0.4;
  const levels = ARCH_LAYERS.map((_, i) => 2.25 - i * 0.3);
  const stops: V3[] = [
    [-pw * 0.3, levels[0] + 0.1, 0],
    [0, levels[1] + 0.12, 0],
    [pw * 0.25, levels[2] + 0.14, 0],
    [0.05, levels[3] + 0.08, 0],
    [-pw * 0.2, levels[4] + 0.12, 0],
  ];
  const [hop, setHop] = useState(-1);
  const trace = useRef({ start: -1, last: -1 });
  const dot = useRef<THREE.Mesh>(null);
  const path = [...stops, ...stops.slice(0, -1).reverse()];
  const run = () => {
    if (trace.current.start >= 0) return;
    trace.current = { start: now(), last: -1 };
    sfx.click();
  };
  const where = useWorldPoint(toHouse, 0, tz + td / 2 + 0.9);
  useProximity({ id: "arch-model", label: "Trace a request", radius: 2, where, run });

  useFrame(() => {
    const tr = trace.current;
    if (!dot.current) return;
    dot.current.visible = tr.start >= 0;
    if (tr.start < 0) return;
    const e = (now() - tr.start) / 0.9;
    const seg = Math.floor(e);
    if (seg >= path.length - 1) {
      tr.start = -1;
      setHop(ARCH_LAYERS.length);
      sfx.sparkle();
      toast(`Request traced: ${ARCH_LAYERS.map((l) => l.name).join(" → ")}, then 202 Accepted back up the same path. The queue lets the API answer fast while the write happens behind it.`, "🏛️ Scale model");
      return;
    }
    if (seg !== tr.last) {
      tr.last = seg;
      setHop(seg < ARCH_LAYERS.length ? seg : ARCH_LAYERS.length);
      sfx.pop();
      burstAt(toHouse, path[seg][0], path[seg][1], tz + path[seg][2], [accent, "#ffffff"], 6);
    }
    const a = path[seg];
    const b = path[seg + 1];
    const q = ease(e - seg);
    dot.current.position.set(a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q, a[2] + (b[2] - a[2]) * q);
  });

  const plate = useMemo(() => ({ color: accent, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.1, depthWrite: false }), [accent]);
  const block = flat(palette.paper, 0.4, 0.1);
  const tealBlock = flat(accent, 0.35, 0.1, accent, 0.3);
  const steel = flat("#94a3b8", 0.3, 0.85);
  const lines = [...ARCH_LAYERS.map((l) => `${l.name}: ${l.hop}`), "Back up: 202 Accepted, the order is on its way."];
  return (
    <group>
      <NoteBoard position={[0, 2.1, -d / 2 + 0.12]} width={Math.min(w - 2, 4.2)} height={1.7} kicker={label} title="Trace a request" lines={lines} current={hop} dark />
      <group position={[0, 0, tz]}>
        {/* The display table */}
        {[-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) => (
            <mesh key={`${sx}${sz}`} position={[sx * (tw / 2 - 0.08), 0.42, sz * (td / 2 - 0.08)]} material={steel} castShadow>
              <boxGeometry args={[0.05, 0.84, 0.05]} />
            </mesh>
          )),
        )}
        <mesh position={[0, 0.84, 0]} material={steel}>
          <boxGeometry args={[tw, 0.04, td]} />
        </mesh>
        <mesh position={[0, 0.875, 0]}>
          <boxGeometry args={[tw - 0.06, 0.03, td - 0.06]} />
          <meshStandardMaterial color="#cffafe" transparent opacity={0.35} roughness={0.05} depthWrite={false} />
        </mesh>
        {/* Acrylic rods holding the layers */}
        {[-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) => (
            <mesh key={`r${sx}${sz}`} position={[sx * (pw / 2 - 0.05), (0.89 + levels[0]) / 2, sz * (pd / 2 - 0.05)]}>
              <cylinderGeometry args={[0.012, 0.012, levels[0] - 0.89, 6]} />
              <meshStandardMaterial color="#e0f2fe" transparent opacity={0.5} depthWrite={false} />
            </mesh>
          )),
        )}
        {ARCH_LAYERS.map((l, i) => (
          <group key={l.name} position={[0, levels[i], 0]}>
            <mesh>
              <boxGeometry args={[pw, 0.02, pd]} />
              <meshStandardMaterial {...plate} opacity={hop === i ? 0.42 : 0.18} />
            </mesh>
            <Text position={[-pw / 2 - 0.05, 0.02, pd / 2 - 0.05]} fontSize={0.08} color={hop === i ? accent : palette.paper} anchorX="right" anchorY="middle" outlineWidth={0.003} outlineColor={palette.ink}>
              {l.name}
            </Text>
          </group>
        ))}
        {/* Tiny blocks: devices, the gateway, services, queued jobs and the database */}
        <mesh position={[-pw * 0.3, levels[0] + 0.07, 0]} material={block}>
          <boxGeometry args={[0.07, 0.12, 0.02]} />
        </mesh>
        <mesh position={[0, levels[0] + 0.03, 0]} material={block}>
          <boxGeometry args={[0.22, 0.03, 0.15]} />
        </mesh>
        <mesh position={[pw * 0.3, levels[0] + 0.07, 0]} material={block}>
          <boxGeometry args={[0.24, 0.12, 0.03]} />
        </mesh>
        <mesh position={[0, levels[1] + 0.06, 0]} material={tealBlock}>
          <boxGeometry args={[0.5, 0.1, 0.18]} />
        </mesh>
        {[-0.25, 0.0, 0.25].map((f, i) => (
          <mesh key={f} position={[f * pw, levels[2] + 0.05 + i * 0.02, 0]} material={i === 2 ? tealBlock : block}>
            <boxGeometry args={[0.18, 0.08 + i * 0.04, 0.18]} />
          </mesh>
        ))}
        <mesh position={[0.05, levels[3] + 0.04, 0]} rotation-z={Math.PI / 2} material={steel}>
          <cylinderGeometry args={[0.035, 0.035, pw * 0.7, 12]} />
        </mesh>
        {[-3, -2, -1, 0, 1, 2].map((k) => (
          <mesh key={k} position={[0.05 + k * 0.1 + 0.05, levels[3] + 0.04, 0.08]} material={tealBlock}>
            <boxGeometry args={[0.05, 0.05, 0.05]} />
          </mesh>
        ))}
        {[-0.2, 0.15].map((f) => (
          <mesh key={f} position={[f * pw, levels[4] + 0.07, 0]} material={block}>
            <cylinderGeometry args={[0.1, 0.1, 0.12, 20]} />
          </mesh>
        ))}
        <mesh ref={dot} visible={false} material={flat("#ffffff", 0.2, 0, accent, 3)}>
          <sphereGeometry args={[0.045, 14, 10]} />
        </mesh>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[tw / 2, 0.6, td / 2]} position={[0, 0.6, 0]} />
        </RigidBody>
      </group>
      <Rug position={[0, tz]} width={tw + 1.8} depth={td + 1.8} color={palette.second} border={accent} />
    </group>
  );
}

export const MORE: Record<string, SigComponent> = {
  "redux-clock": TimeMachineClock,
  "redux-log": ActionLog,
  "zustand-bear": HoneyBear,
  "gcp-launch": LaunchPad,
  "gcp-pubsub": PubSubPost,
  "cpanel-icons": IconKiosk,
  "cpanel-files": FileRoom,
  "aapanel-nginx": NginxCrossing,
  "aapanel-ssl": CertificateWall,
  "figma-cursors": MultiplayerCanvas,
  "figma-components": ComponentLibrary,
  "figma-prototype": PrototypeRoom,
  "ux-journey": JourneyPath,
  "ux-mirror": UsabilityRoom,
  "ux-personas": PersonaWall,
  "sd-erd": ErdFloor,
  "sd-dfd": DataFlowRoom,
  "api-turnstile": RateLimitGate,
  "api-contract": ContractRoom,
  "n8n-conveyor": WorkflowConveyor,
  "n8n-agent": AgentBooth,
  "arch-model": ScaleModel,
};
