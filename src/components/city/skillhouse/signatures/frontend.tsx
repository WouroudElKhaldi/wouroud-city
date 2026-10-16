"use client";

import { RoundedBox } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useCityStore } from "@/state/useCityStore";
import { sfx } from "@/world/sfx";
import { FloorLamp, Rug, SideChair, Sofa, TallPlant } from "../../Furniture";
import { box, font, Panel, useCanvas, wrap } from "../../roomKit";
import { Seats } from "../../StreetDetails";
import { Text } from "../../Text3D";
import { useProximity } from "../../useProximity";
import { flat } from "../finishKit";
import { burstAt, clicked, pointer, seatAt, useWorldPoint } from "../modules";
import { useHouse } from "../SkillHouse";
import type { SigComponent, SigProps } from "./types";

/**
 * Signature pieces for the frontend skills: React, Next.js, Vue, Angular, shadcn/ui, MUI, daisyUI
 * and React Native.
 */

const toast = (text: string, title?: string) => useCityStore.getState().toast(text, title);
const clock = () => performance.now() / 1000;
/** The scale that fits a hero of fw × fd meters into the w × d it may use (never bigger than 1). */
const fit = (w: number, d: number, fw: number, fd: number) => Math.min(1, w / fw, d / fd);
const MONO = (px: number, weight = "500") => `${weight} ${Math.round(px)}px ui-monospace, Menlo, Consolas, monospace`;

/** A material of its own (so it can glow and fade without touching the shared cache). */
function glowMaterial(color: string, emissive: string, intensity: number, roughness = 0.35) {
  return new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: intensity, roughness, toneMapped: false });
}

/** Disposes materials made by a piece when it unmounts. */
function useDispose(mats: THREE.Material[]) {
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
}

/** A code board: a title and monospace lines (the current one highlighted). Faces +z. */
function CodeBoard({
  position,
  width,
  height,
  title,
  lines,
  current = -1,
  dark = true,
}: {
  position: [number, number, number];
  width: number;
  height: number;
  title: string;
  lines: string[];
  current?: number;
  dark?: boolean;
}) {
  const { palette, accent } = useHouse();
  const { texture } = useCanvas(
    Math.round(width * 200),
    Math.round(height * 200),
    (ctx, cw, ch) => {
      ctx.fillStyle = dark ? "#0d1117" : "#fbfbf8";
      ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = accent;
      ctx.fillRect(0, 0, cw, 10);
      ctx.fillStyle = dark ? "#ffffff" : palette.ink;
      ctx.font = font(48, "800");
      ctx.fillText(title, 32, 72);
      const lh = Math.min(52, (ch - 130) / Math.max(1, lines.length));
      ctx.font = MONO(Math.min(34, lh * 0.7));
      lines.forEach((line, i) => {
        const y = 130 + i * lh;
        if (i === current) box(ctx, 18, y - lh * 0.72, cw - 36, lh, 8, accent);
        ctx.fillStyle = i === current ? "#ffffff" : dark ? "#d1d9e0" : "#24292f";
        ctx.fillText(line, 34, y);
      });
    },
    `${title}|${lines.join("\n")}|${current}|${dark}|${accent}`,
  );
  return <Panel position={position} width={width} height={height} map={texture} frame={palette.ink} />;
}

// ---------------------------------------------------------------------------
// React · The Atom (hero)
// ---------------------------------------------------------------------------

const REACT = "#61dafb";
const ELECTRONS = ["<App />", "<City />", "<Hud />"];
const ORBIT_R = 1.75;
const ORBIT_r = 0.62;

/**
 * A giant glowing React atom over a dark round base: a nucleus and three tilted elliptical orbits,
 * with components riding them as electrons. E calls setState(): the atom re-renders with a pulse of
 * light, the electrons race for a moment and the render counter ticks up.
 */
function ReactAtom({ w, d, toHouse }: SigProps) {
  const { palette } = useHouse();
  const s = fit(w, d, 4.6, 4.6);
  const [renders, setRenders] = useState(1);
  const pulseAt = useRef(-10);
  const phase = useRef(0);
  const atom = useRef<THREE.Group>(null);
  const electrons = useRef<(THREE.Group | null)[]>([]);
  const core = useMemo(() => glowMaterial(REACT, REACT, 1.2, 0.25), []);
  const orbit = useMemo(() => glowMaterial(REACT, REACT, 0.9, 0.3), []);
  useDispose(useMemo(() => [core, orbit], [core, orbit]));

  const rerender = () => {
    pulseAt.current = clock();
    setRenders((n) => n + 1);
    sfx.sparkle();
    burstAt(toHouse, 0, 2.5 * s, 0, [REACT, "#ffffff"], 20);
    toast(
      `setState() queued an update, so React called the component again (render #${renders + 1}), compared the new JSX with the last one and changed only what differs in the DOM.`,
      "⚛️ Re-render",
    );
  };
  const pz = Math.min(d / 2 - 0.3, 1.6 * s + 0.9);
  const where = useWorldPoint(toHouse, 0, pz);
  useProximity({ id: "react-atom", label: "setState()", radius: 2.2, where, run: rerender });

  useFrame((_, dt) => {
    const t = clock();
    const k = Math.max(0, 1 - (t - pulseAt.current) / 1.4);
    core.emissiveIntensity = 1.2 + 4 * k;
    orbit.emissiveIntensity = 0.9 + 2.5 * k;
    phase.current += dt * (0.9 + 5 * k);
    if (atom.current) {
      atom.current.rotation.y = Math.sin(t * 0.35) * 0.45;
      atom.current.scale.setScalar(1 + 0.08 * k);
    }
    electrons.current.forEach((e, i) => {
      if (!e) return;
      const a = phase.current * (1 + i * 0.15) + i * 2.1;
      e.position.set(Math.cos(a) * ORBIT_R, Math.sin(a) * ORBIT_r, 0);
    });
  });

  const electron = flat("#e9fbff", 0.3, 0, REACT, 0.6);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.55 * s, 0.6, 1.55 * s]} position={[0, 0.6, 0]} />
      </RigidBody>
      <group scale={s} onClick={(e) => clicked(e) && rerender()} {...pointer}>
        {/* The base: a dark drum with a glowing rim and a slim mast holding the atom */}
        <mesh position={[0, 0.15, 0]} material={flat(palette.second, 0.35, 0.4)} castShadow receiveShadow>
          <cylinderGeometry args={[1.5, 1.6, 0.3, 48]} />
        </mesh>
        <mesh position={[0, 0.31, 0]} rotation-x={-Math.PI / 2} material={orbit}>
          <ringGeometry args={[1.38, 1.46, 64]} />
        </mesh>
        <mesh position={[0, 0.34, 0]} material={flat("#0b0d10", 0.4, 0.5)}>
          <cylinderGeometry args={[0.45, 0.55, 0.08, 32]} />
        </mesh>
        <mesh position={[0, 1.2, 0]} material={flat("#3a3f4a", 0.25, 0.85)}>
          <cylinderGeometry args={[0.04, 0.06, 1.7, 12]} />
        </mesh>
        <Text position={[0, 0.15, 1.6]} fontSize={0.15} color={REACT} anchorX="center" anchorY="middle">
          {`renders: ${renders}`}
        </Text>
        {/* The atom */}
        <group ref={atom} position={[0, 2.5, 0]}>
          <mesh material={core}>
            <sphereGeometry args={[0.42, 32, 24]} />
          </mesh>
          {[0, 1, 2].map((i) => {
            const tilt = (i * Math.PI) / 3;
            return (
              <group key={i} rotation-z={tilt}>
                <mesh scale={[1, ORBIT_r / ORBIT_R, 1]} material={orbit}>
                  <torusGeometry args={[ORBIT_R, 0.04, 8, 96]} />
                </mesh>
                <group ref={(g) => void (electrons.current[i] = g)} position={[ORBIT_R, 0, 0]}>
                  <mesh material={electron}>
                    <sphereGeometry args={[0.17, 20, 14]} />
                  </mesh>
                  <group rotation-z={-tilt}>
                    <Text position={[0, 0.32, 0]} fontSize={0.16} color="#e9fbff" anchorX="center" anchorY="middle" outlineWidth={0.012} outlineColor="#0b0d10">
                      {ELECTRONS[i]}
                    </Text>
                  </group>
                </group>
              </group>
            );
          })}
        </group>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// React · Hooks Wardrobe (room)
// ---------------------------------------------------------------------------

const HOOKS = [
  { name: "useState", text: "const [count, setCount] = useState(0). Calling setCount(1) stores the new value and re-renders the component with it." },
  { name: "useEffect", text: "useEffect(() => { const id = setInterval(tick, 1000); return () => clearInterval(id); }, []). Runs after render; the returned function cleans up." },
  { name: "useMemo", text: "const sorted = useMemo(() => sortBy(items, 'name'), [items]). The result is cached and only recomputed when items changes." },
  { name: "useRef", text: "const inputRef = useRef(null); <input ref={inputRef} />. ref.current survives re-renders, and changing it doesn't cause one." },
  { name: "useContext", text: "const theme = useContext(ThemeContext). Reads the value of the nearest provider above, no prop drilling needed." },
  { name: "useCallback", text: "const onSave = useCallback(() => save(id), [id]). Keeps the same function between renders until id changes." },
];

/**
 * A walnut coat wall with brass hooks, one per hook of React, each holding a coat or a bag. Click a
 * coat (or press E to go through them): it swings on its hook and a toast explains that hook with a
 * tiny example.
 */
function HooksWardrobe({ w, d, toHouse, rot, label }: SigProps) {
  const { palette, accent } = useHouse();
  const [sel, setSel] = useState(-1);
  const swingAt = useRef(-10);
  const coats = useRef<(THREE.Group | null)[]>([]);
  const rack = Math.min(w - 1.4, 6.2);
  const gap = rack / HOOKS.length;
  const z0 = -d / 2 + 0.12;
  const colors = [accent, palette.paper, "#f0a35e", "#3a4150", "#8b7cf6", "#34d399"];

  const pick = (i: number) => {
    setSel(i);
    swingAt.current = clock();
    sfx.rustle();
    toast(HOOKS[i].text, `🪝 ${HOOKS[i].name}`);
  };
  const next = (sel + 1) % HOOKS.length;
  const where = useWorldPoint(toHouse, 0, z0 + 1.7);
  useProximity({ id: "react-hooks", label: `Try ${HOOKS[next].name}`, radius: 2, where, run: () => pick(next) });

  useFrame(() => {
    const t = clock() - swingAt.current;
    coats.current.forEach((c, i) => {
      if (c) c.rotation.z = i === sel ? Math.sin(t * 7) * 0.35 * Math.exp(-t * 1.4) : 0;
    });
  });

  const benchW = Math.min(rack * 0.5, 2);
  const benchZ = z0 + 0.95;
  const seats = useMemo(
    () => [seatAt("react-hooks-bench-a", toHouse, rot, -benchW / 4, benchZ, 0), seatAt("react-hooks-bench-b", toHouse, rot, benchW / 4, benchZ, 0)],
    [toHouse, rot, benchW, benchZ],
  );
  const wood = flat("#5a3b28", 0.6);
  const brass = flat("#c9a45a", 0.3, 0.85);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[rack / 2 + 0.2, 1.2, 0.25]} position={[0, 1.2, z0 + 0.25]} />
        <CuboidCollider args={[benchW / 2, 0.25, 0.2]} position={[0, 0.25, benchZ]} />
      </RigidBody>
      {/* The wardrobe wall: a walnut panel, a top shelf and a row of brass hooks */}
      <mesh position={[0, 1.25, z0 + 0.02]} material={wood} castShadow receiveShadow>
        <boxGeometry args={[rack + 0.4, 2.5, 0.04]} />
      </mesh>
      <mesh position={[0, 2.12, z0 + 0.2]} material={wood} castShadow>
        <boxGeometry args={[rack + 0.4, 0.05, 0.38]} />
      </mesh>
      <mesh position={[0, 1.78, z0 + 0.05]} material={brass}>
        <boxGeometry args={[rack, 0.05, 0.03]} />
      </mesh>
      <Text position={[0, 2.32, z0 + 0.05]} fontSize={0.16} color={accent} anchorX="center" anchorY="middle">
        {label}
      </Text>
      {HOOKS.map((h, i) => {
        const x = -rack / 2 + gap * (i + 0.5);
        const bag = i === 1 || i === 4;
        return (
          <group key={h.name} position={[x, 0, 0]}>
            <mesh position={[0, 1.78, z0 + 0.09]} rotation-x={Math.PI / 2} material={brass}>
              <cylinderGeometry args={[0.012, 0.012, 0.12, 8]} />
            </mesh>
            <mesh position={[0, 1.8, z0 + 0.15]} rotation-y={Math.PI / 2} material={brass}>
              <torusGeometry args={[0.035, 0.011, 6, 12, Math.PI]} />
            </mesh>
            <Text position={[0, 1.96, z0 + 0.05]} fontSize={0.1} color={i === sel ? accent : palette.paper} anchorX="center" anchorY="middle">
              {h.name}
            </Text>
            {/* The coat (or bag) pivots on its hook */}
            <group ref={(g) => void (coats.current[i] = g)} position={[0, 1.78, z0 + 0.2]} onClick={(e) => clicked(e) && pick(i)} {...pointer}>
              {bag ? (
                <>
                  {[-1, 1].map((sx) => (
                    <mesh key={sx} position={[sx * 0.09, -0.2, 0]} rotation-z={sx * 0.4} material={flat("#3b2a1e", 0.7)}>
                      <boxGeometry args={[0.025, 0.42, 0.015]} />
                    </mesh>
                  ))}
                  <mesh position={[0, -0.55, 0]} material={flat(colors[i], 0.7)} castShadow>
                    <boxGeometry args={[0.42, 0.34, 0.15]} />
                  </mesh>
                  <mesh position={[0, -0.45, 0.077]} material={flat("#3b2a1e", 0.6)}>
                    <boxGeometry args={[0.42, 0.12, 0.01]} />
                  </mesh>
                  <mesh position={[0, -0.5, 0.085]} material={brass}>
                    <boxGeometry args={[0.05, 0.04, 0.01]} />
                  </mesh>
                </>
              ) : (
                <>
                  <mesh position={[0, -0.06, 0]} material={wood}>
                    <boxGeometry args={[0.44, 0.03, 0.03]} />
                  </mesh>
                  <mesh position={[0, -0.13, 0]} material={flat(colors[i], 0.85)} castShadow>
                    <boxGeometry args={[0.5, 0.1, 0.16]} />
                  </mesh>
                  <mesh position={[0, -0.6, 0]} material={flat(colors[i], 0.85)} castShadow>
                    <cylinderGeometry args={[0.22, 0.28, 0.88, 4, 1]} />
                  </mesh>
                  {[-1, 1].map((sx) => (
                    <mesh key={sx} position={[sx * 0.29, -0.5, 0]} rotation-z={sx * 0.08} material={flat(colors[i], 0.85)} castShadow>
                      <boxGeometry args={[0.1, 0.74, 0.13]} />
                    </mesh>
                  ))}
                  <mesh position={[0, -0.12, 0.08]} rotation-x={0.3} material={flat("#20232a", 0.8)}>
                    <boxGeometry args={[0.18, 0.12, 0.02]} />
                  </mesh>
                  {[0.35, 0.55, 0.75].map((y) => (
                    <mesh key={y} position={[0, -y, 0.15]} material={brass}>
                      <sphereGeometry args={[0.018, 8, 6]} />
                    </mesh>
                  ))}
                </>
              )}
            </group>
          </group>
        );
      })}
      {/* A bench to sit on while you get dressed */}
      <mesh position={[0, 0.44, benchZ]} material={wood} castShadow>
        <boxGeometry args={[benchW, 0.06, 0.38]} />
      </mesh>
      <mesh position={[0, 0.47, benchZ]} material={flat(accent, 0.9)}>
        <boxGeometry args={[benchW - 0.06, 0.04, 0.34]} />
      </mesh>
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * (benchW / 2 - 0.08), 0.21, benchZ]} material={wood}>
          <boxGeometry args={[0.06, 0.42, 0.34]} />
        </mesh>
      ))}
      <Rug position={[0, z0 + 2]} width={Math.min(rack * 0.7, 3.4)} depth={1.6} color="#20232a" border={accent} />
      <FloorLamp position={[-w / 2 + 0.45, 0, z0 + 0.5]} />
      <Seats seats={seats} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Next.js · The Route Gallery (hero)
