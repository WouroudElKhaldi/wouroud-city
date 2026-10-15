"use client";

import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Experience } from "@/content/schema";
import { useCityStore, type Seat } from "@/state/useCityStore";
import { CODI_ROOM } from "@/world/interiors";
import { sfx } from "@/world/sfx";
import {
  ahead,
  Batch,
  BeanBag,
  Block,
  ConferenceChair,
  Desk,
  DESK_REACH,
  DESK_TOP,
  ExecChair,
  plain,
  SeatedPerson,
  TallPlant,
  workSeat,
} from "./Furniture";
import { OnWall, Plaque } from "./InteriorScene";
import { finishes } from "./luxury";
import { emitBurst } from "./Particles";
import { makeWalkers, Pedestrians } from "./Pedestrians";
import { box, font, ModernShell, Panel, type ShellLook, useCanvas, wrap } from "./roomKit";
import { Seats } from "./StreetDetails";
import { TEXT_FONT } from "@/world/fonts";
import { Text } from "./Text3D";

/**
 * Codi Tech, the coding bootcamp where Wouroud trained as a full-stack developer
 * (Aug 2023 – Mar 2024). A bright campus in Codi's colors (the radiating "C" of its logo):
 * a classroom facing the lesson screen, the logo as a sculpture of colored dashes, a sprint
 * board, the graduates' wall (cohorts from Codi's Instagram), the Talent Expo, and her own
 * bootcamp wall: five MERN apps, Agile, UI/UX.
 */

const W = CODI_ROOM.width;
const D = CODI_ROOM.depth;

const INK = "#24234a";
const MAGENTA = "#e6007e";
const PINK = "#f25c94";
const ORANGE = "#f7941d";
const YELLOW = "#ffc20e";
const BLUE = "#2d6cdf";
const PURPLE = "#7b3fa0";
const RAYS = [MAGENTA, YELLOW, BLUE, ORANGE, PINK, PURPLE];
const GREY = "#6b7280";

const LOOK: ShellLook = {
  floor: "oak",
  wall: "#ffffff",
  wainscot: INK,
  line: MAGENTA,
  ceiling: "#f4f4f8",
  column: "#e5e7eb",
  columnsZ: [-D / 2 + 0.2, D / 2 - 0.2],
  windowsZ: [-5.5, 4.5],
  lightsX: [-7, 0, 7],
  lightsZ: [-5, 1, 7],
  lamps: [
    [-7, -4],
    [7, -4],
    [0, -4],
    [-7, 5],
    [7, 5],
  ],
  lampColor: "#fffaf2",
};

// ---------------------------------------------------------------------------
// The logo
// ---------------------------------------------------------------------------

/** The rays of Codi's "C": colored dashes around an arc, open on the right. */
function logoRays() {
  const rays: { a: number; r0: number; len: number; c: string; w: number }[] = [];
  let seed = 5;
  const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 46; i++) {
    const a = THREE.MathUtils.degToRad(48 + (i / 45) * 264);
    rays.push({ a, r0: 0.5 + r() * 0.12, len: 0.22 + r() * 0.42, c: RAYS[i % RAYS.length], w: 0.045 + r() * 0.03 });
  }
  return rays;
}

function drawLogo2d(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number, word = true) {
  for (const ray of logoRays()) {
    ctx.strokeStyle = ray.c;
    ctx.lineWidth = ray.w * scale;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ray.a) * ray.r0 * scale, cy - Math.sin(ray.a) * ray.r0 * scale);
    ctx.lineTo(cx + Math.cos(ray.a) * (ray.r0 + ray.len) * scale, cy - Math.sin(ray.a) * (ray.r0 + ray.len) * scale);
    ctx.stroke();
  }
  if (word) {
    ctx.fillStyle = INK;
    ctx.font = font(scale * 0.9);
    ctx.fillText("codi", cx + scale * 1.25, cy + scale * 0.3);
  }
}

