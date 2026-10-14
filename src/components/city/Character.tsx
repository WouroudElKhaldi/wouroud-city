"use client";

import { useAnimations, useGLTF } from "@react-three/drei";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { addModestLayers } from "./garments";
import { buildHijab } from "./hijab";

/** The animations our scenes ask for; each model maps them to its own clip names. */
export type CharacterAnimation =
  | "idle"
  | "walk"
  | "sprint"
  | "jump"
  | "fall"
  | "sit"
  | "drive"
  | "pick-up"
  | "emote-yes"
  | "emote-no"
  | "interact-right"
  | "interact-left";

/** Quaternius clips are named like "HumanArmature|Female_Walk"; this maps by suffix. */
const CLIP_SUFFIX: Record<CharacterAnimation, string> = {
  idle: "Idle",
  walk: "Walk",
  sprint: "Run",
  jump: "Jump",
  fall: "Jump",
  sit: "Sitting",
  drive: "Sitting",
  "pick-up": "Clapping",
  "emote-yes": "Clapping",
  "emote-no": "Idle",
  "interact-right": "Clapping",
  "interact-left": "Clapping",
};

const ONE_SHOT: CharacterAnimation[] = ["pick-up", "emote-yes", "interact-right", "interact-left", "jump"];

/** Adult characters by Quaternius (CC0), all sharing one humanoid rig. */
export type PersonFile =
  | "female-casual"
  | "female-dress"
  | "female-blazer"
  | "female-tank"
  | "male-casual"
  | "male-longsleeves"
  | "male-shirt"
  | "male-suit";

export const characterUrl = (file: string) => `/models/people/${file}.glb`;

/** Target standing height in meters. */
const HEIGHT = 1.72;

/**
 * An animated adult character. Each instance gets its own skeleton and its own
 * materials, so outfits can be recolored per person (`colors` maps a material
 * name such as "Dress" or "Jacket" to a color). Feet are at y = 0, facing +z.
 */
export function Character({
  file,
  animation,
  hijab = false,
  hijabColor = "#c49cad",
  colors,
  modest,
}: {
  file: PersonFile;
  animation: CharacterAnimation;
  hijab?: boolean;
  hijabColor?: string;
  colors?: Record<string, string>;
  /** Extra coverage: sleeves to the wrists and/or an ankle-length skirt, in these colors. */
  modest?: { sleeves?: string; skirt?: string };
}) {
  const { scene, animations } = useGLTF(characterUrl(file));
  const root = useRef<THREE.Group>(null);

  const { model, scale } = useMemo(() => {
    smoothOnce(scene);
    const m = cloneSkinned(scene);
    m.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      mesh.material = upgradeMaterial(mesh.material as THREE.MeshStandardMaterial);
    });
    m.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(m, true);
    return { model: m, scale: HEIGHT / Math.max(0.01, box.max.y - box.min.y) };
  }, [scene]);

  // Outfit colors.
  useLayoutEffect(() => {
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const material = mesh.material as THREE.MeshStandardMaterial;
      const color = colors?.[material.name];
      if (color) material.color.set(color);
    });
  }, [model, colors]);

  // Hijab: hide the hair and wrap the head.
  useLayoutEffect(() => {
    if (!hijab) return;
    const hairMeshes: THREE.Object3D[] = [];
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && /^Hair/.test((mesh.material as THREE.Material).name)) {
        mesh.visible = false;
        hairMeshes.push(mesh);
      }
    });
    const hijabGroup = buildHijab(model, hijabColor);
    return () => {
      hairMeshes.forEach((m) => (m.visible = true));
      hijabGroup?.removeFromParent();
    };
  }, [model, hijab, hijabColor]);

  // Modest layers: sleeves to the wrists and an ankle-length skirt.
  const sleeves = modest?.sleeves;
  const skirt = modest?.skirt;
  useLayoutEffect(() => {
    if (!sleeves && !skirt) return;
    return addModestLayers(model, { sleeves, skirt });
  }, [model, sleeves, skirt]);

  const { actions, names } = useAnimations(animations, root);

  useEffect(() => {
    const suffix = CLIP_SUFFIX[animation];
    const clip = names.find((n) => n.endsWith(`_${suffix}`)) ?? names.find((n) => n.endsWith(suffix));
    const action = clip ? actions[clip] : undefined;
    if (!action) return;
    const once = ONE_SHOT.includes(animation);
    action.reset();
    action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    action.clampWhenFinished = once;
    action.fadeIn(0.2).play();
    return () => {
      action.fadeOut(0.2);
    };
  }, [actions, names, animation]);

  return (
    <group ref={root} scale={scale}>
      <primitive object={model} />
    </group>
  );
}

const smoothed = new WeakSet<THREE.Object3D>();

/**
 * The source models are flat-shaded (every face shows). Welding shared vertices and
 * recomputing normals gives soft, rounded shading, which reads as far more natural
 * on faces and skin. Done once per loaded file; every clone shares the result.
 */
function smoothOnce(scene: THREE.Object3D) {
  if (smoothed.has(scene)) return;
  smoothed.add(scene);
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry.clone();
    geometry.deleteAttribute("normal");
    const welded = mergeVertices(geometry, 1e-4);
    welded.computeVertexNormals();
    mesh.geometry = welded;
  });
}

/** Skin gets a soft, warm physical material; clothes a fabric-like finish. */
function upgradeMaterial(source: THREE.MeshStandardMaterial) {
  if (/^Skin/.test(source.name)) {
    return new THREE.MeshPhysicalMaterial({
      name: source.name,
      color: source.color,
      roughness: 0.55,
      sheen: 0.6,
      sheenRoughness: 0.6,
      sheenColor: new THREE.Color("#ffd2bf"),
      emissive: new THREE.Color("#5a2414"),
      emissiveIntensity: 0.06,
    });
  }
  const m = source.clone();
  m.roughness = /^Eye/.test(source.name) ? 0.3 : 0.78;
  return m;
}

export function preloadCharacters(files: string[]) {
  for (const f of files) useGLTF.preload(characterUrl(f));
}
