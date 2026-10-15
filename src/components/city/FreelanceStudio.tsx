"use client";

import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { seedContent } from "@/content/seed";
import type { Experience } from "@/content/schema";
import { useCityStore, type Seat } from "@/state/useCityStore";
import { DISTRICTS } from "@/world/districts";
import { sfx } from "@/world/sfx";
import { Nameplate, Rug, Sofa, sofaSeats, Table, TallPlant, Workstation, workSeat } from "./Furniture";
import { OnWall, TechTiles, useRoom } from "./InteriorScene";
import { emitBurst } from "./Particles";
import { box, font, Panel, useCanvas, wrap } from "./roomKit";
import { Seats } from "./StreetDetails";
import { Text } from "./Text3D";
import { useProximity } from "./useProximity";

/**
 * Wouroud's freelance studio (Jan 2024 – now): the client work and the things built in these
 * years. Jamrex Miniyeh, the client shop, runs on the big screen (switch English/Arabic and
 * light/dark; it pings with Telegram order alerts); a spinning model of this very city sits on
 * the table; the process wall lights step by step; the side-projects shelf opens each project;
 * and her desk has Figma and code on the screens.
 */

const SIDE_PROJECTS = ["hyperfocus", "fitsync", "tripoli-pulse", "linkedin-ai-workflow", "rn-todo"];
const STEPS = [
  { title: "Discover", line: "What the client needs, who uses it, what success looks like" },
  { title: "Design in Figma", line: "Wireframes, then a polished UI the client signs off" },
  { title: "Build", line: "Next.js, TypeScript, Tailwind, Prisma, PostgreSQL" },
  { title: "Deploy", line: "Docker, Caddy, a domain and HTTPS" },
  { title: "Hand over", line: "A dashboard the client edits alone, and a walkthrough" },
];
const pointer = {
  onPointerOver: () => (document.body.style.cursor = "pointer"),
  onPointerOut: () => (document.body.style.cursor = ""),
};

export function FreelanceStudio({ job, accent }: { job: Experience; accent: string }) {
  const { width: W, depth: D } = useRoom();
  const jamrex = seedContent.projects.find((p) => p.id === "jamrex");
  const seats = useMemo<Seat[]>(() => [workSeat("freelance-desk", -6.5, 2.2, Math.PI), ...sofaSeats("freelance-sofa", 5.5, 3.4, Math.PI, 2.2)], []);
  const figma = useCanvas(640, 400, drawFigma);
  const code = useCanvas(640, 400, drawCode);
  return (
    <group>
      {jamrex && <ShopScreen url={jamrex.links[0]?.url} accent={accent} />}
      <CityModel />
      <ProcessWall accent={accent} />
      <SideProjects accent={accent} />
      <OnWall side="right">
        <TechTiles tech={job.tech} position={[W / 2 - 0.05, 0.5, 0]} rotationY={-Math.PI / 2} length={D - 4} />
      </OnWall>

      {/* Her desk, looking toward the shop screen */}
      <Workstation x={-6.5} z={2.2} facing={Math.PI} screens={[figma.texture, code.texture]} extras={["mug", "plant", "laptop"]} leather="cognac" />
      <Nameplate position={[-6.5, 0.78, 1.25]} rotationY={Math.PI} name="Wouroud El Khaldi" title={job.roles[0].title} />
      <Rug position={[5.5, 2.6]} width={3.6} depth={3} color="#2b1a3d" />
      <Sofa position={[5.5, 0, 3.4]} facing={Math.PI} leather="blush" />
      <Table position={[5.5, 0, 2.2]} width={1.1} depth={0.6} height={0.42} />
      <Seats seats={seats} />
      <TallPlant position={[W / 2 - 1.2, 0, -D / 2 + 1.2]} seed={41} />
      <TallPlant position={[-W / 2 + 1.2, 0, -D / 2 + 1.2]} seed={42} />
    </group>
  );
}

// --- Jamrex Miniyeh on the big screen ----------------------------------------------------------

