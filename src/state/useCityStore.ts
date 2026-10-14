import { create } from "zustand";

export type AvatarKind = "girl" | "guy" | "robot";
export type TimeMode = "day" | "night";

type CityState = {
  avatar: AvatarKind;
  hijab: boolean;
  timeMode: TimeMode;
  setAvatar: (avatar: AvatarKind) => void;
  setHijab: (hijab: boolean) => void;
  toggleTime: () => void;
};

export const useCityStore = create<CityState>((set) => ({
  avatar: "girl",
  hijab: true,
  timeMode: "day",
  setAvatar: (avatar) => set({ avatar }),
  setHijab: (hijab) => set({ hijab }),
  toggleTime: () => set((s) => ({ timeMode: s.timeMode === "day" ? "night" : "day" })),
}));
