"use client";

import { Text } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Experience } from "@/content/schema";
import { useCityStore, type Seat } from "@/state/useCityStore";
import { HQ_ROOM } from "@/world/interiors";
import { accents } from "@/world/palette";
import { sfx } from "@/world/sfx";
import {
  Batch,
  BeanBag,
  Block,
  Bookcase,
  Credenza,
  DeptSign,
  ExecChair,
  FilingCabinet,
  FloorLamp,
  GlassWall,
  Globe,
  Nameplate,
  Painting,
  Pendant,
  Rug,
  SeatedPerson,
  SideChair,
  Sofa,
  sofaSeats,
  Table,
  TallPlant,
  Workstation,
  workSeat,
  type Leather,
} from "./Furniture";
import { Board, OnWall, Plaque, TechTiles } from "./InteriorScene";
import { finishes } from "./luxury";
import { emitBurst } from "./Particles";
import { makeWalkers, Pedestrians } from "./Pedestrians";
import { SlotMachine } from "./SlotMachine";
import { Seats } from "./StreetDetails";
import {
  Bull,
  canvasTexture,
  CoffeeBar,
  CryptoCoins,
  drawChart,
  drawCode,
  LiveChart,
  NeonCode,
  rng,
  RubberDuck,
  ServerRacks,
  Ticker,
  walk,
  WorldClocks,
  Whiteboard,
} from "./TradingFloor";

/**
 * Sahme Trading's headquarters floor (44 × 32 m): a lobby with reception and a
 * waiting lounge, a trading floor under a hanging market screen, and eight glass-walled
 * departments around it: Marketing, Sales, Operations and Risk Management along the
 * back; Accounting and HR on the left; Software Engineering (Wouroud's team) and
 * Financial Counseling on the right. Furniture is real-size (see Furniture.tsx), so
 * the people sitting in it fit; some desks are taken by coworkers.
 */

const W = HQ_ROOM.width;
const D = HQ_ROOM.depth;
const H = HQ_ROOM.height;
const GOLD = "#e6c27a";

// ---------------------------------------------------------------------------
// Screens drawn on canvases
// ---------------------------------------------------------------------------

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

function makeScreen(w: number, h: number, draw: Draw) {
  const { ctx, texture } = canvasTexture(w, h);
  draw(ctx, w, h);
  texture.needsUpdate = true;
  return texture;
}

const font = (px: number, weight = "") => `${weight} ${Math.round(px)}px "Segoe UI", Helvetica, Arial, sans-serif`;

function header(ctx: CanvasRenderingContext2D, w: number, h: number, title: string, bg = "#0b1020") {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(0, 0, w, h * 0.12);
  ctx.fillStyle = GOLD;
  ctx.font = font(h * 0.065, "bold");
  ctx.fillText(title, w * 0.03, h * 0.085);
}

