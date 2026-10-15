"use client";

import { useEffect } from "react";
import { useCityStore } from "@/state/useCityStore";
import { sceneDistrict } from "@/world/interiors";
import { music } from "@/world/music";
import { sfx } from "@/world/sfx";

/** Plays the soft background music for the current place, time and weather. Follows the mute button. */
export function Ambience() {
  const started = useCityStore((s) => s.started);
  const muted = useCityStore((s) => s.muted);
  const scene = useCityStore((s) => s.scene);
  const night = useCityStore((s) => s.dark);
  const rain = useCityStore((s) => s.weather === "rain");
  const activity = useCityStore((s) => s.activity);

  useEffect(() => {
    if (!started || muted) {
      music.stop();
      return;
    }
    music.setMood(activity === "stack" ? "arcade" : activity === "paint" ? "hobbies" : (sceneDistrict(scene) ?? "hub"), night);
    music.start();
    music.setRain(rain);
  }, [started, muted, scene, night, rain, activity]);

  useEffect(() => () => music.stop(), []);

  // Life in the air: birdsong by day, crickets at night, outdoors only (and quiet in the rain).
  const outdoors = !scene.startsWith("room:");
  useEffect(() => {
    if (!started || muted || !outdoors || rain || activity) return;
    let timer = 0;
    const next = () => {
      timer = window.setTimeout(() => {
        if (night) sfx.cricket();
        else sfx.songbird();
        next();
      }, (night ? 1500 : 4000) + Math.random() * (night ? 2500 : 7000));
    };
    next();
    return () => window.clearTimeout(timer);
  }, [started, muted, outdoors, rain, night, activity]);
  return null;
}
