"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { useCityStore } from "@/state/useCityStore";
import type { DistrictId } from "@/world/districts";
import { playerState } from "@/world/env";
import type { BuildingSpec } from "@/world/layout";

const RADIUS = 3.6;

/**
 * Offers "View <building>" when the player stands at a building's entrance;
 * E opens that building's info panel. Picks the nearest door each frame.
 */
export function BuildingDoors({ district, buildings }: { district: DistrictId; buildings: BuildingSpec[] }) {
  const current = useRef<string | null>(null);

  useFrame(() => {
    const store = useCityStore.getState();
    let best: BuildingSpec | null = null;
    let bestD = RADIUS * RADIUS;
    if (store.started && !store.seat && !store.fading && !store.panel) {
      for (const b of buildings) {
        const doorX = b.x + (b.facing * b.width) / 2 + b.facing * 1.6;
        const d = (doorX - playerState.position.x) ** 2 + (b.z - playerState.position.z) ** 2;
        if (d < bestD) {
          bestD = d;
          best = b;
        }
      }
    }
    const id = best ? `door-${best.id}` : null;
    if (id === current.current && (!id || store.nearby?.id === id)) return;
    if (current.current && current.current !== id) store.clearNearby(current.current);
    current.current = id;
    if (best) {
      const target = best;
      store.setNearby({ id: id!, label: `View ${target.label}`, run: () => store.openPanel({ district, id: target.id }) });
    }
  });

  useEffect(
    () => () => {
      if (current.current) useCityStore.getState().clearNearby(current.current);
    },
    [],
  );

  return null;
}
