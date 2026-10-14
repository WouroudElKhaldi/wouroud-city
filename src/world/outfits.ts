import type { PersonFile } from "@/components/city/Character";

/**
 * Outfits for the player's avatar and the city's people. Each outfit is a
 * Quaternius character plus colors for its clothing materials, in the city's
 * violet / gold / mint palette.
 *
 * `modest` lists the extra layers that make an outfit fully covering: sleeves to
 * the wrists and, for dresses, an ankle-length skirt. They are always applied
 * when a hijab is worn.
 */
export type Outfit = {
  label: string;
  file: PersonFile;
  colors: Record<string, string>;
  modest: { sleeves?: string; skirt?: string };
  /** Apply the modest layers even without a hijab (e.g. a long dress is always long) */
  alwaysModest?: boolean;
};

/** Natural, warm skin tones. */
export const SKIN_TONES = ["#f2d1bd", "#e8bb9a", "#d9a07c", "#b97a56", "#8d5a3e", "#6b4230"] as const;

/** Wouroud's avatar skin tone. */
const SKIN = "#eab48f";

export const GIRL_OUTFITS: Record<"dress" | "blazer" | "casual", Outfit> = {
  dress: {
    label: "Long dress",
    file: "female-dress",
    colors: { Dress: "#6d28d9", Shoes: "#2d1f52", Skin: SKIN },
    modest: { sleeves: "#6d28d9", skirt: "#6d28d9" },
    alwaysModest: true,
  },
  blazer: {
    label: "Blazer",
    file: "female-blazer",
    colors: { Jacket: "#6b46c1", LightJacket: "#7c3aed", Shirt: "#f5f0ff", Pants: "#2d2a4a", Shoes: "#1a103d", Skin: SKIN },
    modest: { sleeves: "#6b46c1", skirt: "#2d2a4a" },
  },
  casual: {
    label: "Casual",
    file: "female-casual",
    colors: { Shirt: "#14b8a6", Pants: "#3b2d63", Shoes: "#f6c453", Socks: "#f5f0ff", Skin: SKIN },
    modest: { sleeves: "#14b8a6", skirt: "#3b2d63" },
  },
};

export type GirlOutfit = keyof typeof GIRL_OUTFITS;

export const HIJAB_COLORS = [
  { label: "Rose", color: "#c49cad" },
  { label: "Lavender", color: "#b7a2e0" },
  { label: "Cream", color: "#efe3d0" },
  { label: "Gold", color: "#d9b26a" },
  { label: "Navy", color: "#2f2b5c" },
] as const;

export const GUY_OUTFIT: Outfit = {
  label: "Shirt",
  file: "male-shirt",
  colors: { Shirt: "#6b46c1", Shirt2: "#f5f0ff", Pants: "#2d2a4a", Shoes: "#1a103d", Socks: "#f6c453", Skin: "#e3b593" },
  modest: {},
};

export type NpcLook = {
  file: PersonFile;
  colors: Record<string, string>;
  hijab?: string;
  modest?: { sleeves?: string; skirt?: string };
};

/** Clothing and skin for city NPCs, so the crowd matches the palette without looking uniform. */
export const NPC_LOOKS: NpcLook[] = [
  {
    file: "female-blazer",
    colors: { Jacket: "#0f766e", LightJacket: "#14b8a6", Pants: "#2d2a4a", Skin: SKIN_TONES[1] },
    hijab: "#efe3d0",
    modest: { sleeves: "#0f766e", skirt: "#2d2a4a" },
  },
  { file: "male-suit", colors: { Shirt: "#3b2d63", Pants: "#3b2d63", Skin: SKIN_TONES[2] } },
  { file: "female-casual", colors: { Shirt: "#f6c453", Pants: "#4c1d95", Skin: SKIN_TONES[0] } },
  { file: "male-casual", colors: { Shirt: "#a78bfa", Pants: "#2d2a4a", Skin: SKIN_TONES[4] } },
  {
    file: "female-dress",
    colors: { Dress: "#d69e2e", Skin: SKIN_TONES[2] },
    hijab: "#2f2b5c",
    modest: { sleeves: "#d69e2e", skirt: "#d69e2e" },
  },
  { file: "male-longsleeves", colors: { Shirt: "#14b8a6", Pants: "#3b2d63", Skin: SKIN_TONES[1] } },
  { file: "female-tank", colors: { Shirt: "#f472b6", Pants: "#2d2a4a", Skin: SKIN_TONES[3] } },
  { file: "male-shirt", colors: { Shirt: "#f5f0ff", Shirt2: "#7c3aed", Pants: "#2d2a4a", Skin: SKIN_TONES[0] } },
  {
    file: "female-blazer",
    colors: { Jacket: "#4c1d95", LightJacket: "#6d28d9", Shirt: "#fde68a", Skin: SKIN_TONES[0] },
    hijab: "#b7a2e0",
    modest: { sleeves: "#4c1d95", skirt: "#3b2d63" },
  },
  { file: "male-casual", colors: { Shirt: "#5eead4", Pants: "#4c1d95", Skin: SKIN_TONES[5] } },
];
