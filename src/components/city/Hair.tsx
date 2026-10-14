"use client";

import { useGLTF } from "@react-three/drei";
import { useLayoutEffect } from "react";
import * as THREE from "three";
import { measureHeadSkin } from "./hijab";

/**
 * Better hair from Quaternius' Universal Base Characters (CC0), fitted onto the
 * city's characters. The styles were modeled around that kit's base heads, so we
 * map them from that head (center and crown) onto each character's own head,
 * measured from its skin, then attach them to the head bone. The model's own
 * low-poly hair is hidden while new hair is on.
 */

export type HairStyle = "long" | "buns" | "buzzed" | "parted";

type SourceHead = { top: number; cx: number; cz: number; width: number };
/** Measured from the kit's base bodies (meters). */
const FEMALE_HEAD: SourceHead = { top: 1.767, cx: 0, cz: -0.0005, width: 0.178 };
const MALE_HEAD: SourceHead = { top: 1.81, cx: 0, cz: 0.003, width: 0.182 };

const STYLES: Record<HairStyle, { file: string; head: SourceHead }> = {
  long: { file: "Hair_Long", head: FEMALE_HEAD },
  buns: { file: "Hair_Buns", head: FEMALE_HEAD },
  buzzed: { file: "Hair_Buzzed", head: MALE_HEAD },
  parted: { file: "Hair_SimpleParted", head: MALE_HEAD },
};

const url = (file: string) => `/models/hair/${file}.glb`;

export function Hair({ model, style, color, beard = false }: { model: THREE.Object3D; style: HairStyle; color: string; beard?: boolean }) {
  const { scene } = useGLTF(url(STYLES[style].file));
  const beardScene = useGLTF(url("Hair_Beard")).scene;

  useLayoutEffect(() => {
    const headBone = model.getObjectByName("Head");
    if (!headBone) return;
    const bounds = measureHeadSkin(model, headBone);
    if (!bounds) return;
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());

    const oldHair: THREE.Object3D[] = [];
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && /^Hair/.test((mesh.material as THREE.Material).name) && mesh.visible) {
        mesh.visible = false;
        oldHair.push(mesh);
      }
    });

    const added: THREE.Mesh[] = [];
    const fit = (source: THREE.Object3D, head: SourceHead) => {
      const s = (size.x / head.width) * 0.97;
      source.updateMatrixWorld(true);
      source.traverse((o) => {
        const src = o as THREE.Mesh;
        if (!src.isMesh) return;
        const geometry = src.geometry.clone().applyMatrix4(src.matrixWorld);
        // Kit head (crown, center) → this character's head, uniformly scaled.
        geometry.translate(-head.cx, -head.top, -head.cz);
        geometry.scale(s, s, s);
        geometry.translate(center.x, bounds.max.y - size.y * 0.01, center.z);
        const material = (src.material as THREE.MeshStandardMaterial).clone();
        material.color = new THREE.Color(color);
        material.side = THREE.DoubleSide;
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        model.add(mesh);
        added.push(mesh);
      });
    };
    fit(scene, STYLES[style].head);
    if (beard) fit(beardScene, MALE_HEAD);
    model.updateMatrixWorld(true);
    for (const m of added) headBone.attach(m);

    return () => {
      added.forEach((m) => m.removeFromParent());
      oldHair.forEach((m) => (m.visible = true));
    };
  }, [model, scene, beardScene, style, color, beard]);

  return null;
}

export function preloadHair() {
  for (const s of Object.values(STYLES)) useGLTF.preload(url(s.file));
  useGLTF.preload(url("Hair_Beard"));
  for (const b of Object.values(BROWS)) useGLTF.preload(url(b.file));
}

/** The kit's eyes and brows (meters), to place brows relative to each character's own eyes. */
const BROWS = {
  // Women: slimmer, a touch smaller and higher, inner ends lifted into a soft arch.
  female: { file: "Eyebrows_Female", eyes: { cx: 0, cy: 1.6565, front: 0.075, span: 0.102 }, size: 0.66, thin: 0.55, lift: 0.15, arch: 0.22 },
  male: { file: "Eyebrows_Regular", eyes: { cx: 0, cy: 1.699, front: 0.081, span: 0.098 }, size: 0.72, thin: 1, lift: 0.11, arch: 0.08 },
};

/**
 * Soft textured eyebrows from the kit, placed from the character's eyes: the
 * kit's eye line maps onto this character's eye line, and the brows come along.
 */
export function Brows({ model, kind, color }: { model: THREE.Object3D; kind: "female" | "male"; color: string }) {
  const { scene } = useGLTF(url(BROWS[kind].file));
  useLayoutEffect(() => {
    const headBone = model.getObjectByName("Head");
    let eyes: THREE.Object3D | null = null;
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && /^Eye/.test((mesh.material as THREE.Material).name) && !eyes) eyes = mesh;
    });
    if (!headBone || !eyes) return;
    model.updateMatrixWorld(true);
    const toModel = new THREE.Matrix4().copy(model.matrixWorld).invert();
    const box = new THREE.Box3().setFromObject(eyes, true).applyMatrix4(toModel);
    const eyeCenter = box.getCenter(new THREE.Vector3());
    const span = box.max.x - box.min.x;
    const look = BROWS[kind];
    const src = look.eyes;
    // The model's eye mesh is wider than its visible eyes, so the brows get scaled down to match.
    const k = (span / src.span) * look.size;
    const oldBrows: THREE.Object3D[] = [];
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && /brow/i.test((mesh.material as THREE.Material).name) && mesh.visible) {
        mesh.visible = false;
        oldBrows.push(mesh);
      }
    });
    const added: THREE.Mesh[] = [];
    scene.updateMatrixWorld(true);
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
      g.translate(-src.cx, -src.cy, -src.front);
      // Around each brow's own middle line: slimmer, and the inner ends raised (friendly, not frowning).
      g.computeBoundingBox();
      const mid = (g.boundingBox!.min.y + g.boundingBox!.max.y) / 2;
      const half = g.boundingBox!.max.x;
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = mid + (pos.getY(i) - mid) * look.thin + (half - Math.abs(x)) * look.arch * 0.25;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
      g.scale(k, k, k);
      // Lift a little: shrinking around the eye line pulls the brows down onto the eyes.
      g.translate(eyeCenter.x, eyeCenter.y + span * look.lift, box.max.z);
      const material = (m.material as THREE.MeshStandardMaterial).clone();
      material.color = new THREE.Color(color);
      material.transparent = true;
      material.alphaTest = 0.3;
      material.side = THREE.DoubleSide;
      const mesh = new THREE.Mesh(g, material);
      model.add(mesh);
      added.push(mesh);
    });
    model.updateMatrixWorld(true);
    for (const m of added) headBone.attach(m);
    return () => {
      added.forEach((m) => m.removeFromParent());
      oldBrows.forEach((m) => (m.visible = true));
    };
  }, [model, scene, kind, color]);
  return null;
}