// ---------------------------------------------------------------------------

const NR_H = 0.25;
const NR_FRAMES = [-2.4, -0.8, 0.8, 2.4];
const NR_BEAM = NR_H + 3.0;
const ROUTES = [
  {
    path: "/",
    file: "app/page.tsx",
    req: "GET / → 200 · static",
    text: "app/page.tsx is the / route. It's a Server Component with no request data, so Next prerendered it to static HTML at build time.",
  },
  {
    path: "/about",
    file: "app/about/page.tsx",
    req: "GET /about → 200 · static",
    text: "Folders are routes: app/about/page.tsx serves /about. The shared app/layout.tsx stayed mounted; only the page segment changed.",
  },
  {
    path: "/blog/[slug]",
    file: "app/blog/[slug]/page.tsx",
    req: "GET /blog/hello → 200 · prerendered",
    text: "[slug] is a dynamic segment. generateStaticParams() returned { slug: 'hello' }, so /blog/hello was prerendered at build time.",
  },
  {
    path: "/api/hello",
    file: "app/api/hello/route.ts",
    req: "GET /api/hello → 200 · route handler",
    text: "app/api/hello/route.ts exports GET(request). A Route Handler returns a Response, like Response.json({ hello: 'world' }), and no layout wraps it.",
  },
];
/** Where the light pulse travels: from the layout beam down into a page, or along the floor to the API. */
const NR_PATHS = NR_FRAMES.map((x, i) =>
  i < 3
    ? [new THREE.Vector3(-0.8, NR_BEAM, 0), new THREE.Vector3(x, NR_BEAM, 0), new THREE.Vector3(x, NR_H + 2.6, 0), new THREE.Vector3(x, NR_H + 1.3, 0)]
    : [new THREE.Vector3(0, NR_H + 0.05, 0.7), new THREE.Vector3(x, NR_H + 0.05, 0.7), new THREE.Vector3(x, NR_H + 0.05, 0), new THREE.Vector3(x, NR_H + 1.3, 0)],
);

/** Puts `out` at fraction k (0..1) along a polyline. */
function alongPath(out: THREE.Vector3, pts: THREE.Vector3[], k: number) {
  const seg = Math.min(pts.length - 2, Math.floor(k * (pts.length - 1)));
  const f = k * (pts.length - 1) - seg;
  out.lerpVectors(pts[seg], pts[seg + 1], Math.min(1, f));
}

/**
 * A black and white route-tree sculpture: four tall black door frames on a white plinth, one per
 * route, the three pages hung from a thin white layout beam (the API route stands on its own). E
 * navigates: a light pulse runs from the layout into the next page and a screen shows the response.
 */
function NextRoutes({ w, d, toHouse }: SigProps) {
  const s = fit(w, d, 6.8, 4.4);
  const [idx, setIdx] = useState(-1);
  const navAt = useRef(-10);
  const pulse = useRef<THREE.Mesh>(null);
  const doors = useMemo(() => NR_FRAMES.map(() => glowMaterial("#111111", "#ffffff", 0)), []);
  useDispose(doors);

  const navigate = () => {
    const n = (idx + 1) % ROUTES.length;
    setIdx(n);
    navAt.current = clock();
    sfx.click();
    toast(ROUTES[n].text, `▲ ${ROUTES[n].path}`);
  };
  const pz = Math.min(d / 2 - 0.3, 2.2 * s + 0.7);
  const where = useWorldPoint(toHouse, 0, pz);
  useProximity({ id: "next-routes", label: `Navigate to ${ROUTES[(idx + 1) % ROUTES.length].path}`, radius: 2.2, where, run: navigate });

  useFrame(() => {
    const e = clock() - navAt.current;
    if (pulse.current) {
      pulse.current.visible = idx >= 0 && e < 1.1;
      if (pulse.current.visible) alongPath(pulse.current.position, NR_PATHS[idx], Math.min(1, e / 1.1));
    }
    doors.forEach((m, i) => {
      m.emissiveIntensity = i === idx ? (e < 1.1 ? 0.05 : 0.15 + 1.6 * Math.max(0, 1 - (e - 1.1) / 1.4)) : 0;
    });
  });

  const black = flat("#0a0a0a", 0.35, 0.3);
  const white = flat("#fafafa", 0.35);
  const route = idx >= 0 ? ROUTES[idx] : null;
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[3.25 * s, 1.3, 0.8 * s]} position={[0, 1.3, 0]} />
        <CuboidCollider args={[0.5 * s, 0.6, 0.2 * s]} position={[0, 0.6, 1.6 * s]} />
      </RigidBody>
      <group scale={s} onClick={(e) => clicked(e) && navigate()} {...pointer}>
        {/* The plinth */}
        <mesh position={[0, NR_H / 2, 0]} material={white} castShadow receiveShadow>
          <boxGeometry args={[6.5, NR_H, 1.6]} />
        </mesh>
        <mesh position={[0, 0.02, 0]} material={black}>
          <boxGeometry args={[6.56, 0.04, 1.66]} />
        </mesh>
        {/* Door frames, one per route */}
        {NR_FRAMES.map((x, i) => (
          <group key={x} position={[x, NR_H, 0]}>
            {[-0.5, 0.5].map((px) => (
              <mesh key={px} position={[px, 1.2, 0]} material={black} castShadow>
                <boxGeometry args={[0.12, 2.4, 0.14]} />
              </mesh>
            ))}
            <mesh position={[0, 2.5, 0]} material={black} castShadow>
              <boxGeometry args={[1.12, 0.24, 0.14]} />
            </mesh>
            <mesh position={[0, 1.2, 0]} material={doors[i]}>
              <planeGeometry args={[0.88, 2.38]} />
            </mesh>
            <Text position={[0, 2.5, 0.075]} fontSize={0.14} color="#ffffff" anchorX="center" anchorY="middle">
              {ROUTES[i].path}
            </Text>
            <Text position={[0, -NR_H / 2, 0.81]} fontSize={0.08} color="#0a0a0a" anchorX="center" anchorY="middle">
              {ROUTES[i].file}
            </Text>
          </group>
        ))}
        {/* The layout beam over the three pages, hung from thin rods */}
        <mesh position={[-0.8, NR_BEAM, 0]} material={white} castShadow>
          <boxGeometry args={[3.4, 0.08, 0.08]} />
        </mesh>
        {NR_FRAMES.slice(0, 3).map((x) => (
          <mesh key={x} position={[x, NR_H + 2.8, 0]} material={white}>
            <boxGeometry args={[0.03, 0.42, 0.03]} />
          </mesh>
        ))}
        <mesh position={[-0.8, NR_BEAM + 0.22, 0]} material={black}>
          <boxGeometry args={[1.6, 0.3, 0.05]} />
        </mesh>
        <Text position={[-0.8, NR_BEAM + 0.22, 0.03]} fontSize={0.14} color="#ffffff" anchorX="center" anchorY="middle">
          app/layout.tsx
        </Text>
        <mesh ref={pulse} visible={false} material={flat("#ffffff", 0.2, 0, "#ffffff", 3)}>
          <sphereGeometry args={[0.08, 16, 12]} />
        </mesh>
        {/* The response screen on a slim stand */}
        <group position={[0, 0, 1.6]}>
          <mesh position={[0, 0.5, 0]} material={black}>
            <cylinderGeometry args={[0.04, 0.04, 1.0, 10]} />
          </mesh>
          <mesh position={[0, 0.02, 0]} material={black}>
            <cylinderGeometry args={[0.3, 0.3, 0.04, 24]} />
          </mesh>
          <group position={[0, 1.15, 0]} rotation-x={-0.3}>
            <mesh material={black}>
              <boxGeometry args={[1.9, 0.62, 0.05]} />
            </mesh>
            <Text position={[0, 0.1, 0.03]} fontSize={0.1} color="#ffffff" anchorX="center" anchorY="middle" maxWidth={1.8}>
              {route ? route.req : "Press E to navigate"}
            </Text>
            <Text position={[0, -0.12, 0.03]} fontSize={0.07} color="#a3a3a3" anchorX="center" anchorY="middle" maxWidth={1.8}>
              {route ? route.file : "app/  ·  one folder per route"}
            </Text>
          </group>
        </group>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Next.js · /server vs /client (room)
// ---------------------------------------------------------------------------

type HydratePhase = "html" | "hydrating" | "interactive";

/**
 * A room split down the middle: on the dark server half a rack and a render oven, on the white
 * client half a browser on a desk, with a "'use client'" sign over the line. E hydrates: packets
 * stream from the oven to the browser and its grey HTML turns interactive.
 */
function ServerClient({ w, d, toHouse, rot }: SigProps) {
  const { palette } = useHouse();
  const [phase, setPhase] = useState<HydratePhase>("html");
  const startAt = useRef(0);
  const packets = useRef<(THREE.Mesh | null)[]>([]);
  const ovenGlow = useMemo(() => glowMaterial("#2a1206", "#ff8a3d", 0.6, 0.2), []);
  useDispose(useMemo(() => [ovenGlow], [ovenGlow]));
  const z0 = -d / 2 + 0.12;
  const ox = -w / 4;
  const mx = w / 4;
  const oven = useMemo(() => new THREE.Vector3(ox, 1.05, z0 + 0.45), [ox, z0]);
  const screen = useMemo(() => new THREE.Vector3(mx, 1.15, z0 + 0.5), [mx, z0]);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  const act = () => {
    if (phase === "hydrating") return;
    if (phase === "interactive") {
      setPhase("html");
      sfx.click();
      toast("Reloaded: the server sends finished HTML again. You can read it right away, but the button won't respond until hydration.", "▲ Reload");
      return;
    }
    setPhase("hydrating");
    startAt.current = clock();
    sfx.pop();
    toast("The page is already visible: the server sent HTML. Now the JavaScript for the 'use client' parts streams in…", "▲ Hydrating");
  };
  const where = useWorldPoint(toHouse, 0, z0 + 1.8);
  useProximity({ id: "next-server-client", label: phase === "interactive" ? "Reload the page" : phase === "hydrating" ? "Hydrating…" : "Hydrate", radius: 2.2, where, run: act });

  useFrame(() => {
    const e = clock() - startAt.current;
    ovenGlow.emissiveIntensity = phase === "hydrating" ? 1.6 + Math.sin(e * 12) * 0.4 : 0.6;
    packets.current.forEach((p, j) => {
      if (!p) return;
      const k = (e - j * 0.25) / 1.2;
      p.visible = phase === "hydrating" && k > 0 && k < 1;
      if (!p.visible) return;
      tmp.lerpVectors(oven, screen, k);
      tmp.y += Math.sin(k * Math.PI) * 1.1;
      p.position.copy(tmp);
      p.rotation.set(k * 6, k * 4, 0);
    });
    if (phase === "hydrating" && e > 2.5) {
      setPhase("interactive");
      sfx.chirp();
      burstAt(toHouse, mx, 1.3, z0 + 0.6, ["#ffffff", "#22c55e"], 16);
      toast("Hydrated: React attached state and event handlers to the HTML the server sent. Server Components never ship their code to the browser; only 'use client' ones do.", "▲ Interactive");
    }
  });

  const { texture } = useCanvas(
    640,
    400,
    (ctx, cw, ch) => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, cw, ch);
      box(ctx, 0, 0, cw, 40, 0, "#e5e5e5");
      ["#ef4444", "#f59e0b", "#22c55e"].forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(22 + i * 22, 20, 7, 0, Math.PI * 2);
        ctx.fill();
      });
      box(ctx, 90, 9, cw - 110, 22, 11, "#ffffff");
      ctx.fillStyle = "#525252";
      ctx.font = font(15);
      ctx.fillText("localhost:3000/counter", 104, 25);
      const live = phase === "interactive";
      ctx.fillStyle = "#171717";
      ctx.font = font(34, "800");
      ctx.fillText("Counter", 40, 100);
      box(ctx, 40, 125, 380, 16, 8, "#e5e5e5");
      box(ctx, 40, 152, 300, 16, 8, "#e5e5e5");
      box(ctx, 40, 200, 220, 64, 12, live ? "#000000" : "#bdbdbd");
      ctx.fillStyle = "#ffffff";
      ctx.font = font(24, "700");
      ctx.fillText("Clicked 0 times", 58, 241);
      ctx.font = font(26, "700");
      ctx.fillStyle = live ? "#16a34a" : "#737373";
      ctx.fillText(live ? "Interactive ✓" : phase === "hydrating" ? "Hydrating…" : "HTML only (not interactive yet)", 40, 330);
    },
    phase,
  );

  const chairZ = z0 + 1.2;
  const seats = useMemo(() => [seatAt("next-server-client-chair", toHouse, rot, mx, chairZ, Math.PI)], [toHouse, rot, mx, chairZ]);
  const steel = flat("#1f1f1f", 0.35, 0.7);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.3, 1, 0.4]} position={[-w / 2 + 0.5, 1, z0 + 0.42]} />
        <CuboidCollider args={[0.5, 0.5, 0.35]} position={[ox, 0.5, z0 + 0.4]} />
        <CuboidCollider args={[0.7, 0.38, 0.35]} position={[mx, 0.38, z0 + 0.42]} />
      </RigidBody>
      {/* The two halves of the floor and the line between them */}
      <mesh position={[-w / 4, 0.004, 0]} rotation-x={-Math.PI / 2} material={flat("#0d0d0d", 0.45, 0.2)} receiveShadow>
        <planeGeometry args={[w / 2, d]} />
      </mesh>
      <mesh position={[w / 4, 0.004, 0]} rotation-x={-Math.PI / 2} material={flat("#f2f2f2", 0.5)} receiveShadow>
        <planeGeometry args={[w / 2, d]} />
      </mesh>
      <mesh position={[0, 0.006, 0]} rotation-x={-Math.PI / 2} material={flat("#ffffff", 0.3, 0, "#ffffff", 1.4)}>
        <planeGeometry args={[0.05, d]} />
      </mesh>
      <group position={[0, 2.35, z0 + 0.04]}>
        <mesh material={flat("#000000", 0.4)}>
          <boxGeometry args={[1.8, 0.46, 0.05]} />
        </mesh>
        <Text position={[0, 0.02, 0.03]} fontSize={0.2} color="#ffffff" anchorX="center" anchorY="middle">
          {"'use client'"}
        </Text>
      </group>
      <Text position={[-w / 4, 2.85, z0 + 0.03]} fontSize={0.26} color="#ffffff" anchorX="center" anchorY="middle" outlineWidth={0.01} outlineColor="#000000">
        Server
      </Text>
      <Text position={[w / 4, 2.85, z0 + 0.03]} fontSize={0.26} color="#000000" anchorX="center" anchorY="middle" outlineWidth={0.01} outlineColor="#ffffff">
        Client
      </Text>
      {/* Server side: a rack with blinking lights and the render oven */}
      <mesh position={[-w / 2 + 0.5, 1, z0 + 0.42]} material={steel} castShadow>
        <boxGeometry args={[0.6, 2, 0.8]} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh key={i} position={[-w / 2 + 0.5, 0.35 + i * 0.28, z0 + 0.83]} material={flat("#22c55e", 0.3, 0, "#22c55e", i % 2 ? 1.6 : 0.8)}>
          <boxGeometry args={[0.4, 0.03, 0.01]} />
        </mesh>
      ))}
      <group position={[ox, 0, z0 + 0.4]}>
        <mesh position={[0, 0.48, 0]} material={steel} castShadow>
          <boxGeometry args={[1, 0.9, 0.7]} />
        </mesh>
        <mesh position={[0, 0.95, 0]} material={flat("#2b2b2b", 0.3, 0.8)}>
          <boxGeometry args={[1.04, 0.05, 0.74]} />
        </mesh>
        <mesh position={[0, 0.42, 0.351]} material={ovenGlow}>
          <planeGeometry args={[0.7, 0.4]} />
        </mesh>
        {[-0.3, 0, 0.3].map((x) => (
          <mesh key={x} position={[x, 0.78, 0.37]} rotation-x={Math.PI / 2} material={flat("#d4d4d4", 0.3, 0.8)}>
            <cylinderGeometry args={[0.04, 0.04, 0.04, 16]} />
          </mesh>
        ))}
        <mesh position={[0.32, 1.5, -0.2]} material={steel}>
          <cylinderGeometry args={[0.07, 0.07, 1.1, 12]} />
        </mesh>
        <Text position={[0, 0.12, 0.36]} fontSize={0.07} color="#a3a3a3" anchorX="center" anchorY="middle">
          Server Components render here
        </Text>
      </group>
      {[0, 1, 2, 3, 4, 5].map((j) => (
        <mesh key={j} ref={(m) => void (packets.current[j] = m)} visible={false} material={flat("#ffffff", 0.3, 0, "#ffffff", 2.2)}>
          <boxGeometry args={[0.1, 0.1, 0.1]} />
        </mesh>
      ))}
      {/* Client side: a desk with a browser window */}
      <group position={[mx, 0, z0 + 0.42]}>
        <mesh position={[0, 0.74, 0]} material={flat("#fafafa", 0.4)} castShadow>
          <boxGeometry args={[1.4, 0.04, 0.7]} />
        </mesh>
        {[-0.65, 0.65].map((x) => (
          <mesh key={x} position={[x, 0.36, 0]} material={flat("#171717", 0.4, 0.6)}>
            <boxGeometry args={[0.04, 0.72, 0.64]} />
          </mesh>
        ))}
        <mesh position={[0, 0.85, -0.1]} material={flat("#171717", 0.4, 0.6)}>
          <boxGeometry args={[0.06, 0.18, 0.06]} />
        </mesh>
        <Panel position={[0, 1.17, -0.08]} width={0.84} height={0.525} map={texture} frame="#171717" onClick={(e) => clicked(e) && act()} />
        <mesh position={[0, 0.77, 0.15]} material={flat("#e5e5e5", 0.5)}>
          <boxGeometry args={[0.45, 0.02, 0.15]} />
        </mesh>
      </group>
      <SideChair position={[mx, 0, chairZ]} facing={Math.PI} leather="black" />
      <Seats seats={seats} />
      <mesh position={[-w / 4, 0.01, 0.2]} rotation-x={-Math.PI / 2} material={flat(palette.ink, 0.9)}>
        <planeGeometry args={[Math.min(2.4, w / 2 - 0.6), 1.6]} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Vue · The Reactive Garden (hero)
