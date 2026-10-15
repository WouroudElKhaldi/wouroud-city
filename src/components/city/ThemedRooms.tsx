"use client";

import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { liveContent } from "@/content/live";
import type { Education, Hobby, Language, Skill, Training } from "@/content/schema";
import { type Activity, useCityStore, type Seat } from "@/state/useCityStore";
import type { DistrictId } from "@/world/districts";
import { signatureFor } from "@/world/signatures";
import { sfx } from "@/world/sfx";
import { Emblem } from "./Emblems";
import { Bookcase, FloorLamp, Painting, Rug, SideChair, Sofa, sofaSeats, Table, TallPlant } from "./Furniture";
import { OnWall, useRoom } from "./InteriorScene";
import { emitBurst } from "./Particles";
import { box, font, Panel, useCanvas, wrap } from "./roomKit";
import { ShopRoom } from "./Shops";
import { SkillCenterpiece, SkillDressing, skillTheme } from "./SkillRooms";
import { Seats } from "./StreetDetails";
import { Text } from "./Text3D";
import { useProximity } from "./useProximity";

/**
 * Rooms for every district that isn't an office or a project studio, built from the
 * building's content and each with things to do:
 *  - Skills: a lab with a holographic emblem, a level meter you can charge, and boards of
 *    where the skill was used
 *  - Campus: a lecture hall with a chalkboard that writes the course notes, and a cap to toss
 *  - Training: a certificate gallery with the course list and a medal to spin
 *  - Languages: a café where the greeting is spoken aloud and the espresso machine steams
 *  - Hobbies: a studio per hobby (easel, camera, bookshelves, a crochet corner…)
 *  - Arcade: a game hall with the cabinet for that building's game, or the rally garage
 */
export function ThemedRoom({ district, id, accent, label }: { district: DistrictId; id: string; accent: string; label: string }) {
  const c = liveContent;
  if (id.startsWith("filler-")) return <ShopRoom label={label} />;
  switch (district) {
    case "skills": {
      const skill = c.skills.find((s) => s.id === id);
      return skill ? <SkillLab skill={skill} accent={accent} /> : null;
    }
    case "campus": {
      const edu = c.education.find((e) => e.id === id);
      return edu ? <LectureHall edu={edu} accent={accent} /> : null;
    }
    case "training": {
      const t = c.trainings.find((x) => x.id === id);
      return t ? <CertificateGallery t={t} accent={accent} /> : null;
    }
    case "languages": {
      const l = c.languages.find((x) => x.id === id);
      return l ? <LanguageCafe lang={l} accent={accent} /> : null;
    }
    case "hobbies": {
      const h = c.hobbies.find((x) => x.id === id);
      return h ? <HobbyStudio hobby={h} accent={accent} /> : null;
    }
    case "arcade":
      return <GameHall id={id} accent={accent} />;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

/** Colors for the paintings on the walls. */
const ART = ["#7c3aed", "#d53f8c", "#f6c453", "#5eead4", "#1a103d", "#fb923c"];

const pointer = {
  onPointerOver: () => (document.body.style.cursor = "pointer"),
  onPointerOut: () => (document.body.style.cursor = ""),
};
const isClick = (e: ThreeEvent<MouseEvent>) => e.delta <= 6;

/** A canvas board: a heading and bullet lines, in the room's accent. */
function Board({
  position,
  rotationY = 0,
  width,
  height,
  kicker,
  title,
  lines,
  accent,
  dark = false,
}: {
  position: [number, number, number];
  rotationY?: number;
  width: number;
  height: number;
  kicker?: string;
  title: string;
  lines: string[];
  accent: string;
  dark?: boolean;
}) {
  const px = 220;
  const { texture } = useCanvas(
    Math.round(width * px),
    Math.round(height * px),
    (ctx, w, h) => {
      ctx.fillStyle = dark ? "#1d2a24" : "#fbf8f1";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = accent;
      ctx.fillRect(0, 0, w, 14);
      let y = 74;
      ctx.textBaseline = "alphabetic";
      if (kicker) {
        ctx.fillStyle = dark ? "#cfe3d6" : accent;
        ctx.font = font(36, "700");
        ctx.fillText(kicker.toUpperCase(), 44, y);
        y += 70;
      }
      ctx.fillStyle = dark ? "#f4f1ea" : "#1a103d";
      ctx.font = font(84, "800");
      y = wrap(ctx, title, 44, y + 20, w - 88, 92) + 6;
      ctx.font = font(42);
      for (const line of lines) {
        if (y > h - 50) break;
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(58, y - 4, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = dark ? "#e8efe9" : "#2d2a3a";
        y = wrap(ctx, line, 86, y + 10, w - 130, 54) + 10;
      }
    },
    `${title}|${lines.join("|")}|${accent}|${dark}`,
  );
  return <Panel position={position} rotationY={rotationY} width={width} height={height} map={texture} frame="#2b1a12" />;
}

/** A plinth with a floating emblem; click it for a burst and a toast. */
function Pedestal({ x = 0, z = -3.4, accent, emblemId, label, onClick }: { x?: number; z?: number; accent: string; emblemId: string; label: string; onClick?: () => void }) {
  const signature = useMemo(() => signatureFor(emblemId, label), [emblemId, label]);
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.9, 0.45, 0.9]} position={[0, 0.45, 0]} />
      </RigidBody>
      <mesh
        position={[0, 0.45, 0]}
        castShadow
        receiveShadow
        onClick={(e) => {
          if (!isClick(e)) return;
          e.stopPropagation();
          emitBurst({ position: new THREE.Vector3(x, 2.2, z), kind: "sparkle", count: 30, colors: [accent, "#fde68a", "#ffffff"], spread: 1 });
          sfx.sparkle();
          onClick?.();
        }}
        {...pointer}
      >
        <cylinderGeometry args={[0.9, 1.05, 0.9, 40]} />
        <meshStandardMaterial color="#1c1820" roughness={0.3} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.91, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.55, 0.78, 48]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.2} toneMapped={false} />
      </mesh>
      {signature && <Emblem signature={signature} y={2.2} scale={0.8} />}
    </group>
  );
}

