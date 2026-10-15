"use client";

import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { CylinderCollider, RigidBody } from "@react-three/rapier";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { playerState } from "@/world/env";
import {
  FOLIAGE,
  type FoliageItem,
  type FoliageKey,
  LEAF_PALETTES,
  type LeafPalette,
} from "@/world/foliage";
import { sfx } from "@/world/sfx";
import { emitBurst } from "./Particles";
import { advanceWind, plantParts } from "./plants";

/**
 * Every plant in a scene, grouped by model so each model costs one draw call per material.
 * Plants react to the visitor:
 *  - trees shake and drop petals when clicked or bumped into
 *  - flowers, grass and bushes bend away as you walk through them
 *  - clicking a flower or mushroom makes it bloom with a sparkle
 */
export function Foliage({ items }: { items: FoliageItem[] }) {
  const groups = useMemo(() => {
    const map = new Map<FoliageKey, FoliageItem[]>();
    for (const item of items) {
      const list = map.get(item.key) ?? [];
      list.push(item);
      map.set(item.key, list);
    }
    return [...map.entries()];
  }, [items]);

  const colliders = useMemo(
    () => items.filter((i) => FOLIAGE[i.key].collider),
    [items],
  );

  return (
    <group>
      <FoliageWind />
      <RigidBody type="fixed" colliders={false}>
        {colliders.map((i, n) => (
          <CylinderCollider
            key={n}
            args={[1.5, FOLIAGE[i.key].collider! * i.size]}
            position={[i.x, 1.5, i.z]}
          />
        ))}
      </RigidBody>
      {groups.map(([key, list]) => (
        <FoliageGroup key={key} modelKey={key} items={list} />
      ))}
    </group>
  );
}

/** The plant's generated parts (trunk, leaves...), one instanced mesh each. */
function useParts(key: FoliageKey) {
  return useMemo(() => plantParts(key), [key]);
}

type Motion = { shakeStart: number; shakeAxis: THREE.Vector3; bloomStart: number; bend: THREE.Vector2 };

