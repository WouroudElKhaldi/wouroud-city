"use client";

import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useCityStore } from "@/state/useCityStore";
import { NPC_PEOPLE } from "@/world/outfits";
import { sfx } from "@/world/sfx";
import { BeanBag, ConferenceChair, ExecChair, SideChair, Table, TallPlant } from "../../Furniture";
import { Person } from "../../Person";
import { box, font, Panel, useCanvas, wrap } from "../../roomKit";
import { Seats } from "../../StreetDetails";
import { Text } from "../../Text3D";
import { useProximity } from "../../useProximity";
import { flat } from "../finishKit";
import { burstAt, clicked, pointer, seatAt, useWorldPoint, WallBoard } from "../modules";
import { useHouse } from "../SkillHouse";
import type { SigComponent, SigProps } from "./types";

/** Signature pieces for the tools: Docker, Git, GitHub/GitLab, Jira, REST and GraphQL. */

const toast = (text: string, title?: string) => useCityStore.getState().toast(text, title);
const now = () => performance.now() / 1000;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Merges a list of geometries into one (and frees the parts). */
function merged(parts: THREE.BufferGeometry[]) {
  const geo = mergeGeometries(parts) ?? new THREE.BufferGeometry();
  parts.forEach((p) => p.dispose());
  return geo;
}

/** A box placed at a point (for merged geometry). */
function boxAt(sx: number, sy: number, sz: number, x: number, y: number, z: number, rotY = 0) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  if (rotY) g.rotateY(rotY);
  g.translate(x, y, z);
  return g;
}

/** A cylinder standing at a point (for merged geometry). */
function cylAt(r: number, h: number, x: number, y: number, z: number, axis: "x" | "y" | "z" = "y", seg = 8) {
  const g = new THREE.CylinderGeometry(r, r, h, seg);
  if (axis === "x") g.rotateZ(Math.PI / 2);
  if (axis === "z") g.rotateX(Math.PI / 2);
  g.translate(x, y, z);
  return g;
}

/** Disposes a memoized geometry (or material) when it changes or unmounts. */
function useDispose(...items: { dispose: () => void }[]) {
  useEffect(() => () => items.forEach((it) => it.dispose()), items); // eslint-disable-line react-hooks/exhaustive-deps
}

// Status light colors shared by the pieces.
const LAMP_OFF = "#3a3f45";
const GREEN = "#2da44e";
const YELLOW = "#d29922";
const RED = "#cf222e";
const lamp = (color: string) => flat(color, 0.3, 0, color, 1.8);
const lampOff = () => flat(LAMP_OFF, 0.5, 0.2);

// ---------------------------------------------------------------------------
// Docker · The Crane (hero)
// ---------------------------------------------------------------------------

/**
 * A yellow-and-blue gantry crane over a stack of shipping containers, one per service. E runs
 * `docker compose up`: the crane lifts the containers one by one (dependencies first) and sets them
 * in a row, each lighting its green "running" lamp. Again runs `down` and stacks them back.
 */
const SERVICES = ["db", "redis", "api", "worker", "web"];
const BOX_COLORS = ["#2f8f5b", "#c8412f", "#2496ed", "#e08a2c", "#6b7a88"];
const CRANE_YELLOW = "#f2c230";

type CraneJob = { c: number; up: boolean; from: [number, number]; to: [number, number]; t0: number; trolley0: number; hook0: number };

function DockerCrane({ w, d, toHouse }: SigProps) {
  const { palette, accent } = useHouse();
  const S = Math.min(w / 2 - 0.3, 4.2);
  const Z = Math.min(d / 2 - 0.6, 1.4);
  const GY = 4.5;
  const L = 1.5;
  const H = 0.62;
  const stackX = -S + 0.85;
  const rowX0 = stackX + 1.3;
  const spacing = (S - 0.7 - rowX0) / 4;
  const W = Math.min(0.72, spacing - 0.1);
  const clearY = 4 * H + H / 2 + 0.25;
  const stackY = (c: number) => H / 2 + (4 - c) * H;
  const rowX = (c: number) => rowX0 + c * spacing;

  const [running, setRunning] = useState<boolean[]>(() => SERVICES.map(() => false));
  const [busy, setBusy] = useState(false);
  const inRow = useRef(SERVICES.map(() => false));
  const queue = useRef<{ c: number; up: boolean }[]>([]);
  const job = useRef<CraneJob | null>(null);
  const trolleyX = useRef(0);
  const hookY = useRef(GY - 0.9);
  const boxes = useRef<(THREE.Group | null)[]>([]);
  const trolley = useRef<THREE.Group>(null);
  const cable = useRef<THREE.Group>(null);
  const spreader = useRef<THREE.Group>(null);
  const allUp = running.every(Boolean);

  const body = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [new THREE.BoxGeometry(W, H, L)];
    const ribs = 10;
    for (let i = 0; i < ribs; i++) {
      const z = -L / 2 + 0.1 + (i * (L - 0.2)) / (ribs - 1);
      for (const s of [-1, 1]) parts.push(boxAt(0.024, H - 0.1, 0.05, s * (W / 2 + 0.01), 0, z));
    }
    for (const s of [-1, 1]) parts.push(boxAt(W + 0.03, 0.05, L + 0.02, 0, s * (H / 2 - 0.02), 0));
    for (const s of [-1, 1]) for (const e of [-1, 1]) parts.push(boxAt(0.06, H + 0.02, 0.06, s * (W / 2 - 0.02), 0, e * (L / 2 - 0.02)));
    // The doors on the +z end: a seam and four locking bars with handles
    parts.push(boxAt(0.012, H - 0.08, 0.012, 0, 0, L / 2 + 0.006));
    for (const k of [-0.36, -0.14, 0.14, 0.36]) {
      parts.push(cylAt(0.011, H - 0.1, k * W, 0, L / 2 + 0.025));
      parts.push(boxAt(0.05, 0.02, 0.02, k * W + 0.03, -0.05, L / 2 + 0.04));
    }
    return merged(parts);
  }, [W, H, L]);
  useDispose(body);

  const run = () => {
    if (busy) return;
    const up = !allUp;
    const order = up ? [0, 1, 2, 3, 4] : [4, 3, 2, 1, 0];
    queue.current = order.filter((c) => inRow.current[c] !== up).map((c) => ({ c, up }));
    if (!queue.current.length) return;
    setBusy(true);
    sfx.click();
  };
  const where = useWorldPoint(toHouse, 0, d / 2 - 0.5);
  useProximity({ id: "docker-crane", label: busy ? "The crane is busy…" : allUp ? "docker compose down" : "docker compose up", radius: 2.4, where, run });

  useFrame((_, delta) => {
    const t = now();
    if (!job.current && queue.current.length) {
      const next = queue.current.shift();
      if (next) {
        const from: [number, number] = next.up ? [stackX, stackY(next.c)] : [rowX(next.c), H / 2];
        const to: [number, number] = next.up ? [rowX(next.c), H / 2] : [stackX, stackY(next.c)];
        job.current = { ...next, from, to, t0: t, trolley0: trolleyX.current, hook0: hookY.current };
        if (!next.up) setRunning((r) => r.map((v, i) => (i === next.c ? false : v)));
      }
    }
    const j = job.current;
    let carried = -1;
    let cx = 0;
    let cy = 0;
    if (j) {
      const u = (t - j.t0) / 3;
      const [fx, fy] = j.from;
      const [tx, ty] = j.to;
      if (u < 0.22) {
        const a = ease(u / 0.22);
        trolleyX.current = lerp(j.trolley0, fx, a);
        hookY.current = lerp(j.hook0, fy + H / 2, a);
      } else {
        carried = j.c;
        if (u < 0.42) [cx, cy] = [fx, lerp(fy, clearY, ease((u - 0.22) / 0.2))];
        else if (u < 0.72) [cx, cy] = [lerp(fx, tx, ease((u - 0.42) / 0.3)), clearY];
        else [cx, cy] = [tx, lerp(clearY, ty, ease((u - 0.72) / 0.28))];
        trolleyX.current = cx;
        hookY.current = cy + H / 2;
      }
      if (u >= 1) {
        inRow.current[j.c] = j.up;
        const c = j.c;
        job.current = null;
        sfx.clunk();
        if (j.up) {
          setRunning((r) => r.map((v, i) => (i === c ? true : v)));
          burstAt(toHouse, tx, 1, 0, [GREEN, "#ffffff"], 8);
        }
        if (!queue.current.length) {
          setBusy(false);
          if (j.up) toast("db and redis first, then api, worker and web: Compose starts services in dependency order (depends_on). All 5 running.", "🐳 docker compose up");
          else toast("docker compose down stopped and removed the containers and their network. Named volumes survive unless you add -v.", "🐳 docker compose down");
        }
      }
    } else hookY.current = THREE.MathUtils.damp(hookY.current, GY - 0.9, 2, delta);

    SERVICES.forEach((_, c) => {
      const g = boxes.current[c];
      if (!g) return;
      if (c === carried) g.position.set(cx, cy, 0);
      else if (inRow.current[c]) g.position.set(rowX(c), H / 2, 0);
      else g.position.set(stackX, stackY(c), 0);
    });
    if (trolley.current) trolley.current.position.x = trolleyX.current;
    if (spreader.current) spreader.current.position.y = hookY.current + 0.05;
    if (cable.current) {
      const top = GY - 0.05;
      const len = Math.max(0.05, top - hookY.current - 0.1);
      cable.current.position.y = top - len / 2;
      cable.current.scale.y = len;
    }
  });

  const yellow = flat(CRANE_YELLOW, 0.45, 0.35);
  const steel = flat("#2b3036", 0.45, 0.7);
  return (
    <group onClick={(e) => clicked(e) && run()} {...pointer}>
      <RigidBody type="fixed" colliders={false}>
        {[-S, S].flatMap((x) => [-Z, Z].map((z) => <CuboidCollider key={`${x}${z}`} args={[0.14, GY / 2, 0.14]} position={[x, GY / 2, z]} />))}
        <CuboidCollider args={[(rowX(4) - stackX) / 2 + W / 2 + 0.1, 0.6, L / 2]} position={[(rowX(4) + stackX) / 2, 0.6, 0]} />
      </RigidBody>
      {/* The gantry: four legs on rail bogies, end beams and twin girders */}
      {[-S, S].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          {[-Z, Z].map((z) => (
            <group key={z}>
              <mesh position={[0, GY / 2, z]} material={yellow} castShadow>
                <boxGeometry args={[0.2, GY, 0.2]} />
              </mesh>
              <mesh position={[0, 0.12, z]} material={steel} castShadow>
                <boxGeometry args={[0.34, 0.24, 0.5]} />
              </mesh>
              {/* Knee brace toward the girder */}
              <mesh position={[0, GY - 0.45, z * 0.8]} rotation-x={z > 0 ? 0.75 : -0.75} material={yellow}>
                <boxGeometry args={[0.1, 0.1, 0.8]} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, GY, 0]} material={yellow} castShadow>
            <boxGeometry args={[0.32, 0.34, 2 * Z + 0.32]} />
          </mesh>
          <mesh position={[0, 0.3, 0]} material={yellow}>
            <boxGeometry args={[0.16, 0.14, 2 * Z]} />
          </mesh>
          <mesh position={[0, 0.02, 0]} material={steel} receiveShadow>
            <boxGeometry args={[0.12, 0.04, 2 * Z + 1]} />
          </mesh>
        </group>
      ))}
      {[-0.45, 0.45].map((z) => (
        <mesh key={z} position={[0, GY + 0.05, z]} material={yellow} castShadow>
          <boxGeometry args={[2 * S + 0.3, 0.4, 0.16]} />
        </mesh>
      ))}
      <Text position={[0, GY + 0.05, 0.54]} fontSize={0.24} color={palette.ink} anchorX="center" anchorY="middle">
        docker compose
      </Text>
      {/* Operator cab under the left end */}
      <group position={[-S + 0.55, GY - 0.55, 0.62]}>
        <mesh material={flat(accent, 0.4, 0.3)} castShadow>
          <boxGeometry args={[0.6, 0.6, 0.55]} />
        </mesh>
        <mesh position={[0, 0.05, 0.28]} material={flat("#bfe6ff", 0.1, 0.2, "#7cc8ff", 0.6)}>
          <boxGeometry args={[0.48, 0.3, 0.02]} />
        </mesh>
      </group>
      {/* Trolley, cable and spreader: they follow the container being moved */}
      <group ref={trolley}>
        <mesh position={[0, GY + 0.43, 0]} material={flat(accent, 0.4, 0.4)} castShadow>
          <boxGeometry args={[0.75, 0.36, 1.2]} />
        </mesh>
        <mesh position={[0, GY + 0.66, 0]} material={flat("#1d6fb8", 0.5, 0.3)}>
          <boxGeometry args={[0.5, 0.1, 0.8]} />
        </mesh>
        <group ref={cable}>
          {[-0.2, 0.2].map((z) => (
            <mesh key={z} position={[0, 0, z]} material={steel}>
              <cylinderGeometry args={[0.012, 0.012, 1, 6]} />
            </mesh>
          ))}
        </group>
        <group ref={spreader}>
          <mesh material={yellow} castShadow>
            <boxGeometry args={[W + 0.06, 0.1, L + 0.04]} />
          </mesh>
          <mesh position={[0, 0.1, 0]} material={steel}>
            <boxGeometry args={[0.24, 0.12, 0.5]} />
          </mesh>
          {[-1, 1].flatMap((sx) =>
            [-1, 1].map((sz) => (
              <mesh key={`${sx}${sz}`} position={[sx * (W / 2 - 0.02), -0.07, sz * (L / 2 - 0.02)]} material={steel}>
                <boxGeometry args={[0.05, 0.05, 0.05]} />
              </mesh>
            )),
          )}
        </group>
      </group>
      {/* The containers, one per service */}
      {SERVICES.map((name, c) => (
        <group key={name} ref={(g) => void (boxes.current[c] = g)} position={[stackX, stackY(c), 0]}>
          <mesh geometry={body} material={flat(BOX_COLORS[c], 0.55, 0.35)} castShadow receiveShadow />
          <Text position={[0, 0.12, L / 2 + 0.05]} fontSize={0.13} color="#ffffff" anchorX="center" anchorY="middle" outlineWidth={0.006} outlineColor="#000000">
            {name}
          </Text>
          <mesh position={[W / 2 - 0.1, H / 2 - 0.1, L / 2 + 0.04]} material={running[c] ? lamp(GREEN) : lampOff()}>
            <sphereGeometry args={[0.04, 12, 8]} />
          </mesh>
        </group>
      ))}
      {/* Status sign at the front */}
      <group position={[-S + 0.6, 0, Math.min(Z + 1.1, d / 2 - 0.4)]}>
        <mesh position={[0, 0.5, 0]} material={steel}>
          <cylinderGeometry args={[0.03, 0.03, 1, 8]} />
        </mesh>
        <mesh position={[0, 1.1, 0]} material={flat(palette.ink, 0.5)}>
          <boxGeometry args={[1, 0.34, 0.04]} />
        </mesh>
        <Text position={[0, 1.1, 0.025]} fontSize={0.11} color={allUp ? "#86efac" : palette.paper} anchorX="center" anchorY="middle">
          {`${running.filter(Boolean).length}/5 running`}
        </Text>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Docker · Compose Control (room)
// ---------------------------------------------------------------------------

/**
 * A control desk under a screen showing the docker-compose.yml and `docker compose ps`. The desk has
 * a big switch per service: click one to start or stop that service. E runs `docker compose up -d`.
 */
