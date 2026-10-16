"use client";

import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useCityStore } from "@/state/useCityStore";
import { sfx } from "@/world/sfx";
import { Bookcase, ExecChair, SideChair } from "../../Furniture";
import { box, font, Panel, useCanvas, wrap } from "../../roomKit";
import { Seats } from "../../StreetDetails";
import { Text } from "../../Text3D";
import { useProximity } from "../../useProximity";
import { flat } from "../finishKit";
import { burstAt, clicked, pointer, seatAt, useWorldPoint } from "../modules";
import { useHouse } from "../SkillHouse";
import type { SigComponent, SigProps } from "./types";

/**
 * Signature pieces for the databases: PostgreSQL, MySQL, MongoDB, Firebase, Supabase, Prisma,
 * TypeORM and Sequelize.
 */

type V3 = [number, number, number];

const toast = (text: string, title?: string) => useCityStore.getState().toast(text, title);
const now = () => performance.now() / 1000;
const smooth = (x: number) => THREE.MathUtils.smoothstep(x, 0, 1);

/** A deterministic random sequence (same values every render). */
function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const UP = new THREE.Vector3(0, 1, 0);
const tmp = new THREE.Vector3();

/** Points a unit-height, y-aligned mesh from a to b (for lines and beams that move). */
function stretch(obj: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) {
  tmp.subVectors(b, a);
  const len = Math.max(0.001, tmp.length());
  obj.position.copy(a).addScaledVector(tmp, 0.5);
  obj.quaternion.setFromUnitVectors(UP, tmp.divideScalar(len));
  obj.scale.set(1, len, 1);
}

/** A cylinder from one point to another (branches, rods, tubes, beams). */
function Stick({ from, to, radius, radiusTop = radius, material, segments = 10 }: { from: V3; to: V3; radius: number; radiusTop?: number; material: THREE.Material; segments?: number }) {
  const a = new THREE.Vector3(...from);
  const dir = new THREE.Vector3(...to).sub(a);
  const len = dir.length();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
  const mid = a.addScaledVector(dir, 0.5);
  return (
    <mesh position={mid} quaternion={quaternion} material={material} castShadow>
      <cylinderGeometry args={[radiusTop, radius, len, segments]} />
    </mesh>
  );
}

/** Plane geometries that each show one cell of a canvas atlas (labels for many drawers or boxes). */
function useAtlasCells(cols: number, rows: number, width: number, height: number) {
  const cells = useMemo(
    () =>
      Array.from({ length: cols * rows }, (_, i) => {
        const g = new THREE.PlaneGeometry(width, height);
        const c = i % cols;
        const r = Math.floor(i / cols);
        const [u0, u1, v0, v1] = [c / cols, (c + 1) / cols, 1 - (r + 1) / rows, 1 - r / rows];
        const uv = g.attributes.uv;
        uv.setXY(0, u0, v1);
        uv.setXY(1, u1, v1);
        uv.setXY(2, u0, v0);
        uv.setXY(3, u1, v0);
        return g;
      }),
    [cols, rows, width, height],
  );
  return cells;
}

/**
 * A dark wall board for code: a kicker, a title and monospace lines sized to fit (the current line
 * highlighted). Faces +z.
 */
function CodeBoard({ position, width, height, kicker, title, lines, current = -1 }: { position: V3; width: number; height: number; kicker: string; title: string; lines: string[]; current?: number }) {
  const { palette, accent } = useHouse();
  const { texture } = useCanvas(
    Math.round(width * 220),
    Math.round(height * 220),
    (ctx, cw, ch) => {
      ctx.fillStyle = palette.ink;
      ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = accent;
      ctx.fillRect(0, 0, cw, 10);
      ctx.font = font(28, "700");
      ctx.fillText(kicker.toUpperCase(), 32, 54);
      ctx.fillStyle = palette.paper;
      ctx.font = font(46, "800");
      ctx.fillText(title, 32, 112, cw - 64);
      const top = 150;
      let size = Math.min(34, ((ch - top - 16) / Math.max(1, lines.length)) * 0.72);
      ctx.font = `${Math.round(size)}px ui-monospace, Menlo, Consolas, monospace`;
      const widest = Math.max(1, ...lines.map((l) => ctx.measureText(l).width));
      if (widest > cw - 80) size *= (cw - 80) / widest;
      ctx.font = `${Math.round(size)}px ui-monospace, Menlo, Consolas, monospace`;
      const step = size * 1.38;
      lines.forEach((line, i) => {
        const y = top + step * (i + 0.8);
        if (i === current) box(ctx, 24, y - size * 1.05, cw - 48, step, 8, accent);
        ctx.fillStyle = i === current ? palette.ink : palette.paper;
        ctx.fillText(line, 40, y);
      });
    },
    `${kicker}|${title}|${lines.join("|")}|${current}`,
  );
  return <Panel position={position} width={width} height={height} map={texture} frame="#111111" />;
}

/** An elephant head (the Postgres mascot): head, ears, trunk and tusks. Faces +z. */
function Elephant({ material, detail, position, scale = 1 }: { material: THREE.Material; detail: THREE.Material; position: V3; scale?: number }) {
  const trunk = useMemo(
    () =>
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.02, 0.22), new THREE.Vector3(0, -0.18, 0.32), new THREE.Vector3(0, -0.36, 0.34), new THREE.Vector3(0, -0.5, 0.3), new THREE.Vector3(0, -0.55, 0.39)]),
        24,
        0.07,
        10,
        false,
      ),
    [],
  );
  return (
    <group position={position} scale={scale}>
      <mesh material={material} scale={[1, 0.92, 0.95]} castShadow>
        <sphereGeometry args={[0.3, 24, 18]} />
      </mesh>
      <mesh position={[0, 0.15, 0.03]} material={material}>
        <sphereGeometry args={[0.22, 20, 14]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.33, 0.02, -0.05]} rotation-y={s * 0.5} scale={[0.18, 1, 0.8]} material={material} castShadow>
          <sphereGeometry args={[0.3, 16, 12]} />
        </mesh>
      ))}
      <mesh geometry={trunk} material={material} castShadow />
      {[-1, 1].map((s) => (
        <group key={`t${s}`}>
          <mesh position={[s * 0.13, -0.2, 0.24]} rotation-x={2.1} material={detail}>
            <coneGeometry args={[0.03, 0.24, 10]} />
          </mesh>
          <mesh position={[s * 0.15, 0.07, 0.25]} material={detail}>
            <sphereGeometry args={[0.025, 10, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// PostgreSQL · The card catalog (hero)
// ---------------------------------------------------------------------------

/**
 * A tall oak card-catalog cabinet on a plinth, a grid of brass-handled drawers and a bronze elephant
 * bust on top. E looks up an index: one drawer slides out and its card shows where the row is and
 * which plan Postgres used to get there.
 */
const INDEXES = [
  { name: "users_email_idx", hit: "row 4,213", ms: "0.08 ms", plan: "Index Scan", sql: "SELECT * FROM users WHERE email = 'wouroud@…'" },
  { name: "orders_created_at_idx", hit: "184 rows", ms: "0.41 ms", plan: "Bitmap Heap Scan", sql: "SELECT * FROM orders WHERE created_at > now() - interval '1 day'" },
  { name: "skills_pkey", hit: "row 17", ms: "0.03 ms", plan: "Index Only Scan", sql: "SELECT id FROM skills WHERE id = 17" },
  { name: "posts_tags_gin", hit: "312 rows", ms: "0.92 ms", plan: "Bitmap Index Scan, GIN", sql: "SELECT * FROM posts WHERE tags @> '{react}'" },
];
const CAT_COLS = 6;
const CAT_ROWS = 5;
const CAT_BASE = 0.35;
const CAT_H = 2.0;
const CAT_DEPTH = 0.8;

function PgCatalog({ w, d, toHouse }: SigProps) {
  const { accent } = useHouse();
  const [look, setLook] = useState(-1);
  const drawers = useRef<(THREE.Group | null)[]>([]);
  const card = useRef<THREE.Group>(null);
  const openedAt = useRef(-10);
  const cw = Math.min(w - 1.2, 3.4);
  const cellW = (cw - 0.16) / CAT_COLS;
  const cellH = (CAT_H - 0.16) / CAT_ROWS;
  const active = look < 0 ? -1 : (look * 7 + 11) % (CAT_COLS * CAT_ROWS);
  const entry = INDEXES[Math.max(0, look) % INDEXES.length];
  const { texture } = useCanvas(
    512,
    320,
    (ctx, cw2, ch2) => {
      ctx.fillStyle = "#f6f0dc";
      ctx.fillRect(0, 0, cw2, ch2);
      ctx.strokeStyle = "rgba(51,103,145,0.3)";
      ctx.lineWidth = 2;
      for (let y = 112; y < ch2 - 30; y += 44) {
        ctx.beginPath();
        ctx.moveTo(20, y);
        ctx.lineTo(cw2 - 20, y);
        ctx.stroke();
      }
      ctx.strokeStyle = "#c0392b";
      ctx.beginPath();
      ctx.moveTo(20, 74);
      ctx.lineTo(cw2 - 20, 74);
      ctx.stroke();
      ctx.fillStyle = "#14273a";
      ctx.font = font(34, "bold");
      ctx.fillText(entry.name, 28, 58);
      ctx.fillStyle = "#336791";
      ctx.font = font(32, "bold");
      ctx.fillText(`→ ${entry.hit} · ${entry.ms}`, 28, 132);
      ctx.fillStyle = "#14273a";
      ctx.font = font(26, "italic");
      ctx.fillText(`(${entry.plan})`, 28, 176);
      ctx.fillStyle = "#5a4a3a";
      ctx.font = font(21);
      wrap(ctx, entry.sql, 28, 222, cw2 - 56, 30);
      ctx.fillStyle = "#cdbf9a";
      ctx.beginPath();
      ctx.arc(cw2 / 2, ch2 - 18, 9, 0, Math.PI * 2);
      ctx.fill();
    },
    look,
  );
  const drawerAt = (i: number): [number, number] => [-cw / 2 + 0.08 + cellW * ((i % CAT_COLS) + 0.5), CAT_BASE + 0.08 + cellH * (CAT_ROWS - 1 - Math.floor(i / CAT_COLS) + 0.5)];

  const lookUp = () => {
    const next = look + 1;
    setLook(next);
    openedAt.current = now();
    sfx.click();
    const e = INDEXES[next % INDEXES.length];
    toast(`${e.name} took Postgres straight to ${e.hit} in ${e.ms} (${e.plan}). Without an index it would read the whole table (Seq Scan).`, "🗂️ Card catalog");
  };
  const where = useWorldPoint(toHouse, 0, Math.min(d / 2 - 0.4, 2));
  useProximity({ id: "pg-catalog", label: "Look up an index", radius: 2.2, where, run: lookUp });

  useFrame((_, delta) => {
    const k = 1 - Math.exp(-delta * 8);
    drawers.current.forEach((g, i) => {
      if (g) g.position.z += ((i === active ? 0.42 : 0) - g.position.z) * k;
    });
    if (card.current) {
      const s = THREE.MathUtils.smoothstep(now() - openedAt.current, 0.25, 0.8);
      card.current.scale.setScalar(Math.max(0.001, s));
    }
  });

  const oak = flat("#8a5a34", 0.55);
  const front = flat("#a8743f", 0.45);
  const brass = flat("#c9a45a", 0.3, 0.85);
  const bronze = flat("#7a5532", 0.35, 0.8);
  const dark = flat("#3a2618", 0.6);
  const top = CAT_BASE + CAT_H;
  const [ax, ay] = active >= 0 ? drawerAt(active) : [0, 0];
  const cx = THREE.MathUtils.clamp(ax, -cw / 2 + 0.45, cw / 2 - 0.45);
  return (
    <group onClick={(e) => clicked(e) && lookUp()} {...pointer}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[cw / 2 + 0.12, top / 2, CAT_DEPTH / 2 + 0.12]} position={[0, top / 2, 0]} />
      </RigidBody>
      {/* Plinth, carcass and crown */}
      <mesh position={[0, CAT_BASE / 2, 0]} material={dark} castShadow receiveShadow>
        <boxGeometry args={[cw + 0.24, CAT_BASE, CAT_DEPTH + 0.24]} />
      </mesh>
      <mesh position={[0, CAT_BASE - 0.02, 0]} material={brass}>
        <boxGeometry args={[cw + 0.28, 0.04, CAT_DEPTH + 0.28]} />
      </mesh>
      <mesh position={[0, CAT_BASE + CAT_H / 2, -0.02]} material={oak} castShadow>
        <boxGeometry args={[cw, CAT_H, CAT_DEPTH - 0.04]} />
      </mesh>
      <mesh position={[0, top + 0.04, 0]} material={oak} castShadow>
        <boxGeometry args={[cw + 0.14, 0.08, CAT_DEPTH + 0.12]} />
      </mesh>
      <mesh position={[0, top + 0.005, 0]} material={brass}>
        <boxGeometry args={[cw + 0.1, 0.02, CAT_DEPTH + 0.08]} />
      </mesh>
      <Text position={[0, CAT_BASE / 2, CAT_DEPTH / 2 + 0.125]} fontSize={0.11} color={accent} anchorX="center" anchorY="middle">
        CREATE INDEX · card catalog
      </Text>
      {/* The drawers: each one an index; the open one pulls out on its runners */}
      {Array.from({ length: CAT_COLS * CAT_ROWS }, (_, i) => {
        const [x, y] = drawerAt(i);
        return (
          <group key={i} ref={(g) => void (drawers.current[i] = g)} position={[x, y, 0]}>
            <mesh position={[0, 0, CAT_DEPTH / 2]} material={front} castShadow>
              <boxGeometry args={[cellW - 0.035, cellH - 0.035, 0.04]} />
            </mesh>
            <mesh position={[0, cellH * 0.2, CAT_DEPTH / 2 + 0.022]} material={brass}>
              <boxGeometry args={[cellW * 0.42, cellH * 0.2, 0.006]} />
            </mesh>
            <mesh position={[0, -cellH * 0.14, CAT_DEPTH / 2 + 0.04]} rotation-z={Math.PI / 2} material={brass}>
              <cylinderGeometry args={[0.014, 0.014, cellW * 0.36, 8]} />
            </mesh>
            {i === active && (
              <mesh position={[0, -0.01, CAT_DEPTH / 2 - 0.3]} material={front}>
                <boxGeometry args={[cellW - 0.07, cellH - 0.07, 0.56]} />
              </mesh>
            )}
          </group>
        );
      })}
      {active >= 0 && (
        <group ref={card} position={[cx, ay + 0.34, CAT_DEPTH / 2 + 0.5]} scale={0.001}>
          <Panel position={[0, 0, 0]} width={0.9} height={0.56} map={texture} frame="#c9a45a" />
        </group>
      )}
      {/* The bronze elephant on its pedestal */}
      <group position={[0, top + 0.08, 0]}>
        <mesh position={[0, 0.12, 0]} material={dark} castShadow>
          <cylinderGeometry args={[0.32, 0.36, 0.24, 24]} />
        </mesh>
        <mesh position={[0, 0.3, 0]} scale={[1.1, 0.6, 0.85]} material={bronze} castShadow>
          <sphereGeometry args={[0.3, 20, 14]} />
        </mesh>
        <Elephant position={[0, 0.74, 0.04]} material={bronze} detail={dark} />
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// PostgreSQL · ACID reading room (room)
// ---------------------------------------------------------------------------

/**
 * Four reading tables, each with a green banker's lamp and a placard: A, C, I, D. Click a lamp to
 * light it and read what that guarantee means; E runs a transaction and lights all four in turn.
 */
const ACID = [
  { letter: "A", word: "Atomicity", text: "All or nothing: every statement in a transaction commits together, or a failure rolls the whole thing back. Half a bank transfer never happens." },
  { letter: "C", word: "Consistency", text: "Every commit moves the database from one valid state to another: NOT NULL, UNIQUE, CHECK and FOREIGN KEY constraints are never left broken." },
  { letter: "I", word: "Isolation", text: "Concurrent transactions don't see each other's uncommitted changes. Postgres uses MVCC snapshots; the default level is READ COMMITTED." },
  { letter: "D", word: "Durability", text: "Once COMMIT returns, the change survives a crash: Postgres writes it to the write-ahead log (WAL) on disk first." },
];
const TRANSFER = ["BEGIN;", "UPDATE accounts SET balance = balance - 100 WHERE id = 1;", "UPDATE accounts SET balance = balance + 100 WHERE id = 2;", "COMMIT;"];

function ReadingTable({ position, width, lit, letter, word, onLamp }: { position: V3; width: number; lit: boolean; letter: string; word: string; onLamp: () => void }) {
  const { palette } = useHouse();
  const wood = flat("#5a3a22", 0.5);
  const brass = flat("#c9a45a", 0.3, 0.85);
  return (
    <group position={position}>
      <mesh position={[0, 0.73, 0]} material={wood} castShadow receiveShadow>
        <boxGeometry args={[width, 0.05, 0.85]} />
      </mesh>
      <mesh position={[0, 0.755, 0]} material={flat("#1f4d33", 0.85)}>
        <boxGeometry args={[width - 0.2, 0.004, 0.6]} />
      </mesh>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * (width / 2 - 0.08), 0.355, sz * 0.34]} material={wood} castShadow>
            <boxGeometry args={[0.06, 0.71, 0.06]} />
          </mesh>
        )),
      )}
      <mesh position={[0, 0.66, 0]} material={wood}>
        <boxGeometry args={[width - 0.16, 0.08, 0.72]} />
      </mesh>
      {/* Open book */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.11, 0.77, 0.12]} rotation-z={-s * 0.08} material={flat("#f4efe4", 0.8)}>
          <boxGeometry args={[0.21, 0.02, 0.28]} />
        </mesh>
      ))}
      {/* The banker's lamp */}
      <group position={[-width / 2 + 0.4, 0.755, -0.22]} onClick={(e) => clicked(e) && onLamp()} {...pointer}>
        <mesh position={[0, 0.015, 0]} material={brass}>
          <cylinderGeometry args={[0.08, 0.09, 0.03, 20]} />
        </mesh>
        <mesh position={[0, 0.19, 0]} material={brass}>
          <cylinderGeometry args={[0.012, 0.012, 0.34, 8]} />
        </mesh>
        <mesh position={[0, 0.36, 0]} rotation-z={Math.PI / 2} material={lit ? flat("#1d6b3e", 0.2, 0.1, "#36d07a", 1.4) : flat("#1d5c37", 0.25, 0.2)} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 0.38, 18, 1, true, 0, Math.PI]} />
        </mesh>
        <mesh position={[0, 0.34, 0]} material={lit ? flat("#fff3c4", 0.3, 0, "#ffd98a", 3) : flat("#d9d2b8", 0.4)}>
          <sphereGeometry args={[0.035, 12, 8]} />
        </mesh>
        <mesh position={[0.1, 0.004, 0.18]} rotation-x={-Math.PI / 2} material={lit ? flat("#ffe9b8", 0.8, 0, "#ffd27a", 0.45) : flat("#1f4d33", 0.85)}>
          <circleGeometry args={[0.3, 24]} />
        </mesh>
      </group>
      {/* Placard */}
      <group position={[width / 2 - 0.3, 0.755, -0.12]}>
        <mesh position={[0, 0.1, 0]} rotation-x={-0.2} material={flat(palette.paper, 0.6)} castShadow>
          <boxGeometry args={[0.3, 0.22, 0.012]} />
        </mesh>
        <Text position={[0, 0.13, 0.03]} rotation-x={-0.2} fontSize={0.1} color={lit ? "#1d6b3e" : palette.ink} anchorX="center" anchorY="middle">
          {letter}
        </Text>
        <Text position={[0, 0.045, 0.045]} rotation-x={-0.2} fontSize={0.035} color={palette.ink} anchorX="center" anchorY="middle">
          {word}
        </Text>
      </group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[width / 2, 0.38, 0.43]} position={[0, 0.38, 0]} />
      </RigidBody>
    </group>
  );
}