// ---------------------------------------------------------------------------

const VUE = "#42b883";
const VUE_DARK = "#35495e";
const VG_APEX = new THREE.Vector2(0, 1.2);
const VG_ENDS = [new THREE.Vector2(-2, -1.3), new THREE.Vector2(2, -1.3)];
/** The plants: three along each arm of the V, each with its own size factor. */
const VG_PLANTS = VG_ENDS.flatMap((end, arm) =>
  [0.22, 0.52, 0.82].map((f, i) => ({
    x: VG_APEX.x + (end.x - VG_APEX.x) * f,
    z: VG_APEX.y + (end.y - VG_APEX.y) * f,
    k: 0.85 + ((arm * 3 + i) % 4) * 0.08,
    dark: (arm + i) % 2 === 1,
  })),
);

/**
 * A V-shaped wooden planter in front of a standing Vue logo, six plants whose heights all read one
 * reactive value. E runs count.value++: the sign updates (count and its computed double) and every
 * plant grows in sync. After six it resets.
 */
function ReactiveGarden({ w, d, toHouse }: SigProps) {
  const s = fit(w, d, 5, 5);
  const [count, setCount] = useState(1);
  const pourAt = useRef(-10);
  const stems = useRef<(THREE.Mesh | null)[]>([]);
  const crowns = useRef<(THREE.Group | null)[]>([]);
  const heights = useRef(VG_PLANTS.map(() => 0.3));
  const can = useRef<THREE.Group>(null);

  const water = () => {
    pourAt.current = clock();
    if (count >= 6) {
      setCount(0);
      sfx.rustle();
      toast("count.value = 0. Every plant reads the same ref, so they all shrink back together.", "💚 Reset");
      return;
    }
    setCount(count + 1);
    sfx.splash();
    burstAt(toHouse, 0.9 * s, 0.9, 1.5 * s, ["#7dd3fc", "#bae6fd", VUE], 14);
    toast(
      `count.value++ → ${count + 1}. const doubled = computed(() => count.value * 2) is now ${(count + 1) * 2}, and everything that reads it updates by itself: no setState, Vue tracked the dependency.`,
      "💚 Reactive",
    );
  };
  const pz = Math.min(d / 2 - 0.3, 2.3 * s + 0.4);
  const where = useWorldPoint(toHouse, 0, pz);
  useProximity({ id: "vue-reactive-garden", label: count >= 6 ? "count.value = 0" : "count.value++", radius: 2.2, where, run: water });

  useFrame((_, dt) => {
    const target = 0.3 + count * 2 * 0.11;
    VG_PLANTS.forEach((p, i) => {
      const h = (heights.current[i] += (target * p.k - heights.current[i]) * Math.min(1, dt * 3));
      const stem = stems.current[i];
      if (stem) {
        stem.scale.y = h;
        stem.position.y = 0.45 + h / 2;
      }
      const crown = crowns.current[i];
      if (crown) crown.position.y = 0.45 + h;
    });
    if (can.current) {
      const e = clock() - pourAt.current;
      can.current.rotation.z = e < 1.2 ? Math.sin((e / 1.2) * Math.PI) * 0.6 : 0;
    }
  });

  const wood = flat("#8a5a35", 0.7);
  const soil = flat("#3b2a1e", 1);
  const arms = VG_ENDS.map((end) => {
    const vx = end.x - VG_APEX.x;
    const vz = end.y - VG_APEX.y;
    return { cx: (VG_APEX.x + end.x) / 2, cz: (VG_APEX.y + end.y) / 2, len: Math.hypot(vx, vz) + 0.3, yaw: Math.atan2(-vz, vx) };
  });
  const logoA = 0.42;
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        {arms.map((a, i) => (
          <CuboidCollider key={i} args={[(a.len / 2) * s, 0.4, 0.28 * s]} position={[a.cx * s, 0.4, a.cz * s]} rotation={[0, a.yaw, 0]} />
        ))}
        <CuboidCollider args={[1.3 * s, 1, 0.25 * s]} position={[0, 1, -2 * s]} />
      </RigidBody>
      <group scale={s} onClick={(e) => clicked(e) && water()} {...pointer}>
        {/* The V planter */}
        {arms.map((a, i) => (
          <group key={i} position={[a.cx, 0, a.cz]} rotation-y={a.yaw}>
            <mesh position={[0, 0.22, 0]} material={wood} castShadow receiveShadow>
              <boxGeometry args={[a.len, 0.44, 0.55]} />
            </mesh>
            <mesh position={[0, 0.3, 0]} material={flat(VUE, 0.5)}>
              <boxGeometry args={[a.len + 0.01, 0.07, 0.56]} />
            </mesh>
            <mesh position={[0, 0.445, 0]} material={soil}>
              <boxGeometry args={[a.len - 0.1, 0.02, 0.45]} />
            </mesh>
          </group>
        ))}
        {VG_PLANTS.map((p, i) => (
          <group key={i} position={[p.x, 0, p.z]}>
            <mesh ref={(m) => void (stems.current[i] = m)} position={[0, 0.6, 0]} material={flat("#2f7d52", 0.7)}>
              <cylinderGeometry args={[0.025, 0.035, 1, 6]} />
            </mesh>
            <group ref={(g) => void (crowns.current[i] = g)} position={[0, 0.75, 0]}>
              <mesh material={flat(p.dark ? VUE_DARK : VUE, 0.6)} castShadow>
                <icosahedronGeometry args={[0.2, 0]} />
              </mesh>
              <mesh position={[0.12, -0.12, 0]} rotation-z={-0.6} scale={[1, 0.35, 0.6]} material={flat("#2f7d52", 0.7)}>
                <sphereGeometry args={[0.14, 10, 8]} />
              </mesh>
              <mesh position={[0, 0.17, 0]} material={flat("#fef3c7", 0.5)}>
                <sphereGeometry args={[0.06, 10, 8]} />
              </mesh>
            </group>
          </group>
        ))}
        {/* A standing Vue logo behind the planter */}
        <group position={[0, 0, -2]}>
          <mesh position={[0, 0.15, 0]} material={wood} castShadow>
            <boxGeometry args={[2.6, 0.3, 0.5]} />
          </mesh>
          {[-1, 1].map((sx) => (
            <group key={sx}>
              <mesh position={[sx * Math.sin(logoA) * 1.3, 0.35 + Math.cos(logoA) * 1.3, 0]} rotation-z={-sx * logoA} material={flat(VUE, 0.5)} castShadow>
                <boxGeometry args={[0.55, 2.6, 0.14]} />
              </mesh>
              <mesh position={[sx * Math.sin(logoA) * 1.75, 0.35 + Math.cos(logoA) * 1.75, 0.08]} rotation-z={-sx * logoA} material={flat(VUE_DARK, 0.5)}>
                <boxGeometry args={[0.3, 1.7, 0.06]} />
              </mesh>
            </group>
          ))}
        </group>
        {/* The watering can holding the ref */}
        <group position={[0.95, 0, 1.6]}>
          <group ref={can} position={[0, 0.02, 0]}>
            <mesh position={[0, 0.17, 0]} material={flat(VUE, 0.35, 0.6)} castShadow>
              <cylinderGeometry args={[0.15, 0.18, 0.32, 20]} />
            </mesh>
            <mesh position={[-0.24, 0.26, 0]} rotation-z={0.9} material={flat(VUE, 0.35, 0.6)}>
              <cylinderGeometry args={[0.02, 0.035, 0.36, 8]} />
            </mesh>
            <mesh position={[0.06, 0.36, 0]} material={flat(VUE_DARK, 0.4, 0.5)}>
              <torusGeometry args={[0.11, 0.015, 6, 16, Math.PI]} />
            </mesh>
          </group>
          <Text position={[0, 0.62, 0]} fontSize={0.14} color={VUE} anchorX="center" anchorY="middle" outlineWidth={0.01} outlineColor="#1f2d3a">
            ref(count)
          </Text>
        </group>
        {/* The sign: count and its computed double */}
        <group position={[-1.05, 0, 1.6]}>
          <mesh position={[0, 0.45, 0]} material={wood}>
            <boxGeometry args={[0.06, 0.9, 0.06]} />
          </mesh>
          <mesh position={[0, 1.0, 0]} material={wood} castShadow>
            <boxGeometry args={[1.25, 0.42, 0.05]} />
          </mesh>
          <Text position={[0, 1.0, 0.03]} fontSize={0.12} color="#eef8f2" anchorX="center" anchorY="middle">
            {`count: ${count} · doubled: ${count * 2}`}
          </Text>
        </group>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Vue · Single-File Cabinet (room)
// ---------------------------------------------------------------------------

const SFC = [
  {
    tag: "<template>",
    code: ["<template>", '  <button @click="count++">', "    Clicked {{ count }} times", "  </button>", "</template>"],
    text: "<template> holds the markup. {{ count }} prints a value, and @click is short for v-on:click.",
  },
  {
    tag: "<script setup>",
    code: ["<script setup>", "import { ref } from 'vue'", "", "const count = ref(0)", "</script>"],
    text: "<script setup> runs once per component instance. Its top-level bindings, like count, are usable straight in the template.",
  },
  {
    tag: "<style scoped>",
    code: ["<style scoped>", "button {", "  color: #42b883;", "}", "</style>"],
    text: "<style scoped> tags this component's elements with a data-v-… attribute, so these rules never leak to other components.",
  },
];

/**
 * A three-drawer wooden cabinet, one drawer per section of a .vue file. Click a drawer (or press E
 * for the next one): it slides open and the wall board shows that section's code. A cozy armchair
 * and a lamp keep you company.
 */
function SfcCabinet({ w, d, toHouse, rot }: SigProps) {
  const [open, setOpen] = useState(-1);
  const drawers = useRef<(THREE.Group | null)[]>([]);
  const z0 = -d / 2 + 0.12;
  const cx = -Math.min(w / 4 + 0.3, 2.2);
  const boardW = Math.min(3.2, w / 2 - 0.3);
  const bx = w / 2 - 0.25 - boardW / 2;

  const pick = (i: number) => {
    setOpen(i);
    sfx.clunk();
    toast(SFC[i].text, `💚 ${SFC[i].tag}`);
  };
  const next = (open + 1) % SFC.length;
  const where = useWorldPoint(toHouse, cx, z0 + 1.5);
  useProximity({ id: "vue-sfc", label: `Open ${SFC[next].tag}`, radius: 2, where, run: () => pick(next) });

  useFrame((_, dt) => {
    drawers.current.forEach((g, i) => {
      if (g) g.position.z += ((i === open ? 0.42 : 0) - g.position.z) * Math.min(1, dt * 8);
    });
  });

  const chx = w / 2 - 1.1;
  const chz = Math.min(0.4, d / 2 - 2);
  const facing = Math.atan2(bx - chx, z0 - chz);
  const seats = useMemo(() => [seatAt("vue-sfc-chair", toHouse, rot, chx, chz, facing)], [toHouse, rot, chx, chz, facing]);
  const wood = flat("#8a5a35", 0.6);
  const front = flat("#a77b52", 0.55);
  const brass = flat("#c9a45a", 0.3, 0.85);
  const shown = open >= 0 ? SFC[open] : null;
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.68, 0.65, 0.3]} position={[cx, 0.65, z0 + 0.32]} />
      </RigidBody>
      <group position={[cx, 0, z0 + 0.32]}>
        <mesh position={[0, 0.65, -0.02]} material={wood} castShadow receiveShadow>
          <boxGeometry args={[1.36, 1.2, 0.56]} />
        </mesh>
        <mesh position={[0, 1.27, 0]} material={flat("#5a3d26", 0.5)} castShadow>
          <boxGeometry args={[1.44, 0.05, 0.62]} />
        </mesh>
        {[-0.6, 0.6].map((x) => (
          <mesh key={x} position={[x, 0.03, 0.2]} material={flat("#5a3d26", 0.5)}>
            <boxGeometry args={[0.08, 0.06, 0.08]} />
          </mesh>
        ))}
        <Text position={[0, 1.42, 0]} fontSize={0.12} color={VUE} anchorX="center" anchorY="middle">
          App.vue
        </Text>
        {SFC.map((s, i) => (
          <group key={s.tag} ref={(g) => void (drawers.current[i] = g)} position={[0, 0.25 + (2 - i) * 0.37, 0]} onClick={(e) => clicked(e) && pick(i)} {...pointer}>
            <mesh position={[0, 0, -0.04]} material={flat("#c49a6c", 0.7)}>
              <boxGeometry args={[1.2, 0.28, 0.5]} />
            </mesh>
            <mesh position={[0, 0, 0.27]} material={front} castShadow>
              <boxGeometry args={[1.26, 0.33, 0.04]} />
            </mesh>
            <Text position={[0, 0.06, 0.295]} fontSize={0.08} color={i === open ? VUE : "#2a1a0e"} anchorX="center" anchorY="middle">
              {s.tag}
            </Text>
            <mesh position={[0, -0.07, 0.31]} material={brass}>
              <boxGeometry args={[0.22, 0.03, 0.03]} />
            </mesh>
          </group>
        ))}
      </group>
      <CodeBoard
        position={[bx, 1.75, z0]}
        width={boardW}
        height={1.7}
        title={shown ? `App.vue · ${shown.tag}` : "App.vue: one file, three parts"}
        lines={shown ? shown.code : SFC.map((s) => s.tag)}
      />
      <Sofa position={[chx, 0, chz]} facing={facing} length={1.0} leather="emerald" />
      <FloorLamp position={[w / 2 - 0.4, 0, chz - 0.6]} />
      <Rug position={[w / 4 - 0.2, chz - 0.3]} width={2.2} depth={1.6} color="#35495e" border={VUE} />
      <Seats seats={seats} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Angular · The Shield (hero)
