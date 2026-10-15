"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Emblem as EmblemKind, Signature } from "@/world/signatures";
import { DARK } from "./buildingTheme";
import { useGlowMaterial } from "./materials";
import { TEXT_FONT, TEXT_FONT_BOLD } from "@/world/fonts";
import { Text } from "./Text3D";

/**
 * A building's 3D logo floating over its roof: React's atom, Docker's
 * containers, FitSync's dumbbell, Jamrex's shopping bag... Built from simple
 * shapes in the item's brand color, about 2 units across before `scale`.
 * It turns slowly and bobs, and glows brighter at night.
 */
export function Emblem({ signature, y, scale }: { signature: Signature; y: number; scale: number }) {
  const group = useRef<THREE.Group>(null);
  const glow = useGlowMaterial(signature.accent, 0.55, 2.2, signature.accent);
  const light = useMemo(() => new THREE.MeshStandardMaterial({ color: "#f8f5ff", roughness: 0.35, metalness: 0.1 }), []);
  const dark = useMemo(() => new THREE.MeshStandardMaterial({ color: DARK, roughness: 0.5, metalness: 0.3 }), []);
  const phase = useMemo(() => (y * 7.3) % (Math.PI * 2), [y]);
  const calm = useMemo(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g || calm) return;
    const t = clock.elapsedTime;
    g.rotation.y = t * 0.45 + phase;
    g.position.y = y + Math.sin(t * 1.3 + phase) * 0.18 * scale;
  });
  const m = { glow, light, dark };
  return (
    <group ref={group} position={[0, y, 0]} scale={scale}>
      <Model kind={signature.emblem} text={signature.text} m={m} />
    </group>
  );
}

type Mats = { glow: THREE.Material; light: THREE.Material; dark: THREE.Material };

function M({ g, mat, p = [0, 0, 0], r = [0, 0, 0] }: { g: React.ReactNode; mat: THREE.Material; p?: number[]; r?: number[] }) {
  return (
    <mesh position={p as [number, number, number]} rotation={r as [number, number, number]} material={mat} castShadow>
      {g}
    </mesh>
  );
}

const box = (w: number, h: number, d: number) => <boxGeometry args={[w, h, d]} />;
const cyl = (rt: number, rb: number, h: number, s = 24) => <cylinderGeometry args={[rt, rb, h, s]} />;
const sph = (r: number) => <sphereGeometry args={[r, 20, 14]} />;
const tor = (r: number, t: number, s = 40) => <torusGeometry args={[r, t, 10, s]} />;

