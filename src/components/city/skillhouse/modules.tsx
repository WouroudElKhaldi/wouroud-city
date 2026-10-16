"use client";

import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useCityStore, type Seat } from "@/state/useCityStore";
import type { RoomSpec } from "@/world/skillHouses/houses";
import type { PlanRoom } from "@/world/skillHouses/plan";
import { sfx } from "@/world/sfx";
import { BeanBag, Bookcase, ConferenceChair, ExecChair, FloorLamp, SideChair, Sofa, sofaSeats, Table, TallPlant } from "../Furniture";
import { emitBurst } from "../Particles";
import { box, font, Panel, useCanvas, wrap } from "../roomKit";
import { Seats } from "../StreetDetails";
import { Text } from "../Text3D";
import { useProximity } from "../useProximity";
import { flat } from "./finishKit";
import { Signature } from "./signatures";
import { useHouse } from "./SkillHouse";

/**
 * Shared rooms for the skill houses, dressed with each house's palette and words. Every module is
 * drawn in the room's own frame: the doorway at +z (z = d/2), the back wall at -z, side walls at
 * ±w/2. `toHouse` turns a local point into house (world) coordinates for prompts and seats, and
 * `rot` is how much the room is turned (add it to a local facing to get the world facing).
 */

export type ModuleProps = {
  spec: RoomSpec;
  room: PlanRoom;
  w: number;
  d: number;
  toHouse: (x: number, z: number) => [number, number];
  rot: number;
};

