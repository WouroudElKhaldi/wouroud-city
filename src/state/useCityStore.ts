import { create } from "zustand";
import type { DistrictId } from "@/world/districts";
import type { RoomScene } from "@/world/interiors";
import { DEFAULT_LOOK, LOOKS } from "@/world/outfits";
import type { Persona } from "@/world/personas";
import type { MenuItem } from "@/world/shops";
import { setMuted } from "@/world/sfx";

export type AvatarKind = "girl" | "guy" | "robot";
export type TimeMode = "day" | "night";
export type Weather = "clear" | "rain" | "snow" | "fog";
export const WEATHERS: Weather[] = ["clear", "rain", "snow", "fog"];
export type SceneId = "hub" | DistrictId | RoomScene;

/** Something the player is standing next to and can activate with E or the on-screen prompt. */
export type Interactable = { id: string; label: string; run: () => void };

/** A seat the player can sit on: where to stand the body and which way to face. */
export type Seat = { id: string; x: number; y: number; z: number; facing: number };

export type Toast = { id: number; title?: string; text: string };

/** A target on the map; a glowing path leads the player to it. */
export type Waypoint = { x: number; z: number; label: string };

/** Which building's info panel is open. */
export type Panel = { district: DistrictId; id: string };

/** The car the player is driving; `id` matches a parked car, which is hidden meanwhile. */
export type DrivingCar = { id: string; model: string; from: { x: number; z: number; rot: number } };
export type CarSpot = { x: number; z: number; rot: number };

/** A full-screen mini activity: an arcade game or the painting easel. */
export type Activity = "stack" | "paint" | "xo" | "flappy";

/**
 * A race against bots on the Arcade Pier's ring road. "grid": waiting for the arcade scene to
 * put the player in a car on the start line; then a countdown, the race, and the result.
 */
export type Race = {
  phase: "grid" | "countdown" | "racing" | "finished";
  laps: number;
  lap: number;
  position: number;
  racers: number;
  /** performance.now() when the lights go green */
  goAt: number;
  /** Seconds, once finished */
  time?: number;
};

/** A food order in a café or restaurant: served at the shop's table, eaten sitting down. */
export type Order = { shop: string; item: MenuItem; at: number };

const FADE_MS = 450;
let toastId = 0;

type CityState = {
  /** False while the welcome screen is showing. */
  started: boolean;
  persona: Persona | null;
  waypoint: Waypoint | null;
  panel: Panel | null;
  mapOpen: boolean;
  activity: Activity | null;
  race: Race | null;
  /** The menu card that's open (a shop label) */
  menu: string | null;
  order: Order | null;
  driving: DrivingCar | null;
  /** Bumped to ask the canvas for a photo of the current view. */
  photoAt: number;
  /** Set by E while driving; the Player parks the car where it is and steps out. */
  exitCar: boolean;
  /** Where cars were left after a drive, by car id (they don't jump back to their old spot). */
  parked: Record<string, CarSpot>;
  /** Bumped when someone gets into or out of a car, so that car swings its door. */
  doorSwing: { id: string; at: number } | null;
  avatar: AvatarKind;
  /** The avatar's look: a Rocketbox avatar id from LOOKS */
  outfit: string;
  timeMode: TimeMode;
  weather: Weather;
  muted: boolean;
  scene: SceneId;
  /** The district the player last left, so the hub can respawn them at its door. */
  cameFrom: SceneId | null;
  nearby: Interactable | null;
  fading: boolean;
  seat: Seat | null;
  /** Bumped to make the avatar play a short gesture (talking, tossing a coin). */
  gesture: { name: "interact-right" | "emote-yes" | "pick-up"; at: number } | null;
  toasts: Toast[];
  setAvatar: (avatar: AvatarKind) => void;
  setOutfit: (outfit: string) => void;
  toggleTime: () => void;
  cycleWeather: () => void;
  toggleMuted: () => void;
  setNearby: (nearby: Interactable) => void;
  clearNearby: (id: string) => void;
  goTo: (scene: SceneId) => void;
  interact: () => void;
  sit: (seat: Seat) => void;
  stand: () => void;
  playGesture: (name: NonNullable<CityState["gesture"]>["name"]) => void;
  toast: (text: string, title?: string) => void;
  start: (persona: Persona) => void;
  setPersona: (persona: Persona) => void;
  showWelcome: () => void;
  setWaypoint: (waypoint: Waypoint | null) => void;
  openPanel: (panel: Panel | null) => void;
  setMapOpen: (open: boolean) => void;
  setActivity: (activity: Activity | null) => void;
  /** Line up for a race on the Arcade Pier's ring road (goes there if needed). */
  startRace: () => void;
  openMenu: (shop: string | null) => void;
  placeOrder: (shop: string, item: MenuItem) => void;
  finishOrder: () => void;
  updateRace: (race: Partial<Race> | null) => void;
  startDriving: (car: DrivingCar) => void;
  takePhoto: () => void;
  stopDriving: (spot: CarSpot) => void;
};

