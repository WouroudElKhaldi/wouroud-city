import * as THREE from "three";

/**
 * Extra clothing layered onto a Quaternius character and attached to its bones,
 * so it follows every animation:
 *  - sleeves down to the wrists, sized from the character's own arms,
 *  - an ankle-length A-line skirt with soft folds.
 * Returns a function that removes everything it added.
 */
export function addModestLayers(model: THREE.Object3D, options: { sleeves?: string; skirt?: string }) {
  const added: THREE.Object3D[] = [];
  model.updateMatrixWorld(true);
  const toModel = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const at = (name: string) => {
    const bone = model.getObjectByName(name);
    return bone ? new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld).applyMatrix4(toModel) : null;
  };
  const attach = (mesh: THREE.Mesh, boneName: string) => {
    const bone = model.getObjectByName(boneName);
    if (!bone) return;
    mesh.castShadow = true;
    model.add(mesh);
    model.updateMatrixWorld(true);
    bone.attach(mesh);
    added.push(mesh);
  };
  const fabric = (color: string) =>
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.8,
      sheen: 0.8,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.45),
      side: THREE.DoubleSide,
    });

  if (options.sleeves) {
    const material = fabric(options.sleeves);
    const segments: [string, string][] = [
      ["UpperArmL", "LowerArmL"],
      ["LowerArmL", "PalmL"],
      ["UpperArmR", "LowerArmR"],
      ["LowerArmR", "PalmR"],
    ];
    for (const [from, to] of segments) {
      const a = at(from);
      const b = at(to);
      if (!a || !b) continue;
      const length = a.distanceTo(b);
      const radius = armRadius(model, from, a, b, toModel) ?? length * 0.2;
      const isForearm = from.startsWith("Lower");
      // Overlap at the elbow and reach just past the wrist.
      const extra = length * (isForearm ? 0.12 : 0.08);
      const geometry = new THREE.CylinderGeometry(radius * (isForearm ? 1.12 : 1.1), radius * 1.14, length + extra, 18, 1, true);
      const sleeve = new THREE.Mesh(geometry, material);
      const dir = b.clone().sub(a).normalize();
      sleeve.position.copy(a).addScaledVector(dir, (length + extra) / 2 - (isForearm ? extra * 0.3 : extra * 0.5));
      sleeve.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      attach(sleeve, from);
      if (isForearm) {
        // A soft cuff at the wrist.
        const cuff = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.14, radius * 0.18, 8, 20), material);
        cuff.position.copy(a).addScaledVector(dir, length + extra * 0.7);
        cuff.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
        attach(cuff, from);
      }
    }
  }

  if (options.skirt) {
    const hips = at("Hips");
    const legL = at("UpperLegL");
    const legR = at("UpperLegR");
    const foot = at("FootL");
    if (hips && legL && legR && foot) {
      const hipWidth = legL.distanceTo(legR);
      const top = hips.y + (hips.y - foot.y) * 0.08;
      const bottom = foot.y + (hips.y - foot.y) * 0.04;
      const height = top - bottom;
      const rTop = hipWidth * 0.98;
      const rBottom = hipWidth * 1.8;
      const profile = [
        new THREE.Vector2(rTop * 0.9, top),
        new THREE.Vector2(rTop, top - height * 0.08),
        new THREE.Vector2(rTop * 1.12, top - height * 0.35),
        new THREE.Vector2(rBottom * 0.9, top - height * 0.8),
        new THREE.Vector2(rBottom, bottom),
      ];
      const geometry = new THREE.LatheGeometry(profile, 64);
      addFolds(geometry, top, height, 10, 0.06);
      const skirt = new THREE.Mesh(geometry, fabric(options.skirt));
      skirt.position.set(hips.x, 0, hips.z);
      skirt.scale.set(1, 1, 0.84);
      attach(skirt, "Hips");
    }
  }

  return () => added.forEach((o) => o.removeFromParent());
}

/** Largest distance from the arm bone's axis among the vertices it moves, so a sleeve covers the arm. */
function armRadius(model: THREE.Object3D, boneName: string, a: THREE.Vector3, b: THREE.Vector3, toModel: THREE.Matrix4) {
  const bone = model.getObjectByName(boneName);
  let best = 0;
  const v = new THREE.Vector3();
  const axis = b.clone().sub(a);
  const lengthSq = axis.lengthSq();
  model.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh || !bone) return;
    const index = mesh.skeleton.bones.indexOf(bone as THREE.Bone);
    if (index < 0) return;
    const position = mesh.geometry.attributes.position;
    const skinIndex = mesh.geometry.attributes.skinIndex;
    const skinWeight = mesh.geometry.attributes.skinWeight;
    for (let i = 0; i < position.count; i++) {
      let w = 0;
      for (let k = 0; k < 4; k++) if (skinIndex.getComponent(i, k) === index) w += skinWeight.getComponent(i, k);
      if (w < 0.5) continue;
      v.fromBufferAttribute(position, i);
      mesh.applyBoneTransform(i, v);
      v.applyMatrix4(mesh.matrixWorld).applyMatrix4(toModel);
      const t = THREE.MathUtils.clamp(v.clone().sub(a).dot(axis) / lengthSq, 0, 1);
      const d = v.distanceTo(a.clone().addScaledVector(axis, t));
      if (d > best) best = d;
    }
  });
  return best > 0 ? best : null;
}

/** Ripple the radius around the lathe to suggest fabric folds, stronger toward the hem. */
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
