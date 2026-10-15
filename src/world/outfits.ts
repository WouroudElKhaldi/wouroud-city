import type { PersonFile } from "@/components/city/Character";
import type { ModestLayers } from "@/components/city/garments";

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
  modest: ModestLayers;
  /** Apply the modest layers even without a hijab (e.g. a long dress is always long) */
  alwaysModest?: boolean;
  /** A fitted hairstyle from the base-characters kit instead of the model's own hair */
  hair?: { style: "long" | "buns" | "buzzed" | "parted"; color: string; beard?: boolean };
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
    modest: { sleeves: "#6d28d9", neckline: "#6d28d9", skirt: "#6d28d9" },
    alwaysModest: true,
  },
  blazer: {
    label: "Blazer",
    file: "female-blazer",
    colors: { Jacket: "#6b46c1", LightJacket: "#7c3aed", Shirt: "#f5f0ff", Pants: "#2d2a4a", Shoes: "#1a103d", Skin: SKIN },
    modest: { sleeves: "#6b46c1", neckline: "#f5f0ff", tunic: "#6b46c1" },
  },
  casual: {
    label: "Casual",
    file: "female-casual",
    colors: { Shirt: "#14b8a6", Pants: "#3b2d63", Shoes: "#f6c453", Socks: "#f5f0ff", Skin: SKIN },
    modest: { sleeves: "#14b8a6", neckline: "#14b8a6", tunic: "#14b8a6" },
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
  hair: { style: "parted", color: "#3b2a20" },
};

export type NpcLook = {
  file: PersonFile;
  colors: Record<string, string>;
  hijab?: string;
  modest?: ModestLayers;
};

/** Clothing and skin for city NPCs, so the crowd matches the palette without looking uniform. */
export const NPC_LOOKS: NpcLook[] = [
  {
    file: "female-blazer",
    colors: { Jacket: "#0f766e", LightJacket: "#14b8a6", Pants: "#2d2a4a", Skin: SKIN_TONES[1] },
    hijab: "#efe3d0",
    modest: { sleeves: "#0f766e", neckline: "#f5f0ff", tunic: "#0f766e" },
  },
  { file: "male-suit", colors: { Shirt: "#3b2d63", Pants: "#3b2d63", Skin: SKIN_TONES[2] } },
  { file: "female-casual", colors: { Shirt: "#f6c453", Pants: "#4c1d95", Skin: SKIN_TONES[0] } },
  { file: "male-casual", colors: { Shirt: "#a78bfa", Pants: "#2d2a4a", Skin: SKIN_TONES[4] } },
  {
    file: "female-dress",
    colors: { Dress: "#d69e2e", Skin: SKIN_TONES[2] },
    hijab: "#2f2b5c",
    modest: { sleeves: "#d69e2e", neckline: "#d69e2e", skirt: "#d69e2e" },
  },
  { file: "male-longsleeves", colors: { Shirt: "#14b8a6", Pants: "#3b2d63", Skin: SKIN_TONES[1] } },
  { file: "female-tank", colors: { Shirt: "#f472b6", Pants: "#2d2a4a", Skin: SKIN_TONES[3] } },
  { file: "male-shirt", colors: { Shirt: "#f5f0ff", Shirt2: "#7c3aed", Pants: "#2d2a4a", Skin: SKIN_TONES[0] } },
  {
    file: "female-blazer",
    colors: { Jacket: "#4c1d95", LightJacket: "#6d28d9", Shirt: "#fde68a", Skin: SKIN_TONES[0] },
    hijab: "#b7a2e0",
    modest: { sleeves: "#4c1d95", neckline: "#fde68a", tunic: "#4c1d95" },
  },
  { file: "male-casual", colors: { Shirt: "#5eead4", Pants: "#4c1d95", Skin: SKIN_TONES[5] } },
];

// ---------------------------------------------------------------------------
// Base-character looks (Universal Base Characters + clothes.ts)
// ---------------------------------------------------------------------------

import type { PersonLook } from "@/components/city/Person";

/** Her skin on the light texture: a warm, barely-there tint. */
const HER_SKIN = "#fff1e6";

