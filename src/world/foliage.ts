/**
 * Plant catalog (species generated in code by components/city/plants.ts) and the palettes that recolor them:
 * lush greens with plenty of blossom, sunset and rainbow colors mixed in. Positions are plain data so layouts stay pure.
 */

export type FoliageKind = "tree" | "bush" | "flower" | "grass" | "mushroom" | "rock" | "stump";

export type FoliageModel = {
  /** Legacy Kenney file name, kept only as a stable id */
  file: string;
  kind: FoliageKind;
  /** Uniform scale applied to the generated model (~1 model unit ≈ 4.5 m for trees) */
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

/**
 * Leaf color palettes; each tree instance picks one color from its palette. The leaf textures are
 * near-white, so these are the real leaf colors: still lush and colorful (jacaranda lilac, cherry
 * blossom, autumn maple, golden ginkgo, blue spruce), but in natural tones.
 */
export const LEAF_PALETTES = {
  lilac: ["#a88ad8", "#9677cc", "#b69ce0", "#8c70c2"],
  blossom: ["#f4bcd4", "#eeaac8", "#f8cde0", "#e89dbd"],
  deep: ["#7a4a7e", "#6c4378", "#86548a", "#5f3c6c"],
  autumn: ["#e2a13a", "#d4862c", "#e8b44a"],
  mint: ["#9cc98a", "#8abd78", "#acd39a"],
  spring: ["#6fa84a", "#5e983e", "#7db456", "#86ba5a", "#68a046"],
  sunset: ["#d0623f", "#e08a38", "#e6a83e", "#c4513f"],
  citrus: ["#c8c24a", "#aec246", "#d6cc62", "#b8c850"],
  ocean: ["#7aa898", "#6c9e92", "#86b0a2", "#7ba6a8"],
  rainbow: ["#d888ac", "#e2a13a", "#d0c04a", "#7db456", "#7aa898", "#a88ad8"],
} as const;

export type LeafPalette = keyof typeof LEAF_PALETTES;


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