/** A lounge: two facing sofas with a marble coffee table and their seats. */
function Lounge({ id, x, z, leather = "cognac" }: { id: string; x: number; z: number; leather?: React.ComponentProps<typeof Sofa>["leather"] }) {
  const seats = useMemo<Seat[]>(() => [...sofaSeats(`${id}-a`, x, z - 1.3, 0, 2.2), ...sofaSeats(`${id}-b`, x, z + 1.3, Math.PI, 2.2)], [id, x, z]);
  return (
    <group>
      <Rug position={[x, z]} width={4.4} depth={4.6} color="#3b1d4f" />
      <Sofa position={[x, 0, z - 1.3]} facing={0} leather={leather} />
      <Sofa position={[x, 0, z + 1.3]} facing={Math.PI} leather={leather} />
      <Table position={[x, 0, z]} width={1.1} depth={0.6} height={0.42} />
      <Seats seats={seats} />
    </group>
  );
}

/** Words that tie a skill to the tech lists of projects and jobs. */
const norm = (s: string) => s.toLowerCase().replace(/\.js$|s+$|[./\s-]/g, "");
function usedIn(skill: Skill) {
  const n = norm(skill.name);
  const hit = (tech: string[]) => tech.some((t) => norm(t) === n || norm(t).startsWith(n) || n.startsWith(norm(t)));
  return {
    projects: liveContent.projects.filter((p) => hit(p.tech)).map((p) => p.name),
    jobs: liveContent.experience.filter((j) => hit(j.tech)).map((j) => j.company),
  };
}

// ---------------------------------------------------------------------------
// Skills: a lab
// ---------------------------------------------------------------------------

function SkillLab({ skill, accent }: { skill: Skill; accent: string }) {
  const { width: W, depth: D } = useRoom();
  const uses = useMemo(() => usedIn(skill), [skill]);
  const theme = useMemo(() => skillTheme(skill), [skill]);
  const color = useMemo(() => signatureFor(skill.id, skill.name)?.accent ?? accent, [skill, accent]);
  return (
    <group>
      <SkillDressing skill={skill} theme={theme} accent={color} />
      <OnWall side="back">
        <Board
          position={[W / 2 - 4.4, 2.5, -D / 2 + 0.07]}
          width={6.4}
          height={2.6}
          accent={color}
          kicker={`Skill · ${skill.category}`}
          title={skill.name}
          lines={[`Level ${skill.level} out of 10 · ${skill.years} year${skill.years === 1 ? "" : "s"}`, ...(skill.note ? [skill.note] : [])]}
        />
      </OnWall>
      <SkillCenterpiece skill={skill} theme={theme} accent={color} />
      <LevelMeter level={skill.level} accent={color} />
      <OnWall side="left">
        <Board
          position={[-W / 2 + 0.06, 2.7, -2.5]}
          rotationY={Math.PI / 2}
          width={6}
          height={3.4}
          accent={color}
          kicker="Where it's used"
          title={uses.projects.length || uses.jobs.length ? "Projects and jobs" : "Learning in progress"}
          lines={[...uses.jobs.map((j) => `At ${j}`), ...uses.projects.map((p) => `Project: ${p}`)].slice(0, 7)}
        />
      </OnWall>
      <CodeTerminal x={6} z={-1} lines={theme.code} accent={color} />
      <Lounge id={`lab-${skill.id}`} x={-5} z={2.6} leather="black" />
      <TallPlant position={[W / 2 - 1.2, 0, D / 2 - 1.6]} seed={3} />
    </group>
  );
}

/** Ten glowing bars on the right wall, lit to the skill's level. Click to "charge" them. */
function LevelMeter({ level, accent }: { level: number; accent: string }) {
  const { width: W } = useRoom();
  const bars = useRef<THREE.MeshStandardMaterial[]>([]);
  const charge = useRef(-10);
  useFrame(({ clock }) => {
    const age = clock.elapsedTime - charge.current;
    bars.current.forEach((m, i) => {
      const lit = age < 1.6 ? i < Math.min(10, Math.floor((age / 1.2) * 10)) : i < level;
      m.emissiveIntensity = lit ? 1.6 : 0.05;
      m.color.set(lit ? accent : "#2a2533");
    });
  });
  return (
    <OnWall side="right">
      <group
        position={[W / 2 - 0.06, 0, 2.5]}
        rotation-y={-Math.PI / 2}
        onClick={(e) => {
          if (!isClick(e)) return;
          e.stopPropagation();
          charge.current = performance.now() / 1000 - 0;
          sfx.sparkle();
        }}
        {...pointer}
      >
        {Array.from({ length: 10 }, (_, i) => (
          <mesh key={i} position={[-2.25 + i * 0.5, 1.2 + i * 0.12, 0]}>
            <boxGeometry args={[0.36, 0.4 + i * 0.24, 0.06]} />
            <meshStandardMaterial ref={(m) => void (m && (bars.current[i] = m))} color={accent} emissive={accent} toneMapped={false} />
          </mesh>
        ))}
        <Text position={[0, 3.9, 0.04]} fontSize={0.3} color="#2b1a12" anchorX="center">
          {`Level ${level}/10 · click to charge`}
        </Text>
      </group>
    </OnWall>
  );
}

