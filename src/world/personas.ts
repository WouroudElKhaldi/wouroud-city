import type { DistrictId } from "./districts";

/**
 * Who is visiting. The choice on the welcome screen decides which districts glow
 * with a beacon, which map pins pulse, and the order of the guided tour.
 */
export type Persona = "recruiter" | "developer" | "visitor";

export const PERSONAS: Record<
  Persona,
  { label: string; emoji: string; blurb: string; highlights: DistrictId[]; tour: DistrictId[] }
> = {
  recruiter: {
    label: "Recruiter",
    emoji: "💼",
    blurb: "Work history, skills, projects and certificates first. A CV download is always one click away.",
    highlights: ["business", "skills", "projects", "training", "campus", "languages"],
    tour: ["business", "skills", "projects", "training", "campus", "languages"],
  },
  developer: {
    label: "Developer",
    emoji: "👩‍💻",
    blurb: "Projects, the tech stack and the arcade. Architecture notes inside every project building.",
    highlights: ["projects", "skills", "business", "arcade"],
    tour: ["projects", "skills", "business", "arcade"],
  },
  visitor: {
    label: "Just visiting",
    emoji: "🌸",
    blurb: "Wander, play, meet people, and see the hobbies: painting, crochet, horse riding and more.",
    highlights: ["hobbies", "arcade", "languages", "projects"],
    tour: ["hobbies", "arcade", "languages", "projects"],
  },
};