const COMPOSE_YML = [
  "services:",
  "  web:",
  "    build: ./web",
  '    ports: ["3000:3000"]',
  "    depends_on: [api]",
  "  api:",
  "    build: ./api",
  "    depends_on: [db, redis]",
  "  worker:",
  "    build: ./worker",
  "    depends_on: [redis]",
  "  db:",
  "    image: postgres:17",
  "  redis:",
  "    image: redis:7",
];
const COMPOSE_SERVICES = ["web", "api", "worker", "db", "redis"];

function DockerCompose({ w, d, toHouse, rot }: SigProps) {
  const { palette, accent } = useHouse();
  const [on, setOn] = useState<boolean[]>(() => COMPOSE_SERVICES.map((s) => s === "db"));
  const levers = useRef<(THREE.Group | null)[]>([]);
  const allOn = on.every(Boolean);
  const z0 = -d / 2 + 0.75;
  const DW = Math.min(w - 1, 3);
  const SW = Math.min(DW + 0.2, 2.8);

  const { texture } = useCanvas(
    1024,
    512,
    (ctx, cw, ch) => {
      ctx.fillStyle = "#0b1a2a";
      ctx.fillRect(0, 0, cw, ch);
      box(ctx, 0, 0, cw, 40, 0, "#12304d");
      ctx.fillStyle = "#9cc9ee";
      ctx.font = font(22, "600");
      ctx.fillText("docker-compose.yml", 20, 27);
      ctx.fillText("$ docker compose ps", 560, 27);
      ctx.font = font(24);
      COMPOSE_YML.forEach((line, i) => {
        ctx.fillStyle = line.startsWith("  ") && !line.startsWith("    ") ? accent : line.startsWith("services") ? "#f9a8d4" : "#dbe7f3";
        ctx.fillText(line, 24, 74 + i * 29);
      });
      ctx.fillStyle = "#64748b";
      ctx.fillRect(540, 52, 2, ch - 70);
      ctx.font = font(22, "700");
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("SERVICE", 570, 82);
      ctx.fillText("STATUS", 760, 82);
      COMPOSE_SERVICES.forEach((s, i) => {
        const y = 136 + i * 62;
        box(ctx, 560, y - 34, 440, 50, 8, on[i] ? "rgba(45,164,78,0.18)" : "rgba(148,163,184,0.08)");
        ctx.fillStyle = "#e2e8f0";
        ctx.font = font(26, "600");
        ctx.fillText(s, 576, y);
        ctx.fillStyle = on[i] ? "#4ade80" : "#94a3b8";
        ctx.beginPath();
        ctx.arc(772, y - 9, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = font(24);
        ctx.fillText(on[i] ? "running" : "exited", 792, y);
      });
      ctx.fillStyle = "#94a3b8";
      ctx.font = font(22);
      ctx.fillText(`${on.filter(Boolean).length} of ${COMPOSE_SERVICES.length} up`, 576, ch - 30);
    },
    on.join(""),
  );

  const toggle = (i: number) => {
    const next = !on[i];
    setOn((o) => o.map((v, k) => (k === i ? next : v)));
    sfx.clunk();
    toast(next ? `docker compose start ${COMPOSE_SERVICES[i]}` : `docker compose stop ${COMPOSE_SERVICES[i]}: stopped, not removed.`, "🐳 Compose Control");
  };
  const upAll = () => {
    if (allOn) {
      setOn(COMPOSE_SERVICES.map(() => false));
      sfx.clunk();
      toast("docker compose stop halts every container but keeps them; docker compose down would also remove them.", "🐳 Compose Control");
    } else {
      setOn(COMPOSE_SERVICES.map(() => true));
      sfx.coin();
      burstAt(toHouse, 0, 1.3, z0, [GREEN, accent, "#ffffff"], 14);
      toast("up -d starts every service in the background (detached) and hands your terminal back.", "🐳 docker compose up -d");
    }
  };
  const where = useWorldPoint(toHouse, 0, z0 + 1.1);
  useProximity({ id: "docker-compose", label: allOn ? "docker compose stop" : "docker compose up -d", radius: 1.8, where, run: upAll });
  const seats = useMemo(() => [seatAt("docker-compose-chair", toHouse, rot, 0, z0 + 0.95, Math.PI)], [toHouse, rot, z0]);

  useFrame((_, delta) => {
    levers.current.forEach((g, i) => {
      if (g) g.rotation.x = THREE.MathUtils.damp(g.rotation.x, on[i] ? -0.55 : 0.55, 10, delta);
    });
  });

  const sx = (i: number) => (i - (COMPOSE_SERVICES.length - 1) / 2) * Math.min(0.5, (DW - 0.4) / COMPOSE_SERVICES.length);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[DW / 2, 0.5, 0.4]} position={[0, 0.5, z0]} />
      </RigidBody>
      {/* The screen on the back wall */}
      <Panel position={[0, 1.95, -d / 2 + 0.12]} width={SW} height={SW / 2} map={texture} frame={palette.ink} />
      {/* The desk: a console with a sloped switch panel */}
      <mesh position={[0, 0.4, z0]} material={flat(palette.ink, 0.45, 0.35)} castShadow receiveShadow>
        <boxGeometry args={[DW, 0.8, 0.7]} />
      </mesh>
      <mesh position={[0, 0.81, z0]} material={flat("#9aa6b1", 0.3, 0.8)}>
        <boxGeometry args={[DW + 0.04, 0.03, 0.74]} />
      </mesh>
      <group position={[0, 0.95, z0 - 0.05]} rotation-x={-0.5}>
        <mesh material={flat("#1d2b38", 0.4, 0.5)} castShadow>
          <boxGeometry args={[DW - 0.1, 0.5, 0.06]} />
        </mesh>
        <mesh position={[0, 0.27, 0]} material={flat(accent, 0.3, 0.2, accent, 0.8)}>
          <boxGeometry args={[DW - 0.1, 0.03, 0.07]} />
        </mesh>
        {COMPOSE_SERVICES.map((s, i) => (
          <group key={s} position={[sx(i), 0, 0.04]} onClick={(e) => clicked(e) && toggle(i)} {...pointer}>
            <mesh material={flat("#aab4bd", 0.35, 0.8)}>
              <boxGeometry args={[0.2, 0.3, 0.02]} />
            </mesh>
            <group ref={(g) => void (levers.current[i] = g)} position={[0, -0.02, 0.01]}>
              <mesh position={[0, 0, 0.08]} rotation-x={Math.PI / 2} material={flat("#d9dee3", 0.25, 0.9)}>
                <cylinderGeometry args={[0.018, 0.022, 0.16, 10]} />
              </mesh>
              <mesh position={[0, 0, 0.17]} material={flat(on[i] ? GREEN : RED, 0.35, 0.1)}>
                <sphereGeometry args={[0.04, 14, 10]} />
              </mesh>
            </group>
            <mesh position={[0, 0.11, 0.02]} material={on[i] ? lamp(GREEN) : lampOff()}>
              <sphereGeometry args={[0.025, 12, 8]} />
            </mesh>
            <Text position={[0, -0.12, 0.015]} fontSize={0.045} color="#0b1a2a" anchorX="center" anchorY="middle">
              {s}
            </Text>
          </group>
        ))}
      </group>
      <ExecChair position={[0, 0, z0 + 0.95]} facing={Math.PI} />
      <Seats seats={seats} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Git · The Branch Yard (hero)
// ---------------------------------------------------------------------------

/**
 * Railway tracks on the floor: the main line, and a feature branch that curves away and merges
 * back. Wagons are commits, each with its short hash. E commits: a new wagon rolls onto the
 * feature branch. Every third time E merges: the branch's wagons roll along the curve onto main.
 */
type Pt = { x: number; z: number };
type Path = { pts: Pt[]; acc: number[]; len: number };

function makePath(pts: Pt[]): Path {
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  return { pts, acc, len: acc[acc.length - 1] };
}

/** The point and heading at arc length s. */
function sample(path: Path, s: number) {
  const v = Math.min(Math.max(s, 0), path.len);
  let i = 1;
  while (i < path.pts.length - 1 && path.acc[i] < v) i++;
  const a = path.pts[i - 1];
  const b = path.pts[i];
  const k = (v - path.acc[i - 1]) / Math.max(1e-6, path.acc[i] - path.acc[i - 1]);
  return { x: lerp(a.x, b.x, k), z: lerp(a.z, b.z, k), heading: Math.atan2(b.z - a.z, b.x - a.x) };
}

/** Rails and sleepers along a polyline, as two merged geometries. */
function trackGeometry(pts: Pt[], gauge: number) {
  const rails: THREE.BufferGeometry[] = [];
  const sleepers: THREE.BufferGeometry[] = [];
  const path = makePath(pts);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const h = Math.atan2(b.z - a.z, b.x - a.x);
    const len = Math.hypot(b.x - a.x, b.z - a.z) + 0.02;
    for (const s of [-1, 1]) {
      const nx = -Math.sin(h) * s * (gauge / 2);
      const nz = Math.cos(h) * s * (gauge / 2);
      rails.push(boxAt(len, 0.05, 0.04, (a.x + b.x) / 2 + nx, 0.065, (a.z + b.z) / 2 + nz, -h));
    }
  }
  for (let s = 0.15; s < path.len; s += 0.34) {
    const p = sample(path, s);
    sleepers.push(boxAt(0.1, 0.04, gauge + 0.22, p.x, 0.02, p.z, -p.heading));
  }
  return { rails: merged(rails), sleepers: merged(sleepers) };
}

type Wagon = { id: number; hash: string; msg: string; color: string; target: number };

const COMMIT_MSGS = ["Add bus stops downtown", "Fix street lamps at dawn", "Tune car steering", "Add the quiz room", "Polish skill house walls", "Refactor toasts", "Add night sky", "Speed up text labels", "Fix seat camera"];
const hashOf = (n: number) => ((n * 2654435761 + 0x9e3779b9) >>> 0).toString(16).padStart(8, "0").slice(0, 7);
const WAGON_SPEED = 1.6;

