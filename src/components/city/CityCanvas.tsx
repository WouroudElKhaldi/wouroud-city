"use client";

import { AdaptiveDpr, Environment, KeyboardControls, Lightformer, PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer, SMAA, Vignette } from "@react-three/postprocessing";
import { Physics } from "@react-three/rapier";
import type { BloomEffect } from "postprocessing";
import { Suspense, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useCityStore } from "@/state/useCityStore";
import { landmarkDoorstep } from "@/world/districts";
import { worldEnv } from "@/world/env";
import { isTouchDevice } from "@/world/touch";
import { DayNight } from "./DayNight";
import { DistrictScene } from "./DistrictScene";
import { seedContent } from "@/content/seed";
import { computeDistrictLayout } from "@/world/layout";
import { HubScene } from "./HubScene";
import { keyboardMap, Player } from "./Player";
import { GIRL_OUTFITS, GUY_OUTFIT, NPC_LOOKS } from "@/world/outfits";
import { Particles } from "./Particles";
import { PlayerSpotlight } from "./PlayerSpotlight";
import { WaypointGuide } from "./Guidance";
import { Weather } from "./Weather";
import { preloadCharacters } from "./Character";
import { preloadFoliage } from "./Foliage";
import { preloadPlaythings } from "./Playthings";

preloadFoliage();
preloadPlaythings();
preloadCharacters([...new Set([...Object.values(GIRL_OUTFITS).map((o) => o.file), GUY_OUTFIT.file, ...NPC_LOOKS.map((l) => l.file)])]);

const HUB_SPAWN: [number, number, number] = [0, 2, 12];

export default function CityCanvas() {
  const scene = useCityStore((s) => s.scene);
  const cameFrom = useCityStore((s) => s.cameFrom);
  const playerPosition = useRef(new THREE.Vector3(...HUB_SPAWN));
  // Drop to a lower resolution on slow devices instead of stuttering.
  // Phones start on a lighter preset: lower resolution and no post-processing.
  const [mobile] = useState(isTouchDevice);
  const maxDpr = mobile ? 1.25 : 1.5;
  const [dpr, setDpr] = useState(mobile ? 1 : 1.5);
  const [effects, setEffects] = useState(!mobile);

  // Where the player appears: the plaza, a landmark's doorstep when coming back, or a district's gate.
  const spawn = useMemo(() => {
    if (scene !== "hub") return { position: computeDistrictLayout(seedContent, scene).spawn, facing: Math.PI };
    if (!cameFrom) return { position: HUB_SPAWN, facing: Math.PI };
    const door = landmarkDoorstep(cameFrom);
    return { position: [door.x, 2, door.z] as [number, number, number], facing: Math.atan2(-door.x, -door.z) };
  }, [scene, cameFrom]);

  return (
    <KeyboardControls map={keyboardMap}>
      <Canvas
        shadows
        dpr={dpr}
        camera={{ fov: 55, near: 0.1, far: 1200, position: [0, 6, 30] }}
        gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
        onCreated={(state) => {
          state.gl.toneMapping = THREE.ACESFilmicToneMapping;
          state.gl.toneMappingExposure = 1.05;
          // Handy when debugging in the browser console.
          if (process.env.NODE_ENV === "development") Object.assign(window, { __city: { state, playerPosition } });
        }}
      >
        <PerformanceMonitor
          onDecline={() => {
            setDpr(1);
            setEffects(false);
          }}
          onIncline={() => setDpr(maxDpr)}
        />
        <AdaptiveDpr pixelated />
        <DayNight followTarget={playerPosition} />
        <CityEnvironment />
        <Suspense fallback={null}>
          <Physics key={scene}>
            {scene === "hub" ? <HubScene /> : <DistrictScene id={scene} />}
            <Player position={playerPosition} spawn={spawn.position} facing={spawn.facing} />
          </Physics>
        </Suspense>
        <Particles />
        <PlayerSpotlight />
        <WaypointGuide />
        <Weather />
        {effects && <Effects />}
      </Canvas>
    </KeyboardControls>
  );
}

/**
 * Soft studio lighting baked into an environment map from a few glowing panels,
 * so glass and metal reflect something violet. No HDR file to download.
 */
function CityEnvironment() {
  return (
    <Environment resolution={256} frames={1}>
      <Lightformer form="rect" intensity={2} color="#f3e8ff" position={[0, 6, -10]} scale={[20, 6, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#c4b5fd" position={[-10, 3, 0]} rotation-y={Math.PI / 2} scale={[20, 4, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#f0abfc" position={[10, 3, 0]} rotation-y={-Math.PI / 2} scale={[20, 4, 1]} />
      <Lightformer form="ring" intensity={3} color="#ffffff" position={[0, 10, 0]} rotation-x={Math.PI / 2} scale={6} />
    </Environment>
  );
}

/** Bloom makes lit windows, neon and lamps glow; it strengthens as night falls. */
function Effects() {
  const bloom = useRef<BloomEffect>(null);
  useFrame(() => {
    if (bloom.current) bloom.current.intensity = 0.35 + worldEnv.night * 1.1;
  });
  return (
    <EffectComposer multisampling={0}>
      <Bloom ref={bloom} mipmapBlur luminanceThreshold={0.85} luminanceSmoothing={0.2} intensity={0.4} radius={0.7} />
      <Vignette offset={0.25} darkness={0.55} />
      <SMAA />
    </EffectComposer>
  );
}