export function RoomModule(props: ModuleProps) {
  switch (props.spec.kind) {
    case "terminal":
      return <CodeBooth {...props} />;
    case "lounge":
      return <Lounge {...props} />;
    case "library":
      return <Library {...props} />;
    case "gallery":
      return <Gallery {...props} />;
    case "workshop":
      return <Workshop {...props} />;
    case "classroom":
      return <Classroom {...props} />;
    case "meeting":
      return <Meeting {...props} />;
    case "lab":
      return <Lab {...props} />;
    case "servers":
      return <Servers {...props} />;
    case "showcase":
      return <Showcase {...props} />;
    case "cafe":
      return <Cafe {...props} />;
    case "garden":
      return <Garden {...props} />;
    case "quiz":
      return <Quiz {...props} />;
    case "signature":
      return <Signature id={props.spec.sig ?? ""} w={props.w} d={props.d} toHouse={props.toHouse} rot={props.rot} label={props.spec.label} />;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const pointer = {
  onPointerOver: () => (document.body.style.cursor = "pointer"),
  onPointerOut: () => (document.body.style.cursor = ""),
};
export const clicked = (e: ThreeEvent<MouseEvent>) => {
  if (e.delta > 6) return false;
  e.stopPropagation();
  return true;
};

/** A world-space point for a local one (for prompts). */
export function useWorldPoint(toHouse: ModuleProps["toHouse"], x: number, z: number) {
  return useMemo(() => {
    const [wx, wz] = toHouse(x, z);
    return new THREE.Vector3(wx, 0, wz);
  }, [toHouse, x, z]);
}

/** A seat at a local point, facing a local direction. */
export function seatAt(id: string, toHouse: ModuleProps["toHouse"], rot: number, x: number, z: number, facing: number): Seat {
  const [wx, wz] = toHouse(x, z);
  return { id, x: wx, y: 0, z: wz, facing: facing + rot };
}

export function burstAt(toHouse: ModuleProps["toHouse"], x: number, y: number, z: number, colors: string[], count = 18) {
  const [wx, wz] = toHouse(x, z);
  emitBurst({ position: new THREE.Vector3(wx, y, wz), kind: "sparkle", count, colors, spread: 0.8 });
}

const toast = (text: string, title?: string) => useCityStore.getState().toast(text, title);

/** A canvas board: kicker, title and lines (the current line highlighted). Faces +z. */
export function WallBoard({
  position,
  rotationY = 0,
  width,
  height,
  kicker,
  title,
  lines,
  current = -1,
  dark = false,
  onClick,
}: {
  position: [number, number, number];
  rotationY?: number;
  width: number;
  height: number;
  kicker?: string;
  title: string;
  lines: string[];
  current?: number;
  dark?: boolean;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const { palette, accent } = useHouse();
  const px = 200;
  const { texture } = useCanvas(
    Math.round(width * px),
    Math.round(height * px),
    (ctx, w, h) => {
      ctx.fillStyle = dark ? palette.ink : palette.paper;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = accent;
      ctx.fillRect(0, 0, w, 12);
      let y = 64;
      if (kicker) {
        ctx.fillStyle = accent;
        ctx.font = font(30, "700");
        ctx.fillText(kicker.toUpperCase(), 36, y);
        y += 54;
      }
      ctx.fillStyle = dark ? palette.paper : palette.ink;
      ctx.font = font(64, "800");
      y = wrap(ctx, title, 36, y + 16, w - 72, 70) + 4;
      ctx.font = font(34);
      lines.forEach((line, i) => {
        if (y > h - 30) return;
        const on = i === current;
        if (on) box(ctx, 24, y - 38, w - 48, 52, 10, accent);
        ctx.fillStyle = on ? (dark ? palette.ink : "#ffffff") : dark ? palette.paper : palette.ink;
        y = wrap(ctx, `• ${line}`, 40, y, w - 80, 44) + 14;
      });
    },
    `${title}|${lines.join("|")}|${current}|${dark}|${accent}`,
  );
  return <Panel position={position} rotationY={rotationY} width={width} height={height} map={texture} frame={palette.ink} onClick={onClick} />;
}

// ---------------------------------------------------------------------------
// Code booth: a wall screen running the skill's code, a desk and a chair
// ---------------------------------------------------------------------------

function CodeBooth({ spec, w, d, toHouse, rot }: ModuleProps) {
  const { theme, palette, accent, skill } = useHouse();
  const lines = spec.notes ?? theme.code;
  const [n, setN] = useState(0);
  const { texture } = useCanvas(
    1024,
    576,
    (ctx, cw, ch) => {
      ctx.fillStyle = "#0b1020";
      ctx.fillRect(0, 0, cw, ch);
      box(ctx, 0, 0, cw, 44, 0, "#141a33");
      ["#ef4444", "#f59e0b", "#22c55e"].forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(28 + i * 26, 22, 8, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = "#94a3b8";
      ctx.font = font(24);
      ctx.fillText(`${skill.name.toLowerCase().replace(/\s+/g, "-")} — zsh`, 120, 30);
      ctx.font = font(30);
      const shown = Array.from({ length: Math.min(6, n + 1) }, (_, i) => lines[(n - i + lines.length * 10) % lines.length]).reverse();
      shown.forEach((l, i) => {
        ctx.fillStyle = i === shown.length - 1 ? accent : "#e2e8f0";
        wrap(ctx, `> ${l}`, 30, 110 + i * 70, cw - 60, 34);
      });
      ctx.fillStyle = "#64748b";
      ctx.font = font(22);
      ctx.fillText("Press E or click the screen to run the next line", 30, ch - 24);
    },
    `${n}|${accent}`,
  );
  const next = () => {
    setN((v) => v + 1);
    sfx.click();
  };
  const where = useWorldPoint(toHouse, 0, -d / 2 + 2.4);
  useProximity({ id: `booth-${spec.label}`, label: `Run the next ${skill.name} line`, radius: 2, where, run: next });
  const seats = useMemo(() => [seatAt(`booth-${spec.label}`, toHouse, rot, 0, -d / 2 + 2.3, Math.PI)], [spec.label, toHouse, rot, d]);
  const sw = Math.min(w - 1.2, 4);
  return (
    <group>
      <Panel position={[0, 2, -d / 2 + 0.13]} width={sw} height={sw * 0.5625} map={texture} frame="#0b0b10" onClick={(e) => clicked(e) && next()} />
      <ExecChair position={[0, 0, -d / 2 + 2.3]} facing={Math.PI} leather="black" />
      <group position={[0, 0, -d / 2 + 1.45]}>
        <mesh position={[0, 0.74, 0]} material={flat(palette.ink, 0.35, 0.2)} castShadow receiveShadow>
          <boxGeometry args={[1.8, 0.05, 0.75]} />
        </mesh>
        {[-0.85, 0.85].map((x) => (
          <mesh key={x} position={[x, 0.36, 0]} material={flat("#1d1d22", 0.5, 0.6)}>
            <boxGeometry args={[0.05, 0.72, 0.7]} />
          </mesh>
        ))}
        <mesh position={[0, 0.78, 0.05]} material={flat("#222", 0.6)}>
          <boxGeometry args={[0.5, 0.02, 0.16]} />
        </mesh>
        <mesh position={[0.45, 0.77, 0.05]} material={flat(accent, 0.4)}>
          <cylinderGeometry args={[0.045, 0.04, 0.1, 14]} />
        </mesh>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.9, 0.38, 0.38]} position={[0, 0.38, 0]} />
        </RigidBody>
      </group>
      {w > 5 && <TallPlant position={[w / 2 - 0.7, 0, -d / 2 + 0.7]} seed={skill.level} />}
      {w > 6 && d > 5 && <BeanBag position={[-w / 2 + 1, 0, d / 2 - 1.6]} color={accent} />}
      <Seats seats={seats} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Lounge: sofas, beanbags, cushions or crates around a low table
// ---------------------------------------------------------------------------

function Lounge({ spec, w, d, toHouse, rot }: ModuleProps) {
  const { palette, accent } = useHouse();
  const look = spec.look ?? "leather";
  const cz = -0.2;
  const seats = useMemo(() => {
    if (look === "leather") {
      const [ax, az] = toHouse(0, cz - 1.3);
      const [bx, bz] = toHouse(0, cz + 1.3);
      return [...sofaSeats(`lounge-${spec.label}-a`, ax, az, rot, 2.2), ...sofaSeats(`lounge-${spec.label}-b`, bx, bz, Math.PI + rot, 2.2)];
    }
    return [];
  }, [look, toHouse, rot, spec.label]);
  const rugMat = flat(palette.second, 1);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.008, cz]} material={rugMat} receiveShadow>
        <planeGeometry args={[Math.min(w - 1, 4.6), Math.min(d - 1.2, 4.4)]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, cz]} material={flat(accent, 0.8)}>
        <ringGeometry args={[Math.min(w - 1, 4.6) * 0.42, Math.min(w - 1, 4.6) * 0.44, 40]} />
      </mesh>
      {look === "leather" && (
        <>
          <Sofa position={[0, 0, cz - 1.3]} facing={0} leather="cognac" />
          <Sofa position={[0, 0, cz + 1.3]} facing={Math.PI} leather="cognac" />
          <Table position={[0, 0, cz]} width={1.1} depth={0.6} height={0.42} top="walnut" />
          {w > 6 && <FloorLamp position={[w / 2 - 0.8, 0, cz - 1.8]} />}
        </>
      )}
      {look === "beanbag" &&
        [
          [-1.1, -0.9],
          [1.1, -0.9],
          [-1.1, 0.9],
          [1.1, 0.9],
        ].map(([x, z], i) => <BeanBag key={i} position={[x, 0, cz + z]} color={[accent, palette.second, palette.main, "#f6c453"][i]} />)}
      {look === "beanbag" && <Table position={[0, 0, cz]} width={0.8} height={0.38} top="marbleWhite" />}
      {look === "cushions" && (
        <>
          {Array.from({ length: 6 }, (_, i) => {
            const a = (i / 6) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 1.3, 0.1, cz + Math.sin(a) * 1.3]} scale={[1, 0.35, 1]} material={flat(i % 2 ? accent : palette.second, 0.95)} castShadow>
                <sphereGeometry args={[0.4, 18, 12]} />
              </mesh>
            );
          })}
          <Table position={[0, 0, cz]} width={0.9} height={0.3} top="walnut" />
        </>
      )}
      {look === "crates" &&
        [
          [-1.2, -0.8],
          [1.2, -0.8],
          [0, 1],
          [-1.4, 0.7],
        ].map(([x, z], i) => (
          <group key={i} position={[x, 0, cz + z]} rotation-y={i * 0.4}>
            <mesh position={[0, 0.25, 0]} material={flat("#b8874f", 0.8)} castShadow>
              <boxGeometry args={[0.55, 0.5, 0.55]} />
            </mesh>
            {[0.13, 0.37].map((y) => (
              <mesh key={y} position={[0, y, 0.28]} material={flat("#8a5f33", 0.8)}>
                <boxGeometry args={[0.56, 0.05, 0.01]} />
              </mesh>
            ))}
          </group>
        ))}
      {look === "crates" && (
        <mesh position={[0, 0.3, cz]} material={flat(palette.main, 0.6)} castShadow>
          <cylinderGeometry args={[0.5, 0.5, 0.6, 20]} />
        </mesh>
      )}
      {w > 5 && <TallPlant position={[-w / 2 + 0.7, 0, -d / 2 + 0.7]} seed={3} />}
      <Seats seats={seats} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Library: bookcases, a reading table and a featured book on a lectern
