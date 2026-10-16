"use client";

import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { createContext, useContext, useMemo } from "react";
import * as THREE from "three";
import { liveContent } from "@/content/live";
import type { Skill } from "@/content/schema";
import { useCityStore } from "@/state/useCityStore";
import { HOUSES, houseFor, type HouseDef, type RoomSpec } from "@/world/skillHouses/houses";
import { DOOR, makePlan, type Plan, type PlanRoom, type PlanWall, roomFrame, type Side } from "@/world/skillHouses/plan";
import { worldEnv } from "@/world/env";
import { signatureFor } from "@/world/signatures";
import { Batch, TallPlant } from "../Furniture";
import { Seats } from "../StreetDetails";
import type { Seat } from "@/state/useCityStore";
import { OnWall } from "../InteriorScene";
import { makeWalkers, Pedestrians } from "../Pedestrians";
import { type SkillTheme, skillTheme } from "../SkillRooms";
import { Text } from "../Text3D";
import { useProximity } from "../useProximity";
import { flat, surfaceMaterial } from "./finishKit";
import { HouseLights } from "./lights";
import { RoomModule } from "./modules";
import { DemoAt, Hero } from "./signatures";

/**
 * A skill's building, drawn from its house definition (world/skillHouses/houses.ts): the plan's
 * floors, outer and inner walls with doorways, a raised deck if it has one, signs over the doors,
 * lights, a reception kiosk by the entrance, the centerpiece in the hall and a module in every room.
 * The house sits at the origin with its entrance in the middle of the front wall (+z).
 */

export type HouseCtx = {
  skill: Skill;
  def: HouseDef;
  plan: Plan;
  theme: SkillTheme;
  /** The skill's own accent (from its signature) */
  accent: string;
  palette: { main: string; second: string; ink: string; paper: string };
  /** Projects and jobs whose tech lists include this skill */
  uses: { projects: { id: string; name: string }[]; jobs: { id: string; name: string }[] };
};

const HouseContext = createContext<HouseCtx | null>(null);
export const useHouse = () => useContext(HouseContext)!;

/** Room size for a skill house (the scene's RoomContext). */
export function houseSize(id: string) {
  const [width, depth, height] = houseFor(id).size;
  return { width, depth, height };
}
export const hasHouse = (id: string) => id in HOUSES;

const norm = (s: string) => s.toLowerCase().replace(/\.js$|s+$|[./\s-]/g, "");
function usedIn(skill: Skill) {
  const n = norm(skill.name);
  const hit = (tech: string[]) => tech.some((t) => norm(t) === n || norm(t).startsWith(n) || n.startsWith(norm(t)));
  return {
    projects: liveContent.projects.filter((p) => hit(p.tech)).map((p) => ({ id: p.id, name: p.name })),
    jobs: liveContent.experience.filter((j) => hit(j.tech)).map((j) => ({ id: j.id, name: j.company })),
  };
}

export function SkillHouse({ skill }: { skill: Skill }) {
  const def = houseFor(skill.id);
  const plan = useMemo(() => makePlan(def.cut, def.size, def.rooms.length, def.options), [def]);
  const ctx = useMemo<HouseCtx>(() => {
    const [main, second, ink, paper] = def.palette;
    return {
      skill,
      def,
      plan,
      theme: skillTheme(skill),
      accent: signatureFor(skill.id, skill.name)?.accent ?? main,
      palette: { main, second, ink, paper },
      uses: usedIn(skill),
    };
  }, [skill, def, plan]);
  const walkers = useMemo(() => {
    const [hx, hz] = plan.hero;
    const r = 3.6;
    if (plan.hall.w < 10 || plan.hall.d < 10) return [];
    return makeWalkers(`house-${skill.id}`, "skills", [], [
      [
        [hx - r, hz - r],
        [hx + r, hz - r],
        [hx + r, hz + r],
        [hx - r, hz + r],
      ],
    ]);
  }, [plan, skill.id]);

  return (
    <HouseContext value={ctx}>
      <Shell />
      {plan.walls.map((w, i) => (
        <InnerWall key={i} wall={w} />
      ))}
      {plan.platforms.map((p, i) => (
        <Deck key={i} platform={p} />
      ))}
      {plan.rooms.map((r) => (
        <Room key={r.slot} room={r} spec={def.rooms[r.slot]} />
      ))}
      <Hero />
      <HallBanner />
      <Reception />
      <Lobby />
      <HouseLights />
      <Pedestrians walkers={walkers} />
    </HouseContext>
  );
}