/** A desk with a big monitor; E or click types the next line of code. */
function CodeTerminal({ x, z, lines, accent }: { x: number; z: number; lines: string[]; accent: string }) {
  const [n, setN] = useState(0);
  const { texture } = useCanvas(
    1024,
    576,
    (ctx, w, h) => {
      ctx.fillStyle = "#0b1020";
      ctx.fillRect(0, 0, w, h);
      box(ctx, 0, 0, w, 44, 0, "#141a33");
      ["#ef4444", "#f59e0b", "#22c55e"].forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(28 + i * 26, 22, 8, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.font = font(30, "600");
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("~/wouroud $", 30, 100);
      const shown = Array.from({ length: Math.min(6, n + 1) }, (_, i) => lines[(n - i + lines.length * 10) % lines.length]).reverse();
      ctx.font = font(30);
      shown.forEach((l, i) => {
        ctx.fillStyle = i === shown.length - 1 ? accent : "#e2e8f0";
        wrap(ctx, `> ${l}`, 30, 160 + i * 64, w - 60, 34);
      });
      ctx.fillStyle = "#64748b";
      ctx.font = font(24);
      ctx.fillText("Press E or click to run the next line", 30, h - 30);
    },
    n,
  );
  const next = () => {
    setN((v) => v + 1);
    sfx.click();
  };
  const where = useMemo(() => new THREE.Vector3(x, 0, z + 1.2), [x, z]);
  useProximity({ id: `terminal-${x}-${z}`, label: "Run the next line of code", radius: 2, where, run: next });
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.1, 0.4, 0.45]} position={[0, 0.4, 0]} />
      </RigidBody>
      <Table position={[0, 0, 0]} width={2.2} depth={0.9} top="walnut" />
      <Panel
        position={[0, 1.45, -0.2]}
        width={1.8}
        height={1.0}
        map={texture}
        frame="#111"
        onClick={(e) => {
          if (!isClick(e)) return;
          e.stopPropagation();
          next();
        }}
      />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Campus: a lecture hall
// ---------------------------------------------------------------------------

function LectureHall({ edu, accent }: { edu: Education; accent: string }) {
  const { width: W, depth: D } = useRoom();
  const notes = edu.notes.length ? edu.notes : [`${edu.degree} in ${edu.field}`];
  const [written, setWritten] = useState(1);
  const { texture } = useCanvas(
    2048,
    820,
    (ctx, w, h) => {
      ctx.fillStyle = "#1f3a2e";
      ctx.fillRect(0, 0, w, h);
      // Chalk dust.
      for (let i = 0; i < 900; i++) {
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
        ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3);
      }
      ctx.fillStyle = "#f4f1ea";
      ctx.font = font(78, "700");
      ctx.fillText(`${edu.degree} · ${edu.field}`, 60, 110);
      ctx.font = font(44);
      ctx.fillStyle = "#cfe3d6";
      ctx.fillText(`${edu.school}, ${edu.location} · ${edu.start}–${edu.end ?? "now"}`, 60, 180);
      ctx.font = font(46);
      let y = 280;
      notes.slice(0, written).forEach((note) => {
        ctx.fillStyle = "#fde68a";
        ctx.fillText("✓", 60, y);
        ctx.fillStyle = "#f4f1ea";
        y = wrap(ctx, note, 120, y, w - 180, 58) + 18;
      });
      ctx.font = font(32);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fillText(written < notes.length ? "Click the board to keep writing…" : "Class dismissed!", 60, h - 40);
    },
    written,
  );
  const desks = useMemo(() => [-6, -3, 0, 3, 6].flatMap((x) => [1, 3.6].map((z) => ({ x, z }))), []);
  const seats = useMemo<Seat[]>(() => desks.map((d, i) => ({ id: `class-${i}`, x: d.x, y: 0, z: d.z + 0.55, facing: Math.PI })), [desks]);
  return (
    <group>
      <OnWall side="back">
        <group position={[0, 2.9, -D / 2 + 0.06]}>
          <mesh position={[0, 0, -0.03]}>
            <boxGeometry args={[12.4, 4.3, 0.05]} />
            <meshStandardMaterial color="#6b4a2a" roughness={0.6} />
          </mesh>
          <mesh
            onClick={(e) => {
              if (!isClick(e)) return;
              e.stopPropagation();
              setWritten((n) => (n >= notes.length ? 1 : n + 1));
              sfx.click();
            }}
            {...pointer}
          >
            <planeGeometry args={[12, 4]} />
            <meshBasicMaterial map={texture} toneMapped={false} />
          </mesh>
        </group>
      </OnWall>
      {/* Lectern */}
      <group position={[-4.5, 0, -D / 2 + 2.6]}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <boxGeometry args={[0.9, 1.1, 0.6]} />
          <meshStandardMaterial color="#4a2e1f" roughness={0.5} />
        </mesh>
        <mesh position={[0, 1.15, 0.05]} rotation-x={-0.35}>
          <boxGeometry args={[1, 0.05, 0.7]} />
          <meshStandardMaterial color="#5a3826" roughness={0.5} />
        </mesh>
      </group>
      <CapToss x={4.5} z={-D / 2 + 2.6} accent={accent} />
      {/* Student desks facing the board */}
      {desks.map((d, i) => (
        <group key={i} position={[d.x, 0, d.z]}>
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider args={[0.6, 0.37, 0.3]} position={[0, 0.37, -0.15]} />
          </RigidBody>
          <Table position={[0, 0, -0.15]} width={1.2} depth={0.55} top="walnut" />
        </group>
      ))}
      {seats.map((st) => (
        <SideChair key={st.id} position={[st.x, 0, st.z]} facing={st.facing} leather="cognac" />
      ))}
      <Seats seats={seats} />
      <OnWall side="right">
        <Bookcase position={[W / 2 - 0.35, 0, -3]} rotationY={-Math.PI / 2} width={2.4} seed={5} />
        <Bookcase position={[W / 2 - 0.35, 0, 0]} rotationY={-Math.PI / 2} width={2.4} seed={9} />
      </OnWall>
    </group>
  );
}

