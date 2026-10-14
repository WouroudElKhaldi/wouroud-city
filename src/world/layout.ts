import type { Content, Experience, Project, Training } from "@/content/schema";
import { type DistrictId, districtById } from "./districts";
import { type FoliageItem, type FoliageKey, type LeafPalette, pick, seeded, undergrowth } from "./foliage";
import { palette } from "./palette";

/** A lamp on the ground; its arm reaches along local +x after rotating by `rot` around y. */
export type LampSpot = { x: number; z: number; rot: number };

/**
 * Turns content into world-space placements for one district. Pure and
 * deterministic, so the 3D scene, the minimap and the admin preview agree.
 *
 * Every district is a round neighborhood; see `computeDistrictLayout`.
 */

/** Street furniture sizes (curbs, benches) shared with StreetDetails. */
export const STREET = {
  roadHalfWidth: 6,
  sidewalkWidth: 4,
  startZ: 2,
};

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
  /** Extent along local x (away from the road, the entrance is on the +x side) */
  width: number;
  /** Extent along local z (the side facing the road) */
  depth: number;
  height: number;
  floors: number;
  color: string;
  /** Which way the entrance faces in local space: +1 = toward +x, -1 = toward -x */
  facing: 1 | -1;
  /** Yaw of the whole building around y */
  rotY: number;
  crown: boolean;
  /** Set by the renderer when the district style puts a pitched, arched or domed roof on top */
  pitched?: boolean;
  /** Which district it stands in; sets the architecture style */
  district: DistrictId;
  /** A neighborhood shop that fills the ring; no info panel */
  filler?: boolean;
};

/** A cluster's name board; `rot` is the angle it stands at, the board faces the center. */
export type Signpost = { label: string; x: number; z: number; rot: number };
/** A code billboard; the screen faces local +z after rotating by `rot`. */
export type Billboard = { x: number; z: number; rot: number };

export type DistrictLayout = {
  id: DistrictId;
  buildings: BuildingSpec[];
  signposts: Signpost[];
  /** Radius of the ring road's center line */
  ringRadius: number;
  /** Radius of the first building row's inner face */
  innerRadius: number;
  outerRadius: number;
  /** z of the entry gate on the south avenue */
  gateZ: number;
  spawn: [number, number, number];
  /** Where the exit portal back to the plaza stands */
  exit: { x: number; z: number };
  lamps: LampSpot[];
  foliage: FoliageItem[];
  billboards: Billboard[];
};

/** What a district needs to know about each building before it is placed. */
type Item = Omit<BuildingSpec, "x" | "z" | "facing" | "rotY" | "height" | "district"> & { group?: string };

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
      sublabel: "Stack the stack · press E to play",
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
// Placement: a round neighborhood
// ---------------------------------------------------------------------------

/**
 * Every district is a round neighborhood around a central plaza with a fountain
 * and a park. A ring road circles the park; the buildings stand outside the ring
 * in clusters (one per group: skill category, project tier...), all facing the
 * center. Big districts get a second row behind the first. Small districts are
 * filled out with neighborhood shops so they never feel empty. The entry avenue
 * comes in from the south (+z), where the gate and the exit portal are.
 */
export const RING = {
  plazaRadius: 13,
  roadHalfWidth: 4,
  sidewalk: 3,
  /** Smallest radius of the building row's inner face */
  minInner: 38,
  /** Space between neighbors in a row */
  gap: 3,
  /** Extra space between two clusters */
  groupPad: 9,
  /** Districts with fewer real buildings get neighborhood shops to fill the ring */
  minBuildings: 12,
};

