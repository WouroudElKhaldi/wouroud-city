"use client";

import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Experience } from "@/content/schema";
import { useCityStore, type Seat } from "@/state/useCityStore";
import { playerState } from "@/world/env";
import { LIFE_ROOM } from "@/world/interiors";
import { sfx } from "@/world/sfx";
import {
  ahead,
  Batch,
  Block,
  DESK_REACH,
  Desk,
  DeskSet,
  ExecChair,
  FloorLamp,
  plain,
  SeatedPerson,
  SideChair,
  Sofa,
  sofaSeats,
  Table,
  TallPlant,
  workSeat,
} from "./Furniture";
import { OnWall, Plaque } from "./InteriorScene";
import { finishes } from "./luxury";
import { emitBurst } from "./Particles";
import { makeWalkers, Pedestrians } from "./Pedestrians";
import { box, font, ModernShell, Panel, type ShellLook, useCanvas, wrap } from "./roomKit";
import { Seats } from "./StreetDetails";
import { useProximity } from "./useProximity";
import { TEXT_FONT } from "@/world/fonts";
import { Text } from "./Text3D";

/**
 * Life Sculptor, a student-led initiative giving students free virtual sessions to improve
 * their social and academic life ("Visualise. Act. Thrive."), where Wouroud volunteered as
 * full-stack developer and UI/UX designer of the website. In the live site's colors (mint,
 * navy, lavender): the hero and its numbers, a studio for the virtual sessions, the
 * departments, the volunteers' wall of stars, a study corner, and her website work. Her
 * redesign isn't online: the team went back to the old design, which is what the wall shows.
 */

const W = LIFE_ROOM.width;
const D = LIFE_ROOM.depth;

const NAVY = "#182d48";
const MINT = "#defffe";
const MINT_DEEP = "#7fe3d8";
const TEAL = "#2bb3a3";
const LAVENDER = "#f4f6ff";
const CLOVER = "#3fae5a";
const GREY = "#5b6b80";

const LOOK: ShellLook = {
  floor: "terrazzo",
  chips: [NAVY, TEAL, "#b9c6ff", "#9aa5b1"],
  wall: LAVENDER,
  wainscot: NAVY,
  line: TEAL,
  ceiling: "#ffffff",
  column: "#dfe6f7",
  columnsZ: [-D / 2 + 0.2, D / 2 - 0.2],
  windowsZ: [],
  lightsX: [-6, 0, 6],
  lightsZ: [-1, 5],
  lamps: [
    [-6, -3],
    [6, -3],
    [0, 4],
    [-7, 5],
    [7, 5],
  ],
  lampColor: "#f6fffd",
};

// ---------------------------------------------------------------------------
// Drawing (the live site's look)
// ---------------------------------------------------------------------------

/** The Life Sculptor mark: a laurel of leaves around a graduation cap. */
function drawMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.strokeStyle = TEAL;
  ctx.fillStyle = TEAL;
  ctx.lineWidth = s * 0.06;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 2 + side * (0.5 + i * 0.32);
      const x = cx + Math.cos(a) * s;
      const y = cy + Math.sin(a) * s * 0.9;
      ctx.beginPath();
      ctx.ellipse(x, y, s * 0.16, s * 0.07, a + side * 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = NAVY;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.55, cy - s * 0.05);
  ctx.lineTo(cx, cy - s * 0.32);
  ctx.lineTo(cx + s * 0.55, cy - s * 0.05);
  ctx.lineTo(cx, cy + s * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(cx - s * 0.28, cy + s * 0.05, s * 0.56, s * 0.22);
}

function drawHero(ctx: CanvasRenderingContext2D, w: number, h: number, p = 1) {
  ctx.fillStyle = MINT;
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w * 0.8, h * 0.2, 0, w * 0.8, h * 0.2, w * 0.5);
  g.addColorStop(0, "rgba(43,179,163,0.18)");
  g.addColorStop(1, "rgba(43,179,163,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  drawMark(ctx, 120, 120, 70);
  ctx.fillStyle = NAVY;
  ctx.font = font(96, "bold");
  ctx.fillText("LIFE SCULPTOR", 230, 150);
  ctx.fillStyle = TEAL;
  ctx.font = font(48, "bold");
  ctx.fillText("Visualise. Act. Thrive.", 236, 220);
  ctx.fillStyle = GREY;
  ctx.font = font(30);
  ctx.fillText("Free virtual sessions to help students improve their social and academic life 🍀", 236, 272);
  const stats: [number, string][] = [
    [3000, "students"],
    [700, "volunteers"],
    [5800, "certificates issued"],
  ];
  stats.forEach(([n, label], i) => {
    const x = 120 + i * 470;
    box(ctx, x, 330, 420, 200, 20, "#ffffff", "#c9f2ee", 3);
    ctx.fillStyle = NAVY;
    ctx.font = font(84, "bold");
    ctx.fillText(`${Math.round(n * p)}+`, x + 36, 440);
    ctx.fillStyle = GREY;
    ctx.font = font(32);
    ctx.fillText(label, x + 40, 494);
  });
}

