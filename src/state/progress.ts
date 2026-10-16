import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * The visitor's adventure: what they've done in the city (districts and buildings visited, people
 * met, games won, ducks found…), quests completed and XP. Saved in this browser.
 */

export type GameEvent =
  | { type: "scene"; scene: string }
  | { type: "talk" }
  | { type: "sit" }
  | { type: "meal"; shop: string }
  | { type: "coin" }
  | { type: "drive" }
  | { type: "photo" }
  | { type: "duck"; id: string }
  | { type: "xo-win"; level: "easy" | "medium" | "hard" }
  | { type: "flappy"; score: number }
  | { type: "stack"; score: number }
  | { type: "race"; position: number }
  | { type: "crochet" }
  | { type: "guestbook" }
  | { type: "quiz" };

export type Progress = {
  districts: string[];
  rooms: string[];
  talks: number;
  sits: number;
  meals: string[];
  coins: number;
  drives: number;
  photos: number;
  ducks: string[];
  xoWins: { easy: number; medium: number; hard: number };
  bestFlappy: number;
  bestStack: number;
  bestRace: number;
  crochet: number;
  /** Guestbook notes written (missing in progress saved before the guestbook existed) */
  signed?: number;
  /** Skill quiz questions answered right (missing in older saves) */
  quizzes?: number;
};

export type Quest = { id: string; icon: string; title: string; text: string; xp: number; goal: number; value: (p: Progress) => number };

export const DUCKS = 5;

export const QUESTS: Quest[] = [
  { id: "explorer", icon: "🧭", title: "Explorer", text: "Visit all 8 districts", xp: 80, goal: 8, value: (p) => p.districts.length },
  { id: "first-steps", icon: "👣", title: "First steps", text: "Walk into your first district", xp: 10, goal: 1, value: (p) => p.districts.length },
  { id: "insider", icon: "🚪", title: "Insider", text: "Walk into 10 buildings", xp: 60, goal: 10, value: (p) => p.rooms.length },
  { id: "social", icon: "💬", title: "Social butterfly", text: "Chat with 5 people in the streets", xp: 40, goal: 5, value: (p) => p.talks },
  { id: "foodie", icon: "🍽️", title: "Foodie", text: "Eat a meal in a café or restaurant", xp: 30, goal: 1, value: (p) => p.meals.length },
  { id: "gourmet", icon: "🥙", title: "Gourmet", text: "Eat in 3 different places", xp: 50, goal: 3, value: (p) => p.meals.length },
  { id: "wish", icon: "🪙", title: "Make a wish", text: "Toss a coin in a fountain", xp: 15, goal: 1, value: (p) => p.coins },
  { id: "rest", icon: "🪑", title: "Take a break", text: "Sit down somewhere and enjoy the view", xp: 10, goal: 1, value: (p) => p.sits },
  { id: "driver", icon: "🚗", title: "Road trip", text: "Drive a car", xp: 20, goal: 1, value: (p) => p.drives },
  { id: "xo", icon: "❌", title: "Bot beater", text: "Beat the XO bot on Medium or Hard", xp: 50, goal: 1, value: (p) => p.xoWins.medium + p.xoWins.hard },
  { id: "flyer", icon: "🐦", title: "Firewall Flyer", text: "Fly through 10 firewalls", xp: 50, goal: 10, value: (p) => p.bestFlappy },
  { id: "stacker", icon: "🧱", title: "Full stack", text: "Stack 10 layers in Full Stack", xp: 50, goal: 10, value: (p) => p.bestStack },
  { id: "racer", icon: "🏆", title: "Champion", text: "Win the Ring Road Rally", xp: 80, goal: 1, value: (p) => (p.bestRace === 1 ? 1 : 0) },
  { id: "ducks", icon: "🦆", title: "Duck hunt", text: `Find the ${DUCKS} golden rubber ducks hidden in the city`, xp: 100, goal: DUCKS, value: (p) => p.ducks.length },
  { id: "photographer", icon: "📸", title: "Photographer", text: "Take a photo of the city", xp: 15, goal: 1, value: (p) => p.photos },
  { id: "maker", icon: "🧶", title: "Maker", text: "Finish a crochet bunny in the Hobby Quarter", xp: 30, goal: 1, value: (p) => p.crochet },
  { id: "scholar", icon: "🎓", title: "Skill scholar", text: "Answer 10 quiz questions right in the skill buildings", xp: 60, goal: 10, value: (p) => p.quizzes ?? 0 },
  { id: "guest", icon: "✍️", title: "Leave your mark", text: "Sign the guestbook by the hub fountain", xp: 20, goal: 1, value: (p) => p.signed ?? 0 },
];