function ShopScreen({ url, accent }: { url?: string; accent: string }) {
  const { depth: D } = useRoom();
  const [arabic, setArabic] = useState(false);
  const [dark, setDark] = useState(false);
  const [orders, setOrders] = useState(0);
  const { texture } = useCanvas(
    1920,
    1080,
    (ctx, w, h) => {
      const bg = dark ? "#121212" : "#fbf7f2";
      const ink = dark ? "#f4f1ea" : "#1f1a17";
      const muted = dark ? "#a3a3a3" : "#6b6258";
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      // Browser bar.
      box(ctx, 0, 0, w, 70, 0, dark ? "#1f1f1f" : "#ece7e0");
      box(ctx, 220, 16, 900, 38, 19, dark ? "#2b2b2b" : "#ffffff");
      ctx.fillStyle = muted;
      ctx.font = font(24);
      ctx.fillText(`🔒 ${url?.replace(/^https?:\/\//, "").replace(/\/$/, "") ?? "jamrex-miniyeh.com"}`, 240, 43);
      ctx.textAlign = arabic ? "right" : "left";
      const x0 = arabic ? w - 80 : 80;
      // Header.
      ctx.fillStyle = "#c2410c";
      ctx.font = font(58, "800");
      ctx.fillText(arabic ? "جمركس منية" : "Jamrex Miniyeh", x0, 160);
      ctx.fillStyle = muted;
      ctx.font = font(30);
      ctx.fillText(arabic ? "تسوّق أونلاين · توصيل في الشمال" : "Shop online · delivery across North Lebanon", x0, 210);
      // Product cards.
      const products = arabic
        ? ["سماعات", "ساعة ذكية", "شاحن سريع", "حقيبة"]
        : ["Headphones", "Smart watch", "Fast charger", "Backpack"];
      const colors = ["#c2410c", "#0f766e", "#7c3aed", "#ca8a04"];
      products.forEach((p, i) => {
        const cw = 400;
        const cx = arabic ? w - 80 - cw - i * (cw + 30) : 80 + i * (cw + 30);
        box(ctx, cx, 270, cw, 560, 24, dark ? "#1d1d1d" : "#ffffff", dark ? "#333" : "#eadfd3");
        box(ctx, cx + 24, 294, cw - 48, 300, 18, colors[i]);
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.beginPath();
        ctx.arc(cx + cw / 2, 444, 90, 0, Math.PI * 2);
        ctx.fill();
        ctx.textAlign = arabic ? "right" : "left";
        ctx.fillStyle = ink;
        ctx.font = font(40, "700");
        ctx.fillText(p, arabic ? cx + cw - 30 : cx + 30, 660);
        ctx.fillStyle = "#c2410c";
        ctx.font = font(34, "700");
        ctx.fillText(`$${[29, 59, 15, 39][i]}`, arabic ? cx + cw - 30 : cx + 30, 714);
        box(ctx, cx + 30, 744, cw - 60, 60, 30, "#c2410c");
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.font = font(30, "700");
        ctx.fillText(arabic ? "أضف إلى السلة" : "Add to cart", cx + cw / 2, 785);
      });
      ctx.textAlign = "left";
      // Footer controls (they're what you click).
      box(ctx, 80, 900, 420, 110, 20, dark ? "#262626" : "#efe8df");
      box(ctx, w - 500, 900, 420, 110, 20, dark ? "#262626" : "#efe8df");
      ctx.fillStyle = ink;
      ctx.font = font(36, "700");
      ctx.textAlign = "center";
      ctx.fillText(arabic ? "English ⇄ العربية" : "العربية ⇄ English", 290, 968);
      ctx.fillText(dark ? "☀ Light mode" : "☾ Dark mode", w - 290, 968);
      ctx.fillStyle = muted;
      ctx.font = font(28);
      ctx.fillText(orders ? `${orders} order alert${orders > 1 ? "s" : ""} sent to Telegram today` : "Press E for a Telegram order alert", w / 2, 968);
      ctx.textAlign = "left";
    },
    `${arabic}${dark}${orders}`,
  );
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6 || !e.uv) return;
    e.stopPropagation();
    sfx.click();
    if (e.uv.x < 0.33) setArabic((a) => !a);
    else if (e.uv.x > 0.67) setDark((d) => !d);
    else ping();
  };
  const ping = () => {
    setOrders((n) => n + 1);
    sfx.chirp();
    useCityStore.getState().toast("🛒 New order on Jamrex Miniyeh: 1 × Smart watch, paid with Whish Pay. Telegram alert and web push sent.", "Jamrex Miniyeh");
    emitBurst({ position: new THREE.Vector3(0, 3, -D / 2 + 1), kind: "sparkle", count: 20, colors: ["#c2410c", "#fde68a", "#ffffff"], spread: 1.2 });
  };
  const where = useMemo(() => new THREE.Vector3(0, 0, -D / 2 + 3.8), [D]);
  useProximity({ id: "jamrex-ping", label: "Send a test order on Jamrex Miniyeh", radius: 2.4, where, run: ping });
  return (
    <OnWall side="back">
      <Panel position={[0, 2.85, -D / 2 + 0.06]} width={8.2} height={4.6} map={texture} frame="#111" onClick={onClick} />
      <group
        position={[0, 0.35, -D / 2 + 0.07]}
        onClick={(e) => {
          if (e.delta > 6) return;
          e.stopPropagation();
          if (url) window.open(url, "_blank", "noopener");
        }}
        {...pointer}
      >
        <mesh>
          <planeGeometry args={[4.4, 0.42]} />
          <meshStandardMaterial color={accent} />
        </mesh>
        <Text position={[0, 0, 0.01]} fontSize={0.18} color="#ffffff" anchorX="center" anchorY="middle">
          {"Client project · live · click to visit jamrex-miniyeh.com ↗"}
        </Text>
      </group>
    </OnWall>
  );
}