const DEPARTMENTS: [string, string, string][] = [
  ["STEM & TECHNOLOGY", "Life Coders Department", "Coding sessions and tech skills for students."],
  ["SOCIAL SCIENCES", "Psychosocial Club", "Wellbeing, confidence and social skills."],
  ["EDUCATION & SKILL DEVELOPMENT", "Academics Department", "Study skills and academic support."],
];

function drawDepartment(ctx: CanvasRenderingContext2D, w: number, h: number, [tag, name, text]: [string, string, string]) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  box(ctx, 24, 24, w - 48, h * 0.38, 16, MINT);
  drawMark(ctx, w / 2, h * 0.22, 60);
  ctx.fillStyle = TEAL;
  ctx.font = font(22, "bold");
  ctx.fillText(tag, 30, h * 0.5);
  ctx.fillStyle = NAVY;
  ctx.font = font(38, "bold");
  ctx.fillText(name, 30, h * 0.6);
  ctx.fillStyle = GREY;
  ctx.font = font(26);
  wrap(ctx, text, 30, h * 0.7, w - 60, 34);
  ctx.fillStyle = GREY;
  ctx.font = font(24);
  ctx.fillText("Life Sculptor", 30, h - 40);
  box(ctx, w - 130, h - 76, 100, 48, 24, TEAL);
  ctx.fillStyle = "#fff";
  ctx.font = font(24, "bold");
  ctx.fillText("Free", w - 106, h - 43);
}

const WHY: [string, string][] = [
  ["Student-led", "We understand the needs of students and cater to them."],
  ["Trademarked", "A governmentally trademarked, trustworthy initiative."],
  ["Variety", "Departments shaped by the demands of the job market."],
  ["Achievements", "Workshops and volunteering for individual growth."],
];

function drawWhy(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = MINT_DEEP;
  ctx.font = font(26, "bold");
  ctx.fillText("WHY CHOOSE US", 40, 64);
  ctx.fillStyle = "#ffffff";
  ctx.font = font(52, "bold");
  ctx.fillText("Learn the skills you need to succeed", 40, 130);
  WHY.forEach(([t, d], i) => {
    const x = 40 + (i % 2) * ((w - 80) / 2);
    const y = 180 + Math.floor(i / 2) * 150;
    box(ctx, x, y, (w - 80) / 2 - 20, 130, 16, "rgba(222,255,254,0.08)", "rgba(127,227,216,0.4)");
    ctx.fillStyle = MINT_DEEP;
    ctx.font = font(32, "bold");
    ctx.fillText(t, x + 24, y + 50);
    ctx.fillStyle = "#dbe4f0";
    ctx.font = font(23);
    wrap(ctx, d, x + 24, y + 90, (w - 80) / 2 - 70, 30);
  });
}

/** The live website (the old design the team went back to), in miniature. */
function drawLiveSite(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = MINT;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = NAVY;
  ctx.font = font(18);
  ctx.fillText("☰", 24, 34);
  ctx.textAlign = "center";
  ctx.font = font(44, "bold");
  ctx.fillText("LIFE SCULPTOR", w / 2, 120);
  ctx.fillStyle = TEAL;
  ctx.font = font(24, "bold");
  ctx.fillText("Visualise. Act. Thrive.", w / 2, 160);
  ctx.fillStyle = NAVY;
  ctx.font = font(30, "bold");
  ctx.fillText("Learn the Skills you Need to Succeed", w / 2, 230);
  ctx.textAlign = "left";
  ["Student-led", "Flexible", "Variety", "Achievements"].forEach((t, i) => {
    const x = 30 + i * ((w - 60) / 4);
    box(ctx, x, 260, (w - 60) / 4 - 14, 110, 10, "#ffffff");
    ctx.fillStyle = NAVY;
    ctx.font = font(18, "bold");
    ctx.fillText(t, x + 14, 296);
    ctx.fillStyle = GREY;
    ctx.fillRect(x + 14, 312, (w - 60) / 4 - 50, 6);
    ctx.fillRect(x + 14, 326, (w - 60) / 4 - 70, 6);
  });
  ["3000+", "700+", "5800+"].forEach((n, i) => {
    ctx.fillStyle = NAVY;
    ctx.font = font(34, "bold");
    ctx.fillText(n, 70 + i * ((w - 60) / 3), 430);
  });
  DEPARTMENTS.forEach(([, name], i) => {
    const x = 30 + i * ((w - 60) / 3);
    box(ctx, x, 460, (w - 60) / 3 - 14, h - 490, 10, "#ffffff");
    ctx.fillStyle = NAVY;
    ctx.font = font(16, "bold");
    ctx.fillText(name, x + 12, 490);
  });
}

