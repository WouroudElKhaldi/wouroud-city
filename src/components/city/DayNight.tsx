"use client";

import { Sky, Stars } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useCityStore } from "@/state/useCityStore";
import { nightGlowMaterials, worldEnv } from "@/world/env";
import { palette } from "@/world/palette";

const SHADOW_SIZE = 40;

/**
 * Sun, moon, sky, fog and the night factor everything else reads.
 * Switching day/night eases over ~2 seconds instead of snapping.
 */
export function DayNight({ followTarget }: { followTarget: React.RefObject<THREE.Vector3 | null> }) {
  const timeMode = useCityStore((s) => s.timeMode);
  const { scene } = useThree();
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const skyGroup = useRef<THREE.Group>(null);
  const starsGroup = useRef<THREE.Group>(null);

  const colors = useMemo(
    () => ({
      daySky: new THREE.Color(palette.day.sky),
      nightSky: new THREE.Color(palette.night.sky),
      dayFog: new THREE.Color(palette.day.fog),
      nightFog: new THREE.Color(palette.night.fog),
      dayHemiSky: new THREE.Color(palette.day.hemiSky),
      nightHemiSky: new THREE.Color(palette.night.hemiSky),
      dayHemiGround: new THREE.Color(palette.day.hemiGround),
      nightHemiGround: new THREE.Color(palette.night.hemiGround),
      daySun: new THREE.Color(palette.day.sun),
      nightSun: new THREE.Color(palette.night.sun),
    }),
    [],
  );

  useEffect(() => {
    scene.background = new THREE.Color(palette.day.sky);
    scene.fog = new THREE.Fog(palette.day.fog, 70, 260);
    return () => {
      scene.background = null;
      scene.fog = null;
    };
  }, [scene]);

  useFrame((_, delta) => {
    const target = timeMode === "night" ? 1 : 0;
    worldEnv.night = THREE.MathUtils.damp(worldEnv.night, target, 2.2, delta);
    const n = worldEnv.night;

    (scene.background as THREE.Color).lerpColors(colors.daySky, colors.nightSky, n);
    (scene.fog as THREE.Fog).color.lerpColors(colors.dayFog, colors.nightFog, n);
    scene.environmentIntensity = THREE.MathUtils.lerp(1, 0.3, n);

    if (hemi.current) {
      hemi.current.color.lerpColors(colors.dayHemiSky, colors.nightHemiSky, n);
      hemi.current.groundColor.lerpColors(colors.dayHemiGround, colors.nightHemiGround, n);
      hemi.current.intensity = THREE.MathUtils.lerp(1.6, 0.55, n);
    }

    if (sun.current) {
      sun.current.color.lerpColors(colors.daySun, colors.nightSun, n);
      sun.current.intensity = THREE.MathUtils.lerp(2.6, 0.35, n);
      // Keep the shadow camera centered on the player so shadows stay sharp everywhere.
      const p = followTarget.current;
      if (p) {
        sun.current.position.set(p.x + 30, p.y + 50, p.z + 20);
        sun.current.target.position.set(p.x, p.y, p.z);
        sun.current.target.updateMatrixWorld();
      }
    }

    if (skyGroup.current) skyGroup.current.visible = n < 0.5;
    if (starsGroup.current) starsGroup.current.visible = n > 0.25;

    for (const [material, glow] of nightGlowMaterials) {
      material.emissiveIntensity = THREE.MathUtils.lerp(glow.day, glow.night, n);
    }
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={[palette.day.hemiSky, palette.day.hemiGround, 1.6]} />
      <directionalLight
        ref={sun}
        castShadow
        position={[30, 50, 20]}
        intensity={2.6}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-left={-SHADOW_SIZE}
        shadow-camera-right={SHADOW_SIZE}
        shadow-camera-top={SHADOW_SIZE}
        shadow-camera-bottom={-SHADOW_SIZE}
        shadow-camera-near={1}
        shadow-camera-far={160}
      />
      <group ref={skyGroup}>
        <Sky distance={4000} sunPosition={[30, 40, 20]} turbidity={6} rayleigh={1.2} mieCoefficient={0.004} />
      </group>
      <group ref={starsGroup} visible={false}>
        <Stars radius={300} depth={80} count={4000} factor={6} saturation={0.6} fade speed={0.6} />
      </group>
    </>
  );
}
