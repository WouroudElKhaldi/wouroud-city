"use client";

import { Text } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useCityStore, type Seat } from "@/state/useCityStore";
import { ROOM } from "@/world/interiors";
import { accents } from "@/world/palette";
import { emitBurst } from "./Particles";
import { SlotMachine } from "./SlotMachine";
import { Seats } from "./StreetDetails";

/**
 * Sahme Trading's office as a trading floor that is also an engineering team's home:
 * live candlestick walls, price tickers, a golden bull and crypto coins, world market
 * clocks, server racks, a coffee bar, an architecture whiteboard and a dev lounge.
 * Screens are drawn on canvases (charts and code), so nothing is downloaded.
 */

const D = ROOM.depth;
const UP = "#22c55e";
const DOWN = "#ef4444";
const SCREEN_BG = "#0b1020";

// ---------------------------------------------------------------------------
// Canvas screens
// ---------------------------------------------------------------------------

function rng(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

type Candle = { o: number; h: number; l: number; c: number };

function walk(
  count: number,
  start: number,
  vol: number,
  random: () => number,
): Candle[] {
  const out: Candle[] = [];
  let price = start;
  for (let i = 0; i < count; i++)
    (out.push(nextCandle(price, vol, random)), (price = out[i].c));
  return out;
}

function nextCandle(open: number, vol: number, random: () => number): Candle {
  const c = open + (random() - 0.48) * vol;
  return {
    o: open,
    c,
    h: Math.max(open, c) + random() * vol * 0.5,
    l: Math.min(open, c) - random() * vol * 0.5,
  };
}

/** Candlesticks with a moving average, a grid and a price label. */
function drawChart(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  label: string,
  digits: number,
) {
  const { width: w, height: h } = ctx.canvas;
  ctx.fillStyle = SCREEN_BG;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(148,163,184,0.15)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(0, (h * i) / 6);
    ctx.lineTo(w, (h * i) / 6);
    ctx.stroke();
  }
  const top = h * 0.2;
  const bottom = h * 0.95;
  const hi = Math.max(...candles.map((c) => c.h));
  const lo = Math.min(...candles.map((c) => c.l));
  const y = (v: number) =>
    bottom - ((v - lo) / (hi - lo || 1)) * (bottom - top);
  const step = w / candles.length;
  candles.forEach((c, i) => {
    const x = i * step + step / 2;
    ctx.strokeStyle = ctx.fillStyle = c.c >= c.o ? UP : DOWN;
    ctx.beginPath();
    ctx.moveTo(x, y(c.h));
    ctx.lineTo(x, y(c.l));
    ctx.stroke();
    ctx.fillRect(
      x - step * 0.32,
      Math.min(y(c.o), y(c.c)),
      step * 0.64,
      Math.max(2, Math.abs(y(c.o) - y(c.c))),
    );
  });
  // Moving average
  ctx.strokeStyle = accents.gold;
  ctx.lineWidth = 2;
  ctx.beginPath();
  candles.forEach((_, i) => {
    const from = Math.max(0, i - 7);
    const avg =
      candles.slice(from, i + 1).reduce((s, c) => s + c.c, 0) / (i + 1 - from);
    const x = i * step + step / 2;
    if (i === 0) ctx.moveTo(x, y(avg));
    else ctx.lineTo(x, y(avg));
  });
  ctx.stroke();
  const last = candles[candles.length - 1];
  const first = candles[0];
  const change = ((last.c - first.o) / first.o) * 100;
  ctx.font = `bold ${Math.round(h * 0.09)}px sans-serif`;
  ctx.fillStyle = "#e2e8f0";
  ctx.fillText(label, w * 0.03, h * 0.12);
  ctx.fillStyle = change >= 0 ? UP : DOWN;
  const text = `${last.c.toFixed(digits)}  ${change >= 0 ? "▲" : "▼"} ${Math.abs(change).toFixed(2)}%`;
  ctx.fillText(text, w * 0.97 - ctx.measureText(text).width, h * 0.12);
}