function drawMyWork(ctx: CanvasRenderingContext2D, w: number, h: number, job: Experience) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = TEAL;
  ctx.fillRect(0, 0, w, 12);
  ctx.fillStyle = TEAL;
  ctx.font = font(26, "bold");
  ctx.fillText("MY ROLE · VOLUNTEER", 40, 70);
  ctx.fillStyle = NAVY;
  ctx.font = font(42, "bold");
  ctx.fillText(job.roles[0].title, 40, 124);
  ctx.fillStyle = GREY;
  ctx.font = font(25);
  ctx.fillText(`Feb – Apr 2024 · ${job.location} · remote`, 40, 162);
  ctx.fillStyle = NAVY;
  ctx.font = font(26);
  let y = wrap(ctx, job.summary, 40, 214, w - 80, 36) + 10;
  ctx.font = font(24);
  ctx.fillStyle = "#334155";
  for (const hl of job.highlights) y = wrap(ctx, `• ${hl}`, 40, y, w - 80, 32) + 6;
  y += 10;
  let x = 40;
  ctx.font = font(21, "bold");
  for (const t of job.tech) {
    const tw = ctx.measureText(t).width + 32;
    if (x + tw > w - 40) {
      x = 40;
      y += 50;
    }
    box(ctx, x, y, tw, 40, 20, MINT, TEAL);
    ctx.fillStyle = NAVY;
    ctx.fillText(t, x + 16, y + 28);
    x += tw + 10;
  }
  y += 80;
  box(ctx, 40, y, w - 80, h - y - 30, 16, "#fff7e6", "#f5c46b");
  ctx.fillStyle = "#8a5a00";
  ctx.font = font(24, "bold");
  ctx.fillText("Note", 64, y + 42);
  ctx.fillStyle = "#5c4400";
  ctx.font = font(22);
  wrap(ctx, "My redesign isn't online right now: the team went back to the old design, which is the site shown here.", 64, y + 80, w - 140, 30);
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

/** The hero wall; its numbers count up as you come near. */
function HeroWall() {
  const { ctx, texture } = useCanvas(1600, 600, (c, w, h) => drawHero(c, w, h, 0.02));
  const progress = useRef(0);
  const drawn = useRef(-1);
  useFrame((_, delta) => {
    const near = playerState.position.z < 4;
    progress.current = near ? Math.min(1, progress.current + delta / 1.6) : Math.max(0, progress.current - delta / 3);
    const step = Math.round((1 - (1 - progress.current) ** 3) * 50);
    if (step !== drawn.current) {
      drawn.current = step;
      drawHero(ctx, 1600, 600, Math.max(0.02, step / 50));
      texture.needsUpdate = true;
    }
  });
  return (
    <OnWall side="back">
      <Panel position={[0, 2.3, -D / 2 + 0.06]} width={8} height={3} map={texture} frame={NAVY} />
    </OnWall>
  );
}