const FILLERS: { label: string; sublabel: string; variant: BuildingVariant; color: string }[] = [
  { label: "Café Byte", sublabel: "Coffee & cardamom", variant: "lowrise", color: "#c0883a" },
  { label: "Corner Bakery", sublabel: "Fresh manakish", variant: "lowrise", color: "#d69e2e" },
  { label: "Bookshop", sublabel: "Tech & poetry", variant: "studio", color: "#2c7a7b" },
  { label: "Co-working Hub", sublabel: "Hot desks · fast Wi-Fi", variant: "studio", color: "#6b46c1" },
  { label: "Flower Shop", sublabel: "Lilacs & jasmine", variant: "lowrise", color: "#b794f4" },
  { label: "Tea House", sublabel: "Mint tea all day", variant: "lowrise", color: "#0f766e" },
  { label: "Art Supplies", sublabel: "Paints & canvases", variant: "workshop", color: "#d53f8c" },
  { label: "Bike Repair", sublabel: "Tune-ups", variant: "workshop", color: "#553c9a" },
  { label: "Ice Cream", sublabel: "Ashta & pistachio", variant: "lowrise", color: "#f0abfc" },
  { label: "Pharmacy", sublabel: "Open late", variant: "lowrise", color: "#14b8a6" },
  { label: "Print Shop", sublabel: "Posters & stickers", variant: "workshop", color: "#805ad5" },
  { label: "Gym", sublabel: "Lift heavy, ship often", variant: "studio", color: "#4c1d95" },
];

/** World point in front of a building's entrance, `extra` meters out from the facade. */
export function doorPoint(b: BuildingSpec, extra = 1.6) {
  const out = b.width / 2 + extra;
  return { x: b.x + Math.cos(b.rotY) * out, z: b.z - Math.sin(b.rotY) * out };
}

/** Yaw that turns local +x (the entrance side) toward the district center from angle `a`. */
const faceCenter = (a: number) => Math.atan2(Math.cos(a), -Math.sin(a));
/** Angle 0 is south (+z), where the entry avenue is; angles grow clockwise seen from above. */
const polar = (a: number, r: number) => ({ x: Math.sin(a) * r, z: Math.cos(a) * r });

function withFillers(items: Item[], id: DistrictId): Item[] {
  const missing = Math.max(0, RING.minBuildings - items.length);
  if (!missing) return items;
  const random = seeded(id.length * 31 + 7);
  const start = Math.floor(random() * FILLERS.length);
  const fillers: Item[] = Array.from({ length: missing }, (_, k) => {
    const f = FILLERS[(start + k) % FILLERS.length];
    return {
      id: `filler-${k}`,
      variant: f.variant,
      label: f.label,
      sublabel: f.sublabel,
      width: 8 + Math.round(random() * 3),
      depth: 9 + Math.round(random() * 3),
      floors: 2 + Math.round(random() * 2),
      color: f.color,
      crown: false,
      filler: true,
      group: `~filler-${k}`,
    };
  });
  // Spread the shops between the real buildings, but never inside a cluster.
  const out: Item[] = [];
  const every = Math.max(1, Math.ceil(items.length / missing));
  let f = 0;
  items.forEach((item, i) => {
    out.push(item);
    const boundary = i === items.length - 1 || items[i + 1].group !== item.group || !item.group;
    if (boundary && (i + 1) % every === 0 && f < fillers.length) out.push(fillers[f++]);
    else if (boundary && item.group && f < fillers.length) out.push(fillers[f++]);
  });
  while (f < fillers.length) out.push(fillers[f++]);
  return out;
}