// ---------------------------------------------------------------------------

function Library({ spec, w, d, toHouse, rot }: ModuleProps) {
  const { palette, accent, theme } = useHouse();
  const notes = spec.notes ?? theme.code;
  const [page, setPage] = useState(0);
  const cases = Math.max(1, Math.floor((w - 0.6) / 1.9));
  const side = Math.max(0, Math.floor((d - 2.6) / 1.9));
  const read = () => {
    const next = (page + 1) % notes.length;
    setPage(next);
    sfx.rustle();
    toast(notes[next], `📖 ${spec.label}`);
  };
  const where = useWorldPoint(toHouse, 0, d / 2 - 1.9);
  useProximity({ id: `library-${spec.label}`, label: "Read the open book", radius: 1.8, where, run: read });
  const seats = useMemo(
    () =>
      d > 5.5
        ? [
            seatAt(`lib-${spec.label}-0`, toHouse, rot, -0.75, -0.2, Math.PI / 2),
            seatAt(`lib-${spec.label}-1`, toHouse, rot, 0.75, -0.2, -Math.PI / 2),
          ]
        : [],
    [d, spec.label, toHouse, rot],
  );
  return (
    <group>
      {Array.from({ length: cases }, (_, i) => (
        <Bookcase key={i} position={[-((cases - 1) * 1.9) / 2 + i * 1.9, 0, -d / 2 + 0.3]} seed={i + 2} />
      ))}
      {[-1, 1].flatMap((s) =>
        Array.from({ length: side }, (_, i) => (
          <Bookcase key={`${s}${i}`} position={[s * (w / 2 - 0.3), 0, -d / 2 + 1.9 + i * 1.9]} rotationY={-s * (Math.PI / 2)} seed={i + 7} />
        )),
      )}
      {d > 5.5 && (
        <>
          <Table position={[0, 0, -0.2]} width={1.0} depth={1.6} top="walnut" />
          <SideChair position={[-0.75, 0, -0.2]} facing={Math.PI / 2} leather="oxblood" />
          <SideChair position={[0.75, 0, -0.2]} facing={-Math.PI / 2} leather="oxblood" />
          <mesh position={[0.2, 0.8, -0.4]} material={flat("#2a6b3a", 0.3, 0.3)}>
            <cylinderGeometry args={[0.12, 0.14, 0.06, 14]} />
          </mesh>
        </>
      )}
      {/* The lectern with the open book */}
      <group position={[0, 0, d / 2 - 1.4]} rotation-y={Math.PI} onClick={(e) => clicked(e) && read()} {...pointer}>
        <mesh position={[0, 0.5, 0]} material={flat("#5a3820", 0.55)} castShadow>
          <boxGeometry args={[0.16, 1, 0.16]} />
        </mesh>
        <group position={[0, 1.05, 0]} rotation-x={-0.35}>
          <mesh material={flat("#4a2e1a", 0.5)}>
            <boxGeometry args={[0.6, 0.05, 0.42]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.14, 0.04, 0]} rotation-z={s * -0.08} material={flat(palette.paper, 0.9)}>
              <boxGeometry args={[0.27, 0.02, 0.36]} />
            </mesh>
          ))}
          <mesh position={[0.02, 0.06, 0.1]} material={flat(accent, 0.5)}>
            <boxGeometry args={[0.02, 0.005, 0.3]} />
          </mesh>
        </group>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.25, 0.55, 0.25]} position={[0, 0.55, 0]} />
        </RigidBody>
      </group>
      <Seats seats={seats} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Gallery: posters on the walls and a bench in the middle
// ---------------------------------------------------------------------------

