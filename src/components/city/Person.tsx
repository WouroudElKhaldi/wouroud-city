"use client";

import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { playerState } from "@/world/env";
import type { CharacterAnimation } from "./Character";
import { dressUp, type OutfitColors, type OutfitKind } from "./clothes";
import { Hair, type HairStyle } from "./Hair";
import { buildHijab } from "./hijab";

/**
 * People built on Quaternius' Universal Base Characters and Universal Animation
 * Library (both CC0): detailed adult bodies with textured faces, one shared set
 * of animations, and clothes made to fit each body (see clothes.ts). A hijab
 * always comes with a fully covering, loose outfit.
 */

export type PersonLook = {
  body: "female" | "male";
  outfit: OutfitKind;
  colors: OutfitColors;
  /** Multiplies the light skin texture: near white keeps it fair, browns make it darker */
  skin: string;
  hijab?: string;
  hair?: { style: HairStyle; color: string; beard?: boolean };
  brows?: string;
};

const BODY_URL = (b: string) => `/models/people2/${b}.glb`;
const ANIM_URL = "/models/people2/animations.glb";
const HEIGHT = { female: 1.68, male: 1.78 };

/** Our animation names → clips in the Universal Animation Library. */
const CLIPS: Record<CharacterAnimation, string> = {
  idle: "Idle_Loop",
  walk: "Walk_Loop",
  sprint: "Jog_Fwd_Loop",
  jump: "Jump_Start",
  fall: "Jump_Loop",
  sit: "Sitting_Idle_Loop",
  drive: "Driving_Loop",
  "pick-up": "PickUp_Table",
  "emote-yes": "Interact",
  "emote-no": "Idle_Talking_Loop",
  "interact-right": "Interact",
  "interact-left": "Interact",
};
const ONE_SHOT: CharacterAnimation[] = ["pick-up", "emote-yes", "interact-right", "interact-left", "jump"];
/** Speed (m/s) at which each moving clip's feet match the ground. */
const STRIDE: Partial<Record<CharacterAnimation, number>> = { walk: 1.45, sprint: 3.6 };

export function Person({
  look,
  animation,
  matchPlayerSpeed = false,
}: {
  look: PersonLook;
  animation: CharacterAnimation;
  matchPlayerSpeed?: boolean;
}) {
  const { scene } = useGLTF(BODY_URL(look.body));
  const { animations } = useGLTF(ANIM_URL);

  const { model, scale } = useMemo(() => {
    const m = cloneSkinned(scene);
    m.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      const src = mesh.material as THREE.MeshStandardMaterial;
      const material = src.clone();
      // The body material is called "Skin" so the hijab and hair can find the head.
      if (/Superhero/.test(src.name)) material.name = "Skin";
      mesh.material = material;
    });
    m.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(m, true);
    return { model: m, scale: HEIGHT[look.body] / Math.max(0.01, box.max.y - box.min.y) };
  }, [scene, look.body]);

  // Skin tone and brow color.
  useLayoutEffect(() => {
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (material.name === "Skin") material.color.set(look.skin);
      if (/^MI_Hair/.test(material.name)) material.color.set(look.brows ?? "#3a2419");
    });
  }, [model, look.skin, look.brows]);

  // Clothes. A hijab always means the fully covering loose cut.
  const { outfit, colors } = look;
  const modest = !!look.hijab && look.body === "female";
  const kind: OutfitKind = modest && (outfit === "tee-women" || outfit === "tee") ? "tunic" : outfit;
  const colorKey = JSON.stringify(colors);
  useLayoutEffect(() => dressUp(model, kind, JSON.parse(colorKey)), [model, kind, colorKey]);

  useLayoutEffect(() => {
    if (!look.hijab) return;
    const hijab = buildHijab(model, look.hijab);
    return () => hijab?.removeFromParent();
  }, [model, look.hijab]);

  return (
    <group scale={scale}>
      {/* Keyed by the model: a rebuilt body gets a fresh animation mixer bound to its own bones. */}
      <Rig key={model.uuid} model={model} clips={animations} animation={animation} matchPlayerSpeed={matchPlayerSpeed} />
      {look.hair && !look.hijab && <Hair model={model} style={look.hair.style} color={look.hair.color} beard={look.hair.beard} />}
    </group>
  );
}

/** Plays the shared animation clips on one body. */
function Rig({
  model,
  clips,
  animation,
  matchPlayerSpeed,
}: {
  model: THREE.Object3D;
  clips: THREE.AnimationClip[];
  animation: CharacterAnimation;
  matchPlayerSpeed: boolean;
}) {
  const { actions, mixer } = useAnimations(clips, model);
  useEffect(() => {
    if (process.env.NODE_ENV === "development") Object.assign(window, { __person: { actions, mixer, model } });
  }, [actions, mixer, model]);

  useEffect(() => {
    const action = actions[CLIPS[animation]];
    if (!action) return;
    const once = ONE_SHOT.includes(animation);
    if (once) action.reset();
    else action.enabled = true;
    action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    action.clampWhenFinished = once;
    action.fadeIn(0.2).play();
    return () => {
      action.fadeOut(0.2);
    };
  }, [actions, animation]);

  // Feet keep pace with the ground instead of sliding.
  useFrame(() => {
    const stride = STRIDE[animation];
    if (!matchPlayerSpeed || !stride) return;
    const action = actions[CLIPS[animation]];
    if (action) action.timeScale = THREE.MathUtils.clamp(playerState.speed / stride, 0.7, 2.4);
  });

  return <primitive object={model} />;
}

export function preloadPeople() {
  useGLTF.preload(BODY_URL("female"));
  useGLTF.preload(BODY_URL("male"));
  useGLTF.preload(ANIM_URL);
}