const drawCampaign: Draw = (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#0b1020");
  g.addColorStop(1, "#3b1d6e");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#22c55e";
  ctx.lineWidth = h * 0.012;
  ctx.beginPath();
  for (let i = 0; i <= 20; i++) {
    const x = w * 0.45 + (i / 20) * w * 0.5;
    const y = h * 0.8 - (i / 20) * h * 0.45 + Math.sin(i * 1.7) * h * 0.05;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.font = font(h * 0.11, "bold");
  ctx.fillText("Trade the", w * 0.06, h * 0.3);
  ctx.fillText("world's markets", w * 0.06, h * 0.43);
  ctx.fillStyle = "#e2e8f0";
  ctx.font = font(h * 0.06);
  ctx.fillText("Forex · Crypto · CFDs · Gold", w * 0.06, h * 0.56);
  ctx.fillStyle = "#7c3aed";
  ctx.fillRect(w * 0.06, h * 0.68, w * 0.3, h * 0.13);
  ctx.fillStyle = "#fff";
  ctx.font = font(h * 0.055, "bold");
  ctx.fillText("Open an account", w * 0.08, h * 0.765);
};

const drawAnalytics: Draw = (ctx, w, h) => {
  header(ctx, w, h, "Campaign analytics · Q4", "#f8f6f1");
  const kpis: [string, string, string][] = [
    ["Leads", "1,284", "▲ 12%"],
    ["CTR", "3.8%", "▲ 0.6"],
    ["Cost / lead", "$24", "▼ 8%"],
    ["New accounts", "312", "▲ 21%"],
  ];
  kpis.forEach(([k, v, d], i) => {
    const x = w * 0.03 + i * w * 0.24;
    ctx.fillStyle = "#fff";
    ctx.fillRect(x, h * 0.17, w * 0.22, h * 0.22);
    ctx.fillStyle = "#64748b";
    ctx.font = font(h * 0.045);
    ctx.fillText(k, x + w * 0.015, h * 0.24);
    ctx.fillStyle = "#1a103d";
    ctx.font = font(h * 0.08, "bold");
    ctx.fillText(v, x + w * 0.015, h * 0.33);
    ctx.fillStyle = d.startsWith("▲") || k === "Cost / lead" ? "#16a34a" : "#dc2626";
    ctx.font = font(h * 0.04, "bold");
    ctx.fillText(d, x + w * 0.15, h * 0.24);
  });
  const random = rng(5);
  for (let i = 0; i < 12; i++) {
    const bh = h * (0.12 + random() * 0.38);
    ctx.fillStyle = i % 2 ? "#7c3aed" : "#c9a45a";
    ctx.fillRect(w * 0.05 + i * w * 0.075, h * 0.92 - bh, w * 0.05, bh);
  }
};

const drawLeaderboard: Draw = (ctx, w, h) => {
  header(ctx, w, h, "SALES LEADERBOARD · THIS MONTH", "#0d1326");
  const rows: [string, number][] = [
    ["Lina K.", 0.94],
    ["Omar H.", 0.81],
    ["Maya S.", 0.77],
    ["Karim D.", 0.63],
    ["Nour A.", 0.52],
  ];
  rows.forEach(([name, v], i) => {
    const y = h * 0.2 + i * h * 0.12;
    ctx.fillStyle = i === 0 ? GOLD : "#e2e8f0";
    ctx.font = font(h * 0.055, "bold");
    ctx.fillText(`${i + 1}. ${name}`, w * 0.04, y + h * 0.06);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(w * 0.32, y + h * 0.015, w * 0.5, h * 0.06);
    ctx.fillStyle = i === 0 ? GOLD : "#22c55e";
    ctx.fillRect(w * 0.32, y + h * 0.015, w * 0.5 * v, h * 0.06);
    ctx.fillStyle = "#e2e8f0";
    ctx.font = font(h * 0.045);
    ctx.fillText(`$${Math.round(v * 480)}k`, w * 0.85, y + h * 0.06);
  });
  ctx.fillStyle = "#94a3b8";
  ctx.font = font(h * 0.045);
  ctx.fillText("Team target  $2.4M", w * 0.04, h * 0.88);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(w * 0.32, h * 0.85, w * 0.6, h * 0.05);
  ctx.fillStyle = "#7c3aed";
  ctx.fillRect(w * 0.32, h * 0.85, w * 0.6 * 0.78, h * 0.05);
};

const drawCrm: Draw = (ctx, w, h) => {
  header(ctx, w, h, "CRM · Clients", "#f8f6f1");
  const names = ["A. Haddad", "R. Saleh", "J. Martin", "N. Khoury", "S. Rahme", "L. Chen", "M. Aziz"];
  const status = ["Funded", "KYC ✓", "Call back", "Funded", "New lead", "KYC ✓", "Funded"];
  names.forEach((n, i) => {
    const y = h * 0.2 + i * h * 0.11;
    ctx.fillStyle = i % 2 ? "#fff" : "#f1ede4";
    ctx.fillRect(0, y - h * 0.065, w, h * 0.11);
    ctx.fillStyle = "#1a103d";
    ctx.font = font(h * 0.05);
    ctx.fillText(n, w * 0.04, y);
    ctx.fillStyle = status[i] === "Funded" ? "#16a34a" : status[i] === "Call back" ? "#d97706" : "#7c3aed";
    ctx.fillText(status[i], w * 0.48, y);
    ctx.fillStyle = "#64748b";
    ctx.fillText(`$${(i * 3.7 + 2.1).toFixed(1)}k`, w * 0.78, y);
  });
};

const drawOps: Draw = (ctx, w, h) => {
  header(ctx, w, h, "OPERATIONS · LIVE", "#0d1326");
  const tiles: [string, string, string][] = [
    ["Deposits today", "$1.24M", "#22c55e"],
    ["Withdrawals pending", "37", "#f59e0b"],
    ["KYC queue", "12", "#a78bfa"],
    ["Avg. approval", "4m 12s", "#38bdf8"],
  ];
  tiles.forEach(([k, v, c], i) => {
    const x = w * 0.03 + (i % 2) * w * 0.48;
    const y = h * 0.16 + Math.floor(i / 2) * h * 0.25;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(x, y, w * 0.46, h * 0.22);
    ctx.fillStyle = "#94a3b8";
    ctx.font = font(h * 0.045);
    ctx.fillText(k, x + w * 0.02, y + h * 0.07);
    ctx.fillStyle = c;
    ctx.font = font(h * 0.1, "bold");
    ctx.fillText(v, x + w * 0.02, y + h * 0.18);
  });
  ctx.fillStyle = "#94a3b8";
  ctx.font = font(h * 0.04);
  ctx.fillText("Payment providers", w * 0.03, h * 0.73);
  for (let i = 0; i < 25; i++) {
    ctx.fillStyle = i === 7 || i === 18 ? "#f59e0b" : "#22c55e";
    ctx.beginPath();
    ctx.arc(w * 0.05 + (i % 13) * w * 0.07, h * 0.8 + Math.floor(i / 13) * h * 0.09, h * 0.025, 0, Math.PI * 2);
    ctx.fill();
  }
};

const drawLedger: Draw = (ctx, w, h) => {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#166534";
  ctx.fillRect(0, 0, w, h * 0.1);
  ctx.fillStyle = "#fff";
  ctx.font = font(h * 0.055, "bold");
  ctx.fillText("General ledger · October", w * 0.03, h * 0.07);
  ctx.strokeStyle = "#d1d5db";
  ctx.lineWidth = 1;
  for (let r = 0; r < 10; r++) {
    const y = h * 0.1 + r * h * 0.09;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    ctx.fillStyle = "#374151";
    ctx.font = font(h * 0.042);
    if (r > 0) {
      ctx.fillText(["Client deposits", "PSP fees", "Payroll", "Rent", "Software", "Marketing", "Commissions", "Tax reserve", "Net"][r - 1], w * 0.03, y - h * 0.025);
      ctx.fillStyle = r === 9 ? "#166534" : "#111827";
      ctx.fillText(`${((r * 7919) % 900) + 100},${String((r * 131) % 1000).padStart(3, "0")}`, w * 0.66, y - h * 0.025);
    }
  }
  for (const x of [0.6, 0.85]) {
    ctx.beginPath();
    ctx.moveTo(w * x, h * 0.1);
    ctx.lineTo(w * x, h);
    ctx.stroke();
  }
};

const drawRisk: Draw = (ctx, w, h) => {
  header(ctx, w, h, "RISK · NET EXPOSURE", "#0d1326");
  const pairs = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "BTCUSD", "ETHUSD", "US30", "NAS100", "OIL", "SOLUSD", "AUDUSD", "USDCAD"];
  const random = rng(17);
  pairs.forEach((p, i) => {
    const x = w * 0.03 + (i % 4) * w * 0.24;
    const y = h * 0.16 + Math.floor(i / 4) * h * 0.22;
    const v = random() * 2 - 1;
    ctx.fillStyle = v > 0 ? `rgba(34,197,94,${0.25 + v * 0.6})` : `rgba(239,68,68,${0.25 - v * 0.6})`;
    ctx.fillRect(x, y, w * 0.22, h * 0.19);
    ctx.fillStyle = "#fff";
    ctx.font = font(h * 0.05, "bold");
    ctx.fillText(p, x + w * 0.015, y + h * 0.08);
    ctx.font = font(h * 0.045);
    ctx.fillText(`${v > 0 ? "+" : ""}${(v * 3.2).toFixed(2)}M`, x + w * 0.015, y + h * 0.15);
  });
  ctx.fillStyle = GOLD;
  ctx.font = font(h * 0.055, "bold");
  ctx.fillText("VaR 95% (1d): $182,400   ·   Margin level 412%", w * 0.03, h * 0.93);
};