function Poster({ position, rotationY = 0, title, body, index }: { position: [number, number, number]; rotationY?: number; title: string; body: string; index: number }) {
  const { palette, accent, skill } = useHouse();
  const { texture } = useCanvas(
    600,
    840,
    (ctx, cw, ch) => {
      const bg = [palette.main, palette.ink, palette.second, accent][index % 4];
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, cw, ch);
      // A big graphic: rings, bars or a grid, in the house's colors.
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = index % 2 ? palette.paper : palette.ink;
      ctx.lineWidth = 18;
      if (index % 3 === 0) {
        for (let r = 60; r < 260; r += 50) {
          ctx.beginPath();
          ctx.arc(cw / 2, 330, r, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (index % 3 === 1) {
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = i % 2 ? palette.paper : accent;
          ctx.fillRect(60 + i * 82, 520 - i * 60, 60, 60 + i * 60);
        }
      } else {
        for (let i = 0; i < 5; i++)
          for (let k = 0; k < 5; k++) {
            ctx.fillStyle = (i + k) % 2 ? palette.paper : palette.ink;
            ctx.fillRect(80 + i * 90, 120 + k * 90, 70, 70);
          }
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = index % 2 ? palette.paper : palette.ink === bg ? palette.paper : palette.ink;
      ctx.font = font(52, "800");
      wrap(ctx, title, 40, 660, cw - 80, 56);
      ctx.font = font(26);
      ctx.fillText(skill.name.toUpperCase(), 40, ch - 40);
    },
    `${title}|${index}|${accent}`,
  );
  return (
    <group position={position} rotation-y={rotationY}>
      <Panel position={[0, 0, 0]} width={1.1} height={1.54} map={texture} frame="#1a1a1a" onClick={(e) => clicked(e) && (sfx.pop(), toast(body, title))} />
    </group>
  );
}

function Gallery({ spec, w, d, toHouse, rot }: ModuleProps) {
  const { theme } = useHouse();
  const notes = spec.notes ?? theme.code;
  const back = Math.max(1, Math.min(4, Math.floor((w - 1) / 1.7)));
  const sides = Math.max(0, Math.min(3, Math.floor((d - 2.4) / 1.8)));
  const items: { pos: [number, number, number]; rot: number }[] = [];
  for (let i = 0; i < back; i++) items.push({ pos: [-((back - 1) * 1.7) / 2 + i * 1.7, 1.7, -d / 2 + 0.13], rot: 0 });
  for (const s of [-1, 1]) for (let i = 0; i < sides; i++) items.push({ pos: [s * (w / 2 - 0.13), 1.7, -d / 2 + 1.6 + i * 1.8], rot: -s * (Math.PI / 2) });
  const seats = useMemo(() => (d > 5 ? [seatAt(`gal-${spec.label}`, toHouse, rot, 0, 0.3, Math.PI)] : []), [d, spec.label, toHouse, rot]);
  return (
    <group>
      {items.map((it, i) => (
        <Poster key={i} position={it.pos} rotationY={it.rot} title={notes[i % notes.length]} body={notes[i % notes.length]} index={i} />
      ))}
      {d > 5 && (
        <group position={[0, 0, 0.3]}>
          <mesh position={[0, 0.42, 0]} material={flat("#2b2b30", 0.5, 0.3)} castShadow>
            <boxGeometry args={[1.8, 0.08, 0.5]} />
          </mesh>
          {[-0.75, 0.75].map((x) => (
            <mesh key={x} position={[x, 0.2, 0]} material={flat("#1a1a1e", 0.5, 0.6)}>
              <boxGeometry args={[0.08, 0.4, 0.44]} />
            </mesh>
          ))}
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider args={[0.9, 0.23, 0.25]} position={[0, 0.23, 0]} />
          </RigidBody>
        </group>
      )}
      <Seats seats={seats} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Workshop: a workbench, a pegboard of tools and a stool
// ---------------------------------------------------------------------------

function Workshop({ spec, w, d, toHouse }: ModuleProps) {
  const { palette, accent, theme } = useHouse();
  const notes = spec.notes ?? theme.code;
  const [made, setMade] = useState(0);
  const build = () => {
    setMade((v) => v + 1);
    sfx.clunk();
    burstAt(toHouse, 0, 1.1, -d / 2 + 0.9, [accent, "#ffd27a", "#ffffff"], 22);
    toast(`Built: ${notes[made % notes.length]}`, `🔨 ${spec.label}`);
  };
  const where = useWorldPoint(toHouse, 0, -d / 2 + 2.1);
  useProximity({ id: `workshop-${spec.label}`, label: "Build something at the bench", radius: 1.8, where, run: build });
  const bw = Math.min(w - 1, 3.2);
  return (
    <group>
      {/* Pegboard with tool silhouettes */}
      <group position={[0, 1.75, -d / 2 + 0.12]}>
        <mesh material={flat("#c9a675", 0.85)}>
          <boxGeometry args={[bw, 1.2, 0.03]} />
        </mesh>
        {Array.from({ length: 7 }, (_, i) => (
          <group key={i} position={[-bw / 2 + 0.35 + i * ((bw - 0.7) / 6), 0, 0.03]}>
            <mesh position={[0, 0.15, 0]} material={flat(i % 2 ? accent : palette.ink, 0.5, 0.4)}>
              <boxGeometry args={[0.05, 0.45 + (i % 3) * 0.12, 0.03]} />
            </mesh>
            <mesh position={[0, 0.42, 0]} material={flat("#8b8f96", 0.3, 0.8)}>
              <boxGeometry args={[i % 2 ? 0.2 : 0.08, 0.1, 0.04]} />
            </mesh>
          </group>
        ))}
      </group>
      {/* Bench */}
      <group position={[0, 0, -d / 2 + 0.75]} onClick={(e) => clicked(e) && build()} {...pointer}>
        <mesh position={[0, 0.88, 0]} material={flat("#a0703f", 0.7)} castShadow receiveShadow>
          <boxGeometry args={[bw, 0.08, 0.9]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[(s * (bw - 0.2)) / 2, 0.42, 0]} material={flat("#7a5230", 0.7)}>
            <boxGeometry args={[0.1, 0.84, 0.8]} />
          </mesh>
        ))}
        <mesh position={[0, 0.25, 0]} material={flat("#7a5230", 0.7)}>
          <boxGeometry args={[bw - 0.2, 0.05, 0.8]} />
        </mesh>
        {/* A vise, a mallet and a half-built part in the house color */}
        <mesh position={[bw / 2 - 0.3, 0.98, 0.25]} material={flat("#3a3d44", 0.4, 0.8)}>
          <boxGeometry args={[0.22, 0.12, 0.2]} />
        </mesh>
        <mesh position={[-0.4, 0.95, 0.1]} rotation-z={Math.PI / 2} material={flat("#6b4428", 0.6)}>
          <cylinderGeometry args={[0.025, 0.025, 0.4, 8]} />
        </mesh>
        <mesh position={[-0.2, 0.95, 0.1]} material={flat("#3a3d44", 0.4, 0.6)}>
          <boxGeometry args={[0.1, 0.1, 0.16]} />
        </mesh>
        <mesh position={[0.3, 1.02, -0.1]} material={flat(accent, 0.35, 0.3)} castShadow>
          <boxGeometry args={[0.36, 0.2, 0.36]} />
        </mesh>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[bw / 2, 0.46, 0.45]} position={[0, 0.46, 0]} />
        </RigidBody>
      </group>
      {/* Stool and crates */}
      <mesh position={[0.6, 0.35, -d / 2 + 1.7]} material={flat(palette.ink, 0.5, 0.3)} castShadow>
        <cylinderGeometry args={[0.2, 0.18, 0.7, 14]} />
      </mesh>
      {w > 4.5 &&
        [0, 1].map((i) => (
          <mesh key={i} position={[-w / 2 + 0.6, 0.25 + i * 0.5, d / 2 - 1.4 - i * 0.1]} rotation-y={i * 0.3} material={flat("#b8874f", 0.8)} castShadow>
            <boxGeometry args={[0.6, 0.5, 0.6]} />
          </mesh>
        ))}
      <Text position={[0, 2.5, -d / 2 + 0.15]} fontSize={0.16} color={palette.ink} anchorX="center">
        {`${spec.label} · E to build`}
      </Text>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Classroom: a whiteboard and rows of small desks
// ---------------------------------------------------------------------------

function Classroom({ spec, w, d, toHouse, rot }: ModuleProps) {
  const { theme, palette } = useHouse();
  const notes = spec.notes ?? theme.code;
  const [cur, setCur] = useState(0);
  const next = () => {
    setCur((v) => (v + 1) % notes.length);
    sfx.click();
  };
  const where = useWorldPoint(toHouse, 0, -d / 2 + 1.8);
  useProximity({ id: `class-${spec.label}`, label: "Next point on the board", radius: 1.8, where, run: next });
  const cols = Math.max(1, Math.min(3, Math.floor((w - 1) / 1.7)));
  const rows = Math.max(1, Math.min(3, Math.floor((d - 3.6) / 1.5)));
  const desks: [number, number][] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) desks.push([-((cols - 1) * 1.7) / 2 + c * 1.7, -d / 2 + 3.1 + r * 1.5]);
  const seats = useMemo(() => desks.map(([x, z], i) => seatAt(`class-${spec.label}-${i}`, toHouse, rot, x, z + 0.42, Math.PI)), [desks.length, spec.label, toHouse, rot]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <group>
      <WallBoard position={[0, 1.75, -d / 2 + 0.13]} width={Math.min(w - 1.2, 3.8)} height={1.6} kicker={spec.label} title={theme.tagline} lines={notes} current={cur} onClick={(e) => clicked(e) && next()} />
      {desks.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.72, 0]} material={flat("#d8c3a0", 0.6)} castShadow receiveShadow>
            <boxGeometry args={[1.1, 0.04, 0.55]} />
          </mesh>
          {[-0.5, 0.5].map((dx) => (
            <mesh key={dx} position={[dx, 0.35, 0]} material={flat(palette.ink, 0.5, 0.5)}>
              <boxGeometry args={[0.04, 0.7, 0.5]} />
            </mesh>
          ))}
          <SideChair position={[0, 0, 0.42]} facing={Math.PI} leather="grey" />
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider args={[0.55, 0.37, 0.28]} position={[0, 0.37, 0]} />
          </RigidBody>
        </group>
      ))}
      <Seats seats={seats} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Meeting room: a table, chairs and a screen
