import type { Content, Experience, Project, Training } from "@/content/schema";
import { type DistrictId, districtById } from "./districts";
import { palette } from "./palette";

/** A lamp on the ground; its arm reaches along local +x after rotating by `rot` around y. */
export type LampSpot = { x: number; z: number; rot: number };

/**
 * Turns content into world-space placements for one district. Pure and
 * deterministic, so the 3D scene, the minimap and the admin preview agree.
 *
 * Every district is a street: the entry gate is at z ≈ 0 and the street runs
 * toward -z, with buildings alternating left (x < 0) and right (x > 0).
 */

export const STREET = {
  roadHalfWidth: 6,
  sidewalkWidth: 4,
  startZ: 2,
};

const FRONT_X = STREET.roadHalfWidth + STREET.sidewalkWidth + 2;
const FLOOR_HEIGHT = 3.2;

/** Architectural style: every content type gets its own silhouette. */
export type BuildingVariant = "hq" | "studio" | "lowrise" | "workshop" | "tower";

export type BuildingSpec = {
  id: string;
  variant: BuildingVariant;
  /** Small text shown on the floating ring of skill towers, e.g. the level */
  badge?: string;
  label: string;
  sublabel: string;
  /** Center of the footprint on the ground */
  x: number;
  z: number;
  /** Extent along x (away from the street) */
  width: number;
  /** Extent along z (the street-facing side) */
  depth: number;
  height: number;
  floors: number;
  color: string;
  /** Which way the entrance faces: +1 = toward +x, -1 = toward -x */
  facing: 1 | -1;
  crown: boolean;
};

export type Signpost = { label: string; x: number; z: number; side: 1 | -1 };
export type Billboard = { x: number; z: number; side: 1 | -1 };

export type DistrictLayout = {
  id: DistrictId;
  buildings: BuildingSpec[];
  signposts: Signpost[];
  streetEndZ: number;
  lamps: LampSpot[];
  trees: [number, number][];
  billboards: Billboard[];
};

/** What a district needs to know about each building before it is placed. */
type Item = Omit<BuildingSpec, "x" | "z" | "facing" | "height"> & { group?: string };

function toMonths(date: string): number {
  const [y, m] = date.split("-").map(Number);
  return y * 12 + ((m ?? 1) - 1);
}

function nowMonths() {
  const d = new Date();
  return d.getFullYear() * 12 + d.getMonth();
}

export function monthsAt(job: Experience) {
  const start = Math.min(...job.roles.map((r) => toMonths(r.start)));
  const end = Math.max(...job.roles.map((r) => (r.end ? toMonths(r.end) : nowMonths())));
  return Math.max(1, end - start + 1);
}

function formatSpan(months: number) {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return [years ? `${years} yr${years > 1 ? "s" : ""}` : "", rest ? `${rest} mo` : ""].filter(Boolean).join(" ");
}

function formatDate(date: string | null) {
  if (!date) return "";
  const [y, m] = date.split("-");
  if (!m) return y;
  return new Date(Number(y), Number(m) - 1).toLocaleString("en", { month: "short", year: "numeric" });
}

// ---------------------------------------------------------------------------
// Content → items, one mapping per district
// ---------------------------------------------------------------------------

/** How much a month counts toward height, so a side gig doesn't outgrow a full-time job. */
const typeWeight: Record<Experience["type"], number> = {
  "full-time": 1,
  freelance: 0.45,
  internship: 1,
  apprenticeship: 0.8,
  volunteer: 1,
};

const jobVariant: Record<Experience["type"], BuildingVariant> = {
  "full-time": "hq",
  freelance: "studio",
  internship: "lowrise",
  volunteer: "lowrise",
  apprenticeship: "workshop",
};

const teamFootprint: Record<Experience["teamSize"], number> = { solo: 10, small: 12, medium: 16, large: 20 };

const categoryLabels: Record<string, string> = {
  languages: "Languages",
  frontend: "Frontend",
  backend: "Backend",
  databases: "Databases & ORMs",
  tools: "Tools & APIs",
  state: "State Management",
  hosting: "Servers & Hosting",
  design: "Design",
  architecture: "Architecture",
  ai: "AI & Automation",
};