function Model({ kind, text, m }: { kind: EmblemKind; text?: string; m: Mats }) {
  switch (kind) {
    case "letters":
      return (
        <group>
          <M g={box(2.2, 1.5, 0.35)} mat={m.dark} />
          {[0.19, -0.19].map((z) => (
            <Text font={TEXT_FONT_BOLD} key={z} position={[0, 0, z]} rotation-y={z > 0 ? 0 : Math.PI} fontSize={text && text.length > 2 ? 0.62 : 0.95} material={m.glow} anchorX="center" anchorY="middle">
              {text ?? "?"}
            </Text>
          ))}
        </group>
      );
    case "atom":
      return (
        <group>
          <M g={sph(0.28)} mat={m.glow} />
          {[0, Math.PI / 3, -Math.PI / 3].map((a) => (
            <M key={a} g={tor(1, 0.06)} mat={m.glow} r={[Math.PI / 2, a, 0]} />
          ))}
        </group>
      );
    case "brackets":
      return (
        <group>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.85, 0, 0]}>
              <M g={box(0.22, 0.9, 0.25)} mat={m.glow} p={[0, 0.32, 0]} r={[0, 0, s * 0.6]} />
              <M g={box(0.22, 0.9, 0.25)} mat={m.glow} p={[0, -0.32, 0]} r={[0, 0, -s * 0.6]} />
            </group>
          ))}
          <M g={box(0.2, 1.7, 0.25)} mat={m.light} r={[0, 0, -0.35]} />
        </group>
      );
    case "layers":
      return (
        <group>
          {[0, 1, 2].map((i) => (
            <M key={i} g={box(1.6 - i * 0.3, 0.16, 1.6 - i * 0.3)} mat={i === 1 ? m.light : m.glow} p={[i * 0.12, i * 0.45 - 0.45, i * 0.12]} />
          ))}
          <M g={box(0.5, 0.5, 0.5)} mat={m.glow} p={[0.3, 0.9, 0.3]} />
        </group>
      );
    case "hexagon":
      return (
        <group>
          <M g={cyl(1, 1, 0.45, 6)} mat={m.glow} r={[Math.PI / 2, 0, 0]} />
          <M g={cyl(0.55, 0.55, 0.55, 6)} mat={m.dark} r={[Math.PI / 2, 0, 0]} />
        </group>
      );
    case "leaf":
      return (
        <group>
          <mesh material={m.glow} scale={[0.55, 1.2, 0.25]} castShadow>
            {sph(0.9)}
          </mesh>
          <M g={cyl(0.05, 0.05, 2.3, 6)} mat={m.light} />
        </group>
      );
    case "containers":
      return (
        <group>
          <M g={box(2.4, 0.5, 0.9)} mat={m.light} p={[0, -0.55, 0]} />
          {[-0.75, 0, 0.75].map((x) => (
            <M key={x} g={box(0.62, 0.5, 0.62)} mat={m.glow} p={[x, 0, 0]} />
          ))}
          {[-0.37, 0.37].map((x) => (
            <M key={x} g={box(0.62, 0.5, 0.62)} mat={m.glow} p={[x, 0.55, 0]} />
          ))}
        </group>
      );
    case "branch":
      return (
        <group>
          <M g={cyl(0.1, 0.1, 2.2, 8)} mat={m.light} p={[-0.5, 0, 0]} />
          <M g={cyl(0.1, 0.1, 1.2, 8)} mat={m.light} p={[0.05, 0.3, 0]} r={[0, 0, -0.75]} />
          {[
            [-0.5, -1],
            [-0.5, 1],
            [0.5, 0.75],
          ].map(([x, yy]) => (
            <M key={`${x}${yy}`} g={sph(0.3)} mat={m.glow} p={[x, yy, 0]} />
          ))}
        </group>
      );
    case "cylinders":
      return (
        <group>
          {[-0.6, 0, 0.6].map((yy) => (
            <M key={yy} g={cyl(0.9, 0.9, 0.42)} mat={yy === 0 ? m.light : m.glow} p={[0, yy, 0]} />
          ))}
        </group>
      );
    case "flame":
      return (
        <group>
          <M g={<coneGeometry args={[0.75, 1.9, 16]} />} mat={m.glow} p={[0, 0.2, 0]} />
          <M g={<coneGeometry args={[0.4, 1.1, 16]} />} mat={m.light} p={[0, -0.05, 0.25]} />
          <M g={sph(0.75)} mat={m.glow} p={[0, -0.75, 0]} />
        </group>
      );
    case "bolt":
      return (
        <group>
          <M g={box(0.42, 1.3, 0.3)} mat={m.glow} p={[0.15, 0.5, 0]} r={[0, 0, -0.45]} />
          <M g={box(0.9, 0.3, 0.3)} mat={m.glow} p={[0, 0, 0]} />
          <M g={box(0.42, 1.3, 0.3)} mat={m.glow} p={[-0.15, -0.5, 0]} r={[0, 0, -0.45]} />
        </group>
      );
    case "prism":
      return (
        <group>
          <M g={<coneGeometry args={[1.1, 1.9, 3]} />} mat={m.glow} />
          <M g={<coneGeometry args={[0.6, 1, 3]} />} mat={m.light} p={[0, -0.3, 0.12]} />
        </group>
      );
    case "shield":
      return (
        <group>
          <M g={box(1.5, 1.2, 0.3)} mat={m.glow} p={[0, 0.3, 0]} />
          <M g={<coneGeometry args={[1.06, 1.1, 4]} />} mat={m.glow} p={[0, -0.85, 0]} r={[Math.PI, Math.PI / 4, 0]} />
          <M g={box(0.5, 1.2, 0.36)} mat={m.light} p={[0, 0.1, 0]} />
        </group>
      );
    case "gear":
      return (
        <group rotation-x={Math.PI / 2}>
          <M g={cyl(0.85, 0.85, 0.4)} mat={m.glow} />
          <M g={cyl(0.35, 0.35, 0.5)} mat={m.dark} />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return <M key={i} g={box(0.35, 0.4, 0.4)} mat={m.glow} p={[Math.cos(a) * 1, 0, Math.sin(a) * 1]} r={[0, -a, 0]} />;
          })}
        </group>
      );
    case "palette":
      return (
        <group rotation-x={Math.PI / 2.4}>
          <M g={cyl(1.1, 1.1, 0.18, 32)} mat={m.light} />
          {["#f472b6", "#f6c453", "#5eead4", "#a78bfa", "#60a5fa"].map((c, i) => {
            const a = (i / 5) * Math.PI * 1.5 + 0.4;
            return (
              <mesh key={c} position={[Math.cos(a) * 0.7, 0.14, Math.sin(a) * 0.7]}>
                {sph(0.2)}
                <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.5} />
              </mesh>
            );
          })}
          <M g={cyl(0.08, 0.05, 2, 8)} mat={m.glow} p={[0.3, 0.4, 0]} r={[0, 0, 0.9]} />
        </group>
      );
    case "chip":
      return (
        <group>
          <M g={box(1.4, 1.4, 0.3)} mat={m.dark} />
          <M g={box(0.7, 0.7, 0.36)} mat={m.glow} />
          {[-0.45, 0, 0.45].flatMap((o) => [
            <M key={`a${o}`} g={box(0.1, 0.35, 0.1)} mat={m.glow} p={[o, 0.85, 0]} />,
            <M key={`b${o}`} g={box(0.1, 0.35, 0.1)} mat={m.glow} p={[o, -0.85, 0]} />,
            <M key={`c${o}`} g={box(0.35, 0.1, 0.1)} mat={m.glow} p={[0.85, o, 0]} />,
            <M key={`d${o}`} g={box(0.35, 0.1, 0.1)} mat={m.glow} p={[-0.85, o, 0]} />,
          ])}
        </group>
      );
    case "cloud":
      return (
        <group>
          {[
            [-0.6, -0.1, 0.55],
            [0, 0.2, 0.75],
            [0.65, -0.05, 0.5],
            [0.2, -0.3, 0.55],
          ].map(([x, yy, r]) => (
            <M key={`${x}`} g={sph(r)} mat={x === 0 ? m.light : m.glow} p={[x, yy, 0]} />
          ))}
        </group>
      );
    case "chat":
      return (
        <group>
          <mesh material={m.glow} scale={[1.2, 0.8, 0.4]} position={[-0.3, 0.3, 0]}>
            {sph(0.8)}
          </mesh>
          <mesh material={m.light} scale={[1, 0.65, 0.4]} position={[0.5, -0.45, 0.1]}>
            {sph(0.7)}
          </mesh>
          {[-0.65, -0.3, 0.05].map((x) => (
            <M key={x} g={sph(0.1)} mat={m.dark} p={[x, 0.3, 0.33]} />
          ))}
        </group>
      );
    case "target":
      return (
        <group>
          {[1.1, 0.75, 0.4].map((r, i) => (
            <M key={r} g={cyl(r, r, 0.2 + i * 0.08, 40)} mat={i % 2 ? m.light : m.glow} r={[Math.PI / 2, 0, 0]} />
          ))}
          <M g={cyl(0.04, 0.04, 1.6, 6)} mat={m.dark} p={[0.4, 0.3, 0.6]} r={[0.9, 0, -0.5]} />
        </group>
      );
    case "dumbbell":
      return (
        <group rotation-z={0.25}>
          <M g={cyl(0.12, 0.12, 2.2, 10)} mat={m.light} r={[0, 0, Math.PI / 2]} />
          {[-1, 1].map((s) => (
            <group key={s}>
              <M g={cyl(0.6, 0.6, 0.25)} mat={m.glow} p={[s * 0.75, 0, 0]} r={[0, 0, Math.PI / 2]} />
              <M g={cyl(0.48, 0.48, 0.2)} mat={m.glow} p={[s * 1, 0, 0]} r={[0, 0, Math.PI / 2]} />
            </group>
          ))}
        </group>
      );
    case "bag":
      return (
        <group>
          <M g={box(1.4, 1.3, 0.7)} mat={m.glow} />
          <M g={tor(0.4, 0.07)} mat={m.light} p={[0, 0.7, 0]} />
          <M g={box(1.42, 0.18, 0.72)} mat={m.light} p={[0, 0.45, 0]} />
        </group>
      );
    case "pulse":
      return (
        <group>
          {(
            [
              [-0.9, 0, 0.5, 0],
              [-0.45, 0.35, 0.5, 1.1],
              [-0.1, -0.2, 0.9, -1.25],
              [0.3, 0.15, 0.7, 1.2],
              [0.85, 0, 0.6, 0],
            ] as const
          ).map(([x, yy, l, r]) => (
            <M key={x} g={box(l, 0.14, 0.14)} mat={m.glow} p={[x, yy, 0]} r={[0, 0, r]} />
          ))}
          <M g={sph(0.18)} mat={m.light} p={[1.2, 0, 0]} />
        </group>
      );
    case "vault":
      return (
        <group rotation-x={Math.PI / 2}>
          <M g={cyl(1.1, 1.1, 0.35, 40)} mat={m.light} />
          <M g={cyl(0.75, 0.75, 0.42, 40)} mat={m.glow} />
          {[0, Math.PI / 3, -Math.PI / 3].map((a) => (
            <M key={a} g={box(1.3, 0.1, 0.12)} mat={m.dark} p={[0, 0.25, 0]} r={[0, a, 0]} />
          ))}
        </group>
      );
    case "planet":
      return (
        <group rotation-z={0.4}>
          <M g={sph(0.75)} mat={m.glow} />
          <M g={tor(1.15, 0.08)} mat={m.light} r={[Math.PI / 2, 0, 0]} />
        </group>
      );
    case "phone":
      return (
        <group>
          <M g={box(1, 1.9, 0.18)} mat={m.dark} />
          <M g={box(0.86, 1.6, 0.2)} mat={m.glow} />
          <M g={sph(0.07)} mat={m.light} p={[0, -0.86, 0.1]} />
        </group>
      );
    case "chart":
      return (
        <group>
          {[0.6, 1.1, 0.8, 1.6].map((h, i) => (
            <M key={i} g={box(0.38, h, 0.38)} mat={i === 3 ? m.glow : m.light} p={[-0.75 + i * 0.5, h / 2 - 0.8, 0]} />
          ))}
        </group>
      );
    case "lemon":
      return (
        <group>
          <mesh material={m.glow} scale={[1, 0.75, 0.75]}>
            {sph(0.85)}
          </mesh>
          <mesh material={m.light} scale={[0.35, 0.18, 0.18]} position={[0.95, 0, 0]}>
            {sph(0.5)}
          </mesh>
          <mesh position={[-0.6, 0.55, 0]} rotation-z={0.8} scale={[0.5, 0.2, 0.2]}>
            {sph(0.6)}
            <meshStandardMaterial color="#4ade80" />
          </mesh>
        </group>
      );
    case "candles":
      return (
        <group>
          {[0.7, 1.2, 0.9, 1.6].map((h, i) => (
            <group key={i} position={[-0.75 + i * 0.5, i * 0.15 - 0.3, 0]}>
              <M g={box(0.3, h * 0.6, 0.3)} mat={i === 2 ? m.light : m.glow} />
              <M g={box(0.05, h, 0.05)} mat={m.light} />
            </group>
          ))}
        </group>
      );
    case "laptop":
      return (
        <group>
          <M g={box(1.8, 0.1, 1.2)} mat={m.light} p={[0, -0.5, 0.3]} />
          <M g={box(1.8, 1.2, 0.08)} mat={m.dark} p={[0, 0.1, -0.3]} r={[-0.2, 0, 0]} />
          <M g={box(1.6, 1, 0.1)} mat={m.glow} p={[0, 0.1, -0.26]} r={[-0.2, 0, 0]} />
        </group>
      );
    case "heart":
      return (
        <group>
          {[-0.4, 0.4].map((x) => (
            <M key={x} g={sph(0.55)} mat={m.glow} p={[x, 0.25, 0]} />
          ))}
          <M g={<coneGeometry args={[0.95, 1.2, 24]} />} mat={m.glow} p={[0, -0.45, 0]} r={[Math.PI, 0, 0]} />
        </group>
      );
    case "people":
      return (
        <group>
          {Array.from({ length: 5 }, (_, i) => {
            const a = (i / 5) * Math.PI * 2;
            return (
              <group key={i} position={[Math.cos(a) * 0.85, 0, Math.sin(a) * 0.85]}>
                <M g={sph(0.22)} mat={m.light} p={[0, 0.45, 0]} />
                <M g={cyl(0.12, 0.3, 0.6, 12)} mat={m.glow} />
              </group>
            );
          })}
        </group>
      );
    case "rocket":
      return (
        <group rotation-z={-0.35}>
          <M g={cyl(0.38, 0.42, 1.4, 20)} mat={m.light} />
          <M g={<coneGeometry args={[0.38, 0.7, 20]} />} mat={m.glow} p={[0, 1.05, 0]} />
          <M g={sph(0.14)} mat={m.glow} p={[0, 0.25, 0.37]} />
          {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((a) => (
            <M key={a} g={box(0.08, 0.5, 0.45)} mat={m.glow} p={[Math.sin(a) * 0.42, -0.55, Math.cos(a) * 0.42]} r={[0, a, 0]} />
          ))}
          <M g={<coneGeometry args={[0.3, 0.7, 12]} />} mat={m.glow} p={[0, -1.05, 0]} r={[Math.PI, 0, 0]} />
        </group>
      );
    case "infinity":
      return (
        <group>
          {[-0.55, 0.55].map((x) => (
            <M key={x} g={tor(0.5, 0.13)} mat={m.glow} p={[x, 0, 0]} />
          ))}
        </group>
      );
    case "dots":
      return (
        <group>
          {["#ea4335", "#fbbc04", "#34a853", "#4285f4", "#a259ff"].map((c, i) => (
            <mesh key={c} position={[(i % 2) * 0.75 - 0.37, 0.75 - Math.floor(i / 2) * 0.75, 0]}>
              {sph(0.34)}
              <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.6} />
            </mesh>
          ))}
        </group>
      );
    case "stripes":
      return (
        <group>
          {[0.6, 0.3, 0, -0.3, -0.6].map((yy, i) => (
            <M key={yy} g={box(i % 2 ? 1.5 : 2, 0.16, 0.3)} mat={m.glow} p={[0, yy, 0]} />
          ))}
        </group>
      );
    case "cap":
      return (
        <group>
          <M g={box(1.8, 0.12, 1.8)} mat={m.dark} p={[0, 0.3, 0]} r={[0, Math.PI / 4, 0]} />
          <M g={cyl(0.6, 0.65, 0.5)} mat={m.dark} />
          <M g={cyl(0.03, 0.03, 0.8, 6)} mat={m.glow} p={[0.7, -0.05, 0]} />
          <M g={sph(0.1)} mat={m.glow} p={[0.7, -0.45, 0]} />
          <M g={sph(0.09)} mat={m.glow} p={[0, 0.4, 0]} />
        </group>
      );
    case "crane":
      return (
        <group>
          <M g={box(0.2, 2.2, 0.2)} mat={m.glow} />
          <M g={box(2.2, 0.16, 0.16)} mat={m.glow} p={[0.5, 1.05, 0]} />
          <M g={cyl(0.02, 0.02, 0.9, 4)} mat={m.light} p={[1.4, 0.55, 0]} />
          <M g={box(0.3, 0.3, 0.3)} mat={m.light} p={[1.4, 0.05, 0]} />
        </group>
      );
    case "clock":
      return (
        <group>
          <M g={box(1.3, 1.3, 1.3)} mat={m.light} />
          {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((a) => (
            <group key={a} rotation-y={a}>
              <M g={cyl(0.48, 0.48, 0.08, 32)} mat={m.glow} p={[0, 0, 0.66]} r={[Math.PI / 2, 0, 0]} />
              <M g={box(0.05, 0.35, 0.05)} mat={m.dark} p={[0, 0.12, 0.72]} />
              <M g={box(0.25, 0.05, 0.05)} mat={m.dark} p={[0.1, 0, 0.72]} />
            </group>
          ))}
          <M g={<coneGeometry args={[0.95, 1, 4]} />} mat={m.glow} p={[0, 1.15, 0]} r={[0, Math.PI / 4, 0]} />
        </group>
      );
    case "dome":
      return (
        <group>
          <M g={<sphereGeometry args={[0.9, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />} mat={m.glow} />
          <M g={cyl(0.9, 0.9, 0.3, 24)} mat={m.light} p={[0, -0.15, 0]} />
          <M g={cyl(0.03, 0.03, 0.6, 6)} mat={m.light} p={[0, 1.15, 0]} />
          <M g={tor(0.16, 0.04, 16)} mat={m.glow} p={[0, 1.5, 0]} r={[0, Math.PI / 2, 0]} />
        </group>
      );
    case "spire":
      return (
        <group>
          {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((a) => (
            <M key={a} g={box(0.12, 2.3, 0.12)} mat={m.glow} p={[Math.sin(a) * 0.35, 0, Math.cos(a) * 0.35]} r={[Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3]} />
          ))}
          {[-0.4, 0.3].map((yy) => (
            <M key={yy} g={box(yy < 0 ? 1 : 0.55, 0.1, yy < 0 ? 1 : 0.55)} mat={m.light} p={[0, yy, 0]} />
          ))}
          <M g={<coneGeometry args={[0.12, 0.8, 8]} />} mat={m.glow} p={[0, 1.4, 0]} />
        </group>
      );
    case "brush":
      return (
        <group rotation-z={0.6}>
          <M g={cyl(0.1, 0.1, 1.6, 10)} mat={m.light} />
          <M g={cyl(0.16, 0.12, 0.3, 10)} mat={m.dark} p={[0, 0.9, 0]} />
          <M g={<coneGeometry args={[0.2, 0.6, 12]} />} mat={m.glow} p={[0, 1.35, 0]} />
        </group>
      );
    case "yarn":
      return (
        <group>
          <M g={sph(0.85)} mat={m.glow} />
          {[0, 0.6, 1.2, 1.8, 2.4].map((a) => (
            <M key={a} g={tor(0.86, 0.035, 32)} mat={m.light} r={[a, a * 0.7, 0]} />
          ))}
          <M g={cyl(0.03, 0.03, 1.6, 6)} mat={m.dark} p={[0.4, 0.4, 0]} r={[0, 0, 0.8]} />
        </group>
      );
    case "camera":
      return (
        <group>
          <M g={box(1.7, 1.05, 0.7)} mat={m.dark} />
          <M g={cyl(0.42, 0.42, 0.5, 28)} mat={m.glow} p={[0, 0, 0.5]} r={[Math.PI / 2, 0, 0]} />
          <M g={box(0.5, 0.25, 0.4)} mat={m.light} p={[-0.45, 0.62, 0]} />
          <M g={sph(0.1)} mat={m.glow} p={[0.6, 0.6, 0]} />
        </group>
      );
    case "horseshoe":
      return (
        <group>
          <M g={<torusGeometry args={[0.8, 0.2, 12, 32, Math.PI * 1.3]} />} mat={m.glow} r={[0, 0, -Math.PI * 0.15]} />
          {[-0.5, -0.1, 0.3].map((a) => (
            <M key={a} g={sph(0.07)} mat={m.light} p={[Math.cos(a + 0.6) * 0.8, Math.sin(a + 0.6) * 0.8, 0.18]} />
          ))}
        </group>
      );
    case "books":
      return (
        <group>
          {["#60a5fa", "#f472b6", "#f6c453", "#5eead4"].map((c, i) => (
            <mesh key={c} position={[0, -0.6 + i * 0.36, 0]} rotation-y={i * 0.25}>
              {box(1.4 - i * 0.08, 0.32, 1)}
              <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.35} />
            </mesh>
          ))}
        </group>
      );
    case "pencil":
      return (
        <group rotation-z={-0.7}>
          <M g={cyl(0.22, 0.22, 1.6, 6)} mat={m.glow} />
          <M g={<coneGeometry args={[0.22, 0.5, 6]} />} mat={m.light} p={[0, -1.05, 0]} r={[Math.PI, 0, 0]} />
          <M g={cyl(0.23, 0.23, 0.25, 6)} mat={m.light} p={[0, 0.9, 0]} />
        </group>
      );
    case "poster":
      return (
        <group>
          <M g={box(1.4, 1.9, 0.12)} mat={m.light} />
          <M g={box(1.1, 1.1, 0.14)} mat={m.glow} p={[0, 0.25, 0]} />
          {[-0.5, -0.7].map((yy) => (
            <M key={yy} g={box(1, 0.08, 0.14)} mat={m.dark} p={[0, yy, 0]} />
          ))}
        </group>
      );
    case "star":
      return (
        <group>
          {Array.from({ length: 5 }, (_, i) => {
            const a = (i / 5) * Math.PI * 2;
            return <M key={i} g={<coneGeometry args={[0.32, 1, 4]} />} mat={m.glow} p={[Math.sin(a) * 0.5, Math.cos(a) * 0.5, 0]} r={[0, 0, -a]} />;
          })}
          <M g={sph(0.4)} mat={m.light} />
        </group>
      );
    case "joystick":
      return (
        <group>
          <M g={box(1.8, 0.4, 1.2)} mat={m.dark} p={[0, -0.6, 0]} />
          <M g={cyl(0.08, 0.08, 1, 8)} mat={m.light} p={[-0.3, 0, 0]} />
          <M g={sph(0.3)} mat={m.glow} p={[-0.3, 0.55, 0]} />
          {[0.35, 0.7].map((x) => (
            <M key={x} g={cyl(0.15, 0.15, 0.15, 16)} mat={m.glow} p={[x, -0.35, 0]} />
          ))}
        </group>
      );
    case "vee":
      return (
        <group>
          {[-1, 1].map((s) => (
            <group key={s}>
              <M g={box(0.45, 1.8, 0.3)} mat={m.glow} p={[s * 0.42, 0, 0]} r={[0, 0, s * 0.42]} />
              <M g={box(0.2, 1.2, 0.32)} mat={m.dark} p={[s * 0.3, 0.2, 0]} r={[0, 0, s * 0.42]} />
            </group>
          ))}
        </group>
      );
    case "kanban":
      return (
        <group>
          <M g={box(2, 1.6, 0.12)} mat={m.light} />
          {[-0.6, 0, 0.6].map((x, i) => (
            <group key={x}>
              {Array.from({ length: 3 - i }, (_, k) => (
                <M key={k} g={box(0.45, 0.3, 0.16)} mat={m.glow} p={[x, 0.5 - k * 0.42, 0.04]} />
              ))}
            </group>
          ))}
        </group>
      );
    case "dish":
      return (
        <group rotation-x={-0.5}>
          <M g={<sphereGeometry args={[1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 3.2]} />} mat={m.light} r={[Math.PI, 0, 0]} p={[0, 0.7, 0]} />
          <M g={cyl(0.04, 0.04, 0.9, 6)} mat={m.glow} p={[0, 0.25, 0]} />
          <M g={sph(0.14)} mat={m.glow} p={[0, 0.7, 0]} />
          <M g={cyl(0.1, 0.3, 0.6, 12)} mat={m.dark} p={[0, -0.6, 0]} />
        </group>
      );
    case "network":
      return (
        <group>
          {(
            [
              [0, 0.8, 0],
              [-0.8, -0.3, 0.3],
              [0.8, -0.3, 0.3],
              [0, -0.4, -0.8],
            ] as const
          ).map((p, i) => (
            <M key={i} g={sph(0.26)} mat={i ? m.glow : m.light} p={[...p]} />
          ))}
          <M g={sph(0.18)} mat={m.light} />
          {(
            [
              [0, 0.4, 0, 0, 0],
              [-0.4, -0.15, 0.15, 0.4, 1.1],
              [0.4, -0.15, 0.15, -0.4, -1.1],
            ] as const
          ).map(([x, yy, z, rx, rz], i) => (
            <M key={i} g={cyl(0.04, 0.04, 0.9, 6)} mat={m.light} p={[x, yy, z]} r={[rx, 0, rz]} />
          ))}
          <M g={cyl(0.04, 0.04, 0.9, 6)} mat={m.light} p={[0, -0.2, -0.4]} r={[Math.PI / 2.4, 0, 0]} />
        </group>
      );
    case "frame":
      return (
        <group>
          {[-0.75, 0.75].flatMap((a) =>
            [-0.75, 0.75].map((b) => <M key={`v${a}${b}`} g={box(0.1, 1.6, 0.1)} mat={m.glow} p={[a, 0, b]} />),
          )}
          {[-0.75, 0.75].flatMap((yy) => [
            ...[-0.75, 0.75].map((b) => <M key={`h${yy}${b}`} g={box(1.6, 0.1, 0.1)} mat={m.glow} p={[0, yy, b]} />),
            ...[-0.75, 0.75].map((a) => <M key={`d${yy}${a}`} g={box(0.1, 0.1, 1.6)} mat={m.glow} p={[a, yy, 0]} />),
          ])}
          <M g={box(0.7, 0.7, 0.7)} mat={m.light} />
        </group>
      );
    case "flower":
      return (
        <group>
          {Array.from({ length: 6 }, (_, i) => {
            const a = (i / 6) * Math.PI * 2;
            return (
              <mesh key={i} material={m.glow} position={[Math.cos(a) * 0.55, Math.sin(a) * 0.55, 0]} rotation-z={a} scale={[1, 0.6, 0.3]}>
                {sph(0.42)}
              </mesh>
            );
          })}
          <M g={sph(0.32)} mat={m.light} />
        </group>
      );
    case "cubes":
      return (
        <group>
          {(
            [
              [-0.5, -0.5],
              [-0.5, 0.05],
              [-0.5, 0.6],
              [0.05, -0.5],
              [0.6, -0.5],
            ] as const
          ).map(([x, yy], i) => (
            <M key={i} g={box(0.5, 0.5, 0.5)} mat={i % 2 ? m.light : m.glow} p={[x, yy, 0]} />
          ))}
        </group>
      );
  }
}
