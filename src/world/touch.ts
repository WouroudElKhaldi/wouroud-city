import { useSyncExternalStore } from "react";

/**
 * Touch input shared between the on-screen controls (DOM) and the Player (R3F).
 * Written by the joystick and buttons, read by the Player every frame, so it is
 * a plain object and never triggers React renders.
 */
export const touchInput = {
  /** Joystick, -1..1. y > 0 is forward. */
  x: 0,
  y: 0,
  run: false,
  jump: false,
};

const COARSE = "(pointer: coarse)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(COARSE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True on phones and tablets (a finger is the main pointer). */
export function isTouchDevice() {
  return typeof window !== "undefined" && window.matchMedia(COARSE).matches;
}

export function useIsTouch() {
  return useSyncExternalStore(subscribe, isTouchDevice, () => false);
}