// ---------------------------------------------------------------------------

const NG = "#dd0031";
const NG_DARK = "#c3002f";
/** The Angular shield's outline, unit height 2 (y from -1 to 1). */
const SHIELD_PTS: [number, number][] = [
  [0, 1],
  [0.93, 0.67],
  [0.79, -0.55],
  [0, -1],
  [-0.79, -0.55],
  [-0.93, 0.67],
];
function shapeOf(pts: [number, number][], scale: number) {
  const shape = new THREE.Shape();
  pts.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x * scale, y * scale) : shape.lineTo(x * scale, y * scale)));
  shape.closePath();
  return shape;
}

/**
 * A large red Angular shield, extruded with its "A", mounted on a stone pedestal between two stone
 * pillars carrying "Injector" banners. E bootstraps the app: the shield glows and a ring sweeps out
 * across the floor.
 */
function AngularShield({ w, d, toHouse }: SigProps) {
  const s = fit(w, d, 6.2, 4.4);
  const bootAt = useRef(-10);
  const banners = useRef<(THREE.Mesh | null)[]>([]);
  const ring = useRef<THREE.Mesh>(null);
  const geos = useMemo(() => {
    const opts = { depth: 0.16, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 };
    const whole = new THREE.ExtrudeGeometry(shapeOf(SHIELD_PTS, 1.3), opts);
    const half = new THREE.ExtrudeGeometry(shapeOf(SHIELD_PTS.slice(0, 4), 1.3), { ...opts, depth: 0.17 });
    const a = shapeOf(
      [
        [-0.52, -0.55],
        [-0.36, -0.55],
        [-0.25, -0.28],
        [0.25, -0.28],
        [0.36, -0.55],
        [0.52, -0.55],
        [0, 0.72],
      ],
      1.3,
    );
    a.holes.push(new THREE.Path([new THREE.Vector2(-0.17 * 1.3, -0.12 * 1.3), new THREE.Vector2(0.17 * 1.3, -0.12 * 1.3), new THREE.Vector2(0, 0.32 * 1.3)]));
    const letter = new THREE.ExtrudeGeometry(a, { depth: 0.12, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 1 });
    return [whole, half, letter] as const;
  }, []);
  useEffect(() => () => geos.forEach((g) => g.dispose()), [geos]);
  const red = useMemo(() => glowMaterial(NG, NG, 0.15, 0.4), []);
  const deep = useMemo(() => glowMaterial(NG_DARK, NG_DARK, 0.15, 0.4), []);
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: NG, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }), []);
  useDispose(useMemo(() => [red, deep, ringMat], [red, deep, ringMat]));

  const boot = () => {
    bootAt.current = clock();
    sfx.gong();
    burstAt(toHouse, 0, 2.6 * s, 0.3, [NG, "#ffffff", "#ffd6c4"], 22);
    toast("bootstrapApplication(AppComponent, appConfig) → platform ready. Angular creates the root injector from your providers, then renders AppComponent into <app-root>.", "🛡️ Bootstrap");
  };
  const pz = Math.min(d / 2 - 0.3, 1.9 * s + 0.6);
  const where = useWorldPoint(toHouse, 0, pz);
  useProximity({ id: "angular-shield", label: "Bootstrap the app", radius: 2.2, where, run: boot });

  useFrame(() => {
    const t = clock();
    const e = t - bootAt.current;
    const k = Math.max(0, 1 - e / 1.8);
    red.emissiveIntensity = 0.15 + 2.4 * k;
    deep.emissiveIntensity = 0.15 + 2.0 * k;
    if (ring.current) {
      ring.current.visible = e < 1.8;
      ring.current.scale.setScalar(1 + (e / 1.8) * 4);
      ringMat.opacity = k;
    }
    banners.current.forEach((b, i) => {
      if (b) b.rotation.y = Math.sin(t * 1.3 + i * 1.7) * 0.06;
    });
  });

  const stone = flat("#8a8a90", 0.9);
  const stoneDark = flat("#6e6e74", 0.9);
  const gold = flat("#c9a227", 0.35, 0.8);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.1 * s, 1.2, 0.7 * s]} position={[0, 1.2, 0]} />
        {[-1, 1].map((sx) => (
          <CuboidCollider key={sx} args={[0.4 * s, 1.8, 0.4 * s]} position={[sx * 2.6 * s, 1.8, 0]} />
        ))}
      </RigidBody>
      <mesh ref={ring} position={[0, 0.03, 0]} rotation-x={-Math.PI / 2} material={ringMat} visible={false}>
        <ringGeometry args={[0.9, 1.05, 64]} />
      </mesh>
      <group scale={s} onClick={(e) => clicked(e) && boot()} {...pointer}>
        {/* The pedestal */}
        <mesh position={[0, 0.15, 0]} material={stoneDark} castShadow receiveShadow>
          <boxGeometry args={[2.2, 0.3, 1.4]} />
        </mesh>
        <mesh position={[0, 0.75, 0]} material={stone} castShadow receiveShadow>
          <boxGeometry args={[1.6, 0.9, 1.0]} />
        </mesh>
        <mesh position={[0, 1.23, 0]} material={stoneDark}>
          <boxGeometry args={[1.75, 0.06, 1.1]} />
        </mesh>
        <Text position={[0, 0.75, 0.51]} fontSize={0.075} color="#fbeff1" anchorX="center" anchorY="middle">
          bootstrapApplication(AppComponent)
        </Text>
        {/* The shield and its A */}
        <group position={[0, 2.6, -0.1]}>
          <mesh geometry={geos[0]} material={red} castShadow />
          <mesh geometry={geos[1]} material={deep} />
          <mesh geometry={geos[2]} position={[0, 0, 0.12]} material={flat("#ffffff", 0.35)} />
          <mesh position={[0, -1.15, -0.05]} material={stoneDark}>
            <boxGeometry args={[0.3, 0.3, 0.3]} />
          </mesh>
        </group>
        {/* Guard pillars with Injector banners */}
        {[-1, 1].map((sx, i) => (
          <group key={sx} position={[sx * 2.6, 0, 0]}>
            <mesh position={[0, 0.15, 0]} material={stoneDark} castShadow>
              <boxGeometry args={[0.8, 0.3, 0.8]} />
            </mesh>
            <mesh position={[0, 1.8, 0]} material={stone} castShadow>
              <cylinderGeometry args={[0.28, 0.32, 3.0, 16]} />
            </mesh>
            <mesh position={[0, 3.42, 0]} material={stoneDark} castShadow>
              <boxGeometry args={[0.8, 0.24, 0.8]} />
            </mesh>
            <mesh position={[0, 3.15, 0.45]} rotation-z={Math.PI / 2} material={gold}>
              <cylinderGeometry args={[0.02, 0.02, 0.86, 8]} />
            </mesh>
            <group position={[0, 3.15, 0.45]}>
              <mesh ref={(m) => void (banners.current[i] = m)} position={[0, -0.75, 0]} material={flat(NG, 0.8)} castShadow>
                <boxGeometry args={[0.7, 1.5, 0.02]} />
              </mesh>
            </group>
            <mesh position={[0, 1.65, 0.46]} material={gold}>
              <boxGeometry args={[0.7, 0.05, 0.03]} />
            </mesh>
            <Text position={[0, 2.5, 0.47]} fontSize={0.14} color="#ffffff" anchorX="center" anchorY="middle">
              Injector
            </Text>
          </group>
        ))}
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Angular · Services Armory (room)
// ---------------------------------------------------------------------------

const SERVICES = [
  { name: "AuthService", into: "OrdersComponent", color: NG, text: "private auth = inject(AuthService) in OrdersComponent. With @Injectable({ providedIn: 'root' }) every component gets the same instance." },
  { name: "HttpClient", into: "OrdersService", color: "#9aa3ad", text: "http = inject(HttpClient) in OrdersService; http.get<Order[]>('/api/orders') returns an Observable. Register it once with provideHttpClient()." },
  { name: "Router", into: "LoginComponent", color: NG_DARK, text: "router = inject(Router) in LoginComponent, then router.navigate(['/orders']) once the user has signed in." },
  { name: "Store", into: "CartComponent", color: "#c9a227", text: "store = inject(Store) (NgRx) in CartComponent; store.select(selectCartItems) streams the cart state as an Observable." },
  { name: "Logger", into: "OrdersComponent", color: "#5b6b7a", text: "logger = inject(LoggerService): your own @Injectable class. One instance app-wide, unless a component lists it in its own providers." },
];

/**
 * An armory wall rack where services hang as shields, and a stone plinth for the component that
 * asks for them. Click a shield (or press E to go through them): it lifts off the rack and glows,
 * and the plinth shows where it was injected.
 */