/** Codi's logo on the wall: rays as little colored bars that ripple when clicked. */
function LogoSculpture({ position }: { position: [number, number, number] }) {
  const rays = useMemo(() => logoRays(), []);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const ripple = useRef(-10);
  const pending = useRef(false);
  const o = useMemo(() => new THREE.Object3D(), []);
  const scale = 1.18;
  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const c = new THREE.Color();
    rays.forEach((ray, i) => m.setColorAt(i, c.set(ray.c)));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [rays]);
  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    if (pending.current) {
      pending.current = false;
      ripple.current = clock.elapsedTime;
    }
    const age = clock.elapsedTime - ripple.current;
    rays.forEach((ray, i) => {
      const pop = age < 2 ? Math.max(0, Math.sin((age * 6 - i * 0.12) * 1.0)) * 0.25 * (1 - age / 2) : 0;
      const len = ray.len * (1 + pop + Math.sin(clock.elapsedTime * 1.2 + i) * 0.03);
      const mid = (ray.r0 + len / 2) * scale;
      o.position.set(Math.cos(ray.a) * mid, Math.sin(ray.a) * mid, 0.03);
      o.rotation.set(0, 0, ray.a);
      o.scale.set(len * scale, ray.w * scale, 0.05);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <group position={position}>
      <instancedMesh
        ref={mesh}
        args={[undefined, undefined, rays.length]}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          pending.current = true;
          sfx.sparkle();
          useCityStore.getState().toast("Award-winning, transformative, accessible and holistic coding + leadership education.", "codi");
        }}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.4} emissive="#ffffff" emissiveIntensity={0.05} />
      </instancedMesh>
      <Text font={TEXT_FONT} position={[1.75 * scale, -0.05, 0.03]} fontSize={1.15 * scale} color={INK} anchorX="left" anchorY="middle" letterSpacing={-0.02}>
        codi
      </Text>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Wall screens
// ---------------------------------------------------------------------------

const LESSON = [
  ["// Week 9 · Full-Stack: MERN", "#9ca3af"],
  ["import express from 'express';", "#c084fc"],
  ["const app = express();", "#e5e7eb"],
  ["app.get('/api/projects', async (req, res) => {", "#e5e7eb"],
  ["  const projects = await Project.find();", "#5eead4"],
  ["  res.json(projects);", "#e5e7eb"],
  ["});", "#e5e7eb"],
  ["", "#e5e7eb"],
  ["export function ProjectList({ projects }) {", "#c084fc"],
  ["  return projects.map((p) => <Card key={p._id} {...p} />);", "#fcd34d"],
  ["}", "#c084fc"],
] as const;