/** A graduation cap on a plinth: click or press E to toss it. */
function CapToss({ x, z, accent }: { x: number; z: number; accent: string }) {
  const cap = useRef<THREE.Group>(null);
  const tossAt = useRef(-10);
  const pending = useRef(false);
  useFrame(({ clock }) => {
    if (pending.current) {
      pending.current = false;
      tossAt.current = clock.elapsedTime;
    }
    const age = clock.elapsedTime - tossAt.current;
    if (cap.current) {
      cap.current.position.y = 1.25 + (age < 1.3 ? Math.sin((age / 1.3) * Math.PI) * 1.4 : 0);
      cap.current.rotation.y = age < 1.3 ? age * 10 : 0.4;
    }
  });
  const toss = () => {
    pending.current = true;
    sfx.pop();
    emitBurst({ position: new THREE.Vector3(x, 2, z), kind: "sparkle", count: 30, colors: [accent, "#fde68a", "#ffffff"], spread: 1.2 });
  };
  const where = useMemo(() => new THREE.Vector3(x, 0, z + 1), [x, z]);
  useProximity({ id: `cap-${x}`, label: "Toss the graduation cap", radius: 1.8, where, run: toss });
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.35, 0.4, 1.1, 24]} />
        <meshStandardMaterial color="#1c1820" roughness={0.35} metalness={0.4} />
      </mesh>
      <group
        ref={cap}
        position={[0, 1.25, 0]}
        onClick={(e) => {
          if (!isClick(e)) return;
          e.stopPropagation();
          toss();
        }}
        {...pointer}
      >
        <mesh castShadow>
          <cylinderGeometry args={[0.2, 0.22, 0.14, 24]} />
          <meshStandardMaterial color="#141414" />
        </mesh>
        <mesh position={[0, 0.08, 0]} rotation-y={Math.PI / 4}>
          <boxGeometry args={[0.6, 0.03, 0.6]} />
          <meshStandardMaterial color="#141414" />
        </mesh>
        <mesh position={[0.22, 0.02, 0.22]}>
          <cylinderGeometry args={[0.012, 0.012, 0.22, 6]} />
          <meshStandardMaterial color="#d4a72c" metalness={0.6} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Training: a certificate gallery
// ---------------------------------------------------------------------------

function CertificateGallery({ t, accent }: { t: Training; accent: string }) {
  const { width: W, depth: D } = useRoom();
  const toast = useCityStore((s) => s.toast);
  const { texture } = useCanvas(
    1600,
    1130,
    (ctx, w, h) => {
      ctx.fillStyle = "#fbf6e9";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#c9a45a";
      ctx.lineWidth = 18;
      ctx.strokeRect(40, 40, w - 80, h - 80);
      ctx.lineWidth = 4;
      ctx.strokeRect(80, 80, w - 160, h - 160);
      ctx.textAlign = "center";
      ctx.fillStyle = "#8a6d2b";
      ctx.font = font(44, "700");
      ctx.fillText(t.kind === "certificate" ? "CERTIFICATE OF COMPLETION" : t.kind.toUpperCase(), w / 2, 220);
      ctx.fillStyle = "#1a103d";
      ctx.font = font(40);
      ctx.fillText("awarded to", w / 2, 320);
      ctx.font = font(96, "800");
      ctx.fillText("Wouroud El Khaldi", w / 2, 440);
      ctx.font = font(54, "700");
      ctx.fillStyle = accent;
      wrap(ctx, t.name, w / 2, 560, w - 300, 64);
      ctx.fillStyle = "#3a3448";
      ctx.font = font(40);
      ctx.fillText(`${t.issuer ? `${t.issuer} · ` : ""}${t.provider}`, w / 2, 790);
      ctx.fillText(t.status === "in-progress" ? "In progress" : t.date ? `Completed ${t.date}` : "Completed", w / 2, 860);
      // Seal.
      ctx.fillStyle = "#c9a45a";
      ctx.beginPath();
      for (let i = 0; i < 32; i++) {
        const a = (i / 32) * Math.PI * 2;
        const r = i % 2 ? 90 : 110;
        ctx.lineTo(w - 260 + Math.cos(a) * r, h - 250 + Math.sin(a) * r);
      }
      ctx.fill();
      ctx.fillStyle = "#fbf6e9";
      ctx.font = font(40, "800");
      ctx.fillText("✓", w - 260, h - 235);
      ctx.textAlign = "left";
    },
    t.id,
  );
  const items = t.courses.length ? t.courses : (t.highlights ?? []);
  return (
    <group>
      <OnWall side="back">
        <Panel position={[0, 2.8, -D / 2 + 0.08]} width={6.4} height={4.5} map={texture} frame="#c9a45a" />
        <Board position={[-7.2, 2.8, -D / 2 + 0.06]} width={4.8} height={3.6} accent={accent} kicker={t.provider} title="About" lines={[t.summary]} />
      </OnWall>
      <OnWall side="left">
        <Board
          position={[-W / 2 + 0.06, 2.7, -1.5]}
          rotationY={Math.PI / 2}
          width={7.5}
          height={3.6}
          accent={accent}
          kicker={t.courses.length ? `${t.courses.length} courses` : "What it covers"}
          title={t.courses.length ? "Courses" : "Highlights"}
          lines={items.slice(0, 9)}
        />
      </OnWall>
      <Medal x={4.5} z={-3} accent={accent} onSpin={() => toast(t.summary, t.name)} />
      <Lounge id={`gallery-${t.id}`} x={-4} z={2.6} leather="oxblood" />
      <OnWall side="right">
        {[-4, 0, 4].map((z, i) => (
          <Painting key={z} position={[W / 2 - 0.06, 2.6, z]} rotationY={-Math.PI / 2} width={2.2} height={1.5} seed={i + 4} palette={ART} />
        ))}
      </OnWall>
    </group>
  );
}

