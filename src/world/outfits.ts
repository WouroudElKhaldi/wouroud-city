import type { PersonFile } from "@/components/city/Character";

/**
 * Outfits for the player's avatar. Each outfit is a Quaternius character plus
 * colors for its clothing materials, in the city's violet / gold / mint palette.
 */
export type Outfit = { label: string; file: PersonFile; colors: Record<string, string>; longDress?: string };

/** Warm light skin tone for the player's avatar. */
const SKIN = "#e8bfa1";

export const GIRL_OUTFITS: Record<"dress" | "blazer" | "casual", Outfit> = {
  dress: {
    label: "Long dress",
    file: "female-dress",
    colors: { Dress: "#6d28d9", Shoes: "#2d1f52", Skin: SKIN },
    longDress: "#6d28d9",
  },
  blazer: {
    label: "Blazer",
    file: "female-blazer",
    colors: { Jacket: "#6b46c1", LightJacket: "#7c3aed", Shirt: "#f5f0ff", Pants: "#2d2a4a", Shoes: "#1a103d", Skin: SKIN },
  },
  casual: {
    label: "Casual",
    file: "female-casual",
    colors: { Shirt: "#14b8a6", Pants: "#3b2d63", Shoes: "#f6c453", Socks: "#f5f0ff", Skin: SKIN },
  },
};

export type GirlOutfit = keyof typeof GIRL_OUTFITS;

export const GUY_OUTFIT: Outfit = {
  label: "Shirt",
  file: "male-shirt",
  colors: { Shirt: "#6b46c1", Shirt2: "#f5f0ff", Pants: "#2d2a4a", Shoes: "#1a103d", Socks: "#f6c453" },
};

/** Clothing colors for city NPCs, so the crowd matches the palette without looking uniform. */
export const NPC_LOOKS: { file: PersonFile; colors: Record<string, string> }[] = [
  { file: "female-blazer", colors: { Jacket: "#0f766e", LightJacket: "#14b8a6", Pants: "#2d2a4a" } },
  { file: "male-suit", colors: { Shirt: "#3b2d63", Pants: "#3b2d63" } },
  { file: "female-casual", colors: { Shirt: "#f6c453", Pants: "#4c1d95" } },
  { file: "male-casual", colors: { Shirt: "#a78bfa", Pants: "#2d2a4a" } },
  { file: "female-tank", colors: { Shirt: "#f472b6", Pants: "#2d2a4a" } },
  { file: "male-longsleeves", colors: { Shirt: "#14b8a6", Pants: "#3b2d63" } },
  { file: "female-dress", colors: { Dress: "#d69e2e" } },
  { file: "male-shirt", colors: { Shirt: "#f5f0ff", Shirt2: "#7c3aed", Pants: "#2d2a4a" } },
  { file: "female-blazer", colors: { Jacket: "#4c1d95", LightJacket: "#6d28d9", Shirt: "#fde68a" } },
  { file: "male-casual", colors: { Shirt: "#5eead4", Pants: "#4c1d95" } },
];
