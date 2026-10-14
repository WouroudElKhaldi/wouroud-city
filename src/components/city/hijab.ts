import * as THREE from "three";

/**
 * Hijab for the adult (Quaternius) characters, measured from the character's own
 * head so it fits any of them. It wraps the head and frames the face, going under
 * the chin down to the top of the neck, where the outfit's high neckline takes over.
 * Pieces (all attached to the head bone):
 *  - hood: an outer and an inner layer shaped around the head, with an oval
 *    opening for the face;
 *  - rim: a soft rolled edge of fabric framing the face;
 *  - volume: a gentle rounded lift at the back, from the hair gathered underneath.
 * The character's hair should be hidden while it is worn.
 */

/** The face opening on the unit sphere: an oval on the front (+z). */
const FACE = { rx: 0.76, ry: 0.68, cy: -0.06 };

export function buildHijab(model: THREE.Object3D, color: string): { removeFromParent: () => void } | null {
  const headBone = model.getObjectByName("Head");
  if (!headBone) return null;

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
  // Close-fitting: just a little roomier than the head, so it reads as fabric, not a helmet.
  const radii = new THREE.Vector3(size.x * 0.56, size.y * 0.57, size.z * 0.57);
  const hoodCenter = new THREE.Vector3(center.x, center.y + size.y * 0.04, center.z - size.z * 0.04);

  const outer = new THREE.Mesh(makeHoodGeometry(), fabric);
  outer.scale.copy(radii);
  outer.position.copy(hoodCenter);

  const inner = new THREE.Mesh(makeHoodGeometry(), lining);
  inner.scale.copy(radii).multiplyScalar(0.94);
  inner.position.copy(hoodCenter);

  const rim = new THREE.Mesh(makeRimGeometry(radii), fabric);
  rim.position.copy(hoodCenter);

  // Volume: the hair gathered under the scarf lifts the back of the head a little.
  const volume = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), fabric);
  volume.scale.set(radii.x * 0.62, radii.y * 0.5, radii.z * 0.55);
  volume.position.set(hoodCenter.x, hoodCenter.y + radii.y * 0.32, hoodCenter.z - radii.z * 0.62);

  const pieces = [outer, inner, rim, volume];
  for (const p of pieces) {
    p.castShadow = true;
    model.add(p);
  }
  model.updateMatrixWorld(true);
  for (const p of pieces) headBone.attach(p);
  return { removeFromParent: () => pieces.forEach((p) => p.removeFromParent()) };
}

/** Bounds (in model space) of the skin vertices that move with the head bone. */
export function measureHeadSkin(model: THREE.Object3D, headBone: THREE.Object3D) {
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
  return new THREE.TubeGeometry(curve, 120, Math.min(radii.x, radii.y) * 0.05, 12, true);
}
