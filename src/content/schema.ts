import { z } from "zod";

/**
 * The single source of truth for every piece of portfolio content.
 * The 3D city, the map, the résumé page and the admin forms all read these shapes.
 * Dates are "YYYY-MM" strings ("YYYY" when only the year is known); an `end` of null means "present".
 */

const monthString = z.string().regex(/^\d{4}(-(0[1-9]|1[0-2]))?$/, "Use YYYY-MM or YYYY");
const link = z.object({ label: z.string(), url: z.url() });

export const profileSchema = z.object({
  name: z.string(),
  title: z.string(),
  headline: z.string(),
  location: z.string(),
  email: z.email(),
  phone: z.string().optional(),
  photo: z.string().optional(),
  shortBio: z.string(),
  about: z.array(z.string()),
  story: z.array(z.string()),
  links: z.array(link),
  privateWorkNote: z.string(),
  topSkills: z.array(z.string()),
});

export const skillCategories = [
  "languages",
  "frontend",
  "backend",
  "databases",
  "tools",
  "state",
  "hosting",
  "design",
  "architecture",
  "ai",
] as const;

export const skillSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(skillCategories),
  /** 1–10, sets the tower height */
  level: z.number().int().min(1).max(10),
  years: z.number().min(0).max(50),
  note: z.string().optional(),
});

export const roleSchema = z.object({
  title: z.string(),
  start: monthString,
  end: monthString.nullable(),
});

export const experienceSchema = z.object({
  id: z.string(),
  company: z.string(),
  formerName: z.string().optional(),
  type: z.enum(["full-time", "freelance", "internship", "apprenticeship", "volunteer"]),
  location: z.string(),
  remote: z.boolean(),
  /** Newest role first; a promotion is a second role at the same company */
  roles: z.array(roleSchema).min(1),
  teamSize: z.enum(["solo", "small", "medium", "large"]),
  summary: z.string(),
  highlights: z.array(z.string()),
  tech: z.array(z.string()),
  plaque: z.string().optional(),
});

export const educationSchema = z.object({
  id: z.string(),
  degree: z.string(),
  field: z.string(),
  school: z.string(),
  location: z.string(),
  start: monthString,
  end: monthString.nullable(),
  notes: z.array(z.string()),
});

export const trainingSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string(),
  issuer: z.string().optional(),
  date: monthString.nullable(),
  status: z.enum(["completed", "in-progress"]),
  kind: z.enum(["certificate", "bootcamp", "scholarship", "program"]),
  courses: z.array(z.string()),
  verifyUrl: z.url().optional(),
  image: z.string().optional(),
  summary: z.string(),
});

export const languageSchema = z.object({
  id: z.string(),
  name: z.string(),
  level: z.enum(["A1", "A2", "B1", "B2", "C1", "C2", "native"]),
  greeting: z.string(),
  flag: z.string(),
});

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  pitch: z.string(),
  description: z.array(z.string()),
  kind: z.enum(["web", "mobile", "ai", "fullstack", "automation", "ecommerce", "ml"]),
  category: z.enum(["personal", "client", "bootcamp", "course", "team", "work-private"]),
  tier: z.enum(["flagship", "featured", "standard"]),
  status: z.enum(["live", "offline", "in-progress", "private"]),
  role: z.string(),
  tech: z.array(z.string()),
  highlights: z.array(z.string()),
  links: z.array(link),
  media: z.array(z.string()),
  year: z.number().int(),
  plaque: z.string().optional(),
});

export const hobbySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  /** Which 3D building and mini-interaction this hobby gets */
  building: z.enum([
    "gallery",
    "drawing-studio",
    "print-shop",
    "craft-workshop",
    "yarn-shop",
    "photo-studio",
    "stables",
    "library",
  ]),
  interaction: z.string(),
  media: z.array(z.string()),
});

export const eventSchema = z.object({
  id: z.string(),
  name: z.string(),
  organizer: z.string(),
  place: z.string(),
  date: monthString,
  note: z.string(),
});

export const npcLineSchema = z.object({
  id: z.string(),
  text: z.string(),
  /** Which district's NPCs may say it; "any" means everywhere */
  district: z.string(),
});

export const contentSchema = z.object({
  profile: profileSchema,
  skills: z.array(skillSchema),
  experience: z.array(experienceSchema),
  education: z.array(educationSchema),
  trainings: z.array(trainingSchema),
  languages: z.array(languageSchema),
  projects: z.array(projectSchema),
  hobbies: z.array(hobbySchema),
  events: z.array(eventSchema),
  npcLines: z.array(npcLineSchema),
});

export type Profile = z.infer<typeof profileSchema>;
export type SkillCategory = (typeof skillCategories)[number];
export type Skill = z.infer<typeof skillSchema>;
export type Experience = z.infer<typeof experienceSchema>;
export type Education = z.infer<typeof educationSchema>;
export type Training = z.infer<typeof trainingSchema>;
export type Language = z.infer<typeof languageSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Hobby = z.infer<typeof hobbySchema>;
export type CityEvent = z.infer<typeof eventSchema>;
export type NpcLine = z.infer<typeof npcLineSchema>;
export type Content = z.infer<typeof contentSchema>;
