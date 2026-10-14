import { create } from "zustand";
import type { DistrictId } from "@/world/districts";
import type { GirlOutfit } from "@/world/outfits";
import { setMuted } from "@/world/sfx";

export type AvatarKind = "girl" | "guy" | "robot";
export type TimeMode = "day" | "night";
export type SceneId = "hub" | DistrictId;

/** Something the player is standing next to and can activate with E or the on-screen prompt. */
export type Interactable = { id: string; label: string; run: () => void };

/** A seat the player can sit on: where to stand the body and which way to face. */
export type Seat = { id: string; x: number; y: number; z: number; facing: number };

export type Toast = { id: number; title?: string; text: string };

const FADE_MS = 450;
let toastId = 0;

type CityState = {
  avatar: AvatarKind;
  hijab: boolean;
  hijabColor: string;
  outfit: GirlOutfit;
  timeMode: TimeMode;
  muted: boolean;
  scene: SceneId;
  /** The district the player last left, so the hub can respawn them at its door. */
  cameFrom: DistrictId | null;
  nearby: Interactable | null;
  fading: boolean;
  seat: Seat | null;
  /** Bumped to make the avatar play a short gesture (talking, tossing a coin). */
  gesture: { name: "interact-right" | "emote-yes" | "pick-up"; at: number } | null;
  toasts: Toast[];
  setAvatar: (avatar: AvatarKind) => void;
  setHijab: (hijab: boolean) => void;
  setOutfit: (outfit: GirlOutfit) => void;
  setHijabColor: (color: string) => void;
  toggleTime: () => void;
  toggleMuted: () => void;
  setNearby: (nearby: Interactable) => void;
  clearNearby: (id: string) => void;
  goTo: (scene: SceneId) => void;
  interact: () => void;
  sit: (seat: Seat) => void;
  stand: () => void;
  playGesture: (name: NonNullable<CityState["gesture"]>["name"]) => void;
  toast: (text: string, title?: string) => void;
};

export const useCityStore = create<CityState>((set, get) => ({
  avatar: "girl",
  hijab: true,
  hijabColor: "#c49cad",
  outfit: "dress",
  timeMode: "day",
  muted: false,
  scene: "hub",
  cameFrom: null,
  nearby: null,
  fading: false,
  seat: null,
  gesture: null,
  toasts: [],
  setAvatar: (avatar) => set({ avatar }),
  setHijab: (hijab) => set({ hijab }),
  setOutfit: (outfit) => set({ outfit }),
  setHijabColor: (hijabColor) => set({ hijabColor }),
  toggleTime: () => set((s) => ({ timeMode: s.timeMode === "day" ? "night" : "day" })),
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
    set({ fading: true, nearby: null, seat: null });
    // Fade to black, swap the scene while the screen is covered, then fade back in.
    window.setTimeout(() => {
      set({ scene, cameFrom: from === "hub" ? null : from });
      window.setTimeout(() => set({ fading: false }), 120);
    }, FADE_MS);
  },
  interact: () => {
    if (get().seat) {
      get().stand();
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
}));
