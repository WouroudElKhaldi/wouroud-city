import * as THREE from "three";

/**
 * Extra clothing pieces added on top of a Quaternius character, attached to its
 * bones so they follow every animation:
 *  - long sleeves down to the wrists,
 *  - an ankle-length A-line skirt from the waist.
 * Together with the short dress model they make a long, modest dress.
 * Returns a function that removes everything it added.
 */
export function addLongDress(model: THREE.Object3D, color: string) {
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.75, side: THREE.DoubleSide });
  const added: THREE.Object3D[] = [];
  model.updateMatrixWorld(true);
  const toModel = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const at = (name: string) => {
    const bone = model.getObjectByName(name);
    return bone ? new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld).applyMatrix4(toModel) : null;
  };

  // Sleeves: a tapered tube along each arm segment.
  const segments: [string, string, number, number][] = [
    ["UpperArmL", "LowerArmL", 0.24, 0.2],
    ["LowerArmL", "PalmL", 0.2, 0.17],
    ["UpperArmR", "LowerArmR", 0.24, 0.2],
    ["LowerArmR", "PalmR", 0.2, 0.17],
  ];
  for (const [from, to, r0, r1] of segments) {
    const bone = model.getObjectByName(from);
    const a = at(from);
    const b = at(to);
    if (!bone || !a || !b) continue;
    const length = a.distanceTo(b);
    const geometry = new THREE.CylinderGeometry(length * r1, length * r0, length * 1.04, 14, 1, true);
    const sleeve = new THREE.Mesh(geometry, material);
    sleeve.position.copy(a).lerp(b, 0.5);
    sleeve.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    sleeve.castShadow = true;
    model.add(sleeve);
    model.updateMatrixWorld(true);
    bone.attach(sleeve);
    added.push(sleeve);
  }

  // Skirt: from the waist down to just above the ankles, flaring out.
  const hipsBone = model.getObjectByName("Hips");
  const hips = at("Hips");
  const legL = at("UpperLegL");
  const legR = at("UpperLegR");
  const foot = at("FootL");
  if (hipsBone && hips && legL && legR && foot) {
    const hipWidth = legL.distanceTo(legR);
    const top = hips.y + (hips.y - foot.y) * 0.08;
    const bottom = foot.y + (hips.y - foot.y) * 0.06;
    const height = top - bottom;
    const rTop = hipWidth * 0.95;
    const rBottom = hipWidth * 1.75;
    const profile = [
      new THREE.Vector2(rTop * 0.92, top),
      new THREE.Vector2(rTop, top - height * 0.08),
      new THREE.Vector2(rTop * 1.12, top - height * 0.35),
      new THREE.Vector2(rBottom * 0.92, top - height * 0.8),
      new THREE.Vector2(rBottom, bottom),
    ];
    const skirt = new THREE.Mesh(new THREE.LatheGeometry(profile, 36), material);
    skirt.position.set(hips.x, 0, hips.z);
    skirt.scale.set(1, 1, 0.82);
    skirt.castShadow = true;
    model.add(skirt);
    model.updateMatrixWorld(true);
    hipsBone.attach(skirt);
    added.push(skirt);
  }

  return () => added.forEach((o) => o.removeFromParent());
}