// --- A model of this very city, spinning on a table -----------------------------------------

function CityModel() {
  const model = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (model.current) model.current.rotation.y += delta * 0.25;
  });
  const toast = useCityStore((s) => s.toast);
  return (
    <group position={[0, 0, -2.6]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.2, 0.45, 1.2]} position={[0, 0.45, 0]} />
      </RigidBody>
      <Table position={[0, 0, 0]} width={2.4} depth={2.4} height={0.8} top="marbleBlack" />
      <group
        ref={model}
        position={[0, 0.83, 0]}
        onClick={(e) => {
          if (e.delta > 6) return;
          e.stopPropagation();
          sfx.sparkle();
          toast("This is Wouroud's City itself, built in the freelance years with Next.js, React Three Fiber and Rapier. You're standing in it!", "Wouroud's City");
        }}
        {...pointer}
      >
        <mesh receiveShadow>
          <cylinderGeometry args={[1, 1, 0.04, 48]} />
          <meshStandardMaterial color="#5a8f45" roughness={1} />
        </mesh>
        <mesh position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.25, 0.25, 0.03, 32]} />
          <meshStandardMaterial color="#efe6d4" />
        </mesh>
        {DISTRICTS.map((d, i) => {
          const a = (i / DISTRICTS.length) * Math.PI * 2;
          const h = 0.15 + ((i * 7) % 5) * 0.06;
          return (
            <group key={d.id}>
              <mesh position={[Math.cos(a) * 0.45, 0.03, Math.sin(a) * 0.45]} rotation-y={-a}>
                <boxGeometry args={[0.5, 0.01, 0.05]} />
                <meshStandardMaterial color="#3a3540" />
              </mesh>
              <mesh position={[Math.cos(a) * 0.78, 0.02 + h / 2, Math.sin(a) * 0.78]} castShadow>
                <boxGeometry args={[0.14, h, 0.14]} />
                <meshStandardMaterial color={d.color} />
              </mesh>
            </group>
          );
        })}
      </group>
    </group>
  );
}

// --- The process, step by step ----------------------------------------------------------------

function ProcessWall({ accent }: { accent: string }) {
  const { width: W } = useRoom();
  const [step, setStep] = useState(-1);
  const { texture } = useCanvas(
    1600,
    1000,
    (ctx, w) => {
      ctx.fillStyle = "#fbf8f1";
      ctx.fillRect(0, 0, w, 1000);
      ctx.fillStyle = "#1a103d";
      ctx.font = font(64, "800");
      ctx.fillText("How a freelance project goes", 60, 100);
      ctx.font = font(30);
      ctx.fillStyle = "#6b6258";
      ctx.fillText("Click to walk through it", 60, 150);
      STEPS.forEach((s, i) => {
        const y = 210 + i * 150;
        const on = i <= step;
        box(ctx, 60, y, w - 120, 124, 20, on ? accent : "#efe8df");
        ctx.fillStyle = on ? "#ffffff" : "#1a103d";
        ctx.font = font(44, "800");
        ctx.fillText(`${i + 1}. ${s.title}`, 100, y + 56);
        ctx.font = font(30);
        ctx.fillStyle = on ? "#ffffffcc" : "#6b6258";
        wrap(ctx, s.line, 100, y + 100, w - 220, 34);
      });
    },
    step,
  );
  return (
    <OnWall side="left">
      <Panel
        position={[-W / 2 + 0.06, 2.7, -4]}
        rotationY={Math.PI / 2}
        width={5.6}
        height={3.5}
        map={texture}
        frame="#2b1a12"
        onClick={(e) => {
          if (e.delta > 6) return;
          e.stopPropagation();
          setStep((s) => (s >= STEPS.length - 1 ? -1 : s + 1));
          sfx.click();
        }}
      />
    </OnWall>
  );
}