/** The visitor's avatar as a base character, from the welcome-screen choices. */
export function playerLook(avatar: "girl" | "guy", outfit: GirlOutfit, hijab: boolean, hijabColor: string): PersonLook {
  if (avatar === "guy") {
    return {
      body: "male",
      outfit: "shirt",
      colors: { top: "#6b46c1", bottom: "#2d2a4a", shoes: "#1a103d" },
      skin: "#f6dcc8",
      hair: { style: "parted", color: "#3b2a20" },
      brows: "#3b2a20",
    };
  }
  const o = GIRL_OUTFITS[outfit].colors;
  const look: Record<GirlOutfit, Pick<PersonLook, "outfit" | "colors">> = {
    dress: { outfit: "abaya", colors: { top: o.Dress, bottom: o.Dress, shoes: o.Shoes } },
    blazer: { outfit: "blazer-modest", colors: { top: o.Jacket, bottom: o.Pants, shoes: o.Shoes } },
    casual: { outfit: "tunic", colors: { top: o.Shirt, bottom: o.Pants, shoes: o.Shoes } },
  };
  return {
    body: "female",
    ...look[outfit],
    skin: HER_SKIN,
    hijab: hijab ? hijabColor : undefined,
    hair: hijab ? undefined : { style: "long", color: "#2b1a14" },
    brows: "#2b1a14",
  };
}

/** City people on the new bodies, in the city palette and with natural skin tints. */
export const NPC_PEOPLE: PersonLook[] = [
  { body: "female", outfit: "blazer-modest", colors: { top: "#0f766e", bottom: "#2d2a4a", shoes: "#1a103d" }, skin: "#f3d9c6", hijab: "#efe3d0", brows: "#3b2a20" },
  { body: "male", outfit: "suit", colors: { top: "#3b2d63", bottom: "#2d2a4a", shoes: "#1a103d", accent: "#f5f0ff" }, skin: "#e2b79a", hair: { style: "parted", color: "#2b1d16" }, brows: "#2b1d16" },
  { body: "female", outfit: "tee-women", colors: { top: "#f6c453", bottom: "#4c1d95", shoes: "#f5f0ff" }, skin: "#fbe3d3", hair: { style: "long", color: "#5a3a26" }, brows: "#5a3a26" },
  { body: "male", outfit: "tee", colors: { top: "#a78bfa", bottom: "#2d2a4a", shoes: "#1a103d" }, skin: "#a7775a", hair: { style: "buzzed", color: "#1c1410" }, brows: "#1c1410" },
  { body: "female", outfit: "abaya", colors: { top: "#d69e2e", bottom: "#d69e2e", shoes: "#2d1f52" }, skin: "#e6be9f", hijab: "#2f2b5c", brows: "#2b1a14" },
  { body: "male", outfit: "shirt", colors: { top: "#14b8a6", bottom: "#3b2d63", shoes: "#1a103d" }, skin: "#f1d1bb", hair: { style: "parted", color: "#6b4a2e" }, brows: "#6b4a2e", },
  { body: "female", outfit: "tee-women", colors: { top: "#f472b6", bottom: "#2d2a4a", shoes: "#ffffff" }, skin: "#c99272", hair: { style: "buns", color: "#2b1a14" }, brows: "#2b1a14" },
  { body: "male", outfit: "shirt", colors: { top: "#f5f0ff", bottom: "#2d2a4a", shoes: "#3b2d63" }, skin: "#f3d9c6", hair: { style: "buzzed", color: "#8a6a45" }, brows: "#8a6a45" },
  { body: "female", outfit: "tunic", colors: { top: "#4c1d95", bottom: "#2d2a4a", shoes: "#1a103d" }, skin: "#f3d9c6", hijab: "#b7a2e0", brows: "#3b2a20" },
  { body: "male", outfit: "tee", colors: { top: "#5eead4", bottom: "#4c1d95", shoes: "#f5f0ff" }, skin: "#8d5e45", hair: { style: "parted", color: "#140e0b", beard: true }, brows: "#140e0b" },
];