const drawWorld: Draw = (ctx, w, h) => {
  ctx.fillStyle = "#08111f";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#1e3a5f";
  const blobs = [
    [0.2, 0.32, 0.12, 0.13],
    [0.27, 0.68, 0.06, 0.15],
    [0.5, 0.3, 0.07, 0.08],
    [0.52, 0.6, 0.07, 0.16],
    [0.72, 0.35, 0.16, 0.12],
    [0.84, 0.74, 0.06, 0.05],
  ];
  for (const [x, y, rx, ry] of blobs) {
    ctx.beginPath();
    ctx.ellipse(x * w, y * h, rx * w, ry * h, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  const hubs = [
    [0.22, 0.33, "#22c55e"],
    [0.48, 0.28, "#22c55e"],
    [0.57, 0.4, GOLD],
    [0.78, 0.36, "#ef4444"],
    [0.6, 0.62, "#22c55e"],
    [0.84, 0.72, "#f59e0b"],
  ] as const;
  for (const [x, y, c] of hubs) {
    ctx.fillStyle = c;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(x * w, y * h, h * 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(x * w, y * h, h * 0.015, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = GOLD;
  ctx.font = font(h * 0.06, "bold");
  ctx.fillText("Client exposure by region", w * 0.03, h * 0.94);
};

/** Every desk and wall screen in the HQ, drawn once. */
function useScreens() {
  return useMemo(() => {
    const chart = (seed: number, label: string) =>
      makeScreen(512, 300, (ctx) => drawChart(ctx, walk(36, 100 + seed * 7, 3, rng(seed + 1)), label, 2));
    const code = (offset: number) => makeScreen(512, 300, (ctx) => drawCode(ctx, offset));
    return {
      charts: ["BTC/USD", "EUR/USD", "XAU/USD", "ETH/USD", "US30", "GBP/JPY"].map((l, i) => chart(i * 3 + 2, l)),
      code: [0, 3, 6].map(code),
      campaign: makeScreen(640, 400, drawCampaign),
      analytics: makeScreen(640, 400, drawAnalytics),
      crm: makeScreen(512, 300, drawCrm),
      ops: makeScreen(512, 300, drawOps),
      ledger: makeScreen(512, 300, drawLedger),
      risk: makeScreen(512, 300, drawRisk),
      leaderboard: makeScreen(1024, 560, drawLeaderboard),
      opsWall: makeScreen(1024, 560, drawOps),
      riskWall: makeScreen(1024, 560, drawRisk),
      world: makeScreen(1024, 520, drawWorld),
      analyticsWall: makeScreen(1024, 560, drawAnalytics),
    };
  }, []);
}
type Screens = ReturnType<typeof useScreens>;

/** A wall-mounted screen with a slim black bezel. Faces +z. */
function WallScreen({ position, rotationY = 0, width, height, map }: { position: [number, number, number]; rotationY?: number; width: number; height: number; map: THREE.Texture }) {
  const f = finishes();
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh position={[0, 0, -0.03]} material={f.blackMetal}>
        <boxGeometry args={[width + 0.08, height + 0.08, 0.05]} />
      </mesh>
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={map} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

type DeskSpec = {
  id: string;
  x: number;
  z: number;
  facing: number;
  screens: (keyof Screens | `chart${number}` | `code${number}`)[];
  extras?: Parameters<typeof Workstation>[0]["extras"];
  leather?: Leather;
  width?: number;
  /** A coworker sitting here (a Rocketbox avatar id). */
  who?: string;
  duck?: boolean;
};

const S = Math.PI; // facing −z
const N = 0; // facing +z
const E = Math.PI / 2; // facing +x
const Wd = -Math.PI / 2; // facing −x

const DESKS: DeskSpec[] = [
  // Trading floor: two rows of triple-screen desks facing the market screen
  ...[-6.5, -3.9, -1.3, 1.3, 3.9, 6.5].flatMap((x, i) => [
    { id: `trade-a${i}`, x, z: -3.6, facing: S, screens: [`chart${i}`, `code${i % 3}`, `chart${(i + 2) % 6}`], width: 1.9, who: i === 2 ? "Male_Adult_01" : undefined } as DeskSpec,
    { id: `trade-b${i}`, x, z: 1.4, facing: S, screens: [`chart${(i + 3) % 6}`, `chart${(i + 1) % 6}`, `code${(i + 1) % 3}`], width: 1.9, who: i === 3 ? "Female_Adult_15" : undefined } as DeskSpec,
  ]),
  // Marketing: iMac-style screens with campaigns, facing the windows and the glass
  { id: "mkt-1", x: -20, z: -13.4, facing: Wd, screens: ["campaign", "analytics"], extras: ["papers", "mug"], leather: "cream", who: "Female_Adult_06" },
  { id: "mkt-2", x: -20, z: -10.2, facing: Wd, screens: ["campaign"], extras: ["plant", "papers"], leather: "cream" },
  { id: "mkt-3", x: -13, z: -13.4, facing: E, screens: ["analytics"], extras: ["mug", "plant"], leather: "cream" },
  { id: "mkt-4", x: -13, z: -10.2, facing: E, screens: ["campaign", "analytics"], extras: ["papers"], leather: "cream" },
  // Sales: headsets, phones and the CRM
  { id: "sales-1", x: -8.2, z: -12.6, facing: S, screens: ["crm", "chart1"], extras: ["phone", "headset", "mug"] },
  { id: "sales-2", x: -2.8, z: -12.6, facing: S, screens: ["crm", "chart0"], extras: ["phone", "headset"], who: "Male_Adult_07" },
  { id: "sales-3", x: -2.8, z: -9.6, facing: S, screens: ["crm"], extras: ["phone", "headset", "papers"] },
  // Operations
  { id: "ops-1", x: 2.8, z: -12.6, facing: S, screens: ["ops", "ledger"], extras: ["papers"], who: "Female_Adult_04" },
  { id: "ops-2", x: 8.2, z: -12.6, facing: S, screens: ["ops", "crm"], extras: ["mug"] },
  { id: "ops-3", x: 2.8, z: -9.6, facing: S, screens: ["ops"], extras: ["phone", "papers"] },
  { id: "ops-4", x: 8.2, z: -9.6, facing: S, screens: ["crm", "ops"], extras: ["plant"] },
  // Risk management
  { id: "risk-1", x: 13.8, z: -12.6, facing: S, screens: ["risk", "chart2", "chart4"], width: 1.9, extras: ["calculator"] },
  { id: "risk-2", x: 19.2, z: -12.6, facing: S, screens: ["chart5", "risk", "chart3"], width: 1.9, who: "Male_Adult_10" },
  { id: "risk-3", x: 19.2, z: -9.6, facing: S, screens: ["risk", "chart1"], extras: ["papers", "mug"] },
  // Accounting: facing the windows
  { id: "acc-1", x: -19.6, z: -4.4, facing: Wd, screens: ["ledger", "chart1"], extras: ["calculator", "papers"], leather: "oxblood", who: "Female_Adult_17" },
  { id: "acc-2", x: -19.6, z: 1.6, facing: Wd, screens: ["ledger"], extras: ["calculator", "lamp", "mug"], leather: "oxblood" },
  { id: "acc-3", x: -15.6, z: 3.1, facing: S, screens: ["ledger", "ops"], extras: ["papers", "plant"], leather: "oxblood" },
  // HR: the manager's desk
  { id: "hr-1", x: -15.4, z: 14.7, facing: S, screens: [], extras: ["laptop", "lamp", "papers", "plant"], leather: "cognac" },
  // Software Engineering: Wouroud's team, facing the windows
  { id: "dev-1", x: 18.6, z: -4.6, facing: E, screens: ["code0", "code1", "chart0"], width: 1.9, leather: "black", duck: true },
  { id: "dev-2", x: 15.4, z: -4.6, facing: E, screens: ["code2", "code0"], width: 1.9, extras: ["mug"] },
  { id: "dev-3", x: 15.4, z: -1.6, facing: E, screens: ["code1", "code2"], width: 1.9, who: "Male_Adult_19" },
  { id: "dev-4", x: 18.6, z: -1.6, facing: E, screens: ["code0", "chart3", "code2"], width: 1.9, extras: ["plant"] },
  // Financial counseling: a partner's desk facing the clients
  { id: "fc-1", x: 20.7, z: 11.0, facing: Wd, screens: [], extras: ["laptop", "lamp", "papers"], leather: "cognac", width: 2, who: "Male_Adult_16" },
];

/** Meeting / guest chairs: [id, x, z, facing, leather, who?] */
const CHAIRS: [string, number, number, number, Leather, string?][] = [
  // Marketing round table
  ["mkt-t1", -16.5, -13.65, N, "cream"],
  ["mkt-t2", -17.25, -12.35, Math.atan2(0.75, -0.45), "cream"],
  ["mkt-t3", -15.75, -12.35, Math.atan2(-0.75, -0.45), "cream"],
  // Sales meeting table
  ["sales-t1", -8.2, -10.6, N, "black"],
  ["sales-t2", -8.95, -9.35, Math.atan2(0.75, -0.45), "black"],
  ["sales-t3", -7.45, -9.35, Math.atan2(-0.75, -0.45), "black"],
  // HR interview table
  ["hr-t1", -18.65, 6.85, N, "cognac", "Female_Adult_02"],
  ["hr-t2", -17.75, 6.85, N, "cognac"],
  ["hr-t3", -18.65, 8.35, S, "cognac"],
  ["hr-t4", -17.75, 8.35, S, "cognac"],
  // Financial counseling: two clients across the desk
  ["fc-c1", 18.75, 10.45, E, "cognac"],
  ["fc-c2", 18.75, 11.55, E, "cognac"],
];

/** Sofas and armchairs: [id, x, z, facing, length, leather] */
const SOFAS: [string, number, number, number, number, Leather][] = [
  ["lobby-sofa", -8, 15.45, S, 2.4, "cognac"],
  ["lobby-arm-l", -10.25, 13.4, E, 0.95, "black"],
  ["lobby-arm-r", -5.75, 13.4, Wd, 0.95, "black"],
  ["hr-sofa", -21.45, 11.5, E, 2.2, "emerald"],
  ["hr-arm-1", -18.8, 10.7, Wd, 0.95, "blush"],
  ["hr-arm-2", -18.8, 12.3, Wd, 0.95, "blush"],
  ["fc-sofa", 17, 15.45, S, 2.4, "oxblood"],
];

// ---------------------------------------------------------------------------
// Interactive pieces
// ---------------------------------------------------------------------------

/** The sales gong: strike it when a deal closes. */
function Gong({ position, rotationY = 0 }: { position: [number, number, number]; rotationY?: number }) {
  const f = finishes();
  const disc = useRef<THREE.Group>(null);
  const hit = useRef(-10);
  const pending = useRef(false);
  useFrame(({ clock }) => {
    if (pending.current) {
      pending.current = false;
      hit.current = clock.elapsedTime;
    }
    const age = clock.elapsedTime - hit.current;
    if (disc.current) disc.current.rotation.x = age < 3 ? Math.sin(age * 9) * 0.18 * Math.exp(-age * 1.5) : 0;
  });
  return (
    <group position={position} rotation-y={rotationY}>
      {[-0.62, 0.62].map((x) => (
        <mesh key={x} position={[x, 0.85, 0]} material={f.walnutDark} castShadow>
          <boxGeometry args={[0.07, 1.7, 0.07]} />
        </mesh>
      ))}
      <mesh position={[0, 1.68, 0]} material={f.walnutDark}>
        <boxGeometry args={[1.4, 0.08, 0.08]} />
      </mesh>
      {[-0.62, 0.62].map((x) => (
        <mesh key={`f${x}`} position={[x, 0.03, 0]} material={f.walnutDark}>
          <boxGeometry args={[0.1, 0.06, 0.5]} />
        </mesh>
      ))}
      <group ref={disc} position={[0, 1.62, 0]}>
        <mesh
          position={[0, -0.62, 0]}
          rotation-x={Math.PI / 2}
          castShadow
          userData={{ live: true }}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            pending.current = true;
            sfx.gong();
            emitBurst({ position: new THREE.Vector3(position[0], 1.2, position[2]), kind: "sparkle", count: 20, colors: [accents.gold, "#22c55e"], spread: 0.9 });
            useCityStore.getState().toast("Another client funded their account 🎉", "Deal closed!");
          }}
        >
          <cylinderGeometry args={[0.5, 0.5, 0.03, 40]} />
          <meshStandardMaterial color="#c08a3a" metalness={0.9} roughness={0.3} />
        </mesh>
        <mesh position={[0, -0.62, 0.02]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.2, 0.012, 6, 30]} />
          <meshStandardMaterial color="#8f6f35" metalness={0.8} roughness={0.35} />
        </mesh>
        {[-0.3, 0.3].map((x) => (
          <mesh key={x} position={[x, -0.06, 0]} rotation-z={x > 0 ? -0.5 : 0.5} material={f.brassDark}>
            <cylinderGeometry args={[0.006, 0.006, 0.2, 4]} />
          </mesh>
        ))}
      </group>
      <Block position={[0, 0.85, 0]} size={[1.4, 1.7, 0.5]} />
    </group>
  );
}

/** Accounting's vault: click the dial, it spins and the door swings open on gold bars. */
function Vault({ position, rotationY = 0 }: { position: [number, number, number]; rotationY?: number }) {
  const f = finishes();
  const door = useRef<THREE.Group>(null);
  const dial = useRef<THREE.Mesh>(null);
  const state = useRef({ open: false, t: 0 });
  useFrame((_, delta) => {
    const s = state.current;
    s.t = Math.min(1, s.t + delta * 0.8);
    if (dial.current && s.t < 0.5) dial.current.rotation.z += delta * 14;
    if (door.current) {
      const target = s.open ? -1.9 : 0;
      door.current.rotation.y = THREE.MathUtils.damp(door.current.rotation.y, s.t < 0.5 ? door.current.rotation.y : target, 3, delta);
    }
  });
  const steel = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2a2d33", metalness: 0.8, roughness: 0.35 }), []);
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh position={[0, 0.65, 0]} material={steel} castShadow receiveShadow>
        <boxGeometry args={[0.9, 1.3, 0.8]} />
      </mesh>
      {/* Gold bars inside */}
      {[0, 1, 2].map((k) => (
        <mesh key={k} position={[-0.15 + k * 0.15, 0.5 + (k === 1 ? 0.06 : 0), 0.15]} material={f.brass}>
          <boxGeometry args={[0.13, 0.06, 0.25]} />
        </mesh>
      ))}
      <group ref={door} position={[-0.42, 0.65, 0.41]}>
        <mesh position={[0.42, 0, 0.03]} material={steel} castShadow>
          <boxGeometry args={[0.84, 1.22, 0.06]} />
        </mesh>
        <mesh
          ref={dial}
          position={[0.42, 0.15, 0.08]}
          rotation-x={Math.PI / 2}
          material={f.brass}
          userData={{ live: true }}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            const s = state.current;
            s.open = !s.open;
            s.t = 0;
            sfx.vault();
            if (s.open) useCityStore.getState().toast("Every cent reconciled, every month 💼", "The books balance");
          }}
        >
          <cylinderGeometry args={[0.11, 0.11, 0.04, 28]} />
        </mesh>
        <mesh position={[0.72, -0.1, 0.08]} rotation-z={Math.PI / 2} material={f.chrome}>
          <cylinderGeometry args={[0.02, 0.02, 0.22, 8]} />
        </mesh>
      </group>
      <Block position={[0, 0.65, 0]} size={[0.9, 1.3, 0.8]} />
    </group>
  );
}