const CODE = [
  ["// settle a deposit across payment providers", "#64748b"],
  ["export async function deposit(order: Order) {", "#c4b5fd"],
  ["  const psp = router.pick(order.currency);", "#e2e8f0"],
  ["  const kyc = await sumsub.status(order.client);", "#e2e8f0"],
  ['  if (kyc !== "approved") throw new KycError();', "#fca5a5"],
  ["  const tx = await psp.charge(order.amount);", "#e2e8f0"],
  ["  await mt5.balance(order.login, tx.amount);", "#5eead4"],
  ["  return crm.log({ type: 'deposit', tx });", "#e2e8f0"],
  ["}", "#c4b5fd"],
  ["", "#e2e8f0"],
  ["Route::post('/withdrawals', WithdrawController::class)", "#fde68a"],
  ["    ->middleware(['auth', 'kyc', 'throttle:6,1']);", "#fde68a"],
] as const;

function drawCode(ctx: CanvasRenderingContext2D, offset: number) {
  const { width: w, height: h } = ctx.canvas;
  ctx.fillStyle = "#151026";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#231a3d";
  ctx.fillRect(0, 0, w, h * 0.09);
  ctx.font = `${Math.round(h * 0.05)}px monospace`;
  ctx.fillStyle = "#a78bfa";
  ctx.fillText("payments.ts", w * 0.03, h * 0.065);
  const line = h * 0.072;
  for (let i = 0; i < 11; i++) {
    const [text, color] = CODE[(i + offset) % CODE.length];
    ctx.fillStyle = "#4c4470";
    ctx.fillText(String(i + 1).padStart(2, " "), w * 0.02, h * 0.17 + i * line);
    ctx.fillStyle = color;
    ctx.fillText(text, w * 0.1, h * 0.17 + i * line);
  }
}

function canvasTexture(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return { ctx: canvas.getContext("2d")!, texture };
}

