"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type * as THREE from "three";
import { useCityStore } from "@/state/useCityStore";
import { playerState } from "@/world/env";

/**
 * Offers a "Press E" action while the player is within `radius` of a point.
 * `where` can be a fixed point or a function for things that move (people, birds).
 */
export function useProximity({
  id,
  label,
  run,
  where,
  radius = 2.5,
  enabled = true,
}: {
  id: string;
  label: string;
  run: () => void;
  where: THREE.Vector3 | (() => THREE.Vector3);
  radius?: number;
  enabled?: boolean;
}) {
  const inside = useRef(false);
  const latest = useRef({ label, run });
  useEffect(() => {
    latest.current = { label, run };
  }, [label, run]);

  useFrame(() => {
    const store = useCityStore.getState();
    const point = typeof where === "function" ? where() : where;
    const dx = point.x - playerState.position.x;
    const dz = point.z - playerState.position.z;
    const near = enabled && !store.seat && !store.fading && dx * dx + dz * dz < radius * radius;
    if (near && (!inside.current || !store.nearby)) {
      store.setNearby({ id, label: latest.current.label, run: () => latest.current.run() });
    } else if (!near && inside.current) {
      store.clearNearby(id);
    }
    inside.current = near;
  });

  useEffect(() => () => useCityStore.getState().clearNearby(id), [id]);
}
