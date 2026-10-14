"use client";

import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useMemo } from "react";
import * as THREE from "three";
import type { DistrictId } from "@/world/districts";
import type { BuildingSpec } from "@/world/layout";
import { accents } from "@/world/palette";
import { DARK, STONE } from "./buildingTheme";
import { useGlowMaterial } from "./materials";

/**
 * Each district has its own architecture on top of the per-item signature:
 * Project Harbor has arched warehouses with shipping containers, Campus and the
 * Polyglot Quarter have pitched tiled roofs, Training Park has domed pavilions
 * with flags, the Hobby Quarter is painted with murals, the Business District
 * gets glass fins, the Arcade gets neon arches.
 */
export type RoofKind = "flat" | "gable" | "arch" | "dome";
type Props = "fins" | "containers" | "columns" | "flags" | "awning" | "murals" | "neon" | null;

export const DISTRICT_STYLE: Record<DistrictId, { roof: RoofKind; tint: number; props: Props; roofColor: string }> = {
  business: { roof: "flat", tint: 0.25, props: "fins", roofColor: DARK },
  skills: { roof: "flat", tint: 0, props: null, roofColor: DARK },
  projects: { roof: "arch", tint: 0.5, props: "containers", roofColor: "#2d1f52" },
  campus: { roof: "gable", tint: 0.15, props: "columns", roofColor: "#a4553f" },
  training: { roof: "dome", tint: 0.3, props: "flags", roofColor: "#5eead4" },
  languages: { roof: "gable", tint: 0.35, props: "awning", roofColor: "#b45d3e" },
  hobbies: { roof: "gable", tint: 0.55, props: "murals", roofColor: "#7c3aed" },
  arcade: { roof: "arch", tint: 0.3, props: "neon", roofColor: "#d53f8c" },
};

/** Style for one building: HQ towers and sawtooth workshops keep their own tops. */
export function styleFor(spec: BuildingSpec) {
  const base = DISTRICT_STYLE[spec.district];
  const ownTop = spec.variant === "hq" || spec.variant === "workshop" || spec.variant === "tower";
  // Neighborhood shops get friendly pitched roofs and awnings everywhere.
  if (spec.filler) return { ...base, roof: (spec.id.length % 2 ? "gable" : "flat") as RoofKind, props: "awning" as Props, tint: 0 };
  return { ...base, roof: ownTop ? "flat" : base.roof };
}

/** How tall a roof is, so the rooftop emblem floats above it. */
export function roofHeight(kind: RoofKind, width: number, depth: number) {
  if (kind === "gable") return Math.min(width, depth) * 0.38;
  if (kind === "arch") return depth * 0.42;
  if (kind === "dome") return Math.min(width, depth) * 0.42;
  return 0;
}

export function tinted(color: string, accent: string | undefined, amount: number) {
  if (!accent || !amount) return color;
  return "#" + new THREE.Color(color).lerp(new THREE.Color(accent), amount).getHexString();
}

export function Roof({ kind, width, depth, y, color }: { kind: RoofKind; width: number; depth: number; y: number; color: string }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.7, flatShading: true, side: THREE.DoubleSide }), [color]);
  const h = roofHeight(kind, width, depth);
  // Gable: a triangular prism whose ridge runs from the road to the back, so the road sees a gable end.
  const gable = useMemo(() => {
    if (kind !== "gable") return null;
    const half = depth / 2 + 0.5;
    const shape = new THREE.Shape([new THREE.Vector2(-half, 0), new THREE.Vector2(half, 0), new THREE.Vector2(0, h)]);
    const g = new THREE.ExtrudeGeometry(shape, { depth: width + 0.8, bevelEnabled: false });
    g.translate(0, 0, -(width + 0.8) / 2);
    g.rotateY(Math.PI / 2);
    return g;
  }, [kind, width, depth, h]);
  if (kind === "flat") return null;
  if (gable) {
    return (
      <group position={[0, y, 0]}>
        <mesh geometry={gable} material={mat} castShadow />
        <mesh position={[0, h, 0]}>
          <boxGeometry args={[width + 1, 0.22, 0.22]} />
          <meshStandardMaterial color={STONE} />
        </mesh>
      </group>
    );
  }
  if (kind === "arch") {
    // Barrel-vaulted warehouse roof; the curve shows on the road side.
    const r = depth / 2 + 0.3;
    const squash = h / r;
    return (
      <group position={[0, y, 0]} scale={[1, squash, 1]}>
        <mesh material={mat} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[r, r, width + 0.6, 24, 1, true, 0, Math.PI]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[(s * (width + 0.6)) / 2, 0, 0]} rotation={[0, s * (Math.PI / 2), 0]}>
            <circleGeometry args={[r, 24, 0, Math.PI]} />
            <meshStandardMaterial color={s > 0 ? "#f3e8ff" : color} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
    );
  }
  return (
    <group position={[0, y, 0]}>
      <mesh material={mat} castShadow>
        <sphereGeometry args={[Math.min(width, depth) * 0.42, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[Math.min(width, depth) * 0.46, Math.min(width, depth) * 0.46, 0.4, 28]} />
        <meshStandardMaterial color={STONE} />
      </mesh>
    </group>
  );
}