function drawLesson(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = "#15132b";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#1f1c3d";
  ctx.fillRect(0, 0, w, 64);
  [MAGENTA, YELLOW, BLUE].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(30 + i * 26, 32, 8, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = "#e5e7eb";
  ctx.font = font(26, "bold");
  ctx.fillText("server.js · ProjectList.jsx", 120, 42);
  ctx.font = `30px monospace`;
  LESSON.forEach(([t, c], i) => {
    ctx.fillStyle = "#4b4870";
    ctx.fillText(String(i + 1).padStart(2, " "), 26, 120 + i * 46);
    ctx.fillStyle = c;
    ctx.fillText(t, 90, 120 + i * 46);
  });
  box(ctx, w - 420, h - 96, 390, 66, 33, MAGENTA);
  ctx.fillStyle = "#fff";
  ctx.font = font(28, "bold");
  ctx.fillText("Full-Stack Program · MERN", w - 392, h - 52);
}

function drawSprint(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = INK;
  ctx.font = font(44, "bold");
  ctx.fillText("Sprint board", 34, 64);
  ctx.fillStyle = GREY;
  ctx.font = font(22);
  ctx.fillText("Agile · full SDLC · every sprint deadline met", 300, 62);
  const cols: [string, string[], string][] = [
    ["To do", ["Write API tests", "Deploy to Render"], ORANGE],
    ["In progress", ["Cart with Redux", "Auth with JWT"], BLUE],
    ["Review", ["Responsive navbar"], PURPLE],
    ["Done", ["MongoDB schemas", "Figma wireframes", "Sprint demo ✓"], "#16a34a"],
  ];
  cols.forEach(([title, cards, color], i) => {
    const x = 30 + i * ((w - 60) / 4);
    const cw = (w - 60) / 4 - 16;
    box(ctx, x, 96, cw, h - 126, 12, "#f6f6fb");
    ctx.fillStyle = color;
    ctx.fillRect(x, 96, cw, 8);
    ctx.fillStyle = INK;
    ctx.font = font(24, "bold");
    ctx.fillText(title, x + 16, 140);
    cards.forEach((c, k) => {
      const ny = 162 + k * 92;
      box(ctx, x + 12, ny, cw - 24, 76, 10, ["#fff3c4", "#ffd6e7", "#dbe7ff", "#ffe4c7"][(i + k) % 4]);
      ctx.fillStyle = INK;
      ctx.font = font(21);
      wrap(ctx, c, x + 26, ny + 32, cw - 52, 26);
    });
  });
}

const COHORTS: [string, string][] = [
  ["Z01", "Graduates"],
  ["B08", "Graduates"],
  ["T02", "Graduates"],
  ["B06", "Graduates"],
];

/** A cohort's graduation photo, drawn: rows of graduates in caps against the Codi backdrop. */
function drawCohort(ctx: CanvasRenderingContext2D, w: number, h: number, name: string, seed: number) {
  ctx.fillStyle = "#f3f4f8";
  ctx.fillRect(0, 0, w, h);
  drawLogo2d(ctx, w * 0.18, h * 0.28, h * 0.14, true);
  let s = seed * 7919 + 1;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const skins = ["#f1c7a5", "#d8a47f", "#b97a56", "#8d5a3b", "#e9b997"];
  for (let row = 0; row < 3; row++) {
    const n = 7 - row;
    for (let i = 0; i < n; i++) {
      const x = w * 0.12 + (i + row * 0.5) * (w * 0.76) / 7 + (r() - 0.5) * 8;
      const y = h * (0.62 + row * 0.12);
      ctx.fillStyle = RAYS[Math.floor(r() * RAYS.length)];
      ctx.beginPath();
      ctx.ellipse(x, y + h * 0.16, w * 0.045, h * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = skins[Math.floor(r() * skins.length)];
      ctx.beginPath();
      ctx.arc(x, y, h * 0.045, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.fillRect(x - h * 0.055, y - h * 0.06, h * 0.11, h * 0.018);
      ctx.fillRect(x - h * 0.03, y - h * 0.075, h * 0.06, h * 0.025);
    }
  }
  box(ctx, w - 230, 20, 210, 60, 30, INK);
  ctx.fillStyle = "#fff";
  ctx.font = font(30, "bold");
  ctx.fillText(`${name} Grad.`, w - 200, 61);
}

function drawExpo(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, w, h);
  drawLogo2d(ctx, w * 0.2, h * 0.25, h * 0.13, false);
  ctx.fillStyle = "#ffffff";
  ctx.font = font(64, "bold");
  ctx.fillText("Codi's", w * 0.38, h * 0.22);
  ctx.fillText("Talent Expo!", w * 0.38, h * 0.36);
  ctx.fillStyle = YELLOW;
  ctx.font = font(36, "bold");
  ctx.fillText("March 4th 2024", w * 0.38, h * 0.47);
  ctx.fillStyle = "#e5e7eb";
  ctx.font = font(28);
  wrap(ctx, "Graduates demo their projects to hiring partners: recruitment straight from the bootcamp.", 50, h * 0.62, w - 100, 40);
  RAYS.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(i * (w / RAYS.length), h - 18, w / RAYS.length, 18);
  });
}

