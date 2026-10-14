import * as THREE from "three";

/**
 * Per-frame world values shared by 3D components without React re-renders.
 * DayNight writes `night` (0 = full day, 1 = full night) every frame;
 * the Player writes its position and speed. Everything else reads them inside useFrame.
 */
export const worldEnv = {
  night: 0,
};

export const playerState = {
  position: new THREE.Vector3(0, 0, 12),
  speed: 0,
};

/** Materials whose glow follows the night factor (lit windows, lamp bulbs, neon signs). */
export const nightGlowMaterials = new Map<THREE.MeshStandardMaterial, { day: number; night: number }>();

export function registerNightGlow(material: THREE.MeshStandardMaterial, day: number, night: number) {
  nightGlowMaterials.set(material, { day, night });
  return () => {
    nightGlowMaterials.delete(material);
  };
}
