"use client";

import { PerspectiveCamera } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useCityStore } from "@/state/useCityStore";

/**
 * A cinematic welcome: the first time someone enters the city in a browser session, the camera
 * sweeps in over the mountains and the districts and lands behind them at the plaza. Any key,
 * click or touch skips it. While it plays, its own camera is the default; when it ends, the
 * follow camera takes over again.
 */

const DURATION = 7.5;
const KEY = "wouroud-city:intro-seen";

export function IntroFlyover() {
  const started = useCityStore((s) => s.started);
  const scene = useCityStore((s) => s.scene);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!started || scene !== "hub") return;
    let seen = false;
    try {
      seen = sessionStorage.getItem(KEY) === "1";
      sessionStorage.setItem(KEY, "1");
    } catch {
      // No storage: play it once per page load.
    }
    if (seen || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const begin = window.setTimeout(() => setActive(true), 0);
    const stop = () => setActive(false);
    window.addEventListener("keydown", stop, { once: true });
    window.addEventListener("pointerdown", stop, { once: true });
    return () => {
      window.clearTimeout(begin);
      window.removeEventListener("keydown", stop);
      window.removeEventListener("pointerdown", stop);
    };
    // Only the first start matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  return active ? <Flight onDone={() => setActive(false)} /> : null;
}

function Flight({ onDone }: { onDone: () => void }) {
  const camera = useRef<THREE.PerspectiveCamera>(null);
  const t = useRef(0);
  const path = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(150, 95, 210),
        new THREE.Vector3(80, 55, 90),
        new THREE.Vector3(-20, 34, 60),
        new THREE.Vector3(-14, 14, 34),
        new THREE.Vector3(0, 3.6, 19),
      ]),
    [],
  );
  const look = useMemo(() => new THREE.Vector3(), []);
  const from = useMemo(() => new THREE.Vector3(0, 6, 0), []);
  const to = useMemo(() => new THREE.Vector3(0, 1.6, 12), []);
  useFrame((_, delta) => {
    t.current += Math.min(delta, 0.1) / DURATION;
    const k = Math.min(1, t.current);
    // Ease in and out.
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const cam = camera.current;
    if (cam) {
      cam.position.copy(path.getPointAt(e));
      look.lerpVectors(from, to, Math.max(0, (e - 0.6) / 0.4));
      cam.lookAt(look);
    }
    if (k >= 1) onDone();
  });
  return <PerspectiveCamera ref={camera} makeDefault fov={55} near={0.1} far={1200} position={[150, 95, 210]} />;
}