function GitTracks({ w, d, toHouse }: SigProps) {
  const { palette, accent } = useHouse();
  const layout = useMemo(() => {
    const xL = -w / 2 + 0.3;
    const xR = w / 2 - 0.3;
    const mainZ = Math.min(1.6, d / 2 - 1.5);
    const backZ = mainZ - Math.min(2.8, d - 3.4);
    const span = xR - xL;
    const forkX = xL + span * 0.08;
    const cx = span * 0.18;
    const mergeX = xL + span * 0.55;
    const pts: Pt[] = [{ x: xL, z: mainZ }, { x: forkX, z: mainZ }];
    const N = 14;
    for (let i = 1; i <= N; i++) pts.push({ x: forkX + (cx * i) / N, z: lerp(mainZ, backZ, ease(i / N)) });
    for (let i = 1; i <= N; i++) pts.push({ x: mergeX - cx + (cx * i) / N, z: lerp(backZ, mainZ, ease(i / N)) });
    const branchPts = pts.slice(1);
    pts.push({ x: xR, z: mainZ });
    const path = makePath(pts);
    const sFork = forkX - xL;
    const sMerge = path.len - (xR - mergeX);
    const featureSlot = (i: number) => sMerge - 1.0 - i * 0.78;
    const mainSlot = (k: number) => sMerge + 0.45 + k * 0.74;
    const mainSlots = Math.max(1, Math.floor((path.len - 0.4 - mainSlot(0)) / 0.74) + 1);
    return { xL, xR, mainZ, backZ, forkX, mergeX, path, branchPts, sFork, sMerge, featureSlot, mainSlot, mainSlots };
  }, [w, d]);
  const { path, mainSlot, featureSlot, mainSlots } = layout;

  const tracks = useMemo(() => {
    const main = trackGeometry([{ x: layout.xL, z: layout.mainZ }, { x: layout.xR, z: layout.mainZ }], 0.32);
    const branch = trackGeometry(layout.branchPts, 0.32);
    return { rails: merged([main.rails, branch.rails]), sleepers: merged([main.sleepers, branch.sleepers]) };
  }, [layout]);
  useDispose(tracks.rails, tracks.sleepers);
  const wheels = useMemo(() => merged([-0.18, 0.18].map((x) => cylAt(0.07, 0.36, x, 0.07, 0, "z", 14))), []);
  useDispose(wheels);

  const commits = useRef(3);
  const [main, setMain] = useState<Wagon[]>(() =>
    [2, 1, 0].map((n, k) => ({ id: n, hash: hashOf(n), msg: COMMIT_MSGS[n], color: "#4b5563", target: mainSlot(k) })),
  );
  const [feature, setFeature] = useState<Wagon[]>([]);
  const pos = useRef(new Map<number, number>());
  const groups = useRef(new Map<number, THREE.Group>());

  const commit = () => {
    if (feature.length >= 3) {
      // git merge: the feature commits become main's newest history
      const moved = [...feature].reverse().map((wg, k) => ({ ...wg, target: mainSlot(k) }));
      const old = main.slice(0, mainSlots + 1).map((wg, k) => ({ ...wg, target: mainSlot(k + moved.length) }));
      setMain([...moved, ...old]);
      setFeature([]);
      sfx.chirp();
      burstAt(toHouse, layout.mergeX, 0.6, layout.mainZ, [accent, "#ffffff"], 16);
      toast("git merge feature/city: the branch's 3 commits are now part of main's history. main had no new commits, so this was a fast-forward.", "🔀 git merge");
      return;
    }
    const n = commits.current++;
    const wagon: Wagon = { id: n, hash: hashOf(n), msg: COMMIT_MSGS[n % COMMIT_MSGS.length], color: accent, target: featureSlot(feature.length) };
    setFeature([...feature, wagon]);
    sfx.click();
    toast(`[feature/city ${wagon.hash}] ${wagon.msg}`, "🚃 git commit");
  };
  const where = useWorldPoint(toHouse, 0, d / 2 - 0.4);
  useProximity({ id: "git-tracks", label: feature.length >= 3 ? "git merge feature/city" : "git commit", radius: 2.4, where, run: commit });

  const wagons = useMemo(() => [...main, ...feature], [main, feature]);
  useFrame((_, delta) => {
    for (const wg of wagons) {
      const g = groups.current.get(wg.id);
      if (!g) continue;
      const s0 = pos.current.get(wg.id) ?? (wg.target < layout.sMerge ? 0 : wg.target);
      const s = s0 + Math.min(Math.max(wg.target - s0, -WAGON_SPEED * delta), WAGON_SPEED * delta);
      pos.current.set(wg.id, s);
      const p = sample(path, s);
      g.position.set(p.x, 0.04, p.z);
      g.rotation.y = -p.heading;
      // Old commits roll off into history at the end of the line
      const fade = clamp01((path.len - 0.25 - s) / 0.4);
      g.scale.setScalar(Math.max(0.001, fade));
    }
  });

  const signPost = (x: number, z: number, text: string) => (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.6, 0]} material={flat("#2b2b2b", 0.5, 0.6)}>
        <cylinderGeometry args={[0.03, 0.03, 1.2, 8]} />
      </mesh>
      <mesh position={[0, 1.2, 0]} material={flat(palette.ink, 0.5)}>
        <boxGeometry args={[1.1, 0.26, 0.04]} />
      </mesh>
      <Text position={[0, 1.2, 0.025]} fontSize={0.12} color={palette.paper} anchorX="center" anchorY="middle">
        {text}
      </Text>
    </group>
  );
  return (
    <group>
      <mesh geometry={tracks.sleepers} material={flat("#5a3b28", 0.85)} receiveShadow />
      <mesh geometry={tracks.rails} material={flat("#9aa1a8", 0.3, 0.85)} castShadow />
      {/* Buffer stop at the end of main */}
      <group position={[layout.xR + 0.05, 0, layout.mainZ]}>
        <mesh position={[0, 0.25, 0]} material={flat(accent, 0.5, 0.3)} castShadow>
          <boxGeometry args={[0.12, 0.3, 0.5]} />
        </mesh>
        {[-0.14, 0.14].map((z) => (
          <mesh key={z} position={[-0.1, 0.26, z]} rotation-z={Math.PI / 2} material={flat("#d1d5db", 0.3, 0.8)}>
            <cylinderGeometry args={[0.05, 0.05, 0.1, 12]} />
          </mesh>
        ))}
      </group>
      {signPost(layout.xR - 0.6, layout.mainZ - 0.75, "main")}
      {signPost((layout.forkX + layout.mergeX) / 2, layout.backZ - 0.65, "feature/city")}
      {wagons.map((wg) => (
        <group key={wg.id} ref={(g) => void (g ? groups.current.set(wg.id, g) : groups.current.delete(wg.id))}>
          <mesh position={[0, 0.14, 0]} material={flat("#2b2f33", 0.5, 0.6)} castShadow>
            <boxGeometry args={[0.62, 0.06, 0.28]} />
          </mesh>
          <mesh geometry={wheels} material={flat("#1f2328", 0.4, 0.8)} />
          <mesh position={[0, 0.31, 0]} material={flat(wg.color, 0.55, 0.15)} castShadow>
            <boxGeometry args={[0.54, 0.28, 0.32]} />
          </mesh>
          <mesh position={[0, 0.46, 0]} material={flat(palette.paper, 0.6)}>
            <boxGeometry args={[0.46, 0.02, 0.26]} />
          </mesh>
          <Text position={[0, 0.475, 0]} rotation-x={-Math.PI / 2} fontSize={0.075} color={palette.ink} anchorX="center" anchorY="middle">
            {wg.hash}
          </Text>
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Git · The Stash (room)
// ---------------------------------------------------------------------------

/**
 * A closet labeled "git stash" with a pile of boxes, newest on top: stash@{0}. E stashes your work
 * (a new box drops onto the pile); click the top box to pop it and get your changes back.
 */
type Stash = { id: number; msg: string };
const STASH_MSGS = [
  "half-built bus stop",
  "new lamp colors",
  "quiz copy edits",
  "debug logs everywhere",
  "car sound experiment",
  "roof texture tweak",
  "faster minimap",
];
const STASH_MAX = 6;

function GitStash({ w, d, toHouse }: SigProps) {
  const { palette, accent } = useHouse();
  const [stashes, setStashes] = useState<Stash[]>(() => [0, 1].map((i) => ({ id: i, msg: STASH_MSGS[i] })));
  const made = useRef(2);
  const groups = useRef(new Map<number, THREE.Group>());
  const z0 = -d / 2 + 0.38;
  const slotY = (k: number) => 0.31 + k * 0.31;

  const push = () => {
    if (stashes.length >= STASH_MAX) {
      sfx.clunk();
      toast("This shelf holds 6 boxes (git itself has no limit). Pop one first.", "📦 git stash");
      return;
    }
    const n = made.current++;
    const s = { id: n, msg: STASH_MSGS[n % STASH_MSGS.length] };
    setStashes([...stashes, s]);
    sfx.pop();
    toast(`Saved working directory and index state WIP on feature/city: ${s.msg}`, "📦 git stash");
  };
  const pop = (id: number) => {
    const top = stashes[stashes.length - 1];
    if (!top) return;
    if (top.id !== id) {
      toast("git stash pop takes the top box, stash@{0}. To pick another: git stash pop stash@{2}.", "📦 git stash");
      return;
    }
    setStashes(stashes.slice(0, -1));
    sfx.sparkle();
    burstAt(toHouse, 0, slotY(stashes.length - 1) + 0.2, z0 + 0.3, [accent, "#e7c9a0", "#ffffff"], 14);
    toast(`Restored "${top.msg}" to your working tree. pop = apply + drop.`, "📦 git stash pop");
  };
  const where = useWorldPoint(toHouse, 0, z0 + 1.4);
  useProximity({ id: "git-stash", label: "git stash", radius: 1.8, where, run: push });

  useFrame((_, delta) => {
    stashes.forEach((s, k) => {
      const g = groups.current.get(s.id);
      if (g) g.position.y = THREE.MathUtils.damp(g.position.y, slotY(k), 7, delta);
    });
  });

  const wood = flat("#3b2a22", 0.7);
  const bw = Math.min(2.4, w / 2 - 1.3);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.68, 1.2, 0.27]} position={[0, 1.2, z0]} />
      </RigidBody>
      {/* The closet */}
      <group position={[0, 0, z0]}>
        <mesh position={[0, 1.18, -0.24]} material={wood} receiveShadow>
          <boxGeometry args={[1.36, 2.36, 0.03]} />
        </mesh>
        {[-0.665, 0.665].map((x) => (
          <mesh key={x} position={[x, 1.18, 0]} material={wood} castShadow>
            <boxGeometry args={[0.04, 2.36, 0.52]} />
          </mesh>
        ))}
        <mesh position={[0, 0.08, 0]} material={wood}>
          <boxGeometry args={[1.36, 0.16, 0.52]} />
        </mesh>
        <mesh position={[0, 2.38, 0]} material={wood} castShadow>
          <boxGeometry args={[1.42, 0.06, 0.56]} />
        </mesh>
        <mesh position={[0, 2.6, 0.02]} material={flat(palette.ink, 0.5)}>
          <boxGeometry args={[1.3, 0.34, 0.04]} />
        </mesh>
        <Text position={[0, 2.6, 0.045]} fontSize={0.15} color={accent} anchorX="center" anchorY="middle">
          git stash
        </Text>
        {stashes.map((s, k) => {
          const top = k === stashes.length - 1;
          return (
            <group
              key={s.id}
              ref={(g) => void (g ? groups.current.set(s.id, g) : groups.current.delete(s.id))}
              position={[((s.id * 37) % 5) * 0.012 - 0.024, slotY(k) + 0.8, 0.02]}
              rotation-y={((s.id * 53) % 7) * 0.012 - 0.036}
              onClick={(e) => clicked(e) && pop(s.id)}
              {...pointer}
            >
              <mesh material={flat(top ? "#d9a96a" : "#c49a63", 0.85)} castShadow>
                <boxGeometry args={[1.12, 0.28, 0.44]} />
              </mesh>
              <mesh position={[0, 0.142, 0]} material={flat("#a8834f", 0.8)}>
                <boxGeometry args={[0.1, 0.006, 0.45]} />
              </mesh>
              <mesh position={[0, 0, 0.222]} material={flat("#fbf7ef", 0.7)}>
                <boxGeometry args={[0.86, 0.17, 0.004]} />
              </mesh>
              <Text position={[0, 0.025, 0.226]} fontSize={0.05} color={palette.ink} anchorX="center" anchorY="middle">
                {`stash@{${stashes.length - 1 - k}}`}
              </Text>
              <Text position={[0, -0.035, 0.226]} fontSize={0.032} color="#555555" anchorX="center" anchorY="middle" maxWidth={0.8}>
                {`WIP on feature/city: ${s.msg}`}
              </Text>
            </group>
          );
        })}
      </group>
      {bw > 1.2 && (
        <WallBoard
          position={[0.65 + 0.35 + bw / 2, 1.7, -d / 2 + 0.12]}
          width={bw}
          height={bw * 0.62}
          kicker="Shelve it for later"
          title="git stash"
          lines={["git stash: save and clean the tree", "git stash list: see the pile", "git stash pop: apply + drop the top", "git stash apply: apply, keep the box"]}
        />
      )}
      {w >= 7 && (
        <>
          <Table position={[-w / 4, 0, -0.2]} width={0.8} top="walnut" />
          <SideChair position={[-w / 4 - 0.6, 0, -0.2]} facing={Math.PI / 2} />
          <SideChair position={[-w / 4 + 0.6, 0, -0.2]} facing={-Math.PI / 2} />
          <TallPlant position={[w / 2 - 0.5, 0, -d / 2 + 0.5]} seed={4} />
        </>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// GitHub / GitLab · The CI Conveyor (hero)
// ---------------------------------------------------------------------------

/**
 * A CI conveyor loop with four stations: Lint, Test, Build and Deploy, each a little machine with a
 * status light. E pushes: a package rides the belt and every station turns yellow (running) then
 * green. Now and then Test goes red and the run stops there, like a real pipeline.
 */
const STATIONS = ["Lint", "Test", "Build", "Deploy"];
type Check = "idle" | "running" | "pass" | "fail";
const CHECK_COLORS: Record<Check, string> = { idle: LAMP_OFF, running: YELLOW, pass: GREEN, fail: RED };

function stadiumShape(L: number, r: number, hole?: number) {
  const s = new THREE.Shape();
  s.absarc(L / 2, 0, r, -Math.PI / 2, Math.PI / 2, false);
  s.absarc(-L / 2, 0, r, Math.PI / 2, (3 * Math.PI) / 2, false);
  if (hole !== undefined) {
    const h = new THREE.Path();
    h.absarc(L / 2, 0, hole, -Math.PI / 2, Math.PI / 2, false);
    h.absarc(-L / 2, 0, hole, Math.PI / 2, (3 * Math.PI) / 2, false);
    s.holes.push(h);
  }
  return s;
}

function flatExtrude(shape: THREE.Shape, depth: number) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24 });
  g.rotateX(-Math.PI / 2);
  return g;
}

function GhPipeline({ w, d, toHouse }: SigProps) {
  const { palette, accent } = useHouse();
  const L = Math.min(w - 3, 5.2);
  const R = Math.min(1.1, (d - 2.6) / 2);
  const half = 0.26;
  const TOP = 0.78;
  const P = 2 * L + 2 * Math.PI * R;
  const stationS = [L * 0.25, L * 0.75, L + Math.PI * R + L * 0.25, L + Math.PI * R + L * 0.75];

  /** The belt's centerline: front straight (+z) left to right, around, back straight right to left. */
  const at = (sv: number) => {
    const s = ((sv % P) + P) % P;
    if (s < L) return { x: -L / 2 + s, z: R, h: 0 };
    if (s < L + Math.PI * R) {
      const a = Math.PI / 2 - (s - L) / R;
      return { x: L / 2 + Math.cos(a) * R, z: Math.sin(a) * R, h: Math.PI / 2 - a };
    }
    if (s < 2 * L + Math.PI * R) return { x: L / 2 - (s - L - Math.PI * R), z: -R, h: Math.PI };
    const a = -Math.PI / 2 - (s - 2 * L - Math.PI * R) / R;
    return { x: -L / 2 + Math.cos(a) * R, z: Math.sin(a) * R, h: Math.PI / 2 - a };
  };

  const geos = useMemo(
    () => ({
      belt: flatExtrude(stadiumShape(L, R + half, R - half), 0.05),
      outer: flatExtrude(stadiumShape(L, R + half + 0.07, R + half), 0.12),
      inner: flatExtrude(stadiumShape(L, R - half), 0.12),
    }),
    [L, R],
  );
  useDispose(geos.belt, geos.outer, geos.inner);

  const [checks, setChecks] = useState<Check[]>(() => STATIONS.map(() => "idle"));
  const [phase, setPhase] = useState<"idle" | "running" | "passed" | "failed">("idle");
  const runs = useRef(0);
  const fail = useRef(false);
  const s = useRef(0.1);
  const step = useRef(0);
  const mode = useRef<"idle" | "move" | "check">("idle");
  const until = useRef(0);
  const belt = useRef(0);
  const pkg = useRef<THREE.Group>(null);
  const slats = useRef<(THREE.Mesh | null)[]>([]);

  const push = () => {
    if (mode.current !== "idle") return;
    runs.current++;
    fail.current = runs.current % 3 === 2;
    s.current = 0.1;
    step.current = 0;
    mode.current = "move";
    setChecks(STATIONS.map(() => "idle"));
    setPhase("running");
    sfx.click();
  };
  const where = useWorldPoint(toHouse, 0, d / 2 - 0.4);
  useProximity({ id: "gh-pipeline", label: phase === "running" ? "Pipeline running…" : "git push", radius: 2.4, where, run: push });

  useFrame((_, delta) => {
    const t = now();
    const m = mode.current;
    if (m === "move") {
      s.current += delta * 1.4;
      belt.current += delta * 1.4;
      const goal = step.current < STATIONS.length ? stationS[step.current] : P + 0.1;
      if (s.current >= goal) {
        s.current = goal;
        if (step.current < STATIONS.length) {
          const i = step.current;
          mode.current = "check";
          until.current = t + 1.3;
          setChecks((c) => c.map((v, k) => (k === i ? "running" : v)));
          sfx.click();
        } else {
          mode.current = "idle";
          s.current = 0.1;
          setPhase("passed");
          sfx.coin();
          burstAt(toHouse, -L / 2, 1.2, R, [GREEN, accent, "#ffffff"], 18);
          toast("✓ All checks have passed. The merge is green and the build is deployed.", "🚀 CI pipeline");
        }
      }
    } else if (m === "check" && t >= until.current) {
      const i = step.current;
      if (i === 1 && fail.current) {
        mode.current = "idle";
        setChecks((c) => c.map((v, k) => (k === i ? "fail" : v)));
        setPhase("failed");
        sfx.clunk();
        toast("✗ 1 failing test. The pipeline stops here, so nothing broken gets built or deployed. Fix it and push again.", "🚨 CI pipeline");
      } else {
        setChecks((c) => c.map((v, k) => (k === i ? "pass" : v)));
        sfx.pop();
        step.current++;
        mode.current = "move";
      }
    }
    if (pkg.current) {
      const p = at(s.current);
      pkg.current.position.set(p.x, TOP + 0.05, p.z);
      pkg.current.rotation.y = p.h;
    }
    slats.current.forEach((mesh, i) => {
      if (!mesh) return;
      const p = at(belt.current + (i / slats.current.length) * P);
      mesh.position.set(p.x, TOP + 0.055, p.z);
      mesh.rotation.y = p.h;
    });
  });

  const metal = flat("#8b949e", 0.35, 0.8);
  const status = phase === "running" ? "Running checks…" : phase === "passed" ? "✓ All checks passed" : phase === "failed" ? "✗ 1 failing test" : "Waiting for a push";
  const statusColor = phase === "passed" ? "#4ade80" : phase === "failed" ? "#f87171" : phase === "running" ? "#facc15" : palette.paper;
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[L / 2 + R + half + 0.07, 0.45, R + half + 0.07]} position={[0, 0.45, 0]} />
      </RigidBody>
      {/* The conveyor: rails, belt and the plate in the middle, on legs */}
      <mesh geometry={geos.outer} position={[0, TOP - 0.07, 0]} material={metal} castShadow />
      <mesh geometry={geos.inner} position={[0, TOP - 0.07, 0]} material={flat(palette.ink, 0.5, 0.3)} castShadow />
      <mesh geometry={geos.belt} position={[0, TOP - 0.02, 0]} material={flat("#1b1f24", 0.9)} receiveShadow />
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * (L / 2), (TOP - 0.07) / 2, sz * (R + half)]} material={metal}>
            <cylinderGeometry args={[0.04, 0.05, TOP - 0.07, 10]} />
          </mesh>
        )),
      )}
      {Array.from({ length: 16 }, (_, i) => (
        <mesh key={i} ref={(m) => void (slats.current[i] = m)} material={flat("#2d333b", 0.8)}>
          <boxGeometry args={[0.03, 0.012, half * 2 - 0.04]} />
        </mesh>
      ))}
      {/* The stations */}
      {STATIONS.map((name, i) => {
        const p = at(stationS[i]);
        const back = i >= 2;
        return (
          <group key={name}>
            <group position={[p.x, TOP, p.z]} rotation-y={p.h}>
              {[-1, 1].map((sz) => (
                <mesh key={sz} position={[0, 0.3, sz * (half + 0.1)]} material={flat(palette.main, 0.45, 0.3)} castShadow>
                  <boxGeometry args={[0.36, 0.6, 0.1]} />
                </mesh>
              ))}
              <mesh position={[0, 0.68, 0]} material={flat("#30363d", 0.45, 0.5)} castShadow>
                <boxGeometry args={[0.5, 0.2, half * 2 + 0.32]} />
              </mesh>
              <mesh position={[0, 0.575, 0]} material={checks[i] === "idle" ? lampOff() : lamp(CHECK_COLORS[checks[i]])}>
                <boxGeometry args={[0.4, 0.02, half * 2]} />
              </mesh>
            </group>
            <mesh position={[p.x, TOP + 0.86, p.z]} material={checks[i] === "idle" ? lampOff() : lamp(CHECK_COLORS[checks[i]])}>
              <sphereGeometry args={[0.09, 16, 12]} />
            </mesh>
            <Text position={[p.x, TOP + (back ? 1.22 : 1.1), p.z + 0.02]} fontSize={0.17} color={checks[i] === "fail" ? "#f87171" : palette.paper} anchorX="center" anchorY="middle" outlineWidth={0.008} outlineColor={palette.ink}>
              {name}
            </Text>
          </group>
        );
      })}
      {/* The package riding the belt */}
      <group ref={pkg}>
        <mesh position={[0, 0.13, 0]} material={flat(palette.main, 0.6)} castShadow>
          <boxGeometry args={[0.26, 0.26, 0.26]} />
        </mesh>
        <mesh position={[0, 0.13, 0]} material={flat(accent, 0.6)}>
          <boxGeometry args={[0.27, 0.06, 0.27]} />
        </mesh>
      </group>
      {/* Status board in the middle of the loop */}
      <group position={[0, TOP + 0.05, 0]}>
        <mesh position={[0, 0.32, 0]} material={flat(palette.ink, 0.5)}>
          <boxGeometry args={[Math.min(1.8, L * 0.6), 0.5, 0.05]} />
        </mesh>
        <Text position={[0, 0.44, 0.03]} fontSize={0.09} color={accent} anchorX="center" anchorY="middle">
          CI · main
        </Text>
        <Text position={[0, 0.27, 0.03]} fontSize={0.12} color={statusColor} anchorX="center" anchorY="middle">
          {status}
        </Text>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// GitHub / GitLab · Pull Request Review (room)