/** The studio for the free virtual sessions: a call screen, ring light, mic and the host's desk. */
function SessionStudio({ position }: { position: [number, number, number] }) {
  const f = finishes();
  const call = useCanvas(1280, 720, (ctx, w, h) => {
    ctx.fillStyle = "#0f1b2d";
    ctx.fillRect(0, 0, w, h);
    const names = ["Host", "Maya", "Omar", "Lina", "Karim", "Nour", "Rami", "Sara", "Hadi"];
    const colors = [TEAL, "#6c8cff", "#f59e0b", "#ec4899", "#22c55e", "#a78bfa", "#38bdf8", "#f97316", "#14b8a6"];
    names.forEach((n, i) => {
      const cw = (w - 80) / 3;
      const ch = (h - 160) / 3;
      const x = 20 + (i % 3) * (cw + 20);
      const y = 20 + Math.floor(i / 3) * (ch + 20);
      box(ctx, x, y, cw, ch, 12, "#1b2a42", i === 0 ? MINT_DEEP : undefined, 4);
      ctx.fillStyle = colors[i];
      ctx.beginPath();
      ctx.arc(x + cw / 2, y + ch / 2 - 8, ch * 0.26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = font(ch * 0.2, "bold");
      ctx.textAlign = "center";
      ctx.fillText(n[0], x + cw / 2, y + ch / 2 + ch * 0.06);
      ctx.font = font(22);
      ctx.fillText(n, x + cw / 2, y + ch - 14);
      ctx.textAlign = "left";
    });
    box(ctx, 20, h - 110, w - 40, 90, 14, "#1b2a42");
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(60, h - 65, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = font(28, "bold");
    ctx.fillText("LIVE · Workshop: Study smarter, not harder · free virtual session", 86, h - 55);
  });
  const where = useMemo(() => new THREE.Vector3(position[0], 0, position[2]), [position]);
  const pop = () => {
    sfx.talk();
    useCityStore.getState().toast("Every session is free and online: workshops, volunteer-led clubs and Q&As for students.", "Live session");
  };
  useProximity({ id: "ls-session", label: "Join the session", radius: 2.2, where, run: pop });
  return (
    <group position={position}>
      <Panel position={[0, 2.5, -0.15]} width={3.6} height={2.03} map={call.texture} frame="#0f1b2d" onClick={(e) => {
          e.stopPropagation();
          pop();
        }}
      />
      {/* Ring light on a tripod, and a podcast mic on the desk */}
      <group position={[1.3, 0, 1.3]}>
        {[0, 2.1, 4.2].map((a) => (
          <mesh key={a} position={[Math.sin(a) * 0.18, 0.6, Math.cos(a) * 0.18]} rotation={[Math.cos(a) * 0.28, 0, -Math.sin(a) * 0.28]} material={f.blackMetal}>
            <cylinderGeometry args={[0.012, 0.012, 1.25, 6]} />
          </mesh>
        ))}
        <mesh position={[0, 1.55, 0]} rotation-y={0.6} material={f.shade}>
          <torusGeometry args={[0.28, 0.03, 10, 40]} />
        </mesh>
      </group>
    </group>
  );
}


/** Volunteer stars: gold stars on the wall; click one to thank a volunteer. */
function VolunteerStars() {
  const stars = useMemo(() => {
    let s = 3;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    return Array.from({ length: 26 }, () => ({ z: -3.4 + r() * 6.8, y: 1.6 + r() * 2.4, s: 0.12 + r() * 0.12, a: r() * Math.PI }));
  }, []);
  const shape = useMemo(() => {
    const sh = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rad = i % 2 ? 0.45 : 1;
      if (i === 0) sh.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
      else sh.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    sh.closePath();
    return sh;
  }, []);
  const gold = useMemo(() => new THREE.MeshStandardMaterial({ color: "#f5c242", metalness: 0.6, roughness: 0.3, emissive: "#7a5a10", emissiveIntensity: 0.2 }), []);
  return (
    <OnWall side="left">
      <Text font={TEXT_FONT} position={[-W / 2 + 0.05, 4.3, 0]} rotation-y={Math.PI / 2} fontSize={0.34} color={NAVY} anchorX="center">
        Volunteer Stars ⭐ 700+ volunteers
      </Text>
      {stars.map((st, i) => (
        <mesh
          key={i}
          position={[-W / 2 + 0.05, st.y, st.z]}
          rotation={[0, Math.PI / 2, st.a]}
          scale={st.s}
          material={gold}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            sfx.sparkle();
            emitBurst({ position: new THREE.Vector3(-W / 2 + 0.3, st.y, st.z), kind: "sparkle", count: 12, colors: ["#f5c242", TEAL], spread: 0.5 });
            useCityStore.getState().toast("Students teaching students: thank you, volunteer! ⭐", "Volunteer star");
          }}
        >
          <extrudeGeometry args={[shape, { depth: 0.15, bevelEnabled: false }]} />
        </mesh>
      ))}
    </OnWall>
  );
}

// ---------------------------------------------------------------------------
// Room
// ---------------------------------------------------------------------------

const S = Math.PI;

