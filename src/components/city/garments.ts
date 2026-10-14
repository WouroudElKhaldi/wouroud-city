import * as THREE from "three";
import { addSkinLayer } from "./body";

/**
 * Modest layers for a Quaternius character, attached to its bones so they follow
 * every animation:
 *  - `sleeves` and `neckline`: arms (to the wrists), and neck plus upper chest, in fabric,
 *    using a copy of the character's own skin so they fit and bend naturally;
 *  - `skirt`: an ankle-length A-line skirt with soft folds (for the long dress);
 *  - `tunic`: the top made a little longer, down over the hips (blazer, casual).
 * Returns a function that removes everything it added.
 */
export type ModestLayers = { sleeves?: string; neckline?: string; skirt?: string; tunic?: string };

export function addModestLayers(model: THREE.Object3D, options: ModestLayers) {
  const removers: (() => void)[] = [];
  if (options.sleeves) removers.push(addSkinLayer(model, ["arms"], options.sleeves));
  if (options.neckline) removers.push(addSkinLayer(model, ["neck", "chest"], options.neckline));

  model.updateMatrixWorld(true);
  const toModel = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const at = (name: string) => {
    const bone = model.getObjectByName(name);
    return bone ? new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld).applyMatrix4(toModel) : null;
  };
  const hips = at("Hips");
  const legL = at("UpperLegL");
  const legR = at("UpperLegR");
  const foot = at("FootL");
  const hipsBone = model.getObjectByName("Hips");
  if (!hips || !legL || !legR || !foot || !hipsBone) return () => removers.forEach((r) => r());
  const hipWidth = legL.distanceTo(legR);
  const legLength = hips.y - foot.y;

  const lathe = (color: string, top: number, bottom: number, rTop: number, rBottom: number, folds: number) => {
    const height = top - bottom;
    const profile = [
      new THREE.Vector2(rTop * 0.97, top),
      new THREE.Vector2(rTop, top - height * 0.1),
      new THREE.Vector2(THREE.MathUtils.lerp(rTop, rBottom, 0.45) * 1.05, top - height * 0.4),
      new THREE.Vector2(rBottom * 0.94, top - height * 0.82),
      new THREE.Vector2(rBottom, bottom),
    ];
    const geometry = new THREE.LatheGeometry(profile, 64);
    addFolds(geometry, top, height, folds, 0.035);
    const material = new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.8,
      sheen: 0.8,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.45),
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(hips.x, 0, hips.z);
    mesh.scale.set(1, 1, 0.84);
    mesh.castShadow = true;
    model.add(mesh);
    model.updateMatrixWorld(true);
    hipsBone.attach(mesh);
    removers.push(() => mesh.removeFromParent());
  };

  if (options.skirt) {
    lathe(options.skirt, hips.y + legLength * 0.08, foot.y + legLength * 0.04, hipWidth * 0.94, hipWidth * 1.45, 8);
  }
  if (options.tunic) {
    // Just a little longer than the original top: from the waist to the upper thigh.
    lathe(options.tunic, hips.y + legLength * 0.32, hips.y - legLength * 0.16, hipWidth * 0.82, hipWidth * 1.08, 4);
  }

  return () => removers.forEach((r) => r());
}

/** Ripple the radius around a lathe to suggest fabric folds, stronger toward the hem. */
export function addFolds(geometry: THREE.BufferGeometry, top: number, height: number, folds: number, amount: number) {
  const pos = geometry.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const angle = Math.atan2(v.z, v.x);
    const depth = THREE.MathUtils.clamp((top - v.y) / height, 0, 1);
    const k = 1 + Math.sin(angle * folds) * amount * depth;
    pos.setXYZ(i, v.x * k, v.y, v.z * k);
  }
  geometry.computeVertexNormals();
}