// ---------------------------------------------------------------------------

function Meeting({ spec, w, d, toHouse, rot }: ModuleProps) {
  const { theme, palette, accent } = useHouse();
  const notes = spec.notes ?? theme.code;
  const [cur, setCur] = useState(0);
  const next = () => {
    setCur((v) => (v + 1) % notes.length);
    sfx.click();
  };
  const where = useWorldPoint(toHouse, 0, d / 2 - 1.6);
  useProximity({ id: `meeting-${spec.label}`, label: "Next agenda item", radius: 1.8, where, run: next });
  const len = Math.max(1.6, Math.min(3.2, d - 3.4));
  const per = Math.max(1, Math.floor(len / 0.8));
  const chairs: [number, number, number][] = [];
  for (const s of [-1, 1]) for (let i = 0; i < per; i++) chairs.push([s * 0.85, -0.3 - len / 2 + (len / per) * (i + 0.5), s < 0 ? Math.PI / 2 : -Math.PI / 2]);
  const seats = useMemo(() => chairs.map(([x, z, f], i) => seatAt(`meet-${spec.label}-${i}`, toHouse, rot, x, z, f)), [chairs.length, spec.label, toHouse, rot]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <group>
      <WallBoard position={[0, 1.8, -d / 2 + 0.13]} width={Math.min(w - 1.2, 3.4)} height={1.7} kicker="Agenda" title={spec.label} lines={notes} current={cur} dark onClick={(e) => clicked(e) && next()} />
      <group position={[0, 0, -0.3]}>
        <mesh position={[0, 0.74, 0]} material={flat(palette.ink, 0.25, 0.3)} castShadow receiveShadow>
          <boxGeometry args={[1.1, 0.05, len]} />
        </mesh>
        <mesh position={[0, 0.765, 0]} material={flat(accent, 0.4, 0, accent, 0.6)}>
          <boxGeometry args={[0.04, 0.005, len - 0.2]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[0, 0.36, (s * (len - 0.5)) / 2]} material={flat("#1d1d22", 0.4, 0.6)}>
            <boxGeometry args={[0.5, 0.72, 0.1]} />
          </mesh>
        ))}
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.55, 0.38, len / 2]} position={[0, 0.38, 0]} />
        </RigidBody>
      </group>
      {chairs.map(([x, z, f], i) => (
        <ConferenceChair key={i} position={[x, 0, z]} facing={f} color={i % 2 ? accent : palette.second} />
      ))}
      <Seats seats={seats} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Lab: benches with glassware that bubbles
// ---------------------------------------------------------------------------

