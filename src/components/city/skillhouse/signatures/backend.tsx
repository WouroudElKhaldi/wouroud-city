"use client";

import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { Suspense, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useCityStore } from "@/state/useCityStore";
import { NPC_PEOPLE } from "@/world/outfits";
import { sfx } from "@/world/sfx";
import { Batch } from "../../Furniture";
import { Person } from "../../Person";
import { box, font, Panel, useCanvas } from "../../roomKit";
import { Seats } from "../../StreetDetails";
import { Text } from "../../Text3D";
import { useProximity } from "../../useProximity";
import { flat } from "../finishKit";
import { burstAt, clicked, pointer, seatAt, useWorldPoint } from "../modules";
import { useHouse } from "../SkillHouse";
import type { SigComponent, SigProps } from "./types";

/** Signature pieces for the backend frameworks: Node.js, Express, NestJS, Laravel. */

const toast = (text: string, title?: string) => useCityStore.getState().toast(text, title);
const now = () => performance.now() / 1000;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => v * v * (3 - 2 * v);

const STEEL = "#8d969e";
const DARK_STEEL = "#2f3439";
const WOOD = "#8a5a34";
const IRON = "#1c1c1c";

// ---------------------------------------------------------------------------
// Node.js · The Event Loop Turbine (hero)
// ---------------------------------------------------------------------------

/**
 * A big upright Node hexagon on a steel base with a turbine wheel spinning inside it and glass
 * request pipes feeding it from both sides. E throws 1,000 requests at it: the turbine spins up,
 * glowing requests stream along the pipes and the gauge shows req/s climbing, all on one thread.
 */
const NODE_GREEN = "#68a063";
const TURBINE_RUN = 5;
const PIPE_BALLS = 6;

function NodeTurbine({ w, d, toHouse }: SigProps) {
  const { palette } = useHouse();
  const [served, setServed] = useState(0);
  const [rate, setRate] = useState(0);
  const [running, setRunning] = useState(false);
  const startAt = useRef(-1);
  const lastTick = useRef({ t: 0, served: 0 });
  const speed = useRef(0.4);
  const flow = useRef(0);
  const wheel = useRef<THREE.Group>(null);
  const needle = useRef<THREE.Group>(null);
  const balls = useRef<(THREE.Mesh | null)[]>([]);
  const glass = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#d8f0d4", roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.3, depthWrite: false }),
    [],
  );

  const R = 1.6;
  const cy = 2.25;
  const inner = R * Math.cos(Math.PI / 6) - 0.05;
  const reach = Math.max(inner + 1, Math.min(w / 2 - 0.3, 4.2));
  const pipeLen = reach - inner;
  const pipeMid = (reach + inner) / 2;

  const run = () => {
    if (startAt.current >= 0) return;
    startAt.current = now();
    lastTick.current = { t: startAt.current, served: 0 };
    setServed(0);
    setRunning(true);
    sfx.click();
  };
  const where = useWorldPoint(toHouse, 0, Math.min(d / 2 - 0.4, 2.4));
  useProximity({ id: "node-turbine", label: running ? "Serving requests…" : "Handle 1,000 requests", radius: 2.4, where, run });

  useFrame((_, delta) => {
    const t = now();
    const spinning = startAt.current >= 0;
    const k = spinning ? clamp01((t - startAt.current) / TURBINE_RUN) : 0;
    const target = spinning ? (k < 0.85 ? 0.4 + 13.6 * smooth(clamp01(k / 0.4)) : 3) : 0.4;
    speed.current += (target - speed.current) * Math.min(1, delta * 2.5);
    if (wheel.current) wheel.current.rotation.z -= delta * speed.current;
    if (needle.current) needle.current.rotation.z = 2.2 - 4.4 * clamp01((speed.current - 0.4) / 13.6);
    flow.current += delta * speed.current * 0.09;
    balls.current.forEach((ball, i) => {
      if (!ball) return;
      const side = i % 2 === 0 ? -1 : 1;
      const u = (flow.current + Math.floor(i / 2) / PIPE_BALLS) % 1;
      ball.visible = spinning && k < 0.88;
      ball.position.x = side * (reach - u * pipeLen);
    });
    if (!spinning) return;
    if (t - lastTick.current.t >= 0.2) {
      const count = Math.round(1000 * smooth(clamp01(k / 0.85)));
      setRate(Math.round((count - lastTick.current.served) / (t - lastTick.current.t)));
      setServed(count);
      lastTick.current = { t, served: count };
    }
    if (k >= 1) {
      startAt.current = -1;
      setRunning(false);
      setRate(0);
      setServed(1000);
      sfx.coin();
      burstAt(toHouse, 0, cy, 0.3, [NODE_GREEN, "#d9ffc9", "#ffffff"], 22);
      toast(
        "1,000 requests, one JavaScript thread. Node never waits on I/O: file and network work goes to the OS through libuv, and the event loop runs each callback when its result is ready.",
        "⚙️ Non-blocking I/O",
      );
    }
  });

  const green = flat(NODE_GREEN, 0.35, 0.3);
  const glow = flat("#b6ff9a", 0.3, 0, "#9dff7a", 2.2);
  const steel = flat(STEEL, 0.35, 0.85);
  const dark = flat(DARK_STEEL, 0.45, 0.7);
  return (
    <group onClick={(e) => clicked(e) && run()} {...pointer}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.95, 0.6, 0.85]} position={[0, 0.6, 0]} />
        <CuboidCollider args={[0.12, 1.1, 0.12]} position={[-pipeMid, 1.1, 0]} />
        <CuboidCollider args={[0.12, 1.1, 0.12]} position={[pipeMid, 1.1, 0]} />
      </RigidBody>
      {/* Steel base with a riveted top rim */}
      <mesh position={[0, 0.25, 0]} material={dark} castShadow receiveShadow>
        <boxGeometry args={[3.8, 0.5, 1.6]} />
      </mesh>
      <mesh position={[0, 0.52, 0]} material={steel} receiveShadow>
        <boxGeometry args={[3.9, 0.05, 1.7]} />
      </mesh>
      {[-1.7, 1.7].map((x) => (
        <mesh key={x} position={[x, 0.25, 0.81]} material={flat(NODE_GREEN, 0.4, 0.2)}>
          <boxGeometry args={[0.3, 0.3, 0.02]} />
        </mesh>
      ))}
      {/* Supports from the base to the hexagon's lower corners */}
      <mesh position={[0, (cy - R + 0.5) / 2, 0]} material={dark}>
        <boxGeometry args={[0.5, cy - R - 0.5, 0.4]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * R * Math.cos(Math.PI / 6), (cy - R / 2 + 0.55) / 2, 0]} material={dark} castShadow>
          <boxGeometry args={[0.16, cy - R / 2 - 0.55, 0.3]} />
        </mesh>
      ))}
      {/* The hexagon frame, a dark back plate and the turbine wheel */}
      <group position={[0, cy, 0]}>
        <mesh rotation-z={Math.PI / 2} material={green} castShadow>
          <torusGeometry args={[R, 0.16, 4, 6]} />
        </mesh>
        <mesh position={[0, 0, -0.22]} rotation-x={Math.PI / 2} material={flat(palette.ink, 0.6, 0.3)}>
          <cylinderGeometry args={[R - 0.05, R - 0.05, 0.08, 6]} />
        </mesh>
        <group ref={wheel} position={[0, 0, 0.02]}>
          <mesh rotation-x={Math.PI / 2} material={steel} castShadow>
            <cylinderGeometry args={[0.26, 0.26, 0.42, 24]} />
          </mesh>
          <mesh position={[0, 0, 0.22]} rotation-x={Math.PI / 2} material={glow}>
            <cylinderGeometry args={[0.12, 0.12, 0.03, 20]} />
          </mesh>
          {Array.from({ length: 9 }, (_, i) => {
            const a = (i / 9) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 0.72, Math.sin(a) * 0.72, 0]} rotation={[0, 0.55, a - Math.PI / 2]} material={steel} castShadow>
                <boxGeometry args={[0.24, 0.95, 0.03]} />
              </mesh>
            );
          })}
          <mesh material={dark}>
            <torusGeometry args={[1.22, 0.05, 8, 48]} />
          </mesh>
        </group>
      </group>
      <Text position={[0, cy + R + 0.32, 0]} fontSize={0.26} color={NODE_GREEN} anchorX="center" anchorY="middle" outlineWidth={0.008} outlineColor={palette.ink}>
        EVENT LOOP
      </Text>
      {/* Request pipes from both sides, glass so the requests show */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * pipeMid, cy, 0]} rotation-z={Math.PI / 2} material={glass}>
            <cylinderGeometry args={[0.17, 0.17, pipeLen, 20, 1, true]} />
          </mesh>
          {[inner + 0.05, reach].map((x) => (
            <mesh key={x} position={[s * x, cy, 0]} rotation-z={Math.PI / 2} material={steel}>
              <cylinderGeometry args={[0.22, 0.22, 0.08, 20]} />
            </mesh>
          ))}
          <mesh position={[s * pipeMid, cy / 2, 0]} material={dark} castShadow>
            <boxGeometry args={[0.12, cy, 0.12]} />
          </mesh>
          <mesh position={[s * pipeMid, 0.03, 0]} material={steel}>
            <boxGeometry args={[0.5, 0.06, 0.5]} />
          </mesh>
          <mesh position={[s * pipeMid, cy - 0.21, 0]} material={steel}>
            <boxGeometry args={[0.46, 0.05, 0.1]} />
          </mesh>
          <group position={[s * pipeMid, 1.35, 0.08]}>
            <mesh material={flat(palette.ink, 0.5, 0.2)}>
              <boxGeometry args={[0.95, 0.26, 0.03]} />
            </mesh>
            <Text position={[0, 0, 0.02]} fontSize={0.12} color={NODE_GREEN} anchorX="center" anchorY="middle">
              {s < 0 ? "requests →" : "← requests"}
            </Text>
          </group>
        </group>
      ))}
      {Array.from({ length: PIPE_BALLS * 2 }, (_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            balls.current[i] = m;
          }}
          position={[0, cy, 0]}
          material={glow}
          visible={false}
        >
          <sphereGeometry args={[0.1, 12, 10]} />
        </mesh>
      ))}
      {/* The gauge on the base: needle and req/s */}
      <group position={[0, 0.55, 0.62]}>
        <mesh position={[0, 0.3, 0]} material={dark}>
          <boxGeometry args={[0.9, 0.6, 0.12]} />
        </mesh>
        <mesh position={[0, 0.36, 0.07]} rotation-x={Math.PI / 2} material={flat(palette.paper, 0.4)}>
          <cylinderGeometry args={[0.24, 0.24, 0.02, 32]} />
        </mesh>
        <mesh position={[0, 0.36, 0.075]} material={steel}>
          <torusGeometry args={[0.25, 0.02, 6, 32]} />
        </mesh>
        <group ref={needle} position={[0, 0.36, 0.09]} rotation-z={2.2}>
          <mesh position={[0, 0.1, 0]} material={flat("#d23c3c", 0.4)}>
            <boxGeometry args={[0.02, 0.2, 0.01]} />
          </mesh>
        </group>
        <Text position={[0, 0.07, 0.07]} fontSize={0.085} color={NODE_GREEN} anchorX="center" anchorY="middle">
          {`${rate} req/s · ${served.toLocaleString("en-US")} served`}
        </Text>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Node.js · npm Warehouse (room)
