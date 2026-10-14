"use client";

import { useEffect } from "react";
import { useCityStore } from "@/state/useCityStore";
import { music } from "@/world/music";

/** Plays the soft background music for the current place, time and weather. Follows the mute button. */
export function Ambience() {
  const started = useCityStore((s) => s.started);
  const muted = useCityStore((s) => s.muted);
  const scene = useCityStore((s) => s.scene);
  const night = useCityStore((s) => s.timeMode === "night");
  const rain = useCityStore((s) => s.weather === "rain");
  const activity = useCityStore((s) => s.activity);

  useEffect(() => {
    if (!started || muted) {
      music.stop();
      return;
    }
    music.setMood(activity === "stack" ? "arcade" : activity === "paint" ? "hobbies" : scene, night);
    music.start();
    music.setRain(rain);
  }, [started, muted, scene, night, rain, activity]);

  useEffect(() => () => music.stop(), []);
  return null;
}