/** The market screen hanging over the trading floor: four live charts and a ring of tickers. */
function MarketScreen({ position }: { position: [number, number, number] }) {
  const f = finishes();
  const charts: [string, number, number, number][] = [
    ["BTC/USD", 67400, 180, 0],
    ["EUR/USD", 1.084, 0.0012, 4],
    ["XAU/USD", 2385, 6, 2],
    ["ETH/USD", 3480, 22, 1],
  ];
  return (
    <group position={position}>
      {[-1.4, 1.4].flatMap((x) =>
        [-1.4, 1.4].map((z) => (
          <mesh key={`${x}${z}`} position={[x, (H - position[1]) / 2 + 1.3, z]} material={f.brass}>
            <cylinderGeometry args={[0.012, 0.012, H - position[1] - 1.3, 4]} />
          </mesh>
        )),
      )}
      <mesh position={[0, 0, 0]} material={f.blackMetal}>
        <boxGeometry args={[4.36, 2.66, 4.36]} />
      </mesh>
      {charts.map(([label, start, vol, digits], i) => (
        <group key={label} rotation-y={(i * Math.PI) / 2}>
          <LiveChart position={[0, 0, 2.22]} label={label} start={start} vol={vol} digits={digits} />
          <Ticker position={[0, -1.6, 2.22]} length={4.1} />
        </group>
      ))}
      <mesh position={[0, -1.6, 0]} material={f.blackMetal}>
        <boxGeometry args={[4.4, 0.5, 4.4]} />
      </mesh>
      <mesh position={[0, 1.37, 0]} material={f.brass}>
        <boxGeometry args={[4.5, 0.06, 4.5]} />
      </mesh>
      <pointLight position={[0, -2.4, 0]} intensity={16} distance={13} decay={2} color="#fff1dc" />
    </group>
  );
}

