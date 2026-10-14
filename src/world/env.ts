import type { MeshStandardMaterial } from "three";

/**
 * Per-frame world values shared by 3D components without React re-renders.
 * DayNight writes `night` (0 = full day, 1 = full night) every frame;
 * everything else reads it inside useFrame.
 */
export const worldEnv = {
  night: 0,
};

/** Materials whose glow follows the night factor (lit windows, lamp bulbs, neon signs). */
export const nightGlowMaterials = new Map<MeshStandardMaterial, { day: number; night: number }>();

export function registerNightGlow(material: MeshStandardMaterial, day: number, night: number) {
  nightGlowMaterials.set(material, { day, night });
  return () => {
    nightGlowMaterials.delete(material);
  };
}