/** A static chart or code screen for a desk monitor. */
function useDeskScreen(kind: "chart" | "code", seed: number) {
  return useMemo(() => {
    const { ctx, texture } = canvasTexture(512, 300);
    if (kind === "code") drawCode(ctx, seed);
    else {
      const pairs = [
        "BTC/USD",
        "EUR/USD",
        "XAU/USD",
        "ETH/USD",
        "US30",
        "GBP/JPY",
      ];
      const label = pairs[seed % pairs.length];
      drawChart(ctx, walk(36, 100 + seed * 7, 3, rng(seed + 1)), label, 2);
    }
    texture.needsUpdate = true;
    return texture;
  }, [kind, seed]);
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

/** A big wall screen whose chart adds a new candle every second. */
function LiveChart({
  position,
  label,
  start,
  vol,
  digits,
}: {
  position: [number, number, number];
  label: string;
  start: number;
  vol: number;
  digits: number;
}) {
  const state = useMemo(() => {
    const random = rng(label.length * 97 + start);
    const { ctx, texture } = canvasTexture(1024, 600);
    return {
      ctx,
      texture,
      random,
      candles: walk(48, start, vol, random),
      t: 0,
    };
  }, [label, start, vol]);
  useEffect(() => {
    drawChart(state.ctx, state.candles, label, digits);
    state.texture.needsUpdate = true;
    return () => state.texture.dispose();
  }, [state, label, digits]);
  useFrame((_, delta) => {
    state.t += delta;
    if (state.t < 1) return;
    state.t = 0;
    state.candles.push(
      nextCandle(state.candles[state.candles.length - 1].c, vol, state.random),
    );
    state.candles.shift();
    drawChart(state.ctx, state.candles, label, digits);
    state.texture.needsUpdate = true;
  });
  return (
    <group position={position}>
      <mesh position={[0, 0, -0.03]}>
        <boxGeometry args={[4.3, 2.6, 0.06]} />
        <meshStandardMaterial color="#111827" metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh>
        <planeGeometry args={[4.1, 2.4]} />
        <meshBasicMaterial map={state.texture} toneMapped={false} />
      </mesh>
    </group>
  );
}

const SYMBOLS: [string, number, number][] = [
  ["BTC/USD", 67420, 2],
  ["ETH/USD", 3480, 2],
  ["XAU/USD", 2385, 2],
  ["EUR/USD", 1.0842, 4],
  ["GBP/USD", 1.2711, 4],
  ["USD/JPY", 154.32, 2],
  ["AAPL", 212.4, 2],
  ["TSLA", 184.9, 2],
  ["NVDA", 121.3, 2],
  ["SOL/USD", 168.2, 2],
  ["US30", 39850, 1],
  ["NAS100", 18920, 1],
  ["OIL", 78.6, 2],
];

/** An LED tape of prices scrolling sideways; the prices wander every few seconds. */
function Ticker({
  position,
  rotationY = 0,
  length,
}: {
  position: [number, number, number];
  rotationY?: number;
  length: number;
}) {
  const state = useMemo(() => {
    const { ctx, texture } = canvasTexture(4096, 96);
    texture.wrapS = THREE.RepeatWrapping;
    texture.repeat.x = length / 16;
    return {
      ctx,
      texture,
      prices: SYMBOLS.map(([, p]) => p),
      changes: SYMBOLS.map(() => 0),
      random: rng(7),
      t: 0,
    };
  }, [length]);
  const draw = () => {
    const { ctx, texture, prices, changes } = state;
    ctx.fillStyle = "#05060f";
    ctx.fillRect(0, 0, 4096, 96);
    ctx.font = "bold 52px monospace";
    let x = 20;
    SYMBOLS.forEach(([name, , digits], i) => {
      ctx.fillStyle = "#fde68a";
      ctx.fillText(name, x, 66);
      x += ctx.measureText(name).width + 18;
      const up = changes[i] >= 0;
      ctx.fillStyle = up ? UP : DOWN;
      const text = `${prices[i].toFixed(digits)} ${up ? "▲" : "▼"}${Math.abs(changes[i]).toFixed(2)}%`;
      ctx.fillText(text, x, 66);
      x += ctx.measureText(text).width + 60;
    });
    texture.needsUpdate = true;
  };
  useEffect(() => {
    draw();
    return () => state.texture.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  useFrame((_, delta) => {
    state.texture.offset.x += delta * 0.025;
    state.t += delta;
    if (state.t > 3) {
      state.t = 0;
      state.prices = state.prices.map((p, i) => {
        const move = (state.random() - 0.5) * 0.006;
        state.changes[i] = THREE.MathUtils.clamp(
          state.changes[i] + move * 100,
          -4,
          4,
        );
        return p * (1 + move);
      });
      draw();
    }
  });
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh position={[0, 0, -0.03]}>
        <boxGeometry args={[length + 0.2, 0.5, 0.06]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      <mesh>
        <planeGeometry args={[length, 0.4]} />
        <meshBasicMaterial map={state.texture} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** A trading desk: three monitors (chart, code, chart), keyboard, and sometimes a rubber duck. */
export function TradingDesk({
  x,
  z,
  seed,
  duck,
}: {
  x: number;
  z: number;
  seed: number;
  duck?: boolean;
}) {
  const left = useDeskScreen("chart", seed);
  const middle = useDeskScreen("code", seed);
  const right = useDeskScreen("chart", seed + 3);
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.95, 0.38, 0.42]} position={[0, 0.38, 0]} />
      </RigidBody>
      <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.9, 0.06, 0.85]} />
        <meshStandardMaterial color="#1f2937" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.775, 0.36]}>
        <boxGeometry args={[1.9, 0.012, 0.04]} />
        <meshStandardMaterial
          color={accents.gold}
          emissive={accents.gold}
          emissiveIntensity={0.5}
        />
      </mesh>
      {[-0.85, 0.85].map((lx) => (
        <mesh key={lx} position={[lx, 0.36, 0]} castShadow>
          <boxGeometry args={[0.06, 0.72, 0.75]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
      ))}
      {[
        [-0.62, 0.35, left],
        [0, 0, middle],
        [0.62, -0.35, right],
      ].map(([mx, rot, map], i) => (
        <group
          key={i}
          position={[mx as number, 1.13, -0.22 + (i === 1 ? -0.06 : 0)]}
          rotation-y={rot as number}
        >
          <mesh position={[0, 0, -0.025]} castShadow>
            <boxGeometry args={[0.62, 0.38, 0.03]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          <mesh>
            <planeGeometry args={[0.58, 0.34]} />
            <meshBasicMaterial map={map as THREE.Texture} toneMapped={false} />
          </mesh>
          <mesh position={[0, -0.27, -0.03]}>
            <boxGeometry args={[0.04, 0.2, 0.04]} />
            <meshStandardMaterial color="#111827" />
          </mesh>
        </group>
      ))}
      {/* Mechanical keyboard with glowing keys */}
      <mesh position={[0, 0.79, 0.1]}>
        <boxGeometry args={[0.62, 0.03, 0.2]} />
        <meshStandardMaterial
          color="#111827"
          emissive="#7c3aed"
          emissiveIntensity={0.35}
        />
      </mesh>
      <mesh position={[0.45, 0.785, 0.12]}>
        <boxGeometry args={[0.1, 0.02, 0.14]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      {duck && <RubberDuck position={[-0.7, 0.77, 0.15]} />}
      {/* Office chair */}
      <group position={[0, 0, 0.95]}>
        <mesh position={[0, 0.46, 0]} castShadow>
          <boxGeometry args={[0.58, 0.09, 0.58]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
        <mesh position={[0, 0.86, 0.27]} castShadow>
          <boxGeometry args={[0.56, 0.72, 0.08]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
        <mesh position={[0, 0.86, 0.315]}>
          <boxGeometry args={[0.08, 0.6, 0.01]} />
          <meshStandardMaterial color={accents.gold} />
        </mesh>
        <mesh position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.44, 8]} />
          <meshStandardMaterial color="#374151" metalness={0.6} />
        </mesh>
        <mesh position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 0.04, 5]} />
          <meshStandardMaterial color="#374151" metalness={0.6} />
        </mesh>
      </group>
    </group>
  );
}