/** A gold medal on a ribbon stand: click to spin it. */
function Medal({ x, z, accent, onSpin }: { x: number; z: number; accent: string; onSpin: () => void }) {
  const medal = useRef<THREE.Group>(null);
  const spin = useRef(0);
  useFrame((_, delta) => {
    spin.current = Math.max(0, spin.current - delta * 3);
    if (medal.current) medal.current.rotation.y += delta * (0.4 + spin.current * 8);
  });
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[0.7, 1, 0.7]} />
        <meshStandardMaterial color="#1c1820" roughness={0.35} />
      </mesh>
      <group
        ref={medal}
        position={[0, 1.65, 0]}
        onClick={(e) => {
          if (!isClick(e)) return;
          e.stopPropagation();
          spin.current = 2;
          sfx.coin();
          onSpin();
        }}
        {...pointer}
      >
        <mesh rotation-x={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0.38, 0.38, 0.06, 40]} />
          <meshStandardMaterial color="#e2b649" metalness={0.95} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.55, 0]}>
          <boxGeometry args={[0.22, 0.7, 0.02]} />
          <meshStandardMaterial color={accent} />
        </mesh>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Languages: a café
// ---------------------------------------------------------------------------

const LANG_CODE: Record<string, string> = { arabic: "ar", english: "en", french: "fr" };

