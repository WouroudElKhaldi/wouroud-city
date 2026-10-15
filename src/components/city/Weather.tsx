"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useCityStore, type Weather as WeatherKind } from "@/state/useCityStore";
import { playerState } from "@/world/env";

/**
 * Rain, snow and fog around the player. Particles live in a box that follows
 * the player, so a few thousand are enough for the whole city. Fog distances
 * ease toward each weather's values; DayNight keeps owning the fog color.
 */

const BOX = 60;
const HEIGHT = 30;
const RAIN = 2200;
const SNOW = 1800;

const FOG: Record<WeatherKind, [number, number]> = {
  clear: [70, 260],
  rain: [30, 150],
  snow: [25, 140],
  fog: [6, 60],
};

export function Weather() {
  const outside = useCityStore((s) => s.weather);
  // Indoors it stays dry and clear.
  const indoors = useCityStore((s) => s.scene.startsWith("room:"));
  const weather = indoors ? "clear" : outside;
  const { scene } = useThree();
  useFrame((_, delta) => {
    const fog = scene.fog as THREE.Fog | null;
    if (!fog) return;
    const [near, far] = FOG[weather];
    fog.near = THREE.MathUtils.damp(fog.near, near, 1.5, delta);
    fog.far = THREE.MathUtils.damp(fog.far, far, 1.5, delta);
  });
  return (
    <>
      {weather === "rain" && <Rain />}
      {weather === "snow" && <Snow />}
    </>
  );
}

function scatter(count: number, perPoint: number) {
  const positions = new Float32Array(count * perPoint * 3);
  const seeds = new Float32Array(count);
  let s = 1234567;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < count; i++) {
    const x = (rand() - 0.5) * BOX;
    const y = rand() * HEIGHT;
    const z = (rand() - 0.5) * BOX;
    for (let k = 0; k < perPoint; k++) positions.set([x, y, z], (i * perPoint + k) * 3);
    seeds[i] = rand();
  }
  return { positions, seeds };
}

/** Short slanted streaks falling fast. */
function Rain() {
  const lines = useRef<THREE.LineSegments>(null);
  const { geometry, seeds } = useMemo(() => {
    const { positions, seeds } = scatter(RAIN, 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return { geometry: g, seeds };
  }, []);
  const material = useMemo(() => new THREE.LineBasicMaterial({ color: "#7c86d9", transparent: true, opacity: 0.65 }), []);
  useFrame((_, delta) => {
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const a = pos.array as Float32Array;
    for (let i = 0; i < RAIN; i++) {
      const o = i * 6;
      let y = a[o + 1] - (22 + seeds[i] * 8) * delta;
      let x = a[o] - 2.5 * delta;
      if (y < 0) {
        y += HEIGHT;
        x = (seeds[(i * 7) % RAIN] - 0.5) * BOX;
      }
      a[o] = x;
      a[o + 1] = y;
      a[o + 3] = x + 0.12;
      a[o + 4] = y + 0.9;
      a[o + 5] = a[o + 2];
    }
    pos.needsUpdate = true;
    lines.current?.position.set(playerState.position.x, 0, playerState.position.z);
  });
  return <lineSegments ref={lines} geometry={geometry} material={material} frustumCulled={false} />;
}

/** Soft round flakes drifting down and sideways. */
function Snow() {
  const points = useRef<THREE.Points>(null);
  const { geometry, seeds } = useMemo(() => {
    const { positions, seeds } = scatter(SNOW, 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return { geometry: g, seeds };
  }, []);
  const material = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 32;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
    return new THREE.PointsMaterial({ size: 0.24, map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, color: "#ffffff" });
  }, []);
  useFrame(({ clock }, delta) => {
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const a = pos.array as Float32Array;
    const t = clock.elapsedTime;
    for (let i = 0; i < SNOW; i++) {
      const o = i * 3;
      a[o + 1] -= (1.1 + seeds[i] * 0.9) * delta;
      a[o] += Math.sin(t * 0.8 + seeds[i] * 20) * 0.6 * delta;
      if (a[o + 1] < 0) a[o + 1] += HEIGHT;
    }
    pos.needsUpdate = true;
    points.current?.position.set(playerState.position.x, 0, playerState.position.z);
  });
  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />;
}