function ServicesArmory({ w, d, toHouse }: SigProps) {
  const { palette } = useHouse();
  const [sel, setSel] = useState(-1);
  const pickAt = useRef(-10);
  const shields = useRef<(THREE.Group | null)[]>([]);
  const flames = useRef<(THREE.Mesh | null)[]>([]);
  const geo = useMemo(() => {
    const sh = new THREE.Shape();
    sh.moveTo(-0.38, 0.48);
    sh.lineTo(0.38, 0.48);
    sh.lineTo(0.38, 0.02);
    sh.quadraticCurveTo(0.36, -0.34, 0, -0.55);
    sh.quadraticCurveTo(-0.36, -0.34, -0.38, 0.02);
    sh.closePath();
    return new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 });
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  const mats = useMemo(() => SERVICES.map((sv) => glowMaterial(sv.color, sv.color, 0, 0.45)), []);
  const socket = useMemo(() => glowMaterial("#3a0010", NG, 0.1), []);
  useDispose(useMemo(() => [...mats, socket], [mats, socket]));
  const z0 = -d / 2 + 0.12;
  const rack = Math.min(w - 1.8, 5.5);
  const gap = rack / SERVICES.length;
  const pz = z0 + 2.7;

  const pick = (i: number) => {
    setSel(i);
    pickAt.current = clock();
    sfx.clunk();
    burstAt(toHouse, -rack / 2 + gap * (i + 0.5), 1.9, z0 + 0.5, [SERVICES[i].color, "#ffd6c4"], 12);
    toast(SERVICES[i].text, `🛡️ inject(${SERVICES[i].name})`);
  };
  const next = (sel + 1) % SERVICES.length;
  const where = useWorldPoint(toHouse, 0, z0 + 1.6);
  useProximity({ id: "angular-armory", label: `inject(${SERVICES[next].name})`, radius: 2, where, run: () => pick(next) });

  useFrame((_, dt) => {
    const t = clock();
    const f = Math.min(1, dt * 6);
    shields.current.forEach((g, i) => {
      if (!g) return;
      const on = i === sel;
      g.position.y += ((on ? 1.95 : 1.6) - g.position.y) * f;
      g.position.z += ((on ? z0 + 0.5 : z0 + 0.12) - g.position.z) * f;
      mats[i].emissiveIntensity += ((on ? 0.9 : 0) - mats[i].emissiveIntensity) * f;
    });
    socket.emissiveIntensity = 0.1 + 2 * Math.max(0, 1 - (t - pickAt.current) / 1.5);
    flames.current.forEach((m, i) => {
      if (m) m.scale.set(1, 1 + Math.sin(t * 9 + i * 2) * 0.12, 1);
    });
  });

  const wood = flat("#3b2416", 0.75);
  const iron = flat("#2a2a2e", 0.45, 0.8);
  const brass = flat("#c9a227", 0.35, 0.8);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[rack / 2 + 0.2, 1.3, 0.3]} position={[0, 1.3, z0 + 0.3]} />
        <CuboidCollider args={[0.65, 0.5, 0.35]} position={[0, 0.5, pz]} />
      </RigidBody>
      {/* The rack */}
      <mesh position={[0, 1.55, z0 + 0.03]} material={wood} castShadow receiveShadow>
        <boxGeometry args={[rack + 0.3, 2.0, 0.05]} />
      </mesh>
      {[0.62, 2.5].map((y) => (
        <mesh key={y} position={[0, y, z0 + 0.08]} material={iron}>
          <boxGeometry args={[rack + 0.4, 0.07, 0.07]} />
        </mesh>
      ))}
      <Text position={[0, 2.8, z0 + 0.04]} fontSize={0.15} color={palette.paper} anchorX="center" anchorY="middle">
        {"@Injectable({ providedIn: 'root' })"}
      </Text>
      {SERVICES.map((sv, i) => {
        const x = -rack / 2 + gap * (i + 0.5);
        return (
          <group key={sv.name}>
            <mesh position={[x, 1.98, z0 + 0.1]} rotation-x={Math.PI / 2} material={iron}>
              <cylinderGeometry args={[0.02, 0.02, 0.12, 8]} />
            </mesh>
            <group ref={(g) => void (shields.current[i] = g)} position={[x, 1.6, z0 + 0.12]} onClick={(e) => clicked(e) && pick(i)} {...pointer}>
              <mesh geometry={geo} material={mats[i]} castShadow />
              <mesh position={[0, 0.04, 0.08]} material={brass}>
                <sphereGeometry args={[0.08, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
              </mesh>
              <mesh position={[0, 0.04, 0.075]} material={brass}>
                <boxGeometry args={[0.6, 0.04, 0.01]} />
              </mesh>
            </group>
            <mesh position={[x, 0.86, z0 + 0.065]} material={brass}>
              <boxGeometry args={[Math.min(gap - 0.08, 0.95), 0.16, 0.02]} />
            </mesh>
            <Text position={[x, 0.86, z0 + 0.08]} fontSize={0.075} color="#1a0008" anchorX="center" anchorY="middle">
              {sv.name}
            </Text>
          </group>
        );
      })}
      {/* Torches either side */}
      {[-1, 1].map((sx, i) => (
        <group key={sx} position={[sx * (rack / 2 + 0.45), 1.9, z0 + 0.12]}>
          <mesh material={iron}>
            <boxGeometry args={[0.08, 0.35, 0.12]} />
          </mesh>
          <mesh position={[0, 0.2, 0.1]} material={iron}>
            <cylinderGeometry args={[0.08, 0.05, 0.12, 10]} />
          </mesh>
          <mesh ref={(m) => void (flames.current[i] = m)} position={[0, 0.34, 0.1]} material={flat("#ffb347", 0.3, 0, "#ff7a1a", 2.4)}>
            <coneGeometry args={[0.07, 0.22, 10]} />
          </mesh>
        </group>
      ))}
      {/* The plinth of the component that asks */}
      <group position={[0, 0, pz]}>
        <mesh position={[0, 0.45, 0]} material={flat("#8a8a90", 0.9)} castShadow receiveShadow>
          <boxGeometry args={[1.2, 0.9, 0.6]} />
        </mesh>
        <mesh position={[0, 0.92, 0]} material={socket}>
          <boxGeometry args={[1.0, 0.04, 0.45]} />
        </mesh>
        <Text position={[0, 0.6, 0.31]} fontSize={0.09} color="#fbeff1" anchorX="center" anchorY="middle">
          {sel >= 0 ? SERVICES[sel].into : "YourComponent"}
        </Text>
        <Text position={[0, 0.4, 0.31]} fontSize={0.06} color="#ffd6c4" anchorX="center" anchorY="middle">
          {sel >= 0 ? `inject(${SERVICES[sel].name})` : "asks the injector"}
        </Text>
      </group>
      <Rug position={[0, 0.4]} width={1.4} depth={Math.min(d - 4, 6)} color="#5a0016" border="#c9a227" />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Angular · RxJS Stream (room)
// ---------------------------------------------------------------------------

type Marble = { id: number; v: number; stage: 0 | 1 | 2 | 3; x: number; y: number; holdUntil: number; sinkAt: number };
type MarbleView = Pick<Marble, "id" | "v" | "stage" | "x" | "y">;
type StreamLog = { src: number[]; map: number[]; filter: number[]; out: number[] };
const GATES = ["map(x => x * 10)", "filter(x => x > 20)", "debounceTime(300)"];
const MARBLE_COLORS = ["#e5e7eb", NG, NG, "#f5c542"];
const MARBLE_Y = 0.2;
const SPEED = 0.9;
const keep = (a: number[], v: number) => [...a, v].slice(-6);

/**
 * A water channel in the floor where values flow left to right as marbles through three operator
 * arches: map multiplies them by ten, filter sinks the small ones, debounceTime waits for 300 ms of
 * silence (a newer marble drops the waiting one). E emits a marble; the board shows each stream.
 */
function RxjsStream({ w, d, toHouse }: SigProps) {
  const [view, setView] = useState<MarbleView[]>([]);
  const [log, setLog] = useState<StreamLog>({ src: [], map: [], filter: [], out: [] });
  const marbles = useRef<Marble[]>([]);
  const logRef = useRef<StreamLog>({ src: [], map: [], filter: [], out: [] });
  const groups = useRef(new Map<number, THREE.Group>());
  const nextId = useRef(0);
  const z0 = -d / 2 + 0.12;
  const L = Math.min(w - 1.4, 8);
  const zc = z0 + 2.6;
  const gx = [0.32, 0.56, 0.8].map((f) => -L / 2 + L * f);

  const sync = () => {
    setView(marbles.current.map(({ id, v, stage, x, y }) => ({ id, v, stage, x, y })));
    setLog({ ...logRef.current });
  };
  const emit = () => {
    if (marbles.current.length >= 8) return;
    const n = nextId.current++;
    const v = (n % 5) + 1;
    marbles.current.push({ id: n, v, stage: 0, x: -L / 2 + 0.2, y: MARBLE_Y, holdUntil: 0, sinkAt: 0 });
    logRef.current.src = keep(logRef.current.src, v);
    sync();
    sfx.pop();
    if (n === 0) toast("Each marble is a value emitted by an Observable. Press E twice quickly to watch debounceTime drop one.", "🌊 RxJS");
  };
  const where = useWorldPoint(toHouse, -L / 2 + 0.7, zc + 1.2);
  useProximity({ id: "angular-rxjs", label: "Emit", radius: 2, where, run: emit });

  useFrame((_, dt) => {
    const t = clock();
    let changed = false;
    const list = marbles.current;
    for (const m of list) {
      if (m.sinkAt > 0) {
        m.y -= dt * 0.3;
        continue;
      }
      if (m.holdUntil > 0) {
        if (t < m.holdUntil) continue;
        m.holdUntil = 0;
        m.stage = 3;
        logRef.current.out = keep(logRef.current.out, m.v);
        sfx.chirp();
        changed = true;
      }
      m.x += dt * SPEED;
      if (m.stage === 0 && m.x >= gx[0]) {
        m.stage = 1;
        m.v *= 10;
        logRef.current.map = keep(logRef.current.map, m.v);
        changed = true;
      } else if (m.stage === 1 && m.x >= gx[1]) {
        if (m.v > 20) {
          m.stage = 2;
          logRef.current.filter = keep(logRef.current.filter, m.v);
        } else {
          m.sinkAt = t;
          sfx.splash();
          toast(`filter(x => x > 20) dropped ${m.v}: it doesn't pass the test, so it never reaches the subscriber.`, "🌊 filter");
        }
        changed = true;
      } else if (m.stage === 2 && m.x >= gx[2]) {
        const waiting = list.find((o) => o !== m && o.holdUntil > 0);
        if (waiting) {
          waiting.holdUntil = 0;
          waiting.sinkAt = t;
          sfx.splash();
          toast(`debounceTime(300) dropped ${waiting.v}: ${m.v} arrived before 300 ms of silence, so only the latest value is kept.`, "🌊 debounceTime");
        }
        m.x = gx[2];
        m.holdUntil = t + 0.3;
        changed = true;
      }
    }
    const alive = list.filter((m) => !(m.sinkAt > 0 && t - m.sinkAt > 0.8) && m.x < L / 2 - 0.1);
    if (alive.length !== list.length) {
      marbles.current = alive;
      changed = true;
    }
    for (const m of marbles.current) groups.current.get(m.id)?.position.set(m.x, m.y, 0);
    if (changed) sync();
  });

  const rim = flat("#6e6e74", 0.9);
  const stone = flat("#8a8a90", 0.85);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        {gx.flatMap((x) => [-0.55, 0.55].map((z) => <CuboidCollider key={`${x}${z}`} args={[0.1, 0.8, 0.1]} position={[x, 0.8, zc + z]} />))}
        <CuboidCollider args={[0.25, 0.35, 0.45]} position={[-L / 2 - 0.15, 0.35, zc]} />
      </RigidBody>
      <CodeBoard
        position={[0, 1.85, z0]}
        width={Math.min(4.4, w - 1.4)}
        height={1.8}
        title="source$.pipe(map, filter, debounceTime)"
        lines={[
          `source$  : ${log.src.join("  ")}`,
          `map      : ${log.map.join("  ")}`,
          `filter   : ${log.filter.join("  ")}`,
          `debounce : ${log.out.join("  ")}`,
        ]}
        current={3}
      />
      {/* The channel */}
      <group position={[0, 0, zc]}>
        <mesh position={[0, 0.02, 0]} material={flat("#1f2a3a", 0.8)} receiveShadow>
          <boxGeometry args={[L, 0.04, 0.7]} />
        </mesh>
        <mesh position={[0, 0.07, 0]} material={flat("#3b82c4", 0.15, 0.1, "#1d5fa0", 0.35)}>
          <boxGeometry args={[L, 0.02, 0.68]} />
        </mesh>
        {[-0.42, 0.42].map((z) => (
          <mesh key={z} position={[0, 0.06, z]} material={rim} castShadow receiveShadow>
            <boxGeometry args={[L + 0.3, 0.12, 0.16]} />
          </mesh>
        ))}
        <mesh position={[L / 2 + 0.07, 0.06, 0]} material={rim}>
          <boxGeometry args={[0.16, 0.12, 0.7]} />
        </mesh>
        {/* The source: a stone spout you can click */}
        <group position={[-L / 2 - 0.15, 0, 0]} onClick={(e) => clicked(e) && emit()} {...pointer}>
          <mesh position={[0, 0.35, 0]} material={stone} castShadow>
            <boxGeometry args={[0.5, 0.7, 0.9]} />
          </mesh>
          <mesh position={[0.3, 0.45, 0]} rotation-z={Math.PI / 2} material={flat("#c9a227", 0.35, 0.8)}>
            <cylinderGeometry args={[0.06, 0.08, 0.2, 12]} />
          </mesh>
          <Text position={[0, 0.85, 0]} fontSize={0.13} color="#fbeff1" anchorX="center" anchorY="middle" outlineWidth={0.01} outlineColor="#1a0008">
            source$
          </Text>
        </group>
        {/* Operator arches */}
        {gx.map((x, i) => (
          <group key={GATES[i]} position={[x, 0, 0]}>
            {[-0.55, 0.55].map((z) => (
              <mesh key={z} position={[0, 0.8, z]} material={stone} castShadow>
                <boxGeometry args={[0.2, 1.6, 0.2]} />
              </mesh>
            ))}
            <mesh position={[0, 1.6, 0]} rotation-y={Math.PI / 2} material={stone} castShadow>
              <torusGeometry args={[0.55, 0.09, 8, 24, Math.PI]} />
            </mesh>
            <mesh position={[0, 2.3, 0]} material={flat("#1a0008", 0.6)}>
              <boxGeometry args={[Math.min(1.5, L * 0.23), 0.3, 0.05]} />
            </mesh>
            <Text position={[0, 2.3, 0.03]} fontSize={0.1} color="#fbeff1" anchorX="center" anchorY="middle">
              {GATES[i]}
            </Text>
          </group>
        ))}
        {view.map((m) => (
          <group key={m.id} position={[m.x, m.y, 0]} ref={(g) => void (g ? groups.current.set(m.id, g) : groups.current.delete(m.id))}>
            <mesh material={flat(MARBLE_COLORS[m.stage], 0.15, 0.2, m.stage === 3 ? "#f5c542" : undefined, 0.8)} castShadow>
              <sphereGeometry args={[0.12, 18, 14]} />
            </mesh>
            <Text position={[0, 0.26, 0]} fontSize={0.13} color="#ffffff" anchorX="center" anchorY="middle" outlineWidth={0.012} outlineColor="#1a0008">
              {String(m.v)}
            </Text>
          </group>
        ))}
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// shadcn/ui · Component Blocks (hero)
// ---------------------------------------------------------------------------

const BLOCKS = ["Button", "Card", "Dialog", "Input", "Tabs"];
const SLOT_X = [-2.3, -1.15, 0, 1.15, 2.3];
const TABLE_Y = 0.9;

/** A small physical model of one shadcn/ui component, resting on y = 0. */
function BlockModel({ name }: { name: string }) {
  const zinc900 = flat("#18181b", 0.4);
  const white = flat("#ffffff", 0.45);
  const border = flat("#d4d4d8", 0.5);
  const muted = flat("#e4e4e7", 0.6);
  if (name === "Button")
    return (
      <group>
        <RoundedBox args={[0.7, 0.16, 0.3]} radius={0.05} smoothness={3} position={[0, 0.08, 0]} material={zinc900} castShadow />
        <Text position={[0, 0.08, 0.152]} fontSize={0.07} color="#fafafa" anchorX="center" anchorY="middle">
          Button
        </Text>
      </group>
    );
  if (name === "Card")
    return (
      <group>
        <RoundedBox args={[0.82, 0.05, 0.62]} radius={0.02} smoothness={2} position={[0, 0.025, 0]} material={border} />
        <RoundedBox args={[0.8, 0.06, 0.6]} radius={0.02} smoothness={2} position={[0, 0.04, 0]} material={white} castShadow />
        <mesh position={[-0.12, 0.072, -0.18]} material={zinc900}>
          <boxGeometry args={[0.44, 0.005, 0.06]} />
        </mesh>
        <mesh position={[-0.06, 0.072, -0.06]} material={muted}>
          <boxGeometry args={[0.56, 0.005, 0.04]} />
        </mesh>
        <RoundedBox args={[0.22, 0.05, 0.1]} radius={0.02} smoothness={2} position={[0.22, 0.09, 0.18]} material={zinc900} />
      </group>
    );
  if (name === "Dialog")
    return (
      <group>
        <mesh position={[0, 0.02, 0]} material={muted}>
          <boxGeometry args={[0.85, 0.04, 0.4]} />
        </mesh>
        <RoundedBox args={[0.8, 0.56, 0.05]} radius={0.02} smoothness={2} position={[0, 0.32, -0.04]} material={white} castShadow />
        <mesh position={[0, 0.32, -0.068]} material={border}>
          <boxGeometry args={[0.82, 0.58, 0.01]} />
        </mesh>
        <mesh position={[-0.12, 0.5, -0.01]} material={zinc900}>
          <boxGeometry args={[0.44, 0.05, 0.005]} />
        </mesh>
        <mesh position={[-0.06, 0.4, -0.01]} material={muted}>
          <boxGeometry args={[0.56, 0.035, 0.005]} />
        </mesh>
        <RoundedBox args={[0.22, 0.08, 0.03]} radius={0.015} smoothness={2} position={[0.22, 0.14, 0]} material={zinc900} />
      </group>
    );
  if (name === "Input")
    return (
      <group>
        <RoundedBox args={[0.87, 0.07, 0.24]} radius={0.02} smoothness={2} position={[0, 0.03, 0]} material={border} />
        <RoundedBox args={[0.85, 0.08, 0.22]} radius={0.02} smoothness={2} position={[0, 0.04, 0]} material={white} castShadow />
        <mesh position={[-0.36, 0.09, 0]} material={zinc900}>
          <boxGeometry args={[0.012, 0.02, 0.12]} />
        </mesh>
        <mesh position={[-0.12, 0.082, 0]} material={muted}>
          <boxGeometry args={[0.4, 0.005, 0.04]} />
        </mesh>
      </group>
    );
  return (
    <group>
      <RoundedBox args={[0.85, 0.06, 0.5]} radius={0.02} smoothness={2} position={[0, 0.03, 0.04]} material={white} castShadow />
      <RoundedBox args={[0.85, 0.06, 0.16]} radius={0.02} smoothness={2} position={[0, 0.05, -0.24]} material={muted} />
      {[-0.27, 0, 0.27].map((x, i) => (
        <RoundedBox key={x} args={[0.25, 0.05, 0.12]} radius={0.015} smoothness={2} position={[x, 0.085, -0.24]} material={i === 0 ? white : muted} />
      ))}
    </group>
  );
}

/**
 * A long display table in calm zinc, with a slot for each shadcn/ui component under a black sign.
 * E runs "npx shadcn add <next>": a new block drops onto its slot with its file path, because the
 * component's code now lives in your project. When the table is full, the next E starts afresh.
 */
function ShadcnBlocks({ w, d, toHouse }: SigProps) {
  const s = fit(w, d, 6.4, 4);
  const [placed, setPlaced] = useState(2);
  const dropAt = useRef(BLOCKS.map(() => -10));
  const blocks = useRef<(THREE.Group | null)[]>([]);

  const add = () => {
    if (placed >= BLOCKS.length) {
      setPlaced(0);
      sfx.rustle();
      toast("A fresh project: nothing installed, nothing to upgrade. You add only the components you need.", "▪ shadcn/ui");
      return;
    }
    const name = BLOCKS[placed].toLowerCase();
    dropAt.current[placed] = clock();
    setPlaced(placed + 1);
    sfx.pop();
    burstAt(toHouse, SLOT_X[placed] * s, TABLE_Y + 0.4, 0, ["#18181b", "#a1a1aa", "#ffffff"], 10);
    toast(`npx shadcn add ${name} copied components/ui/${name}.tsx into your project. It's your code now: edit it freely, there's no package to update.`, "▪ shadcn/ui");
  };
  const nextName = placed < BLOCKS.length ? BLOCKS[placed].toLowerCase() : "";
  const pz = Math.min(d / 2 - 0.3, 1.5 * s + 0.6);
  const where = useWorldPoint(toHouse, 0, pz);
  useProximity({ id: "shadcn-blocks", label: placed < BLOCKS.length ? `npx shadcn add ${nextName}` : "Start a fresh project", radius: 2.2, where, run: add });

  useFrame(() => {
    const t = clock();
    blocks.current.forEach((g, i) => {
      if (!g) return;
      const e = t - dropAt.current[i];
      let y = 0;
      if (e < 0.55) {
        const k = Math.max(0, e) / 0.55;
        y = 1.6 * (1 - k * k);
      } else {
        const b = e - 0.55;
        y = Math.abs(Math.sin(b * 12)) * 0.07 * Math.exp(-b * 6);
      }
      g.position.y = TABLE_Y + y;
    });
  });

  const black = flat("#18181b", 0.4, 0.3);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[3 * s, 0.6, 0.6 * s]} position={[0, 0.6, 0]} />
        <CuboidCollider args={[3 * s, 1.5, 0.08 * s]} position={[0, 1.5, -0.95 * s]} />
      </RigidBody>
      <group scale={s} onClick={(e) => clicked(e) && add()} {...pointer}>
        {/* The table */}
        <mesh position={[0, TABLE_Y - 0.03, 0]} material={flat("#fafafa", 0.4)} castShadow receiveShadow>
          <boxGeometry args={[5.9, 0.06, 1.1]} />
        </mesh>
        <mesh position={[0, TABLE_Y - 0.065, 0]} material={flat("#d4d4d8", 0.5)}>
          <boxGeometry args={[5.92, 0.015, 1.12]} />
        </mesh>
        {[-2.85, 2.85].flatMap((x) =>
          [-0.48, 0.48].map((z) => (
            <mesh key={`${x}${z}`} position={[x, (TABLE_Y - 0.06) / 2, z]} material={black} castShadow>
              <boxGeometry args={[0.05, TABLE_Y - 0.06, 0.05]} />
            </mesh>
          )),
        )}
        <mesh position={[0, 0.2, 0]} material={black}>
          <boxGeometry args={[5.7, 0.03, 0.03]} />
        </mesh>
        {/* Slots, outlined, and the blocks placed so far */}
        {SLOT_X.map((x, i) => (
          <group key={x} position={[x, TABLE_Y + 0.002, -0.05]}>
            {[
              [0.98, 0.012, 0, -0.36],
              [0.98, 0.012, 0, 0.36],
              [0.012, 0.72, -0.49, 0],
              [0.012, 0.72, 0.49, 0],
            ].map(([bw, bd, bx, bz], j) => (
              <mesh key={j} position={[bx, 0, bz]} material={flat("#a1a1aa", 0.6)}>
                <boxGeometry args={[bw, 0.003, bd]} />
              </mesh>
            ))}
            {i < placed && (
              <>
                <Text position={[0, 0.002, 0.43]} rotation-x={-Math.PI / 2} fontSize={0.09} color="#18181b" anchorX="center" anchorY="middle">
                  {BLOCKS[i]}
                </Text>
                <Text position={[0, 0.002, 0.53]} rotation-x={-Math.PI / 2} fontSize={0.05} color="#71717a" anchorX="center" anchorY="middle">
                  {`components/ui/${BLOCKS[i].toLowerCase()}.tsx`}
                </Text>
              </>
            )}
          </group>
        ))}
        {BLOCKS.slice(0, placed).map((name, i) => (
          <group key={name} ref={(g) => void (blocks.current[i] = g)} position={[SLOT_X[i], TABLE_Y, -0.05]}>
            <BlockModel name={name} />
          </group>
        ))}
        {/* The sign behind */}
        <group position={[0, 0, -0.95]}>
          {[-2.6, 2.6].map((x) => (
            <mesh key={x} position={[x, 0.75, 0]} material={black}>
              <boxGeometry args={[0.06, 1.5, 0.06]} />
            </mesh>
          ))}
          <mesh position={[0, 2.2, 0]} material={black} castShadow>
            <boxGeometry args={[5.9, 1.4, 0.06]} />
          </mesh>
          <Text position={[0, 2.5, 0.04]} fontSize={0.36} color="#fafafa" anchorX="center" anchorY="middle">
            shadcn/ui
          </Text>
          <Text position={[0, 1.95, 0.04]} fontSize={0.15} color="#a1a1aa" anchorX="center" anchorY="middle">
            {placed < BLOCKS.length ? `$ npx shadcn add ${nextName}` : "$ all set: the code is yours"}
          </Text>
        </group>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// MUI · Elevation (hero)
// ---------------------------------------------------------------------------

const ELEVATIONS = [0, 1, 2, 4, 8, 16, 24];
const MUI = "#007fff";
const SHEETS = ELEVATIONS.map((e, i) => ({
  e,
  x: -3 + i,
  y: 0.75 + Math.sqrt(e) * 0.38,
  z: 0.35 - (i - 3) ** 2 * 0.07,
  yaw: -(i - 3) * 0.1,
}));

/**
 * Seven white paper sheets floating over a pale stage in a rising stair, one per MUI elevation, each
 * casting a softer and wider shadow the higher it floats. E raises the next sheet: it springs up
 * and settles back.
 */
function MuiElevation({ w, d, toHouse }: SigProps) {
  const s = fit(w, d, 7.8, 3.6);
  const [raised, setRaised] = useState(-1);
  const raiseAt = useRef(-10);
  const sheets = useRef<(THREE.Group | null)[]>([]);
  const shadows = useRef<(THREE.Mesh | null)[]>([]);
  const { texture: shadowMap } = useCanvas(128, 128, (ctx, cw, ch) => {
    const g = ctx.createRadialGradient(cw / 2, ch / 2, 4, cw / 2, ch / 2, cw / 2);
    g.addColorStop(0, "rgba(10,25,41,0.9)");
    g.addColorStop(0.55, "rgba(10,25,41,0.35)");
    g.addColorStop(1, "rgba(10,25,41,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, ch);
  });
  const shadowMats = useMemo(
    () => SHEETS.map(() => new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false, opacity: 0.5 })),
    [shadowMap],
  );
  useDispose(shadowMats);

  const raise = () => {
    const n = (raised + 1) % SHEETS.length;
    setRaised(n);
    raiseAt.current = clock();
    sfx.pop();
    const e = ELEVATIONS[n];
    toast(`<Paper elevation={${e}} /> uses theme.shadows[${e}] (MUI has 25, from 0 to 24): the higher the elevation, the larger and softer the shadow, so the sheet reads as closer to you.`, "🟦 Elevation");
  };
  const pz = Math.min(d / 2 - 0.3, 1.4 * s + 0.8);
  const where = useWorldPoint(toHouse, 0, pz);
  useProximity({ id: "mui-elevation", label: "Raise a sheet", radius: 2.2, where, run: raise });

  useFrame(() => {
    const t = clock();
    const k = (t - raiseAt.current) / 1.4;
    SHEETS.forEach((sh, i) => {
      const lift = i === raised && k < 1 ? 0.7 * Math.sin(Math.PI * k) * (1 + 0.25 * Math.sin(3 * Math.PI * k)) : 0;
      const y = sh.y + lift + Math.sin(t * 1.2 + i) * 0.02;
      const g = sheets.current[i];
      if (g) g.position.y = y;
      const shadow = shadows.current[i];
      const h = sh.e + lift * 12;
      if (shadow) shadow.scale.set(1 + h * 0.035, 1 + h * 0.035, 1);
      shadowMats[i].opacity = sh.e === 0 && lift === 0 ? 0.05 : Math.max(0.12, 0.55 - h * 0.014);
    });
  });

  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[3.7 * s, 1, 1.25 * s]} position={[0, 1, 0]} />
      </RigidBody>
      <group scale={s} onClick={(e) => clicked(e) && raise()} {...pointer}>
        {/* The stage */}
        <mesh position={[0, 0.09, 0]} scale={[3.8, 1, 1.35]} material={flat("#ffffff", 0.45)} castShadow receiveShadow>
          <cylinderGeometry args={[1, 1, 0.18, 64]} />
        </mesh>
        <mesh position={[0, 0.02, 0]} scale={[3.86, 1, 1.4]} material={flat(MUI, 0.4)}>
          <cylinderGeometry args={[1, 1, 0.04, 64]} />
        </mesh>
        <Text position={[0, 0.09, 1.37]} fontSize={0.1} color="#0059b2" anchorX="center" anchorY="middle">
          {"<Paper elevation={n} />"}
        </Text>
        {SHEETS.map((sh, i) => (
          <group key={sh.e}>
            <mesh ref={(m) => void (shadows.current[i] = m)} position={[sh.x, 0.185, sh.z]} rotation-x={-Math.PI / 2} material={shadowMats[i]}>
              <planeGeometry args={[1.0, 0.75]} />
            </mesh>
            <group ref={(g) => void (sheets.current[i] = g)} position={[sh.x, sh.y, sh.z]} rotation-y={sh.yaw}>
              <group rotation-x={0.55}>
                <mesh material={flat("#ffffff", 0.55)} castShadow>
                  <boxGeometry args={[0.85, 0.02, 0.6]} />
                </mesh>
                <mesh position={[0, 0.011, -0.22]} rotation-x={-Math.PI / 2} material={flat(i === raised ? MUI : "#e3f2fd", 0.5)}>
                  <planeGeometry args={[0.85, 0.16]} />
                </mesh>
                <Text position={[0, 0.012, 0.05]} rotation-x={-Math.PI / 2} fontSize={0.085} color="#0a1929" anchorX="center" anchorY="middle">
                  {`elevation={${sh.e}}`}
                </Text>
              </group>
            </group>
          </group>
        ))}
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// MUI · Theme Switch Room (room)
// ---------------------------------------------------------------------------

type ModeName = "light" | "dark";
const MODE_COLORS: Record<ModeName, Record<"panel" | "sofa" | "pillow" | "rug" | "rugEdge" | "table" | "shade", THREE.Color>> = {
  light: {
    panel: new THREE.Color("#ffffff"),
    sofa: new THREE.Color("#1976d2"),
    pillow: new THREE.Color("#e3f2fd"),
    rug: new THREE.Color("#f5f5f5"),
    rugEdge: new THREE.Color("#1976d2"),
    table: new THREE.Color("#ffffff"),
    shade: new THREE.Color("#fff8e1"),
  },
  dark: {
    panel: new THREE.Color("#121212"),
    sofa: new THREE.Color("#90caf9"),
    pillow: new THREE.Color("#1e1e1e"),
    rug: new THREE.Color("#1e1e1e"),
    rugEdge: new THREE.Color("#90caf9"),
    table: new THREE.Color("#2c2c2c"),
    shade: new THREE.Color("#90caf9"),
  },
};

/**
 * A lounge whose own furniture follows the theme: a big wall toggle labelled palette.mode, and a
 * sofa, rug, coffee table, wall panel and lamp that fade between MUI's default light and dark
 * palettes when you flip it (E or click).
 */
function ThemeSwitch({ w, d, toHouse }: SigProps) {
  const [mode, setMode] = useState<ModeName>("light");
  const knob = useRef<THREE.Mesh>(null);
  const mats = useMemo(
    () => ({
      panel: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.5 }),
      sofa: new THREE.MeshStandardMaterial({ color: "#1976d2", roughness: 0.85 }),
      pillow: new THREE.MeshStandardMaterial({ color: "#e3f2fd", roughness: 0.9 }),
      rug: new THREE.MeshStandardMaterial({ color: "#f5f5f5", roughness: 1 }),
      rugEdge: new THREE.MeshStandardMaterial({ color: "#1976d2", roughness: 1 }),
      table: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.35 }),
      shade: new THREE.MeshStandardMaterial({ color: "#fff8e1", emissive: "#fff8e1", emissiveIntensity: 0.6, roughness: 0.6, toneMapped: false }),
    }),
    [],
  );
  useDispose(useMemo(() => Object.values(mats), [mats]));
  const z0 = -d / 2 + 0.12;
  const tx = -Math.min(w / 4 + 0.6, 3.4);
  const cx = Math.min(w / 6, 2.2);
  const sofaL = 2.2;

  const flip = () => {
    const next = mode === "light" ? "dark" : "light";
    setMode(next);
    sfx.click();
    burstAt(toHouse, tx, 1.5, z0 + 0.3, next === "dark" ? ["#90caf9", "#121212"] : ["#1976d2", "#ffffff"], 12);
    toast(
      next === "dark"
        ? "createTheme({ palette: { mode: 'dark' } }): background.default becomes #121212, text turns white and primary softens to #90caf9. Every component reads the theme, so the whole room follows."
        : "palette.mode: 'light' is MUI's default: background #fff, dark text and primary #1976d2.",
      "🟦 palette.mode",
    );
  };
  const where = useWorldPoint(toHouse, tx, z0 + 1.4);
  useProximity({ id: "mui-theme", label: `palette.mode = '${mode === "light" ? "dark" : "light"}'`, radius: 2, where, run: flip });

  useFrame((_, dt) => {
    const f = 1 - Math.exp(-dt * 5);
    const target = MODE_COLORS[mode];
    (Object.keys(target) as (keyof typeof target)[]).forEach((k) => mats[k].color.lerp(target[k], f));
    mats.shade.emissive.lerp(target.shade, f);
    mats.shade.emissiveIntensity += ((mode === "dark" ? 1.6 : 0.6) - mats.shade.emissiveIntensity) * f;
    if (knob.current) knob.current.position.y += ((mode === "dark" ? -0.3 : 0.3) - knob.current.position.y) * Math.min(1, dt * 10);
  });

  const metal = flat("#9e9e9e", 0.3, 0.85);
  const panelW = Math.min(3.6, w / 2 - 0.4);
  const sofaZ = z0 + 0.6;
  const dark = mode === "dark";
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[sofaL / 2 + 0.1, 0.45, 0.45]} position={[cx, 0.45, sofaZ]} />
        <CuboidCollider args={[0.55, 0.22, 0.3]} position={[cx, 0.22, sofaZ + 1.2]} />
      </RigidBody>
      {/* The toggle */}
      <group position={[tx, 1.5, z0 + 0.03]} onClick={(e) => clicked(e) && flip()} {...pointer}>
        <RoundedBox args={[0.8, 1.5, 0.06]} radius={0.05} smoothness={3} material={flat("#f3f6f9", 0.4)} castShadow />
        <RoundedBox args={[0.34, 1.0, 0.04]} radius={0.12} smoothness={3} position={[0, 0, 0.04]} material={flat(dark ? "#0a1929" : "#bbdefb", 0.5)} />
        <mesh ref={knob} position={[0, 0.3, 0.08]} rotation-x={Math.PI / 2} material={flat(MUI, 0.3, 0.2)} castShadow>
          <cylinderGeometry args={[0.15, 0.15, 0.06, 28]} />
        </mesh>
        <Text position={[0, 0.95, 0.01]} fontSize={0.13} color="#0a1929" anchorX="center" anchorY="middle">
          palette.mode
        </Text>
        <Text position={[0, -0.92, 0.01]} fontSize={0.12} color={MUI} anchorX="center" anchorY="middle">
          {`'${mode}'`}
        </Text>
      </group>
      {/* The wall panel */}
      <group position={[cx, 1.55, z0 + 0.03]}>
        <mesh material={mats.panel} receiveShadow>
          <boxGeometry args={[panelW, 2.0, 0.04]} />
        </mesh>
        <mesh position={[0, 0.88, 0.022]} material={mats.rugEdge}>
          <boxGeometry args={[panelW, 0.1, 0.01]} />
        </mesh>
        <Text position={[0, 0.62, 0.03]} fontSize={0.12} color={dark ? "#ffffff" : "#212121"} anchorX="center" anchorY="middle">
          {`background.default: ${dark ? "#121212" : "#fff"}`}
        </Text>
      </group>
      {/* The sofa */}
      <group position={[cx, 0, sofaZ]}>
        {[-1, 1].flatMap((sx) =>
          [-0.32, 0.32].map((z) => (
            <mesh key={`${sx}${z}`} position={[sx * (sofaL / 2 - 0.1), 0.07, z]} material={metal}>
              <cylinderGeometry args={[0.025, 0.02, 0.14, 8]} />
            </mesh>
          )),
        )}
        <mesh position={[0, 0.27, 0]} material={mats.sofa} castShadow>
          <boxGeometry args={[sofaL, 0.26, 0.85]} />
        </mesh>
        {[-1, 1].map((sx) => (
          <mesh key={sx} position={[sx * (sofaL / 4 - 0.02), 0.47, 0.06]} material={mats.sofa} castShadow>
            <boxGeometry args={[sofaL / 2 - 0.22, 0.14, 0.68]} />
          </mesh>
        ))}
        <mesh position={[0, 0.7, -0.33]} material={mats.sofa} castShadow>
          <boxGeometry args={[sofaL, 0.6, 0.2]} />
        </mesh>
        {[-1, 1].map((sx) => (
          <mesh key={sx} position={[sx * (sofaL / 2 - 0.09), 0.5, 0]} material={mats.sofa} castShadow>
            <boxGeometry args={[0.18, 0.5, 0.85]} />
          </mesh>
        ))}
        {[-1, 1].map((sx) => (
          <mesh key={sx} position={[sx * 0.55, 0.7, -0.17]} rotation-x={-0.2} material={mats.pillow}>
            <boxGeometry args={[0.4, 0.36, 0.1]} />
          </mesh>
        ))}
      </group>
      {/* The coffee table and the rug */}
      <group position={[cx, 0, sofaZ + 1.2]}>
        <mesh position={[0, 0.42, 0]} material={mats.table} castShadow>
          <boxGeometry args={[1.1, 0.04, 0.6]} />
        </mesh>
        {[-0.48, 0.48].flatMap((x) =>
          [-0.24, 0.24].map((z) => (
            <mesh key={`${x}${z}`} position={[x, 0.2, z]} material={metal}>
              <boxGeometry args={[0.03, 0.4, 0.03]} />
            </mesh>
          )),
        )}
      </group>
      <mesh position={[cx, 0.006, sofaZ + 0.9]} rotation-x={-Math.PI / 2} material={mats.rugEdge} receiveShadow>
        <planeGeometry args={[3.3, 2.3]} />
      </mesh>
      <mesh position={[cx, 0.008, sofaZ + 0.9]} rotation-x={-Math.PI / 2} material={mats.rug} receiveShadow>
        <planeGeometry args={[3.1, 2.1]} />
      </mesh>
      {/* The lamp */}
      <group position={[cx + sofaL / 2 + 0.5, 0, sofaZ - 0.1]}>
        <mesh position={[0, 0.02, 0]} material={metal}>
          <cylinderGeometry args={[0.16, 0.17, 0.04, 24]} />
        </mesh>
        <mesh position={[0, 0.8, 0]} material={metal}>
          <cylinderGeometry args={[0.012, 0.012, 1.56, 8]} />
        </mesh>
        <mesh position={[0, 1.62, 0]} material={mats.shade}>
          <cylinderGeometry args={[0.17, 0.23, 0.3, 24, 1, true]} />
        </mesh>
      </group>
      <TallPlant position={[-w / 2 + 0.6, 0, z0 + 0.5]} seed={4} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// daisyUI · Theme Boutique (hero)