// ---------------------------------------------------------------------------

/**
 * A review table with a big diff sheet: red lines out, green lines in. E approves: a rubber stamp
 * comes down and leaves "Approved ✓", and the merge button beside the table glows green. Next E
 * (or the button) merges and brings the next pull request.
 */
type DiffLine = ["+" | "-" | " ", string];
type PullRequest = { n: number; title: string; branch: string; file: string; lines: DiffLine[] };
const PULLS: PullRequest[] = [
  {
    n: 14,
    title: "feat: bus stops on every avenue",
    branch: "feat/bus-stops",
    file: "src/world/busRoutes.ts",
    lines: [
      [" ", "export const ROUTES = ["],
      ["-", "  { id: 'downtown', stops: 4 },"],
      ["+", "  { id: 'downtown', stops: 6 },"],
      ["+", "  { id: 'skills', stops: 5 },"],
      [" ", "];"],
      ["-", "const WAIT = 30;"],
      ["+", "const WAIT_SECONDS = 20;"],
    ],
  },
  {
    n: 15,
    title: "fix: street lamps stay on after dawn",
    branch: "fix/lamps",
    file: "src/components/city/StreetLamps.tsx",
    lines: [
      [" ", "const lit = useNight();"],
      ["-", "if (hour > 6) return;"],
      ["+", "if (hour >= 6 && hour < 19) {"],
      ["+", "  lamps.off();"],
      ["+", "  return;"],
      ["+", "}"],
      [" ", "lamps.on();"],
    ],
  },
  {
    n: 16,
    title: "perf: merge static furniture meshes",
    branch: "perf/batch",
    file: "src/components/city/Furniture.tsx",
    lines: [
      ["-", "{chairs.map((c) => <Chair {...c} />)}"],
      ["+", "<Batch>"],
      ["+", "  {chairs.map((c) => <Chair {...c} />)}"],
      ["+", "</Batch>"],
      [" ", "<Table top=\"walnut\" />"],
      ["-", "// TODO: too many draw calls"],
    ],
  },
];

function drawPull(ctx: CanvasRenderingContext2D, w: number, h: number, pr: PullRequest, approved: boolean, accent: string) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#1f2328";
  ctx.font = font(40, "700");
  ctx.fillText(`${pr.title} #${pr.n}`, 32, 64);
  box(ctx, 32, 86, 108, 40, 20, approved ? "#8250df" : GREEN);
  ctx.fillStyle = "#ffffff";
  ctx.font = font(22, "700");
  ctx.fillText(approved ? "Ready" : "Open", 54, 114);
  ctx.fillStyle = "#59636e";
  ctx.font = font(24);
  ctx.fillText(`wouroud wants to merge 2 commits into main from ${pr.branch}`, 156, 114);
  box(ctx, 32, 150, w - 64, 46, 6, "#f6f8fa", "#d1d9e0");
  ctx.fillStyle = "#1f2328";
  ctx.font = font(22, "600");
  ctx.fillText(pr.file, 48, 181);
  pr.lines.forEach(([kind, text], i) => {
    const y = 198 + i * 44;
    ctx.fillStyle = kind === "+" ? "#dafbe1" : kind === "-" ? "#ffebe9" : "#ffffff";
    ctx.fillRect(32, y, w - 64, 44);
    ctx.fillStyle = kind === "+" ? "#1a7f37" : kind === "-" ? "#d1242f" : "#59636e";
    ctx.font = `26px ui-monospace, Menlo, Consolas, monospace`;
    ctx.fillText(`${kind} ${text}`, 48, y + 31);
  });
  if (approved) {
    ctx.save();
    ctx.translate(w - 230, h - 150);
    ctx.rotate(-0.18);
    ctx.strokeStyle = "rgba(26,127,55,0.85)";
    ctx.lineWidth = 8;
    ctx.strokeRect(-170, -56, 340, 112);
    ctx.fillStyle = "rgba(26,127,55,0.85)";
    ctx.font = font(56, "800");
    ctx.textAlign = "center";
    ctx.fillText("Approved ✓", 0, 20);
    ctx.restore();
  }
  ctx.fillStyle = approved ? "#1a7f37" : "#59636e";
  ctx.font = font(24, "600");
  ctx.fillText(approved ? "✓ Changes approved · Merging is allowed" : "Review required · 1 approving review needed", 32, h - 28);
  ctx.fillStyle = accent;
  ctx.fillRect(0, h - 8, w, 8);
}

function GhReview({ w, d, toHouse }: SigProps) {
  const { palette, accent } = useHouse();
  const [pr, setPr] = useState(0);
  const [approved, setApproved] = useState(false);
  const stampAt = useRef(-1);
  const pressed = useRef(false);
  const stamp = useRef<THREE.Group>(null);
  const z0 = -d / 2 + 1.8;
  const pull = PULLS[pr % PULLS.length];
  const { texture } = useCanvas(1024, 640, (ctx, cw, ch) => drawPull(ctx, cw, ch, pull, approved, accent), `${pr}|${approved}`);
  const { texture: old } = useCanvas(1024, 640, (ctx, cw, ch) => drawPull(ctx, cw, ch, { ...PULLS[2], n: 9, title: "docs: city walking guide", branch: "docs/guide" }, true, accent), "old");

  const act = () => {
    if (stampAt.current >= 0) return;
    if (approved) {
      setApproved(false);
      setPr((p) => p + 1);
      sfx.chirp();
      burstAt(toHouse, 1.5, 1.2, z0, ["#8250df", GREEN, "#ffffff"], 14);
      toast(`Merged #${pull.n} into main. The branch ${pull.branch} can be deleted now.`, "🟣 Merged");
      return;
    }
    stampAt.current = now();
    pressed.current = false;
    sfx.click();
  };
  const where = useWorldPoint(toHouse, 0, z0 + 1.3);
  useProximity({ id: "gh-review", label: approved ? "Merge and open the next PR" : "Approve", radius: 1.9, where, run: act });

  useFrame(() => {
    const g = stamp.current;
    if (!g) return;
    let lift = 0.45;
    if (stampAt.current >= 0) {
      const u = (now() - stampAt.current) / 1.1;
      lift = u < 0.4 ? lerp(0.45, 0.004, ease(u / 0.4)) : u < 0.55 ? 0.004 : lerp(0.004, 0.45, ease((u - 0.55) / 0.45));
      if (u >= 0.4 && !pressed.current) {
        pressed.current = true;
        setApproved(true);
        sfx.clunk();
        toast("Approved. Branch protection can require a review like this before anything merges into main.", "✅ Review");
      }
      if (u >= 1) stampAt.current = -1;
    }
    g.position.z = lift;
  });

  const SW = Math.min(1.7, w - 3.2);
  const wood = flat("#3d2f25", 0.6);
  const legs = (width: number, depth: number) =>
    [-1, 1].flatMap((sx) =>
      [-1, 1].map((sz) => (
        <mesh key={`${sx}${sz}`} position={[sx * (width / 2 - 0.06), 0.4, sz * (depth / 2 - 0.06)]} material={flat("#24292f", 0.4, 0.7)}>
          <boxGeometry args={[0.05, 0.8, 0.05]} />
        </mesh>
      )),
    );
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[SW / 2 + 0.1, 0.5, 0.6]} position={[0, 0.5, z0]} />
        <CuboidCollider args={[0.25, 0.5, 0.25]} position={[SW / 2 + 0.55, 0.5, z0 + 0.2]} />
      </RigidBody>
      <WallBoard position={[0, 2.35, -d / 2 + 0.12]} width={2.2} height={1.1} kicker="Code review" title="Before you approve" lines={["It does what the PR says", "Tests cover the change", "No secrets in the diff"]} />
      {/* The drafting table: the diff sheet on a tilted top, the stamp hovering over it */}
      <group position={[0, 0, z0]}>
        {legs(SW + 0.2, 1.1)}
        <group position={[0, 0.92, 0]} rotation-x={-Math.PI / 2 + 0.5}>
          <mesh position={[0, 0, -0.03]} material={wood} castShadow receiveShadow>
            <boxGeometry args={[SW + 0.2, SW * 0.68, 0.04]} />
          </mesh>
          <Panel position={[0, 0, 0.002]} width={SW} height={SW * 0.625} map={texture} frame="#d0d7de" />
          <group ref={stamp} position={[SW * 0.3, -SW * 0.14, 0.45]}>
            <mesh position={[0, 0, 0.015]} material={flat("#b42318", 0.8)}>
              <boxGeometry args={[0.26, 0.12, 0.03]} />
            </mesh>
            <mesh position={[0, 0, 0.055]} material={flat("#8a5a3b", 0.6)} castShadow>
              <boxGeometry args={[0.28, 0.14, 0.05]} />
            </mesh>
            <mesh position={[0, 0, 0.13]} rotation-x={Math.PI / 2} material={flat("#6b4429", 0.6)}>
              <cylinderGeometry args={[0.02, 0.03, 0.1, 10]} />
            </mesh>
            <mesh position={[0, 0, 0.2]} material={flat("#2b1a10", 0.4)}>
              <sphereGeometry args={[0.05, 14, 10]} />
            </mesh>
          </group>
        </group>
        {/* The merge button on its pedestal */}
        <group position={[SW / 2 + 0.55, 0, 0.2]} onClick={(e) => clicked(e) && approved && act()} {...pointer}>
          <mesh position={[0, 0.5, 0]} material={flat("#30363d", 0.4, 0.6)} castShadow>
            <cylinderGeometry args={[0.16, 0.2, 1, 20]} />
          </mesh>
          <mesh position={[0, 1.04, 0]} material={approved ? lamp(GREEN) : flat("#57606a", 0.4, 0.3)}>
            <cylinderGeometry args={[0.13, 0.13, 0.08, 24]} />
          </mesh>
          <Text position={[0, 0.85, 0.205]} fontSize={0.06} color={approved ? "#4ade80" : "#8b949e"} anchorX="center" anchorY="middle">
            Merge
          </Text>
        </group>
      </group>
      {/* An older, merged pull request on a side table */}
      {w >= 6.5 && (
        <group position={[-w / 2 + 1.1, 0, 0.2]}>
          <Table position={[0, 0, 0]} width={1.1} depth={1.4} top="walnut" />
          <group position={[0, 0.765, 0]} rotation-x={-Math.PI / 2} rotation-z={-Math.PI / 2}>
            <Panel position={[0, 0, 0]} width={1.2} height={0.75} map={old} frame="#d0d7de" />
          </group>
          <SideChair position={[0.8, 0, 0]} facing={-Math.PI / 2} />
        </group>
      )}
      <Text position={[0, 3.15, -d / 2 + 0.13]} fontSize={0.2} color={palette.paper} anchorX="center" anchorY="middle">
        {`Pull request #${pull.n}`}
      </Text>
    </group>
  );
}

// ---------------------------------------------------------------------------
// GitHub / GitLab · Wall of Stars (room)
// ---------------------------------------------------------------------------

/** A wall of five-point stars: click one to star or unstar it; E stars the next. The counter keeps score. */
function starShape(outer: number, inner: number) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer;
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return s;
}