export function computeDistrictLayout(content: Content, id: DistrictId): DistrictLayout {
  const items = withFillers(itemsFor[id](content), id);
  const rows = items.length > 16 ? 2 : 1;

  // Consecutive items with the same group form one cluster.
  const groups: { key: string; rows: Item[][] }[] = [];
  for (const item of items) {
    const key = item.group ?? "";
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = { key, rows: Array.from({ length: rows }, () => []) };
      groups.push(g);
    }
    const counts = g.rows.map((r) => r.length);
    g.rows[counts.indexOf(Math.min(...counts))].push(item);
  }
  const arcOf = (row: Item[]) => row.reduce((s, it) => s + it.depth + RING.gap, 0);
  const groupArc = groups.map((g) => Math.max(...g.rows.map(arcOf)) + RING.groupPad);
  const total = groupArc.reduce((s, l) => s + l, 0);

  // Big enough that every cluster fits on the circle, leaving the entry gap free.
  let inner = RING.minInner;
  let entryGap = 0;
  for (let i = 0; i < 4; i++) {
    entryGap = Math.max(0.5, 24 / inner);
    inner = Math.max(RING.minInner, total / (Math.PI * 2 - entryGap));
  }
  const usable = Math.PI * 2 - entryGap;
  const firstRowWidth = Math.max(...items.map((it) => it.width));

  const buildings: BuildingSpec[] = [];
  const signposts: Signpost[] = [];
  const billboards: Billboard[] = [];
  const clusterGaps: number[] = [];
  let angle = entryGap / 2;
  groups.forEach((g, gi) => {
    const span = (groupArc[gi] / total) * usable;
    const pad = (RING.groupPad / groupArc[gi]) * span;
    clusterGaps.push(angle);
    g.rows.forEach((row, ri) => {
      const rowArc = arcOf(row);
      // Center the row inside the cluster's span.
      let a = angle + pad / 2 + (span - pad - (rowArc / groupArc[gi]) * span) / 2;
      for (const item of row) {
        const step = ((item.depth + RING.gap) / groupArc[gi]) * span;
        const center = a + step / 2;
        const r = inner + (ri === 0 ? 0 : firstRowWidth + 6) + item.width / 2;
        const rest: Omit<Item, "group"> = item;
        buildings.push({
          ...rest,
          ...polar(center, r),
          rotY: faceCenter(center),
          district: id,
          height: item.floors * FLOOR_HEIGHT,
          facing: 1,
        });
        a += step;
      }
    });
    if (g.key && !g.key.startsWith("~")) {
      const mid = angle + span / 2;
      signposts.push({ label: g.key, ...polar(mid, inner - 1.4), rot: mid });
    }
    angle += span;
  });

  const ringRadius = inner - RING.sidewalk - RING.roadHalfWidth;
  const outerRadius = Math.max(...buildings.map((b) => Math.hypot(b.x, b.z) + b.width / 2));
  const gateZ = outerRadius + 8;
  // Holographic code screens stand in the gaps between clusters.
  clusterGaps.slice(1).forEach((a, i) => {
    if (i % 2 === 0) billboards.push({ ...polar(a, inner + 2.5), rot: a + Math.PI });
  });

  const decor = districtDecor(id, { inner, ringRadius, outerRadius, gateZ, clusterGaps, entryGap });
  return {
    id,
    buildings,
    signposts,
    billboards,
    ringRadius,
    innerRadius: inner,
    outerRadius,
    gateZ,
    spawn: [0, 2, gateZ - 6],
    exit: { x: 0, z: gateZ + 4 },
    ...decor,
  };
}

/** Which trees grow in each district. */
const DISTRICT_TREES: Record<DistrictId, { keys: FoliageKey[]; palettes: LeafPalette[] }> = {
  business: { keys: ["round", "detailed", "plateau"], palettes: ["lilac", "lilac", "blossom"] },
  skills: { keys: ["cone", "tall", "thin", "blocks"], palettes: ["deep", "lilac"] },
  projects: { keys: ["palm", "palmBend", "palmShort"], palettes: ["mint"] },
  campus: { keys: ["oak", "fat", "round"], palettes: ["autumn", "lilac", "autumn"] },
  training: { keys: ["oak", "small", "round"], palettes: ["blossom", "mint"] },
  languages: { keys: ["detailed", "oak", "plateau"], palettes: ["blossom", "lilac"] },
  hobbies: { keys: ["oak", "fat", "small", "round"], palettes: ["blossom"] },
  arcade: { keys: ["palm", "palmShort", "palmBend"], palettes: ["mint"] },
};

const FLOWERS = ["flowerPurpleA", "flowerPurpleB", "flowerPurpleC", "flowerRed", "flowerYellowA"] as const;

/** The four paths from the plaza to the ring road (south one continues as the entry avenue). */
export const SPOKES = [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2];