// ---------------------------------------------------------------------------

type DaisyTheme = { name: string; base: string; base2: string; primary: string; secondary: string; accent: string; content: string; onPrimary: string };
const DAISY: DaisyTheme[] = [
  { name: "light", base: "#ffffff", base2: "#f2f2f2", primary: "#570df8", secondary: "#f000b8", accent: "#37cdbe", content: "#1f2937", onPrimary: "#ffffff" },
  { name: "cupcake", base: "#faf7f5", base2: "#efeae6", primary: "#65c3c8", secondary: "#ef9fbc", accent: "#eeaf3a", content: "#291334", onPrimary: "#291334" },
  { name: "dracula", base: "#282a36", base2: "#1e1f29", primary: "#ff79c6", secondary: "#bd93f9", accent: "#ffb86c", content: "#f8f8f2", onPrimary: "#282a36" },
  { name: "synthwave", base: "#2d1b69", base2: "#1f1150", primary: "#e779c1", secondary: "#58c7f3", accent: "#f3cc30", content: "#f9f7fd", onPrimary: "#2d1b69" },
  { name: "emerald", base: "#ffffff", base2: "#e8e8e8", primary: "#66cc8a", secondary: "#377cfb", accent: "#f68067", content: "#333c4d", onPrimary: "#223d30" },
  { name: "retro", base: "#ece3ca", base2: "#e4d8b4", primary: "#ef9995", secondary: "#a4cbb4", accent: "#dc8850", content: "#282425", onPrimary: "#282425" },
  { name: "cyberpunk", base: "#ffee00", base2: "#e6d600", primary: "#ff7598", secondary: "#75d1f0", accent: "#c07eec", content: "#1a1a1a", onPrimary: "#1a1a1a" },
];