function GhStars({ w, d, toHouse }: SigProps) {
  const { palette, accent } = useHouse();
  const WW = Math.min(w - 1.2, 6);
  const cols = Math.max(4, Math.floor(WW / 0.5));
  const rows = 4;
  const total = cols * rows;
  const [lit, setLit] = useState<boolean[]>(() => Array.from({ length: total }, (_, i) => (i * 7) % 5 === 0));
  const stars = useRef<(THREE.Mesh | null)[]>([]);
  const pulse = useRef<number[]>([]);
  const geo = useMemo(() => new THREE.ExtrudeGeometry(starShape(0.18, 0.075), { depth: 0.04, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2 }), []);
  const badge = useMemo(() => new THREE.ExtrudeGeometry(starShape(0.16, 0.066), { depth: 0.03, bevelEnabled: false }), []);
  useDispose(geo, badge);
  const count = lit.filter(Boolean).length;
  const zW = -d / 2 + 0.12;

  const toggle = (i: number) => {
    const on = !lit[i];
    setLit((l) => l.map((v, k) => (k === i ? on : v)));
    pulse.current[i] = now();
    if (on) sfx.chirp();
    else sfx.click();
  };
  const next = () => {
    const i = lit.indexOf(false);
    if (i < 0) {
      toast("Every star is lit! Stars are bookmarks, and a thank-you that maintainers notice.", "⭐ Wall of Stars");
      return;
    }
    toggle(i);
    const col = i % cols;
    const row = Math.floor(i / cols);
    burstAt(toHouse, (col - (cols - 1) / 2) * (WW / cols), 2.45 - row * 0.5, zW + 0.2, ["#f9c513", "#ffffff"], 10);
    toast(`★ ${count + 1} stars. Starring bookmarks a repo and tells its maintainers people find it useful.`, "⭐ Star the repo");
  };
  const where = useWorldPoint(toHouse, 0, zW + 1.6);
  useProximity({ id: "gh-stars", label: "Star the repo", radius: 2, where, run: next });

  useFrame(() => {
    const t = now();
    stars.current.forEach((m, i) => {
      const t0 = pulse.current[i];
      if (!m || t0 === undefined) return;
      const k = t - t0;
      m.scale.setScalar(1 + 0.5 * Math.exp(-k * 6) * Math.sin(Math.min(k * 14, Math.PI)));
      m.rotation.z = Math.exp(-k * 4) * Math.sin(k * 10) * 0.4;
    });
  });

  const gold = flat("#f9c513", 0.35, 0.2, "#f9c513", 0.9);
  const dim = flat("#3d444d", 0.45, 0.6);
  return (
    <group>
      {/* The wall panel with its frame */}
      <mesh position={[0, 1.65, zW - 0.02]} material={flat(palette.ink, 0.6)} receiveShadow>
        <boxGeometry args={[WW + 0.3, 2.3, 0.04]} />
      </mesh>
      <mesh position={[0, 0.48, zW]} material={flat(accent, 0.4, 0.3)}>
        <boxGeometry args={[WW + 0.34, 0.05, 0.06]} />
      </mesh>
      {lit.map((on, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        return (
          <mesh
            key={i}
            ref={(m) => void (stars.current[i] = m)}
            geometry={geo}
            material={on ? gold : dim}
            position={[(col - (cols - 1) / 2) * (WW / cols), 2.45 - row * 0.5, zW]}
            onClick={(e) => clicked(e) && toggle(i)}
            {...pointer}
          />
        );
      })}
      {/* The counter */}
      <group position={[0, 3.1, zW + 0.01]}>
        <mesh material={flat("#161b22", 0.5)}>
          <boxGeometry args={[2.3, 0.5, 0.04]} />
        </mesh>
        <mesh geometry={badge} position={[-0.75, 0, 0.02]} material={gold} />
        <Text position={[0.15, 0.04, 0.03]} fontSize={0.2} color="#f6f8fa" anchorX="center" anchorY="middle">
          {`${count} stars`}
        </Text>
        <Text position={[0.15, -0.15, 0.03]} fontSize={0.07} color="#8b949e" anchorX="center" anchorY="middle">
          wouroud / wouroud-city
        </Text>
      </group>
      {w >= 6 && (
        <>
          <BeanBag position={[-1.7, 0, zW + 2.2]} color={palette.main} />
          <BeanBag position={[1.7, 0, zW + 2.2]} color={accent} />
        </>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Jira · The Sprint Board (hero)
// ---------------------------------------------------------------------------

/**
 * A big freestanding kanban board (To Do, In Progress, In Review, Done) with this city's tickets,
 * and a burndown chart on an easel beside it. E moves the next ticket one column to the right; the
 * burndown drops as story points reach Done.
 */
const COLUMNS = ["To Do", "In Progress", "In Review", "Done"];
type Ticket = { key: string; title: string; points: number; type: "story" | "bug" | "task" };
const TICKETS: Ticket[] = [
  { key: "CITY-101", title: "Skill houses district", points: 8, type: "story" },
  { key: "CITY-102", title: "Day / night cycle", points: 5, type: "story" },
  { key: "CITY-103", title: "Lamps on at dawn", points: 2, type: "bug" },
  { key: "CITY-104", title: "Bus routes", points: 5, type: "story" },
  { key: "CITY-105", title: "Quiz rooms", points: 3, type: "task" },
  { key: "CITY-106", title: "Car physics tuning", points: 3, type: "task" },
  { key: "CITY-107", title: "Signature pieces", points: 8, type: "story" },
  { key: "CITY-108", title: "Seat camera clips", points: 1, type: "bug" },
];
const TYPE_COLORS = { story: "#36b37e", bug: "#de350b", task: "#2684ff" };
const START_COLS = [3, 3, 2, 1, 1, 0, 0, 0];
const SPRINT_TOTAL = TICKETS.reduce((a, t) => a + t.points, 0);
const MOVES_NEEDED = START_COLS.reduce((a, c) => a + (3 - c), 0);
const remainingOf = (cols: number[]) => TICKETS.reduce((a, t, i) => a + (cols[i] === 3 ? 0 : t.points), 0);
const TICKET_TIPS = [
  "Keep In Progress short: a WIP limit finishes work faster than starting more.",
  "Done means it meets the team's Definition of Done, not just 'works on my machine'.",
  "The burndown only drops when points reach Done: half-finished work doesn't count.",
  "Story points size effort relative to other tickets. They're not hours.",
];

function JiraBoard({ w, d, toHouse }: SigProps) {
  const { palette, accent } = useHouse();
  const BW = Math.min(w - 3.2, 6);
  const BH = 2.3;
  const CY = 1.75;
  const BZ = Math.min(-0.4, d / 2 - 3.6);
  const colW = BW / 4;
  const cardW = colW / 2 - 0.07;
  const [cols, setCols] = useState(START_COLS);
  const [history, setHistory] = useState(() => [remainingOf(START_COLS)]);
  const cursor = useRef(0);
  const moves = useRef(0);
  const cards = useRef<(THREE.Group | null)[]>([]);

  const slot = (i: number, c: number[]) => {
    const j = c.slice(0, i).filter((v) => v === c[i]).length;
    const x = -BW / 2 + c[i] * colW + 0.05 + ((j % 2) + 0.5) * ((colW - 0.1) / 2);
    const y = BH / 2 - 0.62 - Math.floor(j / 2) * 0.42;
    return [x, y] as const;
  };

  const move = () => {
    if (cols.every((c) => c === 3)) {
      setCols(START_COLS.map(() => 0));
      setHistory([SPRINT_TOTAL]);
      moves.current = 0;
      cursor.current = 0;
      sfx.gong();
      toast("Sprint closed and reviewed. New sprint: everything back in To Do.", "📋 Jira");
      return;
    }
    let i = cursor.current % TICKETS.length;
    while (cols[i] === 3) i = (i + 1) % TICKETS.length;
    cursor.current = i + 1;
    const next = cols.map((c, k) => (k === i ? c + 1 : c));
    setCols(next);
    setHistory((h) => [...h, remainingOf(next)]);
    moves.current++;
    sfx.click();
    if (next.every((c) => c === 3)) {
      burstAt(toHouse, 0, 2.2, BZ + 0.3, [accent, "#36b37e", "#ffffff"], 20);
      toast("Every ticket is Done and the burndown hit zero. Sprint goal met 🎉", "📋 Jira");
    } else toast(`${TICKETS[i].key} → ${COLUMNS[next[i]]}. ${TICKET_TIPS[moves.current % TICKET_TIPS.length]}`, "📋 Jira");
  };
  const where = useWorldPoint(toHouse, 0, d / 2 - 0.4);
  useProximity({ id: "jira-board", label: cols.every((c) => c === 3) ? "Close the sprint" : "Move a ticket", radius: 2.4, where, run: move });

  useFrame((_, delta) => {
    cards.current.forEach((g, i) => {
      if (!g) return;
      const [x, y] = slot(i, cols);
      g.position.x = THREE.MathUtils.damp(g.position.x, x, 6, delta);
      g.position.y = THREE.MathUtils.damp(g.position.y, y, 6, delta);
    });
  });

  const { texture: chart } = useCanvas(
    640,
    480,
    (ctx, cw, ch) => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = "#172b4d";
      ctx.font = font(34, "700");
      ctx.fillText("Sprint burndown", 28, 50);
      const [x0, y0, x1, y1] = [70, 90, cw - 30, ch - 60];
      ctx.strokeStyle = "#dfe1e6";
      ctx.lineWidth = 2;
      for (let k = 0; k <= 4; k++) {
        const y = y0 + ((y1 - y0) * k) / 4;
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
        ctx.stroke();
        ctx.fillStyle = "#6b778c";
        ctx.font = font(20);
        ctx.fillText(`${Math.round(SPRINT_TOTAL * (1 - k / 4))}`, 24, y + 7);
      }
      const steps = Math.max(MOVES_NEEDED, history.length - 1, 1);
      const px = (k: number) => x0 + ((x1 - x0) * k) / steps;
      const py = (v: number) => y1 - ((y1 - y0) * v) / SPRINT_TOTAL;
      ctx.setLineDash([10, 8]);
      ctx.strokeStyle = "#a5adba";
      ctx.beginPath();
      ctx.moveTo(px(0), py(history[0]));
      ctx.lineTo(px(steps), py(0));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 5;
      ctx.beginPath();
      history.forEach((v, k) => {
        if (k === 0) ctx.moveTo(px(0), py(v));
        else {
          ctx.lineTo(px(k), py(history[k - 1]));
          ctx.lineTo(px(k), py(v));
        }
      });
      ctx.stroke();
      ctx.fillStyle = "#172b4d";
      ctx.font = font(24, "600");
      ctx.fillText(`${history[history.length - 1]} points left`, x0, ch - 20);
      ctx.fillStyle = "#6b778c";
      ctx.font = font(20);
      ctx.fillText("- - ideal", x1 - 110, ch - 20);
    },
    history.join(","),
  );

  const alu = flat("#c1c7d0", 0.3, 0.8);
  const easelX = BW / 2 + 0.85;
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        {[-1, 1].map((s) => (
          <CuboidCollider key={s} args={[0.08, 1.4, 0.4]} position={[s * (BW / 2 + 0.06), 1.4, BZ]} />
        ))}
        <CuboidCollider args={[0.3, 0.8, 0.3]} position={[easelX, 0.8, BZ + 0.3]} />
      </RigidBody>
      {/* Legs with feet and casters */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (BW / 2 + 0.06), 0, BZ]}>
          <mesh position={[0, 1.5, 0]} material={alu} castShadow>
            <boxGeometry args={[0.07, 3, 0.07]} />
          </mesh>
          <mesh position={[0, 0.08, 0]} material={alu}>
            <boxGeometry args={[0.08, 0.06, 0.8]} />
          </mesh>
          {[-0.36, 0.36].map((z) => (
            <mesh key={z} position={[0, 0.035, z]} rotation-z={Math.PI / 2} material={flat("#253858", 0.6)}>
              <cylinderGeometry args={[0.035, 0.035, 0.04, 12]} />
            </mesh>
          ))}
        </group>
      ))}
      {/* The board */}
      <group position={[0, CY, BZ]}>
        <mesh position={[0, 0, -0.03]} material={alu} castShadow>
          <boxGeometry args={[BW + 0.1, BH + 0.1, 0.05]} />
        </mesh>
        <mesh position={[0, 0, 0]} material={flat("#fafbfc", 0.4)} receiveShadow>
          <boxGeometry args={[BW, BH, 0.02]} />
        </mesh>
        <mesh position={[0, -BH / 2 - 0.06, 0.05]} material={alu}>
          <boxGeometry args={[BW * 0.9, 0.03, 0.1]} />
        </mesh>
        {COLUMNS.map((name, c) => (
          <group key={name} position={[-BW / 2 + (c + 0.5) * colW, 0, 0]}>
            <mesh position={[0, BH / 2 - 0.2, 0.012]} material={flat(c === 3 ? "#e3fcef" : c === 0 ? "#ebecf0" : "#deebff", 0.6)}>
              <boxGeometry args={[colW - 0.06, 0.3, 0.004]} />
            </mesh>
            <Text position={[0, BH / 2 - 0.2, 0.02]} fontSize={0.11} color={palette.ink} anchorX="center" anchorY="middle">
              {`${name.toUpperCase()}  ${cols.filter((v) => v === c).length}`}
            </Text>
            {c > 0 && (
              <mesh position={[-colW / 2, -0.05, 0.012]} material={flat("#c1c7d0", 0.6)}>
                <boxGeometry args={[0.012, BH - 0.2, 0.004]} />
              </mesh>
            )}
          </group>
        ))}
        {TICKETS.map((t, i) => {
          const [x, y] = slot(i, START_COLS);
          return (
            <group key={t.key} ref={(g) => void (cards.current[i] = g)} position={[x, y, 0.025]}>
              <mesh material={flat("#ffffff", 0.5)} castShadow>
                <boxGeometry args={[cardW, 0.36, 0.014]} />
              </mesh>
              <mesh position={[-cardW / 2 + 0.012, 0, 0.004]} material={flat(TYPE_COLORS[t.type], 0.5)}>
                <boxGeometry args={[0.024, 0.36, 0.012]} />
              </mesh>
              <Text position={[-cardW / 2 + 0.05, 0.08, 0.009]} fontSize={0.055} color={cols[i] === 3 ? "#36b37e" : accent} anchorX="left" anchorY="middle">
                {`${t.key} · ${t.points} pt`}
              </Text>
              <Text position={[-cardW / 2 + 0.05, -0.05, 0.009]} fontSize={0.06} color={palette.ink} anchorX="left" anchorY="middle" maxWidth={cardW - 0.08}>
                {t.title}
              </Text>
            </group>
          );
        })}
      </group>
      {/* The burndown easel */}
      <group position={[easelX, 0, BZ + 0.3]} rotation-y={-0.3}>
        {[-0.35, 0.35].map((x) => (
          <mesh key={x} position={[x, 0.75, 0.08]} rotation-x={-0.08} material={alu}>
            <cylinderGeometry args={[0.02, 0.02, 1.5, 8]} />
          </mesh>
        ))}
        <mesh position={[0, 0.7, -0.2]} rotation-x={0.25} material={alu}>
          <cylinderGeometry args={[0.02, 0.02, 1.45, 8]} />
        </mesh>
        <Panel position={[0, 1.55, 0.1]} width={1} height={0.75} map={chart} frame="#c1c7d0" />
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Jira · Stand-up Circle (room)
// ---------------------------------------------------------------------------

/**
 * A circle of standing high tables and a big wall timer. E starts the stand-up: the timer runs
 * down from 15:00 (fast), each person answers yesterday / today / blockers in turn, and it ends
 * well inside the time-box.
 */
const STANDUP = [
  { who: "Wouroud", lines: ["Yesterday… shipped the bus stops.", "Today… the quiz rooms.", "Blockers… none."] },
  { who: "Sami", lines: ["Yesterday… fixed the street lamps.", "Today… car physics tuning.", "Blockers… waiting on a review of PR #15."] },
  { who: "Lina", lines: ["Yesterday… sprint board cleanup.", "Today… pairing on signature pieces.", "Blockers… none, all good."] },
];
const PROMPTS = STANDUP.flatMap((s, i) => s.lines.map((line) => ({ speaker: i, text: `${s.who}: ${line}` })));
const SIM_MINUTE = 1.5; // real seconds per stand-up minute
const SPEAKER_TABLES = [1, 3, 0];

