"use client";

import { Environment, KeyboardControls, PerformanceMonitor, SoftShadows } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, BrightnessContrast, EffectComposer, HueSaturation, SMAA, SSAO, Vignette } from "@react-three/postprocessing";
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
import { LOOKS, NPC_PEOPLE } from "@/world/outfits";
import { Particles } from "./Particles";
import { PlayerSpotlight } from "./PlayerSpotlight";
import { WaypointGuide } from "./Guidance";
import { Weather } from "./Weather";
import { PhotoCapture } from "./PhotoCapture";
import { preloadPeople } from "./Person";
import { preloadFoliage } from "./Foliage";
import { preloadPlaythings } from "./Playthings";

preloadFoliage();
preloadPlaythings();
preloadPeople([LOOKS.girl[0].id, LOOKS.guy[0].id, ...new Set(NPC_PEOPLE.map((p) => p.id))]);

const HUB_SPAWN: [number, number, number] = [0, 2, 12];

export default function CityCanvas() {
  const scene = useCityStore((s) => s.scene);
  const cameFrom = useCityStore((s) => s.cameFrom);
  const playerPosition = useRef(new THREE.Vector3(...HUB_SPAWN));
  // Drop to a lower resolution on slow devices instead of stuttering.
  // Phones start on a lighter preset: lower resolution and no post-processing.
  const [mobile] = useState(isTouchDevice);
  // Desktop renders at the screen's real pixel density (up to 2x) for crisp edges and text.
  const [maxDpr] = useState(() => (mobile ? 1.25 : Math.min(2, typeof window === "undefined" ? 1.5 : window.devicePixelRatio || 1.5)));
  const [dpr, setDpr] = useState(mobile ? 1 : maxDpr);
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
          // Neutral tone mapping keeps the palette's colors true (ACES washes violet toward blue).
          state.gl.toneMapping = THREE.NeutralToneMapping;
          state.gl.toneMappingExposure = 1;
          // Handy when debugging in the browser console.
          if (process.env.NODE_ENV === "development") Object.assign(window, { __city: { state, playerPosition } });
        }}
      >
        <PerformanceMonitor
          onDecline={() => {
            setDpr(Math.max(1, maxDpr * 0.66));
            setEffects(false);
          }}
          onIncline={() => setDpr(maxDpr)}
        />
        {/* Soft, contact-hardening shadows (desktop): sharp near the object, soft further away. */}
        {!mobile && <SoftShadows size={10} samples={8} focus={0.8} />}
        <DayNight followTarget={playerPosition} shadowMapSize={mobile ? 1024 : 4096} />
        <CameraFill />
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
        <PhotoCapture />
        {effects && <Effects />}
      </Canvas>
    </KeyboardControls>
  );
}

/**
 * A soft fill light that comes from the camera's direction, like a photographer's
 * fill: faces and clothes stay readable even when the sun is behind them.
 */
function CameraFill() {
  const light = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ camera }) => {
    if (!light.current) return;
    light.current.position.copy(camera.position).add(new THREE.Vector3(0, 2, 0));
    camera.getWorldDirection(target.position).multiplyScalar(10).add(camera.position);
    target.updateMatrixWorld();
    light.current.intensity = 0.7 - worldEnv.night * 0.35;
  });
  return (
    <>
      <directionalLight ref={light} target={target} color="#fff4ea" intensity={0.7} />
      <primitive object={target} />
    </>
  );
}

/**
 * Image-based lighting from a real sky (Poly Haven, CC0): natural light and
 * reflections on skin, fabric, glass and metal. DayNight dims it at night.
 */
function CityEnvironment() {
  return <Environment files="/env/sky_1k.hdr" background={false} environmentIntensity={0.9} />;
}

/**
 * Post-processing: ambient occlusion grounds everything (contact shading where
 * objects meet the ground and in corners), bloom makes lit windows, neon and
 * lamps glow at night, and a light grade adds contrast and color.
 */
function Effects() {
  const bloom = useRef<BloomEffect>(null);
  useFrame(() => {
    if (bloom.current) bloom.current.intensity = 0.35 + worldEnv.night * 1.1;
  });
  return (
    <EffectComposer multisampling={0} enableNormalPass>
      <SSAO
        samples={16}
        rings={4}
        radius={0.08}
        intensity={22}
        luminanceInfluence={0.55}
        bias={0.03}
        worldDistanceThreshold={40}
        worldDistanceFalloff={10}
        worldProximityThreshold={0.6}
        worldProximityFalloff={0.2}
        resolutionScale={0.5}
        depthAwareUpsampling
        color="#1a103d"
      />
      <Bloom ref={bloom} mipmapBlur luminanceThreshold={0.85} luminanceSmoothing={0.2} intensity={0.4} radius={0.7} />
      <HueSaturation saturation={0.1} />
      <BrightnessContrast contrast={0.07} />
      <Vignette offset={0.3} darkness={0.45} />
      <SMAA />
    </EffectComposer>
  );
}