/**
 * A round boutique podium with three standing component cards (btn, card, badge), a big floor disc
 * and a lever. E pulls the lever and the next daisyUI theme recolors the whole display, like
 * changing data-theme on <html>.
 */
function DaisyThemes({ w, d, toHouse }: SigProps) {
  const s = fit(w, d, 7, 6.8);
  const [ti, setTi] = useState(0);
  const pullAt = useRef(-10);
  const lever = useRef<THREE.Group>(null);
  const th = DAISY[ti];

  const nextTheme = () => {
    const n = (ti + 1) % DAISY.length;
    const nt = DAISY[n];
    setTi(n);
    pullAt.current = clock();
    sfx.clunk();
    burstAt(toHouse, 0, 1.4, 0.5, [nt.primary, nt.secondary, nt.accent], 18);
    toast(`<html data-theme="${nt.name}">: btn, card and badge all read the theme's CSS variables, so one attribute recolors everything. No rebuild.`, "🌼 daisyUI");
  };
  const pz = Math.min(d / 2 - 0.3, 3.3 * s + 0.3);
  const where = useWorldPoint(toHouse, 0.6 * s, Math.min(pz, 2.4 * s));
  useProximity({ id: "daisy-themes", label: "Next theme", radius: 2.4, where, run: nextTheme });

  useFrame(() => {
    const e = clock() - pullAt.current;
    if (lever.current) lever.current.rotation.x = -0.55 + (e < 0.9 ? Math.sin((e / 0.9) * Math.PI) * 1.1 : 0);
  });

  const cards = [-0.55, 0, 0.55];
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.45 * s, 0.6, 1.45 * s]} position={[0, 0.6, 0]} />
        <CuboidCollider args={[0.25 * s, 0.6, 0.25 * s]} position={[2.2 * s, 0.6, 0.6 * s]} />
      </RigidBody>
      <group scale={s} onClick={(e) => clicked(e) && nextTheme()} {...pointer}>
        {/* Floor disc and podium */}
        <mesh position={[0, 0.008, 0]} rotation-x={-Math.PI / 2} receiveShadow>
          <circleGeometry args={[3.3, 64]} />
          <meshStandardMaterial color={th.base2} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.012, 0]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[3.15, 3.3, 64]} />
          <meshStandardMaterial color={th.primary} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[1.5, 1.55, 0.5, 48]} />
          <meshStandardMaterial color={th.base} roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.51, 0]}>
          <cylinderGeometry args={[1.52, 1.52, 0.03, 48]} />
          <meshStandardMaterial color={th.primary} roughness={0.4} />
        </mesh>
        {/* Component cards */}
        {cards.map((a, i) => (
          <group key={a} position={[Math.sin(a) * 0.85, 0.52, Math.cos(a) * 0.85 - 0.6]} rotation-y={a}>
            <mesh position={[0, 0.03, 0]}>
              <boxGeometry args={[0.5, 0.06, 0.25]} />
              <meshStandardMaterial color={th.base2} roughness={0.5} />
            </mesh>
            <RoundedBox args={[0.75, 1.05, 0.05]} radius={0.04} smoothness={3} position={[0, 0.6, 0]} castShadow>
              <meshStandardMaterial color={th.base} roughness={0.45} />
            </RoundedBox>
            {i === 0 && (
              <>
                <RoundedBox args={[0.5, 0.18, 0.05]} radius={0.06} smoothness={3} position={[0, 0.6, 0.04]}>
                  <meshStandardMaterial color={th.primary} roughness={0.4} />
                </RoundedBox>
                <Text position={[0, 0.6, 0.07]} fontSize={0.08} color={th.onPrimary} anchorX="center" anchorY="middle">
                  btn
                </Text>
              </>
            )}
            {i === 1 && (
              <>
                <mesh position={[0, 0.82, 0.03]}>
                  <boxGeometry args={[0.65, 0.36, 0.01]} />
                  <meshStandardMaterial color={th.accent} roughness={0.5} />
                </mesh>
                <Text position={[0, 0.52, 0.03]} fontSize={0.08} color={th.content} anchorX="center" anchorY="middle">
                  card
                </Text>
                <RoundedBox args={[0.3, 0.1, 0.03]} radius={0.03} smoothness={2} position={[0.12, 0.25, 0.03]}>
                  <meshStandardMaterial color={th.primary} roughness={0.4} />
                </RoundedBox>
              </>
            )}
            {i === 2 && (
              <>
                <RoundedBox args={[0.36, 0.12, 0.04]} radius={0.05} smoothness={3} position={[0, 0.72, 0.035]}>
                  <meshStandardMaterial color={th.secondary} roughness={0.4} />
                </RoundedBox>
                <RoundedBox args={[0.36, 0.12, 0.04]} radius={0.05} smoothness={3} position={[0, 0.48, 0.035]}>
                  <meshStandardMaterial color={th.accent} roughness={0.4} />
                </RoundedBox>
                <Text position={[0, 0.72, 0.06]} fontSize={0.06} color={th.onPrimary} anchorX="center" anchorY="middle">
                  badge
                </Text>
                <Text position={[0, 0.48, 0.06]} fontSize={0.06} color={th.onPrimary} anchorX="center" anchorY="middle">
                  badge-accent
                </Text>
              </>
            )}
          </group>
        ))}
        {/* The data-theme sign */}
        <group position={[0, 0, -1.9]}>
          {[-1.3, 1.3].map((x) => (
            <mesh key={x} position={[x, 1.3, 0]} castShadow>
              <cylinderGeometry args={[0.04, 0.04, 2.6, 10]} />
              <meshStandardMaterial color={th.content} roughness={0.4} metalness={0.4} />
            </mesh>
          ))}
          <RoundedBox args={[2.9, 0.62, 0.06]} radius={0.05} smoothness={3} position={[0, 2.55, 0]} castShadow>
            <meshStandardMaterial color={th.base} roughness={0.45} />
          </RoundedBox>
          <Text position={[0, 2.55, 0.04]} fontSize={0.2} color={th.content} anchorX="center" anchorY="middle">
            {`data-theme="${th.name}"`}
          </Text>
        </group>
        {/* The lever */}
        <group position={[2.2, 0, 0.6]}>
          <mesh position={[0, 0.35, 0]} castShadow>
            <boxGeometry args={[0.4, 0.7, 0.4]} />
            <meshStandardMaterial color={th.base2} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.71, 0]}>
            <boxGeometry args={[0.08, 0.03, 0.3]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.5} />
          </mesh>
          <group ref={lever} position={[0, 0.7, 0]} rotation-x={-0.55}>
            <mesh position={[0, 0.35, 0]} material={flat("#c0c4ca", 0.25, 0.9)}>
              <cylinderGeometry args={[0.025, 0.025, 0.7, 10]} />
            </mesh>
            <mesh position={[0, 0.72, 0]} castShadow>
              <sphereGeometry args={[0.09, 20, 14]} />
              <meshStandardMaterial color={th.primary} roughness={0.3} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// React Native · The Phone (hero)
// ---------------------------------------------------------------------------

const RN_SCREENS = [
  { name: "List", text: "<FlatList data={items} renderItem={…} /> only renders the rows near the screen, so even long lists scroll smoothly." },
  { name: "Detail", text: "navigation.navigate('Detail', { id }) pushed a real native screen, with the platform's own transition (React Navigation's native stack)." },
  { name: "Profile", text: "Every <View> here is a real native view: a UIView on iOS, an android.view.View on Android. No WebView, no DOM." },
];
const RN_ROWS: [string, string][] = [
  ["Tripoli trip", "Flights and a hotel by the sea"],
  ["Design review", "3 screens to check"],
  ["Codi says hi", "Want to pair this afternoon?"],
  ["Market run", "Bread, za'atar, lemons"],
  ["Gym at 7", "Leg day"],
  ["Release 1.2", "Ready for the stores"],
];