function JiraStandup({ w, d, toHouse }: SigProps) {
  const { accent } = useHouse();
  const [tick, setTick] = useState(-1); // 5-second steps elapsed, -1 = not started
  const started = useRef(-1);
  const total = PROMPTS.length * 12; // one prompt per minute
  const done = tick >= total;
  const running = tick >= 0 && !done;
  const prompt = running ? PROMPTS[Math.min(PROMPTS.length - 1, Math.floor(tick / 12))] : null;
  const left = 15 * 60 - Math.max(0, tick) * 5;
  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;

  const start = () => {
    if (running) return;
    started.current = now();
    setTick(0);
    sfx.gong();
  };
  const where = useWorldPoint(toHouse, 0, Math.min(d / 2 - 0.9, 3));
  useProximity({ id: "jira-standup", label: running ? "Stand-up in progress…" : "Start stand-up", radius: 2.2, where, run: start });

  useFrame(() => {
    if (started.current < 0) return;
    const k = Math.min(total, Math.floor(((now() - started.current) / SIM_MINUTE) * 12));
    if (k !== tick) setTick(k);
    if (k >= total) {
      started.current = -1;
      sfx.gong();
      burstAt(toHouse, 0, 2.4, -d / 2 + 0.6, [accent, "#36b37e", "#ffffff"], 18);
      toast("Stand-up done in 9 minutes 🎉 The daily scrum is time-boxed to 15 minutes; details move to a follow-up.", "⏱ Stand-up");
    }
  });

  const r = Math.min(1.7, d / 2 - 1.6, w / 2 - 1.2);
  const cz = -0.4;
  const tables = Array.from({ length: 5 }, (_, i) => {
    const a = Math.PI + (i / 5) * Math.PI * 2 + Math.PI / 5;
    return { x: Math.sin(a) * r, z: cz + Math.cos(a) * r, a };
  });
  const speakerTable = prompt ? SPEAKER_TABLES[prompt.speaker] : -1;
  const TW = Math.min(2.6, w - 1);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        {tables.map((t, i) => (
          <CuboidCollider key={i} args={[0.3, 0.55, 0.3]} position={[t.x, 0.55, t.z]} />
        ))}
      </RigidBody>
      {/* The wall timer */}
      <group position={[0, 2.25, -d / 2 + 0.12]}>
        <mesh position={[0, 0, -0.03]} material={flat("#c1c7d0", 0.3, 0.8)}>
          <boxGeometry args={[TW + 0.12, 1.42, 0.06]} />
        </mesh>
        <mesh material={flat("#172b4d", 0.5)}>
          <boxGeometry args={[TW, 1.3, 0.02]} />
        </mesh>
        <Text position={[0, 0.5, 0.02]} fontSize={0.1} color="#8993a4" anchorX="center" anchorY="middle">
          DAILY STAND-UP · 15 MIN TIME-BOX
        </Text>
        <Text position={[0, 0.12, 0.02]} fontSize={0.48} color={done ? "#36b37e" : running ? "#ffffff" : "#8993a4"} anchorX="center" anchorY="middle">
          {clock}
        </Text>
        <Text position={[0, -0.38, 0.02]} fontSize={0.1} color={done ? "#36b37e" : "#deebff"} anchorX="center" anchorY="middle" maxWidth={TW - 0.2} textAlign="center">
          {done ? "Stand-up done in 9 minutes 🎉" : prompt ? prompt.text : "Yesterday… / Today… / Blockers…"}
        </Text>
        <mesh position={[0, -0.6, 0.015]} material={flat("#2c3e5d", 0.5)}>
          <boxGeometry args={[TW - 0.2, 0.04, 0.01]} />
        </mesh>
        <mesh position={[(-(TW - 0.2) / 2) * (Math.max(0, tick) / total) * 0.6, -0.6, 0.02]} scale-x={1 - (Math.max(0, tick) / total) * 0.6} material={flat(accent, 0.3, 0, accent, 1.2)}>
          <boxGeometry args={[TW - 0.2, 0.04, 0.01]} />
        </mesh>
      </group>
      {/* The circle of high tables */}
      {tables.map((t, i) => (
        <group key={i}>
          <Table position={[t.x, 0, t.z]} width={0.62} height={1.05} top="walnut" />
          <mesh position={[t.x, 0.012, t.z]} rotation-x={-Math.PI / 2} material={i === speakerTable ? flat(accent, 0.3, 0, accent, 1.4) : flat("#c1c7d0", 0.6)}>
            <ringGeometry args={[0.42, 0.48, 32]} />
          </mesh>
        </group>
      ))}
      <Suspense fallback={null}>
        {SPEAKER_TABLES.slice(0, 2).map((ti, k) => {
          const t = tables[ti];
          const x = t.x * 1.3;
          const z = cz + (t.z - cz) * 1.3;
          return (
            <group key={ti} position={[x, 0, z]} rotation-y={Math.atan2(-x, cz - z)}>
              <Person look={NPC_PEOPLE[k + 2]} animation={speakerTable === ti ? "emote-yes" : "idle"} detail={false} />
            </group>
          );
        })}
      </Suspense>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Jira · Retro Room (room)
// ---------------------------------------------------------------------------

/**
 * A retro wall with three columns: Went well, To improve, Action items. Click a column (or press E)
 * to stick a note with a real-sounding retro line on it, up to six per column.
 */
const RETRO = [
  { title: "Went well", color: "#abf5d1", head: "#36b37e", lines: ["Pairing on car physics was great", "Demo day went smoothly", "Fast code reviews", "No weekend deploys", "Clear sprint goal", "Good test coverage"] },
  { title: "To improve", color: "#fff0b3", head: "#ff991f", lines: ["Stand-ups ran long", "Too many tickets in progress", "Flaky CI tests", "Late scope changes", "PRs too big to review", "Unclear acceptance criteria"] },
  { title: "Action items", color: "#b3d4ff", head: "#0052cc", lines: ["WIP limit of 3 (Sami)", "Fix flaky test by Friday", "Split PRs under 300 lines", "Refine tickets on Tuesdays", "Timebox stand-up to 15 min", "Add a CI cache step"] },
];
const RETRO_MAX = 6;

function JiraRetro({ w, d, toHouse }: SigProps) {
  const { palette } = useHouse();
  const [counts, setCounts] = useState([2, 1, 1]);
  const born = useRef(new Map<string, number>());
  const notes = useRef(new Map<string, THREE.Group>());
  const turn = useRef(0);
  const colW = Math.min(1.3, (w - 1.4) / 3);
  const s = Math.min(0.38, colW / 2 - 0.07);
  const zW = -d / 2 + 0.12;
  const full = counts.every((c) => c >= RETRO_MAX);

  const add = (c: number) => {
    if (counts[c] >= RETRO_MAX) {
      sfx.clunk();
      toast(`"${RETRO[c].title}" is full. Time to dot-vote and pick the top items.`, "🗒 Retro");
      return;
    }
    born.current.set(`${c}-${counts[c]}`, now());
    setCounts(counts.map((v, k) => (k === c ? v + 1 : v)));
    sfx.rustle();
    if (counts[c] + 1 === RETRO_MAX) toast(`${RETRO[c].title}: six notes. A retro looks at how the team worked, then commits to a few action items.`, "🗒 Retro");
  };
  const next = () => {
    for (let k = 0; k < 3; k++) {
      const c = (turn.current + k) % 3;
      if (counts[c] < RETRO_MAX) {
        turn.current = c + 1;
        add(c);
        return;
      }
    }
    toast("The board is full. Pick 2–3 action items with owners and close the retro.", "🗒 Retro");
  };
  const where = useWorldPoint(toHouse, 0, zW + 1.7);
  useProximity({ id: "jira-retro", label: full ? "Retro board full" : "Add a sticky note", radius: 2, where, run: next });

  useFrame(() => {
    const t = now();
    notes.current.forEach((g, key) => {
      const b = born.current.get(key);
      if (b === undefined) return;
      const k = clamp01((t - b) / 0.35);
      g.scale.setScalar(Math.max(0.001, 1 + Math.sin(k * Math.PI) * 0.25 - (1 - k)));
    });
  });

  return (
    <group>
      {RETRO.map((col, c) => {
        const x = (c - 1) * (colW + 0.12);
        return (
          <group key={col.title} position={[x, 1.5, zW]}>
            <group onClick={(e) => clicked(e) && add(c)} {...pointer}>
              <mesh position={[0, 0, -0.01]} material={flat("#ffffff", 0.5)} receiveShadow>
                <boxGeometry args={[colW, 1.9, 0.02]} />
              </mesh>
              <mesh position={[0, 0.86, 0.004]} material={flat(col.head, 0.5)}>
                <boxGeometry args={[colW, 0.18, 0.01]} />
              </mesh>
            </group>
            <mesh position={[0, 0, -0.025]} material={flat("#c1c7d0", 0.3, 0.8)}>
              <boxGeometry args={[colW + 0.06, 1.96, 0.02]} />
            </mesh>
            <Text position={[0, 0.86, 0.012]} fontSize={0.09} color="#ffffff" anchorX="center" anchorY="middle">
              {`${col.title}  (${counts[c]})`}
            </Text>
            {Array.from({ length: counts[c] }, (_, j) => {
              const key = `${c}-${j}`;
              return (
                <group
                  key={key}
                  ref={(g) => void (g ? notes.current.set(key, g) : notes.current.delete(key))}
                  position={[((j % 2) - 0.5) * (s + 0.06), 0.55 - Math.floor(j / 2) * (s + 0.1), 0.012]}
                  rotation-z={(((j * 37 + c * 11) % 7) - 3) * 0.022}
                >
                  <mesh material={flat(col.color, 0.8)} castShadow>
                    <boxGeometry args={[s, s, 0.006]} />
                  </mesh>
                  <Text position={[0, 0, 0.005]} fontSize={0.04} color={palette.ink} anchorX="center" anchorY="middle" maxWidth={s - 0.05} textAlign="center">
                    {col.lines[j]}
                  </Text>
                </group>
              );
            })}
          </group>
        );
      })}
      {w >= 6 &&
        [-1.8, -0.6, 0.6, 1.8].map((x) => <ConferenceChair key={x} position={[x * Math.min(1, w / 9), 0, Math.min(0.4, d / 2 - 2.4)]} facing={Math.PI} color={palette.main} />)}
    </group>
  );
}

// ---------------------------------------------------------------------------
// REST · The Counters (hero)
// ---------------------------------------------------------------------------

/**
 * Four post-office windows side by side, one per verb (GET, POST, PUT/PATCH, DELETE), with brass
 * grilles. E sends the next request (or click a window): its window lights and its little display
 * shows the request and the response, and a note says whether that verb is safe and idempotent.
 */
const VERBS = ["GET", "POST", "PUT/PATCH", "DELETE"];
const EXCHANGES: { req: string; res: string; note: string }[][] = [
  [{ req: "GET /orders/42", res: "200 OK · the order as JSON", note: "GET is safe and idempotent: it only reads. Ask a hundred times and nothing changes on the server." }],
  [{ req: "POST /orders", res: "201 Created · Location: /orders/43", note: "POST is neither safe nor idempotent: send it twice and you may create two orders." }],
  [
    { req: "PUT /orders/42", res: "200 OK · order replaced", note: "PUT replaces the whole resource and is idempotent: the same PUT twice leaves the same state." },
    { req: "PATCH /orders/42", res: "200 OK · status updated", note: "PATCH changes only some fields. It isn't guaranteed to be idempotent (think \"add 1 to quantity\")." },
  ],
  [{ req: "DELETE /orders/43", res: "204 No Content", note: "DELETE is idempotent but not safe: the first call removes /orders/43, repeating it leaves the same state (often a 404)." }],
];

function RestCounters({ w, d, toHouse }: SigProps) {
  const { palette, accent } = useHouse();
  const cw = Math.min(1.9, (w - 0.6) / 4);
  const [litVerb, setLitVerb] = useState(-1);
  const [shown, setShown] = useState<(string | null)[]>(() => VERBS.map(() => null));
  const sent = useRef(0);
  const uses = useRef(VERBS.map(() => 0));
  const glow = useRef<THREE.Mesh>(null);
  const litAt = useRef(0);

  const grille = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    const inner = cw - 0.2;
    const bars = Math.max(5, Math.round(inner / 0.11));
    for (let i = 0; i <= bars; i++) parts.push(cylAt(0.009, 0.82, -inner / 2 + (i * inner) / bars, 1.82, 0, "y", 8));
    for (const y of [1.4, 2.23]) parts.push(cylAt(0.014, inner + 0.02, 0, y, 0, "x", 8));
    // An arch of rods over the speaking hole
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI;
      parts.push(boxAt(0.025, 0.025, 0.02, Math.cos(a) * 0.22, 1.4 + Math.sin(a) * 0.14, 0));
    }
    return merged(parts);
  }, [cw]);
  useDispose(grille);

  const send = (v: number) => {
    const list = EXCHANGES[v];
    const ex = list[uses.current[v]++ % list.length];
    setLitVerb(v);
    setShown((s) => s.map((x, i) => (i === v ? `${ex.req}\n→ ${ex.res}` : x)));
    litAt.current = now();
    sfx.coin();
    burstAt(toHouse, (v - 1.5) * cw, 1.9, 0.4, [accent, "#ffffff"], 8);
    toast(`${ex.req} → ${ex.res}. ${ex.note}`, `📮 ${VERBS[v]}`);
  };
  const run = () => send(sent.current++ % VERBS.length);
  const where = useWorldPoint(toHouse, 0, d / 2 - 0.4);
  useProximity({ id: "rest-counters", label: "Send a request", radius: 2.4, where, run });

  useFrame(() => {
    if (!glow.current) return;
    const m = glow.current.material as THREE.MeshStandardMaterial;
    m.emissiveIntensity = 0.6 + 0.6 * Math.exp(-(now() - litAt.current) * 2);
  });

  const wood = flat(palette.ink, 0.55, 0.1);
  const brass = flat(accent, 0.3, 0.85);
  const glowMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffe2a8", emissive: "#ffc766", emissiveIntensity: 1, roughness: 0.4, toneMapped: false }), []);
  useDispose(glowMat);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[2 * cw + 0.1, 0.55, 0.4]} position={[0, 0.55, 0]} />
        <CuboidCollider args={[2 * cw + 0.1, 1.5, 0.1]} position={[0, 1.5, -0.2]} />
      </RigidBody>
      {/* Cornice over all four windows */}
      <mesh position={[0, 2.88, -0.1]} material={wood} castShadow>
        <boxGeometry args={[4 * cw + 0.3, 0.36, 0.4]} />
      </mesh>
      <mesh position={[0, 2.68, 0.1]} material={brass}>
        <boxGeometry args={[4 * cw + 0.34, 0.05, 0.05]} />
      </mesh>
      <Text position={[0, 2.88, 0.11]} fontSize={0.15} color={accent} anchorX="center" anchorY="middle">
        POST OFFICE · /api/v1
      </Text>
      {VERBS.map((verb, v) => {
        const on = litVerb === v;
        return (
          <group key={verb} position={[(v - 1.5) * cw, 0, 0]} onClick={(e) => clicked(e) && send(v)} {...pointer}>
            {/* Counter base and top */}
            <mesh position={[0, 0.52, 0]} material={wood} castShadow receiveShadow>
              <boxGeometry args={[cw - 0.04, 1.04, 0.6]} />
            </mesh>
            {[-0.18, 0.18].map((y) => (
              <mesh key={y} position={[0, 0.52 + y, 0.302]} material={flat(palette.second, 0.5, 0.4)}>
                <boxGeometry args={[cw - 0.3, 0.3, 0.01]} />
              </mesh>
            ))}
            <mesh position={[0, 1.07, 0.05]} material={flat("#efe7d6", 0.25, 0.1)} castShadow>
              <boxGeometry args={[cw, 0.06, 0.72]} />
            </mesh>
            {/* Window: posts, sign, glowing back and brass grille */}
            {[-1, 1].map((s) => (
              <mesh key={s} position={[s * (cw / 2 - 0.05), 1.8, -0.15]} material={wood} castShadow>
                <boxGeometry args={[0.1, 1.46, 0.14]} />
              </mesh>
            ))}
            <mesh position={[0, 2.43, -0.12]} material={wood}>
              <boxGeometry args={[cw - 0.02, 0.36, 0.18]} />
            </mesh>
            <Text position={[0, 2.43, -0.02]} fontSize={0.22} color={on ? "#fff4d6" : accent} anchorX="center" anchorY="middle" outlineWidth={on ? 0.01 : 0} outlineColor={accent}>
              {verb}
            </Text>
            <mesh ref={on ? glow : undefined} position={[0, 1.8, -0.2]} material={on ? glowMat : flat("#1f2d26", 0.25, 0.3)}>
              <planeGeometry args={[cw - 0.12, 0.86]} />
            </mesh>
            <mesh geometry={grille} position={[0, 0, -0.12]} material={brass} />
            {/* The little display on the counter */}
            <group position={[0, 1.2, 0.25]} rotation-x={-0.35}>
              <mesh material={flat("#101512", 0.4, 0.3)}>
                <boxGeometry args={[cw - 0.2, 0.2, 0.04]} />
              </mesh>
              <Text position={[0, 0, 0.022]} fontSize={0.045} color={on ? "#86efac" : "#7a8a80"} anchorX="center" anchorY="middle" maxWidth={cw - 0.26} textAlign="center">
                {shown[v] ?? "Next customer, please"}
              </Text>
            </group>
          </group>
        );
      })}
    </group>
  );
}

