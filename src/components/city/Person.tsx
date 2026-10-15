"use client";

import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { playerState } from "@/world/env";

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

/** Everything a body can be doing; each maps to a Rocketbox clip in CLIPS. */
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

type AirBone = { bone: THREE.Object3D; angle: number };
/** Bends for the air pose, radians around the body's side axis (negative swings forward). */
const AIR_POSE: [string, number][] = [
  ["Bip01 L Thigh", -1.0],
  ["Bip01 L Calf", 1.4],
  ["Bip01 R Thigh", -0.3],
  ["Bip01 R Calf", 0.6],
  ["Bip01 L UpperArm", -0.7],
  ["Bip01 R UpperArm", -0.5],
  ["Bip01 L Forearm", -0.5],
  ["Bip01 R Forearm", -0.5],
];
const findBone = (root: THREE.Object3D, name: string) => root.getObjectByName(name.replace(/ /g, "_")) ?? root.getObjectByName(name) ?? null;
const modelQuat = new THREE.Quaternion();
const parentQuat = new THREE.Quaternion();
const localAxis = new THREE.Vector3();
const bend = new THREE.Quaternion();
const inverse = new THREE.Matrix4();
const ankle = new THREE.Vector3();
const ball = new THREE.Vector3();
const flat = new THREE.Vector3();
const turn = new THREE.Quaternion();
const parentTurn = new THREE.Quaternion();
/** Height of the ball of the foot above the floor when it rests flat (inside the shoe). */
const BALL_HEIGHT = 0.03;

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
  floor,
}: {
  look: PersonLook;
  animation: CharacterAnimation;
  matchPlayerSpeed?: boolean;
  /** Normal maps; off for distant crowd members */
  detail?: boolean;
  /** Seated on a chair: the world height of the floor under it, where the feet rest. */
  floor?: number;
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
      floor={floor}
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
  floor,
}: {
  model: THREE.Object3D;
  clips: THREE.AnimationClip[];
  stride: Partial<Record<Source, number>>;
  animation: CharacterAnimation;
  matchPlayerSpeed: boolean;
  floor?: number;
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

  // Seated, the women's chair clip points the feet down through the floor (toes ~7 cm under it).
  // After the clip poses the body, tip each foot up at the ankle until the ball of the foot
  // rests on the floor under the seat (`floor`; none on a horse, whose stirrups hold the feet).
  const feet = useMemo(
    () =>
      (["L", "R"] as const)
        .map((side) => [model.getObjectByName(`Bip01_${side}_Foot`), model.getObjectByName(`Bip01_${side}_Toe0`)])
        .filter((pair): pair is [THREE.Object3D, THREE.Object3D] => !!pair[0] && !!pair[1]),
    [model],
  );
  useFrame(() => {
    if (animation !== "sit" || floor === undefined) return;
    for (const [foot, toe] of feet) {
      foot.getWorldPosition(ankle);
      toe.getWorldPosition(ball);
      if (ball.y >= floor + BALL_HEIGHT) continue;
      const length = ball.distanceTo(ankle);
      flat.subVectors(ball, ankle).normalize();
      const drop = THREE.MathUtils.clamp((floor + BALL_HEIGHT - ankle.y) / length, -1, 0);
      const across = Math.hypot(flat.x, flat.z) || 1;
      const reach = Math.sqrt(1 - drop * drop);
      const target = probe.set((flat.x / across) * reach, drop, (flat.z / across) * reach);
      // World turn → the foot's local space: L' = P⁻¹ · R · P · L
      turn.setFromUnitVectors(flat, target);
      foot.parent!.getWorldQuaternion(parentTurn);
      turn.premultiply(parentTurn.clone().invert()).multiply(parentTurn);
      foot.quaternion.premultiply(turn);
    }
  });

  // Jumping and falling: Rocketbox has no clip for them, so bend the idle pose procedurally. One knee
  // tucks up, the other leg trails, the arms lift. Each bend turns a bone around the body's own
  // side axis (whatever the bone's local axes are), blended in and out over a few frames.
  const air = useRef({ weight: 0, bones: null as AirBone[] | null });
  useFrame((_, delta) => {
    const a = air.current;
    const target = animation === "jump" || animation === "fall" ? 1 : 0;
    a.weight = THREE.MathUtils.damp(a.weight, target, 10, delta);
    if (a.weight < 0.01) return;
    a.bones ??= AIR_POSE.map(([name, angle]) => ({ bone: findBone(model, name), angle })).filter((b): b is AirBone => !!b.bone);
    model.updateMatrixWorld(true);
    model.getWorldQuaternion(modelQuat);
    for (const { bone, angle } of a.bones) {
      if (!bone.parent) continue;
      bone.parent.getWorldQuaternion(parentQuat);
      // The body's side axis, seen from the bone's parent.
      localAxis.set(1, 0, 0).applyQuaternion(modelQuat).applyQuaternion(parentQuat.invert());
      bend.setFromAxisAngle(localAxis.normalize(), angle * a.weight);
      bone.quaternion.premultiply(bend);
    }
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

const BRONZE = new THREE.MeshStandardMaterial({ color: "#8c6a3c", metalness: 0.85, roughness: 0.38 });

/**
 * A bronze statue: a Rocketbox body frozen in a frame of one of the clips (a wave by default),
 * all in one bronze material. Hair cards and lashes are hidden (they need their alpha texture).
 */
export function Statue({ look, pose = "wave", at = 0.45 }: { look: PersonLook; pose?: Source; at?: number }) {
  const { scene } = useGLTF(MODEL_URL(look.id));
  const anims = useGLTF(animUrls(look.body));
  const { clips } = useMemo(() => prepareClips(anims), [anims]);
  const model = useMemo(() => {
    const m = cloneSkinned(scene);
    m.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isMesh) return;
      const names = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((x) => x.name);
      if (names.every((n) => n.endsWith("opacity"))) mesh.visible = false;
      mesh.material = BRONZE;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
    });
    return m;
  }, [scene]);
  useEffect(() => {
    const clip = clips.find((c) => c.name === pose) ?? clips[0];
    const mixer = new THREE.AnimationMixer(model);
    mixer.clipAction(clip).play();
    mixer.setTime(clip.duration * at);
    return () => {
      mixer.stopAllAction();
    };
  }, [model, clips, pose, at]);
  return <primitive object={model} />;
}

export function preloadPeople(ids: string[]) {
  for (const id of ids) useGLTF.preload(MODEL_URL(id));
  useGLTF.preload(animUrls("female"));
  useGLTF.preload(animUrls("male"));
}