// ---------------------------------------------------------------------------
// The floor
// ---------------------------------------------------------------------------

const DEPARTMENTS: { name: string; line: string; sign: [number, number, number]; rot: number; light: [number, number]; rug: [number, number, number, number, string] }[] = [
  { name: "Marketing", line: "Brand · Campaigns · Growth", sign: [-12, 3.55, -6.92], rot: 0, light: [-16.5, -11.5], rug: [-16.5, -12.4, 4, 3.2, "#2c3e57"] },
  { name: "Sales", line: "Client acquisition", sign: [-5.5, 3.55, -6.92], rot: 0, light: [-5.5, -11.5], rug: [-8.2, -9.8, 3, 3, "#4a2330"] },
  { name: "Operations", line: "Deposits · Withdrawals · KYC", sign: [5.5, 3.55, -6.92], rot: 0, light: [5.5, -11.5], rug: [5.5, -11.2, 8.4, 5.6, "#23303f"] },
  { name: "Risk Management", line: "Exposure · Compliance", sign: [12, 3.55, -6.92], rot: 0, light: [16.5, -11.5], rug: [16.5, -11.2, 8.4, 5.6, "#3a2a1c"] },
  { name: "Accounting", line: "Finance · Payroll · Audit", sign: [-12.92, 3.55, -1.25], rot: E, light: [-17.5, -1.2], rug: [-17.6, -1.2, 5.6, 7.6, "#1f3b33"] },
  { name: "Human Resources", line: "People · Culture · Hiring", sign: [-12.92, 3.55, 10.25], rot: E, light: [-17.5, 10.2], rug: [-18.2, 7.6, 3.6, 3.2, "#5a3a3a"] },
  { name: "Software Engineering", line: "CRM · Client portal · Payments", sign: [12.92, 3.55, 0.25], rot: Wd, light: [17.5, -1.5], rug: [17, -3.1, 6.6, 5.2, "#1e2a4d"] },
  { name: "Financial Counseling", line: "Private client advisory", sign: [12.92, 3.55, 11.75], rot: Wd, light: [17.5, 11.8], rug: [18.6, 11, 4.6, 3.6, "#4a1c22"] },
];