/** Every developer's debugging partner. Click it to squeak. */
function RubberDuck({ position }: { position: [number, number, number] }) {
  const group = useRef<THREE.Group>(null);
  const hop = useRef(-10);
  const pending = useRef(false);
  useFrame(({ clock }) => {
    if (pending.current) {
      pending.current = false;
      hop.current = clock.elapsedTime;
    }
    const age = clock.elapsedTime - hop.current;
    if (group.current)
      group.current.position.y =
        position[1] + (age < 0.5 ? Math.sin(age * Math.PI * 2) * 0.08 : 0);
  });
  return (
    <group
      ref={group}
      position={position}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        pending.current = true;
        useCityStore
          .getState()
          .toast(
            "Explaining the bug to the duck… found it! 🦆",
            "Rubber duck debugging",
          );
      }}
    >
      <mesh position={[0, 0.06, 0]} castShadow>
        <sphereGeometry args={[0.07, 14, 12]} />
        <meshStandardMaterial color="#facc15" />
      </mesh>
      <mesh position={[0.03, 0.14, 0]} castShadow>
        <sphereGeometry args={[0.045, 12, 10]} />
        <meshStandardMaterial color="#facc15" />
      </mesh>
      <mesh position={[0.08, 0.135, 0]} rotation-z={-Math.PI / 2}>
        <coneGeometry args={[0.02, 0.05, 8]} />
        <meshStandardMaterial color="#f97316" />
      </mesh>
    </group>
  );
}

/** A golden bull on a plinth, the market's mascot. Click it for a bull run. */
function Bull({ position }: { position: [number, number, number] }) {
  const gold = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#e0a73a",
        metalness: 0.85,
        roughness: 0.25,
      }),
    [],
  );
  const group = useRef<THREE.Group>(null);
  const charge = useRef(-10);
  useFrame(({ clock }) => {
    const age = clock.elapsedTime - charge.current;
    if (group.current)
      group.current.rotation.x =
        age < 0.6 ? Math.sin(age * Math.PI * 3) * 0.12 : 0;
  });
  const pending = useRef(false);
  useFrame(({ clock }) => {
    if (pending.current) {
      pending.current = false;
      charge.current = clock.elapsedTime;
    }
  });
  return (
    <group position={position}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.75, 0.45, 1.05]} position={[0, 0.45, 0]} />
      </RigidBody>
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.9, 2.1]} />
        <meshStandardMaterial color="#1f2937" roughness={0.4} />
      </mesh>
      <Text
        position={[0, 0.5, 1.06]}
        fontSize={0.14}
        color={accents.gold}
        anchorX="center"
        anchorY="middle"
      >
        BULL MARKET
      </Text>
      <group
        ref={group}
        position={[0, 0.9, 0]}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          pending.current = true;
          emitBurst({
            position: new THREE.Vector3(position[0], 2.2, position[2]),
            kind: "sparkle",
            count: 18,
            colors: [accents.gold, UP],
            spread: 0.8,
          });
          useCityStore
            .getState()
            .toast("Charts up and to the right 📈", "Bull run!");
        }}
      >
        {/* Body, chest and head */}
        <mesh position={[0, 0.62, -0.1]} material={gold} castShadow>
          <capsuleGeometry args={[0.32, 0.9, 6, 14]} />
        </mesh>
        <mesh
          position={[0, 0.68, -0.1]}
          rotation-x={Math.PI / 2}
          material={gold}
          castShadow
        >
          <capsuleGeometry args={[0.34, 0.8, 6, 14]} />
        </mesh>
        <mesh
          position={[0, 0.75, 0.62]}
          rotation-x={0.5}
          material={gold}
          castShadow
        >
          <boxGeometry args={[0.34, 0.32, 0.46]} />
        </mesh>
        {/* Horns */}
        {[-1, 1].map((s) => (
          <mesh
            key={s}
            position={[s * 0.26, 0.98, 0.58]}
            rotation={[0.3, 0, s * -1.1]}
            material={gold}
            castShadow
          >
            <coneGeometry args={[0.05, 0.36, 10]} />
          </mesh>
        ))}
        {/* Legs, braced as if charging */}
        {[
          [-0.2, 0.32, 0.4],
          [0.2, 0.32, -0.4],
          [-0.2, 0.32, -0.55],
          [0.2, 0.32, 0.28],
        ].map(([lx, ly, lz], i) => (
          <mesh
            key={i}
            position={[lx, ly, lz]}
            rotation-x={i < 2 ? 0.35 : -0.35}
            material={gold}
            castShadow
          >
            <cylinderGeometry args={[0.07, 0.06, 0.62, 10]} />
          </mesh>
        ))}
        <mesh position={[0, 0.85, -0.78]} rotation-x={-0.9} material={gold}>
          <cylinderGeometry args={[0.025, 0.02, 0.5, 8]} />
        </mesh>
      </group>
    </group>
  );
}