/** Draws one of the phone's app screens (status bar, content and tab bar). */
function drawPhone(ctx: CanvasRenderingContext2D, cw: number, ch: number, screen: number, accent: string) {
  const ink = "#0b0d10";
  const deep = "#0a7ea4";
  ctx.fillStyle = "#f6f8fa";
  ctx.fillRect(0, 0, cw, ch);
  ctx.fillStyle = ink;
  ctx.font = font(30, "600");
  ctx.fillText("9:41", 48, 62);
  box(ctx, cw - 104, 40, 52, 24, 6, undefined, ink);
  ctx.fillStyle = ink;
  ctx.fillRect(cw - 100, 44, 38, 16);
  if (screen === 0) {
    ctx.font = font(64, "800");
    ctx.fillText("Inbox", 40, 180);
    RN_ROWS.forEach(([title, sub], i) => {
      const y = 220 + i * 122;
      box(ctx, 24, y, cw - 48, 106, 22, "#ffffff");
      ctx.fillStyle = [accent, "#f0a35e", "#8b7cf6", "#34d399", "#f472b6", deep][i];
      ctx.beginPath();
      ctx.arc(86, y + 53, 32, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ink;
      ctx.font = font(32, "700");
      ctx.fillText(title, 138, y + 46);
      ctx.fillStyle = "#6b7280";
      ctx.font = font(24);
      ctx.fillText(sub, 138, y + 82);
    });
  } else if (screen === 1) {
    ctx.fillStyle = deep;
    ctx.font = font(32, "600");
    ctx.fillText("‹ Inbox", 32, 140);
    const g = ctx.createLinearGradient(0, 170, 0, 520);
    g.addColorStop(0, accent);
    g.addColorStop(1, "#1e3a8a");
    box(ctx, 32, 170, cw - 64, 350, 28, undefined);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.fillStyle = ink;
    ctx.font = font(54, "800");
    ctx.fillText("Tripoli trip", 40, 600);
    ctx.fillStyle = "#4b5563";
    ctx.font = font(28);
    wrap(ctx, "Flights booked, a hotel by the sea and a list of places to eat. Tap Book to confirm.", 40, 660, cw - 80, 40);
    box(ctx, 40, 820, cw - 80, 96, 48, deep);
    ctx.fillStyle = "#ffffff";
    ctx.font = font(34, "700");
    ctx.textAlign = "center";
    ctx.fillText("Book", cw / 2, 880);
    ctx.textAlign = "left";
  } else {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(cw / 2, 290, 120, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ink;
    ctx.textAlign = "center";
    ctx.font = font(120, "800");
    ctx.fillText("W", cw / 2, 332);
    ctx.font = font(48, "800");
    ctx.fillText("Wouroud", cw / 2, 480);
    ctx.fillStyle = "#6b7280";
    ctx.font = font(28);
    ctx.fillText("React Native developer", cw / 2, 528);
    [
      ["1", "codebase"],
      ["2", "platforms"],
      ["3", "screens"],
    ].forEach(([n, l], i) => {
      const x = 40 + i * ((cw - 80) / 3);
      box(ctx, x + 6, 590, (cw - 80) / 3 - 12, 150, 22, "#ffffff");
      ctx.fillStyle = deep;
      ctx.font = font(54, "800");
      ctx.fillText(n, x + (cw - 80) / 6, 670);
      ctx.fillStyle = "#6b7280";
      ctx.font = font(24);
      ctx.fillText(l, x + (cw - 80) / 6, 712);
    });
    ctx.textAlign = "left";
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, ch - 150, cw, 150);
  ["List", "Detail", "Profile"].forEach((l, i) => {
    const x = cw / 6 + (i * cw) / 3;
    ctx.fillStyle = i === screen ? deep : "#9ca3af";
    ctx.beginPath();
    ctx.arc(x, ch - 105, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = font(22, "600");
    ctx.textAlign = "center";
    ctx.fillText(l, x, ch - 62);
    ctx.textAlign = "left";
  });
}

/**
 * A giant smartphone standing upright like a monolith on a dark plinth: rounded body, bezel, camera
 * notch and home bar, and a live app on its screen. E (or a click on the screen) taps: the app
 * slides to the next screen (List, Detail, Profile).
 */
function RnPhone({ w, d, toHouse }: SigProps) {
  const { palette, accent } = useHouse();
  const s = fit(w, d, 2.6, 2.8);
  const [screen, setScreen] = useState(0);
  const tapAt = useRef(-10);
  const screenMat = useRef<THREE.MeshBasicMaterial>(null);
  const { texture } = useCanvas(540, 1100, (ctx, cw, ch) => drawPhone(ctx, cw, ch, screen, accent), `${screen}|${accent}`);

  const tap = () => {
    const n = (screen + 1) % RN_SCREENS.length;
    setScreen(n);
    tapAt.current = clock();
    sfx.click();
    toast(RN_SCREENS[n].text, `📱 ${RN_SCREENS[n].name}`);
  };
  const pz = Math.min(d / 2 - 0.3, 0.9 * s + 1.0);
  const where = useWorldPoint(toHouse, 0, pz);
  useProximity({ id: "rn-phone", label: "Tap", radius: 2.2, where, run: tap });

  useFrame(() => {
    const map = screenMat.current?.map;
    if (!map) return;
    const k = Math.min(1, (clock() - tapAt.current) / 0.35);
    map.offset.x = -0.35 * (1 - k) * (1 - k);
  });

  const body = flat("#1c1f26", 0.3, 0.7);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.95 * s, 1.4, 0.5 * s]} position={[0, 1.4, 0]} />
      </RigidBody>
      <group scale={s}>
        {/* The plinth */}
        <mesh position={[0, 0.11, 0]} material={flat(palette.ink, 0.35, 0.4)} castShadow receiveShadow>
          <boxGeometry args={[1.9, 0.22, 0.9]} />
        </mesh>
        <mesh position={[0, 0.23, 0]} material={flat(accent, 0.3, 0, accent, 1.4)}>
          <boxGeometry args={[1.5, 0.02, 0.2]} />
        </mesh>
        <mesh position={[0, 0.9, -0.3]} rotation-x={0.25} material={body}>
          <boxGeometry args={[0.5, 1.3, 0.06]} />
        </mesh>
        {/* The phone */}
        <group position={[0, 0.24 + 1.3, 0]} rotation-x={-0.04}>
          <RoundedBox args={[1.25, 2.6, 0.14]} radius={0.1} smoothness={4} material={body} castShadow />
          <mesh position={[0, 0, 0.0705]} onClick={(e: ThreeEvent<MouseEvent>) => clicked(e) && tap()} {...pointer}>
            <planeGeometry args={[1.13, 2.3]} />
            <meshBasicMaterial ref={screenMat} map={texture} toneMapped={false} />
          </mesh>
          <RoundedBox args={[0.34, 0.08, 0.01]} radius={0.035} smoothness={3} position={[0, 1.08, 0.073]} material={flat("#000000", 0.3)} />
          <mesh position={[0, -1.1, 0.072]} material={flat("#0b0d10", 0.4)}>
            <boxGeometry args={[0.36, 0.022, 0.004]} />
          </mesh>
          {[0.55, 0.3].map((y) => (
            <mesh key={y} position={[-0.63, y, 0]} material={flat("#3a3f4a", 0.3, 0.8)}>
              <boxGeometry args={[0.02, 0.18, 0.05]} />
            </mesh>
          ))}
          <RoundedBox args={[0.42, 0.42, 0.04]} radius={0.06} smoothness={3} position={[-0.32, 0.95, -0.085]} material={flat("#2a2e37", 0.3, 0.6)} />
        </group>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// React Native · iOS ⟷ Android (room)
// ---------------------------------------------------------------------------

const ANDROID = "#3ddc84";
const PLATFORMS = {
  ios: "Platform.OS === 'ios' → true. iOS has no system back button: you go back with a swipe from the left edge. Shadows come from shadowColor, shadowOffset, shadowOpacity and shadowRadius.",
  android: "Platform.OS === 'android' → true. Android has a system back button (BackHandler lets you handle it), and shadows come from the elevation style.",
};

/** A small phone on a stand with a glowing screen material. */
function StandPhone({ position, screen, dark }: { position: [number, number, number]; screen: THREE.Material; dark: boolean }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.02, 0.04]} rotation-x={-0.3} material={flat("#9ca3af", 0.3, 0.8)}>
        <boxGeometry args={[0.12, 0.02, 0.12]} />
      </mesh>
      <group position={[0, 0.25, 0]} rotation-x={-0.15}>
        <RoundedBox args={[0.24, 0.48, 0.025]} radius={0.03} smoothness={3} material={flat(dark ? "#1f2937" : "#e5e7eb", 0.3, 0.6)} castShadow />
        <mesh position={[0, 0, 0.0135]} material={screen}>
          <planeGeometry args={[0.21, 0.44]} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * A room split in two: a white iOS side with rounded counters and an iPhone, a green Android side
 * with a robot statue and its phone, and a Platform.OS sign over the middle. E switches platform:
 * that side lights up and a toast names a real difference between them.
 */
function RnPlatforms({ w, d, toHouse }: SigProps) {
  const [os, setOs] = useState<"ios" | "android">("ios");
  const mats = useMemo(
    () => ({
      iosFloor: glowMaterial("#f5f5f7", "#ffffff", 0.5, 0.5),
      androidFloor: glowMaterial("#1f2b24", ANDROID, 0, 0.6),
      iosScreen: glowMaterial("#0b0d10", "#7dd3fc", 1.5, 0.2),
      androidScreen: glowMaterial("#0b0d10", ANDROID, 0.1, 0.2),
    }),
    [],
  );
  useDispose(useMemo(() => Object.values(mats), [mats]));
  const z0 = -d / 2 + 0.12;
  const ix = -w / 4;
  const ax = w / 4;
  const counterL = Math.min(w / 2 - 0.9, 2.2);

  const toggle = () => {
    const next = os === "ios" ? "android" : "ios";
    setOs(next);
    sfx.chirp();
    burstAt(toHouse, next === "ios" ? ix : ax, 1.4, z0 + 0.8, next === "ios" ? ["#ffffff", "#7dd3fc"] : [ANDROID, "#ffffff"], 14);
    toast(PLATFORMS[next], `📱 Platform.OS === '${next}'`);
  };
  const where = useWorldPoint(toHouse, 0, z0 + 1.5);
  useProximity({ id: "rn-platforms", label: `Switch to ${os === "ios" ? "Android" : "iOS"}`, radius: 2, where, run: toggle });

  useFrame((_, dt) => {
    const f = Math.min(1, dt * 5);
    const ios = os === "ios";
    mats.iosFloor.emissiveIntensity += ((ios ? 0.5 : 0) - mats.iosFloor.emissiveIntensity) * f;
    mats.androidFloor.emissiveIntensity += ((ios ? 0 : 0.35) - mats.androidFloor.emissiveIntensity) * f;
    mats.iosScreen.emissiveIntensity += ((ios ? 1.6 : 0.1) - mats.iosScreen.emissiveIntensity) * f;
    mats.androidScreen.emissiveIntensity += ((ios ? 0.1 : 1.6) - mats.androidScreen.emissiveIntensity) * f;
  });

  const green = flat(ANDROID, 0.45);
  const counter = flat("#ffffff", 0.3);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[counterL / 2, 0.48, 0.32]} position={[ix, 0.48, z0 + 0.42]} />
        <CuboidCollider args={[0.45, 0.9, 0.45]} position={[ax, 0.9, z0 + 0.75]} />
      </RigidBody>
      {/* The two floors */}
      <mesh position={[-w / 4, 0.004, 0]} rotation-x={-Math.PI / 2} material={mats.iosFloor} receiveShadow>
        <planeGeometry args={[w / 2, d]} />
      </mesh>
      <mesh position={[w / 4, 0.004, 0]} rotation-x={-Math.PI / 2} material={mats.androidFloor} receiveShadow>
        <planeGeometry args={[w / 2, d]} />
      </mesh>
      {/* The sign */}
      <group position={[0, 2.3, z0 + 0.04]} onClick={(e) => clicked(e) && toggle()} {...pointer}>
        <RoundedBox args={[2, 0.66, 0.05]} radius={0.06} smoothness={3} material={flat("#20232a", 0.4)} />
        <Text position={[0, 0.12, 0.03]} fontSize={0.18} color="#61dafb" anchorX="center" anchorY="middle">
          Platform.OS
        </Text>
        <Text position={[0, -0.14, 0.03]} fontSize={0.14} color={os === "ios" ? "#ffffff" : ANDROID} anchorX="center" anchorY="middle">
          {`=== '${os}'`}
        </Text>
      </group>
      {/* iOS: a rounded white counter with an iPhone */}
      <group position={[ix, 0, z0 + 0.42]}>
        <RoundedBox args={[counterL, 0.92, 0.62]} radius={0.12} smoothness={4} position={[0, 0.46, 0]} material={counter} castShadow receiveShadow />
        <RoundedBox args={[counterL + 0.04, 0.05, 0.66]} radius={0.02} smoothness={2} position={[0, 0.94, 0]} material={flat("#e5e7eb", 0.25)} />
        <StandPhone position={[0, 0.965, 0.05]} screen={mats.iosScreen} dark={false} />
        <Text position={[0, 0.5, 0.32]} fontSize={0.12} color="#6b7280" anchorX="center" anchorY="middle">
          iOS
        </Text>
      </group>
      {/* Android: a robot statue on a plinth, with its phone */}
      <group position={[ax, 0, z0 + 0.75]}>
        <mesh position={[0, 0.15, 0]} material={flat("#2f3540", 0.6)} castShadow receiveShadow>
          <boxGeometry args={[0.9, 0.3, 0.9]} />
        </mesh>
        {[-0.16, 0.16].map((x) => (
          <mesh key={x} position={[x, 0.46, 0]} material={green} castShadow>
            <cylinderGeometry args={[0.09, 0.09, 0.32, 14]} />
          </mesh>
        ))}
        <mesh position={[0, 0.92, 0]} material={green} castShadow>
          <cylinderGeometry args={[0.36, 0.36, 0.62, 28]} />
        </mesh>
        <mesh position={[0, 1.27, 0]} material={green} castShadow>
          <sphereGeometry args={[0.36, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        {[-0.13, 0.13].map((x) => (
          <mesh key={x} position={[x, 1.43, 0.3]} material={flat("#ffffff", 0.3)}>
            <sphereGeometry args={[0.04, 10, 8]} />
          </mesh>
        ))}
        {[-1, 1].map((sx) => (
          <mesh key={sx} position={[sx * 0.17, 1.68, 0]} rotation-z={-sx * 0.45} material={green}>
            <cylinderGeometry args={[0.018, 0.018, 0.22, 8]} />
          </mesh>
        ))}
        {[-1, 1].map((sx) => (
          <mesh key={sx} position={[sx * 0.47, 0.95, 0]} material={green} castShadow>
            <capsuleGeometry args={[0.08, 0.36, 6, 12]} />
          </mesh>
        ))}
        <Text position={[0, 0.15, 0.46]} fontSize={0.12} color={ANDROID} anchorX="center" anchorY="middle">
          Android
        </Text>
      </group>
      <group position={[ax + Math.min(0.85, w / 4 - 0.3), 0, z0 + 0.6]}>
        <mesh position={[0, 0.5, 0]} material={flat("#2f3540", 0.5)} castShadow>
          <cylinderGeometry args={[0.14, 0.18, 1, 16]} />
        </mesh>
        <StandPhone position={[0, 1.0, 0]} screen={mats.androidScreen} dark />
      </group>
    </group>
  );
}

export const FRONTEND: Record<string, SigComponent> = {
  "react-atom": ReactAtom,
  "react-hooks": HooksWardrobe,
  "next-routes": NextRoutes,
  "next-server-client": ServerClient,
  "vue-reactive-garden": ReactiveGarden,
  "vue-sfc": SfcCabinet,
  "angular-shield": AngularShield,
  "angular-armory": ServicesArmory,
  "angular-rxjs": RxjsStream,
  "shadcn-blocks": ShadcnBlocks,
  "mui-elevation": MuiElevation,
  "mui-theme": ThemeSwitch,
  "daisy-themes": DaisyThemes,
  "rn-phone": RnPhone,
  "rn-platforms": RnPlatforms,
};