export function SahmeHQ({ job, accent }: { job: Experience; accent: string }) {
  const screens = useScreens();
  const screenOf = (k: DeskSpec["screens"][number]) => {
    const m = /^(chart|code)(\d+)$/.exec(k);
    if (m) return m[1] === "chart" ? screens.charts[Number(m[2]) % 6] : screens.code[Number(m[2]) % 3];
    return screens[k as keyof Screens] as THREE.Texture;
  };

  // Seats: every chair, sofa and armchair; the ones taken by coworkers are left out.
  const { free, taken } = useMemo(() => {
    const all: (Seat & { who?: string })[] = [
      ...DESKS.map((d) => ({ ...workSeat(d.id, d.x, d.z, d.facing), who: d.who })),
      ...CHAIRS.map(([id, x, z, facing, , who]) => ({ ...workSeat(id, x, z, facing), who })),
      ...SOFAS.flatMap(([id, x, z, facing, length]) => sofaSeats(id, x, z, facing, length)),
      // The receptionist's chair
      { ...workSeat("reception", 0, 7.7, N), who: "Female_Adult_01" },
    ];
    return { free: all.filter((s) => !s.who) as Seat[], taken: all.filter((s) => s.who) };
  }, []);

  const walkers = useMemo(
    () =>
      makeWalkers("room-sahme", "business", [], [
        [
          [-11, -6],
          [11, -6],
          [11, 4.2],
          [-11, 4.2],
        ],
        [
          [11, 4.2],
          [-11, 4.2],
          [-11, -6],
          [11, -6],
        ],
      ]),
    [],
  );

  const f = finishes();

  return (
    <group>
      {/* ---------------- Walls between the departments ---------------- */}
      <Batch>
        {/* Back row: glass fronts on the corridor with a door per department */}
        <GlassWall axis="x" at={-7} from={-13} to={13} doors={[-12, -5.5, 5.5, 12]} doorWidth={1.6} ceiling={H} />
        <GlassWall axis="z" at={-11} from={-D / 2} to={-7} ceiling={H} />
        <GlassWall axis="z" at={0} from={-D / 2} to={-7} ceiling={H} />
        <GlassWall axis="z" at={11} from={-D / 2} to={-7} ceiling={H} />
        {/* Left: Accounting and HR */}
        <GlassWall axis="z" at={-13} from={-7} to={D / 2} doors={[-1.25, 10.25]} ceiling={H} />
        <GlassWall axis="x" at={4.5} from={-W / 2} to={-13} ceiling={H} />
        {/* Right: Software Engineering and Financial Counseling */}
        <GlassWall axis="z" at={13} from={-7} to={D / 2} doors={[0.25, 11.75]} ceiling={H} />
      </Batch>
      {/* Solid walnut-paneled walls: Marketing | Accounting, Risk | Engineering, Engineering | Counseling */}
      <SolidWall axis="x" at={-7} from={-W / 2} to={-13} />
      <SolidWall axis="x" at={-7} from={13} to={W / 2} />
      <SolidWall axis="x" at={7.5} from={13} to={W / 2} />

      {DEPARTMENTS.map((d) => (
        <group key={d.name}>
          <DeptSign position={d.sign} rotationY={d.rot} name={d.name} line={d.line} />
          <pointLight position={[d.light[0], H - 1.4, d.light[1]]} intensity={9} distance={11} decay={2} color="#ffe6c4" />
        </group>
      ))}

      {/* ---------------- Furniture (merged into a few meshes) ---------------- */}
      <Batch>
        {DEPARTMENTS.map((d) => (
          <Rug key={d.name} position={[d.rug[0], d.rug[1]]} width={d.rug[2]} depth={d.rug[3]} color={d.rug[4]} />
        ))}
        <Rug position={[-8, 13.6]} width={5.8} depth={3.8} color="#3b1d4f" />
        <Rug position={[-20.3, 11.5]} width={3.4} depth={3.6} color="#2f4a3f" />
        <Rug position={[17, 14.2]} width={4.2} depth={2.6} color="#3a2a1c" />
        {DEPARTMENTS.flatMap((d) =>
          [-1.6, 1.6].map((o) => (
            <Pendant
              key={`${d.name}${o}`}
              position={d.rot === 0 ? [d.light[0] + o, d.light[1]] : [d.light[0], d.light[1] + o]}
              ceiling={H}
              drop={1.5}
            />
          )),
        )}

        {DESKS.map((d) => (
          <Workstation
            key={d.id}
            x={d.x}
            z={d.z}
            facing={d.facing}
            screens={d.screens.map(screenOf)}
            extras={d.extras}
            leather={d.leather}
            width={d.width}
          />
        ))}
        {CHAIRS.map(([id, x, z, facing, leather]) =>
          id.startsWith("fc") || id.startsWith("hr") ? (
            <SideChair key={id} position={[x, 0, z]} facing={facing} leather={leather} />
          ) : (
            <ExecChair key={id} position={[x, 0, z]} facing={facing} leather={leather} />
          ),
        )}
        {SOFAS.map(([id, x, z, facing, length, leather]) => (
          <Sofa key={id} position={[x, 0, z]} facing={facing} length={length} leather={leather} />
        ))}
        <ExecChair position={[0, 0, 7.7]} facing={N} leather="cream" />

        {/* Tables */}
        <Table position={[-16.5, 0, -12.8]} width={1.1} />
        <Table position={[-8.2, 0, -9.8]} width={1.1} top="marbleBlack" />
        <Table position={[-18.2, 0, 7.6]} width={1.8} depth={0.9} top="walnut" />
        <Table position={[-8, 0, 13.6]} width={1} height={0.42} top="marbleBlack" />
        <Table position={[-20.2, 0, 11.5]} width={0.8} height={0.42} top="marbleGreen" />
        <Table position={[17, 0, 14.1]} width={0.9} height={0.42} top="marbleBlack" />
        <Table position={[16.2, 0, 4.1]} width={0.8} height={0.4} top="walnut" />

        {/* Storage */}
        <Bookcase position={[-17.6, 0, -6.68]} width={2.6} seed={3} />
        <FilingCabinet position={[-14.3, 0, -6.58]} />
        <FilingCabinet position={[-14.85, 0, -6.58]} />
        <FilingCabinet position={[0.4, 0, -15.2]} rotationY={E} />
        <FilingCabinet position={[0.4, 0, -14.6]} rotationY={E} />
        <Credenza position={[10.65, 0, -14.6]} rotationY={Wd} width={1.8} />
        <Credenza position={[-5.5, 0, -15.6]} width={2.6} />
        <Bookcase position={[15.4, 0, 7.75]} width={2} seed={7} />
        <Bookcase position={[19.6, 0, 7.75]} width={2} seed={9} />
        <Credenza position={[-15.4, 0, 15.65]} rotationY={S} width={1.8} />

        {/* Lamps and plants */}
        <FloorLamp position={[-9.7, 0, 15.5]} />
        <FloorLamp position={[-6.3, 0, 15.5]} />
        <FloorLamp position={[15.4, 0, 15.5]} />
        <FloorLamp position={[-21.4, 0, 9.8]} />
        {[
          [-12, -7.6],
          [-1, -15.3],
          [10.4, -7.7],
          [12, -15.3],
          [-13.7, -6.4],
          [-13.7, 15.4],
          [13.7, -6.4],
          [13.7, 15.3],
          [-12.3, 5],
          [12.3, 5],
          [-21.4, 4],
          [21.4, 7],
        ].map(([x, z], i) => (
          <TallPlant key={i} position={[x, 0, z]} seed={i + 2} height={1.7 + (i % 3) * 0.2} />
        ))}

        {/* Engineering lounge */}
        <BeanBag position={[15.1, 0, 4.9]} color="#7c3aed" />
        <BeanBag position={[16.4, 0, 5.6]} color={accents.gold} />
        <BeanBag position={[17.4, 0, 4.4]} color="#0f766e" />

        {/* Marketing: a ring light on a tripod for content */}
        <group position={[-12.2, 0, -15.2]}>
          {[0, 2.1, 4.2].map((a) => (
            <mesh key={a} position={[Math.sin(a) * 0.18, 0.6, Math.cos(a) * 0.18]} rotation={[Math.cos(a) * 0.28, 0, -Math.sin(a) * 0.28]} material={f.blackMetal}>
              <cylinderGeometry args={[0.012, 0.012, 1.25, 6]} />
            </mesh>
          ))}
          <mesh position={[0, 1.6, 0]} material={f.shade}>
            <torusGeometry args={[0.3, 0.035, 10, 40]} />
          </mesh>
          <mesh position={[0, 1.6, -0.05]} material={f.blackMetal}>
            <boxGeometry args={[0.14, 0.1, 0.12]} />
          </mesh>
        </group>
      </Batch>

      {/* People at work, and the seats left for the visitor */}
      {taken.map((s) => (
        <Suspense key={s.id} fallback={null}>
          <SeatedPerson id={s.who!} seat={s} />
        </Suspense>
      ))}
      <Seats seats={free} />
      <Pedestrians walkers={walkers} />

      {/* ---------------- Lobby ---------------- */}
      <CompanyWall job={job} accent={accent} />
      <Reception company={job.company} />
      <Bull position={[3.8, 0, 12]} />
      <CryptoCoins position={[-3.6, 0, 11.8]} />
      <SlotMachine position={[11.9, 0, 9.6]} rotationY={-Math.PI / 2} />
      <group position={[8.6, 0, 15.3]} rotation-y={Math.PI}>
        <CoffeeBar position={[0, 0, 0]} />
      </group>
      <OnWall side="front">
        <Ticker position={[0, 4.3, D / 2 - 0.05]} rotationY={Math.PI} length={9} />
        <WorldClocks position={[7.4, 3.4, D / 2 - 0.05]} />
        {job.plaque && <Plaque text={job.plaque} x={-3.4} />}
        <Painting position={[-8, 2.4, D / 2 - 0.05]} rotationY={Math.PI} width={2.4} height={1.3} seed={4} palette={PALETTES[0]} />
        <Painting position={[-19.4, 2.3, D / 2 - 0.05]} rotationY={Math.PI} width={1.2} height={0.9} seed={8} palette={PALETTES[1]} />
        <Painting position={[-17.4, 2.3, D / 2 - 0.05]} rotationY={Math.PI} width={1.2} height={0.9} seed={9} palette={PALETTES[2]} />
        <Painting position={[17, 2.4, D / 2 - 0.05]} rotationY={Math.PI} width={2.2} height={1.2} seed={11} palette={PALETTES[3]} />
      </OnWall>

      {/* ---------------- Trading floor ---------------- */}
      <MarketScreen position={[0, 4.05, -1.1]} />

      {/* ---------------- Department walls ---------------- */}
      <OnWall side="back">
        <MoodBoard position={[-19, 2.3, -D / 2 + 0.06]} />
        <WallScreen position={[-14.2, 2.4, -D / 2 + 0.06]} width={3} height={1.65} map={screens.analyticsWall} />
        <WallScreen position={[-5.5, 2.5, -D / 2 + 0.06]} width={3.6} height={1.97} map={screens.leaderboard} />
        <WallScreen position={[5.5, 2.5, -D / 2 + 0.06]} width={4} height={2.19} map={screens.opsWall} />
        <WallScreen position={[16.5, 2.5, -D / 2 + 0.06]} width={4} height={2.19} map={screens.riskWall} />
      </OnWall>
      <Gong position={[-1, 0, -15.3]} />
      <Vault position={[-21.3, 0, -6.3]} rotationY={Math.PI / 2} />

      {/* Risk's side of the solid wall: the world map */}
      <WallScreen position={[17.5, 2.4, -7.12]} rotationY={Math.PI} width={3.6} height={1.83} map={screens.world} />

      {/* Engineering: the architecture whiteboard, neon, tech wall, server racks and ducks */}
      <Whiteboard position={[16.2, 2.0, -6.86]} />
      <NeonCode position={[20.3, 2.5, -6.86]} rotationY={0} />
      <group position={[17.5, 1.25, 7.36]} rotation-y={Math.PI}>
        <TechTiles tech={job.tech} position={[0, 0, 0]} rotationY={0} length={7.6} />
      </group>
      <group position={[21.3, 0, 0.5]} rotation-y={-Math.PI / 2}>
        <ServerRacks position={[0, 0, 0]} />
      </group>
      <Nameplate position={[18.6 + 0.78 - 0.25, 0.75, -4.6]} rotationY={Math.PI / 2} name="Wouroud El Khaldi" title="Mid-Senior Full Stack Engineer" />
      <RubberDuck position={[19.5, 0.77, -5.2]} />
      <RubberDuck position={[16.2, 0.4, 4.25]} />

      {/* HR: the values board */}
      <OnWall side="left">
        <Board
          position={[-W / 2 + 0.06, 2.3, 7]}
          rotationY={Math.PI / 2}
          width={2.8}
          height={1.6}
          title="Our values"
          body={"Integrity in every trade\nClients come first\nOwn it, end to end\nKeep learning, keep shipping"}
          accent={accents.goldDeep}
        />
      </OnWall>

      {/* Financial counseling */}
      <Globe position={[21.2, 0, 8.7]} />
      <Nameplate position={[20.7 - 0.78 + 0.3, 0.75, 11]} rotationY={-Math.PI / 2} name="Private Client Desk" title="Financial Counseling" />
    </group>
  );
}