function FoliageGroup({ modelKey, items }: { modelKey: FoliageKey; items: FoliageItem[] }) {
  const model = FOLIAGE[modelKey];
  const parts = useParts(modelKey);
  const meshes = useRef<(THREE.InstancedMesh | null)[]>([]);
  const isTree = model.kind === "tree";
  const bends = model.kind === "flower" || model.kind === "grass" || model.kind === "bush";
  const blooms = model.kind === "flower" || model.kind === "mushroom";

  const base = useMemo(
    () =>
      items.map((i) => {
        const m = new THREE.Matrix4().compose(
          new THREE.Vector3(i.x, i.y ?? 0, i.z),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, i.rot, 0)),
          new THREE.Vector3().setScalar(model.scale * i.size),
        );
        return m;
      }),
    [items, model.scale],
  );

  const colors = useMemo(
    () =>
      items.map((i, n) => {
        const palette = LEAF_PALETTES[(i.palette ?? "lilac") as LeafPalette];
        return new THREE.Color(palette[(n * 7 + Math.round(i.x * 3)) % palette.length]);
      }),
    [items],
  );

  // Per-instance animation state, mutated every frame.
  const motion = useMemo<Motion[]>(
    () =>
      items.map(() => ({
        shakeStart: -10,
        shakeAxis: new THREE.Vector3(1, 0, 0),
        bloomStart: -10,
        bend: new THREE.Vector2(),
      })),
    [items],
  );

  // Instances that are currently animating and need their matrix rewritten.
  const active = useRef(new Set<number>());
  const clock = useRef(0);

  useLayoutEffect(() => {
    meshes.current.forEach((mesh, p) => {
      if (!mesh) return;
      base.forEach((m, n) => {
        mesh.setMatrixAt(n, m);
        if (parts[p].isLeaf) mesh.setColorAt(n, colors[n]);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    });
  }, [base, colors, parts]);

  const shake = (n: number, fromX: number, fromZ: number) => {
    const m = motion[n];
    if (clock.current - m.shakeStart < 0.9) return;
    const item = items[n];
    m.shakeStart = clock.current;
    // Lean away from where the hit came from.
    m.shakeAxis.set(item.z - fromZ, 0, -(item.x - fromX)).normalize();
    active.current.add(n);
    const top = new THREE.Vector3(item.x, model.scale * item.size * 1.15, item.z);
    const palette = LEAF_PALETTES[(item.palette ?? "lilac") as LeafPalette];
    emitBurst({ position: top, kind: item.palette === "autumn" ? "leaf" : "petal", count: 26, colors: [...palette], spread: 3 });
    sfx.rustle();
  };

  const bloom = (n: number) => {
    const m = motion[n];
    m.bloomStart = clock.current;
    active.current.add(n);
    const item = items[n];
    emitBurst({
      position: new THREE.Vector3(item.x, 0.8, item.z),
      kind: "sparkle",
      count: 18,
      colors: ["#f0abfc", "#fde68a", "#ffffff", "#c4b5fd"],
      spread: 0.6,
    });
    sfx.sparkle();
  };

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6 || e.instanceId === undefined) return;
    e.stopPropagation();
    if (isTree) shake(e.instanceId, e.ray.origin.x, e.ray.origin.z);
    else if (blooms) bloom(e.instanceId);
  };

  const tmp = useMemo(
    () => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Matrix4(), axis: new THREE.Vector3() }),
    [],
  );

  useFrame((_, delta) => {
    clock.current += delta;
    const t = clock.current;
    const px = playerState.position.x;
    const pz = playerState.position.z;
    const moving = playerState.speed > 1.2;

    // Trees: bumping into one shakes it.
    if (isTree && moving) {
      items.forEach((item, n) => {
        const dx = item.x - px;
        const dz = item.z - pz;
        const reach = (model.collider ?? 0.4) * item.size + 0.9;
        if (dx * dx + dz * dz < reach * reach) shake(n, px, pz);
      });
    }

    // Small plants: bend away from the player when close.
    if (bends) {
      items.forEach((item, n) => {
        const dx = item.x - px;
        const dz = item.z - pz;
        const d2 = dx * dx + dz * dz;
        const m = motion[n];
        if (d2 < 2.4 * 2.4) {
          const d = Math.sqrt(d2) || 1;
          const strength = (1 - d / 2.4) * 0.6;
          m.bend.set((dx / d) * strength, (dz / d) * strength);
          active.current.add(n);
        } else if (m.bend.lengthSq() > 0.0001) {
          m.bend.multiplyScalar(Math.max(0, 1 - delta * 4));
          active.current.add(n);
        }
      });
    }

    if (!active.current.size) return;
    for (const n of [...active.current]) {
      const m = motion[n];
      const item = items[n];
      tmp.m.copy(base[n]);
      let done = true;

      const shakeAge = t - m.shakeStart;
      if (shakeAge < 1.2) {
        const angle = Math.sin(shakeAge * 22) * 0.07 * (1 - shakeAge / 1.2);
        tmp.q.setFromAxisAngle(m.shakeAxis, angle);
        tmp.s.makeRotationFromQuaternion(tmp.q);
        tmp.m.premultiply(new THREE.Matrix4().makeTranslation(-item.x, 0, -item.z)).premultiply(tmp.s).premultiply(new THREE.Matrix4().makeTranslation(item.x, 0, item.z));
        done = false;
      }

      if (m.bend.lengthSq() > 0.0001) {
        // Tilt around the plant's base, away from the player.
        tmp.axis.set(m.bend.y, 0, -m.bend.x);
        const amount = tmp.axis.length();
        tmp.q.setFromAxisAngle(tmp.axis.normalize(), amount);
        tmp.s.makeRotationFromQuaternion(tmp.q);
        tmp.m.premultiply(new THREE.Matrix4().makeTranslation(-item.x, 0, -item.z)).premultiply(tmp.s).premultiply(new THREE.Matrix4().makeTranslation(item.x, 0, item.z));
        done = false;
      }

      const bloomAge = t - m.bloomStart;
      if (bloomAge < 1) {
        const pulse = 1 + Math.sin(Math.min(1, bloomAge / 0.35) * Math.PI) * 0.6 * (1 - bloomAge);
        tmp.m.multiply(new THREE.Matrix4().makeScale(pulse, pulse, pulse));
        done = false;
      }

      meshes.current.forEach((mesh) => mesh?.setMatrixAt(n, tmp.m));
      if (done) active.current.delete(n);
    }
    meshes.current.forEach((mesh) => {
      if (mesh) mesh.instanceMatrix.needsUpdate = true;
    });
  });

  const interactive = isTree || blooms;

  return (
    <group>
      {parts.map((part, p) => (
        <instancedMesh
          key={p}
          ref={(el) => {
            meshes.current[p] = el;
          }}
          args={[part.geometry, part.material, items.length]}
          castShadow={model.kind === "tree" || model.kind === "bush"}
          receiveShadow
          onClick={interactive ? onClick : undefined}
          onPointerOver={interactive ? () => (document.body.style.cursor = "pointer") : undefined}
          onPointerOut={interactive ? () => (document.body.style.cursor = "") : undefined}
        />
      ))}
    </group>
  );
}

/** Moves the leaves in the wind; mount once per scene. */
export function FoliageWind() {
  useFrame((_, delta) => advanceWind(delta));
  return null;
}
