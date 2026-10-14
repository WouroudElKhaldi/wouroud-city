/**
 * Every building's identity: a 3D rooftop emblem, its brand accent color and,
 * for skill towers, the tower's silhouette. Keyed by content id, so the CSS
 * tower never looks like the JS tower and FitSync never looks like Jamrex.
 * Content added later from the admin falls back to a lettered emblem.
 */

export type Emblem =
  | "letters"
  | "atom"
  | "brackets"
  | "layers"
  | "hexagon"
  | "leaf"
  | "containers"
  | "branch"
  | "cylinders"
  | "flame"
  | "bolt"
  | "prism"
  | "shield"
  | "gear"
  | "palette"
  | "chip"
  | "cloud"
  | "chat"
  | "target"
  | "dumbbell"
  | "bag"
  | "pulse"
  | "vault"
  | "planet"
  | "phone"
  | "chart"
  | "lemon"
  | "candles"
  | "laptop"
  | "heart"
  | "people"
  | "rocket"
  | "infinity"
  | "dots"
  | "stripes"
  | "cap"
  | "crane"
  | "clock"
  | "dome"
  | "spire"
  | "brush"
  | "yarn"
  | "camera"
  | "horseshoe"
  | "books"
  | "pencil"
  | "poster"
  | "star"
  | "joystick"
  | "vee"
  | "kanban"
  | "dish"
  | "network"
  | "frame"
  | "flower"
  | "cubes";

export type TowerShape = "box" | "cylinder" | "hex" | "tapered" | "stepped" | "twisted";

export type Signature = { emblem: Emblem; accent: string; text?: string; shape?: TowerShape };

