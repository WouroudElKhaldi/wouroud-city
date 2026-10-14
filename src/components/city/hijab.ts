import * as THREE from "three";
import { addFolds } from "./garments";

/**
 * Hijab for the adult (Quaternius) characters, measured from the character's own
 * head so it fits any of them. Pieces:
 *  - hood: an outer and an inner layer shaped around the head, with an oval
 *    opening for the face (attached to the head bone);
 *  - rim: a soft rolled edge of fabric framing the face, which also hides the
 *    cut edge of the opening;
 *  - drape (khimar): wraps the neck and falls over the shoulders, chest and back
 *    with gentle folds, longer at front and back than at the sides (neck bone).
 * The character's hair should be hidden while it is worn.
 */

/** The face opening on the unit sphere: an oval on the front (+z). */
const FACE = { rx: 0.6, ry: 0.64, cy: -0.14 };

export function buildHijab(model: THREE.Object3D, color: string): { removeFromParent: () => void } | null {
  const headBone = model.getObjectByName("Head");
  const neckBone = model.getObjectByName("Neck") ?? headBone;
  if (!headBone || !neckBone) return null;

  const bounds = measureHeadSkin(model, headBone);
  if (!bounds) return null;
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());

  const fabric = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.82,
    sheen: 1,
    sheenRoughness: 0.4,
    sheenColor: new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.6),
    side: THREE.DoubleSide,
  });
  // Slightly darker inside, like the shaded inner side of real fabric.
  const lining = fabric.clone();
  lining.color = new THREE.Color(color).multiplyScalar(0.78);

  // Head-sized ellipsoid frame, a little roomier than the head itself.
  const radii = new THREE.Vector3(size.x * 0.62, size.y * 0.6, size.z * 0.64);
  const hoodCenter = new THREE.Vector3(center.x, center.y + size.y * 0.05, center.z - size.z * 0.06);

  const outer = new THREE.Mesh(makeHoodGeometry(), fabric);
  outer.scale.copy(radii);
  outer.position.copy(hoodCenter);

  const inner = new THREE.Mesh(makeHoodGeometry(), lining);
  inner.scale.copy(radii).multiplyScalar(0.94);
  inner.position.copy(hoodCenter);

  const rim = new THREE.Mesh(makeRimGeometry(radii), fabric);
  rim.position.copy(hoodCenter);

  // Drape ------------------------------------------------------------------
  const w = size.x;
  const top = center.y - size.y * 0.28;
  const length = size.y * 1.15;
  const profile = [
    new THREE.Vector2(w * 0.34, top),
    new THREE.Vector2(w * 0.38, top - length * 0.18),
    new THREE.Vector2(w * 0.58, top - length * 0.36),
    new THREE.Vector2(w * 0.98, top - length * 0.56),
    new THREE.Vector2(w * 1.16, top - length * 0.8),
    new THREE.Vector2(w * 1.2, top - length),
  ];
  const drapeGeometry = new THREE.LatheGeometry(profile, 72);
  addFolds(drapeGeometry, top, length, 9, 0.05);
  // Longer at the front and back than over the arms, like a real khimar.
  const pos = drapeGeometry.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const depth = THREE.MathUtils.clamp((top - v.y) / length, 0, 1);
    const frontBack = Math.abs(v.z) / Math.max(1e-6, Math.hypot(v.x, v.z));
    pos.setY(i, v.y - frontBack * depth * depth * length * 0.35);
  }
  drapeGeometry.computeVertexNormals();
  const drape = new THREE.Mesh(drapeGeometry, fabric);
  drape.position.set(center.x, 0, center.z - size.z * 0.06);
  drape.scale.set(1, 1, 0.8);

  const pieces = [outer, inner, rim, drape];
  for (const p of pieces) {
    p.castShadow = true;
    model.add(p);
  }
  model.updateMatrixWorld(true);
  headBone.attach(outer);
  headBone.attach(inner);
  headBone.attach(rim);
  neckBone.attach(drape);
  return { removeFromParent: () => pieces.forEach((p) => p.removeFromParent()) };
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
    if (!/^Skin/.test((mesh.material as THREE.Material).name)) return;
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

function inFaceWindow(x: number, y: number, z: number) {
  return z > 0 && (x / FACE.rx) ** 2 + ((y - FACE.cy) / FACE.ry) ** 2 < 1;
}

/** A smooth unit sphere with the face window removed. */
function makeHoodGeometry() {
  const sphere = new THREE.SphereGeometry(1, 64, 48).toNonIndexed();
  const pos = sphere.attributes.position;
  const normal = sphere.attributes.normal;
  const keep: number[] = [];
  for (let i = 0; i < pos.count; i += 3) {
    const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    const z = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    if (!inFaceWindow(x, y, z)) keep.push(i, i + 1, i + 2);
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

/** A rolled fabric edge following the face window's border on the scaled hood. */
function makeRimGeometry(radii: THREE.Vector3) {
  const points: THREE.Vector3[] = [];
  const steps = 72;
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const x = FACE.rx * Math.cos(t);
    const y = FACE.cy + FACE.ry * Math.sin(t);
    const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
    points.push(new THREE.Vector3(x * radii.x, y * radii.y, z * radii.z * 0.98));
  }
  const curve = new THREE.CatmullRomCurve3(points, true, "centripetal");
  return new THREE.TubeGeometry(curve, 120, Math.min(radii.x, radii.y) * 0.075, 12, true);
}