// ---------------------------------------------------------------------------
// Shell: floor, outer walls, ceiling
// ---------------------------------------------------------------------------

function Shell() {
  const { def, plan } = useHouse();
  const { W, D, H } = plan;
  const floor = surfaceMaterial(def.floor);
  const wall = surfaceMaterial(def.wall);
  const trim = flat(def.trim, 0.45, 0.2);
  const walls = [
    { side: "back" as const, pos: [0, 0, -D / 2] as const, rot: 0, len: W },
    { side: "front" as const, pos: [0, 0, D / 2] as const, rot: Math.PI, len: W },
    { side: "left" as const, pos: [-W / 2, 0, 0] as const, rot: Math.PI / 2, len: D },
    { side: "right" as const, pos: [W / 2, 0, 0] as const, rot: -Math.PI / 2, len: D },
  ];
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[W / 2 + 1, 0.5, D / 2 + 1]} position={[0, -0.5, 0]} />
        <CuboidCollider args={[W / 2 + 1, H, 0.5]} position={[0, H, -D / 2 - 0.5]} />
        <CuboidCollider args={[W / 2 + 1, H, 0.5]} position={[0, H, D / 2 + 0.5]} />
        <CuboidCollider args={[0.5, H, D / 2 + 1]} position={[-W / 2 - 0.5, H, 0]} />
        <CuboidCollider args={[0.5, H, D / 2 + 1]} position={[W / 2 + 0.5, H, 0]} />
      </RigidBody>
      <mesh rotation-x={-Math.PI / 2} receiveShadow material={floor}>
        <planeGeometry args={[W, D]} />
      </mesh>
      {walls.map(({ side, pos, rot, len }) => (
        <OnWall key={side} side={side}>
          <group position={[pos[0], pos[1], pos[2]]} rotation-y={rot}>
            <mesh position={[0, H / 2, 0]} material={wall} receiveShadow>
              <planeGeometry args={[len, H]} />
            </mesh>
            <mesh position={[0, 0.07, 0.02]} material={trim}>
              <boxGeometry args={[len, 0.14, 0.04]} />
            </mesh>
            <mesh position={[0, H - 0.08, 0.02]} material={trim}>
              <boxGeometry args={[len, 0.16, 0.04]} />
            </mesh>
          </group>
        </OnWall>
      ))}
      <Windows />
      <Ceiling />
    </group>
  );
}