// ---------------------------------------------------------------------------

/**
 * A warehouse office: metal shelving stacked with package boxes and, in the corner, a comically
 * huge black node_modules crate. E runs npm install: boxes drop onto the cart and node_modules
 * grows a size bigger every time (up to a point).
 */
const PACKAGES = ["react", "express", "zod", "lodash", "dayjs", "axios", "vite", "chalk", "prisma"];
const INSTALLS = [
  { cmd: "npm install", out: "added 1,337 packages in 4s" },
  { cmd: "npm install zod", out: "added 1 package, and audited 1,338 packages in 2s" },
  { cmd: "npm install -D vitest", out: "added 64 packages, and audited 1,402 packages in 5s" },
  { cmd: "npm install express", out: "added 65 packages, and audited 1,467 packages in 3s" },
];
const CART_BOXES = 3;

function NodeNpm({ w, d, toHouse, label }: SigProps) {
  const { palette } = useHouse();
  const [installs, setInstalls] = useState(0);
  const dropAt = useRef(-10);
  const crate = useRef<THREE.Group>(null);
  const drops = useRef<(THREE.Mesh | null)[]>([]);

  const scale = Math.min(1 + installs * 0.16, 1.64);
  const base = 1.2;
  const sx0 = -w / 2 + 0.25 + base * 1.64 + 0.15;
  const sx1 = w / 2 - 0.25;
  const sw = Math.max(1.5, sx1 - sx0);
  const sxc = (sx0 + sx1) / 2;
  const sz = -d / 2 + 0.4;
  const cart: [number, number] = [Math.min(w / 4, w / 2 - 0.9), -d / 2 + 2.3];
  const cartTop = 0.36;

  const install = () => {
    const i = installs % INSTALLS.length;
    setInstalls((n) => n + 1);
    dropAt.current = now();
    sfx.rustle();
    toast(
      `${INSTALLS[i].cmd} → ${INSTALLS[i].out}. Every dependency (and theirs) lands in node_modules; package-lock.json pins the exact versions so the next install gets the same tree.`,
      "📦 npm",
    );
  };
  const where = useWorldPoint(toHouse, cart[0] - 0.9, cart[1] + 0.4);
  useProximity({ id: "node-npm-install", label: "npm install", radius: 2, where, run: install });

  useFrame((_, delta) => {
    const t = now();
    const g = crate.current;
    if (g) {
      const s = g.scale.x + (scale - g.scale.x) * Math.min(1, delta * 4);
      g.scale.setScalar(s);
      g.position.set(-w / 2 + 0.2 + (base / 2) * s, 0, -d / 2 + 0.2 + (base / 2) * s);
    }
    drops.current.forEach((m, i) => {
      if (!m) return;
      const dt = t - dropAt.current - i * 0.3;
      m.visible = installs > 0 && dt > 0;
      m.position.y = Math.max(cartTop + 0.14, 2.6 - 4.9 * Math.max(0, dt) ** 2);
      if (dt > 0 && dt < 0.75 && m.position.y <= cartTop + 0.141 && m.userData.landed !== dropAt.current) {
        m.userData.landed = dropAt.current;
        sfx.pop();
      }
    });
  });

  const cardboard = ["#c49a6c", "#b98d5e", "#cfa778"];
  const levels = [0.12, 0.85, 1.58];
  const cols = 3;
  const bw = sw / cols - 0.14;
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[sw / 2 + 0.05, 1.15, 0.3]} position={[sxc, 1.15, sz]} />
        <CuboidCollider args={[(base / 2) * scale, (base / 2) * scale, (base / 2) * scale]} position={[-w / 2 + 0.2 + (base / 2) * scale, (base / 2) * scale, -d / 2 + 0.2 + (base / 2) * scale]} />
        <CuboidCollider args={[0.55, 0.3, 0.35]} position={[cart[0], 0.3, cart[1]]} />
      </RigidBody>
      {/* Metal shelving and its boxes (static, batched) */}
      <Batch>
        {[-1, 1].flatMap((s) =>
          [-0.24, 0.24].map((z) => (
            <mesh key={`${s}${z}`} position={[sxc + s * (sw / 2), 1.15, sz + z]} material={flat("#4a6b7a", 0.5, 0.6)} castShadow>
              <boxGeometry args={[0.06, 2.3, 0.06]} />
            </mesh>
          )),
        )}
        {[...levels, 2.3].map((y) => (
          <mesh key={y} position={[sxc, y, sz]} material={flat("#9aa3a8", 0.45, 0.6)} receiveShadow>
            <boxGeometry args={[sw + 0.06, 0.04, 0.56]} />
          </mesh>
        ))}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[sxc + s * (sw / 2 - 0.02), 1.15, sz + 0.27]} rotation-z={s * Math.atan2(sw, 2.2)} material={flat("#4a6b7a", 0.5, 0.6)}>
            <boxGeometry args={[0.015, Math.hypot(sw, 2.2) * 0.5, 0.015]} />
          </mesh>
        ))}
        {PACKAGES.map((_, i) => {
          const lv = Math.floor(i / cols);
          const h = 0.42 + ((i * 7) % 3) * 0.06;
          return (
            <group key={i} position={[sxc - sw / 2 + (sw / cols) * ((i % cols) + 0.5), levels[lv] + 0.02 + h / 2, sz]}>
              <mesh material={flat(cardboard[i % 3], 0.85)} castShadow>
                <boxGeometry args={[bw, h, 0.42]} />
              </mesh>
              <mesh position={[0, h / 2 + 0.002, 0]} material={flat("#d9c39a", 0.5)}>
                <boxGeometry args={[0.08, 0.004, 0.43]} />
              </mesh>
            </group>
          );
        })}
      </Batch>
      {PACKAGES.map((name, i) => {
        const lv = Math.floor(i / cols);
        const h = 0.42 + ((i * 7) % 3) * 0.06;
        return (
          <Text key={name} position={[sxc - sw / 2 + (sw / cols) * ((i % cols) + 0.5), levels[lv] + 0.02 + h / 2, sz + 0.215]} fontSize={Math.min(0.1, bw / 6)} color="#3b2a14" anchorX="center" anchorY="middle">
            {name}
          </Text>
        );
      })}
      <Text position={[sxc, 2.65, -d / 2 + 0.13]} fontSize={0.24} color="#cb3837" anchorX="center" anchorY="middle">
        {label}
      </Text>
      {/* node_modules: the heaviest object in the universe */}
      <group ref={crate} position={[-w / 2 + 0.2 + base / 2, 0, -d / 2 + 0.2 + base / 2]} onClick={(e) => clicked(e) && install()} {...pointer}>
        <mesh position={[0, base / 2, 0]} material={flat("#151515", 0.55, 0.1)} castShadow receiveShadow>
          <boxGeometry args={[base, base, base]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[0, base / 2 + s * 0.4, base / 2 + 0.005]} material={flat("#2a2a2a", 0.4, 0.3)}>
            <boxGeometry args={[base + 0.02, 0.05, 0.01]} />
          </mesh>
        ))}
        <Text position={[0, base / 2, base / 2 + 0.012]} fontSize={0.15} color="#ffffff" anchorX="center" anchorY="middle">
          node_modules
        </Text>
      </group>
      {/* The cart: boxes from npm install land here */}
      <group position={[cart[0], 0, cart[1]]} onClick={(e) => clicked(e) && install()} {...pointer}>
        <mesh position={[0, 0.32, 0]} material={flat("#cb3837", 0.5, 0.3)} castShadow>
          <boxGeometry args={[1.0, 0.06, 0.6]} />
        </mesh>
        {[-0.42, 0.42].flatMap((x) =>
          [-0.24, 0.24].map((z) => (
            <mesh key={`${x}${z}`} position={[x, 0.08, z]} rotation-x={Math.PI / 2} material={flat(IRON, 0.6)}>
              <cylinderGeometry args={[0.08, 0.08, 0.05, 14]} />
            </mesh>
          )),
        )}
        {[-0.42, 0.42].flatMap((x) =>
          [-0.24, 0.24].map((z) => (
            <mesh key={`p${x}${z}`} position={[x, 0.22, z]} material={flat(DARK_STEEL, 0.4, 0.7)}>
              <boxGeometry args={[0.03, 0.16, 0.03]} />
            </mesh>
          )),
        )}
        <mesh position={[-0.5, 0.7, 0]} material={flat(DARK_STEEL, 0.4, 0.7)}>
          <boxGeometry args={[0.04, 0.8, 0.5]} />
        </mesh>
        {Array.from({ length: CART_BOXES }, (_, i) => (
          <mesh
            key={i}
            ref={(m) => {
              drops.current[i] = m;
            }}
            position={[-0.22 + i * 0.26, 2.6, (i % 2) * 0.08 - 0.04]}
            rotation-y={i * 0.3}
            material={flat(cardboard[i], 0.85)}
            visible={false}
            castShadow
          >
            <boxGeometry args={[0.24, 0.28, 0.26]} />
          </mesh>
        ))}
      </group>
      <Text position={[cart[0], 1.25, cart[1]]} fontSize={0.1} color={palette.paper} anchorX="center" outlineWidth={0.006} outlineColor={palette.ink}>
        {installs ? INSTALLS[(installs - 1) % INSTALLS.length].out : "$ npm install"}
      </Text>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Express · Middleware Line (hero)
