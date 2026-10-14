import { create } from "zustand";
import type { DistrictId } from "@/world/districts";

export type AvatarKind = "girl" | "guy" | "robot";
export type TimeMode = "day" | "night";
export type SceneId = "hub" | DistrictId;

/** Something the player is standing next to and can activate with E / the Enter button. */
export type Interactable = { kind: "enter"; district: DistrictId } | { kind: "exit" };

const FADE_MS = 450;

type CityState = {
  avatar: AvatarKind;
  hijab: boolean;
  timeMode: TimeMode;
  scene: SceneId;
  /** The district the player last left, so the hub can respawn them at its door. */
  cameFrom: DistrictId | null;
  nearby: Interactable | null;
  fading: boolean;
  setAvatar: (avatar: AvatarKind) => void;
  setHijab: (hijab: boolean) => void;
  toggleTime: () => void;
  setNearby: (nearby: Interactable | null) => void;
  clearNearby: (match: Interactable) => void;
  goTo: (scene: SceneId) => void;
  interact: () => void;
};

export const useCityStore = create<CityState>((set, get) => ({
  avatar: "girl",
  hijab: true,
  timeMode: "day",
  scene: "hub",
  cameFrom: null,
  nearby: null,
  fading: false,
  setAvatar: (avatar) => set({ avatar }),
  setHijab: (hijab) => set({ hijab }),
  toggleTime: () => set((s) => ({ timeMode: s.timeMode === "day" ? "night" : "day" })),
  setNearby: (nearby) => set({ nearby }),
  clearNearby: (match) => {
    const current = get().nearby;
    if (current && JSON.stringify(current) === JSON.stringify(match)) set({ nearby: null });
  },
  goTo: (scene) => {
    if (get().fading || get().scene === scene) return;
    const from = get().scene;
    set({ fading: true, nearby: null });
    // Fade to black, swap the scene while the screen is covered, then fade back in.
    window.setTimeout(() => {
      set({ scene, cameFrom: from === "hub" ? null : from });
      window.setTimeout(() => set({ fading: false }), 120);
    }, FADE_MS);
  },
  interact: () => {
    const { nearby, goTo } = get();
    if (!nearby) return;
    if (nearby.kind === "enter") goTo(nearby.district);
    else goTo("hub");
  },
}));