function Lab({ spec, w, d, toHouse }: ModuleProps) {
  const { palette, accent } = useHouse();
  const liquids = useMemo(() => [accent, palette.second, palette.main, "#5eead4"].map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.5, transparent: true, opacity: 0.75 })), [accent, palette]);
  const glass = useMemo(() => new THREE.MeshStandardMaterial({ color: "#e8f4f8", transparent: true, opacity: 0.25, roughness: 0.05 }), []);
  const mix = () => {
    sfx.sparkle();
    burstAt(toHouse, 0, 1.3, -d / 2 + 0.8, [accent, palette.second, "#ffffff"], 26);
    toast("It bubbles, glows and works on the first try. (It never does.)", `🧪 ${spec.label}`);
  };
  const where = useWorldPoint(toHouse, 0, -d / 2 + 2);
  useProximity({ id: `lab-${spec.label}`, label: "Mix the reagents", radius: 1.8, where, run: mix });
  const bw = Math.min(w - 1, 3.4);
  return (
    <group onClick={(e) => clicked(e) && mix()}>
      <group position={[0, 0, -d / 2 + 0.7]}>
        <mesh position={[0, 0.9, 0]} material={flat("#e9ecef", 0.25, 0.1)} castShadow receiveShadow>
          <boxGeometry args={[bw, 0.06, 0.8]} />
        </mesh>
        <mesh position={[0, 0.45, 0]} material={flat(palette.ink, 0.5, 0.2)}>
          <boxGeometry args={[bw - 0.1, 0.86, 0.74]} />
        </mesh>
        {Array.from({ length: 6 }, (_, i) => (
          <group key={i} position={[-bw / 2 + 0.35 + i * ((bw - 0.7) / 5), 0.93, (i % 2) * 0.2 - 0.1]}>
            <mesh position={[0, 0.12, 0]} material={glass}>
              <cylinderGeometry args={[0.07, i % 2 ? 0.1 : 0.07, 0.26, 14]} />
            </mesh>
            <mesh position={[0, 0.07, 0]} material={liquids[i % liquids.length]}>
              <cylinderGeometry args={[0.065, i % 2 ? 0.092 : 0.065, 0.13, 14]} />
            </mesh>
          </group>
        ))}
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[bw / 2, 0.47, 0.4]} position={[0, 0.47, 0]} />
        </RigidBody>
      </group>
      {w > 5 && <TallPlant position={[w / 2 - 0.7, 0, d / 2 - 1.2]} seed={5} />}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Server room: rows of racks with blinking lights
// ---------------------------------------------------------------------------

function Servers({ spec, w, d, toHouse }: ModuleProps) {
  const { palette, accent } = useHouse();
  const leds = useRef<THREE.MeshStandardMaterial[]>([]);
  const wave = useRef(-10);
  const deploy = () => {
    wave.current = performance.now() / 1000;
    sfx.sparkle();
    toast("Deployed to every rack. All green.", `🚀 ${spec.label}`);
  };
  const where = useWorldPoint(toHouse, 0, d / 2 - 1.5);
  useProximity({ id: `servers-${spec.label}`, label: "Deploy to the racks", radius: 1.8, where, run: deploy });
  const perRow = Math.max(2, Math.floor((w - 1.2) / 0.7));
  const rows = d > 6 ? [-d / 2 + 0.6, -d / 2 + 2.8] : [-d / 2 + 0.6];
  useFrame(() => {
    const t = performance.now() / 1000;
    const age = t - wave.current;
    leds.current.forEach((m, i) => {
      if (!m) return;
      const on = age < 2 ? (i % perRow) / perRow < age / 1.5 : Math.sin(t * 6 + i * 1.7) > 0.3;
      m.emissiveIntensity = on ? 2.2 : 0.2;
      m.emissive.set(age < 2 ? "#22c55e" : i % 5 === 0 ? accent : "#22c55e");
    });
  });
  let n = 0;
  return (
    <group onClick={(e) => clicked(e) && deploy()}>
      {rows.map((z, r) => (
        <group key={z} position={[0, 0, z]} rotation-y={r ? Math.PI : 0}>
          {Array.from({ length: perRow }, (_, i) => (
            <group key={i} position={[-((perRow - 1) * 0.7) / 2 + i * 0.7, 0, 0]}>
              <mesh position={[0, 1, 0]} material={flat("#16181d", 0.4, 0.6)} castShadow>
                <boxGeometry args={[0.62, 2, 0.9]} />
              </mesh>
              {Array.from({ length: 8 }, (_, k) => (
                <group key={k} position={[0, 0.3 + k * 0.21, 0.46]}>
                  <mesh material={flat("#2a2d34", 0.4, 0.6)}>
                    <boxGeometry args={[0.56, 0.16, 0.01]} />
                  </mesh>
                  <mesh position={[0.22, 0, 0.01]}>
                    <boxGeometry args={[0.04, 0.03, 0.01]} />
                    <meshStandardMaterial ref={(m) => void (m && (leds.current[n++] = m))} color="#0a0a0a" emissive="#22c55e" emissiveIntensity={1} toneMapped={false} />
                  </mesh>
                </group>
              ))}
            </group>
          ))}
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider args={[(perRow * 0.7) / 2, 1, 0.45]} position={[0, 1, 0]} />
          </RigidBody>
        </group>
      ))}
      <mesh position={[0, 2.35, rows[0] + 0.2]} material={flat(palette.main, 0.5, 0.4)}>
        <boxGeometry args={[perRow * 0.7, 0.08, 0.3]} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Showcase: plinths for the projects and jobs that use the skill
// ---------------------------------------------------------------------------

function Plinth({ x, z, title, line, onOpen }: { x: number; z: number; title: string; line: string; onOpen: () => void }) {
  const { palette, accent } = useHouse();
  return (
    <group position={[x, 0, z]} onClick={(e) => clicked(e) && onOpen()} {...pointer}>
      <mesh position={[0, 0.55, 0]} material={flat(palette.ink, 0.35, 0.3)} castShadow>
        <boxGeometry args={[0.8, 1.1, 0.8]} />
      </mesh>
      <mesh position={[0, 1.12, 0]} material={flat(accent, 0.3, 0.2, accent, 0.5)}>
        <boxGeometry args={[0.84, 0.04, 0.84]} />
      </mesh>
      <mesh position={[0, 1.45, 0]} rotation-y={0.6} material={flat(accent, 0.25, 0.6)} castShadow>
        <octahedronGeometry args={[0.24, 0]} />
      </mesh>
      <Text position={[0, 0.72, 0.41]} fontSize={0.1} color={palette.paper} anchorX="center" anchorY="middle" maxWidth={0.72} textAlign="center">
        {title}
      </Text>
      <Text position={[0, 0.45, 0.41]} fontSize={0.06} color={accent} anchorX="center" anchorY="middle" maxWidth={0.72} textAlign="center">
        {line}
      </Text>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.4, 0.55, 0.4]} position={[0, 0.55, 0]} />
      </RigidBody>
    </group>
  );
}

