import * as THREE from "three";

/**
 * Hijab for the adult (Quaternius) characters. Two soft pieces, measured from
 * the character's own head so it fits any of them:
 *  - a hood: an ellipsoid around the head with an oval opening for the face,
 *    attached to the head bone so it follows every head movement;
 *  - a drape: a flared piece that wraps the neck and falls over the shoulders,
 *    attached to the neck bone.
 * The character's hair should be hidden while it is worn.
 * Returns a handle whose removeFromParent() takes both pieces off.
 */
export function buildHijab(model: THREE.Object3D, color: string): { removeFromParent: () => void } | null {
  const headBone = model.getObjectByName("Head");
  const neckBone = model.getObjectByName("Neck") ?? headBone;
  if (!headBone || !neckBone) return null;

  const bounds = measureHeadSkin(model, headBone);
  if (!bounds) return null;
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());

  const material = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.8,
    sheen: 1,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.55),
    side: THREE.DoubleSide,
  });

  // Hood
  const hood = new THREE.Mesh(makeHoodGeometry(), material);
  hood.scale.set(size.x * 0.6, size.y * 0.58, size.z * 0.62);
  hood.position.set(center.x, center.y + size.y * 0.04, center.z - size.z * 0.05);
  hood.castShadow = true;

  // Drape
  const w = size.x;
  const top = center.y - size.y * 0.32;
  const profile = [
    new THREE.Vector2(w * 0.36, top),
    new THREE.Vector2(w * 0.4, top - size.y * 0.22),
    new THREE.Vector2(w * 0.62, top - size.y * 0.42),
    new THREE.Vector2(w * 1.05, top - size.y * 0.62),
    new THREE.Vector2(w * 1.12, top - size.y * 0.78),
  ];
  const drape = new THREE.Mesh(new THREE.LatheGeometry(profile, 40), material);
  drape.position.set(center.x, 0, center.z - size.z * 0.06);
  // Flatten it front-to-back so it follows the shoulders rather than a cone.
  drape.scale.set(1, 1, 0.78);
  drape.castShadow = true;

  // Build in model space, then hand each piece to its bone keeping its pose.
  model.add(hood, drape);
  model.updateMatrixWorld(true);
  headBone.attach(hood);
  neckBone.attach(drape);
  return {
    removeFromParent: () => {
      hood.removeFromParent();
      drape.removeFromParent();
    },
  };
}

/** Bounds (in model space) of the skin vertices that move with the head bone. */
function measureHeadSkin(model: THREE.Object3D, headBone: THREE.Object3D) {
  model.updateMatrixWorld(true);
  const toModel = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  model.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    const name = (mesh.material as THREE.Material).name;
    if (!/^Skin/.test(name)) return;
    const headIndex = mesh.skeleton.bones.indexOf(headBone as THREE.Bone);
    if (headIndex < 0) return;
    mesh.skeleton.update();
    const position = mesh.geometry.attributes.position;
    const skinIndex = mesh.geometry.attributes.skinIndex;
    const skinWeight = mesh.geometry.attributes.skinWeight;
    for (let i = 0; i < position.count; i++) {
      let weight = 0;
      for (let k = 0; k < 4; k++) if (skinIndex.getComponent(i, k) === headIndex) weight += skinWeight.getComponent(i, k);
      if (weight < 0.5) continue;
      v.fromBufferAttribute(position, i);
      mesh.applyBoneTransform(i, v);
      v.applyMatrix4(mesh.matrixWorld).applyMatrix4(toModel);
      box.expandByPoint(v);
    }
  });
  return box.isEmpty() ? null : box;
}

/** A unit sphere with an oval window cut out of the front (+z) for the face. */
function makeHoodGeometry() {
  const sphere = new THREE.SphereGeometry(1, 40, 28).toNonIndexed();
  const pos = sphere.attributes.position;
  const normal = sphere.attributes.normal;
  const keep: number[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    const m = a.add(b).add(c).divideScalar(3);
    // Oval face window: front-facing, from just above the brows to the chin.
    const inFace = m.z > 0.2 && (m.x / 0.62) ** 2 + ((m.y + 0.12) / 0.62) ** 2 < 1;
    if (!inFace) keep.push(i, i + 1, i + 2);
  }
  const geometry = new THREE.BufferGeometry();
  const p = new Float32Array(keep.length * 3);
  const n = new Float32Array(keep.length * 3);
  keep.forEach((src, dst) => {
    p.set([pos.getX(src), pos.getY(src), pos.getZ(src)], dst * 3);
    n.set([normal.getX(src), normal.getY(src), normal.getZ(src)], dst * 3);
  });
  geometry.setAttribute("position", new THREE.BufferAttribute(p, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(n, 3));
  return geometry;
}