const S: Record<string, Signature> = {
  // Skills
  javascript: { emblem: "letters", text: "JS", accent: "#f7df1e", shape: "box" },
  typescript: { emblem: "letters", text: "TS", accent: "#3178c6", shape: "tapered" },
  php: { emblem: "letters", text: "php", accent: "#8892bf", shape: "cylinder" },
  python: { emblem: "letters", text: "Py", accent: "#ffd43b", shape: "twisted" },
  html: { emblem: "brackets", accent: "#e34f26", shape: "stepped" },
  css: { emblem: "layers", accent: "#2965f1", shape: "hex" },
  react: { emblem: "atom", accent: "#61dafb", shape: "cylinder" },
  nextjs: { emblem: "letters", text: "N", accent: "#f8fafc", shape: "box" },
  vue: { emblem: "vee", accent: "#42b883", shape: "tapered" },
  angular: { emblem: "shield", accent: "#dd0031", shape: "hex" },
  shadcn: { emblem: "letters", text: "ui", accent: "#e2e8f0", shape: "stepped" },
  mui: { emblem: "letters", text: "M", accent: "#007fff", shape: "box" },
  daisyui: { emblem: "flower", accent: "#ffd23f", shape: "cylinder" },
  "react-native": { emblem: "phone", accent: "#61dafb", shape: "tapered" },
  nodejs: { emblem: "hexagon", accent: "#5fa04e", shape: "hex" },
  express: { emblem: "letters", text: "ex", accent: "#d1d5db", shape: "box" },
  nestjs: { emblem: "letters", text: "Nest", accent: "#e0234e", shape: "twisted" },
  laravel: { emblem: "cubes", accent: "#ff2d20", shape: "stepped" },
  postgresql: { emblem: "cylinders", accent: "#4f8fd6", shape: "cylinder" },
  mysql: { emblem: "cylinders", accent: "#f29111", shape: "box" },
  mongodb: { emblem: "leaf", accent: "#47a248", shape: "tapered" },
  firebase: { emblem: "flame", accent: "#ffca28", shape: "cylinder" },
  supabase: { emblem: "bolt", accent: "#3ecf8e", shape: "hex" },
  prisma: { emblem: "prism", accent: "#5a67d8", shape: "tapered" },
  typeorm: { emblem: "letters", text: "ORM", accent: "#fe0902", shape: "box" },
  sequelize: { emblem: "hexagon", accent: "#52b0e7", shape: "stepped" },
  docker: { emblem: "containers", accent: "#2496ed", shape: "box" },
  git: { emblem: "branch", accent: "#f05032", shape: "twisted" },
  "github-gitlab": { emblem: "star", accent: "#fc6d26", shape: "hex" },
  jira: { emblem: "kanban", accent: "#2684ff", shape: "box" },
  rest: { emblem: "dish", accent: "#a78bfa", shape: "cylinder" },
  graphql: { emblem: "prism", accent: "#e10098", shape: "hex" },
  redux: { emblem: "infinity", accent: "#764abc", shape: "twisted" },
  zustand: { emblem: "letters", text: "Z", accent: "#c4a484", shape: "tapered" },
  gcp: { emblem: "cloud", accent: "#4285f4", shape: "cylinder" },
  cpanel: { emblem: "gear", accent: "#ff6c2c", shape: "box" },
  aapanel: { emblem: "gear", accent: "#20a53a", shape: "stepped" },
  figma: { emblem: "dots", accent: "#a259ff", shape: "cylinder" },
  uiux: { emblem: "palette", accent: "#f472b6", shape: "tapered" },
  architecture: { emblem: "frame", accent: "#fde68a", shape: "stepped" },
  "system-design": { emblem: "network", accent: "#5eead4", shape: "hex" },
  "api-dev": { emblem: "dish", accent: "#f6c453", shape: "twisted" },
  n8n: { emblem: "chip", accent: "#ea4b71", shape: "box" },

  // Projects
  hyperfocus: { emblem: "target", accent: "#f6c453" },
  fitsync: { emblem: "dumbbell", accent: "#5eead4" },
  "tripoli-pulse": { emblem: "pulse", accent: "#f472b6" },
  jamrex: { emblem: "bag", accent: "#ec4899" },
  cospace: { emblem: "planet", accent: "#67e8f9" },
  "linkedin-ai-workflow": { emblem: "chat", accent: "#38bdf8" },
  "aid-knn": { emblem: "chart", accent: "#fbbf24" },
  "little-lemon": { emblem: "lemon", accent: "#fde047" },
  "rn-todo": { emblem: "phone", accent: "#61dafb" },
  "private-work": { emblem: "vault", accent: "#f6c453" },

  // Jobs
  sahme: { emblem: "candles", accent: "#22c55e" },
  freelance: { emblem: "laptop", accent: "#5eead4" },
  "life-sculptor": { emblem: "heart", accent: "#f472b6" },
  develeb: { emblem: "people", accent: "#a78bfa" },
  codsoft: { emblem: "brackets", accent: "#fb923c" },
  codi: { emblem: "rocket", accent: "#f6c453" },

  // Certificates and training
  "meta-frontend": { emblem: "infinity", accent: "#0081fb" },
  "meta-react-native": { emblem: "phone", accent: "#0081fb" },
  "ibm-frontend": { emblem: "stripes", accent: "#4589ff" },
  "google-ux": { emblem: "dots", accent: "#fbbc04" },
  "fcc-rwd": { emblem: "flame", accent: "#f1be32" },
  "codi-bootcamp": { emblem: "rocket", accent: "#a78bfa" },
  "global-education": { emblem: "cap", accent: "#f6c453" },
  "semicolon-websec": { emblem: "shield", accent: "#22d3ee" },
  se2: { emblem: "crane", accent: "#fbbf24" },

  // Studies and languages
  "lt-informatics": { emblem: "clock", accent: "#fde68a" },
  arabic: { emblem: "dome", accent: "#f6c453" },
  english: { emblem: "clock", accent: "#ef4444" },
  french: { emblem: "spire", accent: "#60a5fa" },

  // Hobbies
  painting: { emblem: "palette", accent: "#f472b6" },
  "digital-drawing": { emblem: "pencil", accent: "#fbbf24" },
  posters: { emblem: "poster", accent: "#a78bfa" },
  crafting: { emblem: "star", accent: "#5eead4" },
  crochet: { emblem: "yarn", accent: "#f9a8d4" },
  photography: { emblem: "camera", accent: "#e2e8f0" },
  "horse-riding": { emblem: "horseshoe", accent: "#d69e2e" },
  learning: { emblem: "books", accent: "#60a5fa" },

  // Arcade
  "full-stack-arcade": { emblem: "joystick", accent: "#fef08a" },
};

const SHAPES: TowerShape[] = ["box", "cylinder", "hex", "tapered", "stepped", "twisted"];
const FALLBACK_ACCENTS = ["#f6c453", "#5eead4", "#f0abfc", "#a78bfa", "#fde68a", "#67e8f9"];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** The signature for a building; unknown ids get initials, a color and a shape from their id. */
export function signatureFor(id: string, label: string): Signature | null {
  if (id.startsWith("filler-")) return null;
  const known = S[id];
  if (known) return known;
  const h = hash(id);
  const initials = label
    .split(/[\s./-]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 3);
  return { emblem: "letters", text: initials, accent: FALLBACK_ACCENTS[h % FALLBACK_ACCENTS.length], shape: SHAPES[h % SHAPES.length] };
}