function Showcase({ spec, w, d, toHouse }: ModuleProps) {
  const { uses, skill } = useHouse();
  const items = useMemo(
    () => [
      ...uses.projects.map((p) => ({ title: p.name, line: "Project · click to open", panel: { district: "projects" as const, id: p.id } })),
      ...uses.jobs.map((j) => ({ title: j.name, line: "Job · click to open", panel: { district: "business" as const, id: j.id } })),
    ].slice(0, 6),
    [uses],
  );
  const open = (i: number) => {
    sfx.pop();
    useCityStore.getState().openPanel(items[i].panel);
  };
  const where = useWorldPoint(toHouse, 0, d / 2 - 1.6);
  useProximity({
    id: `showcase-${spec.label}`,
    label: items.length ? `See where ${skill.name} is used` : `Learning ${skill.name}`,
    radius: 1.8,
    where,
    run: () => (items.length ? open(0) : toast(`${skill.name}: level ${skill.level}/10, still growing.`, spec.label)),
  });
  const cols = Math.max(1, Math.min(3, Math.floor((w - 0.8) / 1.6)));
  if (!items.length)
    return <Plinth x={0} z={-0.5} title={`${skill.name}`} line={`Level ${skill.level}/10 · in progress`} onOpen={() => toast(`${skill.name}: level ${skill.level}/10, still growing.`, spec.label)} />;
  return (
    <group>
      {items.map((it, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const inRow = Math.min(cols, items.length - row * cols);
        return <Plinth key={it.title} x={-((inRow - 1) * 1.6) / 2 + col * 1.6} z={-d / 2 + 1.3 + row * 1.8} title={it.title} line={it.line} onOpen={() => open(i)} />;
      })}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Café: a counter with an espresso machine, two bistro tables
// ---------------------------------------------------------------------------

function Cafe({ spec, w, d, toHouse, rot }: ModuleProps) {
  const { palette, accent, skill } = useHouse();
  const order = () => {
    sfx.pop();
    burstAt(toHouse, 0.4, 1.4, -d / 2 + 0.6, ["#ffffff", "#e8e1d8"], 14);
    toast(`One ${skill.name} latte, extra foam. ☕`, spec.label);
  };
  const where = useWorldPoint(toHouse, 0, -d / 2 + 1.9);
  useProximity({ id: `cafe-${spec.label}`, label: "Order a coffee", radius: 1.8, where, run: order });
  const tables: [number, number][] = w > 5 ? [[-w / 4, d / 2 - 1.9], [w / 4, d / 2 - 1.9]] : [[0, d / 2 - 1.9]];
  const seats = useMemo(() => tables.flatMap(([x, z], i) => [seatAt(`cafe-${spec.label}-${i}a`, toHouse, rot, x - 0.55, z, Math.PI / 2), seatAt(`cafe-${spec.label}-${i}b`, toHouse, rot, x + 0.55, z, -Math.PI / 2)]), [tables.length, spec.label, toHouse, rot]); // eslint-disable-line react-hooks/exhaustive-deps
  const cw = Math.min(w - 1, 3);
  return (
    <group>
      <group position={[0, 0, -d / 2 + 0.6]} onClick={(e) => clicked(e) && order()} {...pointer}>
        <mesh position={[0, 0.5, 0]} material={flat(palette.ink, 0.4, 0.2)} castShadow>
          <boxGeometry args={[cw, 1, 0.7]} />
        </mesh>
        <mesh position={[0, 1.02, 0]} material={flat("#efe9e1", 0.2, 0.1)}>
          <boxGeometry args={[cw + 0.06, 0.04, 0.76]} />
        </mesh>
        <mesh position={[0.4, 1.25, -0.05]} material={flat("#c0c4ca", 0.2, 0.9)} castShadow>
          <boxGeometry args={[0.5, 0.42, 0.4]} />
        </mesh>
        <mesh position={[0.4, 1.5, -0.05]} material={flat(accent, 0.4, 0.4)}>
          <boxGeometry args={[0.52, 0.06, 0.42]} />
        </mesh>
        {[-0.4, -0.2].map((x) => (
          <mesh key={x} position={[x, 1.09, 0.1]} material={flat("#ffffff", 0.4)}>
            <cylinderGeometry args={[0.045, 0.035, 0.09, 12]} />
          </mesh>
        ))}
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[cw / 2, 0.52, 0.38]} position={[0, 0.52, 0]} />
        </RigidBody>
      </group>
      <Text position={[0, 2.3, -d / 2 + 0.14]} fontSize={0.3} color={accent} anchorX="center">
        {spec.label}
      </Text>
      <Text position={[0, 1.95, -d / 2 + 0.14]} fontSize={0.13} color={palette.ink} anchorX="center">
        {`Espresso · Latte · ${skill.name} special`}
      </Text>
      {tables.map(([x, z], i) => (
        <group key={i}>
          <Table position={[x, 0, z]} width={0.7} top="marbleWhite" />
          <SideChair position={[x - 0.55, 0, z]} facing={Math.PI / 2} leather="cream" />
          <SideChair position={[x + 0.55, 0, z]} facing={-Math.PI / 2} leather="cream" />
        </group>
      ))}
      <Seats seats={seats} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Garden: planters, a little pond and stones with the skill's sayings
// ---------------------------------------------------------------------------

function Garden({ spec, w, d, toHouse, rot }: ModuleProps) {
  const { palette, accent, theme } = useHouse();
  const notes = spec.notes ?? [theme.tagline];
  const [cur, setCur] = useState(-1);
  const read = () => {
    const next = (cur + 1) % notes.length;
    setCur(next);
    sfx.chirp();
    toast(notes[next], `🪨 ${spec.label}`);
  };
  const where = useWorldPoint(toHouse, 0, 0.6);
  useProximity({ id: `garden-${spec.label}`, label: "Read the stones", radius: 2, where, run: read });
  const stones = notes.slice(0, 4);
  const seats = useMemo(() => [seatAt(`garden-${spec.label}`, toHouse, rot, 0, d / 2 - 1.2, Math.PI)], [spec.label, toHouse, rot, d]);
  const water = useMemo(() => new THREE.MeshStandardMaterial({ color: "#3b7fa3", roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.85 }), []);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, -0.3]} material={flat("#6a8a4a", 1)} receiveShadow>
        <circleGeometry args={[Math.min(w, d) / 2 - 0.5, 40]} />
      </mesh>
      <mesh position={[0, 0.08, -0.6]} material={flat("#8e8a82", 0.9)}>
        <cylinderGeometry args={[1.05, 1.15, 0.16, 32]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.15, -0.6]} material={water}>
        <circleGeometry args={[0.95, 32]} />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.05, 0.1, 1.05]} position={[0, 0.08, -0.6]} />
      </RigidBody>
      {stones.map((_, i) => {
        const a = -Math.PI * 0.85 + (i / Math.max(1, stones.length - 1)) * Math.PI * 0.7;
        const r = Math.min(w, d) / 2 - 1.1;
        return (
          <group key={i} position={[Math.cos(a) * r, 0, -0.6 + Math.sin(a) * r * 0.8]} rotation-y={-a - Math.PI / 2}>
            <mesh position={[0, 0.3, 0]} scale={[1, 0.8, 0.5]} material={flat(i === cur ? accent : "#b9b3a8", 0.9)} castShadow>
              <dodecahedronGeometry args={[0.38, 0]} />
            </mesh>
          </group>
        );
      })}
      {[-1, 1].map((s) => (
        <TallPlant key={s} position={[s * (w / 2 - 0.7), 0, -d / 2 + 0.8]} seed={s + 4} />
      ))}
      <group position={[0, 0, d / 2 - 1.2]} rotation-y={Math.PI}>
        <mesh position={[0, 0.42, 0]} material={flat("#8a5a34", 0.6)} castShadow>
          <boxGeometry args={[1.6, 0.06, 0.45]} />
        </mesh>
        {[-0.65, 0.65].map((x) => (
          <mesh key={x} position={[x, 0.2, 0]} material={flat(palette.ink, 0.6, 0.4)}>
            <boxGeometry args={[0.08, 0.4, 0.4]} />
          </mesh>
        ))}
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.8, 0.23, 0.22]} position={[0, 0.23, 0]} />
        </RigidBody>
      </group>
      <Seats seats={seats} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Quiz: a kiosk with three questions about the skill