/** Floating ₿ and Ξ coins over a plinth. Click a coin to flip it. */
function CryptoCoins({ position }: { position: [number, number, number] }) {
  const coins = [
    { symbol: "₿", color: "#f7931a", x: -0.38, h: 1.75 },
    { symbol: "Ξ", color: "#8b9bd8", x: 0.42, h: 1.45 },
  ];
  return (
    <group position={position}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.75, 0.45, 0.75]} position={[0, 0.45, 0]} />
      </RigidBody>
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.8, 0.9, 0.9, 32]} />
        <meshStandardMaterial color="#1f2937" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.91, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.55, 0.72, 40]} />
        <meshStandardMaterial
          color={accents.mint}
          emissive={accents.mint}
          emissiveIntensity={1.2}
          toneMapped={false}
        />
      </mesh>
      {coins.map((c, i) => (
        <Coin key={c.symbol} {...c} phase={i * 1.7} base={position} />
      ))}
    </group>
  );
}

function Coin({
  symbol,
  color,
  x,
  h,
  phase,
  base,
}: {
  symbol: string;
  color: string;
  x: number;
  h: number;
  phase: number;
  base: [number, number, number];
}) {
  const group = useRef<THREE.Group>(null);
  const spin = useRef(0);
  const boost = useRef(0);
  useFrame(({ clock }, delta) => {
    boost.current = Math.max(0, boost.current - delta * 8);
    spin.current += delta * (1.2 + boost.current * 6);
    if (!group.current) return;
    group.current.rotation.y = spin.current;
    group.current.position.y =
      h + Math.sin(clock.elapsedTime * 1.4 + phase) * 0.1;
  });
  return (
    <group
      ref={group}
      position={[x, h, 0]}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        boost.current = 3;
        emitBurst({
          position: new THREE.Vector3(base[0] + x, base[1] + h, base[2]),
          kind: "sparkle",
          count: 12,
          colors: [color, accents.gold],
          spread: 0.5,
        });
      }}
    >
      <mesh rotation-x={Math.PI / 2} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.06, 40]} />
        <meshStandardMaterial color={color} metalness={0.8} roughness={0.25} />
      </mesh>
      {[0, Math.PI].map((r) => (
        <Text
          key={r}
          rotation-y={r}
          position={[0, 0, Math.cos(r) * 0.035]}
          fontSize={0.34}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
        >
          {symbol}
        </Text>
      ))}
    </group>
  );
}

/** Market clocks: New York, London, Beirut and Tokyo, ticking in real time. */
function WorldClocks({ position }: { position: [number, number, number] }) {
  const zones = [
    ["New York", "America/New_York"],
    ["London", "Europe/London"],
    ["Beirut", "Asia/Beirut"],
    ["Tokyo", "Asia/Tokyo"],
  ];
  return (
    <group position={position} rotation-y={Math.PI}>
      {zones.map(([city, zone], i) => (
        <Clock key={city} city={city} zone={zone} x={(i - 1.5) * 1.5} />
      ))}
    </group>
  );
}