// ---------------------------------------------------------------------------

/**
 * A short black-and-white tiled platform with rails, three middleware gates (logger,
 * express.json(), auth) and the route sign GET /orders at the end. E sends a request: the little
 * train car passes each gate as it calls next() and reaches the route (200 OK). Every 4th request
 * has no token: auth answers 401 itself and the car stops at the gate.
 */
const GATES = ["logger", "express.json()", "auth"];
type GateState = "idle" | "ok" | "fail";

function ExpressMiddleware({ w, d, toHouse }: SigProps) {
  const { palette } = useHouse();
  const [gates, setGates] = useState<GateState[]>(["idle", "idle", "idle"]);
  const [status, setStatus] = useState<"idle" | "moving" | "200" | "401">("idle");
  const pw = Math.min(w - 0.4, 8.4);
  const pd = Math.min(d - 1, 2.6);
  const startX = -pw / 2 + 0.7;
  const gatesRef = useRef(gates);
  const sim = useRef({ active: false, seg: 0, x: startX, waitUntil: 0, denied: false, sent: 0 });
  const car = useRef<THREE.Group>(null);
  const arms = useRef<(THREE.Group | null)[]>([]);
  const gateX = GATES.map((_, i) => -pw / 2 + pw * (0.3 + 0.18 * i));
  const routeX = -pw / 2 + pw * 0.87;
  const stops = [...gateX.map((x) => x - 0.8), routeX - 0.75];

  const tiles = useCanvas(
    1024,
    Math.round((1024 * pd) / pw),
    (ctx, cw, ch) => {
      const cols = Math.round(pw / 0.4);
      const rows = Math.round(pd / 0.4);
      for (let c = 0; c < cols; c++)
        for (let r = 0; r < rows; r++) {
          ctx.fillStyle = (c + r) % 2 ? "#141414" : "#f2f2ee";
          ctx.fillRect((c * cw) / cols, (r * ch) / rows, cw / cols + 1, ch / rows + 1);
        }
      ctx.fillStyle = "#e8c547";
      ctx.fillRect(0, ch - 14, cw, 14);
    },
    `${pw}x${pd}`,
  );

  const setGateStates = (next: GateState[]) => {
    gatesRef.current = next;
    setGates(next);
  };
  const send = () => {
    const s = sim.current;
    if (s.active) return;
    s.sent++;
    Object.assign(s, { active: true, seg: 0, x: startX, waitUntil: now() + 0.2, denied: s.sent % 4 === 0 });
    setGateStates(["idle", "idle", "idle"]);
    setStatus("moving");
    sfx.click();
  };
  const where = useWorldPoint(toHouse, 0, Math.min(d / 2 - 0.4, pd / 2 + 1));
  useProximity({ id: "express-middleware", label: "Send a request", radius: 2.6, where, run: send });

  useFrame((_, delta) => {
    const t = now();
    const s = sim.current;
    arms.current.forEach((arm, i) => {
      if (!arm) return;
      const target = gatesRef.current[i] === "ok" ? 1.4 : 0;
      arm.rotation.x += (target - arm.rotation.x) * Math.min(1, delta * 6);
    });
    if (car.current) car.current.position.x = s.x;
    if (!s.active || t < s.waitUntil) return;
    const target = stops[s.seg];
    s.x = Math.min(target, s.x + delta * 3);
    if (s.x < target) return;
    if (s.seg < GATES.length) {
      const next = [...gatesRef.current];
      if (s.denied && s.seg === GATES.length - 1) {
        next[s.seg] = "fail";
        setGateStates(next);
        setStatus("401");
        s.active = false;
        sfx.clunk();
        toast(
          "No token, so auth ended the request itself with res.status(401).send() instead of calling next(). Once a middleware responds, nothing after it runs, not even the route.",
          "🚫 401 Unauthorized",
        );
        return;
      }
      next[s.seg] = "ok";
      setGateStates(next);
      sfx.pop();
      s.waitUntil = t + 0.45;
      s.seg++;
    } else {
      s.active = false;
      setStatus("200");
      sfx.coin();
      burstAt(toHouse, routeX, 1.4, 0, ["#ffffff", "#22c55e", "#111111"], 18);
      toast("logger, express.json() and auth each did their part and called next(), so Express handed the request on until the GET /orders handler answered res.json(orders): 200 OK.", "🚉 Express");
    }
  });

  const black = flat("#151515", 0.4, 0.3);
  const white = flat("#f4f4ef", 0.4);
  const steel = flat(STEEL, 0.3, 0.9);
  const lamp = (g: GateState) => (g === "ok" ? flat("#22c55e", 0.3, 0, "#22c55e", 2) : g === "fail" ? flat("#ef4444", 0.3, 0, "#ef4444", 2.2) : flat("#5a5a5a", 0.4, 0.2));
  const sleepers = Math.floor(pw / 0.55);
  return (
    <group onClick={(e) => clicked(e) && send()} {...pointer}>
      <RigidBody type="fixed" colliders={false}>
        {gateX.flatMap((x) => [-0.85, 0.85].map((z) => <CuboidCollider key={`${x}${z}`} args={[0.1, 1.2, 0.1]} position={[x, 1.2, z]} />))}
        <CuboidCollider args={[0.1, 1.4, 0.1]} position={[routeX + 0.3, 1.4, -0.95]} />
      </RigidBody>
      {/* The platform: tiled top, black skirt */}
      <mesh position={[0, 0.06, 0]} material={black} receiveShadow>
        <boxGeometry args={[pw, 0.12, pd]} />
      </mesh>
      <mesh position={[0, 0.121, 0]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[pw - 0.04, pd - 0.04]} />
        <meshStandardMaterial map={tiles.texture} roughness={0.3} metalness={0.05} />
      </mesh>
      {/* Rails and sleepers */}
      <Batch>
        {Array.from({ length: sleepers }, (_, i) => (
          <mesh key={i} position={[-pw / 2 + 0.3 + i * 0.55, 0.14, 0]} material={flat("#3b2f25", 0.8)}>
            <boxGeometry args={[0.14, 0.04, 0.9]} />
          </mesh>
        ))}
        {[-0.3, 0.3].map((z) => (
          <mesh key={z} position={[0, 0.18, z]} material={steel}>
            <boxGeometry args={[pw - 0.2, 0.05, 0.05]} />
          </mesh>
        ))}
      </Batch>
      {/* The middleware gates */}
      {GATES.map((name, i) => (
        <group key={name} position={[gateX[i], 0, 0]}>
          {[-0.85, 0.85].map((z) => (
            <mesh key={z} position={[0, 1.2, z]} material={black} castShadow>
              <boxGeometry args={[0.18, 2.4, 0.18]} />
            </mesh>
          ))}
          <mesh position={[0, 2.45, 0]} material={black} castShadow>
            <boxGeometry args={[0.24, 0.22, 1.9]} />
          </mesh>
          <mesh position={[0, 2.45, 0]} material={white}>
            <boxGeometry args={[0.26, 0.05, 1.92]} />
          </mesh>
          {/* The barrier arm: it lifts when this middleware calls next() */}
          <group
            ref={(g) => {
              arms.current[i] = g;
            }}
            position={[0, 0.8, 0.76]}
          >
            {[0, 1, 2, 3, 4].map((k) => (
              <mesh key={k} position={[0, 0, -0.15 - k * 0.3]} material={gates[i] === "fail" ? flat("#ef4444", 0.4, 0, "#ef4444", 0.6) : k % 2 ? white : black}>
                <boxGeometry args={[0.06, 0.08, 0.3]} />
              </mesh>
            ))}
          </group>
          <group position={[0, 2.95, 0.85]}>
            <mesh material={white} castShadow>
              <boxGeometry args={[1.25, 0.42, 0.06]} />
            </mesh>
            <Text position={[0, 0, 0.035]} fontSize={0.15} color="#111111" anchorX="center" anchorY="middle">
              {name}
            </Text>
            <mesh position={[0, 0.3, 0]} material={lamp(gates[i])}>
              <sphereGeometry args={[0.09, 14, 10]} />
            </mesh>
          </group>
          <Text position={[0, 0.125, 1.0]} rotation-x={-Math.PI / 2} fontSize={0.09} color={gates[i] === "ok" ? "#16a34a" : "#888888"} anchorX="center" anchorY="middle">
            {gates[i] === "ok" ? "next() ✓" : gates[i] === "fail" ? "res.status(401)" : "app.use()"}
          </Text>
        </group>
      ))}
      {/* The route sign */}
      <group position={[routeX + 0.3, 0, -0.95]}>
        <mesh position={[0, 1.4, 0]} material={black} castShadow>
          <boxGeometry args={[0.14, 2.8, 0.14]} />
        </mesh>
        <group position={[0, 2.9, 0.1]}>
          <mesh material={black} castShadow>
            <boxGeometry args={[1.7, 0.95, 0.08]} />
          </mesh>
          <mesh position={[0, 0, 0.041]} material={white}>
            <boxGeometry args={[1.6, 0.85, 0.005]} />
          </mesh>
          <Text position={[0, 0.17, 0.05]} fontSize={0.2} color="#111111" anchorX="center" anchorY="middle">
            GET /orders
          </Text>
          <Text position={[0, -0.2, 0.05]} fontSize={0.15} color={status === "200" ? "#16a34a" : status === "401" ? "#dc2626" : "#777777"} anchorX="center" anchorY="middle">
            {status === "200" ? "200 OK" : status === "401" ? "401 Unauthorized" : status === "moving" ? "awaiting request…" : "route handler"}
          </Text>
        </group>
      </group>
      {/* The request: a little train car */}
      <group ref={car} position={[startX, 0, 0]}>
        <mesh position={[0, 0.6, 0]} material={white} castShadow>
          <boxGeometry args={[1.0, 0.7, 0.72]} />
        </mesh>
        <mesh position={[0, 0.98, 0]} material={black}>
          <boxGeometry args={[1.04, 0.06, 0.76]} />
        </mesh>
        <mesh position={[0, 0.45, 0]} material={black}>
          <boxGeometry args={[1.02, 0.08, 0.74]} />
        </mesh>
        {[-0.25, 0.25].map((x) => (
          <mesh key={x} position={[x, 0.72, 0.362]} material={flat("#1e2a33", 0.1, 0.5)}>
            <boxGeometry args={[0.32, 0.22, 0.01]} />
          </mesh>
        ))}
        {[-0.32, 0.32].flatMap((x) =>
          [-0.3, 0.3].map((z) => (
            <mesh key={`${x}${z}`} position={[x, 0.29, z]} rotation-x={Math.PI / 2} material={steel}>
              <cylinderGeometry args={[0.1, 0.1, 0.05, 16]} />
            </mesh>
          )),
        )}
        <Text position={[0, 0.52, 0.37]} fontSize={0.08} color="#111111" anchorX="center" anchorY="middle">
          {status === "401" ? "req (no token)" : "req"}
        </Text>
      </group>
      <Text position={[-pw / 2 + 0.3, 0.125, pd / 2 - 0.25]} rotation-x={-Math.PI / 2} fontSize={0.11} color={palette.ink} anchorX="left" anchorY="middle" outlineWidth={0.005} outlineColor="#ffffff">
        {"app.use(logger) · app.use(express.json()) · app.get('/orders', auth, list)"}
      </Text>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Express · Platform GET / (room)
// ---------------------------------------------------------------------------

/**
 * A station platform: a split-flap departures board listing routes with their times and
 * statuses, a station clock and benches to wait on. E refreshes the departures: the flaps clatter
 * and every route settles on its new status (200, 201, 204 or 404).
 */
const DEPARTURES: { route: string; statuses: string[] }[] = [
  { route: "GET /health", statuses: ["200 OK"] },
  { route: "POST /login", statuses: ["200 OK", "201 CREATED"] },
  { route: "GET /orders/:id", statuses: ["200 OK", "404 NOT FOUND"] },
  { route: "DELETE /cart/:id", statuses: ["204 NO CONTENT", "404 NOT FOUND"] },
];
const FLAP_FRAMES = 7;
const FLAP_CHARS = "ABCDEFGHIJKLMNOPRSTUVWXYZ0123456789/:";

function flapText(text: string, frame: number, salt: number) {
  if (!frame) return text;
  return [...text].map((c, i) => (c === " " || (i * 3 + salt) % FLAP_FRAMES < frame - 1 ? c : FLAP_CHARS[(i * 7 + frame * 13 + salt * 5) % FLAP_CHARS.length])).join("");
}

function PlatformBench({ position, length }: { position: [number, number, number]; length: number }) {
  const wood = flat(WOOD, 0.6);
  const iron = flat(IRON, 0.45, 0.6);
  return (
    <group position={position} rotation-y={Math.PI}>
      {[-0.17, -0.05, 0.07].map((z) => (
        <mesh key={z} position={[0, 0.465 - z * 0.15, z - 0.02]} material={wood} castShadow receiveShadow>
          <boxGeometry args={[length, 0.035, 0.11]} />
        </mesh>
      ))}
      {[0.65, 0.82].map((y) => (
        <mesh key={y} position={[0, y, -0.26 - (y - 0.6) * 0.15]} rotation-x={-0.15} material={wood} castShadow>
          <boxGeometry args={[length, 0.11, 0.035]} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (length / 2 - 0.12), 0, 0]}>
          <mesh position={[0, 0.22, -0.06]} material={iron} castShadow>
            <boxGeometry args={[0.05, 0.44, 0.42]} />
          </mesh>
          <mesh position={[0, 0.7, -0.27]} rotation-x={-0.15} material={iron}>
            <boxGeometry args={[0.05, 0.55, 0.05]} />
          </mesh>
          <mesh position={[0, 0.62, -0.05]} material={iron}>
            <boxGeometry args={[0.05, 0.04, 0.4]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function ExpressPlatforms({ w, d, toHouse, rot, label }: SigProps) {
  const { accent } = useHouse();
  const [refreshes, setRefreshes] = useState(0);
  const [flip, setFlip] = useState(0);
  const nextFlip = useRef(0);
  const hourHand = useRef<THREE.Mesh>(null);
  const minuteHand = useRef<THREE.Mesh>(null);

  const bw = Math.min(w - 1.6, 5.2);
  const bh = 1.7;
  const rows = useMemo(
    () =>
      DEPARTURES.map((dep, i) => {
        const minutes = 9 * 60 + refreshes * 7 + i * 4;
        const time = `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
        return { time, route: dep.route, status: dep.statuses[(refreshes + i * 2 + Math.floor(refreshes / 2)) % dep.statuses.length] };
      }),
    [refreshes],
  );
  const board = useCanvas(
    1024,
    Math.round((1024 * bh) / bw),
    (ctx, cw, ch) => {
      ctx.fillStyle = "#0d0d0d";
      ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = "#f2c94c";
      ctx.font = font(30, "700");
      ctx.textBaseline = "middle";
      ctx.fillText("DEPARTURES", 36, 40);
      ctx.fillStyle = "#9a9a9a";
      ctx.font = font(20, "600");
      ctx.fillText(label.toUpperCase(), 270, 42);
      const cell = (cw - 72) / 32;
      const rowH = (ch - 90) / rows.length;
      const columns: [string, number, number][] = [
        ["TIME", 0, 5],
        ["ROUTE", 6, 16],
        ["STATUS", 23, 14],
      ];
      ctx.font = font(15, "600");
      ctx.fillStyle = "#7d7d7d";
      columns.forEach(([title, at]) => ctx.fillText(title, 36 + at * cell, 76));
      rows.forEach((row, r) => {
        const y = 92 + r * rowH;
        const values = [row.time, row.route, row.status];
        columns.forEach(([, at, len], c) => {
          const text = flapText(values[c].padEnd(len), flip, r * 3 + c).slice(0, len);
          [...text].forEach((ch2, k) => {
            const x = 36 + (at + k) * cell;
            box(ctx, x, y, cell - 3, rowH - 10, 4, "#1d1d1d");
            ctx.fillStyle = "#000000";
            ctx.fillRect(x, y + (rowH - 10) / 2 - 1, cell - 3, 2);
            const ok = c === 2 && !flip;
            ctx.fillStyle = ok ? (row.status.startsWith("404") ? "#ff6b6b" : "#7ee787") : "#f5f5f0";
            ctx.font = font(cell * 0.9, "700");
            ctx.textAlign = "center";
            ctx.fillText(ch2, x + (cell - 3) / 2, y + (rowH - 10) / 2 + 1);
            ctx.textAlign = "left";
          });
        });
      });
    },
    `${refreshes}-${flip}-${bw}`,
  );

  const refresh = () => {
    if (flip) return;
    setRefreshes((n) => n + 1);
    setFlip(1);
    nextFlip.current = now() + 0.09;
    sfx.click();
  };
  useFrame(() => {
    const t = now();
    const date = new Date();
    const m = date.getMinutes() + date.getSeconds() / 60;
    if (minuteHand.current) minuteHand.current.rotation.z = -(m / 60) * Math.PI * 2;
    if (hourHand.current) hourHand.current.rotation.z = -(((date.getHours() % 12) + m / 60) / 12) * Math.PI * 2;
    if (!flip || t < nextFlip.current) return;
    nextFlip.current = t + 0.09;
    sfx.click();
    if (flip >= FLAP_FRAMES) {
      setFlip(0);
      toast(
        "Express matches each request by method and path: /orders/:id puts the id in req.params.id. 201 means created, 204 means done with no body, and 404 is what you get when no order matches.",
        "🚉 Departures",
      );
    } else setFlip(flip + 1);
  });
  const where = useWorldPoint(toHouse, 0, -d / 2 + 1.9);
  useProximity({ id: "express-platforms-board", label: "Refresh departures", radius: 2, where, run: refresh });

  const benchZ = -d / 2 + Math.min(3.8, d - 4.2);
  const benchX = w >= 6.5 ? [-w / 4, w / 4] : [0];
  const benchLen = Math.min(1.9, w / 2 - 0.8);
  const seatXs = benchLen > 1.6 ? [-0.6, 0, 0.6] : [-0.4, 0.4];
  const seats = useMemo(
    () => benchX.flatMap((bx, b) => seatXs.map((sx, i) => seatAt(`express-platforms-${b}-${i}`, toHouse, rot, bx - sx, benchZ, Math.PI))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [benchX.length, seatXs.length, benchZ, toHouse, rot, w],
  );
  const iron = flat(IRON, 0.45, 0.6);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        {benchX.map((bx) => (
          <CuboidCollider key={bx} args={[benchLen / 2, 0.45, 0.25]} position={[bx, 0.45, benchZ + 0.06]} />
        ))}
      </RigidBody>
      {/* The departures board, hung from the back wall */}
      <group position={[0, 2.35, -d / 2 + 0.16]}>
        <mesh position={[0, 0, -0.03]} material={iron} castShadow>
          <boxGeometry args={[bw + 0.24, bh + 0.24, 0.1]} />
        </mesh>
        <Panel position={[0, 0, 0.03]} width={bw} height={bh} map={board.texture} frame={IRON} onClick={(e) => clicked(e) && refresh()} />
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * (bw / 2 - 0.2), bh / 2 + 0.5, -0.03]} material={iron}>
            <boxGeometry args={[0.03, 0.9, 0.03]} />
          </mesh>
        ))}
      </group>
      {/* Station clock */}
      <group position={[Math.min(bw / 2 + 0.7, w / 2 - 0.5), 2.7, -d / 2 + 0.16]}>
        <mesh rotation-x={Math.PI / 2} material={flat("#fafaf5", 0.4)}>
          <cylinderGeometry args={[0.3, 0.3, 0.06, 32]} />
        </mesh>
        <mesh material={iron}>
          <torusGeometry args={[0.3, 0.03, 8, 32]} />
        </mesh>
        <mesh ref={hourHand} position={[0, 0, 0.04]} material={iron}>
          <boxGeometry args={[0.025, 0.32, 0.01]} />
        </mesh>
        <mesh ref={minuteHand} position={[0, 0, 0.05]} material={flat(accent, 0.4)}>
          <boxGeometry args={[0.018, 0.46, 0.01]} />
        </mesh>
      </group>
      {/* Tactile safety strip in front of the board */}
      <mesh position={[0, 0.006, -d / 2 + 1.0]} rotation-x={-Math.PI / 2} material={flat("#e8c547", 0.7)} receiveShadow>
        <planeGeometry args={[Math.min(w - 0.6, bw + 1), 0.3]} />
      </mesh>
      {benchX.map((bx) => (
        <PlatformBench key={bx} position={[bx, 0, benchZ]} length={benchLen} />
      ))}
      <Seats seats={seats} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// NestJS · The Hive (hero)
// ---------------------------------------------------------------------------

/**
 * A honeycomb sculpture of hexagonal cells: AppModule in the middle, its feature modules around it
 * and a few empty wax cells at the edges. E resolves dependencies: the cells light up in the order
 * Nest's injector builds them, with glowing links drawn from each module to what it imports.
 */
const NEST_RED = "#e0234e";
type HiveCell = { name: string; at: [number, number]; imports: string[] };
const HEX_R = 0.72;
const HEX_STEP = Math.sqrt(3) * HEX_R + 0.08;
const ring = (deg: number, k = 1): [number, number] => [Math.cos((deg * Math.PI) / 180) * HEX_STEP * k, Math.sin((deg * Math.PI) / 180) * HEX_STEP * k];
const HIVE: HiveCell[] = [
  { name: "ConfigModule", at: ring(180), imports: [] },
  { name: "DatabaseModule", at: ring(240), imports: ["ConfigModule"] },
  { name: "UsersModule", at: ring(300), imports: ["DatabaseModule"] },
  { name: "AuthModule", at: ring(0), imports: ["UsersModule"] },
  { name: "OrdersModule", at: ring(60), imports: ["AuthModule", "UsersModule"] },
  { name: "AppModule", at: [0, 0], imports: ["ConfigModule", "DatabaseModule", "UsersModule", "AuthModule", "OrdersModule"] },
];
const WAX_CELLS: [number, number][] = [ring(120), ring(0, 2), ring(180, 2), ring(30, Math.sqrt(3)), ring(150, Math.sqrt(3)), ring(210, Math.sqrt(3)), ring(330, Math.sqrt(3))];

function NestHive({ w, d, toHouse }: SigProps) {
  const { palette } = useHouse();
  const [resolved, setResolved] = useState(0);
  const [resolving, setResolving] = useState(false);
  const step = useRef(-1);
  const nextAt = useRef(0);
  const popAt = useRef<number[]>(HIVE.map(() => -10));
  const cells = useRef<(THREE.Group | null)[]>([]);
  const cy = HEX_STEP * Math.sin(Math.PI / 3) + HEX_R + 0.28;
  const wide = w >= 7.4;

  const run = () => {
    if (step.current >= 0) return;
    setResolved(0);
    step.current = 0;
    nextAt.current = now() + 0.5;
    setResolving(true);
    sfx.click();
  };
  const where = useWorldPoint(toHouse, 0, Math.min(d / 2 - 0.4, 2.4));
  useProximity({ id: "nest-hive", label: resolving ? "Resolving…" : "Resolve dependencies", radius: 2.4, where, run });

  useFrame(() => {
    const t = now();
    cells.current.forEach((g, i) => {
      if (g) g.scale.setScalar(1 + 0.14 * Math.exp(-(t - popAt.current[i]) * 6));
    });
    if (step.current < 0 || t < nextAt.current) return;
    popAt.current[step.current] = t;
    step.current++;
    setResolved(step.current);
    nextAt.current = t + 0.75;
    sfx.chirp();
    if (step.current >= HIVE.length) {
      step.current = -1;
      setResolving(false);
      sfx.sparkle();
      burstAt(toHouse, 0, cy, 0.6, [NEST_RED, "#ffffff", "#ffb3c2"], 22);
      toast(
        "Nest's injector read every @Module's imports and providers, built each provider once in dependency order (Config → Database → Users → Auth → Orders → App) and passed them into constructors. You never write new UsersService().",
        "🐝 Dependency injection",
      );
    }
  });

  const front = (cellDepth: number) => -0.45 + cellDepth;
  const links = HIVE.flatMap((cell, i) =>
    cell.imports.map((dep) => {
      const to = HIVE.find((c) => c.name === dep)!;
      return { from: i, a: cell.at, b: to.at, key: `${cell.name}-${dep}` };
    }),
  );
  const wax = flat("#5a1a26", 0.55, 0.1);
  const body = flat(palette.ink, 0.5, 0.2);
  const lit = flat(NEST_RED, 0.3, 0, NEST_RED, 1.5);
  const link = flat("#ffd1d8", 0.3, 0, "#ff8fa6", 2.4);
  return (
    <group onClick={(e) => clicked(e) && run()} {...pointer}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[wide ? 3.2 : 2.1, 0.3, 0.6]} position={[0, 0.3, -0.05]} />
      </RigidBody>
      {/* Plinth */}
      <mesh position={[0, 0.14, -0.05]} material={flat(palette.ink, 0.4, 0.5)} castShadow receiveShadow>
        <boxGeometry args={[wide ? 6.4 : 4.2, 0.28, 1.2]} />
      </mesh>
      <mesh position={[0, 0.29, 0.555]} material={flat(NEST_RED, 0.4, 0.2)}>
        <boxGeometry args={[wide ? 6.4 : 4.2, 0.03, 0.01]} />
      </mesh>
      <group position={[0, cy, 0]}>
        {(wide ? WAX_CELLS : WAX_CELLS.slice(0, 1)).map(([x, y], i) => (
          <mesh key={i} position={[x, y, -0.45 + 0.2]} rotation-x={Math.PI / 2} material={wax} castShadow>
            <cylinderGeometry args={[HEX_R, HEX_R, 0.4, 6]} />
          </mesh>
        ))}
        {HIVE.map((cell, i) => {
          const app = cell.name === "AppModule";
          const depth = app ? 0.95 : 0.7;
          const on = i < resolved;
          return (
            <group
              key={cell.name}
              ref={(g) => {
                cells.current[i] = g;
              }}
              position={[cell.at[0], cell.at[1], 0]}
            >
              <mesh position={[0, 0, -0.45 + depth / 2]} rotation-x={Math.PI / 2} material={body} castShadow>
                <cylinderGeometry args={[HEX_R, HEX_R, depth, 6]} />
              </mesh>
              <mesh position={[0, 0, front(depth) + 0.005]} rotation-x={Math.PI / 2} material={on ? lit : wax}>
                <cylinderGeometry args={[HEX_R - 0.08, HEX_R - 0.08, 0.02, 6]} />
              </mesh>
              <Text position={[0, 0, front(depth) + 0.03]} fontSize={app ? 0.17 : 0.125} color={on ? "#ffffff" : "#e8b4c0"} anchorX="center" anchorY="middle">
                {cell.name}
              </Text>
            </group>
          );
        })}
        {links.map(({ from, a, b, key }) => {
          const dx = b[0] - a[0];
          const dy = b[1] - a[1];
          const len = Math.hypot(dx, dy) - 0.9;
          return (
            <mesh key={key} position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, front(0.95) + 0.06]} rotation-z={Math.atan2(dy, dx) - Math.PI / 2} material={link} visible={from < resolved}>
              <cylinderGeometry args={[0.025, 0.025, len, 6]} />
            </mesh>
          );
        })}
      </group>
      <Text position={[0, 0.2, 0.62]} fontSize={0.12} color="#ffd1d8" anchorX="center" anchorY="middle">
        {resolved >= HIVE.length ? "Nest application successfully started" : `@Module({ imports: [...] }) · ${resolved}/${HIVE.length} resolved`}
      </Text>
    </group>
  );
}

// ---------------------------------------------------------------------------
// NestJS · Guard Post (room)
// ---------------------------------------------------------------------------

/**
 * A guard booth beside a walkway, a striped barrier arm across it and the protected /admin door
 * behind. E requests access: the requests alternate between allowed (the arm lifts, green light,
 * canActivate() → true) and denied (red light, 403 Forbidden).
 */
const GUARD_SIGN = "@UseGuards(AuthGuard('jwt'), RolesGuard)";

function NestGuard({ w, d, toHouse }: SigProps) {
  const { palette } = useHouse();
  const [state, setState] = useState<"idle" | "allowed" | "denied">("idle");
  const attempts = useRef(0);
  const resetAt = useRef(0);
  const arm = useRef<THREE.Group>(null);
  const redLamp = useRef<THREE.Mesh>(null);
  const glass = useMemo(() => new THREE.MeshStandardMaterial({ color: "#cfe3f0", roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.25, depthWrite: false }), []);

  const bz = -0.4;
  const booth = -Math.min(2.0, w / 2 - 0.85);
  const postX = -1.15;
  const armLen = 2.35;

  const request = () => {
    if (state !== "idle") return;
    attempts.current++;
    const allowed = attempts.current % 2 === 1;
    setState(allowed ? "allowed" : "denied");
    resetAt.current = now() + 3.5;
    if (allowed) {
      sfx.chirp();
      burstAt(toHouse, 0, 1.3, bz, ["#22c55e", "#ffffff"], 14);
      toast("AuthGuard('jwt') verified your token's signature and expiry, RolesGuard found the admin role: canActivate() → true, so the controller runs.", "🛡️ Guard Post");
    } else {
      sfx.clunk();
      toast(
        "Your JWT was valid, but RolesGuard's canActivate() returned false (no admin role), so Nest threw a ForbiddenException: 403. A missing or bad token would have stopped at AuthGuard with 401.",
        "🛡️ 403 Forbidden",
      );
    }
  };
  useFrame((_, delta) => {
    const t = now();
    if (state !== "idle" && t >= resetAt.current) setState("idle");
    if (arm.current) arm.current.rotation.z += ((state === "allowed" ? 1.35 : 0) - arm.current.rotation.z) * Math.min(1, delta * 4);
    if (redLamp.current) redLamp.current.visible = state !== "denied" || Math.floor(t * 4) % 2 === 0;
  });
  const where = useWorldPoint(toHouse, 0, bz + 1.4);
  useProximity({ id: "nest-guard-access", label: state === "idle" ? "Request access" : "Checking…", radius: 1.8, where, run: request });

  const wall = flat(palette.ink, 0.5, 0.2);
  const red = flat(NEST_RED, 0.4, 0.2);
  const signW = Math.min(w - 0.6, 4.2);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.65, 1.2, 0.65]} position={[booth, 1.2, bz - 0.4]} />
        <CuboidCollider args={[0.1, 0.6, 0.1]} position={[postX, 0.6, bz]} />
      </RigidBody>
      {/* Walkway to the protected door */}
      <mesh position={[0, 0.005, (bz - d / 2) / 2 + 0.6]} rotation-x={-Math.PI / 2} material={flat("#24080e", 0.8)} receiveShadow>
        <planeGeometry args={[2, d / 2 + bz + 1.2]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 1.0, 0.007, (bz - d / 2) / 2 + 0.6]} rotation-x={-Math.PI / 2} material={flat("#e8c547", 0.6)}>
          <planeGeometry args={[0.08, d / 2 + bz + 1.2]} />
        </mesh>
      ))}
      {/* The protected door on the back wall */}
      <group position={[0, 0, -d / 2 + 0.08]}>
        <mesh position={[0, 1.1, 0]} material={red} castShadow>
          <boxGeometry args={[1.1, 2.2, 0.06]} />
        </mesh>
        <mesh position={[0, 1.15, 0]} material={wall}>
          <boxGeometry args={[1.3, 2.32, 0.04]} />
        </mesh>
        <mesh position={[0.4, 1.05, 0.05]} material={flat("#d0d0d0", 0.25, 0.9)}>
          <boxGeometry args={[0.04, 0.2, 0.04]} />
        </mesh>
        <Text position={[0, 1.8, 0.04]} fontSize={0.14} color="#ffffff" anchorX="center" anchorY="middle">
          /admin
        </Text>
        <mesh position={[0, 2.75, 0.02]} material={wall}>
          <boxGeometry args={[signW, 0.4, 0.04]} />
        </mesh>
        <Text position={[0, 2.75, 0.05]} fontSize={Math.min(0.15, (signW - 0.2) / (GUARD_SIGN.length * 0.55))} color="#ffd1d8" anchorX="center" anchorY="middle">
          {GUARD_SIGN}
        </Text>
      </group>
      {/* The guard booth */}
      <group position={[booth, 0, bz - 0.4]}>
        <mesh position={[0, 0.5, 0]} material={wall} castShadow receiveShadow>
          <boxGeometry args={[1.3, 1.0, 1.3]} />
        </mesh>
        <mesh position={[0, 1.02, 0]} material={red}>
          <boxGeometry args={[1.34, 0.06, 1.34]} />
        </mesh>
        <mesh position={[0, 1.6, 0]} material={glass}>
          <boxGeometry args={[1.26, 1.1, 1.26]} />
        </mesh>
        {[-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) => (
            <mesh key={`${sx}${sz}`} position={[sx * 0.62, 1.6, sz * 0.62]} material={wall}>
              <boxGeometry args={[0.07, 1.1, 0.07]} />
            </mesh>
          )),
        )}
        <mesh position={[0, 2.22, 0]} material={wall} castShadow>
          <boxGeometry args={[1.6, 0.14, 1.6]} />
        </mesh>
        <mesh position={[0, 2.3, 0]} material={red}>
          <boxGeometry args={[1.62, 0.03, 1.62]} />
        </mesh>
        <Text position={[0, 0.65, 0.66]} fontSize={0.13} color="#ffd1d8" anchorX="center" anchorY="middle">
          AuthGuard
        </Text>
        <Suspense fallback={null}>
          <group position={[0, 0, 0]} rotation-y={Math.PI / 2}>
            <Person look={NPC_PEOPLE[3]} animation="idle" detail={false} />
          </group>
        </Suspense>
      </group>
      {/* The barrier: post with traffic light, striped arm, rest post across the walkway */}
      <group position={[postX, 0, bz]}>
        <mesh position={[0, 0.55, 0]} material={wall} castShadow>
          <boxGeometry args={[0.22, 1.1, 0.22]} />
        </mesh>
        <group ref={arm} position={[0.05, 0.95, 0.16]}>
          {Array.from({ length: 6 }, (_, k) => (
            <mesh key={k} position={[0.2 + k * (armLen / 6), 0, 0]} material={k % 2 ? flat("#ffffff", 0.5) : red} castShadow>
              <boxGeometry args={[armLen / 6, 0.09, 0.05]} />
            </mesh>
          ))}
        </group>
        <group position={[0, 1.45, 0]}>
          <mesh material={flat(IRON, 0.5, 0.4)}>
            <boxGeometry args={[0.22, 0.5, 0.16]} />
          </mesh>
          <mesh ref={redLamp} position={[0, 0.11, 0.085]} material={state === "denied" ? flat("#ef4444", 0.3, 0, "#ef4444", 2.4) : flat("#4a1515", 0.5)}>
            <circleGeometry args={[0.07, 18]} />
          </mesh>
          <mesh position={[0, -0.11, 0.085]} material={state === "allowed" ? flat("#22c55e", 0.3, 0, "#22c55e", 2.4) : flat("#133a1d", 0.5)}>
            <circleGeometry args={[0.07, 18]} />
          </mesh>
        </group>
        <group position={[0, 2.0, 0]}>
          <mesh material={flat(IRON, 0.5, 0.3)}>
            <boxGeometry args={[1.5, 0.3, 0.04]} />
          </mesh>
          <Text position={[0, 0, 0.03]} fontSize={0.11} color={state === "allowed" ? "#4ade80" : state === "denied" ? "#f87171" : "#cccccc"} anchorX="center" anchorY="middle">
            {state === "allowed" ? "canActivate() → true" : state === "denied" ? "403 Forbidden" : "canActivate(context)?"}
          </Text>
        </group>
      </group>
      <mesh position={[postX + armLen + 0.3, 0.45, bz + 0.16]} material={wall} castShadow>
        <boxGeometry args={[0.12, 0.9, 0.12]} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Laravel · The Blade Forge (hero)
// ---------------------------------------------------------------------------

/**
 * A blacksmith's forge: a brick hearth with flickering coals under a hood and chimney, an anvil on
 * a stump with a glowing blade, and a helve hammer above it. E forges a view: the hammer strikes,
 * sparks fly and the blade takes the next Blade directive of the template shown on the board.
 */
const LARAVEL_RED = "#ff2d20";
const BLADE_LINES = [
  { code: "@extends('layouts.app')", tip: "@extends picks the parent layout; the child view fills the layout's @yield slots." },
  { code: "@section('content')", tip: "@section('content') … @endsection fills the layout's @yield('content')." },
  { code: "@foreach ($orders as $order)", tip: "@foreach loops right in the template, with $loop->first and $loop->last for free (@forelse handles the empty list)." },
  { code: "@if ($order->paid)", tip: "@if / @else / @endif compile to plain PHP ifs. Blade compiles each view to PHP once and caches it, and {{ $x }} escapes output for you." },
];

function LaravelForge({ w, d, toHouse }: SigProps) {
  const { palette } = useHouse();
  const [forged, setForged] = useState(0);
  const strikeAt = useRef(-10);
  const struck = useRef(true);
  const helve = useRef<THREE.Group>(null);
  const coal = useRef<THREE.Mesh>(null);
  const blade = useRef<THREE.Mesh>(null);
  const bricks = useCanvas(
    256,
    256,
    (ctx, cw, ch) => {
      ctx.fillStyle = "#d9cbbd";
      ctx.fillRect(0, 0, cw, ch);
      const rows = 8;
      const rh = ch / rows;
      for (let r = 0; r < rows; r++)
        for (let c = -1; c < 5; c++) {
          const x = c * 64 + (r % 2) * 32;
          ctx.fillStyle = ["#9b3a2b", "#8a3224", "#a8432f"][(r * 5 + c * 3 + 9) % 3];
          ctx.fillRect(x + 3, r * rh + 3, 58, rh - 6);
        }
    },
    "forge-bricks",
  );

  const hx = -Math.min(1.9, w / 2 - 1.1);
  const ax = 0.75;
  const boardX = Math.min(2.85, w / 2 - 0.6);
  const current = forged % BLADE_LINES.length;

  const strike = () => {
    if (now() - strikeAt.current < 1.2) return;
    strikeAt.current = now();
    struck.current = false;
    sfx.click();
  };
  const where = useWorldPoint(toHouse, ax, Math.min(d / 2 - 0.4, 1.9));
  useProximity({ id: "laravel-forge", label: "Forge a view", radius: 2.2, where, run: strike });

  useFrame(() => {
    const t = now();
    const dt = t - strikeAt.current;
    const lift = dt < 0.35 ? -0.25 - 0.4 * smooth(dt / 0.35) : dt < 0.45 ? -0.65 + 0.76 * ((dt - 0.35) / 0.1) : dt < 1.2 ? 0.11 - 0.36 * smooth((dt - 0.45) / 0.75) : -0.25;
    if (helve.current) helve.current.rotation.x = lift;
    if (!struck.current && dt >= 0.45) {
      struck.current = true;
      setForged((n) => n + 1);
      sfx.clunk();
      sfx.kick();
      burstAt(toHouse, ax, 1.0, 0, ["#ffb347", "#ffe08a", LARAVEL_RED, "#ffffff"], 26);
      toast(BLADE_LINES[(forged + 1) % BLADE_LINES.length].tip, "🔨 Blade");
    }
    const flicker = 1.6 + Math.sin(t * 7.3) * 0.35 + Math.sin(t * 13.1) * 0.25;
    if (coal.current) (coal.current.material as THREE.MeshStandardMaterial).emissiveIntensity = flicker;
    if (blade.current) (blade.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.2 + 1.5 * Math.exp(-Math.max(0, dt - 0.45) * 2);
  });

  const coalMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#3a1208", roughness: 0.8, emissive: "#ff5a1f", emissiveIntensity: 1.6, toneMapped: false }), []);
  const bladeMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ff8a3d", roughness: 0.35, metalness: 0.6, emissive: "#ff6a1f", emissiveIntensity: 1.2, toneMapped: false }), []);
  const iron = flat("#2c2f33", 0.35, 0.8);
  const wood = flat("#6b4428", 0.75);
  const coals = Array.from({ length: 12 }, (_, i) => [hx - 0.55 + (i % 6) * 0.22, 0.92 + ((i * 5) % 3) * 0.02, -0.15 + Math.floor(i / 6) * 0.3] as [number, number, number]);
  return (
    <group onClick={(e) => clicked(e) && strike()} {...pointer}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.95, 0.45, 0.65]} position={[hx, 0.45, -0.1]} />
        <CuboidCollider args={[0.4, 0.45, 0.35]} position={[ax, 0.45, 0]} />
        <CuboidCollider args={[0.12, 0.8, 0.12]} position={[ax, 0.8, -1.1]} />
      </RigidBody>
      {/* Brick hearth, coal bed, hood and chimney */}
      <mesh position={[hx, 0.43, -0.1]} castShadow receiveShadow>
        <boxGeometry args={[1.9, 0.86, 1.3]} />
        <meshStandardMaterial map={bricks.texture} roughness={0.9} />
      </mesh>
      <mesh position={[hx, 0.87, -0.1]} material={flat("#3a2a22", 0.9)}>
        <boxGeometry args={[1.94, 0.04, 1.34]} />
      </mesh>
      <mesh ref={coal} position={[hx, 0.9, -0.1]} material={coalMat}>
        <boxGeometry args={[1.4, 0.03, 0.8]} />
      </mesh>
      {coals.map((p, i) => (
        <mesh key={i} position={p} rotation={[i, i * 2, 0]} material={coalMat}>
          <dodecahedronGeometry args={[0.07 + (i % 3) * 0.015, 0]} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[hx + s * 0.85, 1.32, 0.45]} material={iron} castShadow>
          <boxGeometry args={[0.07, 0.86, 0.07]} />
        </mesh>
      ))}
      <mesh position={[hx, 2.15, -0.1]} rotation-y={Math.PI / 4} material={iron} castShadow>
        <cylinderGeometry args={[0.42, 1.25, 0.8, 4]} />
      </mesh>
      <mesh position={[hx, 3.25, -0.1]} castShadow>
        <boxGeometry args={[0.62, 1.4, 0.62]} />
        <meshStandardMaterial map={bricks.texture} roughness={0.9} />
      </mesh>
      <mesh position={[hx, 1.78, 0.46]} material={flat(LARAVEL_RED, 0.4, 0.3)}>
        <boxGeometry args={[1.75, 0.06, 0.03]} />
      </mesh>
      {/* Quench barrel */}
      <group position={[hx + 1.25, 0, 0.45]}>
        <mesh position={[0, 0.35, 0]} material={wood} castShadow>
          <cylinderGeometry args={[0.28, 0.25, 0.7, 18]} />
        </mesh>
        {[0.15, 0.55].map((y) => (
          <mesh key={y} position={[0, y, 0]} rotation-x={Math.PI / 2} material={iron}>
            <torusGeometry args={[0.275, 0.015, 6, 24]} />
          </mesh>
        ))}
        <mesh position={[0, 0.66, 0]} rotation-x={-Math.PI / 2} material={flat("#2b4a5a", 0.05, 0.3)}>
          <circleGeometry args={[0.25, 20]} />
        </mesh>
      </group>
      {/* Stump, anvil and the glowing blade */}
      <group position={[ax, 0, 0]}>
        <mesh position={[0, 0.23, 0]} material={wood} castShadow receiveShadow>
          <cylinderGeometry args={[0.32, 0.36, 0.46, 18]} />
        </mesh>
        <mesh position={[0, 0.461, 0]} rotation-x={-Math.PI / 2} material={flat("#b0834f", 0.7)}>
          <circleGeometry args={[0.31, 18]} />
        </mesh>
        <mesh position={[0, 0.52, 0]} material={iron} castShadow>
          <boxGeometry args={[0.4, 0.12, 0.3]} />
        </mesh>
        <mesh position={[0, 0.64, 0]} material={iron}>
          <boxGeometry args={[0.24, 0.14, 0.18]} />
        </mesh>
        <mesh position={[-0.02, 0.78, 0]} material={iron} castShadow>
          <boxGeometry args={[0.6, 0.14, 0.26]} />
        </mesh>
        <mesh position={[0.46, 0.78, 0]} rotation-z={-Math.PI / 2} material={iron} castShadow>
          <coneGeometry args={[0.1, 0.34, 14]} />
        </mesh>
        <mesh ref={blade} position={[-0.02, 0.862, 0]} material={bladeMat}>
          <boxGeometry args={[0.56, 0.025, 0.14]} />
        </mesh>
        <Text position={[-0.02, 0.877, 0]} rotation-x={-Math.PI / 2} fontSize={0.032} maxWidth={0.54} color="#fff4d6" anchorX="center" anchorY="middle">
          {BLADE_LINES[current].code}
        </Text>
        {/* The helve hammer: a post behind the anvil, a beam on a pivot, the head over the blade */}
        <mesh position={[0, 0.8, -1.1]} material={wood} castShadow>
          <boxGeometry args={[0.2, 1.6, 0.2]} />
        </mesh>
        <mesh position={[0, 0.03, -1.1]} material={iron}>
          <boxGeometry args={[0.5, 0.06, 0.5]} />
        </mesh>
        <group ref={helve} position={[0, 1.5, -1.1]} rotation-x={-0.25}>
          <mesh rotation-z={Math.PI / 2} material={iron}>
            <cylinderGeometry args={[0.06, 0.06, 0.3, 12]} />
          </mesh>
          <mesh position={[0, 0, 0.55]} material={wood} castShadow>
            <boxGeometry args={[0.09, 0.09, 1.25]} />
          </mesh>
          <mesh position={[0, -0.29, 1.1]} material={iron} castShadow>
            <boxGeometry args={[0.22, 0.32, 0.22]} />
          </mesh>
          <mesh position={[0, -0.47, 1.1]} material={flat("#5a5f66", 0.3, 0.9)}>
            <boxGeometry args={[0.2, 0.04, 0.2]} />
          </mesh>
        </group>
      </group>
      {/* The template board: the view being forged */}
      {w >= 6.6 && (
        <group position={[boardX, 0, -0.3]}>
          {[-0.6, 0.6].map((x) => (
            <mesh key={x} position={[x, 1.1, -0.05]} material={wood} castShadow>
              <boxGeometry args={[0.09, 2.2, 0.09]} />
            </mesh>
          ))}
          <mesh position={[0, 2.25, 0]} material={flat(palette.ink, 0.7, 0.1)} castShadow>
            <boxGeometry args={[1.5, 1.4, 0.06]} />
          </mesh>
          <mesh position={[0, 2.97, 0]} material={flat(LARAVEL_RED, 0.4, 0.3)}>
            <boxGeometry args={[1.56, 0.06, 0.08]} />
          </mesh>
          <Text position={[-0.65, 2.78, 0.04]} fontSize={0.12} color={LARAVEL_RED} anchorX="left" anchorY="middle">
            orders/index.blade.php
          </Text>
          {BLADE_LINES.map((line, i) => (
            <Text key={line.code} position={[-0.65 + i * 0.05, 2.52 - i * 0.24, 0.04]} fontSize={0.085} color={i === current ? "#ffd27a" : "#9a8a80"} anchorX="left" anchorY="middle">
              {line.code}
            </Text>
          ))}
          <Text position={[-0.6, 1.7, 0.04]} fontSize={0.075} color="#9a8a80" anchorX="left" anchorY="middle">
            {"{{ $order->total }}"}
          </Text>
        </group>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Laravel · Artisan Bench (room)
// ---------------------------------------------------------------------------

/**
 * An artisan's workbench against the back wall: wooden blocks carved with artisan commands, a
 * pegboard of tools and a small terminal. E runs the next command: its block lifts and the
 * terminal prints the output line by line.
 */
const ARTISAN = [
  {
    cmd: "make:model",
    full: "php artisan make:model Order -m",
    out: ["", "   INFO  Model [app/Models/Order.php] created successfully.", "", "   INFO  Migration [database/migrations/2026_10_16_101500_create_orders_table.php] created successfully."],
    tip: "Artisan's make:* generators scaffold classes for you: -m adds a migration, -mfc adds a factory and a controller too.",
  },
  {
    cmd: "migrate",
    full: "php artisan migrate",
    out: ["", "   INFO  Running migrations.", "", "  2026_10_16_101500_create_orders_table ......... 14.21ms DONE"],
    tip: "migrate runs the pending migrations in order and records them in the migrations table; migrate:rollback undoes the last batch.",
  },
  {
    cmd: "queue:work",
    full: "php artisan queue:work",
    out: ["", "   INFO  Processing jobs from the [default] queue.", "", "  2026-10-16 10:16:02 App\\Jobs\\SendInvoice ...... RUNNING", "  2026-10-16 10:16:02 App\\Jobs\\SendInvoice ..... 41.70ms DONE"],
    tip: "queue:work is a long-running worker: it pulls jobs that implement ShouldQueue off the queue and runs them outside the request.",
  },
  {
    cmd: "tinker",
    full: "php artisan tinker",
    out: ["Psy Shell v0.12.4 (PHP 8.3.12 — cli) by Justin Hileman", "> App\\Models\\Order::where('paid', true)->count();", "= 42"],
    tip: "tinker is a REPL (PsySH) with your whole app booted, so you can query Eloquent models live.",
  },
  {
    cmd: "route:list",
    full: "php artisan route:list",
    out: ["", "  GET|HEAD  / ................................... home", "  GET|HEAD  orders ..... orders.index › OrderController@index", "  POST      orders ..... orders.store › OrderController@store", "", "                               Showing [3] routes"],
    tip: "route:list prints every registered route with its method, URI, name and controller action.",
  },
];
const MONO = `ui-monospace, Menlo, Consolas, monospace`;

function LaravelArtisan({ w, d, toHouse, label }: SigProps) {
  const [cmd, setCmd] = useState(-1);
  const [shown, setShown] = useState(0);
  const nextLine = useRef(0);
  const blocks = useRef<(THREE.Group | null)[]>([]);
  const cmdRef = useRef(-1);

  const bw = Math.min(w - 2.4, 3.8);
  const bz = -d / 2 + 0.5;
  const top = 0.92;
  const area = bw - 1.15;
  const spacing = area / ARTISAN.length;
  const blockW = Math.min(0.5, spacing - 0.06);
  const blockX = (i: number) => -bw / 2 + 0.15 + spacing * (i + 0.5);
  const termX = bw / 2 - 0.5;

  const screen = useCanvas(
    768,
    480,
    (ctx, cw, ch) => {
      ctx.fillStyle = "#14100e";
      ctx.fillRect(0, 0, cw, ch);
      ctx.textBaseline = "top";
      ctx.font = `18px ${MONO}`;
      const lines: { text: string; color: string }[] = [];
      if (cmd < 0) lines.push({ text: "$ php artisan", color: "#f5e6dc" }, { text: "Laravel Framework 11.x", color: "#8a7a70" });
      else {
        const c = ARTISAN[cmd];
        lines.push({ text: `$ ${c.full}`, color: "#f5e6dc" });
        c.out.slice(0, shown).forEach((text) => lines.push({ text, color: text.includes("INFO") ? "#7aa2ff" : text.includes("DONE") ? "#7ee787" : "#d8ccc4" }));
      }
      let y = 18;
      const perLine = 66;
      lines.forEach(({ text, color }) => {
        for (let i = 0; i === 0 || i < text.length; i += perLine) {
          const part = text.slice(i, i + perLine);
          if (part.includes("INFO")) {
            const at = part.indexOf("INFO");
            box(ctx, 18 + at * 10.8 - 4, y - 2, 52, 24, 3, "#2f5bd3");
            ctx.fillStyle = "#ffffff";
            ctx.fillText(part.slice(0, at + 4), 18, y);
            ctx.fillStyle = "#d8ccc4";
            ctx.fillText(part.slice(at + 4), 18 + (at + 4) * 10.8, y);
          } else {
            ctx.fillStyle = color;
            ctx.fillText(part, 18, y);
          }
          y += 26;
        }
      });
      if (cmd >= 0 && shown >= ARTISAN[cmd].out.length) {
        ctx.fillStyle = "#f5e6dc";
        ctx.fillText("$ █", 18, y);
      }
    },
    `${cmd}-${shown}`,
  );

  const runNext = () => {
    const next = (cmdRef.current + 1) % ARTISAN.length;
    cmdRef.current = next;
    setCmd(next);
    setShown(0);
    nextLine.current = now() + 0.35;
    sfx.click();
    toast(ARTISAN[next].tip, `🛠️ php artisan ${ARTISAN[next].cmd}`);
  };
  useFrame((_, delta) => {
    const t = now();
    blocks.current.forEach((g, i) => {
      if (!g) return;
      const up = i === cmdRef.current ? 1 : 0;
      g.position.y += (top + 0.1 + up * 0.22 - g.position.y) * Math.min(1, delta * 5);
      g.rotation.x += (up * -0.35 - g.rotation.x) * Math.min(1, delta * 5);
    });
    if (cmd < 0 || shown >= ARTISAN[cmd].out.length || t < nextLine.current) return;
    nextLine.current = t + 0.3;
    setShown(shown + 1);
    if (shown + 1 === ARTISAN[cmd].out.length) sfx.chirp();
    else sfx.pop();
  });
  const where = useWorldPoint(toHouse, 0, bz + 1.3);
  useProximity({ id: "laravel-artisan-bench", label: `php artisan ${ARTISAN[(cmd + 1) % ARTISAN.length].cmd}`, radius: 1.9, where, run: runNext });

  const oak = flat("#b07a4a", 0.6);
  const walnut = flat("#6b4428", 0.65);
  const iron = flat("#2c2f33", 0.35, 0.8);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[bw / 2, 0.46, 0.38]} position={[0, 0.46, bz]} />
      </RigidBody>
      {/* The workbench and its pegboard (static) */}
      <Batch>
        <mesh position={[0, top - 0.04, bz]} material={oak} castShadow receiveShadow>
          <boxGeometry args={[bw, 0.08, 0.76]} />
        </mesh>
        {[-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) => (
            <mesh key={`${sx}${sz}`} position={[sx * (bw / 2 - 0.08), (top - 0.08) / 2, bz + sz * 0.3]} material={walnut} castShadow>
              <boxGeometry args={[0.09, top - 0.08, 0.09]} />
            </mesh>
          )),
        )}
        <mesh position={[0, 0.22, bz]} material={walnut} receiveShadow>
          <boxGeometry args={[bw - 0.12, 0.04, 0.62]} />
        </mesh>
        <mesh position={[0, top + 0.6, -d / 2 + 0.03]} material={flat("#d6bf9a", 0.8)}>
          <boxGeometry args={[bw, 1.1, 0.03]} />
        </mesh>
        {[-0.35, -0.2, -0.05, 0.1].map((x, i) => (
          <mesh key={x} position={[x * bw, top + 0.5 + (i % 2) * 0.12, -d / 2 + 0.07]} material={i % 2 ? iron : walnut}>
            <boxGeometry args={[0.04, 0.35 + (i % 2) * 0.1, 0.03]} />
          </mesh>
        ))}
        <mesh position={[0.25 * bw, top + 0.75, -d / 2 + 0.07]} material={iron}>
          <boxGeometry args={[0.28, 0.06, 0.04]} />
        </mesh>
        <mesh position={[0.25 * bw, top + 0.56, -d / 2 + 0.07]} material={walnut}>
          <boxGeometry args={[0.04, 0.36, 0.03]} />
        </mesh>
      </Batch>
      <Text position={[-bw / 2 + 0.1, top + 1.35, -d / 2 + 0.06]} fontSize={0.16} color={LARAVEL_RED} anchorX="left" anchorY="middle">
        {`${label} · php artisan`}
      </Text>
      {/* The command blocks */}
      {ARTISAN.map((a, i) => (
        <group
          key={a.cmd}
          ref={(g) => {
            blocks.current[i] = g;
          }}
          position={[blockX(i), top + 0.1, bz + 0.05]}
          onClick={(e) => {
            if (!clicked(e)) return;
            cmdRef.current = i - 1;
            runNext();
          }}
          {...pointer}
        >
          <mesh material={i % 2 ? walnut : oak} castShadow>
            <boxGeometry args={[blockW, 0.2, 0.2]} />
          </mesh>
          <mesh position={[0, 0, 0.101]} material={flat(i % 2 ? "#5a3820" : "#9a6a3e", 0.8)}>
            <planeGeometry args={[blockW - 0.04, 0.16]} />
          </mesh>
          <Text position={[0, 0, 0.103]} fontSize={Math.min(0.055, blockW / 6)} color={i % 2 ? "#e9d3b8" : "#3a2414"} anchorX="center" anchorY="middle">
            {a.cmd}
          </Text>
        </group>
      ))}
      {/* The terminal */}
      <group position={[termX, top, bz - 0.05]}>
        <mesh position={[0, 0.01, 0]} material={iron}>
          <boxGeometry args={[0.3, 0.02, 0.2]} />
        </mesh>
        <mesh position={[0, 0.12, -0.03]} material={iron}>
          <boxGeometry args={[0.05, 0.22, 0.04]} />
        </mesh>
        <mesh position={[0, 0.48, -0.03]} material={flat("#1a1a1a", 0.4, 0.3)} castShadow>
          <boxGeometry args={[0.8, 0.52, 0.04]} />
        </mesh>
        <Panel position={[0, 0.48, 0]} width={0.76} height={0.475} map={screen.texture} frame="#1a1a1a" onClick={(e) => clicked(e) && runNext()} />
      </group>
      {/* A stool at the bench */}
      <group position={[-0.5, 0, bz + 0.85]}>
        <mesh position={[0, 0.66, 0]} material={oak} castShadow>
          <cylinderGeometry args={[0.18, 0.18, 0.05, 20]} />
        </mesh>
        {[0, 1, 2].map((k) => {
          const a = (k / 3) * Math.PI * 2;
          return (
            <mesh key={k} position={[Math.cos(a) * 0.12, 0.32, Math.sin(a) * 0.12]} rotation={[Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12]} material={walnut}>
              <cylinderGeometry args={[0.02, 0.025, 0.66, 8]} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

export const BACKEND: Record<string, SigComponent> = {
  "node-turbine": NodeTurbine,
  "node-npm": NodeNpm,
  "express-middleware": ExpressMiddleware,
  "express-platforms": ExpressPlatforms,
  "nest-hive": NestHive,
  "nest-guard": NestGuard,
  "laravel-forge": LaravelForge,
  "laravel-artisan": LaravelArtisan,
};