function drawJourney(ctx: CanvasRenderingContext2D, w: number, h: number, job: Experience) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  RAYS.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(i * (w / RAYS.length), 0, w / RAYS.length, 12);
  });
  ctx.fillStyle = MAGENTA;
  ctx.font = font(26, "bold");
  ctx.fillText("MY BOOTCAMP", 40, 70);
  ctx.fillStyle = INK;
  ctx.font = font(44, "bold");
  ctx.fillText(job.roles[0].title, 40, 124);
  ctx.fillStyle = GREY;
  ctx.font = font(26);
  ctx.fillText(`Aug 2023 – Mar 2024 · ${job.location}`, 40, 164);
  ctx.fillStyle = INK;
  ctx.font = font(26);
  wrap(ctx, job.summary, 40, 214, w - 80, 36);
  ctx.fillStyle = MAGENTA;
  ctx.font = font(90, "bold");
  ctx.fillText("5", 40, 380);
  ctx.fillStyle = INK;
  ctx.font = font(30, "bold");
  ctx.fillText("MERN web apps built and deployed", 110, 352);
  ctx.fillStyle = GREY;
  ctx.font = font(24);
  ctx.fillText("100% of sprint deadlines met", 110, 386);
  for (let i = 0; i < 5; i++) {
    const x = 40 + i * ((w - 80) / 5);
    const cw = (w - 80) / 5 - 16;
    box(ctx, x, 420, cw, 150, 12, "#f6f6fb", RAYS[i]);
    box(ctx, x + 14, 434, cw - 28, 70, 8, RAYS[i] + "33");
    ctx.fillStyle = RAYS[i];
    ctx.fillRect(x + 22, 446, cw * 0.4, 10);
    ctx.fillRect(x + 22, 466, cw * 0.25, 10);
    ctx.fillStyle = INK;
    ctx.font = font(20, "bold");
    ctx.fillText(`App ${i + 1}`, x + 16, 536);
    ctx.fillStyle = GREY;
    ctx.font = font(16);
    ctx.fillText("React · Node · MongoDB", x + 16, 560);
  }
  ctx.fillStyle = INK;
  ctx.font = font(24, "bold");
  ctx.fillText("What I did", 40, 630);
  ctx.font = font(22);
  ctx.fillStyle = "#374151";
  let y = 668;
  for (const hl of job.highlights) y = wrap(ctx, `• ${hl}`, 40, y, w - 80, 30);
  let x = 40;
  y += 14;
  ctx.font = font(21, "bold");
  job.tech.forEach((t, i) => {
    const tw = ctx.measureText(t).width + 32;
    if (x + tw > w - 40) {
      x = 40;
      y += 50;
    }
    box(ctx, x, y, tw, 40, 20, RAYS[i % RAYS.length]);
    ctx.fillStyle = "#fff";
    ctx.fillText(t, x + 16, y + 28);
    x += tw + 10;
  });
}

// ---------------------------------------------------------------------------
// Room
// ---------------------------------------------------------------------------

const S = Math.PI;

/** Classroom: double desks in rows facing the lesson screen (−z). */
const DESKS: { x: number; z: number }[] = [-5.2, -2.8, -0.4].flatMap((z) => [-7.4, -3.2, 1.0, 5.2].map((x) => ({ x, z })));
const CHAIR_DX = [-0.36, 0.36];
const CLASS_SEATS: Seat[] = DESKS.flatMap((d, i) => CHAIR_DX.map((dx, k) => workSeat(`codi-${i}-${k}`, d.x + dx, d.z + DESK_REACH, S)));
const STUDENTS: [string, string][] = [
  ["codi-0-1", "Female_Adult_06"],
  ["codi-2-0", "Male_Adult_07"],
  ["codi-5-1", "Male_Adult_19"],
  ["codi-6-0", "Female_Adult_15"],
  ["codi-9-1", "Male_Adult_04"],
  ["codi-11-0", "Female_Adult_02"],
];
const INSTRUCTOR = workSeat("codi-instructor", -10.4, -8.3, 0);