function LanguageCafe({ lang, accent }: { lang: Language; accent: string }) {
  const { width: W, depth: D } = useRoom();
  const speak = () => {
    sfx.pop();
    try {
      const u = new SpeechSynthesisUtterance(lang.greeting);
      u.lang = LANG_CODE[lang.id] ?? "en";
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {
      // No speech in this browser: the sparkle still answers.
    }
    emitBurst({ position: new THREE.Vector3(0, 3.4, -D / 2 + 1), kind: "sparkle", count: 30, colors: [accent, "#ffffff"], spread: 2 });
  };
  const where = useMemo(() => new THREE.Vector3(0, 0, -D / 2 + 3), [D]);
  useProximity({ id: `greet-${lang.id}`, label: `Hear "${lang.greeting}"`, radius: 2.4, where, run: speak });
  const tables = useMemo(() => [-5.5, 0, 5.5].map((x, i) => ({ x, z: i === 1 ? 2.4 : 1.4 })), []);
  const seats = useMemo<Seat[]>(
    () => tables.flatMap((t, i) => [-1, 1].map((s) => ({ id: `cafe-${i}-${s}`, x: t.x + s * 0.85, y: 0, z: t.z, facing: s > 0 ? -Math.PI / 2 : Math.PI / 2 }))),
    [tables],
  );
  return (
    <group>
      <OnWall side="back">
        <group
          position={[0, 3.3, -D / 2 + 0.08]}
          onClick={(e) => {
            if (!isClick(e)) return;
            e.stopPropagation();
            speak();
          }}
          {...pointer}
        >
          <mesh position={[0, 0, -0.03]}>
            <boxGeometry args={[10, 2.4, 0.05]} />
            <meshStandardMaterial color="#2b1a12" roughness={0.5} />
          </mesh>
          <Text position={[0, 0.3, 0.02]} fontSize={0.95} color="#fde68a" anchorX="center" anchorY="middle">
            {lang.greeting}
          </Text>
          <Text position={[0, -0.7, 0.02]} fontSize={0.3} color="#f4f1ea" anchorX="center" anchorY="middle">
            {`${lang.name} · ${lang.level === "native" ? "native" : `level ${lang.level}`} · click to hear it`}
          </Text>
        </group>
      </OnWall>
      <EspressoBar x={W / 2 - 3} z={-D / 2 + 1.6} accent={accent} />
      {tables.map((t, i) => (
        <group key={i}>
          <RigidBody type="fixed" colliders={false}>
            <CylinderTable x={t.x} z={t.z} />
          </RigidBody>
          <Table position={[t.x, 0, t.z]} width={0.9} depth={0.9} top={i % 2 ? "marbleGreen" : "marbleWhite"} />
        </group>
      ))}
      {seats.map((st) => (
        <SideChair key={st.id} position={[st.x, 0, st.z]} facing={st.facing} leather={st.facing > 0 ? "emerald" : "cognac"} />
      ))}
      <Seats seats={seats} />
      <OnWall side="left">
        <Bookcase position={[-W / 2 + 0.35, 0, -2]} rotationY={Math.PI / 2} width={2.4} seed={2} />
        <FloorLamp position={[-W / 2 + 0.8, 0, 1.2]} />
      </OnWall>
    </group>
  );
}

function CylinderTable({ x, z }: { x: number; z: number }) {
  return <CuboidCollider args={[0.45, 0.37, 0.45]} position={[x, 0.37, z]} />;
}

/** A marble espresso bar: click the machine for a coffee (steam and a sound). */
function EspressoBar({ x, z, accent }: { x: number; z: number; accent: string }) {
  const brew = () => {
    sfx.splash();
    emitBurst({ position: new THREE.Vector3(x, 1.6, z), kind: "splash", count: 24, colors: ["#ffffff", "#e5e7eb"], spread: 0.3 });
  };
  const where = useMemo(() => new THREE.Vector3(x - 1, 0, z + 1.4), [x, z]);
  useProximity({ id: `espresso-${x}`, label: "Make an espresso", radius: 2, where, run: brew });
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[2, 0.55, 0.45]} position={[0, 0.55, 0]} />
      </RigidBody>
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[4, 1.1, 0.9]} />
        <meshStandardMaterial color="#2b1a12" roughness={0.45} />
      </mesh>
      <mesh position={[0, 1.13, 0]} receiveShadow>
        <boxGeometry args={[4.1, 0.06, 1]} />
        <meshStandardMaterial color="#eae5dc" roughness={0.15} />
      </mesh>
      <group
        position={[-1, 1.16, -0.1]}
        onClick={(e) => {
          if (!isClick(e)) return;
          e.stopPropagation();
          brew();
        }}
        {...pointer}
      >
        <mesh position={[0, 0.25, 0]} castShadow>
          <boxGeometry args={[0.7, 0.5, 0.45]} />
          <meshStandardMaterial color="#c0c4cc" metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.52, 0]}>
          <boxGeometry args={[0.72, 0.04, 0.47]} />
          <meshStandardMaterial color={accent} />
        </mesh>
      </group>
      {[0.3, 0.7, 1.1].map((cx) => (
        <mesh key={cx} position={[cx, 1.2, 0.2]}>
          <cylinderGeometry args={[0.05, 0.04, 0.08, 12]} />
          <meshStandardMaterial color="#ffffff" roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Hobbies: a studio per hobby
// ---------------------------------------------------------------------------

function HobbyStudio({ hobby, accent }: { hobby: Hobby; accent: string }) {
  const { width: W, depth: D } = useRoom();
  const setActivity = useCityStore((s) => s.setActivity);
  const takePhoto = useCityStore((s) => s.takePhoto);
  const toast = useCityStore((s) => s.toast);
  const learning = liveContent.trainings.filter((t) => t.status === "in-progress").map((t) => `${t.name} (${t.provider})`);
  let centerpiece: React.ReactNode = <Pedestal accent={accent} emblemId={hobby.id} label={hobby.name} onClick={() => toast(hobby.description, hobby.name)} />;
  if (hobby.building === "gallery" || hobby.building === "drawing-studio")
    centerpiece = <Station x={0} z={-3.2} label="Paint on the easel" accent={accent} run={() => setActivity("paint")} kind="easel" />;
  else if (hobby.building === "photo-studio") centerpiece = <Station x={0} z={-3.2} label="Take a photo of the city" accent={accent} run={takePhoto} kind="camera" />;
  else if (hobby.building === "yarn-shop") centerpiece = <CrochetCorner x={0} z={-3.2} accent={accent} />;
  else if (hobby.building === "library")
    centerpiece = <Station x={0} z={-3.2} label="Open the book of what she's learning" accent={accent} run={() => toast(learning.join(" · ") || "Always learning something new.", "Learning now")} kind="book" />;
  return (
    <group>
      <OnWall side="back">
        <Board position={[0, 3, -D / 2 + 0.06]} width={9} height={3} accent={accent} kicker="Hobby" title={hobby.name} lines={[hobby.description, hobby.interaction]} />
      </OnWall>
      {centerpiece}
      <OnWall side="left">
        {[-5, -1.5, 2].map((z, i) => (
          <Painting key={z} position={[-W / 2 + 0.06, 2.6, z]} rotationY={Math.PI / 2} width={2.4} height={1.7} seed={i + 11} palette={ART} />
        ))}
      </OnWall>
      {hobby.building === "library" && (
        <OnWall side="right">
          {[-5, -2.4, 0.2, 2.8].map((z, i) => (
            <Bookcase key={z} position={[W / 2 - 0.35, 0, z]} rotationY={-Math.PI / 2} width={2.4} seed={i + 20} />
          ))}
        </OnWall>
      )}
      <Lounge id={`hobby-${hobby.id}`} x={5} z={2.4} leather="emerald" />
      <TallPlant position={[-W / 2 + 1.2, 0, D / 2 - 1.6]} seed={7} />
    </group>
  );
}

/** A hobby station (easel, camera on a tripod, a lectern with a book) that runs an action on E or click. */
function Station({ x, z, label, accent, run, kind }: { x: number; z: number; label: string; accent: string; run: () => void; kind: "easel" | "camera" | "book" }) {
  const where = useMemo(() => new THREE.Vector3(x, 0, z + 1.4), [x, z]);
  useProximity({ id: `station-${kind}`, label, radius: 2.2, where, run });
  const click = (e: ThreeEvent<MouseEvent>) => {
    if (!isClick(e)) return;
    e.stopPropagation();
    run();
  };
  return (
    <group position={[x, 0, z]} onClick={click} {...pointer}>
      {kind === "easel" && (
        <group>
          {[-0.4, 0.4].map((lx) => (
            <mesh key={lx} position={[lx, 1, 0.1]} rotation-z={lx * -0.2}>
              <boxGeometry args={[0.06, 2, 0.06]} />
              <meshStandardMaterial color="#8a6038" />
            </mesh>
          ))}
          <mesh position={[0, 1.45, 0.16]} rotation-x={-0.1} castShadow>
            <boxGeometry args={[1.2, 0.9, 0.04]} />
            <meshStandardMaterial color="#fbf8f1" />
          </mesh>
          <mesh position={[0, 1.45, 0.185]} rotation-x={-0.1}>
            <planeGeometry args={[1.0, 0.7]} />
            <meshStandardMaterial color={accent} />
          </mesh>
        </group>
      )}
      {kind === "camera" && (
        <group>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[Math.cos((i / 3) * Math.PI * 2) * 0.25, 0.7, Math.sin((i / 3) * Math.PI * 2) * 0.25]} rotation={[Math.sin((i / 3) * Math.PI * 2) * 0.3, 0, -Math.cos((i / 3) * Math.PI * 2) * 0.3]}>
              <cylinderGeometry args={[0.02, 0.02, 1.45, 8]} />
              <meshStandardMaterial color="#1c1b20" metalness={0.6} />
            </mesh>
          ))}
          <mesh position={[0, 1.5, 0]} castShadow>
            <boxGeometry args={[0.36, 0.24, 0.18]} />
            <meshStandardMaterial color="#1c1b20" roughness={0.4} />
          </mesh>
          <mesh position={[0, 1.5, 0.15]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.08, 0.09, 0.14, 24]} />
            <meshStandardMaterial color="#2a2a30" metalness={0.5} roughness={0.2} />
          </mesh>
        </group>
      )}
      {kind === "book" && (
        <group>
          <mesh position={[0, 0.55, 0]} castShadow>
            <boxGeometry args={[0.8, 1.1, 0.5]} />
            <meshStandardMaterial color="#4a2e1f" roughness={0.5} />
          </mesh>
          <mesh position={[0, 1.16, 0]} rotation-x={-0.3}>
            <boxGeometry args={[0.7, 0.06, 0.5]} />
            <meshStandardMaterial color={accent} />
          </mesh>
        </group>
      )}
    </group>
  );
}

