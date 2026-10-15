"use client";

import { Sky, Stars } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useCityStore } from "@/state/useCityStore";
import { nightGlowMaterials, worldEnv } from "@/world/env";
import { palette } from "@/world/palette";

const SHADOW_SIZE = 40;
/** Length of a whole day in live mode, in seconds. */
const DAY_SECONDS = 20 * 60;

/**
 * Sun, moon, sky, fog and the night factor everything else reads.
 * Switching day/night eases over ~2 seconds instead of snapping.
 */
export function DayNight({
  followTarget,
  shadowMapSize = 2048,
}: {
  followTarget: React.RefObject<THREE.Vector3 | null>;
  shadowMapSize?: number;
}) {
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

  const sky = useRef<React.ComponentRef<typeof Sky>>(null);
  const sunDir = useMemo(() => new THREE.Vector3(-34, 38, -22).normalize(), []);
  const warm = useMemo(() => new THREE.Color("#ffb070"), []);
  const dusk = useMemo(() => new THREE.Color("#f2a5b8"), []);

  useFrame((_, delta) => {
    // Live mode: the sun goes round once every DAY_SECONDS; how high it is decides day and night.
    let target = timeMode === "night" ? 1 : 0;
    let golden = 0;
    if (timeMode === "live") {
      const t = (Date.now() / 1000 / DAY_SECONDS) % 1;
      const angle = t * Math.PI * 2;
      const elevation = Math.sin(angle);
      sunDir.set(Math.cos(angle) * -0.8, elevation, -0.45 + Math.cos(angle) * 0.2).normalize();
      target = THREE.MathUtils.clamp((0.08 - elevation) / 0.28, 0, 1);
      golden = Math.max(0, 1 - Math.abs(elevation - 0.05) / 0.22);
    } else {
      sunDir.set(-34, 38, -22).normalize();
    }
    worldEnv.night = THREE.MathUtils.damp(worldEnv.night, target, timeMode === "live" ? 6 : 2.2, delta);
    const n = worldEnv.night;
    const dark = n > 0.5;
    if (useCityStore.getState().dark !== dark) useCityStore.getState().setDark(dark);

    // Other components (the environment map loader) may reset these; re-own them if so.
    if (!(scene.background instanceof THREE.Color)) scene.background = new THREE.Color();
    if (!(scene.fog instanceof THREE.Fog)) scene.fog = new THREE.Fog(palette.day.fog, 70, 260);
    scene.background.lerpColors(colors.daySky, colors.nightSky, n);
    scene.fog.color.lerpColors(colors.dayFog, colors.nightFog, n);
    // Sunrise and sunset: a warm, rosy light low in the sky.
    if (golden > 0) {
      scene.background.lerp(dusk, golden * 0.45);
      scene.fog.color.lerp(dusk, golden * 0.4);
    }
    scene.environmentIntensity = THREE.MathUtils.lerp(0.42, 0.22, n);

    if (hemi.current) {
      hemi.current.color.lerpColors(colors.dayHemiSky, colors.nightHemiSky, n);
      hemi.current.groundColor.lerpColors(colors.dayHemiGround, colors.nightHemiGround, n);
      hemi.current.intensity = THREE.MathUtils.lerp(0.35, 0.4, n);
    }

    if (sun.current) {
      sun.current.color.lerpColors(colors.daySun, colors.nightSun, n);
      if (golden > 0) sun.current.color.lerp(warm, golden * 0.7);
      sun.current.intensity = THREE.MathUtils.lerp(4.2, 0.35, n) * (1 - golden * 0.35);
      // Keep the shadow camera centered on the player so shadows stay sharp everywhere.
      const p = followTarget.current;
      if (p) {
        // At night the moon lights from above the same way; keep it at least a little up.
        const up = Math.max(0.25, Math.abs(sunDir.y));
        sun.current.position.set(p.x + sunDir.x * 55, p.y + up * 55, p.z + sunDir.z * 55);
        sun.current.target.position.set(p.x, p.y, p.z);
        sun.current.target.updateMatrixWorld();
      }
    }

    if (skyGroup.current) skyGroup.current.visible = n < 0.5;
    sky.current?.material.uniforms.sunPosition?.value.copy(sunDir).multiplyScalar(400);
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
        position={[-34, 38, -22]}
        intensity={2.6}
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
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
        <Sky ref={sky} distance={4000} sunPosition={[-34, 38, -22]} turbidity={6} rayleigh={1.2} mieCoefficient={0.004} />
      </group>
      <group ref={starsGroup} visible={false}>
        <Stars radius={300} depth={80} count={4000} factor={6} saturation={0.6} fade speed={0.6} />
      </group>
    </>
  );
}