function businessItems(content: Content): Item[] {
  const startOf = (j: Experience) => Math.max(...j.roles.map((r) => toMonths(r.start)));
  return [...content.experience]
    .sort((a, b) => startOf(b) - startOf(a))
    .map((job) => {
      const months = monthsAt(job);
      const size = teamFootprint[job.teamSize];
      return {
        id: job.id,
        variant: jobVariant[job.type],
        label: job.company,
        sublabel: `${job.roles[0].title} · ${formatSpan(months)}`,
        width: size,
        depth: size,
        floors: Math.min(14, Math.max(2, Math.round((months * typeWeight[job.type]) / 4) + 2)),
        color: palette.experience[job.type],
        crown: job.roles.length > 1,
      };
    });
}

function skillItems(content: Content): Item[] {
  const order = [...new Set(content.skills.map((s) => s.category))];
  return order.flatMap((category) =>
    content.skills
      .filter((s) => s.category === category)
      .sort((a, b) => b.level - a.level)
      .map((skill) => ({
        id: skill.id,
        variant: "tower" as const,
        badge: String(skill.level),
        label: skill.name,
        sublabel: `Level ${skill.level}/10 · ${skill.years} yr${skill.years === 1 ? "" : "s"}`,
        width: 5,
        depth: 5,
        floors: skill.level + 1,
        color: palette.skills[category],
        crown: skill.level >= 9,
        group: categoryLabels[category],
      })),
  );
}

function campusItems(content: Content): Item[] {
  return content.education.map((e) => ({
    id: e.id,
    variant: "hq",
    label: e.school,
    sublabel: `${e.degree} · ${e.field} · ${e.start}–${e.end ? formatDate(e.end) : "now"}`,
    width: 22,
    depth: 22,
    floors: 7,
    color: "#553c9a",
    crown: true,
  }));
}

function trainingItems(content: Content): Item[] {
  const variant = (t: Training): BuildingVariant =>
    t.status === "in-progress" ? "workshop" : t.kind === "bootcamp" ? "studio" : "lowrise";
  return content.trainings.map((t) => ({
    id: t.id,
    variant: variant(t),
    label: t.name,
    sublabel: `${t.issuer ? `${t.issuer} · ` : ""}${t.provider}${t.date ? ` · ${formatDate(t.date)}` : ""}${t.status === "in-progress" ? " · in progress" : ""}`,
    width: t.kind === "bootcamp" ? 14 : 11,
    depth: t.kind === "bootcamp" ? 14 : 11,
    floors: t.kind === "bootcamp" ? 5 : t.courses.length >= 8 ? 4 : 3,
    color: t.status === "in-progress" ? "#9f7aea" : "#805ad5",
    crown: t.kind === "scholarship",
    group: t.status === "in-progress" ? "In progress" : undefined,
  }));
}

const languageFloors: Record<string, number> = { native: 9, C2: 8, C1: 7, B2: 6, B1: 5, A2: 4, A1: 3 };

function languageItems(content: Content): Item[] {
  return content.languages.map((l) => ({
    id: l.id,
    variant: "studio",
    label: `${l.flag} ${l.name}`,
    sublabel: `${l.level === "native" ? "Native" : l.level} · ${l.greeting}`,
    width: 14,
    depth: 14,
    floors: languageFloors[l.level],
    color: "#9f7aea",
    crown: l.level === "native",
  }));
}

function projectItems(content: Content): Item[] {
  const tierOrder = { flagship: 0, featured: 1, standard: 2 };
  const variant = (p: Project): BuildingVariant =>
    p.status === "in-progress" && p.category !== "client" ? "workshop" : p.tier === "flagship" ? "hq" : p.tier === "featured" ? "studio" : "lowrise";
  return [...content.projects]
    .sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier] || b.year - a.year)
    .map((p) => ({
      id: p.id,
      variant: variant(p),
      label: p.name,
      sublabel: `${p.plaque ?? p.kind} · ${p.year}`,
      width: p.tier === "flagship" ? 18 : p.tier === "featured" ? 14 : 11,
      depth: p.tier === "flagship" ? 18 : p.tier === "featured" ? 14 : 11,
      floors: p.tier === "flagship" ? 11 : p.tier === "featured" ? 6 : 3,
      color: p.category === "client" ? "#d53f8c" : p.category === "work-private" ? "#4c1d95" : "#5b21b6",
      crown: p.tier === "flagship",
      group: p.tier === "flagship" ? "Flagship" : p.tier === "featured" ? "Featured" : "More projects",
    }));
}

