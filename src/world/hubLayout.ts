import { DISTRICTS, HUB, landmarkPlacement } from "./districts";
import { type FoliageItem, type FoliageKey, type LeafPalette, pick, seeded, undergrowth } from "./foliage";
import type { LampSpot } from "./layout";

/**
 * The hub: Central Plaza in the middle, one road per district running out to its
 * landmark, lamps along the roads and a park of trees filling the space between.
 */

export type Road = { x: number; z: number; rotationY: number; length: number };

export type HubLayout = {
  roads: Road[];
  lamps: LampSpot[];
  foliage: FoliageItem[];
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

  return { roads, lamps, foliage: [...scatterTrees(), ...flowerBeds()] };
}

/** Deterministic tree scatter that keeps clear of the plaza, the roads and the landmarks. */
function scatterTrees(): FoliageItem[] {
  const trees: [number, number][] = [];
  const out: FoliageItem[] = [];
  const decor = seeded(29);
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
    // Keep the Corniche (the seaside promenade along the south edge) clear.
    if (z > WORLD_HALF - 17 && Math.abs(x) < 126) continue;
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
    const { key, palette } = treeFor(x, z, r, decor);
    out.push({ key, x, z, rot: decor() * Math.PI * 2, size: 0.85 + decor() * 0.45, palette });
    if (decor() < 0.45) out.push(...undergrowth(decor, x, z, 1 + Math.floor(decor() * 3)));
  }
  return out;
}

/**
 * Tree families by area: cherry blossoms near the plaza, lilac broadleaves in the
 * middle ring, deep violet pines on the outskirts, palms around the harbor and the
 * arcade pier, and a sprinkle of golden autumn trees for contrast.
 */
function treeFor(x: number, z: number, r: number, random: () => number): { key: FoliageKey; palette: LeafPalette } {
  const harbor = landmarkPlacement("projects");
  const arcade = landmarkPlacement("arcade");
  const nearCoast = [harbor, arcade].some((p) => Math.hypot(x - p.x, z - p.z) < 36);
  if (nearCoast && random() < 0.7) return { key: pick(random, ["palm", "palmBend", "palmShort"] as const), palette: "mint" };
  if (random() < 0.12) return { key: pick(random, ["oak", "fat", "round"] as const), palette: pick(random, ["autumn", "sunset"] as const) };
  if (r < 48)
    return { key: pick(random, ["oak", "fat", "round", "detailed", "small"] as const), palette: pick(random, ["blossom", "rainbow", "spring", "sunset"] as const) };
  if (r < 105)
    return {
      key: pick(random, ["round", "detailed", "plateau", "blocks", "cone", "simple", "tall", "thin"] as const),
      palette: pick(random, ["spring", "spring", "rainbow", "lilac", "blossom", "citrus", "ocean", "sunset"] as const),
    };
  return { key: pick(random, ["pineRound", "pineRoundC", "pineTall", "pineSmall", "pine"] as const), palette: pick(random, ["spring", "spring", "deep", "ocean"] as const) };
}

/** Lawns in the hub: not the plaza, the roads or the landmark platforms. */
export function isHubLawn(x: number, z: number) {
  const r = Math.hypot(x, z);
  if (r < HUB.plazaRadius + 1.5) return false;
  for (const d of DISTRICTS) {
    const s = landmarkPlacement(d.id);
    if (Math.hypot(x - s.x, z - s.z) < HUB.landmarkRadius + 2) return false;
    const along = x * Math.cos(s.angle) + z * Math.sin(s.angle);
    const across = Math.abs(-x * Math.sin(s.angle) + z * Math.cos(s.angle));
    if (along > 0 && along < HUB.ringRadius && across < HUB.roadHalfWidth + 1.5) return false;
  }
  return true;
}

/** Flower beds and hedges around the plaza, between the road openings. */
function flowerBeds(): FoliageItem[] {
  const random = seeded(5);
  const out: FoliageItem[] = [];
  const spokes = DISTRICTS.map((d) => landmarkPlacement(d.id).angle);
  const flowers: FoliageKey[] = ["flowerPurpleA", "flowerPurpleB", "flowerPurpleC", "flowerRed", "flowerYellowA", "flowerYellowB"];
  for (let i = 0; i < 220; i++) {
    const a = random() * Math.PI * 2;
    const gap = Math.min(...spokes.map((s) => Math.abs(Math.atan2(Math.sin(a - s), Math.cos(a - s)))));
    if (gap < 0.32) continue;
    const r = HUB.plazaRadius + 2 + random() * 4.5;
    out.push({
      key: random() < 0.82 ? pick(random, flowers) : pick(random, ["bushSmall", "bush", "bushDetailed"] as const),
      x: Math.cos(a) * r,
      z: Math.sin(a) * r,
      rot: random() * Math.PI * 2,
      size: 0.9 + random() * 0.5,
      palette: "mint",
    });
  }
  return out;
}
