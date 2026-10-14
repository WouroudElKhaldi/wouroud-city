"use client";

import { Text } from "@react-three/drei";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { registerNightGlow } from "@/world/env";
import type { BuildingSpec } from "@/world/layout";
import { palette } from "@/world/palette";

/** Windows per side of the shared facade tile. */
const TILE = 6;
let facadeTextures: { color: THREE.CanvasTexture; glow: THREE.CanvasTexture } | null = null;

/**
 * A 6×6 block of windows tiled across every facade. The color map gives glass in
 * daylight; the glow map lights a random mix of windows at night (some bright,
 * some dim, some dark) so buildings look lived in rather than floodlit.
 */
function getFacadeTextures() {
  if (facadeTextures) return facadeTextures;
  const cell = 64;
  const size = cell * TILE;
  const make = () => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    return [canvas, canvas.getContext("2d")!] as const;
  };
  const [colorCanvas, color] = make();
  const [glowCanvas, glow] = make();
  color.fillStyle = "#ffffff";
  color.fillRect(0, 0, size, size);
  glow.fillStyle = "#000000";
  glow.fillRect(0, 0, size, size);

  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let row = 0; row < TILE; row++) {
    for (let col = 0; col < TILE; col++) {
      const x = col * cell + 11;
      const y = row * cell + 13;
      const w = cell - 22;
      const h = cell - 22;
      color.fillStyle = "#c7d2fe";
      color.fillRect(x, y, w, h);
      color.fillStyle = "rgba(255,255,255,0.45)";
      color.fillRect(x, y, w * 0.35, h);
      const r = random();
      const level = r < 0.3 ? 0 : r < 0.55 ? 0.35 : r < 0.85 ? 0.75 : 1;
      glow.fillStyle = `rgba(255, ${Math.round(200 + 40 * random())}, ${Math.round(150 + 60 * random())}, ${level})`;
      glow.fillRect(x, y, w, h);
    }
  }

  const finish = (canvas: HTMLCanvasElement) => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    return tex;
  };
  facadeTextures = { color: finish(colorCanvas), glow: finish(glowCanvas) };
  return facadeTextures;
}

/**
 * A data-driven building: footprint, floors and color come from the layout.
 * Windows glow at night; a neon sign at street level names it.
 */
export function Building({ spec }: { spec: BuildingSpec }) {
  const { width, depth, height, floors, color, facing } = spec;

  const material = useMemo(() => {
    const { color: colorTex, glow: glowTex } = getFacadeTextures();
    // Offset each building into a different part of the tile so neighbours don't match.
    const offset = (spec.x * 0.37 + spec.z * 0.61) % 1;
    const repeat = (t: THREE.CanvasTexture) => {
      const c = t.clone();
      c.repeat.set(Math.max(1, Math.round(width / 3)) / TILE, floors / TILE);
      c.offset.set(offset, 0);
      c.needsUpdate = true;
      return c;
    };
    return new THREE.MeshStandardMaterial({
      color,
      map: repeat(colorTex),
      emissive: palette.window,
      emissiveMap: repeat(glowTex),
      emissiveIntensity: 0,
      roughness: 0.55,
      metalness: 0.15,
    });
  }, [width, floors, color, spec.x, spec.z]);
  useEffect(() => registerNightGlow(material, 0, 0.9), [material]);

  const signMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#ffffff",
        emissive: spec.crown ? palette.magenta : palette.neon,
        emissiveIntensity: 0.4,
        toneMapped: false,
      }),
    [spec.crown],
  );
  useEffect(() => registerNightGlow(signMaterial, 0.4, 2.5), [signMaterial]);

  const frontX = (facing * width) / 2 + facing * 0.06;
  const signRotation = facing === 1 ? Math.PI / 2 : -Math.PI / 2;

  return (
    <group position={[spec.x, 0, spec.z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[width / 2, height / 2, depth / 2]} position={[0, height / 2, 0]} />
      </RigidBody>

      <mesh position={[0, height / 2, 0]} material={material} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
      </mesh>

      {/* Roof rim */}
      <mesh position={[0, height + 0.25, 0]} castShadow>
        <boxGeometry args={[width + 0.4, 0.5, depth + 0.4]} />
        <meshStandardMaterial color="#2d1f52" />
      </mesh>

      {/* Crown: a promotion at a job, or a top-level skill */}
      {spec.crown && (
        <mesh position={[0, height + 1.6, 0]} material={signMaterial}>
          <octahedronGeometry args={[Math.min(width, depth) * 0.22, 0]} />
        </mesh>
      )}

      {/* Entrance and street sign */}
      <mesh position={[frontX, 1.3, 0]} rotation-y={signRotation}>
        <planeGeometry args={[Math.min(3, depth * 0.5), 2.6]} />
        <meshStandardMaterial color="#1a103d" />
      </mesh>
      <group position={[frontX + facing * 0.02, 3.6, 0]} rotation-y={signRotation}>
        <Text
          fontSize={Math.min(1.1, (depth * 0.9) / Math.max(6, spec.label.length) * 1.6)}
          maxWidth={depth * 0.95}
          anchorX="center"
          anchorY="bottom"
          textAlign="center"
          material={signMaterial}
          outlineWidth={0.03}
          outlineColor="#1a103d"
        >
          {spec.label}
        </Text>
        <Text
          position={[0, -0.25, 0]}
          fontSize={0.38}
          maxWidth={depth * 0.95}
          anchorX="center"
          anchorY="top"
          textAlign="center"
          color="#ffffff"
          outlineWidth={0.02}
          outlineColor="#1a103d"
        >
          {spec.sublabel}
        </Text>
      </group>
    </group>
  );
}
