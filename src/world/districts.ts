/**
 * The districts of Wouroud's City. The hub (Central Plaza) shows one landmark per
 * district on a ring around the plaza; entering a landmark loads that district alone.
 */

export type DistrictId = "business" | "skills" | "campus" | "training" | "languages" | "projects" | "hobbies" | "arcade";

export type DistrictDef = {
  id: DistrictId;
  name: string;
  tagline: string;
  color: string;
  accent: string;
};

export const DISTRICTS: DistrictDef[] = [
  { id: "business", name: "Business District", tagline: "Work experience", color: "#6b46c1", accent: "#d6bcfa" },
  { id: "skills", name: "Skill Downtown", tagline: "Skills · height = level", color: "#7c3aed", accent: "#f0abfc" },
  { id: "projects", name: "Project Harbor", tagline: "Projects & client work", color: "#5b21b6", accent: "#67e8f9" },
  { id: "campus", name: "Campus", tagline: "Studies", color: "#553c9a", accent: "#fde68a" },
  { id: "training", name: "Training Park", tagline: "Certificates & bootcamps", color: "#805ad5", accent: "#a7f3d0" },
  { id: "languages", name: "Polyglot Quarter", tagline: "Arabic · English · French", color: "#9f7aea", accent: "#fecaca" },
  { id: "hobbies", name: "Hobby Quarter", tagline: "Art, crafts & more", color: "#b794f4", accent: "#fbcfe8" },
  { id: "arcade", name: "Arcade Pier", tagline: "Play a game", color: "#d53f8c", accent: "#fef08a" },
];

export const HUB = {
  plazaRadius: 18,
  /** Distance from the plaza center to each landmark's center */
  ringRadius: 64,
  /** Radius of each landmark's platform */
  landmarkRadius: 11,
  roadHalfWidth: 4,
};

export function districtById(id: DistrictId) {
  return DISTRICTS.find((d) => d.id === id)!;
}

/** Where a district's landmark stands in the hub, rotated so its door faces the plaza. */
export function landmarkPlacement(id: DistrictId) {
  const index = DISTRICTS.findIndex((d) => d.id === id);
  // Start straight ahead of the spawn point (north, -z) and go clockwise.
  const angle = -Math.PI / 2 + (index / DISTRICTS.length) * Math.PI * 2;
  const x = Math.cos(angle) * HUB.ringRadius;
  const z = Math.sin(angle) * HUB.ringRadius;
  const rotationY = Math.atan2(-x, -z);
  return { angle, x, z, rotationY };
}

/** A point in front of a landmark's door, used to spawn the player when leaving that district. */
export function landmarkDoorstep(id: DistrictId, distance = HUB.landmarkRadius + 4) {
  const { angle } = landmarkPlacement(id);
  const r = HUB.ringRadius - distance;
  return { x: Math.cos(angle) * r, z: Math.sin(angle) * r, angle };
}