// ---------------------------------------------------------------------------

/** The quiz screen's canvas height and where its answer rows are drawn (px). */
const QUIZ_H = 720;
const ANSWER_TOP = 330;
const ANSWER_STEP = 112;

function Quiz({ d, toHouse }: ModuleProps) {
  const { def, palette, accent, skill } = useHouse();
  const quiz = def.quiz;
  const [q, setQ] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const cur = quiz[q % quiz.length];
  const { texture } = useCanvas(
    1024,
    QUIZ_H,
    (ctx, cw, ch) => {
      ctx.fillStyle = palette.ink;
      ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = accent;
      ctx.fillRect(0, 0, cw, 14);
      ctx.font = font(30, "700");
      ctx.fillText(`${skill.name.toUpperCase()} QUIZ · ${(q % quiz.length) + 1}/${quiz.length} · SCORE ${score}`, 40, 70);
      ctx.fillStyle = palette.paper;
      ctx.font = font(46, "800");
      wrap(ctx, cur.q, 40, 150, cw - 80, 54);
      cur.a.forEach((a, i) => {
        const top = ANSWER_TOP + i * ANSWER_STEP;
        const right = picked !== null && i === cur.ok;
        const wrong = picked === i && i !== cur.ok;
        box(ctx, 40, top, cw - 80, 92, 18, right ? "#16a34a" : wrong ? "#dc2626" : "rgba(255,255,255,0.08)", accent, 3);
        ctx.fillStyle = palette.paper;
        ctx.font = font(40, "600");
        ctx.fillText(`${"ABC"[i]}.  ${a}`, 70, top + 60);
      });
      ctx.fillStyle = "#9aa0b4";
      ctx.font = font(24);
      ctx.fillText(picked === null ? "Click an answer" : "Press E or click the screen for the next question", 40, ch - 26);
    },
    `${q}|${picked}|${score}|${accent}`,
  );
  const choose = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    if (i === cur.ok) {
      setScore((s) => s + 1);
      sfx.coin();
      burstAt(toHouse, 0, 2.2, -d / 2 + 0.4, [accent, "#ffffff", "#fde047"], 24);
    } else sfx.clunk();
  };
  const next = () => {
    setPicked(null);
    setQ((v) => v + 1);
    sfx.click();
  };
  const where = useWorldPoint(toHouse, 0, -d / 2 + 2);
  useProximity({
    id: `quiz-${skill.id}`,
    label: picked === null ? "Answer the quiz (click A, B or C)" : "Next question",
    radius: 2,
    where,
    run: () => (picked === null ? toast("Click one of the answers on the screen.", `${skill.name} quiz`) : next()),
  });
  const W = 2.6;
  const H = (W * QUIZ_H) / 1024;
  const lines = cur.a.length;
  return (
    <group position={[0, 0, -d / 2 + 0.6]}>
      {/* The kiosk: a stand and a big screen; the answer rows are clickable */}
      <mesh position={[0, 0.5, -0.15]} material={flat(palette.ink, 0.4, 0.4)} castShadow>
        <boxGeometry args={[0.5, 1, 0.3]} />
      </mesh>
      <group position={[0, 1.9, 0]} rotation-x={-0.08}>
        <Panel position={[0, 0, 0]} width={W} height={H} map={texture} frame={accent} onClick={(e) => clicked(e) && picked !== null && next()} />
        {Array.from({ length: lines }, (_, i) => {
          // Over the row the canvas drew for this answer.
          const center = ANSWER_TOP + i * ANSWER_STEP + 46;
          const y = H / 2 - (center / QUIZ_H) * H;
          return (
            <mesh key={i} position={[0, y, 0.01]} visible={false} onClick={(e) => clicked(e) && choose(i)} {...pointer}>
              <planeGeometry args={[W - 0.2, (92 / QUIZ_H) * H]} />
            </mesh>
          );
        })}
      </group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.3, 0.5, 0.2]} position={[0, 0.5, -0.15]} />
      </RigidBody>
    </group>
  );
}