/** Lamps around the ring and along the avenue, a park full of trees, flower beds, and a wild meadow outside. */
function districtDecor(
  id: DistrictId,
  r: { inner: number; ringRadius: number; outerRadius: number; gateZ: number; clusterGaps: number[]; entryGap: number },
) {
  const random = seeded(id.length * 97 + 13);
  const theme = DISTRICT_TREES[id];
  const lamps: LampSpot[] = [];
  const foliage: FoliageItem[] = [];
  const tree = (x: number, z: number, scale = 1) =>
    foliage.push({
      key: pick(random, theme.keys),
      x,
      z,
      rot: random() * Math.PI * 2,
      size: (0.85 + random() * 0.35) * scale,
      palette: pick(random, theme.palettes),
    });
  const nearSpoke = (a: number, rad: number, half: number) =>
    SPOKES.some((s) => Math.abs(Math.atan2(Math.sin(a - s), Math.cos(a - s))) * rad < half);

  // Lamps on both curbs of the ring road; outer arms reach over the road.
  const ringLampCount = Math.round((Math.PI * 2 * r.ringRadius) / 16);
  for (let i = 0; i < ringLampCount; i++) {
    const a = (i + 0.5) * ((Math.PI * 2) / ringLampCount);
    const outer = polar(a, r.ringRadius + RING.roadHalfWidth + 0.8);
    lamps.push({ ...outer, rot: faceCenter(a) });
    if (i % 2 === 0 && !nearSpoke(a, r.ringRadius, 4)) {
      const innerLamp = polar(a, r.ringRadius - RING.roadHalfWidth - 0.8);
      lamps.push({ ...innerLamp, rot: faceCenter(a) + Math.PI });
    }
  }
  // Lamps along the entry avenue.
  for (let z = r.ringRadius + RING.roadHalfWidth + 8; z < r.gateZ; z += 12) {
    lamps.push({ x: -(RING.roadHalfWidth + 0.8), z, rot: 0 }, { x: RING.roadHalfWidth + 0.8, z, rot: Math.PI });
  }

  // The park between the plaza and the ring road: tree groves, not a lone row.
  const parkIn = RING.plazaRadius + 3;
  const parkOut = r.ringRadius - RING.roadHalfWidth - 3;
  const groves = 7 + Math.round(random() * 3);
  for (let g = 0; g < groves; g++) {
    const a = (g + random() * 0.6) * ((Math.PI * 2) / groves);
    const rad = parkIn + (parkOut - parkIn) * (0.35 + random() * 0.5);
    if (nearSpoke(a, rad, 5)) continue;
    const c = polar(a, rad);
    const n = 2 + Math.round(random() * 2);
    for (let k = 0; k < n; k++) tree(c.x + (random() - 0.5) * 6, c.z + (random() - 0.5) * 6);
    foliage.push(...undergrowth(random, c.x, c.z, 4));
  }
  // Flower beds around the plaza edge.
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2 + 0.06;
    if (nearSpoke(a, RING.plazaRadius + 1.5, 3)) continue;
    const p = polar(a, RING.plazaRadius + 1.4);
    foliage.push({ key: pick(random, FLOWERS), x: p.x, z: p.z, rot: random() * 6, size: 0.9, palette: "mint" });
  }
  // A small garden in every gap between clusters, in front of the billboards.
  for (const a of r.clusterGaps.slice(1)) {
    const p = polar(a, r.inner + 1);
    tree(p.x, p.z, 0.8);
    for (let k = 0; k < 3; k++) {
      foliage.push({
        key: pick(random, FLOWERS),
        x: p.x + (random() - 0.5) * 2.5,
        z: p.z + (random() - 0.5) * 2.5,
        rot: random() * 6,
        size: 0.85,
        palette: "mint",
      });
    }
  }
  // Trees lining the avenue.
  for (let z = r.ringRadius + RING.roadHalfWidth + 14; z < r.gateZ + 6; z += 12) {
    for (const s of [-1, 1]) tree(s * (RING.roadHalfWidth + 4), z);
  }
  // A wild meadow and forest around the neighborhood.
  for (let i = 0; i < 110; i++) {
    const a = random() * Math.PI * 2;
    const rad = r.outerRadius + 8 + random() * 55;
    const p = polar(a, rad);
    if (Math.abs(p.x) < RING.roadHalfWidth + 6 && p.z > 0) continue;
    foliage.push({
      key: random() < 0.6 ? pick(random, theme.keys) : pick(random, ["pineRound", "pineTall", "pine"] as const),
      x: p.x,
      z: p.z,
      rot: random() * Math.PI * 2,
      size: 0.9 + random() * 0.6,
      palette: pick(random, [...theme.palettes, "deep"] as LeafPalette[]),
    });
  }
  return { lamps, foliage };
}

export function districtTitle(id: DistrictId) {
  return districtById(id).name;
}