/** The crochet corner: a basket of yarn and an amigurumi that grows a row with every click. */
function CrochetCorner({ x, z, accent }: { x: number; z: number; accent: string }) {
  const [rows, setRows] = useState(3);
  const max = 12;
  const stitch = () => {
    setRows((r) => (r >= max ? 3 : r + 1));
    sfx.pop();
    if (rows + 1 === max) {
      emitBurst({ position: new THREE.Vector3(x, 1.6, z), kind: "sparkle", count: 30, colors: ["#f9a8d4", "#fde68a", "#ffffff"], spread: 0.8 });
      useCityStore.getState().toast("A little crochet bunny, finished! Click again to start a new one.", "Crochet");
    }
  };
  const where = useMemo(() => new THREE.Vector3(x, 0, z + 1.4), [x, z]);
  useProximity({ id: "crochet", label: "Crochet a row", radius: 2.2, where, run: stitch });
  const grown = rows / max;
  const yarns = ["#f9a8d4", "#a78bfa", "#5eead4", "#fde68a", "#fb923c"];
  return (
    <group position={[x, 0, z]}>
      <Table position={[0, 0, 0]} width={1.4} depth={0.9} top="walnut" />
      {/* Basket of yarn balls */}
      <mesh position={[0.9, 0.2, 0.4]} castShadow>
        <cylinderGeometry args={[0.35, 0.28, 0.4, 20, 1, true]} />
        <meshStandardMaterial color="#b98a5a" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      {yarns.map((c, i) => (
        <mesh key={c} position={[0.9 + Math.cos(i * 1.3) * 0.15, 0.38, 0.4 + Math.sin(i * 1.3) * 0.15]} castShadow>
          <sphereGeometry args={[0.12, 16, 12]} />
          <meshStandardMaterial color={c} roughness={1} />
        </mesh>
      ))}
      {/* The amigurumi bunny: body, head and ears appear as the rows add up */}
      <group
        position={[0, 0.78, 0]}
        onClick={(e) => {
          if (!isClick(e)) return;
          e.stopPropagation();
          stitch();
        }}
        {...pointer}
      >
        <mesh position={[0, 0.12 * Math.min(1, grown * 2), 0]} scale={[1, Math.min(1, grown * 2), 1]} castShadow>
          <sphereGeometry args={[0.13, 20, 14]} />
          <meshStandardMaterial color={accent} roughness={1} />
        </mesh>
        {grown > 0.5 && (
          <mesh position={[0, 0.32, 0]} scale={Math.min(1, (grown - 0.5) * 3)} castShadow>
            <sphereGeometry args={[0.1, 20, 14]} />
            <meshStandardMaterial color={accent} roughness={1} />
          </mesh>
        )}
        {grown > 0.8 &&
          [-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.04, 0.46, 0]} rotation-z={s * -0.2} castShadow>
              <capsuleGeometry args={[0.025, 0.12, 4, 8]} />
              <meshStandardMaterial color={accent} roughness={1} />
            </mesh>
          ))}
        <Text position={[0, -0.02, 0.48]} rotation-x={-Math.PI / 2} fontSize={0.07} color="#fde68a" anchorX="center">
          {`Row ${rows}/${max} · click to crochet`}
        </Text>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Arcade: game halls
// ---------------------------------------------------------------------------

const GAMES: Record<string, { title: string; activity?: Activity; screen: string; color: string }> = {
  "full-stack-arcade": { title: "FULL STACK", activity: "stack", screen: "#7c3aed", color: "#d53f8c" },
  "xo-lounge": { title: "XO vs BOT", activity: "xo", screen: "#0ea5e9", color: "#0369a1" },
  "sky-hop": { title: "FIREWALL FLYER", activity: "flappy", screen: "#f59e0b", color: "#b45309" },
  "ring-rally": { title: "RING ROAD RALLY", screen: "#ef4444", color: "#991b1b" },
};

