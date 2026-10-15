import type { PersonLook } from "@/components/city/Person";

/**
 * Looks for the player's avatar and the city's people: Microsoft Rocketbox
 * avatars (MIT), each wearing its own modeled clothes.
 */

export type Look = { id: string; label: string };

/** Every avatar the visitor can pick (each has /models/rb/<id>/thumb.webp); the first is the default. */
export const LOOKS = {
  girl: [
    { id: "Female_Adult_05", label: "Blazer & jeans" },
    { id: "Female_Adult_06", label: "Hijab & tunic" },
    { id: "Female_Adult_10", label: "Niqab" },
    { id: "Female_Adult_15", label: "Blouse & skirt" },
    { id: "Female_Adult_07", label: "Belted jacket" },
    { id: "Female_Adult_14", label: "Wrap cardigan" },
    { id: "Female_Adult_01", label: "Pink shirt" },
    { id: "Female_Adult_02", label: "Sweater & skirt" },
    { id: "Female_Adult_03", label: "Purple top" },
    { id: "Female_Adult_04", label: "Leather jacket" },
    { id: "Female_Adult_08", label: "Grey tee" },
    { id: "Female_Adult_09", label: "Long cardigan" },
    { id: "Female_Adult_11", label: "Brown dress" },
    { id: "Female_Adult_12", label: "Hoodie & shorts" },
    { id: "Female_Adult_13", label: "Waistcoat" },
    { id: "Female_Adult_16", label: "Burqa" },
    { id: "Female_Adult_17", label: "Green tee" },
    { id: "Female_Party_01", label: "Party look" },
    { id: "Female_Party_02", label: "Lace top" },
  ],
  guy: [
    { id: "Male_Adult_08", label: "Blue shirt" },
    { id: "Male_Adult_06", label: "Henley" },
    { id: "Male_Adult_12", label: "Denim jacket" },
    { id: "Male_Adult_17", label: "Windbreaker" },
    { id: "Male_Adult_01", label: "Polo & shorts" },
    { id: "Male_Adult_02", label: "Sweater" },
    { id: "Male_Adult_03", label: "Tweed blazer" },
    { id: "Male_Adult_04", label: "Bomber" },
    { id: "Male_Adult_05", label: "Field vest" },
    { id: "Male_Adult_07", label: "Sport coat" },
    { id: "Male_Adult_09", label: "Graphic tee" },
    { id: "Male_Adult_10", label: "Track jacket" },
    { id: "Male_Adult_11", label: "Dark shirt" },
    { id: "Male_Adult_13", label: "Argyle vest" },
    { id: "Male_Adult_14", label: "Grey shirt" },
    { id: "Male_Adult_15", label: "Kurta & kufi" },
    { id: "Male_Adult_16", label: "Blue tee" },
    { id: "Male_Adult_18", label: "Grey hoodie" },
    { id: "Male_Adult_19", label: "Thobe & shemagh" },
    { id: "Male_Adult_20", label: "Brown hoodie" },
    { id: "Male_Adult_21", label: "White thobe" },
  ],
} satisfies Record<"girl" | "guy", Look[]>;

export const DEFAULT_LOOK = LOOKS.girl[0].id;

const bodyOf = (id: string): PersonLook["body"] => (id.startsWith("Female") ? "female" : "male");

/** The visitor's avatar from the welcome-screen choice (falls back to the first look). */
export function playerLook(avatar: "girl" | "guy", id: string): PersonLook {
  const look = LOOKS[avatar].find((l) => l.id === id) ?? LOOKS[avatar][0];
  return { id: look.id, body: bodyOf(look.id) };
}

/** The city's crowd. */
/** Wouroud herself in the city (her hijab look); kept out of the crowd. */
export const WOUROUD_LOOK: PersonLook = { id: "Female_Adult_06", body: "female" };

export const NPC_PEOPLE: PersonLook[] = [
  "Female_Adult_01",
  "Male_Adult_01",
  "Female_Adult_12",
  "Male_Adult_07",
  "Female_Adult_04",
  "Male_Adult_10",
  "Female_Adult_17",
  "Male_Adult_19",
  "Female_Adult_02",
  "Male_Adult_16",
  "Female_Adult_15",
  "Male_Adult_04",
].map((id) => ({ id, body: bodyOf(id) }));