// ---------------------------------------------------------------------------
// REST · Resource Boxes (room)
// ---------------------------------------------------------------------------

/**
 * A wall of brass mailboxes, one per resource URL (/users/1, /orders/42…). Click one and its door
 * swings open; the letter inside (its JSON representation) shows on the board beside the wall.
 * E opens the next box.
 */
const RESOURCES: { path: string; body: Record<string, unknown> }[] = [
  { path: "/users/1", body: { id: 1, name: "Wouroud", role: "developer", city: "Tripoli" } },
  { path: "/users/2", body: { id: 2, name: "Sami", role: "designer", city: "Beirut" } },
  { path: "/orders/42", body: { id: 42, userId: 1, items: 3, status: "shipped" } },
  { path: "/orders/43", body: { id: 43, userId: 2, items: 1, status: "pending" } },
  { path: "/projects/7", body: { id: 7, name: "Wouroud's City", stack: ["three.js", "Next.js"] } },
  { path: "/projects/8", body: { id: 8, name: "Portfolio API", stack: ["Node", "REST"] } },
  { path: "/skills/3", body: { id: 3, name: "REST", house: "The Post Office" } },
  { path: "/posts/12", body: { id: 12, title: "Nouns in URLs", authorId: 1 } },
  { path: "/comments/5", body: { id: 5, postId: 12, text: "Plural paths ftw" } },
  { path: "/buses/2", body: { id: 2, route: "downtown", stops: 6 } },
  { path: "/houses/rest", body: { id: "rest", concept: "The Post Office" } },
  { path: "/users/1/orders", body: { userId: 1, orders: [42], count: 1 } },
];
const RESOURCE_TIPS = [
  "Resources are nouns with their own URL: /orders/42, not /getOrder?id=42.",
  "Collections are plural: /users lists them, /users/1 is one of them.",
  "Nested paths show relationships: /users/1/orders.",
  "The letter is a representation: Content-Type: application/json says how it's written.",
  "REST is stateless: each request carries everything the server needs, like the auth token.",
];

function RestMailboxes({ w, d, toHouse }: SigProps) {
  const { palette, accent } = useHouse();
  const cols = w >= 7 ? 4 : 3;
  const rows = RESOURCES.length / cols;
  const bw = Math.min(0.52, (w / 2 - 0.7) / cols);
  const bh = Math.min(0.42, 1.7 / rows);
  const wallW = cols * bw;
  const wallH = rows * bh;
  const mx = -(wallW / 2 + 0.25);
  const my = 0.75 + wallH / 2;
  const zW = -d / 2 + 0.12;
  const LW = Math.min(1.5, w / 2 - 0.7);
  const [open, setOpen] = useState(-1);
  const doors = useRef<(THREE.Group | null)[]>([]);
  const shownCount = useRef(0);
  const res = open >= 0 ? RESOURCES[open] : null;

  const { texture } = useCanvas(
    600,
    720,
    (ctx, cw, ch) => {
      ctx.fillStyle = "#fbf8f0";
      ctx.fillRect(0, 0, cw, ch);
      ctx.strokeStyle = "#c9a45a";
      ctx.lineWidth = 6;
      ctx.strokeRect(14, 14, cw - 28, ch - 28);
      ctx.fillStyle = palette.ink;
      ctx.font = font(30, "700");
      ctx.fillText(res ? `GET ${res.path}` : "Pick a mailbox", 40, 74);
      ctx.fillStyle = "#15803d";
      ctx.font = font(24, "600");
      ctx.fillText(res ? "200 OK · application/json" : "Each box is one resource URL", 40, 112);
      ctx.fillStyle = "#e5dccb";
      ctx.fillRect(40, 132, cw - 80, 3);
      if (!res) return;
      ctx.font = `25px ui-monospace, Menlo, Consolas, monospace`;
      JSON.stringify(res.body, null, 2)
        .split("\n")
        .forEach((line, i) => {
          const y = 180 + i * 38;
          const m = line.match(/^(\s*)("[^"]+")(:\s*)(.*)$/);
          if (!m) {
            ctx.fillStyle = "#6b6458";
            ctx.fillText(line, 40, y);
            return;
          }
          const [, pad, key, colon, value] = m;
          let x = 40 + ctx.measureText(pad).width;
          ctx.fillStyle = "#9a3412";
          ctx.fillText(key, x, y);
          x += ctx.measureText(key + colon).width;
          ctx.fillStyle = value.startsWith('"') ? "#15803d" : "#1d4ed8";
          ctx.fillText(value, x, y);
        });
    },
    open,
  );

  const show = (i: number) => {
    setOpen(i === open ? -1 : i);
    sfx.click();
    if (i === open) return;
    toast(`GET ${RESOURCES[i].path} → 200 OK. ${RESOURCE_TIPS[shownCount.current++ % RESOURCE_TIPS.length]}`, "📬 Resource Boxes");
  };
  const where = useWorldPoint(toHouse, 0, zW + 1.8);
  useProximity({ id: "rest-mailboxes", label: "Open the next mailbox", radius: 2, where, run: () => show((open + 1) % RESOURCES.length) });

  useFrame((_, delta) => {
    doors.current.forEach((g, i) => {
      if (g) g.rotation.y = THREE.MathUtils.damp(g.rotation.y, i === open ? -1.7 : 0, 8, delta);
    });
  });

  const brass = flat(accent, 0.3, 0.85);
  const dark = flat("#14110c", 0.8);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[wallW / 2 + 0.06, my, 0.2]} position={[mx, my, zW + 0.08]} />
      </RigidBody>
      {/* The cabinet */}
      <mesh position={[mx, my, zW + 0.08]} material={flat("#3b2a1c", 0.55)} castShadow receiveShadow>
        <boxGeometry args={[wallW + 0.12, wallH + 0.12, 0.36]} />
      </mesh>
      <mesh position={[mx, 0.37, zW + 0.08]} material={flat("#2a1d13", 0.6)}>
        <boxGeometry args={[wallW + 0.2, 0.74, 0.4]} />
      </mesh>
      <mesh position={[mx, my + wallH / 2 + 0.1, zW + 0.1]} material={brass}>
        <boxGeometry args={[wallW + 0.2, 0.08, 0.4]} />
      </mesh>
      {RESOURCES.map((r, i) => {
        const c = i % cols;
        const row = Math.floor(i / cols);
        const x = mx - wallW / 2 + (c + 0.5) * bw;
        const y = my + wallH / 2 - (row + 0.5) * bh;
        const fz = zW + 0.265;
        return (
          <group key={r.path}>
            <mesh position={[x, y, fz + 0.001]} material={dark}>
              <planeGeometry args={[bw - 0.05, bh - 0.05]} />
            </mesh>
            {i === open && (
              <mesh position={[x, y - bh * 0.2, fz + 0.01]} rotation-x={-0.2} material={flat("#fbf8f0", 0.8)}>
                <boxGeometry args={[bw * 0.6, bh * 0.4, 0.01]} />
              </mesh>
            )}
            <group ref={(g) => void (doors.current[i] = g)} position={[x - bw / 2 + 0.03, y, fz + 0.012]} onClick={(e) => clicked(e) && show(i)} {...pointer}>
              <mesh position={[(bw - 0.06) / 2, 0, 0]} material={brass} castShadow>
                <boxGeometry args={[bw - 0.06, bh - 0.06, 0.02]} />
              </mesh>
              <mesh position={[(bw - 0.06) / 2, bh * 0.14, 0.011]} material={flat("#2b241a", 0.3, 0.4)}>
                <boxGeometry args={[(bw - 0.06) * 0.5, bh * 0.22, 0.004]} />
              </mesh>
              <mesh position={[bw - 0.12, -bh * 0.1, 0.02]} material={flat("#f3e2b4", 0.25, 0.9)}>
                <sphereGeometry args={[0.014, 10, 8]} />
              </mesh>
              <Text position={[(bw - 0.06) / 2, -bh * 0.18, 0.012]} fontSize={Math.min(0.045, bw * 0.09)} color="#2b241a" anchorX="center" anchorY="middle">
                {r.path}
              </Text>
            </group>
          </group>
        );
      })}
      {/* The letter board */}
      <Panel position={[LW / 2 + 0.35, 1.6, zW]} width={LW} height={LW * 1.2} map={texture} frame="#3b2a1c" />
      {d >= 8 && (
        <>
          <Table position={[0, 0, -0.6]} width={1.8} depth={0.9} top="walnut" />
          {[-0.5, 0.1, 0.55].map((x, k) => (
            <mesh key={x} position={[x, 0.76 + k * 0.01, -0.6 + (k - 1) * 0.12]} rotation-y={k * 0.3 - 0.2} material={flat("#fbf8f0", 0.8)} castShadow>
              <boxGeometry args={[0.3, 0.02 + k * 0.02, 0.2]} />
            </mesh>
          ))}
          <SideChair position={[-0.5, 0, 0.1]} facing={Math.PI} />
          <SideChair position={[0.5, 0, 0.1]} facing={Math.PI} />
        </>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// REST · Status Stamps (room)
// ---------------------------------------------------------------------------

/**
 * A stamp desk with a rack of rubber stamps, one per status code (200 … 500), and a letter. E (or a
 * click on a stamp) lifts the next stamp, presses it onto the letter and explains what it means.
 */
const CODES: { code: number; name: string; note: string }[] = [
  { code: 200, name: "OK", note: "The request worked; the answer is in the body." },
  { code: 201, name: "Created", note: "A new resource was made, usually after a POST. The Location header points to it." },
  { code: 204, name: "No Content", note: "It worked and there's nothing to send back, typical after a DELETE." },
  { code: 301, name: "Moved Permanently", note: "The resource has a new URL for good; clients and search engines should update their links." },
  { code: 400, name: "Bad Request", note: "The server can't process it: malformed JSON or invalid fields. Fix the request." },
  { code: 401, name: "Unauthorized", note: "Not authenticated: credentials are missing or invalid. Log in and send a token." },
  { code: 403, name: "Forbidden", note: "Authenticated, but not allowed to do this. Logging in again won't help." },
  { code: 404, name: "Not Found", note: "Nothing lives at this URL." },
  { code: 429, name: "Too Many Requests", note: "Rate limited. Slow down; a Retry-After header may say when to try again." },
  { code: 500, name: "Internal Server Error", note: "Something broke on the server. Not the client's fault." },
];
const codeColor = (c: number) => (c < 300 ? "#15803d" : c < 400 ? "#1d4ed8" : c < 500 ? "#c2410c" : "#b91c1c");

function RestStamps({ w, d, toHouse, rot }: SigProps) {
  const { palette, accent } = useHouse();
  const DW = Math.min(w - 1.2, 3.2);
  const z0 = -d / 2 + 0.9;
  const rackZ = z0 - 0.22;
  const gap = (DW - 0.4) / (CODES.length - 1);
  const stampX = (i: number) => -DW / 2 + 0.2 + i * gap;
  const [marks, setMarks] = useState<number[]>([]);
  const [active, setActive] = useState(-1);
  const anim = useRef<{ i: number; t0: number; tx: number; tz: number; pressed: boolean } | null>(null);
  const [turn, setTurn] = useState(0);
  const presses = useRef(0);
  const groups = useRef<(THREE.Group | null)[]>([]);

  const { texture } = useCanvas(
    768,
    512,
    (ctx, cw, ch) => {
      ctx.fillStyle = "#fbf8f0";
      ctx.fillRect(0, 0, cw, ch);
      ctx.strokeStyle = "#d9cdb4";
      ctx.lineWidth = 3;
      ctx.strokeRect(10, 10, cw - 20, ch - 20);
      ctx.fillStyle = "#6b6458";
      ctx.font = font(26, "600");
      ctx.fillText("HTTP/1.1 response", 36, 54);
      ctx.font = font(22);
      ctx.fillText("To: the client · Re: your request", 36, 88);
      marks.slice(-6).forEach((m, k) => {
        const c = CODES[m];
        const x = 140 + (k % 3) * 245;
        const y = 210 + Math.floor(k / 3) * 190;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(((k * 37) % 7) * 0.05 - 0.15);
        ctx.strokeStyle = codeColor(c.code);
        ctx.fillStyle = codeColor(c.code);
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(0, 0, 82, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 70, 0, Math.PI * 2);
        ctx.stroke();
        ctx.textAlign = "center";
        ctx.font = font(52, "800");
        ctx.fillText(`${c.code}`, 0, 8);
        ctx.font = font(c.name.length > 12 ? 15 : 19, "700");
        ctx.fillText(c.name.toUpperCase(), 0, 40);
        ctx.restore();
      });
      if (!marks.length) {
        ctx.fillStyle = "#a59c8a";
        ctx.font = font(28);
        ctx.fillText("(waiting for a status code)", 200, 300);
      }
    },
    marks.join(","),
  );

  const stampIt = (i: number) => {
    if (anim.current) return false;
    const k = presses.current++;
    anim.current = { i, t0: now(), tx: ((k % 3) - 1) * 0.28, tz: z0 + 0.04 + (Math.floor(k / 3) % 2) * 0.2, pressed: false };
    setActive(i);
    sfx.click();
    return true;
  };
  const stampNext = () => {
    if (stampIt(turn % CODES.length)) setTurn(turn + 1);
  };
  const where = useWorldPoint(toHouse, 0, z0 + 1.05);
  useProximity({ id: "rest-stamps", label: `Stamp ${CODES[turn % CODES.length].code}`, radius: 1.9, where, run: stampNext });
  const seats = useMemo(() => [seatAt("rest-stamps-chair", toHouse, rot, 0, z0 + 0.75, Math.PI)], [toHouse, rot, z0]);

  useFrame(() => {
    const a = anim.current;
    groups.current.forEach((g, i) => {
      if (!g) return;
      const rest: [number, number, number] = [stampX(i), 0.826, rackZ];
      if (!a || a.i !== i) {
        g.position.set(...rest);
        return;
      }
      const u = (now() - a.t0) / 1.6;
      const press = 0.76;
      let x = a.tx;
      let y = press;
      let z = a.tz;
      if (u < 0.3) {
        const k = ease(u / 0.3);
        x = lerp(rest[0], a.tx, k);
        z = lerp(rest[2], a.tz, k);
        y = lerp(rest[1], press + 0.2, k) + Math.sin(k * Math.PI) * 0.25;
      } else if (u < 0.42) y = lerp(press + 0.2, press, ease((u - 0.3) / 0.12));
      else if (u < 0.55) y = press + (u > 0.48 ? ((u - 0.48) / 0.07) * 0.2 : 0);
      else {
        const k = ease((u - 0.55) / 0.45);
        x = lerp(a.tx, rest[0], k);
        z = lerp(a.tz, rest[2], k);
        y = lerp(press + 0.2, rest[1], k) + Math.sin(k * Math.PI) * 0.25;
      }
      g.position.set(x, y, z);
      if (u >= 0.42 && !a.pressed) {
        a.pressed = true;
        const c = CODES[i];
        setMarks((m) => [...m, i]);
        sfx.clunk();
        toast(c.note, `📮 ${c.code} ${c.name}`);
      }
      if (u >= 1) {
        anim.current = null;
        setActive(-1);
      }
    });
  });

  const wood = flat("#5a3d27", 0.55);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[DW / 2, 0.45, 0.4]} position={[0, 0.45, z0]} />
      </RigidBody>
      <WallBoard
        position={[0, 2.05, -d / 2 + 0.12]}
        width={Math.min(2.6, DW)}
        height={1.15}
        kicker="Status codes"
        title="Five families"
        lines={["1xx info · 2xx success", "3xx redirection", "4xx client error · 5xx server error"]}
      />
      {/* The desk */}
      <mesh position={[0, 0.73, z0]} material={wood} castShadow receiveShadow>
        <boxGeometry args={[DW, 0.05, 0.8]} />
      </mesh>
      <mesh position={[0, 0.4, z0 - 0.36]} material={wood}>
        <boxGeometry args={[DW - 0.1, 0.6, 0.03]} />
      </mesh>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * (DW / 2 - 0.06), 0.355, z0 + sz * 0.34]} material={flat("#3b2818", 0.6)} castShadow>
            <boxGeometry args={[0.06, 0.71, 0.06]} />
          </mesh>
        )),
      )}
      {/* The rack */}
      <mesh position={[0, 0.79, rackZ]} material={flat("#3b2818", 0.5)} castShadow>
        <boxGeometry args={[DW - 0.2, 0.07, 0.16]} />
      </mesh>
      <mesh position={[0, 0.79, rackZ + 0.081]} material={flat(accent, 0.3, 0.85)}>
        <boxGeometry args={[DW - 0.2, 0.05, 0.004]} />
      </mesh>
      {CODES.map((c, i) => (
        <group key={c.code}>
          <Text position={[stampX(i), 0.79, rackZ + 0.085]} fontSize={0.03} color={palette.ink} anchorX="center" anchorY="middle">
            {`${c.code}`}
          </Text>
          <group ref={(g) => void (groups.current[i] = g)} position={[stampX(i), 0.826, rackZ]} onClick={(e) => clicked(e) && stampIt(i)} {...pointer}>
            <mesh position={[0, 0.015, 0]} material={flat("#2b2b2b", 0.9)}>
              <boxGeometry args={[0.1, 0.03, 0.08]} />
            </mesh>
            <mesh position={[0, 0.055, 0]} material={flat("#8a5a3b", 0.6)} castShadow>
              <boxGeometry args={[0.11, 0.05, 0.09]} />
            </mesh>
            <mesh position={[0, 0.12, 0]} material={flat("#6b4429", 0.6)}>
              <cylinderGeometry args={[0.014, 0.02, 0.09, 10]} />
            </mesh>
            <mesh position={[0, 0.19, 0]} material={active === i ? flat(codeColor(c.code), 0.3, 0, codeColor(c.code), 0.8) : flat(codeColor(c.code), 0.35, 0.1)}>
              <sphereGeometry args={[0.034, 14, 10]} />
            </mesh>
          </group>
        </group>
      ))}
      {/* The letter, lying on the desk */}
      <group position={[0, 0.758, z0 + 0.14]} rotation-x={-Math.PI / 2}>
        <Panel position={[0, 0, 0]} width={0.96} height={0.64} map={texture} frame="#d9cdb4" />
      </group>
      <ExecChair position={[0, 0, z0 + 0.75]} facing={Math.PI} />
      <Seats seats={seats} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// GraphQL · The Observatory (hero)
