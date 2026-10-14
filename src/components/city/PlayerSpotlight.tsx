"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { playerState, worldEnv } from "@/world/env";

/**
 * At night a soft spotlight follows the player from above, like a stage light,
 * with a faint glowing disc on the ground. It fades in and out with the night.
 */
export function PlayerSpotlight() {
  const light = useRef<THREE.SpotLight>(null);
  const disc = useRef<THREE.Mesh>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const discMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#ffe2b8",
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        map: makeGlowTexture(),
        toneMapped: false,
      }),
    [],
  );

  useFrame(() => {
    const p = playerState.position;
    const n = worldEnv.night;
    if (light.current) {
      light.current.position.set(p.x + 1.5, p.y + 9, p.z + 2);
      target.position.set(p.x, p.y + 0.6, p.z);
      target.updateMatrixWorld();
      light.current.intensity = n * 260;
      light.current.visible = n > 0.02;
    }
    if (disc.current) {
      disc.current.position.set(p.x, p.y + 0.03, p.z);
      disc.current.visible = n > 0.02;
    }
    discMaterial.opacity = n * 0.45;
  });

  return (
    <>
      <spotLight
        ref={light}
        target={target}
        color="#ffe6c4"
        angle={0.32}
        penumbra={0.75}
        distance={22}
        decay={2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0005}
      />
      <primitive object={target} />
      <mesh ref={disc} rotation-x={-Math.PI / 2} material={discMaterial} renderOrder={3}>
        <circleGeometry args={[2.6, 48]} />
      </mesh>
    </>
  );
}

function makeGlowTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.55, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}
