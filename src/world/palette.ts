/**
 * Wouroud's palette: violet is the lead, warm gold (its complement) and fresh
 * mint/teal are the supporting colors. Day values are the base; night values
 * are lerped in by DayNight.
 */
export const accents = {
  gold: "#f6c453",
  goldDeep: "#d69e2e",
  honey: "#fde68a",
  mint: "#5eead4",
  teal: "#14b8a6",
  tealDeep: "#0f766e",
} as const;

export const palette = {
  day: {
    sky: "#efe3fb",
    fog: "#ece2f8",
    hemiSky: "#f6efff",
    hemiGround: "#7fb8a4",
    sun: "#fff1d6",
  },
  night: {
    sky: "#1a103d",
    fog: "#1f1446",
    hemiSky: "#5b3fa8",
    hemiGround: "#0f2a2a",
    sun: "#9fa8ff",
  },
  grass: "#5aa95c",
  road: "#3b2d63",
  roadLine: accents.honey,
  sidewalk: "#f1e9dc",
  plaza: "#f3ebdc",
  lampPole: "#2d1f52",
  lampLight: "#ffd9a8",
  lampPool: "#ffcf8a",
  trunk: "#6b4a3a",
  foliage: ["#9f7aea", "#b794f4", accents.mint, "#d6bcfa"],
  window: "#ffe9b8",
  neon: "#9f7aea",
  magenta: "#d53f8c",
  bench: "#d9a066",
  bin: accents.teal,
  experience: {
    "full-time": "#6b46c1",
    freelance: "#2c7a7b",
    internship: "#9f7aea",
    apprenticeship: "#553c9a",
    volunteer: "#c0883a",
  },
  skills: {
    languages: "#7c3aed",
    frontend: "#8b5cf6",
    backend: "#6d28d9",
    databases: "#0f766e",
    tools: "#a78bfa",
    state: "#c084fc",
    hosting: "#14b8a6",
    design: "#d69e2e",
    architecture: "#4c1d95",
    ai: "#d53f8c",
  },
} as const;