function PgAcid({ w, d, toHouse, rot, label }: SigProps) {
  const [lit, setLit] = useState([false, false, false, false]);
  const seq = useRef(-1);
  const nextAt = useRef(0);
  const layout = useMemo(() => {
    if (d >= 7) {
      const tx = Math.max(1.7, Math.min(w / 4, w / 2 - 1.1));
      const z1 = -d / 2 + 1.7;
      const z2 = Math.min(z1 + 3, d / 2 - 2.6);
      return { width: 1.5, spots: [[-tx, z1], [tx, z1], [-tx, z2], [tx, z2]] as [number, number][] };
    }
    const step = (w - 0.8) / 4;
    return { width: Math.min(1.4, step - 0.3), spots: [0, 1, 2, 3].map((i) => [-w / 2 + 0.4 + step * (i + 0.5), -d / 2 + 1.3]) as [number, number][] };
  }, [w, d]);
  const seats = useMemo(() => layout.spots.map(([x, z], i) => seatAt(`pg-acid-${i}`, toHouse, rot, x, z + 0.72, Math.PI)), [layout, toHouse, rot]);

  const light = (i: number) => {
    setLit((l) => l.map((v, k) => (k === i ? true : v)));
    sfx.click();
    toast(ACID[i].text, `📚 ${ACID[i].word}`);
  };
  const commit = () => {
    if (seq.current >= 0) return;
    setLit([false, false, false, false]);
    seq.current = 0;
    nextAt.current = now() + 0.5;
    sfx.click();
  };
  useFrame(() => {
    if (seq.current < 0 || now() < nextAt.current) return;
    const i = seq.current;
    setLit((l) => l.map((v, k) => (k <= i ? true : v)));
    sfx.pop();
    seq.current++;
    nextAt.current = now() + 0.7;
    if (seq.current >= ACID.length) {
      seq.current = -1;
      sfx.coin();
      burstAt(toHouse, 0, 1.6, -d / 2 + 1, ["#36d07a", "#c9a45a", "#ffffff"], 20);
      toast("COMMIT; Both updates landed together (A), the balances stayed valid (C), nobody saw the half-done transfer (I), and it's safe in the WAL (D).", "📚 ACID");
    }
  });
  const aisleZ = d >= 7 ? (layout.spots[0][1] + layout.spots[2][1]) / 2 : -d / 2 + 2.4;
  const where = useWorldPoint(toHouse, 0, aisleZ);
  useProximity({ id: "pg-acid", label: "BEGIN; … COMMIT;", radius: 1.8, where, run: commit });

  const wide = w >= 7.5;
  const lines = lit.filter(Boolean).length;
  return (
    <group>
      <CodeBoard position={[0, 1.75, -d / 2 + 0.13]} width={Math.min(w - (wide ? 4.4 : 1.2), 3.4)} height={1.5} kicker={label} title="A transfer, in one transaction" lines={TRANSFER} current={lines - 1} />
      {wide && (
        <>
          <Bookcase position={[-w / 2 + 1.1, 0, -d / 2 + 0.22]} width={1.6} seed={3} />
          <Bookcase position={[w / 2 - 1.1, 0, -d / 2 + 0.22]} width={1.6} seed={8} />
        </>
      )}
      {layout.spots.map(([x, z], i) => (
        <group key={i}>
          <ReadingTable position={[x, 0, z]} width={layout.width} lit={lit[i]} letter={ACID[i].letter} word={ACID[i].word} onLamp={() => light(i)} />
          <SideChair position={[x, 0, z + 0.72]} facing={Math.PI} leather="oxblood" />
        </group>
      ))}
      <Seats seats={seats} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// MySQL · The aquarium (hero)
// ---------------------------------------------------------------------------

/**
 * A tall glass cylinder of water on a sandy base. Sakila the dolphin circles inside with a school of
 * fish (the rows). E runs ORDER BY size: the fish line up from smallest to biggest, then scatter.
 */
const FISH = (() => {
  const r = rng(91);
  const sizes = [0.07, 0.12, 0.09, 0.15, 0.06, 0.11, 0.13, 0.08];
  const colors = ["#f29111", "#fde047", "#38bdf8", "#f472b6", "#a3e635", "#fb7185", "#c084fc", "#fdba74"];
  return sizes.map((size, i) => ({
    size,
    color: colors[i],
    r: 0.25 + r() * 0.55,
    h: 0.2 + r() * 0.6,
    speed: (0.35 + r() * 0.5) * (i % 3 === 0 ? -1 : 1),
    phase: r() * Math.PI * 2,
    rank: sizes.filter((s) => s < size).length,
  }));
})();

function MysqlTank({ w, d, toHouse }: SigProps) {
  const { palette } = useHouse();
  const R = Math.max(1.2, Math.min(2.1, Math.min(w, d) / 2 - 0.7));
  const H = 2.4;
  const B = 0.45;
  const glass = useMemo(() => new THREE.MeshStandardMaterial({ color: "#e6f6fb", transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false }), []);
  const water = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1b8fb3", transparent: true, opacity: 0.3, roughness: 0.1, emissive: "#0b5d78", emissiveIntensity: 0.35, depthWrite: false }), []);
  const dolphin = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const fish = useRef<(THREE.Group | null)[]>([]);
  const weeds = useRef<(THREE.Mesh | null)[]>([]);
  const bubbles = useRef<(THREE.Mesh | null)[]>([]);
  const sortAt = useRef(-100);

  const sort = () => {
    sortAt.current = now();
    sfx.splash();
    toast("ORDER BY size returned all 8 rows smallest first: ASC is the default. ORDER BY size DESC LIMIT 3 would give you the three biggest.", "🐬 The Aquarium");
  };
  const where = useWorldPoint(toHouse, 0, Math.min(d / 2 - 0.4, R + 1));
  useProximity({ id: "mysql-tank", label: "SELECT * FROM fish ORDER BY size", radius: 2.2, where, run: sort });

  useFrame(() => {
    const t = now();
    if (dolphin.current) {
      const a = t * 0.55;
      const r = R * 0.62;
      dolphin.current.position.set(Math.cos(a) * r, B + H * 0.55 + Math.sin(t * 1.3) * 0.15, Math.sin(a) * r);
      dolphin.current.rotation.set(Math.cos(t * 1.3) * -0.12, -a, -0.15);
    }
    if (tail.current) tail.current.rotation.x = Math.sin(t * 6) * 0.35;
    const age = t - sortAt.current;
    const k = age < 0 ? 0 : age < 1.2 ? smooth(age / 1.2) : age < 4.6 ? 1 : age < 5.8 ? 1 - smooth((age - 4.6) / 1.2) : 0;
    const lineW = R * 1.4;
    fish.current.forEach((g, i) => {
      if (!g) return;
      const f = FISH[i];
      const a = t * f.speed + f.phase;
      const sx = Math.cos(a) * f.r * R;
      const sz = Math.sin(a) * f.r * R;
      const sy = B + 0.2 + H * f.h * 0.85 + Math.sin(t * 2 + i) * 0.05;
      const lx = -lineW / 2 + f.rank * (lineW / (FISH.length - 1));
      g.position.set(sx + (lx - sx) * k, sy + (B + H * 0.32 - sy) * k, sz + (R * 0.45 - sz) * k);
      g.rotation.y = k > 0.5 ? Math.PI / 2 : -a + (f.speed < 0 ? Math.PI : 0);
    });
    weeds.current.forEach((m, i) => m && (m.rotation.z = Math.sin(t * 0.9 + i * 1.7) * 0.12));
    bubbles.current.forEach((m, i) => m && (m.position.y = B + 0.2 + ((t * 0.35 + i * 0.37) % 1) * H * 0.85));
  });

  const skin = flat("#7c8fa3", 0.35, 0.1);
  const belly = flat("#c9d4de", 0.4);
  const steel = flat("#2d3a44", 0.35, 0.7);
  return (
    <group onClick={(e) => clicked(e) && sort()} {...pointer}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[R + 0.1, (B + H) / 2, R + 0.1]} position={[0, (B + H) / 2, 0]} />
      </RigidBody>
      {/* Base, sand and rims */}
      <mesh position={[0, B / 2, 0]} material={flat(palette.ink, 0.4, 0.3)} castShadow receiveShadow>
        <cylinderGeometry args={[R + 0.15, R + 0.22, B, 48]} />
      </mesh>
      <mesh position={[0, B - 0.03, 0]} material={flat(palette.second, 0.4, 0.4)}>
        <torusGeometry args={[R + 0.05, 0.05, 8, 64]} />
      </mesh>
      <mesh position={[0, B + 0.06, 0]} material={flat("#e6d3a3", 0.95)}>
        <cylinderGeometry args={[R - 0.02, R - 0.02, 0.12, 48]} />
      </mesh>
      {[[0.5, 0.3, 0.18], [-0.6, -0.4, 0.14], [0.1, -0.7, 0.22]].map(([x, z, s], i) => (
        <mesh key={i} position={[x * R, B + 0.12, z * R]} scale={[1.3, 0.7, 1]} material={flat("#8a8a7e", 0.9)}>
          <dodecahedronGeometry args={[s, 0]} />
        </mesh>
      ))}
      {[-0.55, -0.2, 0.3, 0.6].map((x, i) => (
        <mesh key={i} ref={(m) => void (weeds.current[i] = m)} position={[x * R, B + 0.12 + 0.45, (i % 2 ? -0.5 : -0.2) * R]} material={flat("#2f8a4a", 0.6)}>
          <coneGeometry args={[0.07, 0.9 + (i % 2) * 0.3, 6]} />
        </mesh>
      ))}
      <mesh position={[0, B + 0.12 + (H * 0.9) / 2, 0]} material={water}>
        <cylinderGeometry args={[R - 0.03, R - 0.03, H * 0.9, 48]} />
      </mesh>
      <mesh position={[0, B + H / 2, 0]} material={glass}>
        <cylinderGeometry args={[R, R, H, 48, 1, true]} />
      </mesh>
      <mesh position={[0, B + H, 0]} rotation-x={Math.PI / 2} material={steel}>
        <torusGeometry args={[R, 0.06, 8, 64]} />
      </mesh>
      <mesh position={[0, B + H + 0.08, 0]} rotation-x={Math.PI / 2} material={flat(palette.second, 0.4, 0.4)}>
        <torusGeometry args={[R + 0.02, 0.03, 6, 64]} />
      </mesh>
      {/* Plaque */}
      <mesh position={[0, B / 2, R + 0.2]} material={steel}>
        <boxGeometry args={[Math.min(2.2, R * 1.4), 0.24, 0.04]} />
      </mesh>
      <Text position={[0, B / 2, R + 0.225]} fontSize={0.075} color={palette.paper} anchorX="center" anchorY="middle">
        SELECT * FROM fish ORDER BY size;
      </Text>
      {/* Sakila the dolphin (faces +z inside its group) */}
      <group ref={dolphin}>
        <mesh material={skin} scale={[0.8, 0.78, 2.3]} castShadow>
          <sphereGeometry args={[0.2, 20, 14]} />
        </mesh>
        <mesh position={[0, -0.05, 0.05]} material={belly} scale={[0.68, 0.55, 2]}>
          <sphereGeometry args={[0.2, 16, 12]} />
        </mesh>
        <mesh position={[0, 0.03, 0.34]} material={skin}>
          <sphereGeometry args={[0.15, 16, 12]} />
        </mesh>
        <mesh position={[0, -0.03, 0.52]} rotation-x={Math.PI / 2} material={skin}>
          <cylinderGeometry args={[0.045, 0.07, 0.18, 12]} />
        </mesh>
        <mesh position={[0, 0.2, -0.04]} rotation-x={-0.6} scale={[0.25, 1, 1]} material={skin}>
          <coneGeometry args={[0.12, 0.24, 12]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.16, -0.1, 0.15]} rotation-z={s * -0.6} material={skin}>
            <boxGeometry args={[0.18, 0.02, 0.08]} />
          </mesh>
        ))}
        {[-1, 1].map((s) => (
          <mesh key={`e${s}`} position={[s * 0.1, 0.05, 0.42]} material={flat("#111827", 0.3)}>
            <sphereGeometry args={[0.018, 8, 6]} />
          </mesh>
        ))}
        <group ref={tail} position={[0, 0, -0.42]}>
          <mesh position={[0, 0, -0.1]} rotation-x={-Math.PI / 2} material={skin}>
            <cylinderGeometry args={[0.05, 0.1, 0.22, 10]} />
          </mesh>
          <mesh position={[0, 0, -0.24]} scale={[1, 0.15, 0.5]} material={skin}>
            <sphereGeometry args={[0.2, 12, 8]} />
          </mesh>
        </group>
      </group>
      {/* The rows */}
      {FISH.map((f, i) => (
        <group key={i} ref={(g) => void (fish.current[i] = g)}>
          <mesh scale={[0.45, 0.75, 1]} material={flat(f.color, 0.4)}>
            <sphereGeometry args={[f.size, 12, 8]} />
          </mesh>
          <mesh position={[0, 0, -f.size * 1.15]} rotation-x={Math.PI / 2} scale={[0.3, 1, 1]} material={flat(f.color, 0.4)}>
            <coneGeometry args={[f.size * 0.6, f.size * 0.6, 4]} />
          </mesh>
        </group>
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} ref={(m) => void (bubbles.current[i] = m)} position={[Math.cos(i * 2.1) * R * 0.5, B + 0.3, Math.sin(i * 2.1) * R * 0.5]} material={glass}>
          <sphereGeometry args={[0.03 + (i % 3) * 0.01, 8, 6]} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// MySQL · Query pier (room)
// ---------------------------------------------------------------------------

/**
 * A wooden pier deck along the back of the room with water beyond it and a fishing rod in a holder.
 * E casts a query: the bobber flies out, and a moment later the result is reeled in, from an empty
 * set to a few rows.
 */
const CASTS = [
  { q: "SELECT * FROM fish WHERE id = 42;", r: "1 row in set (0.01 sec)", n: 1, note: "Found by primary key: MySQL went straight to it through the PRIMARY index." },
  { q: "SELECT * FROM fish WHERE species = 'shark';", r: "Empty set (0.00 sec)", n: 0, note: "Empty set: the query was fine, no row matched the WHERE clause." },
  { q: "SELECT * FROM fish WHERE size > 30 LIMIT 3;", r: "3 rows in set (0.02 sec)", n: 3, note: "LIMIT 3 stops as soon as three matching rows are found." },
  { q: "SELECT name FROM fish ORDER BY caught_at DESC LIMIT 2;", r: "2 rows in set (0.01 sec)", n: 2, note: "ORDER BY … DESC LIMIT 2: the two most recent catches." },
];

function MysqlFishing({ w, d, toHouse, rot }: SigProps) {
  const { palette } = useHouse();
  const [cast, setCast] = useState(-1);
  const [phase, setPhase] = useState<"idle" | "cast" | "caught">("idle");
  const stage = useRef<"idle" | "cast" | "caught">("idle");
  const castAt = useRef(-10);
  const bobber = useRef<THREE.Group>(null);
  const line = useRef<THREE.Mesh>(null);
  const ripple = useRef<THREE.Mesh>(null);
  const catchGroup = useRef<THREE.Group>(null);
  const wd = Math.min(2.6, d * 0.32);
  const edge = -d / 2 + wd;
  const deck = 1.5;
  const rx = 0.5;
  const tip = useMemo(() => new THREE.Vector3(rx + 0.3, 2.1, edge - Math.min(1.1, wd * 0.5)), [edge, wd]);
  const butt: V3 = [rx, 0.55, edge + 0.32];
  const land = useMemo(() => new THREE.Vector3(rx + 0.6, 0.07, edge - wd * 0.78), [edge, wd]);
  const hang = useMemo(() => new THREE.Vector3(tip.x, tip.y - 0.7, tip.z), [tip]);
  const reeled = useMemo(() => new THREE.Vector3(tip.x, 1.35, tip.z + 0.15), [tip]);
  const pos = useRef(new THREE.Vector3());
  const result = CASTS[Math.max(0, cast) % CASTS.length];

  const throwLine = () => {
    if (stage.current !== "idle") return;
    stage.current = "cast";
    castAt.current = now();
    setCast((c) => c + 1);
    setPhase("cast");
    sfx.click();
  };
  const where = useWorldPoint(toHouse, rx, edge + 1);
  useProximity({ id: "mysql-fishing", label: phase === "idle" ? "Cast a query" : "Reeling…", radius: 1.8, where, run: throwLine });

  useFrame(() => {
    const age = now() - castAt.current;
    const p = pos.current;
    if (stage.current === "cast" && age >= 1.8) {
      stage.current = "caught";
      setPhase("caught");
      sfx.splash();
      const c = CASTS[Math.max(0, cast) % CASTS.length];
      burstAt(toHouse, land.x, 0.3, land.z, ["#7dd3fc", "#ffffff"], 14);
      toast(`${c.q} → ${c.r}. ${c.note}`, "🎣 Query Pier");
    } else if (stage.current === "caught" && age >= 6.5) {
      stage.current = "idle";
      setPhase("idle");
    }
    if (stage.current === "idle") p.copy(hang).setX(hang.x + Math.sin(now() * 1.2) * 0.03);
    else if (age < 0.9) {
      const k = age / 0.9;
      p.lerpVectors(hang, land, k);
      p.y += Math.sin(Math.PI * k) * 1.1;
    } else if (age < 1.8) p.copy(land).setY(0.07 + Math.sin(age * 12) * 0.02 - (age > 1.4 ? 0.05 : 0));
    else if (age < 2.6) p.lerpVectors(land, reeled, smooth((age - 1.8) / 0.8));
    else p.copy(reeled).setX(reeled.x + Math.sin(age * 2) * 0.04);
    if (bobber.current) bobber.current.position.copy(p);
    if (line.current) stretch(line.current, tip, p);
    if (ripple.current) {
      const on = stage.current !== "idle" && age > 0.9 && age < 2.2;
      ripple.current.visible = on;
      ripple.current.scale.setScalar(on ? 1 + ((age - 0.9) % 0.5) * 3 : 1);
    }
    if (catchGroup.current) catchGroup.current.visible = stage.current === "caught";
  });

  const plank = flat("#9a7048", 0.75);
  const plankDark = flat("#7d5a38", 0.8);
  const post = flat("#5a3f28", 0.85);
  const waterMat = flat("#1f6f8b", 0.12, 0.3);
  const planks = Math.floor(deck / 0.15);
  const pilings = Math.max(2, Math.floor((w - 0.6) / 1.2) + 1);
  const benchX = -w / 2 + 1.2;
  const seats = useMemo(() => [seatAt("mysql-fishing-bench", toHouse, rot, -w / 2 + 1.2, edge + 1.05, Math.PI)], [toHouse, rot, w, edge]);
  return (
    <group>
      {/* Water and its collider */}
      <mesh position={[0, 0.035, -d / 2 + wd / 2]} rotation-x={-Math.PI / 2} material={waterMat} receiveShadow>
        <planeGeometry args={[w - 0.3, wd]} />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[w / 2 - 0.15, 0.6, wd / 2]} position={[0, 0.6, -d / 2 + wd / 2]} />
      </RigidBody>
      {/* The deck */}
      {Array.from({ length: planks }, (_, i) => (
        <mesh key={i} position={[0, 0.03, edge + 0.08 + i * 0.15]} material={i % 2 ? plank : plankDark} receiveShadow>
          <boxGeometry args={[w - 0.3, 0.05, 0.13]} />
        </mesh>
      ))}
      {Array.from({ length: pilings }, (_, i) => {
        const x = -w / 2 + 0.3 + (i * (w - 0.6)) / (pilings - 1);
        return (
          <mesh key={i} position={[x, 0.32, edge - 0.04]} material={post} castShadow>
            <cylinderGeometry args={[0.08, 0.09, 0.64, 10]} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.58, edge - 0.04]} material={post}>
        <boxGeometry args={[w - 0.5, 0.06, 0.06]} />
      </mesh>
      {/* Rod holder, rod, line and bobber */}
      <mesh position={[rx, 0.3, edge + 0.32]} material={flat("#3b3b3b", 0.4, 0.6)}>
        <cylinderGeometry args={[0.04, 0.05, 0.6, 10]} />
      </mesh>
      <Stick from={butt} to={[tip.x, tip.y, tip.z]} radius={0.025} radiusTop={0.008} material={flat("#2b2b2b", 0.3, 0.4)} />
      <mesh position={[rx + 0.05, 0.78, edge + 0.22]} rotation-x={Math.PI / 2} material={flat(palette.second, 0.4, 0.5)}>
        <cylinderGeometry args={[0.06, 0.06, 0.05, 14]} />
      </mesh>
      <mesh ref={line} material={flat("#f4f4f4", 0.5)}>
        <cylinderGeometry args={[0.004, 0.004, 1, 4]} />
      </mesh>
      <group ref={bobber}>
        <mesh position={[0, 0.04, 0]} material={flat("#ef4444", 0.4)}>
          <sphereGeometry args={[0.045, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <mesh position={[0, 0.04, 0]} rotation-x={Math.PI} material={flat("#ffffff", 0.4)}>
          <sphereGeometry args={[0.045, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <group ref={catchGroup} visible={false}>
          {Array.from({ length: result.n }, (_, i) => (
            <group key={i} position={[(i - (result.n - 1) / 2) * 0.12, -0.25 - i * 0.05, 0]} rotation-z={Math.PI / 2}>
              <mesh scale={[0.4, 1, 0.75]} material={flat(i % 2 ? "#f29111" : "#7cc4d8", 0.35, 0.2)}>
                <sphereGeometry args={[0.12, 12, 8]} />
              </mesh>
              <mesh position={[0, -0.15, 0]} scale={[0.3, 1, 1]} material={flat("#f29111", 0.4)}>
                <coneGeometry args={[0.07, 0.08, 4]} />
              </mesh>
            </group>
          ))}
        </group>
      </group>
      <mesh ref={ripple} position={[land.x, 0.045, land.z]} rotation-x={-Math.PI / 2} material={flat("#cdeef7", 0.3)} visible={false}>
        <ringGeometry args={[0.12, 0.15, 24]} />
      </mesh>
      {/* Result board */}
      <group position={[-Math.min(1.8, w / 2 - 1.6), 0, edge + 0.7]}>
        {[-0.6, 0.6].map((x) => (
          <mesh key={x} position={[x, 0.75, 0]} material={post} castShadow>
            <boxGeometry args={[0.06, 1.5, 0.06]} />
          </mesh>
        ))}
        <mesh position={[0, 1.3, 0]} material={flat(palette.ink, 0.6)}>
          <boxGeometry args={[1.4, 0.62, 0.04]} />
        </mesh>
        <Text position={[0, 1.44, 0.03]} fontSize={0.06} maxWidth={1.25} color={palette.paper} anchorX="center" anchorY="middle" textAlign="center">
          {cast < 0 ? "mysql> cast a query from the rod" : `mysql> ${result.q}`}
        </Text>
        <Text position={[0, 1.17, 0.03]} fontSize={0.09} color={phase === "caught" ? (result.n ? "#86efac" : "#fca5a5") : palette.second} anchorX="center" anchorY="middle">
          {phase === "caught" ? result.r : phase === "cast" ? "waiting for a bite…" : "ready"}
        </Text>
      </group>
      {/* Bench and bait bucket */}
      <group position={[benchX, 0, edge + 1.05]}>
        <mesh position={[0, 0.44, 0]} material={plank} castShadow>
          <boxGeometry args={[1.2, 0.05, 0.38]} />
        </mesh>
        {[-0.5, 0.5].map((x) => (
          <mesh key={x} position={[x, 0.22, 0]} material={post}>
            <boxGeometry args={[0.06, 0.44, 0.34]} />
          </mesh>
        ))}
      </group>
      <mesh position={[rx + 0.5, 0.15, edge + 0.4]} material={flat("#64748b", 0.4, 0.6)}>
        <cylinderGeometry args={[0.14, 0.12, 0.3, 16, 1, true]} />
      </mesh>
      <Seats seats={seats} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// MongoDB · The document tree (hero)
// ---------------------------------------------------------------------------

/**
 * A tree in a round stone planter whose leaves are JSON documents, a few with their fields written
 * on them. E runs insertOne(): a new leaf grows on a branch and the document counter goes up.
 */
const LEAF_START = 16;
const LEAF_MAX = 30;
const TRUNK_TOP = 2.3;
const BRANCHES = Array.from({ length: 6 }, (_, i) => {
  const a = (i / 6) * Math.PI * 2 + 0.4;
  const y = 1.6 + (i % 3) * 0.28;
  const len = 0.95 + (i % 2) * 0.25;
  return { from: [0, y, 0] as V3, to: [Math.cos(a) * len, y + 0.5 + (i % 3) * 0.15, Math.sin(a) * len] as V3 };
});
const DOCS = ['{ "_id": 1,\n  "name": "Wouroud" }', '{ "_id": 2,\n  "city": "Tripoli" }', '{ "_id": 3,\n  "tags": ["react"] }', '{ "_id": 4,\n  "level": 9 }'];
const LEAVES = (() => {
  const r = rng(4242);
  let texted = 0;
  return Array.from({ length: LEAF_MAX }, (_, j) => {
    const b = BRANCHES[j % BRANCHES.length];
    const t = 0.55 + r() * 0.5;
    const p: V3 = [b.from[0] + (b.to[0] - b.from[0]) * t + (r() - 0.5) * 0.35, b.from[1] + (b.to[1] - b.from[1]) * t + (r() - 0.5) * 0.3, b.from[2] + (b.to[2] - b.from[2]) * t + (r() - 0.5) * 0.35];
    const yaw = Math.atan2(p[0], p[2]) + (r() - 0.5) * 0.8;
    const doc = j < LEAF_START && Math.cos(yaw) > 0.5 && texted < DOCS.length ? DOCS[texted++] : null;
    return { p, yaw, tilt: -0.4 + r() * 0.7, size: 0.8 + r() * 0.4, color: j % 4, doc };
  });
})();

function MongoTree({ w, d, toHouse }: SigProps) {
  const { palette, accent } = useHouse();
  const [n, setN] = useState(LEAF_START);
  const bornAt = useRef(-10);
  const leaves = useRef<(THREE.Group | null)[]>([]);
  const crown = useRef<THREE.Group>(null);
  const PR = Math.max(1, Math.min(1.4, Math.min(w, d) / 2 - 1.3));
  const leafGeo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(0.13, 0.08, 0.13, 0.3, 0, 0.42);
    s.bezierCurveTo(-0.13, 0.3, -0.13, 0.08, 0, 0);
    return new THREE.ShapeGeometry(s, 8);
  }, []);
  const leafMats = useMemo(() => ["#47a248", "#13aa52", "#2f7d32", "#7cc96b"].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, side: THREE.DoubleSide })), []);

  const insert = () => {
    if (n >= LEAF_MAX) {
      setN(LEAF_START);
      sfx.rustle();
      toast(`deleteMany({ season: "autumn" }) → { deletedCount: ${n - LEAF_START} }. The tree is back to ${LEAF_START} documents.`, "🌳 Document tree");
      return;
    }
    const id = Array.from({ length: 24 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
    const [x, y, z] = LEAVES[n].p;
    setN(n + 1);
    bornAt.current = now();
    sfx.pop();
    burstAt(toHouse, x, y, z, [accent, "#d9f99d", "#ffffff"], 12);
    toast(`insertOne({ name: "leaf ${n + 1}" }) → { acknowledged: true, insertedId: ObjectId('${id}') }. No schema to change first: the next document can have different fields.`, "🌳 Document tree");
  };
  const where = useWorldPoint(toHouse, 0, Math.min(d / 2 - 0.4, PR + 1));
  useProximity({ id: "mongo-tree", label: n >= LEAF_MAX ? "deleteMany() (prune the tree)" : "insertOne()", radius: 2.2, where, run: insert });

  useFrame(() => {
    const t = now();
    if (crown.current) crown.current.rotation.z = Math.sin(t * 0.6) * 0.015;
    const g = leaves.current[n - 1];
    const age = t - bornAt.current;
    if (g && age < 1) {
      const k = Math.min(1, age / 0.6);
      g.scale.setScalar(Math.max(0.001, 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2)));
    }
  });

  const bark = flat("#6b4a2f", 0.85);
  const stone = flat("#a69c86", 0.85);
  return (
    <group onClick={(e) => clicked(e) && insert()} {...pointer}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[PR, 0.3, PR]} position={[0, 0.3, 0]} />
      </RigidBody>
      {/* Planter */}
      <mesh position={[0, 0.25, 0]} material={stone} castShadow receiveShadow>
        <cylinderGeometry args={[PR, PR + 0.08, 0.5, 40]} />
      </mesh>
      <mesh position={[0, 0.51, 0]} rotation-x={Math.PI / 2} material={flat("#7d735f", 0.8)}>
        <torusGeometry args={[PR - 0.04, 0.06, 8, 48]} />
      </mesh>
      <mesh position={[0, 0.5, 0]} rotation-x={-Math.PI / 2} material={flat("#3b2a1d", 0.95)}>
        <circleGeometry args={[PR - 0.05, 40]} />
      </mesh>
      <mesh position={[0, 0.25, PR + 0.04]} material={flat(palette.ink, 0.5)}>
        <boxGeometry args={[1.5, 0.26, 0.03]} />
      </mesh>
      <Text position={[0, 0.25, PR + 0.06]} fontSize={0.12} color={accent} anchorX="center" anchorY="middle">
        {`db.tree · documents: ${n}`}
      </Text>
      {/* Trunk, roots and branches */}
      <mesh position={[0, 0.5 + (TRUNK_TOP - 0.5) / 2, 0]} material={bark} castShadow>
        <cylinderGeometry args={[0.15, 0.28, TRUNK_TOP - 0.5, 14]} />
      </mesh>
      {[0, 2.1, 4.2].map((a) => (
        <Stick key={a} from={[0, 0.65, 0]} to={[Math.cos(a) * 0.5, 0.5, Math.sin(a) * 0.5]} radius={0.06} radiusTop={0.12} material={bark} />
      ))}
      <group ref={crown}>
        {BRANCHES.map((b, i) => (
          <Stick key={i} from={b.from} to={b.to} radius={0.09} radiusTop={0.03} material={bark} />
        ))}
        <Stick from={[0, TRUNK_TOP - 0.1, 0]} to={[0.1, TRUNK_TOP + 0.9, -0.1]} radius={0.12} radiusTop={0.03} material={bark} />
        {LEAVES.slice(0, n).map((l, j) => (
          <group key={j} ref={(g) => void (leaves.current[j] = g)} position={l.p}>
            <group rotation-y={l.yaw}>
              <group rotation-x={l.tilt} scale={l.size}>
                <mesh geometry={leafGeo} material={leafMats[l.color]} castShadow />
                {l.doc && (
                  <Text position={[0, 0.2, 0.004]} fontSize={0.028} maxWidth={0.2} color="#f1f9ef" anchorX="center" anchorY="middle" textAlign="left">
                    {l.doc}
                  </Text>
                )}
              </group>
            </group>
          </group>
        ))}
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// MongoDB · Collection beds (room)
// ---------------------------------------------------------------------------

/**
 * Three raised planter beds, one per collection (users, posts, events), each growing its own mix
 * of plants: no two documents have to look alike. E runs a query and the matching bed glows; click
 * a bed to see two of its documents side by side.
 */
type PlantKind = "bush" | "tulip" | "fern" | "cactus" | "sunflower" | "grass" | "succulent";
const BEDS: { name: string; sample: string; plants: [PlantKind, string, number][] }[] = [
  { name: "users", sample: 'db.users holds { name: "Wouroud", city: "Tripoli" } next to { name: "Sam", github: "sam-dev", skills: ["go"] }. Same collection, different fields.', plants: [["bush", "#3f8f3a", 1], ["tulip", "#e5487a", 0.9], ["cactus", "#4f8a4a", 0.8], ["grass", "#7fb04a", 1.1]] },
  { name: "posts", sample: 'db.posts: { title: "Hooks 101", tags: ["react", "hooks"] } sits beside { title: "Hello", draft: true }. Adding a field needs no migration.', plants: [["sunflower", "#facc15", 1], ["fern", "#2f7d32", 1.1], ["tulip", "#f59e0b", 1.2], ["succulent", "#86c5a0", 0.9]] },
  { name: "events", sample: 'db.events: { type: "deploy", at: ISODate("2026-10-16") } and { type: "signup", user: { name: "Lina" } }. Documents can nest objects and arrays.', plants: [["cactus", "#3d7a3a", 1.3], ["bush", "#6aa84f", 0.7], ["sunflower", "#fb923c", 0.75], ["fern", "#4c9a52", 0.8]] },
];
const BED_QUERIES = [
  { bed: 1, label: "find({ tags: 'react' })", q: "db.posts.find({ tags: 'react' })", n: 3, why: "Matching a value inside an array just works: 3 posts have 'react' in their tags array." },
  { bed: 0, label: "find({ city: 'Tripoli' })", q: "db.users.find({ city: 'Tripoli' })", n: 2, why: "Users without a city field are simply skipped; nobody had to add a NULL column." },
  { bed: 2, label: "countDocuments({ type: 'deploy' })", q: "db.events.countDocuments({ type: 'deploy' })", n: 4, why: "An index on { type: 1 } would keep this fast as the collection grows." },
];

function Plant({ kind, color, s, position }: { kind: PlantKind; color: string; s: number; position: V3 }) {
  const leaf = flat("#3f7f3a", 0.7);
  const c = flat(color, 0.6);
  return (
    <group position={position} scale={s}>
      {kind === "bush" &&
        [[0, 0.16, 0, 0.18], [0.14, 0.12, 0.05, 0.13], [-0.12, 0.11, -0.04, 0.12]].map(([x, y, z, r], i) => (
          <mesh key={i} position={[x, y, z]} material={c} castShadow>
            <icosahedronGeometry args={[r, 1]} />
          </mesh>
        ))}
      {kind === "tulip" &&
        [[-0.06, 0.42], [0.07, 0.34]].map(([x, h], i) => (
          <group key={i} position={[x, 0, i * 0.05]}>
            <mesh position={[0, h / 2, 0]} material={leaf}>
              <cylinderGeometry args={[0.008, 0.01, h, 6]} />
            </mesh>
            <mesh position={[0, h + 0.04, 0]} scale={[1, 1.4, 1]} material={c} castShadow>
              <sphereGeometry args={[0.05, 12, 8]} />
            </mesh>
          </group>
        ))}
      {kind === "fern" &&
        [0, 1.25, 2.5, 3.75, 5].map((a, i) => (
          <mesh key={i} position={[Math.cos(a) * 0.1, 0.18, Math.sin(a) * 0.1]} rotation={[Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7]} scale={[1, 1, 0.3]} material={c} castShadow>
            <coneGeometry args={[0.06, 0.45, 6]} />
          </mesh>
        ))}
      {kind === "cactus" && (
        <>
          <mesh position={[0, 0.25, 0]} material={c} castShadow>
            <cylinderGeometry args={[0.07, 0.08, 0.5, 10]} />
          </mesh>
          <mesh position={[0, 0.5, 0]} material={c}>
            <sphereGeometry args={[0.07, 10, 8]} />
          </mesh>
          <mesh position={[0.1, 0.28, 0]} rotation-z={Math.PI / 2} material={c}>
            <cylinderGeometry args={[0.035, 0.035, 0.12, 8]} />
          </mesh>
          <mesh position={[0.15, 0.36, 0]} material={c}>
            <cylinderGeometry args={[0.035, 0.035, 0.16, 8]} />
          </mesh>
          <mesh position={[0, 0.58, 0]} material={flat("#f472b6", 0.6)}>
            <sphereGeometry args={[0.03, 8, 6]} />
          </mesh>
        </>
      )}
      {kind === "sunflower" && (
        <>
          <mesh position={[0, 0.45, 0]} material={leaf}>
            <cylinderGeometry args={[0.012, 0.016, 0.9, 6]} />
          </mesh>
          <mesh position={[0.06, 0.4, 0]} rotation-z={-0.9} scale={[1, 1, 0.25]} material={leaf}>
            <coneGeometry args={[0.05, 0.16, 6]} />
          </mesh>
          <mesh position={[0, 0.92, 0.02]} rotation-x={Math.PI / 2 - 0.3} material={c} castShadow>
            <cylinderGeometry args={[0.13, 0.13, 0.02, 16]} />
          </mesh>
          <mesh position={[0, 0.924, 0.035]} rotation-x={Math.PI / 2 - 0.3} material={flat("#5b3a1e", 0.9)}>
            <cylinderGeometry args={[0.06, 0.06, 0.025, 12]} />
          </mesh>
        </>
      )}
      {kind === "grass" &&
        [-0.08, -0.03, 0.02, 0.07, 0.11].map((x, i) => (
          <mesh key={i} position={[x, 0.17, (i % 2) * 0.04]} rotation-z={x * 3} material={c}>
            <coneGeometry args={[0.018, 0.34 + (i % 3) * 0.06, 4]} />
          </mesh>
        ))}
      {kind === "succulent" &&
        [0, 1.05, 2.1, 3.15, 4.2, 5.25].map((a, i) => (
          <mesh key={i} position={[Math.cos(a) * 0.06, 0.05, Math.sin(a) * 0.06]} rotation={[Math.sin(a) * 1, 0, -Math.cos(a) * 1]} scale={[1, 1, 0.5]} material={c}>
            <coneGeometry args={[0.04, 0.14, 6]} />
          </mesh>
        ))}
    </group>
  );
}

function MongoBeds({ w, d, toHouse, label }: SigProps) {
  const { palette, accent } = useHouse();
  const [qi, setQi] = useState(0);
  const [lastRun, setLastRun] = useState(-1);
  const glowAt = useRef(-10);
  const glowBed = useRef(-1);
  const caps = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const bw = Math.min(1.8, (w - 2.4) / 3);
  const gap = (w - 3 * bw) / 4;
  const bz = -d / 2 + 1.05;

  const query = () => {
    const q = BED_QUERIES[qi];
    glowBed.current = q.bed;
    glowAt.current = now();
    setLastRun(qi);
    setQi((qi + 1) % BED_QUERIES.length);
    sfx.chirp();
    toast(`${q.q} → ${q.n} documents. ${q.why}`, `🌱 ${label}`);
  };
  const inspect = (i: number) => {
    sfx.rustle();
    toast(BEDS[i].sample, `🌱 ${BEDS[i].name}`);
  };
  const where = useWorldPoint(toHouse, 0, bz + 1.4);
  useProximity({ id: "mongo-beds", label: BED_QUERIES[qi].label, radius: 1.9, where, run: query });

  useFrame(() => {
    const age = now() - glowAt.current;
    caps.current.forEach((m, i) => {
      if (m) m.emissiveIntensity = i === glowBed.current && age < 4 ? (0.9 + Math.sin(age * 6) * 0.4) * (1 - age / 4) : 0;
    });
  });

  const wood = flat("#8a6440", 0.75);
  return (
    <group>
      <CodeBoard position={[0, 2.05, -d / 2 + 0.13]} width={Math.min(w - 1.6, 3.4)} height={1.1} kicker={label} title="Queries (press E)" lines={BED_QUERIES.map((q) => q.q)} current={lastRun} />
      {BEDS.map((bed, i) => {
        const x = -w / 2 + gap + bw / 2 + i * (bw + gap);
        return (
          <group key={bed.name} position={[x, 0, bz]} onClick={(e) => clicked(e) && inspect(i)} {...pointer}>
            {/* Raised bed: four boards, capping and soil */}
            {[
              [0, 0.45, bw, 0.06],
              [0, -0.45, bw, 0.06],
            ].map(([px, pz, sx, sz], k) => (
              <mesh key={k} position={[px, 0.22, pz]} material={wood} castShadow>
                <boxGeometry args={[sx, 0.44, sz]} />
              </mesh>
            ))}
            {[-1, 1].map((s) => (
              <mesh key={s} position={[s * (bw / 2 - 0.03), 0.22, 0]} material={wood} castShadow>
                <boxGeometry args={[0.06, 0.44, 0.84]} />
              </mesh>
            ))}
            <mesh position={[0, 0.455, 0]}>
              <boxGeometry args={[bw + 0.06, 0.03, 0.96]} />
              <meshStandardMaterial ref={(m) => void (caps.current[i] = m)} color="#a07a52" roughness={0.6} emissive={accent} emissiveIntensity={0} />
            </mesh>
            <mesh position={[0, 0.41, 0]} material={flat("#3b2a1d", 0.95)}>
              <boxGeometry args={[bw - 0.12, 0.04, 0.84]} />
            </mesh>
            {bed.plants.map(([kind, color, s], k) => (
              <Plant key={k} kind={kind} color={color} s={s} position={[-bw / 2 + 0.25 + (k * (bw - 0.5)) / 3, 0.43, k % 2 ? 0.15 : -0.15]} />
            ))}
            {/* Name plate */}
            <mesh position={[0, 0.25, 0.49]} material={flat(palette.ink, 0.5)}>
              <boxGeometry args={[0.7, 0.18, 0.02]} />
            </mesh>
            <Text position={[0, 0.25, 0.505]} fontSize={0.1} color={palette.paper} anchorX="center" anchorY="middle">
              {bed.name}
            </Text>
            <RigidBody type="fixed" colliders={false}>
              <CuboidCollider args={[bw / 2, 0.3, 0.48]} position={[0, 0.3, 0]} />
            </RigidBody>
          </group>
        );
      })}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Firebase · Realtime alarm (hero)
// ---------------------------------------------------------------------------

/**
 * A brass alarm bell on a red post, with a horseshoe of devices on stands around it (phones, a
 * tablet, a laptop, a dispatch monitor). E writes one value to /alerts: every screen shows it at
 * the same instant, the bell rings and the red beacons flash.
 */
type DeviceKind = "phone" | "tablet" | "laptop" | "monitor";
const DEVICE_SIZE: Record<DeviceKind, [number, number]> = { phone: [0.46, 0.86], tablet: [0.9, 0.66], laptop: [0.95, 0.6], monitor: [1.15, 0.7] };
const DEVICES: { kind: DeviceKind; name: string }[] = [
  { kind: "phone", name: "Android" },
  { kind: "tablet", name: "iPad" },
  { kind: "laptop", name: "Web app" },
  { kind: "monitor", name: "Dispatch desk" },
  { kind: "phone", name: "iPhone" },
];
const ALERTS = ["Engine 3 dispatched to Harbor St.", "Drill at 14:05 for all crews", "Hydrant check done: 12 of 12 OK", "Smoke reported near the old souk"];

function Device({ kind, name, position, rotationY, message, beaconRef }: { kind: DeviceKind; name: string; position: V3; rotationY: number; message: string; beaconRef: (m: THREE.MeshStandardMaterial | null) => void }) {
  const { palette } = useHouse();
  const [sw, sh] = DEVICE_SIZE[kind];
  const { texture } = useCanvas(
    Math.round(sw * 400),
    Math.round(sh * 400),
    (ctx, cw, ch) => {
      ctx.fillStyle = "#fff8e6";
      ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = "#ff8f00";
      ctx.fillRect(0, 0, cw, ch * 0.16);
      ctx.fillStyle = "#ffffff";
      ctx.font = font(ch * 0.07, "bold");
      ctx.fillText(name, 16, ch * 0.105);
      ctx.fillStyle = "#2b1d05";
      ctx.font = font(ch * 0.055, "bold");
      ctx.fillText("/alerts", 16, ch * 0.27);
      box(ctx, 14, ch * 0.32, cw - 28, ch * 0.42, 14, message ? "#fff1c2" : "#f3ede0", message ? "#ffca28" : "#d6cfc0", 4);
      ctx.fillStyle = "#2b1d05";
      ctx.font = font(Math.min(cw * 0.085, ch * 0.075), "bold");
      wrap(ctx, message || "No alerts yet", 30, ch * 0.42, cw - 60, ch * 0.09);
      ctx.fillStyle = "#8a7a5a";
      ctx.font = font(Math.min(cw * 0.05, ch * 0.045));
      ctx.fillText("onValue(ref(db, 'alerts'), …)", 16, ch * 0.9);
    },
    message,
  );
  const dark = flat("#1c1c1e", 0.35, 0.4);
  const steel = flat("#8a8f96", 0.3, 0.8);
  const laptop = kind === "laptop";
  const cy = laptop ? 1.0 + sh / 2 : 1.35;
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh position={[0, 0.02, 0]} material={flat(palette.ink, 0.4, 0.3)}>
        <cylinderGeometry args={[0.32, 0.34, 0.04, 24]} />
      </mesh>
      {laptop ? (
        <>
          <mesh position={[0, 0.45, 0]} material={flat("#b91c1c", 0.45, 0.2)} castShadow>
            <boxGeometry args={[0.7, 0.86, 0.5]} />
          </mesh>
          <mesh position={[0, 0.9, 0.1]} material={steel}>
            <boxGeometry args={[sw, 0.03, 0.62]} />
          </mesh>
          <group position={[0, 0.92, -0.2]} rotation-x={-0.2}>
            <Panel position={[0, sh / 2 + 0.03, 0.015]} width={sw - 0.06} height={sh - 0.06} map={texture} frame="#1c1c1e" />
          </group>
        </>
      ) : (
        <>
          <mesh position={[0, cy / 2, 0]} material={steel} castShadow>
            <cylinderGeometry args={[0.03, 0.04, cy, 10]} />
          </mesh>
          <mesh position={[0, cy, -0.04]} material={dark} castShadow>
            <boxGeometry args={[sw + 0.06, sh + 0.06, 0.05]} />
          </mesh>
          <Panel position={[0, cy, 0]} width={sw - 0.04} height={sh - 0.04} map={texture} frame="#1c1c1e" />
        </>
      )}
      <mesh position={[0, (laptop ? 0.92 + sh : cy + sh / 2) + 0.09, -0.04]}>
        <sphereGeometry args={[0.07, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial ref={beaconRef} color="#7f1d1d" emissive="#ff2a1a" emissiveIntensity={0.15} toneMapped={false} />
      </mesh>
    </group>
  );
}

function FirebaseRealtime({ w, d, toHouse }: SigProps) {
  const { palette, accent } = useHouse();
  const [alert, setAlert] = useState(-1);
  const ringAt = useRef(-10);
  const bell = useRef<THREE.Group>(null);
  const beacons = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const R = Math.max(1.8, Math.min(2.8, Math.min(w, d) / 2 - 0.6));
  const bellGeo = useMemo(() => new THREE.LatheGeometry([[0.02, 0], [0.12, -0.02], [0.18, -0.1], [0.2, -0.22], [0.24, -0.34], [0.31, -0.42], [0.32, -0.45]].map(([x, y]) => new THREE.Vector2(x, y)), 32), []);
  const bellMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#d4a73a", roughness: 0.25, metalness: 0.9, side: THREE.DoubleSide }), []);

  const send = () => {
    const next = alert + 1;
    setAlert(next);
    ringAt.current = now();
    sfx.gong();
    burstAt(toHouse, 0, 2.6, 0, [accent, palette.second, "#ef4444"], 18);
    toast(`set(ref(db, 'alerts'), { text: "${ALERTS[next % ALERTS.length]}" }) wrote once, and every device listening with onValue() got the same snapshot within milliseconds over its open connection.`, "🔔 Realtime Database");
  };
  const where = useWorldPoint(toHouse, 0, Math.min(d / 2 - 0.4, 1.4));
  useProximity({ id: "firebase-realtime", label: "set(ref(db, 'alerts'), …)", radius: 2, where, run: send });

  useFrame(() => {
    const age = now() - ringAt.current;
    if (bell.current) bell.current.rotation.z = age < 3 ? Math.sin(age * 16) * 0.4 * (1 - age / 3) : 0;
    beacons.current.forEach((m, i) => {
      if (m) m.emissiveIntensity = age < 3 ? (Math.sin(age * 14 + i * 1.3) > 0 ? 3 : 0.2) : 0.15;
    });
  });

  const red = flat("#c62828", 0.4, 0.2);
  const yellow = flat(palette.main, 0.4, 0.2);
  const message = alert < 0 ? "" : ALERTS[alert % ALERTS.length];
  return (
    <group onClick={(e) => clicked(e) && send()} {...pointer}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.45, 1.2, 0.45]} position={[0, 1.2, 0]} />
      </RigidBody>
      {/* Floor ring */}
      <mesh position={[0, 0.01, 0]} rotation-x={-Math.PI / 2} material={flat(palette.main, 0.5, 0, palette.second, 0.4)}>
        <ringGeometry args={[R + 0.45, R + 0.6, 64]} />
      </mesh>
      {/* The red post and the bell */}
      <mesh position={[0, 0.15, 0]} material={yellow} castShadow>
        <cylinderGeometry args={[0.5, 0.55, 0.3, 8]} />
      </mesh>
      <mesh position={[0, 1.25, 0]} material={red} castShadow>
        <cylinderGeometry args={[0.1, 0.13, 2.2, 16]} />
      </mesh>
      {[0.6, 1.2, 1.8].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation-x={Math.PI / 2} material={yellow}>
          <torusGeometry args={[0.125, 0.025, 8, 24]} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.36, 2.55, 0]} material={red}>
          <boxGeometry args={[0.06, 0.62, 0.08]} />
        </mesh>
      ))}
      <mesh position={[0, 2.35, 0]} material={red}>
        <boxGeometry args={[0.78, 0.08, 0.1]} />
      </mesh>
      <mesh position={[0, 2.85, 0]} material={red}>
        <boxGeometry args={[0.8, 0.06, 0.1]} />
      </mesh>
      <group ref={bell} position={[0, 2.82, 0]}>
        <mesh geometry={bellGeo} material={bellMat} castShadow />
        <mesh position={[0, -0.4, 0]} material={flat("#5b4a2a", 0.4, 0.7)}>
          <sphereGeometry args={[0.05, 12, 8]} />
        </mesh>
      </group>
      <Text position={[0, 0.15, 0.56]} fontSize={0.09} color={palette.ink} anchorX="center" anchorY="middle">
        /alerts
      </Text>
      {/* The devices, in a horseshoe open toward the entrance */}
      {DEVICES.map((dev, i) => {
        const a = THREE.MathUtils.degToRad(195 + i * 37.5);
        const x = Math.cos(a) * R;
        const z = Math.sin(a) * R;
        return <Device key={i} kind={dev.kind} name={dev.name} position={[x, 0, z]} rotationY={Math.atan2(-x, R * 1.6 - z)} message={message} beaconRef={(m) => void (beacons.current[i] = m)} />;
      })}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Firebase · Auth checkpoint (room)
// ---------------------------------------------------------------------------

/**
 * A flap-barrier checkpoint across the room with three sign-in pads in front (Google, Email,
 * Anonymous). Tap a pad: the flaps open and an ID badge prints with your uid. E signs you in
 * anonymously, or out again.
 */
const PROVIDERS = [
  { name: "Google", color: "#4285f4", call: "signInWithPopup(auth, new GoogleAuthProvider())", note: "Google vouched for you. That uid is what Security Rules see as request.auth.uid." },
  { name: "Email", color: "#ff8f00", call: "signInWithEmailAndPassword(auth, email, password)", note: "The same account always gets the same uid, on every device." },
  { name: "Anonymous", color: "#6b7280", call: "signInAnonymously(auth)", note: "A real uid with isAnonymous: true. Link Google or email later and the user keeps their data." },
];
const UID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function SignPad({ p, position, onTap }: { p: number; position: V3; onTap: () => void }) {
  const prov = PROVIDERS[p];
  const { texture } = useCanvas(
    256,
    200,
    (ctx, cw, ch) => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = prov.color;
      ctx.beginPath();
      ctx.arc(cw / 2, 70, 44, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = font(48, "bold");
      ctx.textAlign = "center";
      ctx.fillText(p === 0 ? "G" : p === 1 ? "@" : "?", cw / 2, 87);
      ctx.fillStyle = "#1f2937";
      ctx.font = font(26, "bold");
      ctx.fillText(prov.name, cw / 2, 150);
      ctx.fillStyle = "#6b7280";
      ctx.font = font(17);
      ctx.fillText("tap to sign in", cw / 2, 180);
    },
    p,
  );
  return (
    <group position={position} onClick={(e) => clicked(e) && onTap()} {...pointer}>
      <mesh position={[0, 0.5, 0]} material={flat("#3a3a3e", 0.4, 0.6)} castShadow>
        <boxGeometry args={[0.12, 1, 0.12]} />
      </mesh>
      <group position={[0, 1.08, 0]} rotation-x={-0.5}>
        <mesh position={[0, 0, -0.02]} material={flat("#1c1c1e", 0.4, 0.4)}>
          <boxGeometry args={[0.4, 0.33, 0.04]} />
        </mesh>
        <Panel position={[0, 0, 0.002]} width={0.34} height={0.27} map={texture} frame={prov.color} />
      </group>
    </group>
  );
}

function Badge({ uid, p }: { uid: string; p: number }) {
  const prov = PROVIDERS[p];
  const { texture } = useCanvas(
    320,
    220,
    (ctx, cw, ch) => {
      ctx.fillStyle = "#fff8e6";
      ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = prov.color;
      ctx.fillRect(0, 0, cw, 48);
      ctx.fillStyle = "#ffffff";
      ctx.font = font(24, "bold");
      ctx.fillText("ID BADGE", 16, 33);
      ctx.fillStyle = "#2b1d05";
      ctx.font = font(18);
      ctx.fillText(`providerId: ${p === 0 ? "google.com" : p === 1 ? "password" : "anonymous"}`, 16, 90);
      ctx.font = font(15, "bold");
      ctx.fillText(`uid: ${uid}`, 16, 130);
      ctx.font = font(18);
      ctx.fillText(`isAnonymous: ${p === 2}`, 16, 170);
    },
    uid,
  );
  return <Panel position={[0, 0, 0]} width={0.34} height={0.24} map={texture} frame="#2b1d05" />;
}

function FirebaseAuth({ w, d, toHouse, label }: SigProps) {
  const { palette, accent } = useHouse();
  const [user, setUser] = useState<{ p: number; uid: string } | null>(null);
  const signedAt = useRef(-10);
  const flaps = useRef<(THREE.Group | null)[]>([]);
  const badge = useRef<THREE.Group>(null);
  const userRef = useRef(false);
  const gap = 0.7;
  const hx = gap / 2 + 0.12;
  const zG = -d / 2 + Math.min(2.4, d * 0.42);
  const railL = w / 2 - 0.1 - (hx + 0.12);
  const pads: V3[] = [
    [-(hx + 0.12) - railL * 0.3, 0, zG + 0.6],
    [-(hx + 0.12) - railL * 0.75, 0, zG + 0.6],
    [hx + 0.12 + railL * 0.5, 0, zG + 0.6],
  ];

  const signIn = (p: number) => {
    const uid = Array.from({ length: 28 }, () => UID_CHARS[Math.floor(Math.random() * UID_CHARS.length)]).join("");
    setUser({ p, uid });
    userRef.current = true;
    signedAt.current = now();
    sfx.chirp();
    burstAt(toHouse, -hx, 1.3, zG, [PROVIDERS[p].color, accent, "#ffffff"], 14);
    toast(`${PROVIDERS[p].call} → onAuthStateChanged fired with a user (uid ${uid.slice(0, 6)}…). ${PROVIDERS[p].note}`, "🪪 Firebase Auth");
  };
  const signOut = () => {
    setUser(null);
    userRef.current = false;
    sfx.clunk();
    toast("signOut(auth) → onAuthStateChanged fired again, this time with null. Rules now see request.auth == null.", "🪪 Firebase Auth");
  };
  const where = useWorldPoint(toHouse, 0, zG + 1);
  useProximity({ id: "firebase-auth", label: user ? "signOut(auth)" : "signInAnonymously(auth)", radius: 1.6, where, run: () => (user ? signOut() : signIn(2)) });

  useFrame((_, delta) => {
    const age = now() - signedAt.current;
    const open = userRef.current && age < 5;
    const k = 1 - Math.exp(-delta * 6);
    flaps.current.forEach((g, i) => {
      if (g) g.rotation.y += ((open ? (i ? 1 : -1) * (Math.PI / 2) : 0) - g.rotation.y) * k;
    });
    if (badge.current) badge.current.position.y = 1.02 + (userRef.current ? THREE.MathUtils.smoothstep(age, 0.2, 1.2) * 0.16 : 0);
  });

  const steel = flat("#9aa0a6", 0.3, 0.8);
  const housing = flat("#2b1d05", 0.4, 0.3);
  const glass = flat("#cfe8f5", 0.05, 0.1);
  return (
    <group>
      {/* Back-wall sign */}
      <group position={[0, 2.1, -d / 2 + 0.13]}>
        <mesh material={flat(palette.ink, 0.5)}>
          <boxGeometry args={[Math.min(w - 0.8, 3), 0.6, 0.04]} />
        </mesh>
        <Text position={[0, 0.12, 0.03]} fontSize={0.14} color={palette.main} anchorX="center" anchorY="middle">
          {label.toUpperCase()}
        </Text>
        <Text position={[0, -0.12, 0.03]} fontSize={0.075} color={palette.paper} anchorX="center" anchorY="middle">
          {user ? `currentUser.uid = "${user.uid.slice(0, 12)}…"` : "currentUser = null"}
        </Text>
      </group>
      {/* Housings, flaps and side rails */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * hx, 0.5, zG]} material={housing} castShadow>
            <boxGeometry args={[0.24, 1, 1]} />
          </mesh>
          <mesh position={[s * hx, 1.005, zG]} material={steel}>
            <boxGeometry args={[0.26, 0.01, 1.02]} />
          </mesh>
          <mesh position={[s * (hx - 0.121), 0.85, zG + 0.35]} material={user ? flat("#22c55e", 0.3, 0, "#22c55e", 2) : flat("#ef4444", 0.3, 0, "#ef4444", 2)}>
            <boxGeometry args={[0.005, 0.05, 0.12]} />
          </mesh>
          <group ref={(g) => void (flaps.current[s < 0 ? 0 : 1] = g)} position={[s * (hx - 0.12), 0.75, zG]}>
            <mesh position={[-s * 0.17, 0, 0]} material={glass}>
              <boxGeometry args={[0.34, 0.55, 0.02]} />
            </mesh>
          </group>
          <mesh position={[s * (hx + 0.12 + railL / 2), 0.9, zG]} material={steel}>
            <boxGeometry args={[railL, 0.05, 0.06]} />
          </mesh>
          <mesh position={[s * (hx + 0.12 + railL / 2), 0.5, zG]} material={glass}>
            <boxGeometry args={[railL, 0.75, 0.02]} />
          </mesh>
          <mesh position={[s * (w / 2 - 0.12), 0.45, zG]} material={steel}>
            <boxGeometry args={[0.05, 0.9, 0.05]} />
          </mesh>
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider args={[(railL + 0.24) / 2, 0.5, 0.5]} position={[s * (hx - 0.12 + (railL + 0.24) / 2), 0.5, zG]} />
          </RigidBody>
        </group>
      ))}
      {/* The badge slot on the left housing */}
      <mesh position={[-hx, 1.012, zG + 0.25]} material={flat("#111111", 0.5)}>
        <boxGeometry args={[0.2, 0.006, 0.04]} />
      </mesh>
      <group ref={badge} position={[-hx, 1.02, zG + 0.25]}>{user && <Badge uid={user.uid} p={user.p} />}</group>
      {/* Hazard stripe on the floor */}
      <mesh position={[0, 0.006, zG + 0.55]} rotation-x={-Math.PI / 2} material={flat(palette.main, 0.6)}>
        <planeGeometry args={[gap, 0.08]} />
      </mesh>
      {pads.map((pos, p) => (
        <SignPad key={p} p={p} position={pos} onTap={() => signIn(p)} />
      ))}
      {/* The security desk behind the checkpoint */}
      <group position={[w / 2 - 0.85, 0, -d / 2 + 0.55]}>
        <mesh position={[0, 0.73, 0]} material={flat("#5a4632", 0.5)} castShadow>
          <boxGeometry args={[1.1, 0.04, 0.6]} />
        </mesh>
        <mesh position={[0, 0.36, -0.2]} material={housing}>
          <boxGeometry args={[1.06, 0.72, 0.04]} />
        </mesh>
        <mesh position={[0, 1.0, -0.15]} material={flat("#1c1c1e", 0.3, 0.4, "#ffca28", 0.25)}>
          <boxGeometry args={[0.55, 0.34, 0.03]} />
        </mesh>
        <ExecChair position={[0, 0, 0.55]} facing={Math.PI} />
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.55, 0.38, 0.3]} position={[0, 0.38, 0]} />
        </RigidBody>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Supabase · The Postgres core (hero)
// ---------------------------------------------------------------------------

/**
 * A glass cylinder with a glowing Postgres elephant inside, and four satellite pods around it (Auth,
 * Storage, Realtime, Edge Functions) joined to it by glass tubes. E subscribes to changes: pulses
 * of light race from the core out to every satellite.
 */
const PODS = ["Auth", "Storage", "Realtime", "Edge Functions"];
const PULSES = 3;

function SupabaseCore({ w, d, toHouse }: SigProps) {
  const { palette, accent } = useHouse();
  const subAt = useRef(-10);
  const pulses = useRef<(THREE.Mesh | null)[]>([]);
  const podGlow = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const coreMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#3ecf8e", emissive: "#3ecf8e", emissiveIntensity: 1.3, roughness: 0.3, toneMapped: false }), []);
  const Rp = Math.max(1.8, Math.min(2.6, Math.min(w, d) / 2 - 0.8));
  const glass = useMemo(() => new THREE.MeshStandardMaterial({ color: "#d9fff0", transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false }), []);
  const glow = flat("#3ecf8e", 0.3, 0, "#3ecf8e", 1.6);
  const pods = PODS.map((name, i) => {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    return { name, x: Math.cos(a) * Rp, z: Math.sin(a) * Rp };
  });

  const subscribe = () => {
    subAt.current = now();
    sfx.sparkle();
    burstAt(toHouse, 0, 2.2, 0, [accent, "#ffffff"], 18);
    toast("supabase.channel('db').on('postgres_changes', { event: '*', schema: 'public' }, handler).subscribe(): every INSERT, UPDATE and DELETE now streams from Postgres to subscribed clients over a WebSocket.", "⚡ Supabase Realtime");
  };
  const where = useWorldPoint(toHouse, 0, Math.min(d / 2 - 0.4, Rp + 0.4));
  useProximity({ id: "supabase-core", label: "Subscribe to changes", radius: 2.2, where, run: subscribe });

  useFrame(() => {
    const t = now();
    const age = t - subAt.current;
    const live = age < 4;
    coreMat.emissiveIntensity = live ? 2.2 + Math.sin(t * 10) * 0.6 : 1.3 + Math.sin(t * 1.5) * 0.25;
    pulses.current.forEach((m, i) => {
      if (!m) return;
      const tube = Math.floor(i / PULSES);
      const k = live ? (age * 1.2 + (i % PULSES) / PULSES) % 1 : (t * 0.25 + tube * 0.25) % 1;
      m.visible = live || i % PULSES === 0;
      const p = pods[tube];
      const f = 0.12 + k * 0.78;
      m.position.set(p.x * f, 0.62, p.z * f);
    });
    podGlow.current.forEach((m, i) => {
      if (m) m.emissiveIntensity = live ? 1.2 + Math.max(0, Math.sin(age * 7.5 - i)) * 2 : 0.5;
    });
  });

  const steel = flat("#2c3832", 0.35, 0.7);
  return (
    <group onClick={(e) => clicked(e) && subscribe()} {...pointer}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.95, 1.4, 0.95]} position={[0, 1.4, 0]} />
        {pods.map((p) => (
          <CuboidCollider key={p.name} args={[0.42, 0.6, 0.42]} position={[p.x, 0.6, p.z]} />
        ))}
      </RigidBody>
      {/* The core: base, glass cylinder and the elephant inside */}
      <mesh position={[0, 0.2, 0]} material={steel} castShadow receiveShadow>
        <cylinderGeometry args={[1.0, 1.1, 0.4, 40]} />
      </mesh>
      <mesh position={[0, 0.41, 0]} rotation-x={Math.PI / 2} material={glow}>
        <torusGeometry args={[0.9, 0.025, 8, 48]} />
      </mesh>
      <mesh position={[0, 0.4 + 1.1, 0]} material={glass}>
        <cylinderGeometry args={[0.85, 0.85, 2.2, 40, 1, true]} />
      </mesh>
      <mesh position={[0, 2.68, 0]} material={steel} castShadow>
        <cylinderGeometry args={[0.95, 0.9, 0.16, 40]} />
      </mesh>
      <mesh position={[0, 2.6, 0]} rotation-x={Math.PI / 2} material={glow}>
        <torusGeometry args={[0.88, 0.02, 8, 48]} />
      </mesh>
      <mesh position={[0, 0.7, 0]} material={steel}>
        <cylinderGeometry args={[0.18, 0.28, 0.6, 16]} />
      </mesh>
      <Elephant position={[0, 1.65, 0.05]} scale={1.15} material={coreMat} detail={flat("#0f1f18", 0.4)} />
      <Text position={[0, 0.2, 1.11]} fontSize={0.12} color={accent} anchorX="center" anchorY="middle">
        Postgres
      </Text>
      {/* Satellites and their tubes */}
      {pods.map((p, i) => (
        <group key={p.name}>
          <Stick from={[p.x * 0.11, 0.62, p.z * 0.11]} to={[p.x * 0.88, 0.62, p.z * 0.88]} radius={0.07} material={glass} segments={12} />
          <group position={[p.x, 0, p.z]}>
            <mesh position={[0, 0.3, 0]} material={steel} castShadow>
              <cylinderGeometry args={[0.36, 0.42, 0.6, 24]} />
            </mesh>
            <mesh position={[0, 0.62, 0]}>
              <cylinderGeometry args={[0.37, 0.37, 0.05, 24]} />
              <meshStandardMaterial ref={(m) => void (podGlow.current[i] = m)} color="#0f1f18" emissive={accent} emissiveIntensity={0.5} toneMapped={false} />
            </mesh>
            <mesh position={[0, 0.66, 0]} material={glass}>
              <sphereGeometry args={[0.36, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
            </mesh>
            <mesh position={[0, 0.82, 0]} rotation={[0.5, i, 0.3]} material={flat(i % 2 ? palette.second : palette.main, 0.3, 0.2, accent, 0.6)}>
              <octahedronGeometry args={[0.13, 0]} />
            </mesh>
            <Text position={[0, 1.22, 0]} fontSize={0.14} color={palette.paper} outlineWidth={0.008} outlineColor={palette.ink} anchorX="center" anchorY="middle">
              {p.name}
            </Text>
          </group>
          {Array.from({ length: PULSES }, (_, k) => (
            <mesh key={k} ref={(m) => void (pulses.current[i * PULSES + k] = m)} material={glow}>
              <sphereGeometry args={[0.05, 10, 8]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Supabase · Storage lockers (room)
// ---------------------------------------------------------------------------

/**
 * A bank of steel lockers on the back wall, one per storage bucket (avatars, invoices, photos,
 * backups), padlocked when private. Click a locker to open it and see its files; E uploads a new
 * file into the open one.
 */
const BUCKETS = [
  { name: "avatars", isPublic: true, files: ["wouroud.png", "u7.webp"], stem: "user", ext: "png" },
  { name: "invoices", isPublic: false, files: ["2026-09.pdf"], stem: "2026-1", ext: "pdf" },
  { name: "photos", isPublic: true, files: ["harbor.jpg", "old-city.jpg", "sunset.jpg"], stem: "tripoli", ext: "jpg" },
  { name: "backups", isPublic: false, files: ["db-2026-10-01.sql.gz"], stem: "db-weekly", ext: "sql.gz" },
];
const LOCKER_H = 1.95;
const LOCKER_D = 0.5;

function LockerList({ bucket, files, width }: { bucket: number; files: string[]; width: number }) {
  const b = BUCKETS[bucket];
  const { texture } = useCanvas(
    256,
    192,
    (ctx, cw, ch) => {
      ctx.fillStyle = "#0f1f18";
      ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = "#3ecf8e";
      ctx.font = font(20, "bold");
      ctx.fillText(`${b.name}/`, 12, 26);
      ctx.fillStyle = "#effcf5";
      ctx.font = font(16);
      files.slice(-7).forEach((f, i) => ctx.fillText(`· ${f}`, 16, 52 + i * 20, cw - 24));
    },
    files.join("|"),
  );
  return <Panel position={[0, 1.58, -LOCKER_D / 2 + 0.03]} width={width} height={width * 0.75} map={texture} frame="#24423a" />;
}

function SupabaseBuckets({ w, d, toHouse, label }: SigProps) {
  const { palette, accent } = useHouse();
  const [files, setFiles] = useState(() => BUCKETS.map((b) => b.files));
  const [open, setOpen] = useState(-1);
  const doors = useRef<(THREE.Group | null)[]>([]);
  const lw = Math.min(0.95, (w - 1.4) / 4);
  const z0 = -d / 2 + 0.12 + LOCKER_D / 2;
  const xs = BUCKETS.map((_, i) => (i - 1.5) * (lw + 0.06));

  const toggle = (i: number) => {
    sfx.clunk();
    if (open === i) return setOpen(-1);
    setOpen(i);
    const b = BUCKETS[i];
    toast(`${b.name}: a ${b.isPublic ? "public" : "private"} bucket with ${files[i].length} files. ${b.isPublic ? "Anyone with the URL can read them." : "Reads need a signed URL or a policy on storage.objects."}`, `🗄️ ${label}`);
  };
  const upload = () => {
    const i = open >= 0 ? open : 0;
    const b = BUCKETS[i];
    const name = `${b.stem}-${files[i].length + 1}.${b.ext}`;
    setOpen(i);
    setFiles((f) => f.map((list, k) => (k === i ? [...list, name] : list)));
    sfx.pop();
    burstAt(toHouse, xs[i], 1.2, z0 + 0.5, [accent, "#ffffff"], 14);
    toast(`supabase.storage.from('${b.name}').upload('${name}', file) → { data: { path: '${name}' }, error: null }. ${b.isPublic ? "getPublicUrl() gives a link anyone can open." : "Share it with createSignedUrl(), which expires."}`, `🗄️ ${label}`);
  };
  const where = useWorldPoint(toHouse, 0, z0 + 1.5);
  useProximity({ id: "supabase-buckets", label: open >= 0 ? `upload() to ${BUCKETS[open].name}` : "upload()", radius: 1.9, where, run: upload });

  useFrame((_, delta) => {
    const k = 1 - Math.exp(-delta * 6);
    doors.current.forEach((g, i) => {
      if (g) g.rotation.y += ((i === open ? -1.9 : 0) - g.rotation.y) * k;
    });
  });

  const body = flat("#24423a", 0.45, 0.5);
  const door = flat("#2f5e4e", 0.4, 0.55);
  const slot = flat("#0f1f18", 0.6);
  const gold = flat("#d4a73a", 0.3, 0.85);
  const bankW = 4 * (lw + 0.06);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[bankW / 2, LOCKER_H / 2, LOCKER_D / 2]} position={[0, LOCKER_H / 2, z0]} />
      </RigidBody>
      <mesh position={[0, LOCKER_H + 0.05, z0]} material={flat(palette.ink, 0.5)}>
        <boxGeometry args={[bankW + 0.06, 0.1, LOCKER_D + 0.04]} />
      </mesh>
      <Text position={[0, LOCKER_H + 0.32, -d / 2 + 0.14]} fontSize={0.16} color={accent} anchorX="center" anchorY="middle">
        {label}
      </Text>
      {BUCKETS.map((b, i) => (
        <group key={b.name} position={[xs[i], 0, z0]} onClick={(e) => clicked(e) && toggle(i)} {...pointer}>
          {/* Carcass: back, sides, top, floor and a shelf */}
          <mesh position={[0, LOCKER_H / 2, -LOCKER_D / 2 + 0.01]} material={body}>
            <boxGeometry args={[lw, LOCKER_H, 0.02]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * (lw / 2 - 0.01), LOCKER_H / 2, 0]} material={body} castShadow>
              <boxGeometry args={[0.02, LOCKER_H, LOCKER_D]} />
            </mesh>
          ))}
          {[0.03, LOCKER_H - 0.01, 1.22].map((y) => (
            <mesh key={y} position={[0, y, 0]} material={body}>
              <boxGeometry args={[lw - 0.02, 0.02, LOCKER_D - 0.02]} />
            </mesh>
          ))}
          <LockerList bucket={i} files={files[i]} width={lw - 0.14} />
          {/* The files themselves, as folders standing on the locker floor */}
          {files[i].slice(-8).map((f, k) => (
            <mesh key={f} position={[-lw / 2 + 0.1 + k * ((lw - 0.2) / 7), 0.2, 0]} material={flat(k % 2 ? palette.main : "#effcf5", 0.6)}>
              <boxGeometry args={[0.035, 0.32, 0.36]} />
            </mesh>
          ))}
          {/* The door, hinged on its left edge */}
          <group ref={(g) => void (doors.current[i] = g)} position={[-lw / 2, 0, LOCKER_D / 2]}>
            <mesh position={[lw / 2, LOCKER_H / 2, 0.012]} material={door} castShadow>
              <boxGeometry args={[lw - 0.01, LOCKER_H - 0.02, 0.025]} />
            </mesh>
            {[0, 1, 2].map((k) => (
              <mesh key={k} position={[lw / 2, LOCKER_H - 0.28 - k * 0.06, 0.026]} material={slot}>
                <boxGeometry args={[lw * 0.55, 0.02, 0.004]} />
              </mesh>
            ))}
            <mesh position={[lw / 2, LOCKER_H - 0.12, 0.026]} material={flat("#effcf5", 0.5)}>
              <boxGeometry args={[lw * 0.7, 0.13, 0.004]} />
            </mesh>
            <Text position={[lw / 2, LOCKER_H - 0.12, 0.03]} fontSize={0.075} color={palette.ink} anchorX="center" anchorY="middle">
              {b.name}
            </Text>
            <mesh position={[lw - 0.1, 1.0, 0.04]} material={flat("#9aa0a6", 0.3, 0.8)}>
              <boxGeometry args={[0.03, 0.16, 0.03]} />
            </mesh>
            {b.isPublic ? (
              <mesh position={[lw - 0.1, 1.22, 0.03]} rotation-x={Math.PI / 2} material={flat(accent, 0.4, 0, accent, 0.8)}>
                <cylinderGeometry args={[0.05, 0.05, 0.01, 18]} />
              </mesh>
            ) : (
              <group position={[lw - 0.1, 0.8, 0.06]}>
                <mesh material={gold}>
                  <boxGeometry args={[0.08, 0.075, 0.03]} />
                </mesh>
                <mesh position={[0, 0.045, 0]} material={flat("#c0c4ca", 0.3, 0.9)}>
                  <torusGeometry args={[0.028, 0.007, 6, 14, Math.PI]} />
                </mesh>
              </group>
            )}
          </group>
        </group>
      ))}
      {/* A changing bench in front of the bank */}
      {d > 4.5 && (
        <group position={[0, 0, z0 + 1.1]}>
          <mesh position={[0, 0.44, 0]} material={flat("#c8a47a", 0.6)} castShadow>
            <boxGeometry args={[Math.min(1.6, w - 2.4), 0.05, 0.36]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * (Math.min(1.6, w - 2.4) / 2 - 0.1), 0.21, 0]} material={body}>
              <boxGeometry args={[0.05, 0.42, 0.3]} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Supabase · Row level vault (room)
// ---------------------------------------------------------------------------

/**
 * A vault of steel shelves holding row boxes, each labeled with its owner_id, under a sign with
 * the policy. E signs in as user 7: only that user's rows light up. Sign out and none do.
 */
const OWNERS = [7, 3, 12, 21];

function SupabaseRls({ w, d, toHouse, label }: SigProps) {
  const { palette, accent } = useHouse();
  const [signed, setSigned] = useState(false);
  const units = w >= 5.6 ? 2 : 1;
  const uw = Math.min(1.9, (w - 1.2) / units - 0.15);
  const per = Math.max(2, Math.floor((uw - 0.1) / 0.42));
  const z0 = -d / 2 + 0.36;
  const { texture } = useCanvas(
    512,
    128,
    (ctx) => {
      OWNERS.forEach((o, i) => {
        box(ctx, i * 128 + 6, 6, 116, 116, 10, "#f4ecd8", "#7a6a4a", 3);
        ctx.fillStyle = "#5a4a2a";
        ctx.font = font(18, "bold");
        ctx.textAlign = "center";
        ctx.fillText("owner_id", i * 128 + 64, 40);
        ctx.fillStyle = "#0f1f18";
        ctx.font = font(56, "bold");
        ctx.fillText(String(o), i * 128 + 64, 100);
      });
    },
    0,
  );
  const labelMat = useMemo(() => new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }), [texture]);
  const cells = useAtlasCells(4, 1, 0.2, 0.2);
  const rows = useMemo(
    () =>
      Array.from({ length: units }, (_, u) =>
        [0.1, 0.7, 1.3].flatMap((y, s) => Array.from({ length: per }, (_, k) => ({ u, y, x: -uw / 2 + 0.05 + (k + 0.5) * ((uw - 0.1) / per), owner: (u * 5 + s * 3 + k * 7 + k * s) % OWNERS.length }))),
      ).flat(),
    [units, per, uw],
  );
  const mine = rows.filter((r) => OWNERS[r.owner] === 7).length;

  const toggle = () => {
    const next = !signed;
    setSigned(next);
    if (next) {
      sfx.vault();
      burstAt(toHouse, 0, 1.2, z0 + 0.4, [accent, "#ffffff"], 18);
      toast(`Signed in as user 7. The policy runs on every query, so select * from rows returns only your ${mine} rows; the others are filtered out by Postgres itself.`, `🔐 ${label}`);
    } else {
      sfx.clunk();
      toast("Signed out: auth.uid() is null, so the policy matches no row. With RLS enabled and no matching policy, the answer is always zero rows.", `🔐 ${label}`);
    }
  };
  const where = useWorldPoint(toHouse, 0, z0 + 1.4);
  useProximity({ id: "supabase-rls", label: signed ? "Sign out" : "Sign in as user 7", radius: 1.9, where, run: toggle });

  const steel = flat("#6b7a74", 0.35, 0.8);
  const dark = flat("#2c3832", 0.4, 0.7);
  const cardboard = flat("#c8a47a", 0.85);
  const glow = flat("#8ff0c0", 0.4, 0, accent, 1.3);
  const unitX = (u: number) => (units === 1 ? 0 : (u - 0.5) * (uw + 0.3));
  const portal = units * (uw + 0.3) + 0.1;
  return (
    <group onClick={(e) => clicked(e) && toggle()} {...pointer}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[portal / 2, 1, 0.3]} position={[0, 1, z0]} />
      </RigidBody>
      {/* The vault portal: two pillars and a riveted lintel */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (portal / 2 + 0.1), 1.05, z0]} material={dark} castShadow>
          <boxGeometry args={[0.2, 2.1, 0.5]} />
        </mesh>
      ))}
      <mesh position={[0, 2.18, z0]} material={dark} castShadow>
        <boxGeometry args={[portal + 0.4, 0.18, 0.5]} />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} position={[-portal / 2 + (i + 0.5) * (portal / 8), 2.18, z0 + 0.255]} material={steel}>
          <sphereGeometry args={[0.025, 8, 6]} />
        </mesh>
      ))}
      {/* The policy sign */}
      <group position={[0, 2.65, -d / 2 + 0.13]}>
        <mesh material={flat(palette.ink, 0.5)}>
          <boxGeometry args={[Math.min(w - 0.6, 3.6), 0.62, 0.03]} />
        </mesh>
        <Text position={[0, 0.17, 0.02]} fontSize={0.075} color={palette.paper} anchorX="center" anchorY="middle">
          create policy &quot;own rows&quot; on rows for select
        </Text>
        <Text position={[0, 0.03, 0.02]} fontSize={0.09} color={accent} anchorX="center" anchorY="middle">
          using (auth.uid() = owner_id);
        </Text>
        <Text position={[0, -0.17, 0.02]} fontSize={0.07} color={signed ? "#8ff0c0" : "#fca5a5"} anchorX="center" anchorY="middle">
          {signed ? `auth.uid() = 7 → ${mine} rows visible` : "auth.uid() = null → 0 rows visible"}
        </Text>
      </group>
      {/* Shelving units */}
      {Array.from({ length: units }, (_, u) => (
        <group key={u} position={[unitX(u), 0, z0]}>
          {[-1, 1].flatMap((sx) =>
            [-1, 1].map((sz) => (
              <mesh key={`${sx}${sz}`} position={[sx * (uw / 2), 0.95, sz * 0.2]} material={steel}>
                <boxGeometry args={[0.04, 1.9, 0.04]} />
              </mesh>
            )),
          )}
          {[0.08, 0.68, 1.28, 1.88].map((y) => (
            <mesh key={y} position={[0, y, 0]} material={steel} receiveShadow>
              <boxGeometry args={[uw, 0.03, 0.44]} />
            </mesh>
          ))}
        </group>
      ))}
      {rows.map((r, i) => (
        <group key={i} position={[unitX(r.u) + r.x, r.y + 0.155, z0]}>
          <mesh material={signed && OWNERS[r.owner] === 7 ? glow : cardboard} castShadow>
            <boxGeometry args={[0.36, 0.28, 0.34]} />
          </mesh>
          <mesh position={[0, 0, 0.171]} geometry={cells[r.owner]} material={labelMat} />
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Prisma · The prism (hero)
// ---------------------------------------------------------------------------

/**
 * A glass prism on a plinth. White light from schema.prisma goes in on the left and fans out on the
 * right into colored beams, one per model card (User, Post, Order). E runs prisma generate: the
 * beams flare and the cards flip over to show the typed client calls.
 */
const MODELS = [
  { name: "User", color: "#f87171", fields: "id     Int     @id\nemail  String  @unique\nposts  Post[]", call: "prisma.user.findMany()", returns: "→ Promise<User[]>" },
  { name: "Post", color: "#4ade80", fields: "id      Int     @id\ntitle   String\nauthor  User    @relation(…)", call: "prisma.post.create({ data })", returns: "→ Promise<Post>" },
  { name: "Order", color: "#60a5fa", fields: "id      Int      @id\ntotal   Decimal\nuserId  Int", call: "prisma.order.findUnique({ where: { id } })", returns: "→ Promise<Order | null>" },
];
const CARD_Y = [2.2, 1.5, 0.8];

function PrismaPrism({ w, d, toHouse }: SigProps) {
  const { palette, accent } = useHouse();
  const [generated, setGenerated] = useState(false);
  const genAt = useRef(-10);
  const cards = useRef<(THREE.Group | null)[]>([]);
  const beamMats = useMemo(() => MODELS.map((m) => new THREE.MeshStandardMaterial({ color: m.color, emissive: m.color, emissiveIntensity: 0.8, toneMapped: false, transparent: true, opacity: 0.85 })), []);
  const white = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#ffffff", emissiveIntensity: 1.2, toneMapped: false }), []);
  const prismMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#c7cbff", transparent: true, opacity: 0.4, roughness: 0.05, metalness: 0.2, emissive: "#5a67d8", emissiveIntensity: 0.25, side: THREE.DoubleSide, depthWrite: false }), []);
  const span = Math.max(2, Math.min(3.2, w / 2 - 0.6));
  const cardX = span - 0.5;
  const entry: V3 = [-0.36, 1.55, 0];
  const exit: V3 = [0.42, 1.45, 0];

  const generate = () => {
    const next = !generated;
    setGenerated(next);
    genAt.current = now();
    if (next) {
      sfx.sparkle();
      burstAt(toHouse, exit[0], exit[1], 0, MODELS.map((m) => m.color), 20);
      toast("prisma generate read schema.prisma and wrote a fully typed Prisma Client: prisma.user.findMany() now autocompletes every field, and a typo is a compile error.", "🔺 Prisma");
    } else {
      sfx.click();
      toast("Back to schema.prisma. Change a model, run prisma generate again, and the types follow.", "🔺 Prisma");
    }
  };
  const where = useWorldPoint(toHouse, 0, Math.min(d / 2 - 0.4, 1.9));
  useProximity({ id: "prisma-prism", label: generated ? "Show the models" : "prisma generate", radius: 2.2, where, run: generate });

  useFrame((_, delta) => {
    const flash = Math.max(0, 1 - (now() - genAt.current) / 1.2) * 3;
    const base = generated ? 2.4 : 0.8;
    beamMats.forEach((m) => (m.emissiveIntensity = base + flash));
    white.emissiveIntensity = 1.2 + flash;
    prismMat.emissiveIntensity = 0.25 + flash * 0.3 + (generated ? 0.2 : 0);
    const k = 1 - Math.exp(-delta * 5);
    cards.current.forEach((g, i) => {
      if (!g) return;
      const target = generated && now() - genAt.current > i * 0.15 ? Math.PI : 0;
      g.rotation.y += (target - g.rotation.y) * k;
    });
  });

  const plinth = flat(palette.second, 0.4, 0.3);
  const steel = flat("#3b4366", 0.35, 0.7);
  return (
    <group onClick={(e) => clicked(e) && generate()} {...pointer}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.9, 0.45, 0.65]} position={[0, 0.45, 0]} />
        <CuboidCollider args={[0.3, 0.8, 0.3]} position={[-span + 0.25, 0.8, 0]} />
        <CuboidCollider args={[0.7, 1.3, 0.15]} position={[cardX, 1.3, 0]} />
      </RigidBody>
      <mesh position={[0, 0.005, 0]} rotation-x={-Math.PI / 2} material={flat("#141a3a", 0.6, 0, accent, 0.08)} receiveShadow>
        <planeGeometry args={[2 * span + 0.6, 2.4]} />
      </mesh>
      {/* Plinth and prism */}
      <mesh position={[0, 0.45, 0]} material={plinth} castShadow receiveShadow>
        <boxGeometry args={[1.8, 0.9, 1.3]} />
      </mesh>
      <mesh position={[0, 0.9, 0]} material={flat(accent, 0.3, 0.4, accent, 0.6)}>
        <boxGeometry args={[1.84, 0.02, 1.34]} />
      </mesh>
      <Text position={[0, 0.45, 0.66]} fontSize={0.11} color={palette.paper} anchorX="center" anchorY="middle">
        npx prisma generate
      </Text>
      <mesh position={[0, 1.33, 0]} rotation-x={-Math.PI / 2} material={prismMat} castShadow>
        <cylinderGeometry args={[0.85, 0.85, 1, 3]} />
      </mesh>
      {/* The schema projector and its white beam */}
      <group position={[-span + 0.25, 0, 0]}>
        <mesh position={[0, 0.65, 0]} material={steel}>
          <cylinderGeometry args={[0.04, 0.06, 1.3, 10]} />
        </mesh>
        <mesh position={[0, 0.02, 0]} material={steel}>
          <cylinderGeometry args={[0.28, 0.3, 0.04, 20]} />
        </mesh>
        <mesh position={[0, 1.55, 0]} material={flat(palette.ink, 0.4, 0.5)} castShadow>
          <boxGeometry args={[0.5, 0.34, 0.4]} />
        </mesh>
        <mesh position={[0.26, 1.55, 0]} rotation-z={Math.PI / 2} material={white}>
          <cylinderGeometry args={[0.07, 0.07, 0.03, 16]} />
        </mesh>
        <Text position={[0, 1.95, 0]} fontSize={0.13} color={palette.paper} anchorX="center" anchorY="middle">
          schema.prisma
        </Text>
      </group>
      <Stick from={[-span + 0.5, 1.55, 0]} to={entry} radius={0.035} material={white} />
      <Stick from={entry} to={exit} radius={0.03} material={white} />
      {MODELS.map((m, i) => (
        <Stick key={m.name} from={exit} to={[cardX - 0.5, CARD_Y[i], 0]} radius={0.028} material={beamMats[i]} />
      ))}
      {/* The model cards on their frame */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[cardX + s * 0.6, 1.3, -0.05]} material={steel} castShadow>
          <boxGeometry args={[0.05, 2.6, 0.05]} />
        </mesh>
      ))}
      {MODELS.map((m, i) => (
        <group key={m.name} ref={(g) => void (cards.current[i] = g)} position={[cardX, CARD_Y[i], 0]}>
          <mesh material={flat("#0c1225", 0.4, 0.3)} castShadow>
            <boxGeometry args={[1, 0.6, 0.04]} />
          </mesh>
          <mesh position={[0, 0.27, 0]} material={beamMats[i]}>
            <boxGeometry args={[1.0, 0.04, 0.045]} />
          </mesh>
          <Text position={[-0.44, 0.17, 0.025]} fontSize={0.075} color={m.color} anchorX="left" anchorY="middle">
            {`model ${m.name}`}
          </Text>
          <Text position={[-0.44, -0.08, 0.025]} fontSize={0.042} lineHeight={1.3} color={palette.paper} anchorX="left" anchorY="middle">
            {m.fields}
          </Text>
          <group rotation-y={Math.PI} position={[0, 0, -0.025]}>
            <Text position={[0, 0.07, 0]} fontSize={0.05} maxWidth={0.9} color={palette.paper} anchorX="center" anchorY="middle" textAlign="center">
              {m.call}
            </Text>
            <Text position={[0, -0.13, 0]} fontSize={0.045} color={m.color} anchorX="center" anchorY="middle">
              {m.returns}
            </Text>
          </group>
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Prisma · Migration hall (room)
// ---------------------------------------------------------------------------

/**
 * Stepping stones across the floor, one per migration, leading to a wall board with the SQL of the
 * latest one. E runs migrate dev: the next stone lights up and a new one rises from the floor.
 */
const MIGRATIONS = [
  { name: "20250101_init", sql: ['CREATE TABLE "User" (', '  "id" SERIAL NOT NULL,', '  "email" TEXT NOT NULL,', '  CONSTRAINT "User_pkey" PRIMARY KEY ("id")', ");"] },
  { name: "20250114_add_orders", sql: ['CREATE TABLE "Order" (', '  "id" SERIAL NOT NULL,', '  "total" DECIMAL(65,30) NOT NULL,', '  "userId" INTEGER NOT NULL', ");", 'ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey"', '  FOREIGN KEY ("userId") REFERENCES "User"("id");'] },
  { name: "20250203_add_index", sql: ['CREATE UNIQUE INDEX "User_email_key"', '  ON "User"("email");'] },
  { name: "20250310_user_roles", sql: ["CREATE TYPE \"Role\" AS ENUM ('USER', 'ADMIN');", 'ALTER TABLE "User"', "  ADD COLUMN \"role\" \"Role\" NOT NULL DEFAULT 'USER';"] },
  { name: "20250422_soft_delete", sql: ['ALTER TABLE "Order"', '  ADD COLUMN "deletedAt" TIMESTAMP(3);'] },
  { name: "20250519_add_tags", sql: ['CREATE TABLE "Tag" (', '  "id" SERIAL NOT NULL,', '  "name" TEXT NOT NULL,', '  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")', ");"] },
];

function PrismaMigrate({ w, d, toHouse, label }: SigProps) {
  const { palette, accent } = useHouse();
  const [applied, setApplied] = useState(2);
  const riseAt = useRef(-10);
  const stones = useRef<(THREE.Group | null)[]>([]);
  const ring = useRef<THREE.Mesh>(null);
  const N = MIGRATIONS.length;
  const zFront = d / 2 - 2.1;
  const zBack = -d / 2 + 1.6;
  const spacing = (zFront - zBack) / (N - 1);
  const r = Math.min(0.42, Math.max(0.3, spacing * 0.9));
  const xOff = Math.min(0.6, (w - 2) / 4);
  const spots = MIGRATIONS.map((_, i) => [(i % 2 ? 1 : -1) * xOff, zFront - i * spacing] as [number, number]);
  const done = applied >= N;
  const pending = Math.min(N - 1, applied);

  const migrate = () => {
    if (done) {
      setApplied(1);
      riseAt.current = now();
      sfx.click();
      toast("Back to the first stone. In a real project you never edit a migration that's been applied: you add a new one.", `🪨 ${label}`);
      return;
    }
    const m = MIGRATIONS[applied];
    setApplied(applied + 1);
    riseAt.current = now();
    sfx.chirp();
    const [x, z] = spots[applied];
    burstAt(toHouse, x, 0.3, z, [accent, "#ffffff"], 14);
    toast(`prisma migrate dev compared schema.prisma with the database, wrote migrations/${m.name}/migration.sql, applied it and recorded it in _prisma_migrations. In production, prisma migrate deploy applies pending ones.`, `🪨 ${label}`);
  };
  const where = useWorldPoint(toHouse, 0, zBack + 0.2);
  useProximity({ id: "prisma-migrate", label: done ? "Start over" : "migrate dev", radius: 2, where, run: migrate });

  useFrame(() => {
    const t = now();
    const age = t - riseAt.current;
    stones.current.forEach((g, i) => {
      if (g) g.position.y = i === pending && !done ? -0.09 + 0.09 * smooth(Math.min(1, age / 0.9)) : 0;
    });
    if (ring.current) ring.current.scale.setScalar(1 + Math.sin(t * 3) * 0.05);
  });

  const lit = flat("#a3acff", 0.5, 0, accent, 0.9);
  const stone = flat("#4a5070", 0.85);
  const last = MIGRATIONS[Math.max(0, applied - 1)];
  return (
    <group>
      <CodeBoard position={[0, 1.75, -d / 2 + 0.13]} width={Math.min(w - 1, 3.6)} height={1.7} kicker={`${label} · migration.sql`} title={last.name} lines={last.sql} />
      {spots.map(([x, z], i) =>
        i > pending ? null : (
          <group key={i} ref={(g) => void (stones.current[i] = g)} position={[x, 0, z]}>
            <mesh position={[0, 0.04, 0]} rotation-y={i * 0.7} scale={[1.12, 1, 0.92]} material={i < applied ? lit : stone} castShadow receiveShadow>
              <cylinderGeometry args={[r, r + 0.03, 0.08, 10]} />
            </mesh>
            <Text position={[0, 0.085, 0]} rotation-x={-Math.PI / 2} fontSize={0.062} maxWidth={r * 1.9} color={i < applied ? palette.ink : palette.paper} anchorX="center" anchorY="middle" textAlign="center">
              {MIGRATIONS[i].name.replace("_", "\n")}
            </Text>
          </group>
        ),
      )}
      {!done && (
        <mesh ref={ring} position={[spots[pending][0], 0.01, spots[pending][1]]} rotation-x={-Math.PI / 2} material={flat(accent, 0.4, 0, accent, 1.4)}>
          <ringGeometry args={[r + 0.1, r + 0.14, 32]} />
        </mesh>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// TypeORM · The map table (hero)
// ---------------------------------------------------------------------------

/**
 * A big map table with a hand-drawn map and four entity pins (User, Post, Comment, Tag). E loads
 * the relations: the roads between the pins light up one by one, each labeled with its decorator.
 */
const ENTITIES = [
  { name: "User", fx: -0.32, fz: -0.18, h: 0.75 },
  { name: "Post", fx: 0.02, fz: 0.2, h: 0.6 },
  { name: "Comment", fx: 0.33, fz: -0.22, h: 0.9 },
  { name: "Tag", fx: 0.37, fz: 0.27, h: 0.55 },
];
const RELATIONS = [
  { a: 0, b: 1, kind: "@OneToMany", field: "user.posts" },
  { a: 1, b: 2, kind: "@OneToMany", field: "post.comments" },
  { a: 0, b: 2, kind: "@OneToMany", field: "user.comments" },
  { a: 1, b: 3, kind: "@ManyToMany", field: "post.tags" },
];

function TypeormMap({ w, d, toHouse }: SigProps) {
  const { palette, accent } = useHouse();
  const [lit, setLit] = useState(0);
  const step = useRef(-1);
  const nextAt = useRef(0);
  const tw = Math.max(2.4, Math.min(4, w - 2));
  const td = Math.max(1.6, Math.min(2.4, d - 2.6));
  const top = 0.9;
  const { texture } = useCanvas(
    1024,
    640,
    (ctx, cw, ch) => {
      const r = rng(77);
      ctx.fillStyle = "#9cc9d9";
      ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = "#efe3c8";
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const a = (i / 40) * Math.PI * 2;
        const rad = 0.86 + r() * 0.1;
        const x = cw / 2 + Math.cos(a) * (cw / 2) * rad;
        const y = ch / 2 + Math.sin(a) * (ch / 2) * rad;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.fill();
      ctx.fillStyle = "#b9d6a0";
      for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        ctx.ellipse(160 + r() * (cw - 320), 120 + r() * (ch - 240), 40 + r() * 60, 25 + r() * 35, r() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "rgba(120,100,80,0.35)";
      ctx.lineWidth = 3;
      for (let x = 120; x < cw - 80; x += 96) {
        ctx.beginPath();
        ctx.moveTo(x, 90);
        ctx.lineTo(x + 30, ch - 90);
        ctx.stroke();
      }
      for (let y = 110; y < ch - 80; y += 84) {
        ctx.beginPath();
        ctx.moveTo(90, y);
        ctx.lineTo(cw - 90, y + 20);
        ctx.stroke();
      }
      box(ctx, 40, 34, 290, 64, 10, "rgba(37,8,10,0.85)");
      ctx.fillStyle = "#fff3ef";
      ctx.font = font(30, "bold");
      ctx.fillText("src/entities", 60, 76);
      ctx.strokeStyle = "#25080a";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cw - 80, ch - 140);
      ctx.lineTo(cw - 80, ch - 60);
      ctx.moveTo(cw - 120, ch - 100);
      ctx.lineTo(cw - 40, ch - 100);
      ctx.stroke();
      ctx.fillStyle = "#25080a";
      ctx.font = font(24, "bold");
      ctx.fillText("N", cw - 89, ch - 148);
    },
    0,
  );
  const pins = ENTITIES.map((e) => ({ ...e, x: e.fx * tw, z: e.fz * td }));

  const load = () => {
    if (step.current >= 0) return;
    setLit(0);
    step.current = 0;
    nextAt.current = now() + 0.4;
    sfx.click();
  };
  const where = useWorldPoint(toHouse, 0, Math.min(d / 2 - 0.4, td / 2 + 0.9));
  useProximity({ id: "typeorm-map", label: "Load relations", radius: 2.2, where, run: load });

  useFrame(() => {
    if (step.current < 0 || now() < nextAt.current) return;
    const n = step.current + 1;
    setLit(n);
    sfx.pop();
    step.current = n;
    nextAt.current = now() + 0.8;
    if (n >= RELATIONS.length) {
      step.current = -1;
      sfx.coin();
      toast("userRepo.find({ relations: { posts: { comments: true, tags: true } } }) joined it all in one query. @OneToMany pairs with a @ManyToOne on the other side; @ManyToMany needs @JoinTable() on one side.", "🗺️ TypeORM relations");
    }
  });

  const wood = flat("#5e2a1a", 0.55);
  const brass = flat("#c9a45a", 0.3, 0.85);
  return (
    <group onClick={(e) => clicked(e) && load()} {...pointer}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[tw / 2 + 0.06, top / 2, td / 2 + 0.06]} position={[0, top / 2, 0]} />
      </RigidBody>
      {/* The table */}
      <mesh position={[0, top - 0.04, 0]} material={wood} castShadow receiveShadow>
        <boxGeometry args={[tw + 0.12, 0.08, td + 0.12]} />
      </mesh>
      <mesh position={[0, top - 0.14, 0]} material={wood}>
        <boxGeometry args={[tw - 0.1, 0.14, td - 0.1]} />
      </mesh>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * (tw / 2 - 0.12), (top - 0.08) / 2, sz * (td / 2 - 0.12)]} material={wood} castShadow>
            <cylinderGeometry args={[0.06, 0.08, top - 0.08, 12]} />
          </mesh>
        )),
      )}
      <mesh position={[0, 0.15, 0]} material={wood}>
        <boxGeometry args={[tw - 0.3, 0.05, 0.08]} />
      </mesh>
      <mesh position={[0, top + 0.002, 0]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[tw, td]} />
        <meshStandardMaterial map={texture} roughness={0.85} />
      </mesh>
      <mesh position={[0, top - 0.005, td / 2 + 0.061]} material={flat(palette.main, 0.4, 0.2)}>
        <boxGeometry args={[tw + 0.12, 0.02, 0.005]} />
      </mesh>
      {/* Relation roads */}
      {RELATIONS.map((rel, i) => {
        const a = pins[rel.a];
        const b = pins[rel.b];
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        const on = i < lit;
        return (
          <group key={i}>
            <mesh position={[(a.x + b.x) / 2, top + 0.01, (a.z + b.z) / 2]} rotation-y={-Math.atan2(b.z - a.z, b.x - a.x)} material={on ? flat(accent, 0.4, 0, accent, 1.6) : flat("#b8a88a", 0.8)}>
              <boxGeometry args={[len, 0.012, rel.kind === "@ManyToMany" ? 0.08 : 0.05]} />
            </mesh>
            {on && (
              <Text position={[(a.x + b.x) / 2, top + 0.16, (a.z + b.z) / 2]} fontSize={0.075} color={palette.ink} outlineWidth={0.006} outlineColor="#ffffff" anchorX="center" anchorY="middle">
                {`${rel.kind} ${rel.field}`}
              </Text>
            )}
          </group>
        );
      })}
      {/* Entity pins with flags */}
      {pins.map((p, i) => (
        <group key={p.name} position={[p.x, top, p.z]}>
          <mesh position={[0, p.h / 2, 0]} material={brass}>
            <cylinderGeometry args={[0.012, 0.012, p.h, 8]} />
          </mesh>
          <mesh position={[0, 0.02, 0]} material={flat(palette.main, 0.4, 0.2)}>
            <cylinderGeometry args={[0.06, 0.07, 0.04, 16]} />
          </mesh>
          <mesh position={[0, p.h, 0]} material={flat(i % 2 ? palette.second : palette.main, 0.35, 0.2)} castShadow>
            <sphereGeometry args={[0.06, 14, 10]} />
          </mesh>
          <mesh position={[0.3, p.h - 0.1, 0]} material={flat(palette.paper, 0.6)}>
            <boxGeometry args={[0.56, 0.18, 0.01]} />
          </mesh>
          <Text position={[0.3, p.h - 0.1, 0.008]} fontSize={0.09} color={palette.ink} anchorX="center" anchorY="middle">
            {`@Entity ${p.name}`}
          </Text>
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// TypeORM · Migration boxes (room)
// ---------------------------------------------------------------------------

/**
 * A stack of moving boxes, one per migration, with a hand truck beside it and a shelf labeled
 * "applied". E runs migration:run and the pending boxes move onto the shelf in order; once all
 * are applied, E reverts the last one.
 */
const BOX_MIGS = ["1718000000001-CreateUser", "1718000000002-CreatePost", "1718000000003-AddEmailIndex", "1718000000004-CreateTag", "1718000000005-PostTags"];
const BOX = [0.55, 0.38, 0.45] as const;

function TypeormBoxes({ w, d, toHouse }: SigProps) {
  const { palette, accent } = useHouse();
  const [applied, setApplied] = useState(0);
  const queue = useRef(0);
  const nextAt = useRef(0);
  const boxes = useRef<(THREE.Group | null)[]>([]);
  const N = BOX_MIGS.length;
  const sx = -w / 2 + 1.1;
  const sz = -d / 2 + 0.9;
  const shelfLen = Math.min(3.2, w / 2 - 0.5);
  const shelfX = w / 2 - 0.35 - shelfLen / 2;
  const shelfZ = -d / 2 + 0.38;
  const perLevel = Math.max(2, Math.floor(shelfLen / 0.62));
  const levels = [0.42, 1.12];
  const target = (i: number, a: number): V3 => {
    if (i < a) {
      const lv = Math.floor(i / perLevel);
      return [shelfX - shelfLen / 2 + 0.35 + (i % perLevel) * 0.62, levels[Math.min(1, lv)] + 0.02 + BOX[1] / 2, shelfZ];
    }
    return [sx, BOX[1] / 2 + (N - 1 - i) * (BOX[1] + 0.01), sz];
  };

  const run = () => {
    if (queue.current) return;
    if (applied >= N) {
      setApplied(N - 1);
      sfx.clunk();
      toast(`migration:revert ran the down() of the last migration (${BOX_MIGS[N - 1]}) and removed it from the migrations table. Run it again to undo the one before.`, "📦 Migration Boxes");
      return;
    }
    queue.current = N - applied;
    nextAt.current = now();
    sfx.click();
  };
  const where = useWorldPoint(toHouse, (sx + shelfX) / 2, sz + 1.3);
  useProximity({ id: "typeorm-boxes", label: applied >= N ? "migration:revert" : "migration:run", radius: 2, where, run });

  useFrame((_, delta) => {
    const t = now();
    if (queue.current && t >= nextAt.current) {
      queue.current--;
      setApplied((a) => Math.min(N, a + 1));
      sfx.pop();
      nextAt.current = t + 0.8;
      if (!queue.current) toast(`migration:run executed every pending migration in timestamp order, calling each one's up() and recording it in the migrations table.`, "📦 Migration Boxes");
    }
    const k = 1 - Math.exp(-delta * 4);
    boxes.current.forEach((g, i) => {
      if (!g) return;
      const [x, y, z] = target(i, applied);
      const far = Math.hypot(x - g.position.x, z - g.position.z);
      g.position.x += (x - g.position.x) * k;
      g.position.z += (z - g.position.z) * k;
      g.position.y += (y + Math.min(0.6, far * 0.5) - g.position.y) * Math.min(1, k * 1.6);
    });
  });

  const card = flat("#c8a06a", 0.85);
  const tape = flat("#e8d9b0", 0.6);
  const steel = flat("#4b5563", 0.35, 0.7);
  const wood = flat("#9a7048", 0.6);
  return (
    <group>
      {/* Boxes */}
      {BOX_MIGS.map((m, i) => {
        const [name, stamp] = [m.split("-")[1], m.split("-")[0]];
        return (
          <group key={m} ref={(g) => void (boxes.current[i] = g)} position={target(i, 0)}>
            <mesh material={card} castShadow receiveShadow>
              <boxGeometry args={[BOX[0], BOX[1], BOX[2]]} />
            </mesh>
            <mesh position={[0, BOX[1] / 2 + 0.001, 0]} material={tape}>
              <boxGeometry args={[0.08, 0.004, BOX[2] + 0.004]} />
            </mesh>
            <mesh position={[0, 0, BOX[2] / 2 + 0.002]} material={flat("#fff3ef", 0.7)}>
              <planeGeometry args={[0.46, 0.2]} />
            </mesh>
            <Text position={[0, 0, BOX[2] / 2 + 0.005]} fontSize={0.045} lineHeight={1.25} color={palette.ink} anchorX="center" anchorY="middle" textAlign="center">
              {`${name}\n${stamp}`}
            </Text>
          </group>
        );
      })}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[BOX[0] / 2 + 0.05, (N * BOX[1]) / 2, BOX[2] / 2 + 0.05]} position={[sx, (N * BOX[1]) / 2, sz]} />
        <CuboidCollider args={[shelfLen / 2, 0.75, 0.25]} position={[shelfX, 0.75, shelfZ]} />
      </RigidBody>
      {/* Hand truck */}
      <group position={[sx + 0.75, 0, sz + 0.1]} rotation-x={-0.12}>
        {[-0.18, 0.18].map((x) => (
          <mesh key={x} position={[x, 0.65, 0]} material={steel} castShadow>
            <cylinderGeometry args={[0.018, 0.018, 1.25, 8]} />
          </mesh>
        ))}
        {[0.35, 0.7, 1.05].map((y) => (
          <mesh key={y} position={[0, y, 0]} rotation-z={Math.PI / 2} material={steel}>
            <cylinderGeometry args={[0.012, 0.012, 0.36, 6]} />
          </mesh>
        ))}
        <mesh position={[0, 1.27, 0]} rotation-x={Math.PI / 2} material={flat("#111111", 0.6)}>
          <torusGeometry args={[0.16, 0.02, 6, 16, Math.PI]} />
        </mesh>
        <mesh position={[0, 0.03, 0.14]} material={steel}>
          <boxGeometry args={[0.4, 0.015, 0.25]} />
        </mesh>
        {[-0.24, 0.24].map((x) => (
          <mesh key={x} position={[x, 0.1, -0.06]} rotation-z={Math.PI / 2} material={flat("#1f1f1f", 0.7)}>
            <cylinderGeometry args={[0.1, 0.1, 0.06, 16]} />
          </mesh>
        ))}
      </group>
      {/* The "applied" shelf */}
      <group position={[shelfX, 0, shelfZ]}>
        {levels.map((y) => (
          <mesh key={y} position={[0, y, 0]} material={wood} receiveShadow>
            <boxGeometry args={[shelfLen, 0.04, 0.48]} />
          </mesh>
        ))}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * (shelfLen / 2 - 0.02), 0.78, 0]} material={steel}>
            <boxGeometry args={[0.04, 1.56, 0.48]} />
          </mesh>
        ))}
        <mesh position={[0, 1.84, -0.1]} material={flat(palette.ink, 0.5)}>
          <boxGeometry args={[1.1, 0.3, 0.03]} />
        </mesh>
        <Text position={[0, 1.84, -0.08]} fontSize={0.13} color={accent} anchorX="center" anchorY="middle">
          {`applied (${applied}/${N})`}
        </Text>
      </group>
      <Text position={[sx, N * (BOX[1] + 0.01) + 0.25, sz]} fontSize={0.1} color={palette.ink} anchorX="center" anchorY="middle">
        {applied >= N ? "nothing pending" : "pending"}
      </Text>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Sequelize · The drawer wall (hero)
// ---------------------------------------------------------------------------

/**
 * A tall wall of numbered filing drawers (001 to 040) on a base, one row per model, with a log
 * strip on top. E runs sequelize.sync(): the drawers open in a wave, one after another, and the log
 * prints the CREATE TABLE for each model as it goes.
 */
const DR_COLS = 8;
const DR_ROWS = 5;
const DR_BASE = 0.35;
const DR_CELL_H = 0.42;
const DR_DEPTH = 0.6;
const SYNC_MODELS = [
  'CREATE TABLE IF NOT EXISTS "Users" ("id" SERIAL, "name" VARCHAR(255), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY ("id"));',
  'CREATE TABLE IF NOT EXISTS "Projects" ("id" SERIAL, "title" VARCHAR(255), "UserId" INTEGER REFERENCES "Users" ("id"), PRIMARY KEY ("id"));',
  'CREATE TABLE IF NOT EXISTS "Tasks" ("id" SERIAL, "title" VARCHAR(255), "done" BOOLEAN DEFAULT false, PRIMARY KEY ("id"));',
  'CREATE TABLE IF NOT EXISTS "Comments" ("id" SERIAL, "body" TEXT, "TaskId" INTEGER REFERENCES "Tasks" ("id"), PRIMARY KEY ("id"));',
  'CREATE TABLE IF NOT EXISTS "Tags" ("id" SERIAL, "name" VARCHAR(255) UNIQUE, PRIMARY KEY ("id"));',
];
const DR_STEP = 0.07;

function SequelizeDrawers({ w, d, toHouse }: SigProps) {
  const { palette, accent } = useHouse();
  const [row, setRow] = useState(-1);
  const syncAt = useRef(-100);
  const shownRow = useRef(-1);
  const drawers = useRef<(THREE.Group | null)[]>([]);
  const ww = Math.min(w - 1.2, 4);
  const cellW = ww / DR_COLS;
  const H = DR_ROWS * DR_CELL_H;
  const { texture } = useCanvas(
    1024,
    320,
    (ctx, cw, ch) => {
      const lw = cw / DR_COLS;
      const lh = ch / DR_ROWS;
      for (let i = 0; i < DR_COLS * DR_ROWS; i++) {
        const x = (i % DR_COLS) * lw;
        const y = Math.floor(i / DR_COLS) * lh;
        box(ctx, x + 3, y + 3, lw - 6, lh - 6, 6, "#f6f0dc", "#b08d4a", 3);
        ctx.fillStyle = "#0c2233";
        ctx.font = font(lh * 0.55, "bold");
        ctx.textAlign = "center";
        ctx.fillText(String(i + 1).padStart(3, "0"), x + lw / 2, y + lh * 0.7);
      }
    },
    0,
  );
  const labelMat = useMemo(() => new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }), [texture]);
  const cells = useAtlasCells(DR_COLS, DR_ROWS, Math.min(0.2, cellW * 0.5), Math.min(0.1, cellW * 0.25));

  const sync = () => {
    if (now() - syncAt.current < DR_COLS * DR_ROWS * DR_STEP + 0.8) return;
    syncAt.current = now();
    shownRow.current = -1;
    sfx.click();
  };
  const where = useWorldPoint(toHouse, 0, Math.min(d / 2 - 0.4, 1.9));
  useProximity({ id: "sequelize-drawers", label: "sequelize.sync()", radius: 2.2, where, run: sync });

  useFrame(() => {
    const age = now() - syncAt.current;
    drawers.current.forEach((g, i) => {
      if (!g) return;
      const x = (age - i * DR_STEP) / 0.7;
      g.position.z = x > 0 && x < 1 ? Math.sin(Math.PI * x) * 0.32 : 0;
    });
    if (age < 0 || age > DR_COLS * DR_ROWS * DR_STEP + 0.7) return;
    const r = Math.min(DR_ROWS - 1, Math.floor(age / (DR_COLS * DR_STEP)));
    if (r !== shownRow.current) {
      shownRow.current = r;
      setRow(r);
      sfx.clunk();
      if (r === DR_ROWS - 1) {
        sfx.coin();
        burstAt(toHouse, 0, DR_BASE + H + 0.4, 0.4, [accent, "#ffffff"], 18);
        toast("sync() ran CREATE TABLE IF NOT EXISTS for every model. sync({ alter: true }) adjusts existing tables and sync({ force: true }) drops them first, so in production use migrations instead.", "🗄️ sequelize.sync()");
      }
    }
  });

  const carcass = flat("#2f5e82", 0.5, 0.2);
  const front = flat("#dfeef8", 0.4, 0.3);
  const steel = flat("#9aa7b2", 0.3, 0.8);
  const total = DR_BASE + H;
  return (
    <group onClick={(e) => clicked(e) && sync()} {...pointer}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[ww / 2 + 0.1, total / 2, DR_DEPTH / 2 + 0.05]} position={[0, total / 2, 0]} />
      </RigidBody>
      {/* Base, carcass and crown */}
      <mesh position={[0, DR_BASE / 2, 0]} material={flat(palette.ink, 0.5, 0.3)} castShadow receiveShadow>
        <boxGeometry args={[ww + 0.2, DR_BASE, DR_DEPTH + 0.1]} />
      </mesh>
      <mesh position={[0, DR_BASE + H / 2, -0.01]} material={carcass} castShadow>
        <boxGeometry args={[ww + 0.08, H + 0.04, DR_DEPTH - 0.02]} />
      </mesh>
      <mesh position={[0, total + 0.06, 0]} material={carcass} castShadow>
        <boxGeometry args={[ww + 0.2, 0.1, DR_DEPTH + 0.1]} />
      </mesh>
      <mesh position={[0, total + 0.115, DR_DEPTH / 2 + 0.05]} material={flat(palette.main, 0.4, 0.3, palette.main, 0.5)}>
        <boxGeometry args={[ww + 0.2, 0.012, 0.01]} />
      </mesh>
      <Text position={[0, DR_BASE / 2, DR_DEPTH / 2 + 0.055]} fontSize={0.12} color={palette.main} anchorX="center" anchorY="middle">
        await sequelize.sync()
      </Text>
      {/* The drawers */}
      {Array.from({ length: DR_COLS * DR_ROWS }, (_, i) => {
        const x = -ww / 2 + cellW * ((i % DR_COLS) + 0.5);
        const y = DR_BASE + H - DR_CELL_H * (Math.floor(i / DR_COLS) + 0.5);
        return (
          <group key={i} ref={(g) => void (drawers.current[i] = g)}>
            <group position={[x, y, DR_DEPTH / 2 - 0.25]}>
              <mesh material={front} castShadow>
                <boxGeometry args={[cellW - 0.03, DR_CELL_H - 0.03, 0.5]} />
              </mesh>
              <mesh position={[0, DR_CELL_H * 0.18, 0.252]} geometry={cells[i]} material={labelMat} />
              <mesh position={[0, -DR_CELL_H * 0.15, 0.265]} material={steel}>
                <boxGeometry args={[cellW * 0.4, 0.03, 0.03]} />
              </mesh>
            </group>
          </group>
        );
      })}
      {/* The log strip */}
      <group position={[0, total + 0.5, 0]}>
        <mesh material={flat("#0c2233", 0.4, 0.3)} castShadow>
          <boxGeometry args={[ww + 0.2, 0.62, 0.08]} />
        </mesh>
        <Text position={[0, 0, 0.05]} fontSize={0.065} maxWidth={ww - 0.1} lineHeight={1.3} color={row < 0 ? palette.main : "#86efac"} anchorX="center" anchorY="middle" textAlign="left">
          {row < 0 ? "Executing (default): SELECT 1+1 AS result\n> press E to sync every model" : `Executing (default): ${SYNC_MODELS[row]}`}
        </Text>
      </group>
    </group>
  );
}

export const DATABASES: Record<string, SigComponent> = {
  "pg-catalog": PgCatalog,
  "pg-acid": PgAcid,
  "mysql-tank": MysqlTank,
  "mysql-fishing": MysqlFishing,
  "mongo-tree": MongoTree,
  "mongo-beds": MongoBeds,
  "firebase-realtime": FirebaseRealtime,
  "firebase-auth": FirebaseAuth,
  "supabase-core": SupabaseCore,
  "supabase-buckets": SupabaseBuckets,
  "supabase-rls": SupabaseRls,
  "prisma-prism": PrismaPrism,
  "prisma-migrate": PrismaMigrate,
  "typeorm-map": TypeormMap,
  "typeorm-boxes": TypeormBoxes,
  "sequelize-drawers": SequelizeDrawers,
};