/** The study table: six guest chairs around it. */
const STUDY = { x: -5.5, z: 4.6, width: 2.4 };
const STUDY_SEATS: Seat[] = [-0.8, 0, 0.8].flatMap((dx, i) => [
  workSeat(`ls-study-n${i}`, STUDY.x + dx, STUDY.z - 0.45 - (DESK_REACH - 0.4), 0),
  workSeat(`ls-study-s${i}`, STUDY.x + dx, STUDY.z + 0.45 + (DESK_REACH - 0.4), S),
]);
const STUDENTS: [string, string][] = [
  ["ls-study-n0", "Female_Adult_17"],
  ["ls-study-s2", "Male_Adult_16"],
];
const HOST = workSeat("ls-host", -9.6, -4.4, S);
const SOFA = { id: "ls-sofa", x: 6.5, z: 8.9, facing: S, length: 2.4 };

export function LifeSculptorHub({ job }: { job: Experience }) {
  const f = finishes();
  const why = useCanvas(1400, 520, drawWhy);
  const live = useCanvas(1000, 640, drawLiveSite);
  const work = useCanvas(1000, 1120, (ctx, w, h) => drawMyWork(ctx, w, h, job));
  const hostScreen = useCanvas(512, 300, (ctx, w, h) => drawLiveSite(ctx, w, h));

  const people = useMemo(() => {
    const byId = new Map(STUDY_SEATS.map((s) => [s.id, s]));
    return STUDENTS.map(([id, who]) => ({ seat: byId.get(id)!, who }));
  }, []);
  const free = useMemo(() => {
    const taken = new Set(STUDENTS.map(([id]) => id));
    return [...STUDY_SEATS.filter((s) => !taken.has(s.id)), HOST, ...sofaSeats(SOFA.id, SOFA.x, SOFA.z, SOFA.facing, SOFA.length)];
  }, []);
  const walkers = useMemo(
    () =>
      makeWalkers("room-life", "business", [], [
        [
          [-9, 1],
          [9, 1],
          [9, 6.8],
          [-1, 6.8],
        ],
      ]),
    [],
  );
  const [deskX, deskZ] = ahead(HOST.x, HOST.z, HOST.facing, DESK_REACH);

  return (
    <group>
      <ModernShell look={LOOK} />
      <HeroWall />
      <VolunteerStars />

      {/* Departments on the right wall */}
      <OnWall side="right">
        <Text font={TEXT_FONT} position={[W / 2 - 0.05, 4.2, -3]} rotation-y={-Math.PI / 2} fontSize={0.32} color={NAVY} anchorX="center">
          Some of our Departments
        </Text>
        {DEPARTMENTS.map((d, i) => (
          <Department key={d[1]} dept={d} z={-6.2 + i * 3.2} />
        ))}
        <Panel position={[W / 2 - 0.06, 2.5, 5.2]} rotationY={-Math.PI / 2} width={3.2} height={2.05} map={live.texture} frame={NAVY} />
        <Text font={TEXT_FONT} position={[W / 2 - 0.05, 1.3, 5.2]} rotation-y={-Math.PI / 2} fontSize={0.13} color={GREY} anchorX="center">
          life-sculptor.vercel.app · the live (old) design
        </Text>
      </OnWall>

      {/* Front wall: why choose us, and her work on the website */}
      <OnWall side="front">
        <Panel position={[-6.8, 2.7, D / 2 - 0.06]} rotationY={Math.PI} width={6.2} height={2.3} map={why.texture} frame={NAVY} />
        <Panel position={[7.0, 2.5, D / 2 - 0.06]} rotationY={Math.PI} width={3.1} height={3.47} map={work.texture} frame="#e2e8f0" />
        {job.plaque && <Plaque text={job.plaque} x={-3.2} />}
      </OnWall>

      <SessionStudio position={[-9.6, 0, -D / 2 + 0.2]} />

      <Batch>
        {/* The host's desk for the sessions */}
        <group position={[deskX, 0, deskZ]} rotation-y={HOST.facing}>
          <Desk width={1.6} />
          <DeskSet screens={[hostScreen.texture]} extras={["laptop", "mug", "plant"]} />
        </group>
        <ExecChair position={[HOST.x, 0, HOST.z]} facing={HOST.facing} leather="cream" />
        {/* Study table */}
        <Table position={[STUDY.x, 0, STUDY.z]} width={STUDY.width} depth={0.9} top="walnut" />
        {STUDY_SEATS.map((s) => (
          <SideChair key={s.id} position={[s.x, 0, s.z]} facing={s.facing} leather="cream" />
        ))}
        {STUDY_SEATS.map((s, i) => {
          const [nx, nz] = ahead(s.x, s.z, s.facing, 0.62);
          return (
            <group key={`nb${s.id}`} position={[nx, 0.745, nz]} rotation-y={s.facing + i * 0.1}>
              <mesh material={plain(i % 2 ? TEAL : NAVY, 0.6)}>
                <boxGeometry args={[0.2, 0.012, 0.27]} />
              </mesh>
              <mesh position={[0.06, 0.008, 0.02]} rotation-y={0.5} rotation-z={Math.PI / 2} material={f.brass}>
                <cylinderGeometry args={[0.005, 0.005, 0.13, 6]} />
              </mesh>
            </group>
          );
        })}
        {/* Lounge */}
        <Sofa position={[SOFA.x, 0, SOFA.z]} facing={SOFA.facing} length={SOFA.length} leather="emerald" />
        <Table position={[SOFA.x, 0, SOFA.z - 1.25]} width={0.8} height={0.42} top="marbleWhite" />
        <FloorLamp position={[SOFA.x + 1.7, 0, SOFA.z + 0.2]} />
        {[
          [-11.4, -8.2],
          [11.4, -8.2],
          [-11.4, 8.2],
          [11.4, 8.4],
          [5.6, -9.0],
          [-5.4, -9.0],
        ].map(([x, z], i) => (
          <TallPlant key={i} position={[x, 0, z]} seed={i + 40} />
        ))}
      </Batch>
      <Block position={[deskX, 0.38, deskZ]} size={[1.6, 0.76, 0.8]} rotationY={HOST.facing} />
      <Clover position={[2.6, 0, 2.2]} />

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

function Department({ dept, z }: { dept: [string, string, string]; z: number }) {
  const { texture } = useCanvas(600, 760, (ctx, w, h) => drawDepartment(ctx, w, h, dept), dept[1]);
  return (
    <Panel
      position={[W / 2 - 0.06, 2.35, z]}
      rotationY={-Math.PI / 2}
      width={2.0}
      height={2.53}
      map={texture}
      frame="#e2e8f0"
      onClick={(e) => {
        e.stopPropagation();
        sfx.pop();
        useCityStore.getState().toast(`${dept[2]} Free, online, run by student volunteers.`, dept[1]);
      }}
    />
  );
}

/** A big four-leaf clover on a stem (the 🍀 of the bio), turning slowly. Click it for luck. */
function Clover({ position }: { position: [number, number, number] }) {
  const group = useRef<THREE.Group>(null);
  const spin = useRef(0);
  useFrame((_, delta) => {
    spin.current = Math.max(0, spin.current - delta * 2);
    if (group.current) group.current.rotation.y += delta * (0.3 + spin.current * 5);
  });
  const leaf = plain(CLOVER, 0.5);
  return (
    <group position={position}>
      <mesh position={[0, 0.3, 0]} material={plain(NAVY, 0.4)} castShadow>
        <cylinderGeometry args={[0.6, 0.66, 0.6, 32]} />
      </mesh>
      <mesh position={[0, 0.61, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.45, 0.58, 40]} />
        <meshStandardMaterial color={TEAL} emissive={TEAL} emissiveIntensity={0.9} toneMapped={false} />
      </mesh>
      <group
        ref={group}
        position={[0, 0.6, 0]}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          spin.current = 1.6;
          sfx.sparkle();
          emitBurst({ position: new THREE.Vector3(position[0], 2, position[2]), kind: "sparkle", count: 18, colors: [CLOVER, MINT_DEEP], spread: 0.8 });
          useCityStore.getState().toast("Visualise. Act. Thrive. 🍀", "Good luck in your studies!");
        }}
      >
        <mesh position={[0, 0.6, 0]} material={plain("#2f7d43", 0.6)}>
          <cylinderGeometry args={[0.03, 0.04, 1.2, 8]} />
        </mesh>
        {[0, 1, 2, 3].map((k) => (
          <group key={k} position={[0, 1.25, 0]} rotation-y={(k * Math.PI) / 2}>
            {[-0.13, 0.13].map((dx) => (
              <mesh key={dx} position={[dx, 0.12, 0.22]} rotation-x={-0.95} scale={[1, 0.22, 1]} material={leaf} castShadow>
                <sphereGeometry args={[0.2, 18, 12]} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
      <Block position={[0, 0.8, 0]} size={[1.2, 1.6, 1.2]} />
    </group>
  );
}