export const useCityStore = create<CityState>((set, get) => ({
  started: false,
  persona: null,
  waypoint: null,
  panel: null,
  mapOpen: false,
  activity: null,
  race: null,
  menu: null,
  order: null,
  driving: null,
  photoAt: 0,
  exitCar: false,
  parked: {},
  doorSwing: null,
  avatar: "girl",
  outfit: DEFAULT_LOOK,
  timeMode: "day",
  weather: "clear",
  muted: false,
  scene: "hub",
  cameFrom: null,
  nearby: null,
  fading: false,
  seat: null,
  gesture: null,
  toasts: [],
  setAvatar: (avatar) => set({ avatar, outfit: avatar === "robot" ? get().outfit : LOOKS[avatar][0].id }),
  setOutfit: (outfit) => set({ outfit }),
  toggleTime: () => set((s) => ({ timeMode: s.timeMode === "day" ? "night" : "day" })),
  cycleWeather: () => set((s) => ({ weather: WEATHERS[(WEATHERS.indexOf(s.weather) + 1) % WEATHERS.length] })),
  toggleMuted: () => {
    const muted = !get().muted;
    setMuted(muted);
    set({ muted });
  },
  setNearby: (nearby) => set({ nearby }),
  clearNearby: (id) => {
    if (get().nearby?.id === id) set({ nearby: null });
  },
  goTo: (scene) => {
    if (get().fading || get().scene === scene) return;
    const from = get().scene;
    const race = get().race?.phase === "grid" && scene === "arcade" ? get().race : null;
    set({ fading: true, nearby: null, seat: null, panel: null, mapOpen: false, driving: null, exitCar: false, race, menu: null, order: null });
    // Fade to black, swap the scene while the screen is covered, then fade back in.
    window.setTimeout(() => {
      set({ scene, cameFrom: from === "hub" ? null : from, waypoint: null });
      window.setTimeout(() => set({ fading: false }), 120);
    }, FADE_MS);
  },
  interact: () => {
    if (!get().started || get().panel || get().activity || get().menu) return;
    if (get().seat) {
      get().stand();
      return;
    }
    if (get().driving) {
      // Stepping out of the car abandons a race.
      set({ exitCar: true, race: null });
      return;
    }
    get().nearby?.run();
  },
  sit: (seat) => set({ seat, nearby: null }),
  stand: () => set({ seat: null }),
  playGesture: (name) => set({ gesture: { name, at: performance.now() } }),
  toast: (text, title) => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, title }] }));
    window.setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 6000);
  },
  start: (persona) => set({ persona, started: true }),
  setPersona: (persona) => set({ persona }),
  showWelcome: () => set({ started: false, panel: null, mapOpen: false }),
  setWaypoint: (waypoint) => set({ waypoint, mapOpen: false }),
  openPanel: (panel) => set({ panel, nearby: null }),
  setMapOpen: (mapOpen) => set({ mapOpen }),
  setActivity: (activity) => set({ activity, panel: null, nearby: null }),
  startRace: () => {
    set({ race: { phase: "grid", laps: 3, lap: 0, position: 1, racers: 4, goAt: 0 }, panel: null, nearby: null, seat: null });
    if (get().scene !== "arcade") get().goTo("arcade");
  },
  openMenu: (menu) => set({ menu, nearby: null }),
  placeOrder: (shop, item) => {
    set({ order: { shop, item, at: performance.now() }, menu: null });
    get().toast(`Your ${item.name} is on the table with the candle. Sit down to enjoy it.`, shop);
  },
  finishOrder: () => set({ order: null }),
  updateRace: (race) => set((s) => ({ race: race && s.race ? { ...s.race, ...race } : null })),
  takePhoto: () => set({ photoAt: Date.now(), panel: null }),
  startDriving: (driving) =>
    set({ driving, nearby: null, seat: null, exitCar: false, doorSwing: { id: driving.id, at: performance.now() } }),
  stopDriving: (spot) =>
    set((s) => ({
      driving: null,
      exitCar: false,
      parked: s.driving ? { ...s.parked, [s.driving.id]: spot } : s.parked,
      doorSwing: s.driving ? { id: s.driving.id, at: performance.now() } : s.doorSwing,
    })),
}));

// Handy when debugging in the browser console.
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") Object.assign(window, { __store: useCityStore });