/** Street-level details that give each district its character. */
export function DistrictProps({ kind, spec, accent }: { kind: Props; spec: BuildingSpec; accent: string }) {
  const glow = useGlowMaterial(accent, 0.4, 2, accent);
  const { width, depth, height } = spec;
  const front = width / 2;
  switch (kind) {
    case "fins":
      // Vertical glass fins across the facade.
      return (
        <group>
          {Array.from({ length: 5 }, (_, i) => {
            const z = -depth / 2 + ((i + 0.5) * depth) / 5;
            return (
              <mesh key={i} position={[front + 0.25, height / 2 + 2, z]} castShadow>
                <boxGeometry args={[0.5, height - 3, 0.12]} />
                <meshStandardMaterial color="#c4b5fd" metalness={0.6} roughness={0.15} transparent opacity={0.75} />
              </mesh>
            );
          })}
        </group>
      );
    case "containers":
      // A stack of shipping containers beside the warehouse.
      return (
        <group position={[0, 0, depth / 2 + 2.2]}>
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider args={[1.4, 1.3, 1.1]} position={[0, 1.3, 0]} />
          </RigidBody>
          {[
            [0, 0.65, accent],
            [0, 1.95, "#f6c453"],
          ].map(([yy, , c], i) => (
            <mesh key={i} position={[0, yy as number, 0]} castShadow receiveShadow>
              <boxGeometry args={[2.8, 1.3, 2.2]} />
              <meshStandardMaterial color={c as string} roughness={0.6} />
            </mesh>
          ))}
          {[-1.1, -0.5, 0.1, 0.7].map((x) => (
            <mesh key={x} position={[x, 0.65, 1.11]}>
              <boxGeometry args={[0.08, 1.2, 0.02]} />
              <meshStandardMaterial color={DARK} />
            </mesh>
          ))}
        </group>
      );
    case "columns":
      return (
        <group>
          {[-1, -0.33, 0.33, 1].map((k) => (
            <group key={k} position={[front + 1.4, 0, (k * depth) / 2.6]}>
              <RigidBody type="fixed" colliders={false}>
                <CuboidCollider args={[0.35, 2.2, 0.35]} position={[0, 2.2, 0]} />
              </RigidBody>
              <mesh position={[0, 2.3, 0]} castShadow>
                <cylinderGeometry args={[0.32, 0.36, 4.2, 16]} />
                <meshStandardMaterial color="#f3ead8" roughness={0.6} />
              </mesh>
            </group>
          ))}
          <mesh position={[front + 1.4, 4.55, 0]} castShadow>
            <boxGeometry args={[1.2, 0.5, depth * 0.9]} />
            <meshStandardMaterial color="#f3ead8" />
          </mesh>
        </group>
      );
    case "flags":
      return (
        <group>
          {[-1, 1].map((s) => (
            <group key={s} position={[front + 1.6, 0, (s * depth) / 2.4]}>
              <mesh position={[0, 3, 0]} castShadow>
                <cylinderGeometry args={[0.06, 0.06, 6, 8]} />
                <meshStandardMaterial color="#e2e8f0" metalness={0.6} />
              </mesh>
              <mesh position={[0, 5.4, 0.55 * s]} material={glow}>
                <boxGeometry args={[0.04, 0.8, 1.1]} />
              </mesh>
            </group>
          ))}
        </group>
      );
    case "awning":
      return (
        <group position={[front + 0.7, 3.4, 0]}>
          {Array.from({ length: 6 }, (_, i) => (
            <mesh key={i} position={[0, 0, -depth * 0.35 + (i * depth * 0.7) / 5]} rotation-z={-0.35}>
              <boxGeometry args={[1.5, 0.08, (depth * 0.7) / 6]} />
              <meshStandardMaterial color={i % 2 ? "#ffffff" : accent} />
            </mesh>
          ))}
          {/* Flower boxes under the windows */}
          <mesh position={[-0.3, 1.2, 0]}>
            <boxGeometry args={[0.5, 0.35, depth * 0.6]} />
            <meshStandardMaterial color="#6b4a3a" />
          </mesh>
          {[-0.25, 0, 0.25].map((k) => (
            <mesh key={k} position={[-0.3, 1.5, k * depth]}>
              <sphereGeometry args={[0.28, 10, 8]} />
              <meshStandardMaterial color={k ? "#f472b6" : accents.gold} />
            </mesh>
          ))}
        </group>
      );
    case "murals":
      // Big painted stripes and dots on the side walls.
      return (
        <group>
          {[-1, 1].map((s) => (
            <group key={s} position={[0, 0, s * (depth / 2 + 0.03)]} rotation-y={s > 0 ? 0 : Math.PI}>
              {["#f472b6", "#f6c453", "#5eead4", "#a78bfa"].map((c, i) => (
                <mesh key={c} position={[-width / 4 + i * (width / 6), height * 0.45, 0]} rotation-z={0.5}>
                  <planeGeometry args={[width / 7, height * 0.9]} />
                  <meshStandardMaterial color={c} />
                </mesh>
              ))}
              <mesh position={[width / 5, height * 0.7, 0.01]}>
                <circleGeometry args={[Math.min(width, height) * 0.16, 24]} />
                <meshStandardMaterial color="#fde68a" emissive="#fde68a" emissiveIntensity={0.3} />
              </mesh>
            </group>
          ))}
        </group>
      );
    case "neon":
      return (
        <group position={[front + 1.2, 0, 0]}>
          {[0.6, 1].map((k) => (
            <mesh key={k} position={[0, 0, 0]} rotation-y={Math.PI / 2} material={glow}>
              <torusGeometry args={[3.6 * k, 0.1, 8, 32, Math.PI]} />
            </mesh>
          ))}
        </group>
      );
    default:
      return null;
  }
}