/** High windows along both side walls: daylight by day, deep blue at night. */
function Windows() {
  const { def, plan } = useHouse();
  const { D, W, H } = plan;
  const glass = useMemo(() => new THREE.MeshStandardMaterial({ color: "#a9d6f5", emissive: "#d6efff", emissiveIntensity: 0.9, roughness: 0.1 }), []);
  const day = useMemo(() => new THREE.Color("#d6efff"), []);
  const night = useMemo(() => new THREE.Color("#1d2550"), []);
  useFrame(() => {
    glass.emissive.lerpColors(day, night, worldEnv.night);
    glass.emissiveIntensity = 0.9 - worldEnv.night * 0.5;
  });
  const frame = flat(def.trim, 0.45, 0.4);
  const top = H - 0.45;
  const bottom = Math.max(2.9, H - 2);
  if (top - bottom < 0.8) return null;
  const count = Math.max(1, Math.floor((D - 2) / 3.4));
  const zs = Array.from({ length: count }, (_, i) => -D / 2 + 1 + (D - 2) * ((i + 0.5) / count));
  return (
    <>
      {(["left", "right"] as const).map((side) => (
        <OnWall key={side} side={side}>
          <group position={[side === "left" ? -W / 2 + 0.02 : W / 2 - 0.02, (top + bottom) / 2, 0]} rotation-y={side === "left" ? Math.PI / 2 : -Math.PI / 2}>
            {zs.map((z) => (
              <group key={z} position={[side === "left" ? -z : z, 0, 0]}>
                <mesh material={glass}>
                  <planeGeometry args={[2.4, top - bottom]} />
                </mesh>
                {[-1.2, 0, 1.2].map((x) => (
                  <mesh key={x} position={[x, 0, 0.02]} material={frame}>
                    <boxGeometry args={[0.06, top - bottom + 0.06, 0.04]} />
                  </mesh>
                ))}
                {[-1, 1].map((s) => (
                  <mesh key={s} position={[0, (s * (top - bottom)) / 2, 0.02]} material={frame}>
                    <boxGeometry args={[2.46, 0.06, 0.04]} />
                  </mesh>
                ))}
              </group>
            ))}
          </group>
        </OnWall>
      ))}
    </>
  );
}

