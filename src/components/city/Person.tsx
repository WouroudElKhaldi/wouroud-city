"use client";

import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { playerState } from "@/world/env";
import type { CharacterAnimation } from "./Character";

/**
 * People from Microsoft Rocketbox (MIT): realistic adults wearing real modeled
 * clothes, with motion-captured animations shared by every body of the same
 * sex. Converted by .assets-src/rocketbox/tools/build.mjs into a slim skinned
 * GLB plus WebP textures per avatar under /models/rb.
 */

export type PersonLook = {
  /** Rocketbox avatar folder, e.g. "Female_Adult_05" */
  id: string;
  body: "female" | "male";
};

const MODEL_URL = (id: string) => `/models/rb/${id}/model.glb`;
const ANIM_URL = (name: string) => `/models/rb/anim/${name}.glb`;

/** Rocketbox clips per animation; the prefix (f_ / m_) is added per body. */
const SOURCES = {
  idle: "idle_neutral_01",
  walk: "walk_neutral",
  run: "run_neutral",
  sit: "sit_chair_idle_neutral_01",
  wave: "wave_01",
} as const;
type Source = keyof typeof SOURCES;
const animUrls = (body: PersonLook["body"]) =>
  (Object.values(SOURCES) as string[]).map((s) => ANIM_URL(`${body === "female" ? "f" : "m"}_${s}`));

/** Our animation names → the clip that plays them. */
const CLIPS: Record<CharacterAnimation, Source> = {
  idle: "idle",
  walk: "walk",
  sprint: "run",
  jump: "idle",
  fall: "idle",
  sit: "sit",
  drive: "sit",
  "pick-up": "wave",
  "emote-yes": "wave",
  "emote-no": "idle",
  "interact-right": "wave",
  "interact-left": "wave",
};
const ONE_SHOT: CharacterAnimation[] = ["pick-up", "emote-yes", "interact-right", "interact-left"];
/** Frames over which a body measures how far its shoes reach below the floor. */
const GROUND_FRAMES = 30;
const probe = new THREE.Vector3();
const inverse = new THREE.Matrix4();

const textures = new Map<string, THREE.Texture>();
function texture(url: string, color: boolean) {
  let t = textures.get(url);
  if (!t) {
    t = new THREE.TextureLoader().load(url);
    t.flipY = false;
    t.anisotropy = 8;
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    textures.set(url, t);
  }
  return t;
}

/** Real materials for the converted meshes: body (clothes), head (face) and opacity (hair, lashes). */
function dress(model: THREE.Object3D, id: string, detail: boolean) {
  const base = `/models/rb/${id}/`;
  model.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((src) => {
      const part = src.name.split("_").pop();
      if (part === "opacity") {
        return new THREE.MeshStandardMaterial({
          name: src.name,
          map: texture(base + "opacity.webp", true),
          alphaTest: 0.4,
          side: THREE.DoubleSide,
          roughness: 0.7,
        });
      }
      const head = part === "head";
      return new THREE.MeshStandardMaterial({
        name: src.name,
        map: texture(base + (head ? "head.webp" : "body.webp"), true),
        normalMap: detail ? texture(base + (head ? "head_n.webp" : "body_n.webp"), false) : null,
        roughness: head ? 0.6 : 0.85,
      });
    });
    mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
  });
}

/** Clips named by our sources, with the walk/run root motion removed so they play in place. */
function prepareClips(gltfs: { animations: THREE.AnimationClip[] }[]) {
  const names = Object.keys(SOURCES) as Source[];
  const stride: Partial<Record<Source, number>> = {};
  const clips = gltfs.map((g, i) => {
    const clip = g.animations[0].clone();
    clip.name = names[i];
    const root = clip.tracks.find((t) => t.name === "Bip01.position");
    if (root) {
      const v = root.values;
      const n = v.length / 3;
      const travel = Math.hypot(v[(n - 1) * 3] - v[0], v[(n - 1) * 3 + 2] - v[2]);
      if (travel > 0.2) stride[names[i]] = travel / clip.duration;
      for (let k = 0; k < n; k++) {
        v[k * 3] = v[0];
        v[k * 3 + 2] = v[2];
      }
    }
    return clip;
  });
  return { clips, stride };
}

export function Person({
  look,
  animation,
  matchPlayerSpeed = false,
  detail = true,
}: {
  look: PersonLook;
  animation: CharacterAnimation;
  matchPlayerSpeed?: boolean;
  /** Normal maps; off for distant crowd members */
  detail?: boolean;
}) {
  const { scene } = useGLTF(MODEL_URL(look.id));
  const anims = useGLTF(animUrls(look.body));
  const { clips, stride } = useMemo(() => prepareClips(anims), [anims]);

  const model = useMemo(() => {
    const m = cloneSkinned(scene);
    dress(m, look.id, detail);
    return m;
  }, [scene, look.id, detail]);

  // Keyed by the model: a rebuilt body gets a fresh animation mixer bound to its own bones.
  return (
    <Rig
      key={model.uuid}
      model={model}
      clips={clips}
      stride={stride}
      animation={animation}
      matchPlayerSpeed={matchPlayerSpeed}
    />
  );
}

/** Plays the shared animation clips on one body. */
function Rig({
  model,
  clips,
  stride,
  animation,
  matchPlayerSpeed,
}: {
  model: THREE.Object3D;
  clips: THREE.AnimationClip[];
  stride: Partial<Record<Source, number>>;
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
    action.fadeIn(0.25).play();
    return () => {
      action.fadeOut(0.25);
    };
  }, [actions, animation]);

  // Stand on the floor: shoes (heels, boots, flats) reach different depths below the rig's
  // origin, so measure the lowest skinned vertex over the first frames and lift the body by it.
  const grounding = useRef({ frames: 0, min: Infinity });
  useFrame(() => {
    const g = grounding.current;
    if (g.frames > GROUND_FRAMES) return;
    // Only standing and walking poses tell where the soles are (not sitting or jumping).
    if (animation !== "idle" && animation !== "walk" && animation !== "sprint") return;
    g.frames++;
    if (g.frames < 3) return; // let the first animation pose apply
    // Measured in the body's own space, so it doesn't matter if the player is still dropping in.
    model.updateMatrixWorld(true);
    inverse.copy(model.matrixWorld).invert();
    model.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isSkinnedMesh) return;
      const count = mesh.geometry.attributes.position.count;
      for (let i = 0; i < count; i += 5) {
        mesh.getVertexPosition(i, probe).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
        if (probe.y < g.min) g.min = probe.y;
      }
    });
    if (g.frames === GROUND_FRAMES && Number.isFinite(g.min)) model.position.y = -g.min;
  });

  // Feet keep pace with the ground instead of sliding.
  useFrame(() => {
    const clip = CLIPS[animation];
    const s = stride[clip];
    if (!matchPlayerSpeed || !s) return;
    const action = actions[clip];
    if (action) action.timeScale = THREE.MathUtils.clamp(playerState.speed / s, 0.7, 2.4);
  });

  return <primitive object={model} />;
}

export function preloadPeople(ids: string[]) {
  for (const id of ids) useGLTF.preload(MODEL_URL(id));
  useGLTF.preload(animUrls("female"));
  useGLTF.preload(animUrls("male"));
}