export const levelOf = (xp: number) => Math.floor(xp / 100) + 1;

const EMPTY: Progress = {
  districts: [],
  rooms: [],
  talks: 0,
  sits: 0,
  meals: [],
  coins: 0,
  drives: 0,
  photos: 0,
  ducks: [],
  xoWins: { easy: 0, medium: 0, hard: 0 },
  bestFlappy: 0,
  bestStack: 0,
  bestRace: 0,
  crochet: 0,
};

const DISTRICTS = ["business", "skills", "projects", "campus", "training", "languages", "hobbies", "arcade"];
const add = (list: string[], v: string) => (list.includes(v) ? list : [...list, v]);

function apply(p: Progress, e: GameEvent): Progress {
  switch (e.type) {
    case "scene":
      if (e.scene.startsWith("room:")) return { ...p, rooms: add(p.rooms, e.scene) };
      return DISTRICTS.includes(e.scene) ? { ...p, districts: add(p.districts, e.scene) } : p;
    case "talk":
      return { ...p, talks: p.talks + 1 };
    case "sit":
      return { ...p, sits: p.sits + 1 };
    case "meal":
      return { ...p, meals: add(p.meals, e.shop) };
    case "coin":
      return { ...p, coins: p.coins + 1 };
    case "drive":
      return { ...p, drives: p.drives + 1 };
    case "photo":
      return { ...p, photos: p.photos + 1 };
    case "duck":
      return { ...p, ducks: add(p.ducks, e.id) };
    case "xo-win":
      return { ...p, xoWins: { ...p.xoWins, [e.level]: p.xoWins[e.level] + 1 } };
    case "flappy":
      return { ...p, bestFlappy: Math.max(p.bestFlappy, e.score) };
    case "stack":
      return { ...p, bestStack: Math.max(p.bestStack, e.score) };
    case "race":
      return { ...p, bestRace: p.bestRace === 0 ? e.position : Math.min(p.bestRace, e.position) };
    case "crochet":
      return { ...p, crochet: p.crochet + 1 };
    case "guestbook":
      return { ...p, signed: (p.signed ?? 0) + 1 };
    case "quiz":
      return { ...p, quizzes: (p.quizzes ?? 0) + 1 };
  }
}

type ProgressState = {
  progress: Progress;
  done: string[];
  xp: number;
  journalOpen: boolean;
  /** Quests completed by the last event, for the HUD to announce. */
  fresh: Quest[];
  track: (e: GameEvent) => void;
  setJournalOpen: (open: boolean) => void;
  clearFresh: () => void;
  reset: () => void;
};

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      progress: EMPTY,
      done: [],
      xp: 0,
      journalOpen: false,
      fresh: [],
      track: (e) => {
        const progress = apply(get().progress, e);
        const finished = QUESTS.filter((q) => !get().done.includes(q.id) && q.value(progress) >= q.goal);
        set({
          progress,
          done: [...get().done, ...finished.map((q) => q.id)],
          xp: get().xp + finished.reduce((n, q) => n + q.xp, 0),
          fresh: finished.length ? [...get().fresh, ...finished] : get().fresh,
        });
      },
      setJournalOpen: (journalOpen) => set({ journalOpen }),
      clearFresh: () => set({ fresh: [] }),
      reset: () => set({ progress: EMPTY, done: [], xp: 0, fresh: [] }),
    }),
    {
      name: "wouroud-city:progress",
      storage: createJSONStorage(() => {
        try {
          return localStorage;
        } catch {
          return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
        }
      }),
      partialize: (s) => ({ progress: s.progress, done: s.done, xp: s.xp }),
      merge: (stored, current) => {
        const s = stored as Partial<ProgressState> | undefined;
        return { ...current, ...s, progress: { ...EMPTY, ...(s?.progress ?? {}) } };
      },
    },
  ),
);

/** Shorthand for the rest of the code: report something the visitor did. */
export const track = (e: GameEvent) => useProgress.getState().track(e);