const PALETTES = [
  ["#1e2a4d", "#c9a45a", "#7c3aed", "#f4ead6"],
  ["#f4ead6", "#5e1a1d", "#1f5a47", "#c9a45a"],
  ["#efe6d4", "#1e2a4d", "#c99a92", "#c9a45a"],
  ["#3a2316", "#c9a45a", "#5e1a1d", "#efe6d4"],
];

/** A walnut-paneled wall, finished on both sides, from floor to ceiling. */
function SolidWall({ axis, at, from, to }: { axis: "x" | "z"; at: number; from: number; to: number }) {
  const f = finishes();
  const len = to - from;
  const mid = (from + to) / 2;
  const pos = (y: number, across: number): [number, number, number] => (axis === "x" ? [mid, y, at + across] : [at + across, y, mid]);
  const rot = axis === "x" ? 0 : Math.PI / 2;
  return (
    <group>
      <Batch>
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh position={pos(H / 2, s * 0.1)} rotation-y={rot + (s < 0 ? Math.PI : 0)} material={f.ivory} receiveShadow>
              <planeGeometry args={[len, H]} />
            </mesh>
            <mesh position={pos(0.6, s * 0.11)} rotation-y={rot + (s < 0 ? Math.PI : 0)} material={f.walnut}>
              <planeGeometry args={[len, 1.2]} />
            </mesh>
            <mesh position={pos(1.21, s * 0.115)} rotation-y={rot} material={f.brass}>
              <boxGeometry args={[len, 0.04, 0.01]} />
            </mesh>
          </group>
        ))}
      </Batch>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={axis === "x" ? [len / 2, H / 2, 0.1] : [0.1, H / 2, len / 2]} position={pos(H / 2, 0)} />
      </RigidBody>
    </group>
  );
}

/** Marketing's mood board: brand colors, campaign posters and the tagline. Faces +z. */
function MoodBoard({ position }: { position: [number, number, number] }) {
  const f = finishes();
  const swatches = ["#7c3aed", "#c9a45a", "#0b1020", "#22c55e", "#f4ead6"];
  const posters: [number, number, number, number, string][] = [
    [-0.9, 0.3, 0.9, 0.6, "#0b1020"],
    [0.2, 0.25, 0.7, 0.9, "#3b1d6e"],
    [1.1, 0.35, 0.7, 0.5, "#c9a45a"],
    [0.9, -0.45, 0.9, 0.5, "#1e2a4d"],
  ];
  return (
    <group position={position}>
      <mesh position={[0, 0, -0.03]} material={f.walnut}>
        <boxGeometry args={[3.4, 1.9, 0.05]} />
      </mesh>
      <mesh>
        <planeGeometry args={[3.2, 1.7]} />
        <meshStandardMaterial color="#efe6d4" roughness={0.9} />
      </mesh>
      {swatches.map((c, i) => (
        <mesh key={c} position={[-1.3 + i * 0.32, -0.55, 0.01]}>
          <planeGeometry args={[0.26, 0.4]} />
          <meshStandardMaterial color={c} />
        </mesh>
      ))}
      {posters.map(([x, y, w, h, c], i) => (
        <mesh key={i} position={[x, y, 0.012]} rotation-z={(i - 1.5) * 0.04}>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial color={c} />
        </mesh>
      ))}
      <Text position={[-0.9, 0.3, 0.02]} fontSize={0.12} color={GOLD} anchorX="center" anchorY="middle" maxWidth={0.8} textAlign="center">
        {"Trade smarter.\nSahme."}
      </Text>
      <Text position={[0.9, -0.45, 0.02]} fontSize={0.09} color="#fff" anchorX="center" anchorY="middle">
        Q4 launch
      </Text>
      <Text position={[0, 0.98, 0.02]} fontSize={0.14} color="#1a103d" anchorX="center">
        BRAND BOARD
      </Text>
    </group>
  );
}

