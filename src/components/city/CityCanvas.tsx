"use client";

import { AdaptiveDpr, KeyboardControls, PerformanceMonitor } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Suspense, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { seedContent } from "@/content/seed";
import { computeLayout } from "@/world/layout";
import { DayNight } from "./DayNight";
import { Districts } from "./Districts";
import { Ground } from "./Ground";
import { keyboardMap, Player, SPAWN } from "./Player";
import { StreetLamps, Trees } from "./StreetProps";

export default function CityCanvas() {
  const layout = useMemo(() => computeLayout(seedContent), []);
  const playerPosition = useRef(new THREE.Vector3(...SPAWN));
  // Drop to a lower resolution on slow devices instead of stuttering.
  const [dpr, setDpr] = useState(1.5);

  return (
    <KeyboardControls map={keyboardMap}>
      <Canvas
        shadows
        dpr={dpr}
        camera={{ fov: 55, near: 0.1, far: 1200, position: [0, 6, 45] }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={(state) => {
          state.gl.toneMapping = THREE.ACESFilmicToneMapping;
          state.gl.toneMappingExposure = 1.05;
          // Handy when debugging in the browser console.
          if (process.env.NODE_ENV === "development") Object.assign(window, { __city: { state, playerPosition } });
        }}
      >
        <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.5)} />
        <AdaptiveDpr pixelated />
        <DayNight followTarget={playerPosition} />
        <Suspense fallback={null}>
          <Physics>
            <Ground avenueEndZ={layout.avenueEndZ} />
            <Districts layout={layout} />
            <StreetLamps points={layout.lamps} />
            <Trees points={layout.trees} />
            <Player position={playerPosition} />
          </Physics>
        </Suspense>
      </Canvas>
    </KeyboardControls>
  );
}
