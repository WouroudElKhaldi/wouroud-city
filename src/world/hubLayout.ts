import { DISTRICTS, HUB, landmarkPlacement } from "./districts";
import type { LampSpot } from "./layout";

/**
 * The hub: Central Plaza in the middle, one road per district running out to its
 * landmark, lamps along the roads and a park of trees filling the space between.
 */

export type Road = { x: number; z: number; rotationY: number; length: number };

export type HubLayout = {
  roads: Road[];
  lamps: LampSpot[];
  trees: [number, number][];
};

export const WORLD_HALF = 200;

export function computeHubLayout(): HubLayout {
  const roads: Road[] = [];
  const lamps: LampSpot[] = [];
  const roadStart = HUB.plazaRadius - 1;
  const roadEnd = HUB.ringRadius - HUB.landmarkRadius + 1;

  for (const d of DISTRICTS) {
    const { angle, rotationY } = landmarkPlacement(d.id);
    const dir = { x: Math.cos(angle), z: Math.sin(angle) };
    const mid = (roadStart + roadEnd) / 2;
    roads.push({ x: dir.x * mid, z: dir.z * mid, rotationY, length: roadEnd - roadStart });

    // Lamps on both sides, arms reaching over the road.
    const perp = { x: -dir.z, z: dir.x };
    for (let r = roadStart + 6; r < roadEnd - 2; r += 11) {
      for (const side of [-1, 1]) {
        const off = HUB.roadHalfWidth + 0.9;
        const x = dir.x * r + perp.x * off * side;
        const z = dir.z * r + perp.z * off * side;
        // Arm points back toward the road center line.
        const ax = -perp.x * side;
        const az = -perp.z * side;
        lamps.push({ x, z, rot: Math.atan2(-az, ax) });
      }
    }
  }

  // Lamps around the plaza edge, skipping the road openings.
  const plazaLamps = 24;
  const spokeAngles = DISTRICTS.map((d) => landmarkPlacement(d.id).angle);
  for (let i = 0; i < plazaLamps; i++) {
    const a = (i / plazaLamps) * Math.PI * 2;
    const gap = Math.min(...spokeAngles.map((s) => Math.abs(Math.atan2(Math.sin(a - s), Math.cos(a - s)))));
    if (gap < 0.3) continue;
    const r = HUB.plazaRadius + 0.6;
    lamps.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, rot: Math.atan2(Math.sin(a), -Math.cos(a)) });
  }

  return { roads, lamps, trees: scatterTrees() };
}

/** Deterministic tree scatter that keeps clear of the plaza, the roads and the landmarks. */
function scatterTrees(): [number, number][] {
  const trees: [number, number][] = [];
  const spokes = DISTRICTS.map((d) => landmarkPlacement(d.id));
  let seed = 11;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 900 && trees.length < 240; i++) {
    const a = random() * Math.PI * 2;
    const r = HUB.plazaRadius + 5 + Math.sqrt(random()) * 150;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (Math.abs(x) > WORLD_HALF - 6 || Math.abs(z) > WORLD_HALF - 6) continue;
    const nearRoad = spokes.some((s) => {
      // Distance from the point to the spoke's center line, only up to the landmark.
      const along = x * Math.cos(s.angle) + z * Math.sin(s.angle);
      const across = Math.abs(-x * Math.sin(s.angle) + z * Math.cos(s.angle));
      return along > 0 && along < HUB.ringRadius && across < HUB.roadHalfWidth + 4;
    });
    const nearLandmark = spokes.some((s) => Math.hypot(x - s.x, z - s.z) < HUB.landmarkRadius + 5);
    if (nearRoad || nearLandmark) continue;
    if (trees.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 4.5)) continue;
    trees.push([x, z]);
  }
  return trees;
}
