import type { PersonLook } from "@/components/city/Person";

/**
 * Looks for the player's avatar and the city's people: Microsoft Rocketbox
 * avatars (MIT), each wearing its own modeled clothes.
 */

export type Look = { id: string; label: string };

/** The avatar choices on the welcome screen; the first is the default. */
export const LOOKS = {
  girl: [
    { id: "Female_Adult_05", label: "Blazer & jeans" },
    { id: "Female_Adult_15", label: "Blouse & skirt" },
    { id: "Female_Adult_07", label: "Leather jacket" },
    { id: "Female_Adult_14", label: "Cardigan" },
  ],
  guy: [
    { id: "Male_Adult_08", label: "Shirt" },
    { id: "Male_Adult_06", label: "Henley" },
    { id: "Male_Adult_12", label: "Denim jacket" },
    { id: "Male_Adult_17", label: "Windbreaker" },
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
export const NPC_PEOPLE: PersonLook[] = [
  "Female_Adult_01",
  "Male_Adult_01",
  "Female_Adult_02",
  "Male_Adult_07",
  "Female_Adult_04",
  "Male_Adult_10",
  "Female_Adult_17",
  "Male_Adult_16",
  "Female_Adult_15",
  "Male_Adult_06",
].map((id) => ({ id, body: bodyOf(id) }));