export function CodiCampus({ job }: { job: Experience }) {
  const f = finishes();
  const lesson = useCanvas(1600, 760, drawLesson);
  const sprint = useCanvas(1400, 640, drawSprint);
  const expo = useCanvas(900, 800, drawExpo);
  const journey = useCanvas(1200, 980, (ctx, w, h) => drawJourney(ctx, w, h, job));
  const laptop = useCanvas(512, 320, (ctx, w, h) => {
    drawLesson(ctx, w, h);
  });

  const free = useMemo(() => {
    const taken = new Set(STUDENTS.map(([id]) => id));
    return [...CLASS_SEATS.filter((s) => !taken.has(s.id)), INSTRUCTOR];
  }, []);
  const people = useMemo(() => {
    const byId = new Map(CLASS_SEATS.map((s) => [s.id, s]));
    return STUDENTS.map(([id, who]) => ({ seat: byId.get(id)!, who }));
  }, []);
  const walkers = useMemo(
    () =>
      makeWalkers("room-codi", "business", [], [
        [
          [-12, 2],
          [12, 2],
          [12, 7.5],
          [-12, 7.5],
        ],
      ]),
    [],
  );

  return (
    <group>
      <ModernShell look={LOOK} />

      {/* Back wall: the lesson, the logo, the sprint board */}
      <OnWall side="back">
        <Panel position={[-9.6, 2.35, -D / 2 + 0.06]} width={6.4} height={3.04} map={lesson.texture} frame="#15132b" />
        <LogoSculpture position={[-1.7, 3.05, -D / 2 + 0.02]} />
        <Text font={TEXT_FONT} position={[0.4, 1.42, -D / 2 + 0.04]} fontSize={0.17} color={GREY} anchorX="center" maxWidth={6} textAlign="center">
          Award-winning, transformative, accessible and holistic coding + leadership education
        </Text>
        <Panel position={[9.6, 2.35, -D / 2 + 0.06]} width={6.2} height={2.83} map={sprint.texture} frame="#e5e7eb" />
      </OnWall>

      {/* Left wall: graduates and the Talent Expo */}
      <OnWall side="left">
        <Text font={TEXT_FONT} position={[-W / 2 + 0.05, 3.55, -2]} rotation-y={Math.PI / 2} fontSize={0.3} color={INK} anchorX="center">
          Our graduates
        </Text>
        {COHORTS.map(([name], i) => (
          <Cohort key={name} name={name} index={i} />
        ))}
        <Panel position={[-W / 2 + 0.06, 2.45, 6.6]} rotationY={Math.PI / 2} width={2.8} height={2.49} map={expo.texture} frame={INK} />
      </OnWall>

      {/* Right wall: her bootcamp */}
      <OnWall side="right">
        <Panel position={[W / 2 - 0.06, 2.15, 2.2]} rotationY={-Math.PI / 2} width={3.6} height={2.94} map={journey.texture} frame="#e5e7eb" />
      </OnWall>
      <OnWall side="front">{job.plaque && <Plaque text={job.plaque} x={-3.2} />}</OnWall>

      {/* Classroom */}
      <Batch>
        {DESKS.map((d, i) => (
          <group key={i} position={[d.x, 0, d.z]} rotation-y={S}>
            <Desk width={1.5} depth={0.7} pedestal={false} />
          </group>
        ))}
        {CLASS_SEATS.map((s, i) => (
          <ConferenceChair key={s.id} position={[s.x, 0, s.z]} facing={s.facing} color={RAYS[Math.floor(i / 2) % RAYS.length]} />
        ))}
        {/* Laptops (bases) */}
        {CLASS_SEATS.map((s) => {
          const [lx, lz] = ahead(s.x, s.z, s.facing, 0.6);
          return (
            <group key={`lap${s.id}`} position={[lx, DESK_TOP, lz]} rotation-y={s.facing}>
              <mesh position={[0, 0.008, 0]} material={f.chrome}>
                <boxGeometry args={[0.32, 0.015, 0.22]} />
              </mesh>
              <mesh position={[0, 0.11, 0.11]} rotation-x={0.25} material={f.chrome}>
                <boxGeometry args={[0.32, 0.21, 0.01]} />
              </mesh>
            </group>
          );
        })}
        {/* Instructor's desk by the lesson screen */}
        <group position={[INSTRUCTOR.x, 0, INSTRUCTOR.z + DESK_REACH]}>
          <Desk width={1.6} />
        </group>
        <ExecChair position={[INSTRUCTOR.x, 0, INSTRUCTOR.z]} facing={0} leather="black" />
        {/* Lounge corner with beanbags */}
        <BeanBag position={[9.4, 0, 7.6]} color={MAGENTA} />
        <BeanBag position={[10.6, 0, 8.4]} color={YELLOW} />
        <BeanBag position={[11.6, 0, 7.3]} color={BLUE} />
        <BeanBag position={[10.2, 0, 6.4]} color={ORANGE} />
        {[
          [-13.6, -9.2],
          [13.6, -9.2],
          [-13.6, 9.2],
          [13.6, 9.2],
          [4, 9.6],
        ].map(([x, z], i) => (
          <TallPlant key={i} position={[x, 0, z]} seed={i + 30} />
        ))}
      </Batch>
      {DESKS.map((d, i) => (
        <Block key={i} position={[d.x, 0.375, d.z]} size={[1.5, 0.75, 0.7]} />
      ))}
      <Block position={[INSTRUCTOR.x, 0.375, INSTRUCTOR.z + DESK_REACH]} size={[1.6, 0.75, 0.8]} />
      {/* Laptop screens show the lesson */}
      {CLASS_SEATS.map((s) => {
        const [lx, lz] = ahead(s.x, s.z, s.facing, 0.6);
        return (
          <group key={`scr${s.id}`} position={[lx, DESK_TOP, lz]} rotation-y={s.facing}>
            <mesh position={[0, 0.11, 0.104]} rotation-x={0.25} rotation-y={Math.PI}>
              <planeGeometry args={[0.29, 0.18]} />
              <meshBasicMaterial map={laptop.texture} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
      <GradCap position={[11.2, 0, -1.6]} />

      {people.map(({ seat, who }) => (
        <Suspense key={seat.id} fallback={null}>
          <SeatedPerson id={who} seat={seat} />
        </Suspense>
      ))}
      <Seats seats={free} />
      <Pedestrians walkers={walkers} />
    </group>
  );
}

function Cohort({ name, index }: { name: string; index: number }) {
  const { texture } = useCanvas(800, 520, (ctx, w, h) => drawCohort(ctx, w, h, name, index + 1), name);
  return (
    <Panel
      position={[-W / 2 + 0.06, 2.45, -8.2 + index * 3.1]}
      rotationY={Math.PI / 2}
      width={2.7}
      height={1.76}
      map={texture}
      frame={INK}
      onClick={(e) => {
        e.stopPropagation();
        sfx.pop();
        useCityStore.getState().toast("Another cohort of full-stack developers, ready for the job market.", `${name} graduates 🎓`);
      }}
    />
  );
}

/** A graduation cap and rolled diploma on a plinth. Click to graduate. */
function GradCap({ position }: { position: [number, number, number] }) {
  const cap = useRef<THREE.Group>(null);
  const toss = useRef(-10);
  const pending = useRef(false);
  useFrame(({ clock }) => {
    if (pending.current) {
      pending.current = false;
      toss.current = clock.elapsedTime;
    }
    const age = clock.elapsedTime - toss.current;
    if (cap.current) {
      cap.current.position.y = 1.32 + (age < 1.2 ? Math.sin((age / 1.2) * Math.PI) * 0.9 : 0);
      cap.current.rotation.y = age < 1.2 ? age * 9 : 0.4;
    }
  });
  return (
    <group position={position}>
      <mesh position={[0, 0.55, 0]} material={plain("#ffffff", 0.4)} castShadow>
        <cylinderGeometry args={[0.42, 0.46, 1.1, 32]} />
      </mesh>
      <mesh position={[0, 1.1, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.3, 0.4, 40]} />
        <meshStandardMaterial color={MAGENTA} emissive={MAGENTA} emissiveIntensity={0.8} toneMapped={false} />
      </mesh>
      <group
        ref={cap}
        position={[0, 1.32, 0]}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          pending.current = true;
          sfx.sparkle();
          emitBurst({ position: new THREE.Vector3(position[0], 2.2, position[2]), kind: "sparkle", count: 26, colors: RAYS, spread: 1 });
          useCityStore.getState().toast("Full Stack Developer Trainee → full-stack developer. 5 MERN apps shipped.", "Graduated! 🎓");
        }}
      >
        <mesh material={plain(INK, 0.5)}>
          <cylinderGeometry args={[0.15, 0.16, 0.1, 24]} />
        </mesh>
        <mesh position={[0, 0.06, 0]} rotation-y={Math.PI / 4} material={plain(INK, 0.5)} castShadow>
          <boxGeometry args={[0.42, 0.02, 0.42]} />
        </mesh>
        <mesh position={[0.17, -0.02, 0.17]} material={plain(YELLOW, 0.5)}>
          <cylinderGeometry args={[0.006, 0.006, 0.16, 6]} />
        </mesh>
      </group>
      <mesh position={[0.18, 1.14, -0.12]} rotation-z={Math.PI / 2} rotation-y={0.4} material={plain("#fdf6e3", 0.6)}>
        <cylinderGeometry args={[0.035, 0.035, 0.34, 16]} />
      </mesh>
      <mesh position={[0.18, 1.14, -0.12]} rotation-z={Math.PI / 2} rotation-y={0.4} material={plain(MAGENTA, 0.5)}>
        <cylinderGeometry args={[0.038, 0.038, 0.04, 16]} />
      </mesh>
      <Text font={TEXT_FONT} position={[0, 0.6, 0.47]} fontSize={0.09} color={INK} anchorX="center">
        CLASS OF 2024
      </Text>
      <Block position={[0, 0.55, 0]} size={[0.9, 1.1, 0.9]} />
    </group>
  );
}