// ---------------------------------------------------------------------------

/**
 * A brass telescope on a turning pier, under a constellation: the schema's types as glowing star
 * nodes joined by thin edges. E runs the next of three queries: only the nodes and edges it asks
 * for light up, the telescope swings toward them, and the console shows the query and its result.
 */
const NODES: { name: string; p: [number, number, number] }[] = [
  { name: "User", p: [0, 4.4, -1.6] },
  { name: "Projects", p: [-2.5, 3.7, -1.1] },
  { name: "Skills", p: [-1.4, 5.3, -2.5] },
  { name: "Posts", p: [2.3, 3.8, -1.2] },
  { name: "Comments", p: [3.1, 5.1, -2.2] },
  { name: "House", p: [-3.3, 5.5, -2.9] },
];
const EDGES: [number, number][] = [
  [0, 1],
  [0, 2],
  [0, 3],
  [3, 4],
  [4, 0],
  [1, 2],
  [2, 5],
];
const QUERIES = [
  {
    query: "{\n  user {\n    name\n    projects { name }\n  }\n}",
    nodes: [0, 1],
    edges: [0],
    result: { data: { user: { name: "Wouroud", projects: [{ name: "Wouroud's City" }] } } },
    note: "No over-fetching: you asked for name and projects { name }, so that's all that came back.",
  },
  {
    query: "{\n  user {\n    skills {\n      name\n      house { concept }\n    }\n  }\n}",
    nodes: [0, 2, 5],
    edges: [1, 6],
    result: { data: { user: { skills: [{ name: "GraphQL", house: { concept: "The Observatory" } }] } } },
    note: "Nested fields follow the graph: user → skills → house, all in one request, no extra round-trips.",
  },
  {
    query: "{\n  posts(first: 1) {\n    title\n    comments {\n      author { name }\n    }\n  }\n}",
    nodes: [3, 4, 0],
    edges: [3, 4],
    result: { data: { posts: [{ title: "A city in three.js", comments: [{ author: { name: "Sami" } }] }] } },
    note: "Arguments shape the answer: posts(first: 1) asks for one post, and the author is reached through its comments.",
  },
];

function GraphqlStars({ w, d, toHouse }: SigProps) {
  const { palette, accent } = useHouse();
  const sx = Math.min(1, w / 9);
  const TZ = Math.min(1.2, d / 2 - 2);
  const nodes = useMemo(() => NODES.map((n) => new THREE.Vector3(n.p[0] * sx, n.p[1], n.p[2])), [sx]);
  const edges = useMemo(
    () =>
      EDGES.map(([a, b]) => {
        const pa = nodes[a];
        const pb = nodes[b];
        const dir = pb.clone().sub(pa);
        return {
          mid: pa.clone().add(pb).multiplyScalar(0.5),
          len: dir.length(),
          quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()),
        };
      }),
    [nodes],
  );
  const sky = useMemo(() => {
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const pts: number[] = [];
    for (let i = 0; i < 90; i++) pts.push((rnd() - 0.5) * w * 1.1, 3 + rnd() * 3, -0.5 - rnd() * (d / 2));
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [w, d]);
  useDispose(sky);

  const [q, setQ] = useState(-1);
  const yaw = useRef<THREE.Group>(null);
  const tube = useRef<THREE.Group>(null);
  const query = q >= 0 ? QUERIES[q] : null;

  const aim = useMemo(() => {
    if (!query) return { yaw: Math.PI, pitch: 0.7 };
    const c = new THREE.Vector3();
    query.nodes.forEach((i) => c.add(nodes[i]));
    c.multiplyScalar(1 / query.nodes.length);
    const dx = c.x;
    const dz = c.z - TZ;
    const dy = c.y - 1.45;
    return { yaw: Math.atan2(dx, dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
  }, [query, nodes, TZ]);

  const run = () => {
    const next = (q + 1) % QUERIES.length;
    setQ(next);
    sfx.sparkle();
    const c = QUERIES[next].nodes[0];
    burstAt(toHouse, nodes[c].x, nodes[c].y, nodes[c].z, [accent, "#ffffff"], 14);
    toast(`POST /graphql → 200. ${QUERIES[next].note}`, "🔭 GraphQL");
  };
  const where = useWorldPoint(toHouse, 0, d / 2 - 0.4);
  useProximity({ id: "graphql-stars", label: "Run a query", radius: 2.4, where, run });

  useFrame((_, delta) => {
    if (yaw.current) {
      const cur = yaw.current.rotation.y;
      const diff = Math.atan2(Math.sin(aim.yaw - cur), Math.cos(aim.yaw - cur));
      yaw.current.rotation.y = cur + diff * (1 - Math.exp(-2.5 * delta));
    }
    if (tube.current) tube.current.rotation.x = THREE.MathUtils.damp(tube.current.rotation.x, -aim.pitch, 2.5, delta);
  });

  const { texture } = useCanvas(
    900,
    640,
    (ctx, cw, ch) => {
      ctx.fillStyle = "#12051a";
      ctx.fillRect(0, 0, cw, ch);
      box(ctx, 0, 0, cw, 48, 0, "#2a0b38");
      ctx.fillStyle = "#ff9ad5";
      ctx.font = font(24, "700");
      ctx.fillText("POST /graphql", 24, 33);
      ctx.fillStyle = "#b9a3c4";
      ctx.font = font(22);
      ctx.fillText(query ? `query ${q + 1} of ${QUERIES.length}` : "one endpoint", cw - 220, 33);
      ctx.fillStyle = "#4a1f5c";
      ctx.fillRect(cw / 2 - 1, 64, 2, ch - 90);
      if (!query) {
        ctx.fillStyle = "#e9d5f5";
        ctx.font = font(30);
        wrap(ctx, "Press E to run a query. Only the fields you ask for light up.", 40, 140, cw - 80, 42);
        return;
      }
      ctx.font = `24px ui-monospace, Menlo, Consolas, monospace`;
      ctx.fillStyle = accent;
      query.query.split("\n").forEach((line, i) => ctx.fillText(line, 24, 100 + i * 34));
      ctx.fillStyle = "#e9d5f5";
      ctx.font = `19px ui-monospace, Menlo, Consolas, monospace`;
      JSON.stringify(query.result, null, 1)
        .split("\n")
        .forEach((line, i) => ctx.fillText(line.replace(/^ +/, (m) => "  ".repeat(m.length)), cw / 2 + 16, 100 + i * 27));
    },
    q,
  );

  const brass = flat("#c9a227", 0.28, 0.9);
  const on = (i: number) => !!query?.nodes.includes(i);
  const edgeOn = (i: number) => !!query?.edges.includes(i);
  const dimNode = flat("#5b2a6e", 0.4, 0.2, "#3a0c30", 0.6);
  const litNode = flat(accent, 0.3, 0, accent, 2.4);
  const cx = Math.min(3, w / 2 - 0.8);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.45, 0.6, 0.45]} position={[0, 0.6, TZ]} />
        <CuboidCollider args={[0.35, 0.6, 0.25]} position={[cx, 0.6, TZ + 0.3]} />
      </RigidBody>
      {/* The constellation */}
      <points geometry={sky}>
        <pointsMaterial color="#fff0fa" size={0.05} sizeAttenuation transparent opacity={0.8} />
      </points>
      {edges.map((e, i) => (
        <mesh key={i} position={e.mid} quaternion={e.quat} material={edgeOn(i) ? litNode : flat("#4a1f5c", 0.5, 0, "#2e0a3a", 0.5)}>
          <cylinderGeometry args={[edgeOn(i) ? 0.022 : 0.01, edgeOn(i) ? 0.022 : 0.01, e.len, 6]} />
        </mesh>
      ))}
      {NODES.map((n, i) => (
        <group key={n.name} position={nodes[i]}>
          <mesh material={on(i) ? litNode : dimNode}>
            <sphereGeometry args={[on(i) ? 0.2 : 0.15, 20, 14]} />
          </mesh>
          {on(i) && (
            <mesh material={flat("#ffd1ee", 0.3, 0, "#ff49b8", 1.5)}>
              <torusGeometry args={[0.3, 0.012, 6, 32]} />
            </mesh>
          )}
          <Text position={[0, -0.36, 0]} fontSize={0.18} color={on(i) ? "#ffffff" : "#b9a3c4"} anchorX="center" anchorY="middle" outlineWidth={0.008} outlineColor={palette.ink}>
            {n.name}
          </Text>
        </group>
      ))}
      {/* The telescope on its pier */}
      <group position={[0, 0, TZ]}>
        <mesh position={[0, 0.06, 0]} material={flat(palette.ink, 0.4, 0.4)} receiveShadow>
          <cylinderGeometry args={[0.55, 0.62, 0.12, 32]} />
        </mesh>
        <mesh position={[0, 0.5, 0]} material={flat("#2a1838", 0.4, 0.5)} castShadow>
          <cylinderGeometry args={[0.2, 0.3, 0.8, 24]} />
        </mesh>
        <mesh position={[0, 0.92, 0]} material={brass}>
          <cylinderGeometry args={[0.3, 0.3, 0.06, 32]} />
        </mesh>
        <group ref={yaw} position={[0, 0.95, 0]} rotation-y={Math.PI}>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.2, 0.25, 0]} material={brass} castShadow>
              <boxGeometry args={[0.05, 0.5, 0.14]} />
            </mesh>
          ))}
          <group ref={tube} position={[0, 0.5, 0]} rotation-x={-0.7}>
            <mesh position={[0, 0, 0.3]} rotation-x={Math.PI / 2} material={brass} castShadow>
              <cylinderGeometry args={[0.13, 0.1, 1.6, 28]} />
            </mesh>
            <mesh position={[0, 0, 1.12]} rotation-x={Math.PI / 2} material={flat("#2a1838", 0.4, 0.4)}>
              <cylinderGeometry args={[0.16, 0.14, 0.12, 28]} />
            </mesh>
            {[-0.2, 0.5].map((z) => (
              <mesh key={z} position={[0, 0, z]} rotation-x={Math.PI / 2} material={flat("#7a5a12", 0.3, 0.9)}>
                <torusGeometry args={[0.122, 0.014, 8, 28]} />
              </mesh>
            ))}
            <mesh position={[0, 0, -0.55]} rotation-x={Math.PI / 2} material={flat("#2a1838", 0.4, 0.5)}>
              <cylinderGeometry args={[0.035, 0.04, 0.18, 12]} />
            </mesh>
            <mesh position={[0, 0.16, 0.1]} rotation-x={Math.PI / 2} material={brass}>
              <cylinderGeometry args={[0.03, 0.03, 0.4, 12]} />
            </mesh>
            <mesh position={[0, 0, 1.18]} rotation-x={Math.PI / 2} material={flat("#ffd1ee", 0.1, 0.2, accent, query ? 1.2 : 0.3)}>
              <circleGeometry args={[0.13, 24]} />
            </mesh>
          </group>
        </group>
      </group>
      {/* The query console */}
      <group position={[cx, 0, TZ + 0.3]} rotation-y={-0.45}>
        <mesh position={[0, 0.55, 0]} material={flat("#2a1838", 0.4, 0.5)} castShadow>
          <boxGeometry args={[0.5, 1.1, 0.35]} />
        </mesh>
        <group position={[0, 1.55, 0]} rotation-x={-0.15}>
          <Panel position={[0, 0, 0]} width={1.4} height={1} map={texture} frame="#2a0b38" />
        </group>
        <mesh position={[0, 1.02, 0.02]} material={brass}>
          <boxGeometry args={[0.08, 0.1, 0.08]} />
        </mesh>
      </group>
    </group>
  );
}

export const TOOLS: Record<string, SigComponent> = {
  "docker-crane": DockerCrane,
  "docker-compose": DockerCompose,
  "git-tracks": GitTracks,
  "git-stash": GitStash,
  "gh-pipeline": GhPipeline,
  "gh-review": GhReview,
  "gh-stars": GhStars,
  "jira-board": JiraBoard,
  "jira-standup": JiraStandup,
  "jira-retro": JiraRetro,
  "rest-counters": RestCounters,
  "rest-mailboxes": RestMailboxes,
  "rest-stamps": RestStamps,
  "graphql-stars": GraphqlStars,
};