// --- Side projects from these years: each card opens its panel --------------------------------

function SideProjects({ accent }: { accent: string }) {
  const { width: W } = useRoom();
  const openPanel = useCityStore((s) => s.openPanel);
  const projects = SIDE_PROJECTS.map((id) => seedContent.projects.find((p) => p.id === id)).filter((p) => !!p);
  const { texture } = useCanvas(
    1600,
    900,
    (ctx, w) => {
      ctx.fillStyle = "#1a103d";
      ctx.fillRect(0, 0, w, 900);
      ctx.fillStyle = "#fde68a";
      ctx.font = font(56, "800");
      ctx.fillText("Built in these years", 60, 90);
      ctx.fillStyle = "#c4b5fd";
      ctx.font = font(28);
      ctx.fillText("Side projects next to the client work · click one", 60, 136);
      projects.forEach((p, i) => {
        const y = 180 + i * 140;
        box(ctx, 60, y, w - 120, 120, 18, "#2d1f52");
        box(ctx, 60, y, 14, 120, 7, accent);
        ctx.fillStyle = "#ffffff";
        ctx.font = font(40, "700");
        ctx.fillText(`${p.name} · ${p.year}`, 100, y + 50);
        ctx.fillStyle = "#c4b5fd";
        ctx.font = font(28);
        wrap(ctx, p.pitch, 100, y + 94, w - 220, 30);
      });
    },
    projects.length,
  );
  return (
    <OnWall side="left">
      <Panel
        position={[-W / 2 + 0.06, 2.6, 3]}
        rotationY={Math.PI / 2}
        width={5.2}
        height={2.9}
        map={texture}
        frame="#c9a45a"
        onClick={(e) => {
          if (e.delta > 6 || !e.uv) return;
          e.stopPropagation();
          const py = (1 - e.uv.y) * 900;
          const i = Math.floor((py - 180) / 140);
          const p = projects[i];
          if (p) openPanel({ district: "projects", id: p.id });
        }}
      />
    </OnWall>
  );
}

// --- Screens on her desk -------------------------------------------------------------------------

function drawFigma(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = "#2c2c2c";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#1e1e1e";
  ctx.fillRect(0, 0, 120, h);
  ctx.fillRect(w - 140, 0, 140, h);
  box(ctx, 150, 40, w - 320, h - 80, 6, "#fbf7f2");
  box(ctx, 170, 60, w - 360, 50, 6, "#c2410c");
  for (let i = 0; i < 3; i++) box(ctx, 170 + i * 110, 130, 95, 140, 8, ["#c2410c", "#0f766e", "#7c3aed"][i]);
  ctx.fillStyle = "#a259ff";
  ctx.fillRect(150, 40, w - 320, 3);
  ctx.fillStyle = "#cccccc";
  ctx.font = font(16);
  ctx.fillText("Layers", 20, 30);
  ctx.fillText("Design", w - 120, 30);
}

function drawCode(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = "#0b1020";
  ctx.fillRect(0, 0, w, h);
  const lines = [
    "export async function POST(req: Request) {",
    "  const order = await prisma.order.create({ data });",
    "  await telegram.notify(order);",
    "  await webPush.sendAll(order);",
    "  return Response.json(order, { status: 201 });",
    "}",
  ];
  ctx.font = font(18);
  lines.forEach((l, i) => {
    ctx.fillStyle = i === 0 || i === 5 ? "#c792ea" : "#e2e8f0";
    ctx.fillText(l, 20, 40 + i * 30);
  });
  void h;
}