function Clock({ city, zone, x }: { city: string; zone: string; x: number }) {
  const hour = useRef<THREE.Group>(null);
  const minute = useRef<THREE.Group>(null);
  const format = useMemo(
    () =>
      new Intl.DateTimeFormat("en-GB", {
        timeZone: zone,
        hour: "numeric",
        minute: "numeric",
        hour12: false,
      }),
    [zone],
  );
  const t = useRef(10);
  useFrame((_, delta) => {
    t.current += delta;
    if (t.current < 1) return;
    t.current = 0;
    const parts = format.formatToParts(new Date());
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    if (hour.current)
      hour.current.rotation.z = -((h % 12) + m / 60) * (Math.PI / 6);
    if (minute.current) minute.current.rotation.z = -m * (Math.PI / 30);
  });
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0, -0.03]}>
        <cylinderGeometry args={[0.52, 0.52, 0.05, 40]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position={[0, 0, 0]}>
        <cylinderGeometry args={[0.46, 0.46, 0.02, 40]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
      {Array.from({ length: 12 }, (_, k) => (
        <mesh
          key={k}
          position={[
            Math.sin((k * Math.PI) / 6) * 0.38,
            Math.cos((k * Math.PI) / 6) * 0.38,
            0.015,
          ]}
        >
          <boxGeometry args={[0.025, 0.025, 0.01]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
      ))}
      <group ref={hour} position={[0, 0, 0.02]}>
        <mesh position={[0, 0.11, 0]}>
          <boxGeometry args={[0.035, 0.22, 0.01]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
      </group>
      <group ref={minute} position={[0, 0, 0.03]}>
        <mesh position={[0, 0.16, 0]}>
          <boxGeometry args={[0.022, 0.32, 0.01]} />
          <meshStandardMaterial color={accents.goldDeep} />
        </mesh>
      </group>
      <Text
        position={[0, -0.7, 0]}
        fontSize={0.16}
        color="#1a103d"
        anchorX="center"
      >
        {city}
      </Text>
    </group>
  );
}

/** Two server racks with blinking status lights. */
function ServerRacks({ position }: { position: [number, number, number] }) {
  const leds = useMemo(
    () =>
      Array.from(
        { length: 24 },
        (_, i) =>
          new THREE.MeshBasicMaterial({
            color: i % 5 === 0 ? accents.gold : i % 3 === 0 ? "#60a5fa" : UP,
            toneMapped: false,
          }),
      ),
    [],
  );
  useFrame(({ clock }) => {
    leds.forEach(
      (m, i) =>
        (m.visible =
          Math.sin(clock.elapsedTime * (2 + (i % 7)) + i * 1.3) > -0.3),
    );
  });
  return (
    <group position={position}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.1, 1, 0.5]} position={[0, 1, 0]} />
      </RigidBody>
      {[-0.55, 0.55].map((rx, r) => (
        <group key={rx} position={[rx, 0, 0]}>
          <mesh position={[0, 1, 0]} castShadow receiveShadow>
            <boxGeometry args={[1, 2, 0.95]} />
            <meshStandardMaterial
              color="#0f172a"
              metalness={0.5}
              roughness={0.4}
            />
          </mesh>
          {Array.from({ length: 8 }, (_, u) => (
            <group key={u} position={[0, 0.35 + u * 0.21, 0.48]}>
              <mesh>
                <planeGeometry args={[0.86, 0.16]} />
                <meshStandardMaterial color="#1e293b" />
              </mesh>
              {[0, 1, 2].map((k) => (
                <mesh
                  key={k}
                  position={[0.28 + k * 0.05, 0, 0.005]}
                  material={leds[(r * 12 + u * 3 + k) % leds.length]}
                >
                  <planeGeometry args={[0.025, 0.025]} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

/** The team's coffee bar: counter, espresso machine and mugs. */
function CoffeeBar({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.3, 0.48, 0.4]} position={[0, 0.48, 0]} />
      </RigidBody>
      <mesh position={[0, 0.47, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.6, 0.94, 0.8]} />
        <meshStandardMaterial color="#5b4a8a" />
      </mesh>
      <mesh position={[0, 0.96, 0]}>
        <boxGeometry args={[2.7, 0.05, 0.86]} />
        <meshStandardMaterial color="#f5f0ff" roughness={0.3} />
      </mesh>
      {/* Espresso machine */}
      <group position={[-0.6, 0.99, -0.05]}>
        <mesh position={[0, 0.25, 0]} castShadow>
          <boxGeometry args={[0.6, 0.5, 0.45]} />
          <meshStandardMaterial
            color="#9ca3af"
            metalness={0.8}
            roughness={0.25}
          />
        </mesh>
        <mesh position={[0, 0.2, 0.24]}>
          <boxGeometry args={[0.3, 0.06, 0.08]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
        <mesh position={[0.18, 0.4, 0.23]}>
          <circleGeometry args={[0.04, 16]} />
          <meshBasicMaterial color={UP} toneMapped={false} />
        </mesh>
      </group>
      {[0.2, 0.45, 0.7, 0.95].map((mx, i) => (
        <mesh key={mx} position={[mx, 1.05, 0.1]} castShadow>
          <cylinderGeometry args={[0.05, 0.045, 0.1, 14]} />
          <meshStandardMaterial
            color={[accents.mint, "#a78bfa", accents.gold, "#f472b6"][i]}
          />
        </mesh>
      ))}
      <Text
        position={[0, 2.0, -0.35]}
        fontSize={0.2}
        color="#1a103d"
        anchorX="center"
      >
        {"while (awake) coffee++"}
      </Text>
    </group>
  );
}

/** The whiteboard by reception: the payments architecture the team builds. */
function Whiteboard({ position }: { position: [number, number, number] }) {
  const boxes: [string, number, number, string][] = [
    ["Client portal", -1.4, 0.55, "#7c3aed"],
    ["CRM", 0, 0.55, "#0f766e"],
    ["MT4 / MT5", 1.4, 0.55, "#d69e2e"],
    ["Payments API", 0, -0.05, "#d53f8c"],
    ["25+ PSPs", -1.4, -0.6, "#4c51bf"],
    ["KYC: Sumsub", 0, -0.6, "#14b8a6"],
    ["Stripe · Binance", 1.4, -0.6, "#4c51bf"],
  ];
  return (
    <group position={position} rotation-y={Math.PI}>
      <mesh position={[0, 0, -0.03]}>
        <boxGeometry args={[4.3, 2.1, 0.05]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh>
        <planeGeometry args={[4.1, 1.9]} />
        <meshStandardMaterial color="#ffffff" roughness={0.2} />
      </mesh>
      {boxes.map(([label, bx, by, color]) => (
        <group key={label} position={[bx, by, 0.01]}>
          <mesh>
            <planeGeometry args={[1.15, 0.36]} />
            <meshBasicMaterial color={color} />
          </mesh>
          <Text
            position={[0, 0, 0.005]}
            fontSize={0.12}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
          >
            {label}
          </Text>
        </group>
      ))}
      {/* Arrows: everything goes through the payments API */}
      {[
        [-0.7, 0.25, 0.6],
        [0, 0.25, 0],
        [0.7, 0.25, -0.6],
        [-0.7, -0.33, -0.6],
        [0, -0.33, 0],
        [0.7, -0.33, 0.6],
      ].map(([ax, ay, rot], i) => (
        <mesh key={i} position={[ax, ay, 0.008]} rotation-z={rot}>
          <planeGeometry args={[0.03, 0.32]} />
          <meshBasicMaterial color="#1a103d" />
        </mesh>
      ))}
      <Text
        position={[-1.95, 0.88, 0.01]}
        fontSize={0.11}
        color="#1a103d"
        anchorX="left"
      >
        System design · Q3
      </Text>
    </group>
  );
}

/** A neon "</>" on the wall. */
function NeonCode({ position }: { position: [number, number, number] }) {
  const glow = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#c084fc", toneMapped: false }),
    [],
  );
  useFrame(({ clock }) => {
    glow.color.setHSL(0.78, 0.9, 0.62 + Math.sin(clock.elapsedTime * 2) * 0.06);
  });
  return (
    <group position={position} rotation-y={Math.PI}>
      <Text fontSize={0.9} material={glow} anchorX="center" anchorY="middle">
        {"</>"}
      </Text>
      <Text
        position={[0, -0.7, 0]}
        fontSize={0.2}
        color="#1a103d"
        anchorX="center"
      >
        Sahme Engineering
      </Text>
    </group>
  );
}

/** Beanbags around a low table with a laptop and the classic books. */
function DevLounge() {
  const seats = useMemo<Seat[]>(
    () => [
      { id: "beanbag-1", x: -10.4, y: -0.2, z: -3.6, facing: Math.PI / 2 },
      { id: "beanbag-2", x: -10.4, y: -0.2, z: 0.8, facing: Math.PI / 2 },
    ],
    [],
  );
  const laptop = useDeskScreen("code", 4);
  return (
    <group>
      <mesh
        rotation-x={-Math.PI / 2}
        position={[-10, 0.01, -1.4]}
        receiveShadow
      >
        <circleGeometry args={[2.6, 40]} />
        <meshStandardMaterial color="#0f766e" roughness={1} />
      </mesh>
      {seats.map((s, i) => (
        <mesh
          key={s.id}
          position={[s.x - 0.1, 0.28, s.z]}
          scale={[1, 0.6, 1]}
          castShadow
        >
          <sphereGeometry args={[0.55, 20, 16]} />
          <meshStandardMaterial
            color={i ? accents.gold : "#7c3aed"}
            roughness={0.95}
          />
        </mesh>
      ))}
      <Seats seats={seats} />
      <group position={[-10.2, 0, -1.4]}>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.5, 0.2, 0.5]} position={[0, 0.2, 0]} />
        </RigidBody>
        <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.55, 0.55, 0.4, 28]} />
          <meshStandardMaterial color="#e9dcc6" />
        </mesh>
        {/* Laptop */}
        <mesh position={[0.05, 0.415, 0.05]}>
          <boxGeometry args={[0.42, 0.02, 0.3]} />
          <meshStandardMaterial color="#9ca3af" metalness={0.7} />
        </mesh>
        <group position={[0.05, 0.55, -0.1]} rotation-x={-0.25}>
          <mesh>
            <boxGeometry args={[0.42, 0.28, 0.015]} />
            <meshStandardMaterial color="#9ca3af" metalness={0.7} />
          </mesh>
          <mesh position={[0, 0, 0.009]}>
            <planeGeometry args={[0.39, 0.25]} />
            <meshBasicMaterial map={laptop} toneMapped={false} />
          </mesh>
        </group>
        {/* Books */}
        {[
          ["#7c3aed", 0.06],
          ["#d69e2e", 0.1],
          ["#0f766e", 0.14],
        ].map(([color, y], i) => (
          <mesh
            key={i}
            position={[-0.28, 0.4 + (y as number), 0.15]}
            rotation-y={i * 0.25}
          >
            <boxGeometry args={[0.26, 0.04, 0.19]} />
            <meshStandardMaterial color={color as string} />
          </mesh>
        ))}
        <RubberDuck position={[0.32, 0.4, 0.25]} />
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// The floor
// ---------------------------------------------------------------------------

/** Everything that makes Sahme Trading's office a trading floor. Wall pieces come through `wall`. */
export function TradingFloor({
  wall,
}: {
  wall: (
    side: "front" | "back" | "left" | "right",
    node: React.ReactNode,
  ) => React.ReactNode;
}) {
  return (
    <group>
      {wall(
        "back",
        <>
          <LiveChart
            position={[-9.4, 3.35, -D / 2 + 0.06]}
            label="EUR/USD"
            start={1.084}
            vol={0.0012}
            digits={4}
          />
          <LiveChart
            position={[9.4, 3.35, -D / 2 + 0.06]}
            label="BTC/USD"
            start={67400}
            vol={180}
            digits={0}
          />
          <Ticker position={[0, 1.15, -D / 2 + 0.05]} length={13.6} />
        </>,
      )}
      {wall(
        "front",
        <>
          <Ticker
            position={[0, 4.3, D / 2 - 0.05]}
            rotationY={Math.PI}
            length={9}
          />
          <Whiteboard position={[-7, 2.45, D / 2 - 0.05]} />
          <WorldClocks position={[6.6, 3.55, D / 2 - 0.05]} />
          <NeonCode position={[6.6, 1.85, D / 2 - 0.05]} />
        </>,
      )}
      <ServerRacks position={[9.6, 0, -D / 2 + 0.75]} />
      <CoffeeBar position={[-9.3, 0, -D / 2 + 0.6]} />
      <Bull position={[-3.6, 0, 5.4]} />
      <CryptoCoins position={[3.6, 0, 5.4]} />
      <DevLounge />
      <SlotMachine position={[10.3, 0, 5.2]} rotationY={-Math.PI / 2} />
    </group>
  );
}
