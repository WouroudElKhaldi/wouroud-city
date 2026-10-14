/**
 * Plant catalog (Kenney Nature Kit, CC0) and the palettes that recolor them:
 * lush greens with plenty of blossom, sunset and rainbow colors mixed in. Positions are plain data so layouts stay pure.
 */

export type FoliageKind = "tree" | "bush" | "flower" | "grass" | "mushroom" | "rock" | "stump";

export type FoliageModel = {
  file: string;
  kind: FoliageKind;
  /** Uniform scale applied to the source model (Kenney models are ~1 unit tall) */
  scale: number;
  /** Trunk collider radius in world units, for things you can't walk through */
  collider?: number;
};

export const FOLIAGE: Record<string, FoliageModel> = {
  oak: { file: "tree_oak", kind: "tree", scale: 4.6, collider: 0.45 },
  round: { file: "tree_default", kind: "tree", scale: 4, collider: 0.4 },
  detailed: { file: "tree_detailed", kind: "tree", scale: 4.2, collider: 0.45 },
  fat: { file: "tree_fat", kind: "tree", scale: 4.8, collider: 0.45 },
  plateau: { file: "tree_plateau", kind: "tree", scale: 4.6, collider: 0.4 },
  blocks: { file: "tree_blocks", kind: "tree", scale: 4.4, collider: 0.4 },
  cone: { file: "tree_cone", kind: "tree", scale: 4.2, collider: 0.4 },
  simple: { file: "tree_simple", kind: "tree", scale: 4, collider: 0.35 },
  small: { file: "tree_small", kind: "tree", scale: 3.6, collider: 0.3 },
  tall: { file: "tree_tall", kind: "tree", scale: 4.2, collider: 0.35 },
  thin: { file: "tree_thin", kind: "tree", scale: 4.2, collider: 0.35 },
  palm: { file: "tree_palmTall", kind: "tree", scale: 4.6, collider: 0.35 },
  palmBend: { file: "tree_palmBend", kind: "tree", scale: 4.6, collider: 0.35 },
  palmShort: { file: "tree_palmDetailedShort", kind: "tree", scale: 4.4, collider: 0.35 },
  pineRound: { file: "tree_pineRoundA", kind: "tree", scale: 5, collider: 0.4 },
  pineRoundC: { file: "tree_pineRoundC", kind: "tree", scale: 5.2, collider: 0.4 },
  pineTall: { file: "tree_pineTallA_detailed", kind: "tree", scale: 5.2, collider: 0.35 },
  pineSmall: { file: "tree_pineSmallA", kind: "tree", scale: 4.6, collider: 0.35 },
  pine: { file: "tree_pineDefaultA", kind: "tree", scale: 5, collider: 0.4 },
  bush: { file: "plant_bush", kind: "bush", scale: 4 },
  bushDetailed: { file: "plant_bushDetailed", kind: "bush", scale: 3.6 },
  bushLarge: { file: "plant_bushLarge", kind: "bush", scale: 4.4 },
  bushSmall: { file: "plant_bushSmall", kind: "bush", scale: 3.6 },
  bushTriangle: { file: "plant_bushTriangle", kind: "bush", scale: 4 },
  flowerPurpleA: { file: "flower_purpleA", kind: "flower", scale: 3.4 },
  flowerPurpleB: { file: "flower_purpleB", kind: "flower", scale: 3.4 },
  flowerPurpleC: { file: "flower_purpleC", kind: "flower", scale: 3.4 },
  flowerRed: { file: "flower_redA", kind: "flower", scale: 3.4 },
  flowerYellowA: { file: "flower_yellowA", kind: "flower", scale: 3.4 },
  flowerYellowB: { file: "flower_yellowB", kind: "flower", scale: 3.4 },
  grass: { file: "grass", kind: "grass", scale: 3.6 },
  grassLarge: { file: "grass_large", kind: "grass", scale: 3.6 },
  grassLeafs: { file: "grass_leafs", kind: "grass", scale: 4 },
  mushroomRed: { file: "mushroom_redGroup", kind: "mushroom", scale: 3.4 },
  mushroomTan: { file: "mushroom_tanGroup", kind: "mushroom", scale: 3.4 },
  mushroom: { file: "mushroom_red", kind: "mushroom", scale: 3.6 },
  rockA: { file: "rock_smallA", kind: "rock", scale: 3.2 },
  rockC: { file: "rock_smallC", kind: "rock", scale: 3.4 },
  rockFlat: { file: "rock_smallFlatA", kind: "rock", scale: 3.6 },
  rockLarge: { file: "rock_largeA", kind: "rock", scale: 3.4 },
  stump: { file: "stump_round", kind: "stump", scale: 3.6 },
  log: { file: "log", kind: "stump", scale: 3.6 },
  logStack: { file: "log_stack", kind: "stump", scale: 3.4 },
};

export type FoliageKey = keyof typeof FOLIAGE;

/** Leaf color palettes; each tree instance picks one color from its palette. */
export const LEAF_PALETTES = {
  lilac: ["#b794f4", "#9f7aea", "#c4b5fd", "#a78bfa"],
  blossom: ["#f9a8d4", "#f0abfc", "#fbcfe8", "#f5d0fe"],
  deep: ["#6d28d9", "#7c3aed", "#5b21b6", "#8b5cf6"],
  autumn: ["#fbbf24", "#f59e0b", "#fb923c"],
  mint: ["#86efac", "#6ee7b7", "#a7f3d0"],
  spring: ["#4ade80", "#22c55e", "#84cc16", "#a3e635", "#34d399"],
  sunset: ["#fb7185", "#f97316", "#fbbf24", "#f472b6"],
  citrus: ["#facc15", "#a3e635", "#fde047", "#bef264"],
  ocean: ["#38bdf8", "#2dd4bf", "#60a5fa", "#5eead4"],
  rainbow: ["#f472b6", "#fb923c", "#facc15", "#4ade80", "#38bdf8", "#a78bfa"],
} as const;

export type LeafPalette = keyof typeof LEAF_PALETTES;

/** Material names (from the Kenney files) that count as leaves and get recolored. */
export const LEAF_MATERIALS = ["leafsGreen", "leafsDark", "grass"];

export type FoliageItem = {
  key: FoliageKey;
  x: number;
  z: number;
  /** Height of the ground under it (planters, rooftops); defaults to 0 */
  y?: number;
  rot: number;
  /** Multiplier on the model's base scale */
  size: number;
  palette?: LeafPalette;
};

/** Small deterministic random generator so layouts are identical on every visit. */
export function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

export function pick<T>(random: () => number, list: readonly T[]): T {
  return list[Math.floor(random() * list.length)];
}

const UNDERGROWTH: FoliageKey[] = [
  "flowerPurpleA",
  "flowerPurpleB",
  "flowerPurpleC",
  "flowerRed",
  "flowerYellowA",
  "flowerYellowB",
  "bushSmall",
  "grass",
  "grassLarge",
  "grassLeafs",
  "mushroomRed",
  "mushroomTan",
  "rockA",
  "rockC",
];

/** Scatter a few small plants around a tree trunk. */
export function undergrowth(random: () => number, x: number, z: number, count: number): FoliageItem[] {
  return Array.from({ length: count }, () => {
    const a = random() * Math.PI * 2;
    const r = 1.2 + random() * 2.2;
    return {
      key: pick(random, UNDERGROWTH),
      x: x + Math.cos(a) * r,
      z: z + Math.sin(a) * r,
      rot: random() * Math.PI * 2,
      size: 0.8 + random() * 0.5,
      palette: "mint" as const,
    };
  });
}
