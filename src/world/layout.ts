import type { Content, Experience, Skill, SkillCategory } from "@/content/schema";
import { palette } from "./palette";

/**
 * Turns content into world-space placements. Pure and deterministic, so the
 * 3D scene, the minimap and the admin preview all agree on where things are.
 *
 * Phase 0 lays out the main avenue: it runs from the Central Plaza (z > 0)
 * toward -z, with the Business District on the left (x < 0) and Skill
 * Downtown on the right (x > 0).
 */

export const AVENUE = {
  roadHalfWidth: 6,
  sidewalkWidth: 4,
  plazaCenterZ: 22,
  plazaRadius: 16,
  startZ: 2,
};

const FRONT_X = AVENUE.roadHalfWidth + AVENUE.sidewalkWidth + 2;
const FLOOR_HEIGHT = 3.2;

export type BuildingSpec = {
  id: string;
  label: string;
  sublabel: string;
  /** Center of the footprint on the ground */
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  floors: number;
  color: string;
  /** Which way the entrance faces: +1 = toward +x, -1 = toward -x */
  facing: 1 | -1;
  crown: boolean;
};

export type CategoryBlock = {
  category: SkillCategory;
  label: string;
  z: number;
  x: number;
};

export type CityLayout = {
  experience: BuildingSpec[];
  skills: BuildingSpec[];
  skillBlocks: CategoryBlock[];
  avenueEndZ: number;
  lamps: [number, number][];
  trees: [number, number][];
};

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

/** How much a month counts toward height, so a side gig doesn't outgrow a full-time job. */
const typeWeight: Record<Experience["type"], number> = {
  "full-time": 1,
  freelance: 0.45,
  internship: 1,
  apprenticeship: 0.8,
  volunteer: 1,
};

const teamFootprint: Record<Experience["teamSize"], number> = {
  solo: 10,
  small: 12,
  medium: 16,
  large: 20,
};

const categoryLabels: Record<SkillCategory, string> = {
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

function formatSpan(job: Experience) {
  const months = monthsAt(job);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [years ? `${years} yr${years > 1 ? "s" : ""}` : "", rest ? `${rest} mo` : ""].filter(Boolean);
  return parts.join(" ");
}

function layoutExperience(jobs: Experience[]): { buildings: BuildingSpec[]; endZ: number } {
  const sorted = [...jobs].sort(
    (a, b) => Math.max(...b.roles.map((r) => toMonths(r.start))) - Math.max(...a.roles.map((r) => toMonths(r.start))),
  );
  let z = AVENUE.startZ - 6;
  const buildings = sorted.map((job) => {
    const size = teamFootprint[job.teamSize];
    const floors = Math.min(14, Math.max(2, Math.round((monthsAt(job) * typeWeight[job.type]) / 4) + 2));
    const spec: BuildingSpec = {
      id: job.id,
      label: job.company,
      sublabel: `${job.roles[0].title} · ${formatSpan(job)}`,
      x: -(FRONT_X + size / 2),
      z: z - size / 2,
      width: size,
      depth: size,
      height: floors * FLOOR_HEIGHT,
      floors,
      color: palette.experience[job.type],
      facing: 1,
      crown: job.roles.length > 1,
    };
    z -= size + 8;
    return spec;
  });
  return { buildings, endZ: z };
}

function layoutSkills(skills: Skill[]): { towers: BuildingSpec[]; blocks: CategoryBlock[]; endZ: number } {
  const order = [...new Set(skills.map((s) => s.category))];
  const towers: BuildingSpec[] = [];
  const blocks: CategoryBlock[] = [];
  const cols = 3;
  const size = 4;
  const gap = 2.5;
  let z = AVENUE.startZ - 6;

  for (const category of order) {
    const group = skills.filter((s) => s.category === category).sort((a, b) => b.level - a.level);
    blocks.push({ category, label: categoryLabels[category], z: z - 1, x: FRONT_X - 0.5 });
    group.forEach((skill, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      towers.push({
        id: skill.id,
        label: skill.name,
        sublabel: `Level ${skill.level}/10 · ${skill.years} yr${skill.years === 1 ? "" : "s"}`,
        x: FRONT_X + size / 2 + col * (size + gap),
        z: z - 3 - size / 2 - row * (size + gap),
        width: size,
        depth: size,
        height: 4 + skill.level * 3.4,
        floors: skill.level + 1,
        color: palette.skills[category],
        facing: -1,
        crown: skill.level >= 9,
      });
    });
    const rows = Math.ceil(group.length / cols);
    z -= 3 + rows * (size + gap) + 7;
  }
  return { towers, blocks, endZ: z };
}

export function computeLayout(content: Content): CityLayout {
  const exp = layoutExperience(content.experience);
  const sk = layoutSkills(content.skills);
  const avenueEndZ = Math.min(exp.endZ, sk.endZ) - 14;

  const lamps: [number, number][] = [];
  const trees: [number, number][] = [];
  const curb = AVENUE.roadHalfWidth + 0.8;
  for (let z = AVENUE.startZ - 2; z > avenueEndZ; z -= 14) {
    lamps.push([-curb, z], [curb, z]);
    trees.push([-(curb + 2.4), z - 7], [curb + 2.4, z - 7]);
  }
  // A ring of trees around the plaza
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const x = Math.cos(a) * (AVENUE.plazaRadius + 3);
    const z = AVENUE.plazaCenterZ + Math.sin(a) * (AVENUE.plazaRadius + 3);
    if (Math.abs(x) > AVENUE.roadHalfWidth + 3 || z > AVENUE.plazaCenterZ) trees.push([x, z]);
  }

  return {
    experience: exp.buildings,
    skills: sk.towers,
    skillBlocks: sk.blocks,
    avenueEndZ,
    lamps,
    trees,
  };
}