/** The company wall behind reception: who Sahme is and Wouroud's roles; highlights on its back. */
function CompanyWall({ job, accent }: { job: Experience; accent: string }) {
  const f = finishes();
  const monthYear = (m: string | null) =>
    m ? new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1).toLocaleString("en", { month: "short", year: "numeric" }) : "now";
  const shown = job.highlights.slice(0, 6);
  return (
    <group position={[0, 0, 5.2]}>
      <Batch>
        <mesh position={[0, 2.1, 0]} material={f.walnutDark} castShadow receiveShadow>
          <boxGeometry args={[9.2, 4.2, 0.3]} />
        </mesh>
        <mesh position={[0, 4.24, 0]} material={f.brass}>
          <boxGeometry args={[9.3, 0.08, 0.34]} />
        </mesh>
        <mesh position={[0, 0.05, 0]} material={f.brass}>
          <boxGeometry args={[9.3, 0.1, 0.34]} />
        </mesh>
        {/* Black marble panel on the lobby side */}
        <mesh position={[0, 2.35, 0.155]} material={f.marbleBlack}>
          <planeGeometry args={[8.4, 3.3]} />
        </mesh>
      </Batch>
      <mesh position={[0, 3.85, 0.16]}>
        <planeGeometry args={[8.4, 0.05]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.8} />
      </mesh>
      <Text position={[0, 3.35, 0.17]} fontSize={0.6} letterSpacing={0.08} color={GOLD} anchorX="center" anchorY="middle">
        {job.company.toUpperCase()}
      </Text>
      {job.formerName && (
        <Text position={[0, 2.88, 0.17]} fontSize={0.17} color="#d9c8a6" anchorX="center">
          {`formerly ${job.formerName}`}
        </Text>
      )}
      {job.roles.map((r, i) => (
        <Text key={r.title} position={[0, 2.5 - i * 0.34, 0.17]} fontSize={0.21} color={i === 0 ? GOLD : "#efe6d4"} anchorX="center">
          {`${r.title} · ${monthYear(r.start)} – ${monthYear(r.end)}`}
        </Text>
      ))}
      <Text position={[0, 1.65 - job.roles.length * 0.1, 0.17]} fontSize={0.17} color="#efe6d4" anchorX="center" maxWidth={7.8} textAlign="center" lineHeight={1.35}>
        {`${job.summary}\n${job.location} · ${job.type}`}
      </Text>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[4.6, 2.1, 0.15]} position={[0, 2.1, 0]} />
      </RigidBody>
      {/* The trading-floor side: what Wouroud does here */}
      {/* Kept low so the market screen hanging over the trading floor doesn't hide them */}
      <Text position={[0, 3.55, -0.17]} rotation-y={Math.PI} fontSize={0.26} color={GOLD} anchorX="center">
        WHAT I DO HERE
      </Text>
      {shown.map((h, i) => (
        <Board
          key={i}
          position={[2.95 - (i % 3) * 2.95, 2.5 - Math.floor(i / 3) * 1.4, -0.2]}
          rotationY={Math.PI}
          width={2.7}
          height={1.28}
          body={h}
          accent={accents.goldDeep}
        />
      ))}
    </group>
  );
}

/** The reception desk: a black-marble counter with gold letters, and the receptionist's work surface. */
function Reception({ company }: { company: string }) {
  const f = finishes();
  return (
    <group position={[0, 0, 8.5]}>
      <Batch>
        <group position={[0, 0, -0.02]}>
          <mesh position={[0, 0.735, 0]} material={f.walnut} castShadow receiveShadow>
            <boxGeometry args={[2.6, 0.03, 0.75]} />
          </mesh>
          {[-1.2, 1.2].map((x) => (
            <mesh key={x} position={[x, 0.36, 0]} material={f.walnutDark}>
              <boxGeometry args={[0.06, 0.72, 0.7]} />
            </mesh>
          ))}
        </group>
        {/* Front panel, top ledge and returns */}
        <mesh position={[0, 0.55, 0.48]} material={f.marbleBlack} castShadow receiveShadow>
          <boxGeometry args={[4.2, 1.1, 0.12]} />
        </mesh>
        <mesh position={[0, 1.12, 0.43]} material={f.marbleWhite} castShadow>
          <boxGeometry args={[4.3, 0.04, 0.36]} />
        </mesh>
        {[-2.04, 2.04].map((x) => (
          <mesh key={x} position={[x, 0.55, 0.05]} material={f.marbleBlack} castShadow>
            <boxGeometry args={[0.12, 1.1, 0.9]} />
          </mesh>
        ))}
        <mesh position={[0, 0.06, 0.55]} material={f.brass}>
          <boxGeometry args={[4.2, 0.03, 0.02]} />
        </mesh>
        {/* Monitor (facing the receptionist), stand and flowers */}
        <mesh position={[0.4, 1.05, 0.15]} material={f.blackMetal}>
          <boxGeometry args={[0.56, 0.34, 0.02]} />
        </mesh>
        <mesh position={[0.4, 0.82, 0.17]} material={f.chrome}>
          <boxGeometry args={[0.035, 0.16, 0.02]} />
        </mesh>
        <mesh position={[-0.9, 0.84, 0.1]} material={f.marbleWhite}>
          <cylinderGeometry args={[0.07, 0.06, 0.2, 16]} />
        </mesh>
        {[0, 1, 2, 3, 4, 5].map((k) => (
          <mesh key={k} position={[-0.9 + Math.sin(k) * 0.07, 1.0 + (k % 3) * 0.04, 0.1 + Math.cos(k) * 0.07]}>
            <sphereGeometry args={[0.045, 8, 6]} />
            <meshStandardMaterial color={k % 2 ? "#f4ead6" : "#e8b4b8"} roughness={0.8} />
          </mesh>
        ))}
      </Batch>
      <Text position={[0, 0.62, 0.545]} fontSize={0.2} letterSpacing={0.2} color={GOLD} anchorX="center" anchorY="middle">
        {company.toUpperCase()}
      </Text>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[2.15, 0.56, 0.2]} position={[0, 0.56, 0.45]} />
        <CuboidCollider args={[0.1, 0.56, 0.45]} position={[-2.04, 0.56, 0.05]} />
        <CuboidCollider args={[0.1, 0.56, 0.45]} position={[2.04, 0.56, 0.05]} />
      </RigidBody>
    </group>
  );
}