function hobbyItems(content: Content): Item[] {
  return content.hobbies.map((h, i) => ({
    id: h.id,
    variant: i === 0 ? "studio" : i % 2 === 0 ? "lowrise" : "workshop",
    label: h.name,
    sublabel: h.interaction,
    width: i === 0 ? 16 : 11,
    depth: i === 0 ? 16 : 11,
    floors: i === 0 ? 5 : 3,
    color: palette.foliage[i % palette.foliage.length],
    crown: i === 0,
  }));
}

function arcadeItems(): Item[] {
  return [
    {
      id: "full-stack-arcade",
      variant: "workshop",
      label: "Full Stack Arcade",
      sublabel: "Stack the stack · opening soon",
      width: 18,
      depth: 18,
      floors: 4,
      color: "#d53f8c",
      crown: true,
    },
  ];
}

const itemsFor: Record<DistrictId, (c: Content) => Item[]> = {
  business: businessItems,
  skills: skillItems,
  campus: campusItems,
  training: trainingItems,
  languages: languageItems,
  projects: projectItems,
  hobbies: hobbyItems,
  arcade: arcadeItems,
};

// ---------------------------------------------------------------------------
// Placement
// ---------------------------------------------------------------------------

export function computeDistrictLayout(content: Content, id: DistrictId): DistrictLayout {
  const items = itemsFor[id](content);
  const buildings: BuildingSpec[] = [];
  const signposts: Signpost[] = [];
  const cursor = { [-1]: STREET.startZ - 8, [1]: STREET.startZ - 8 } as Record<1 | -1, number>;
  let side: 1 | -1 = -1;
  let lastGroup: string | undefined;
  const gap = items.every((i) => i.depth <= 6) ? 3 : 7;

  for (const item of items) {
    if (item.group && item.group !== lastGroup) {
      // Start each group on a fresh row on both sides, with a signpost.
      const z = Math.min(cursor[-1], cursor[1]) - (lastGroup ? 5 : 0);
      cursor[-1] = cursor[1] = z - 3;
      signposts.push({ label: item.group, x: -(STREET.roadHalfWidth + 1.2), z, side: -1 });
      signposts.push({ label: item.group, x: STREET.roadHalfWidth + 1.2, z, side: 1 });
      side = -1;
      lastGroup = item.group;
    }
    const z = cursor[side];
    const rest: Omit<Item, "group"> = item;
    buildings.push({
      ...rest,
      x: side * (FRONT_X + item.width / 2),
      z: z - item.depth / 2,
      height: item.floors * FLOOR_HEIGHT,
      facing: side === -1 ? 1 : -1,
    });
    cursor[side] = z - item.depth - gap;
    side = side === -1 ? 1 : -1;
  }

  const streetEndZ = Math.min(cursor[-1], cursor[1], -40) - 12;
  return { id, buildings, signposts, streetEndZ, ...streetDecor(streetEndZ) };
}

/** Lamps, trees and holographic billboards along a district street. */
function streetDecor(streetEndZ: number) {
  const lamps: LampSpot[] = [];
  const trees: [number, number][] = [];
  const billboards: Billboard[] = [];
  const curb = STREET.roadHalfWidth + 0.8;
  let slot = 0;
  for (let z = STREET.startZ - 2; z > streetEndZ; z -= 14, slot++) {
    lamps.push({ x: -curb, z, rot: 0 }, { x: curb, z, rot: Math.PI });
    // Every third gap swaps one tree for a holographic code billboard, alternating sides.
    const billboardSide = slot % 3 === 1 ? (slot % 2 === 0 ? 1 : -1) : 0;
    for (const s of [-1, 1] as const) {
      if (s === billboardSide) billboards.push({ x: s * (curb + 2), z: z - 7, side: s });
      else trees.push([s * (curb + 2.4), z - 7]);
    }
  }
  return { lamps, trees, billboards };
}

export function districtTitle(id: DistrictId) {
  return districtById(id).name;
}