function Ceiling() {
  const { def, plan } = useHouse();
  const { W, D, H, hall } = plan;
  const lights = def.lights;
  const industrial = lights === "industrial";
  const beam = flat(industrial ? "#26262b" : def.trim, 0.5, industrial ? 0.6 : 0.1);
  return (
    <group>
      <mesh rotation-x={Math.PI / 2} position={[0, H, 0]} material={flat(def.ceiling, 0.9)}>
        <planeGeometry args={[W, D]} />
      </mesh>
      {/* Exposed trusses in sheds and workshops, a coffer grid over chandelier halls */}
      <Batch>
        {industrial &&
          Array.from({ length: Math.max(2, Math.floor(W / 4)) }, (_, i) => -W / 2 + 2 + i * 4).map((x) => (
            <group key={x}>
              <mesh position={[x, H - 0.25, 0]} material={beam}>
                <boxGeometry args={[0.18, 0.5, D]} />
              </mesh>
            </group>
          ))}
        {lights === "chandelier" &&
          [-1, 1].flatMap((s) =>
            [hall.w / 2 - 0.4].map((dx) => (
              <mesh key={s} position={[hall.x + s * dx, H - 0.15, hall.z]} material={beam}>
                <boxGeometry args={[0.2, 0.3, hall.d]} />
              </mesh>
            )),
          )}
      </Batch>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Interior walls
// ---------------------------------------------------------------------------

const DOOR_H = 2.6;

function segments(w: PlanWall) {
  const out: [number, number][] = [];
  let start = w.from;
  for (const d of [...w.doors].sort((a, b) => a - b)) {
    out.push([start, d - DOOR / 2]);
    start = d + DOOR / 2;
  }
  out.push([start, w.to]);
  return out.filter(([a, b]) => b - a > 0.05);
}

function InnerWall({ wall }: { wall: PlanWall }) {
  const { def, plan } = useHouse();
  const H = plan.H;
  const mat = surfaceMaterial(def.inner ?? def.wall);
  const trim = flat(def.trim, 0.45, 0.2);
  const T = 0.18;
  const place = (along: number, y: number, across = 0): [number, number, number] =>
    wall.axis === "x" ? [along, y, wall.at + across] : [wall.at + across, y, along];
  const sizeOf = (len: number, h: number, t = T): [number, number, number] => (wall.axis === "x" ? [len, h, t] : [t, h, len]);
  const segs = segments(wall);
  const full = wall.to - wall.from;
  const mid = (wall.from + wall.to) / 2;
  const style = wall.style;
  const glass = style === "glass";
  // Segments between doorways rise to door height (glass all the way up); one strip runs above the
  // doorways to the ceiling (glass over glass doors).
  const wallTop = style === "half" ? 1.1 : glass ? H : DOOR_H;

  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        {style === "frame"
          ? // A skeleton wall: only its posts are solid.
            posts(wall).map((p) => <CuboidCollider key={p} args={[0.12, H / 2, 0.12]} position={place(p, H / 2)} />)
          : segs.map(([a, b]) => {
              const s = sizeOf(b - a, wallTop);
              return <CuboidCollider key={a} args={[s[0] / 2, s[1] / 2, s[2] / 2]} position={place((a + b) / 2, wallTop / 2)} />;
            })}
      </RigidBody>
      <Batch>
        {style === "frame" ? (
          <FrameWall wall={wall} place={place} sizeOf={sizeOf} />
        ) : (
          <>
            {segs.map(([a, b]) => (
              <group key={a}>
                <mesh position={place((a + b) / 2, wallTop / 2)} material={glass ? GLASS : mat} receiveShadow castShadow={!glass}>
                  <boxGeometry args={sizeOf(b - a, wallTop, glass ? 0.04 : T)} />
                </mesh>
                {[-1, 1].map((s) => (
                  <mesh key={s} position={place((a + b) / 2, 0.07, s * (T / 2 + 0.01))} material={trim}>
                    <boxGeometry args={sizeOf(b - a, 0.14, 0.03)} />
                  </mesh>
                ))}
                {glass &&
                  Array.from({ length: Math.max(1, Math.round((b - a) / 1.4)) + 1 }, (_, k) => (
                    <mesh key={k} position={place(a + ((b - a) / Math.max(1, Math.round((b - a) / 1.4))) * k, H / 2)} material={trim}>
                      <boxGeometry args={sizeOf(0.05, H, 0.07)} />
                    </mesh>
                  ))}
                {glass && (
                  <mesh position={place((a + b) / 2, DOOR_H + 0.04)} material={trim}>
                    <boxGeometry args={sizeOf(b - a, 0.05, 0.07)} />
                  </mesh>
                )}
                {style === "half" && (
                  <mesh position={place((a + b) / 2, 1.13)} material={trim}>
                    <boxGeometry args={sizeOf(b - a, 0.06, T + 0.08)} />
                  </mesh>
                )}
                {style === "shelf" && <ShelfFace wall={wall} a={a} b={b} place={place} sizeOf={sizeOf} />}
              </group>
            ))}
            {/* Above the doorways (and above the glass) the wall runs on to the ceiling */}
            {style !== "half" && !glass && (
              <mesh position={place(mid, (wallTop + H) / 2)} material={mat} receiveShadow>
                <boxGeometry args={sizeOf(full, H - wallTop, T)} />
              </mesh>
            )}
            {glass &&
              wall.doors.map((d) => (
                <group key={d}>
                  <mesh position={place(d, (DOOR_H + H) / 2)} material={GLASS}>
                    <boxGeometry args={sizeOf(DOOR, H - DOOR_H, 0.04)} />
                  </mesh>
                </group>
              ))}
            {/* Door frames */}
            {style !== "half" &&
              wall.doors.map((d) => (
                <group key={d}>
                  {[-1, 1].map((s) => (
                    <mesh key={s} position={place(d + s * (DOOR / 2 + 0.03), DOOR_H / 2)} material={trim}>
                      <boxGeometry args={sizeOf(0.08, DOOR_H, T + 0.06)} />
                    </mesh>
                  ))}
                  <mesh position={place(d, DOOR_H + 0.04)} material={trim}>
                    <boxGeometry args={sizeOf(DOOR + 0.14, 0.1, T + 0.06)} />
                  </mesh>
                </group>
              ))}
          </>
        )}
      </Batch>
    </group>
  );
}

const GLASS = new THREE.MeshStandardMaterial({
  color: "#dbeef5",
  transparent: true,
  opacity: 0.18,
  roughness: 0.05,
  metalness: 0.2,
  depthWrite: false,
  side: THREE.DoubleSide,
});

function posts(w: PlanWall) {
  const out: number[] = [];
  const n = Math.max(1, Math.round((w.to - w.from) / 2.4));
  for (let i = 0; i <= n; i++) {
    const p = w.from + ((w.to - w.from) / n) * i;
    if (w.doors.some((d) => Math.abs(p - d) < DOOR / 2 + 0.1)) continue;
    out.push(p);
  }
  return out;
}

type Placer = (along: number, y: number, across?: number) => [number, number, number];
type Sizer = (len: number, h: number, t?: number) => [number, number, number];

/** A steel skeleton instead of a wall: I-beam posts, a top beam and cross braces (HTML's building). */
function FrameWall({ wall, place, sizeOf }: { wall: PlanWall; place: Placer; sizeOf: Sizer }) {
  const { def, plan } = useHouse();
  const steel = flat(def.trim, 0.45, 0.55);
  const H = plan.H;
  const ps = posts(wall);
  return (
    <group>
      {ps.map((p) => (
        <mesh key={p} position={place(p, H / 2)} material={steel} castShadow>
          <boxGeometry args={sizeOf(0.22, H, 0.22)} />
        </mesh>
      ))}
      {[DOOR_H + 0.1, H - 0.2].map((y) => (
        <mesh key={y} position={place((wall.from + wall.to) / 2, y)} material={steel}>
          <boxGeometry args={sizeOf(wall.to - wall.from, 0.24, 0.2)} />
        </mesh>
      ))}
      {ps.slice(1).map((p, i) => {
        const a = ps[i];
        if (p - a > 3.2) return null;
        const len = Math.hypot(p - a, DOOR_H - 0.3);
        const ang = Math.atan2(DOOR_H - 0.3, p - a);
        return (
          <mesh
            key={p}
            position={place((a + p) / 2, DOOR_H / 2 + 0.05)}
            rotation={wall.axis === "x" ? [0, 0, (i % 2 ? 1 : -1) * ang] : [(i % 2 ? -1 : 1) * ang, 0, 0]}
            material={steel}
          >
            <boxGeometry args={sizeOf(len, 0.08, 0.08)} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Book-lined faces on a wall segment (both sides). */
function ShelfFace({ wall, a, b, place, sizeOf }: { wall: PlanWall; a: number; b: number; place: Placer; sizeOf: Sizer }) {
  const { palette } = useHouse();
  const wood = flat("#5a3a24", 0.6);
  const colors = [palette.main, palette.second, "#e8dcc4", "#7a2e2e", "#2e4a7a", "#3f6b3a"];
  const books = useMemo(() => {
    const out: { at: number; y: number; h: number; side: number; c: number }[] = [];
    let seed = Math.round(a * 13 + 7);
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const side of [-1, 1])
      for (const y of [0.45, 0.95, 1.45, 1.95])
        for (let t = a + 0.15; t < b - 0.15; t += 0.07 + rnd() * 0.05) out.push({ at: t, y, h: 0.26 + rnd() * 0.14, side, c: Math.floor(rnd() * colors.length) });
    return out;
  }, [a, b, colors.length]);
  return (
    <group>
      {[-1, 1].flatMap((side) =>
        [0.3, 0.8, 1.3, 1.8, 2.3].map((y) => (
          <mesh key={`${side}${y}`} position={place((a + b) / 2, y, side * 0.2)} material={wood}>
            <boxGeometry args={sizeOf(b - a, 0.03, 0.24)} />
          </mesh>
        )),
      )}
      {books.map((k, i) => (
        <mesh key={i} position={place(k.at, k.y - 0.17 + k.h / 2, k.side * 0.2)} material={flat(colors[k.c], 0.7)}>
          <boxGeometry args={sizeOf(0.05, k.h, 0.18)} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// The deck (mezzanine)
// ---------------------------------------------------------------------------

function Deck({ platform: p }: { platform: Plan["platforms"][number] }) {
  const { def } = useHouse();
  const deck = surfaceMaterial(def.floor);
  const trim = flat(def.trim, 0.4, 0.4);
  const rampW = 2.4;
  const rampL = 3.2;
  const front = p.z + p.d / 2;
  const slope = Math.atan2(p.y, rampL);
  const rampLen = Math.hypot(rampL, p.y);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[p.w / 2, p.y / 2, p.d / 2]} position={[p.x, p.y / 2, p.z]} />
        <CuboidCollider args={[rampW / 2, 0.1, rampLen / 2]} position={[p.rampAt, p.y / 2 - 0.08, front + rampL / 2]} rotation={[slope, 0, 0]} />
        {/* Railings keep you from walking off the edge */}
        <CuboidCollider args={[(p.w / 2 - rampW / 2) / 2, 0.55, 0.05]} position={[p.x - p.w / 4 - rampW / 4, p.y + 0.55, front]} />
        <CuboidCollider args={[(p.w / 2 - rampW / 2) / 2, 0.55, 0.05]} position={[p.x + p.w / 4 + rampW / 4, p.y + 0.55, front]} />
        {[-1, 1].map((s) => (
          <CuboidCollider key={s} args={[0.05, 0.55, p.d / 2]} position={[p.x + (s * p.w) / 2, p.y + 0.55, p.z]} />
        ))}
      </RigidBody>
      <Batch>
        <mesh position={[p.x, p.y / 2, p.z]} material={deck} receiveShadow castShadow>
          <boxGeometry args={[p.w, p.y, p.d]} />
        </mesh>
        <mesh position={[p.rampAt, p.y / 2 - 0.02, front + rampL / 2]} rotation-x={slope} material={deck} receiveShadow>
          <boxGeometry args={[rampW, 0.12, rampLen]} />
        </mesh>
        {/* Railing: top rail and balusters */}
        {[
          [p.x - p.w / 2, p.rampAt - rampW / 2],
          [p.rampAt + rampW / 2, p.x + p.w / 2],
        ].map(([a, b]) => (
          <group key={a}>
            <mesh position={[(a + b) / 2, p.y + 1.05, front]} material={trim}>
              <boxGeometry args={[b - a, 0.05, 0.06]} />
            </mesh>
            {Array.from({ length: Math.max(2, Math.round((b - a) / 0.5)) + 1 }, (_, i) => (
              <mesh key={i} position={[a + ((b - a) / Math.max(2, Math.round((b - a) / 0.5))) * i, p.y + 0.52, front]} material={trim}>
                <boxGeometry args={[0.03, 1.05, 0.03]} />
              </mesh>
            ))}
          </group>
        ))}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[p.x + (s * p.w) / 2, p.y + 1.05, p.z]} material={trim}>
            <boxGeometry args={[0.06, 0.05, p.d]} />
          </mesh>
        ))}
      </Batch>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

/** The point in the middle of a room's door edge, and the direction out of the room. */
export function doorPoint(r: PlanRoom): { x: number; z: number; out: [number, number] } {
  const dir: Record<Side, [number, number]> = { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] };
  const [dx, dz] = dir[r.door];
  return { x: r.x + (dx * r.w) / 2, z: r.z + (dz * r.d) / 2, out: [dx, dz] };
}

function Room({ room, spec }: { room: PlanRoom; spec: RoomSpec }) {
  const { plan, palette } = useHouse();
  const frame = useMemo(() => roomFrame(room), [room]);
  const floor = spec.floor ? surfaceMaterial(spec.floor) : null;
  const door = doorPoint(room);
  const signRot = Math.atan2(door.out[0], door.out[1]);
  return (
    <group>
      {floor && (
        <mesh rotation-x={-Math.PI / 2} position={[room.x, 0.004, room.z]} material={floor} receiveShadow>
          <planeGeometry args={[room.w, room.d]} />
        </mesh>
      )}
      {spec.kind === "demo" ? (
        // The classic centerpieces work in world space and face +z: stand it in the room's middle,
        // a little back so its prompt spot (3 m in front) stays inside.
        <DemoAt x={room.x} z={room.z - Math.max(0, Math.min(1.2, room.d / 2 - 3.2))} />
      ) : (
        <group position={[room.x, 0, room.z]} rotation-y={frame.rot}>
          <RoomModule spec={spec} room={room} w={frame.w} d={frame.d} toHouse={frame.toHouse} rot={frame.rot} />
        </group>
      )}
      {/* The room's name over its door (walled rooms) or on a hanging banner (open zones) */}
      <group position={[door.x + door.out[0] * 0.11, room.open ? Math.min(plan.H - 1, 3.4) : DOOR_H + 0.42, door.z + door.out[1] * 0.11]} rotation-y={signRot}>
        <mesh material={flat(palette.ink, 0.5)}>
          <boxGeometry args={[Math.min(3.2, 0.5 + spec.label.length * 0.13), 0.42, 0.04]} />
        </mesh>
        <Text position={[0, 0, 0.03]} fontSize={0.2} color={palette.main} anchorX="center" anchorY="middle" maxWidth={3}>
          {spec.label}
        </Text>
        {room.open && (
          <group rotation-y={Math.PI}>
            <Text position={[0, 0, 0.03]} fontSize={0.2} color={palette.main} anchorX="center" anchorY="middle" maxWidth={3}>
              {spec.label}
            </Text>
          </group>
        )}
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// The lobby
// ---------------------------------------------------------------------------

/** Over the centerpiece: the skill's name, and its concept. Faces the entrance. */
function HallBanner() {
  const { skill, def, plan, palette, accent } = useHouse();
  const [hx, hz] = plan.hero;
  const y = plan.H - 0.95;
  const logo = signatureFor(skill.id, skill.name)?.text ?? skill.name;
  return (
    <group position={[hx, y, hz - 0.6]}>
      <mesh material={flat(palette.ink, 0.6)}>
        <boxGeometry args={[6.2, 1.1, 0.06]} />
      </mesh>
      <mesh position={[0, -0.58, 0]} material={flat(accent, 0.3, 0, accent, 1.6)}>
        <boxGeometry args={[6.2, 0.05, 0.08]} />
      </mesh>
      <Text position={[0, 0.17, 0.04]} fontSize={0.42} color={accent} anchorX="center" anchorY="middle" maxWidth={6}>
        {logo}
      </Text>
      <Text position={[0, -0.27, 0.04]} fontSize={0.13} color={palette.paper} anchorX="center" anchorY="middle" maxWidth={5.8} textAlign="center">
        {def.concept}
      </Text>
    </group>
  );
}

/** The entrance: a welcome rug, plants beside the doors and, where there's room, benches to sit on. */
function Lobby() {
  const { plan, palette, accent, skill } = useHouse();
  const { W, D } = plan;
  const benches = useMemo(() => {
    const z = D / 2 - 1.3;
    const clear = (x: number) => !plan.rooms.some((r) => Math.abs(x - r.x) < r.w / 2 + 1.4 && Math.abs(z - r.z) < r.d / 2 + 1.1);
    return [-(W / 2 - 3), W / 2 - 3].filter((x) => Math.abs(x) > 6 && clear(x));
  }, [plan, W, D]);
  const seats = useMemo<Seat[]>(() => benches.flatMap((x, i) => [-0.5, 0.5].map((dx, k) => ({ id: `lobby-${skill.id}-${i}-${k}`, x: x + dx, y: 0, z: D / 2 - 1.3, facing: Math.PI }))), [benches, D, skill.id]);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.007, D / 2 - 2.2]} material={flat(palette.ink, 0.95)} receiveShadow>
        <planeGeometry args={[3.2, 2.6]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.009, D / 2 - 2.2]} material={flat(accent, 0.8)}>
        <ringGeometry args={[0.9, 0.98, 6]} />
      </mesh>
      {[-1, 1].map((s) => (
        <TallPlant key={s} position={[s * 2.1, 0, D / 2 - 0.6]} seed={s + 9} />
      ))}
      {benches.map((x) => (
        <group key={x} position={[x, 0, D / 2 - 1.3]} rotation-y={Math.PI}>
          <mesh position={[0, 0.44, 0]} material={flat("#7a5536", 0.6)} castShadow>
            <boxGeometry args={[1.8, 0.07, 0.48]} />
          </mesh>
          <mesh position={[0, 0.78, -0.22]} rotation-x={-0.12} material={flat("#7a5536", 0.6)}>
            <boxGeometry args={[1.8, 0.4, 0.05]} />
          </mesh>
          {[-0.8, 0.8].map((dx) => (
            <mesh key={dx} position={[dx, 0.3, -0.05]} material={flat(palette.ink, 0.5, 0.5)}>
              <boxGeometry args={[0.06, 0.6, 0.5]} />
            </mesh>
          ))}
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider args={[0.9, 0.25, 0.26]} position={[0, 0.25, 0]} />
          </RigidBody>
        </group>
      ))}
      <Seats seats={seats} />
    </group>
  );
}

/** Beside the entrance, clear of the rooms. */
function receptionSpot(plan: Plan): [number, number] {
  const z = plan.D / 2 - 2.6;
  const free = (x: number) => !plan.rooms.some((r) => Math.abs(x - r.x) < r.w / 2 + 0.8 && Math.abs(z - r.z) < r.d / 2 + 0.8);
  for (const x of [4.6, -4.6, 3.6, -3.6]) if (free(x)) return [x, z];
  return [3.2, z];
}

/** A reception kiosk by the entrance: the skill's card (level, years) and E for the full panel. */
function Reception() {
  const { skill, plan, palette, accent } = useHouse();
  const at = useMemo(() => receptionSpot(plan), [plan]);
  const where = useMemo(() => new THREE.Vector3(at[0], 0, at[1] - 0.6), [at]);
  useProximity({
    id: `reception-${skill.id}`,
    label: `Read about ${skill.name}`,
    radius: 2,
    where,
    run: () => useCityStore.getState().openPanel({ district: "skills", id: skill.id }),
  });
  const facing = Math.atan2(-at[0], -2) + Math.PI;
  return (
    <group position={[at[0], 0, at[1]]} rotation-y={facing}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.5, 0.6, 0.3]} position={[0, 0.6, 0]} />
      </RigidBody>
      <mesh position={[0, 0.55, 0]} material={flat(palette.ink, 0.4, 0.3)} castShadow>
        <boxGeometry args={[0.9, 1.1, 0.5]} />
      </mesh>
      <mesh position={[0, 1.45, 0.02]} rotation-x={-0.22} material={flat(palette.paper, 0.4, 0, accent, 0.25)}>
        <boxGeometry args={[1.3, 0.85, 0.06]} />
      </mesh>
      <group position={[0, 1.45, 0.06]} rotation-x={-0.22}>
        <Text position={[0, 0.2, 0.01]} fontSize={0.13} color={palette.ink} anchorX="center" anchorY="middle" maxWidth={1.2}>
          {skill.name}
        </Text>
        <Text position={[0, 0.02, 0.01]} fontSize={0.075} color={palette.ink} anchorX="center" anchorY="middle" maxWidth={1.2} textAlign="center">
          {`Level ${skill.level}/10 · ${skill.years} year${skill.years === 1 ? "" : "s"}`}
        </Text>
        <Text position={[0, -0.18, 0.01]} fontSize={0.07} color={accent} anchorX="center" anchorY="middle">
          Press E to read more
        </Text>
      </group>
    </group>
  );
}
