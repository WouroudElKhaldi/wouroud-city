"use client";

import { Environment, KeyboardControls, PerformanceMonitor, SoftShadows } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, BrightnessContrast, EffectComposer, HueSaturation, SMAA, SSAO, Vignette } from "@react-three/postprocessing";
import { Physics } from "@react-three/rapier";
import type { BloomEffect } from "postprocessing";
import { Suspense, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useCityStore } from "@/state/useCityStore";
import { type DistrictId, landmarkDoorstep } from "@/world/districts";
import { parseRoom, roomSize, type RoomScene, sceneDistrict } from "@/world/interiors";
import { worldEnv } from "@/world/env";
import { isTouchDevice } from "@/world/touch";
import { DayNight } from "./DayNight";
import { DistrictScene } from "./DistrictScene";
import { InteriorScene } from "./InteriorScene";
import { liveContent } from "@/content/live";
import { computeDistrictLayout, doorPoint } from "@/world/layout";
import { HubScene } from "./HubScene";
import { keyboardMap, Player } from "./Player";
import { Particles } from "./Particles";
import { PlayerSpotlight } from "./PlayerSpotlight";
import { WaypointGuide } from "./Guidance";
import { Weather } from "./Weather";
import { PhotoCapture } from "./PhotoCapture";
import { preloadPeople } from "./Person";
import { preloadPlaythings } from "./Playthings";

preloadPlaythings();
// Only the visitor's own body is fetched up front; the crowd streams in after the city appears
// (each walker has its own Suspense), so it never holds up the first frame.
preloadPeople([useCityStore.getState().outfit]);

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
    const room = parseRoom(scene);
    if (room) return { position: [0, 2, roomSize(room.id).depth / 2 - 4] as [number, number, number], facing: Math.PI };
    if (scene !== "hub") {
      const layout = computeDistrictLayout(liveContent, scene as DistrictId);
      // Walking out of a building puts you on its doorstep, facing away from it.
      const room = cameFrom && parseRoom(cameFrom);
      const building = room && room.district === scene && layout.buildings.find((b) => b.id === room.id);
      if (building) {
        const door = doorPoint(building, 2.4);
        return {
          position: [door.x, 2, door.z] as [number, number, number],
          facing: Math.atan2(Math.cos(building.rotY), -Math.sin(building.rotY)),
        };
      }
      return { position: layout.spawn, facing: Math.PI };
    }
    const from = cameFrom && sceneDistrict(cameFrom);
    if (!from) return { position: HUB_SPAWN, facing: Math.PI };
    const door = landmarkDoorstep(from);
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
          if (process.env.NODE_ENV === "development") Object.assign(window, { __city: { state, playerPosition, store: useCityStore } });
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
            {scene === "hub" ? <HubScene /> : parseRoom(scene) ? <InteriorScene scene={scene as RoomScene} /> : <DistrictScene id={scene as DistrictId} />}
            <Player position={playerPosition} spawn={spawn.position} facing={spawn.facing} />
          </Physics>
        </Suspense>
        <Particles />
        <PlayerSpotlight />
        <WaypointGuide />
        <Weather />
        <PhotoCapture />
        {effects && <Effects indoor={!!parseRoom(scene)} />}
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
  return <Environment files="/env/sky_512.hdr" background={false} environmentIntensity={0.9} />;
}

/**
 * Post-processing: ambient occlusion grounds everything (contact shading where
 * objects meet the ground and in corners), bloom makes lit windows, neon and
 * lamps glow at night, and a light grade adds contrast and color. Indoors the occlusion
 * is left out: at room scale its half-resolution noise speckles fine furniture and glass.
 */
function Effects({ indoor }: { indoor: boolean }) {
  const bloom = useRef<BloomEffect>(null);
  useFrame(() => {
    if (bloom.current) bloom.current.intensity = 0.35 + worldEnv.night * 1.1;
  });
  return (
    // Rebuilt when going in or out, so the normal pass exists before the occlusion needs it.
    <EffectComposer key={indoor ? "indoor" : "outdoor"} multisampling={0} enableNormalPass={!indoor}>
      {!indoor && (
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
      )}
      <Bloom ref={bloom} mipmapBlur luminanceThreshold={0.85} luminanceSmoothing={0.2} intensity={0.4} radius={0.7} />
      <HueSaturation saturation={0.1} />
      <BrightnessContrast contrast={0.07} />
      <Vignette offset={0.3} darkness={0.45} />
      <SMAA />
    </EffectComposer>
  );
}