function GameHall({ id, accent }: { id: string; accent: string }) {
  const { width: W, depth: D } = useRoom();
  const game = GAMES[id] ?? GAMES["full-stack-arcade"];
  const setActivity = useCityStore((s) => s.setActivity);
  const startRace = useCityStore((s) => s.startRace);
  const play = () => (game.activity ? setActivity(game.activity) : startRace());
  // The other games stand along the side walls, so every hall can play everything.
  const others = Object.entries(GAMES).filter(([k]) => k !== id);
  return (
    <group>
      <Cabinet x={0} z={-D / 2 + 1.6} game={game} big run={play} label={game.activity ? `Play ${game.title}` : "Start a race (3 laps)"} />
      {others.map(([k, g], i) => (
        <Cabinet
          key={k}
          x={-W / 2 + 1.4}
          z={-4 + i * 3}
          rotationY={Math.PI / 2}
          game={g}
          run={() => (g.activity ? setActivity(g.activity) : startRace())}
          label={g.activity ? `Play ${g.title}` : "Start a race (3 laps)"}
        />
      ))}
      {id === "ring-rally" && <TrophyShelf x={W / 2 - 1.4} accent={accent} />}
      <Lounge id={`arcade-${id}`} x={5} z={2.6} leather="black" />
      <NeonStrip accent={accent} />
    </group>
  );
}

/** An arcade cabinet with a glowing screen and marquee; E or click plays its game. */
function Cabinet({
  x,
  z,
  rotationY = 0,
  game,
  big = false,
  run,
  label,
}: {
  x: number;
  z: number;
  rotationY?: number;
  game: { title: string; screen: string; color: string };
  big?: boolean;
  run: () => void;
  label: string;
}) {
  const s = big ? 1.5 : 1;
  const where = useMemo(() => new THREE.Vector3(x + Math.sin(rotationY) * 1.3 * s, 0, z + Math.cos(rotationY) * 1.3 * s), [x, z, rotationY, s]);
  useProximity({ id: `cabinet-${game.title}-${x}-${z}`, label, radius: 1.8 * s, where, run });
  const screen = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (screen.current) screen.current.emissiveIntensity = 1 + Math.sin(clock.elapsedTime * 3 + x) * 0.25;
  });
  return (
    <group
      position={[x, 0, z]}
      rotation-y={rotationY}
      scale={s}
      onClick={(e) => {
        if (!isClick(e)) return;
        e.stopPropagation();
        run();
      }}
      {...pointer}
    >
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.45, 0.95, 0.4]} position={[0, 0.95, 0]} />
      </RigidBody>
      <mesh position={[0, 0.95, 0]} castShadow>
        <boxGeometry args={[0.9, 1.9, 0.8]} />
        <meshStandardMaterial color={game.color} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.35, 0.36]} rotation-x={-0.2}>
        <planeGeometry args={[0.7, 0.5]} />
        <meshStandardMaterial ref={screen} color="#000" emissive={game.screen} emissiveIntensity={1} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.95, 0.45]} rotation-x={-0.6}>
        <boxGeometry args={[0.86, 0.04, 0.3]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {[-0.15, 0.05, 0.2].map((bx, i) => (
        <mesh key={bx} position={[bx, 1.0, 0.5]}>
          <cylinderGeometry args={[0.035, 0.035, 0.03, 12]} />
          <meshStandardMaterial color={["#ef4444", "#22c55e", "#3b82f6"][i]} emissive={["#ef4444", "#22c55e", "#3b82f6"][i]} emissiveIntensity={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 1.98, 0.3]}>
        <boxGeometry args={[0.9, 0.22, 0.25]} />
        <meshStandardMaterial color="#111" emissive={game.screen} emissiveIntensity={0.5} />
      </mesh>
      <Text position={[0, 1.98, 0.43]} fontSize={0.09} color="#ffffff" anchorX="center" anchorY="middle" maxWidth={0.85}>
        {game.title}
      </Text>
    </group>
  );
}

/** Trophies for the rally: gold, silver, bronze on a walnut shelf. */
function TrophyShelf({ x, accent }: { x: number; accent: string }) {
  return (
    <OnWall side="right">
      <group position={[x, 0, -3]} rotation-y={-Math.PI / 2}>
        <mesh position={[0, 1, 0]} castShadow>
          <boxGeometry args={[3, 0.08, 0.5]} />
          <meshStandardMaterial color="#4a2e1f" />
        </mesh>
        {[
          ["#e2b649", 0, 0.6],
          ["#c0c4cc", -0.9, 0.5],
          ["#c27c3a", 0.9, 0.45],
        ].map(([c, tx, h]) => (
          <group key={c as string} position={[tx as number, 1.04, 0]}>
            <mesh position={[0, 0.06, 0]}>
              <boxGeometry args={[0.24, 0.12, 0.24]} />
              <meshStandardMaterial color="#1c1820" />
            </mesh>
            <mesh position={[0, 0.12 + (h as number) / 2, 0]}>
              <cylinderGeometry args={[0.16, 0.06, h as number, 20]} />
              <meshStandardMaterial color={c as string} metalness={0.9} roughness={0.2} />
            </mesh>
          </group>
        ))}
        <Text position={[0, 2.1, 0.02]} fontSize={0.22} color={accent} anchorX="center">
          {"Beat the bots to earn gold"}
        </Text>
      </group>
    </OnWall>
  );
}

/** A neon strip along the walls in the hall's color. */
function NeonStrip({ accent }: { accent: string }) {
  const { width: W, depth: D, height: H } = useRoom();
  return (
    <group>
      {[
        [0, -D / 2 + 0.05, W, 0],
        [-W / 2 + 0.05, 0, D, Math.PI / 2],
        [W / 2 - 0.05, 0, D, -Math.PI / 2],
      ].map(([x, z, len, r], i) => (
        <mesh key={i} position={[x, H - 0.75, z]} rotation-y={r}>
          <boxGeometry args={[len, 0.05, 0.03]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={2} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

