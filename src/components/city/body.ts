import * as THREE from "three";

/**
 * Body tailoring for the Quaternius characters:
 *  - `shapeCurvy` gently reshapes a female figure (fuller hips and bust, a defined waist),
 *  - `addSkinLayer` copies part of the character's own skin as a thin fabric layer, so
 *    sleeves and high necklines fit exactly and bend with the skeleton,
 *  - `addFaceFeatures` adds soft lips and a light blush.
 */

const HAND_BONES = /Palm|Fingers|Thumb|MiddleHand/;
const LEG_BONES = /UpperLeg|LowerLeg|Foot/;

function dominantBone(skinIndex: THREE.BufferAttribute, skinWeight: THREE.BufferAttribute, i: number) {
  let best = 0;
  let bestW = -1;
  for (let k = 0; k < 4; k++) {
    const w = skinWeight.getComponent(i, k);
    if (w > bestW) {
      bestW = w;
      best = skinIndex.getComponent(i, k);
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Curvy figure
// ---------------------------------------------------------------------------

/**
 * Reshapes every mesh of a female character in its bind pose: hips and bust a
 * little fuller, the waist a little narrower. Clothing meshes are reshaped the
 * same way so they still fit. Arms are left alone.
 */
export function shapeCurvy(scene: THREE.Object3D) {
  thinEyebrows(scene);
  const meshes: THREE.SkinnedMesh[] = [];
  scene.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) meshes.push(o as THREE.SkinnedMesh);
  });
  if (!meshes.length) return;
  const box = new THREE.Box3();
  for (const m of meshes) {
    m.geometry.computeBoundingBox();
    box.union(m.geometry.boundingBox!);
  }
  const height = box.max.y - box.min.y;
  const cx = (box.max.x + box.min.x) / 2;
  // Torso center depth, measured from the hips band.
  const hipZ: number[] = [];
  for (const m of meshes) {
    const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const h = (pos.getY(i) - box.min.y) / height;
      if (h > 0.48 && h < 0.56 && Math.abs(pos.getX(i) - cx) < height * 0.12) hipZ.push(pos.getZ(i));
    }
  }
  const cz = hipZ.length ? (Math.min(...hipZ) + Math.max(...hipZ)) / 2 : (box.max.z + box.min.z) / 2;
  const bump = (h: number, at: number, width: number) => Math.exp(-(((h - at) / width) ** 2));

  for (const m of meshes) {
    const pos = m.geometry.attributes.position;
    const skinIndex = m.geometry.attributes.skinIndex as THREE.BufferAttribute;
    const skinWeight = m.geometry.attributes.skinWeight as THREE.BufferAttribute;
    const bones = m.skeleton.bones;
    for (let i = 0; i < pos.count; i++) {
      const bone = bones[dominantBone(skinIndex, skinWeight, i)]?.name ?? "";
      if (/Arm|Shoulder|Palm|Fingers|Thumb|MiddleHand|Head/.test(bone)) continue;
      const x = pos.getX(i) - cx;
      const z = pos.getZ(i) - cz;
      const h = (pos.getY(i) - box.min.y) / height;
      const hips = bump(h, 0.5, 0.06) * 0.11;
      const waist = bump(h, 0.615, 0.035) * -0.07;
      const bust = bump(h, 0.725, 0.035) * (z > 0 ? 0.16 : 0.04);
      const sx = 1 + hips + waist + bust * 0.12;
      const sz = 1 + hips * 0.8 + waist + bust;
      pos.setX(i, cx + x * sx);
      pos.setZ(i, cz + z * sz);
    }
    pos.needsUpdate = true;
    m.geometry.computeVertexNormals();
    m.geometry.computeBoundingBox();
    m.geometry.computeBoundingSphere();
  }
}

// ---------------------------------------------------------------------------
// Skin layer (sleeves, high necklines)
// ---------------------------------------------------------------------------

export type SkinRegion = "arms" | "neck" | "chest" | "legs";

/**
 * Copies the triangles of the character's skin that belong to the given regions,
 * pushes them slightly outward, and renders them in fabric. Because the copy uses
 * the same skeleton and weights, it bends exactly like the body underneath.
 */
export function addSkinLayer(model: THREE.Object3D, regions: SkinRegion[], color: string) {
  const material = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.8,
    sheen: 0.7,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.45),
  });
  const added: THREE.Object3D[] = [];
  const include = (bone: string) => {
    // Legs (not feet): fabric for the long dress, so a striding leg never shows skin below the skirt.
    if (/UpperLeg|LowerLeg/.test(bone)) return regions.includes("legs");
    if (HAND_BONES.test(bone) || LEG_BONES.test(bone) || bone === "Head") return false;
    if (/Arm|Shoulder/.test(bone)) return regions.includes("arms");
    if (bone === "Neck") return regions.includes("neck");
    return regions.includes("chest");
  };

  model.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh || !/^Skin/.test((mesh.material as THREE.Material).name)) return;
    if (mesh.userData.isLayer) return;
    const geometry = mesh.geometry;
    const index = geometry.index;
    if (!index) return;
    const skinIndex = geometry.attributes.skinIndex as THREE.BufferAttribute;
    const skinWeight = geometry.attributes.skinWeight as THREE.BufferAttribute;
    const bones = mesh.skeleton.bones;
    const keep: number[] = [];
    for (let t = 0; t < index.count; t += 3) {
      const a = index.getX(t);
      const b = index.getX(t + 1);
      const c = index.getX(t + 2);
      if ([a, b, c].every((v) => include(bones[dominantBone(skinIndex, skinWeight, v)]?.name ?? ""))) keep.push(a, b, c);
    }
    if (!keep.length) return;
    geometry.computeBoundingBox();
    const size = geometry.boundingBox!.getSize(new THREE.Vector3());
    const offset = Math.max(size.x, size.y, size.z) * 0.0035;
    const layer = geometry.clone();
    const pos = layer.attributes.position;
    const normal = layer.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(
        i,
        pos.getX(i) + normal.getX(i) * offset,
        pos.getY(i) + normal.getY(i) * offset,
        pos.getZ(i) + normal.getZ(i) * offset,
      );
    }
    layer.setIndex(keep);
    const shell = new THREE.SkinnedMesh(layer, material);
    shell.userData.isLayer = true;
    shell.bind(mesh.skeleton, mesh.bindMatrix);
    shell.position.copy(mesh.position);
    shell.quaternion.copy(mesh.quaternion);
    shell.scale.copy(mesh.scale);
    shell.castShadow = true;
    shell.frustumCulled = false;
    mesh.parent?.add(shell);
    added.push(shell);
  });
  return () => added.forEach((o) => o.removeFromParent());
}

// ---------------------------------------------------------------------------
// Face
// ---------------------------------------------------------------------------

/**
 * Soft rosy lips and a light blush on the cheeks, placed from the
 * character's own eye and head geometry and attached to the head bone.
 */
export function addFaceFeatures(model: THREE.Object3D) {
  const head = model.getObjectByName("Head");
  if (!head) return () => {};
  model.updateMatrixWorld(true);
  const toModel = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const eyes: THREE.Vector3[] = [];
  const skin: THREE.Vector3[] = [];
  const v = new THREE.Vector3();
  model.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh || mesh.userData.isLayer) return;
    const name = (mesh.material as THREE.Material).name;
    const isEye = /^Eye/.test(name) && !/brow/i.test(name);
    const isSkin = /^Skin/.test(name);
    if (!isEye && !isSkin) return;
    const headIndex = mesh.skeleton.bones.indexOf(head as THREE.Bone);
    const pos = mesh.geometry.attributes.position;
    const skinIndex = mesh.geometry.attributes.skinIndex as THREE.BufferAttribute;
    const skinWeight = mesh.geometry.attributes.skinWeight as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      if (dominantBone(skinIndex, skinWeight, i) !== headIndex) continue;
      v.fromBufferAttribute(pos, i);
      mesh.applyBoneTransform(i, v);
      v.applyMatrix4(mesh.matrixWorld).applyMatrix4(toModel);
      (isEye ? eyes : skin).push(v.clone());
    }
  });
  if (eyes.length < 4 || skin.length < 10) return () => {};

  const headBox = new THREE.Box3().setFromPoints(skin);
  const cx = (headBox.min.x + headBox.max.x) / 2;
  const left = eyes.filter((p) => p.x > cx);
  const right = eyes.filter((p) => p.x <= cx);
  if (!left.length || !right.length) return () => {};
  const leftBox = new THREE.Box3().setFromPoints(left);
  const rightBox = new THREE.Box3().setFromPoints(right);
  const eyeY = (leftBox.max.y + rightBox.max.y) / 2;
  const eyeSpan = leftBox.getCenter(new THREE.Vector3()).x - rightBox.getCenter(new THREE.Vector3()).x;
  const chinY = headBox.min.y;
  /** Front surface of the face at a given height and x. */
  const surfaceZ = (y: number, x: number, band: number) => {
    let z = -Infinity;
    for (const p of skin) if (Math.abs(p.y - y) < band && Math.abs(p.x - x) < band * 2) z = Math.max(z, p.z);
    return Number.isFinite(z) ? z : headBox.max.z;
  };

  const pieces: THREE.Object3D[] = [];
  const band = (eyeY - chinY) * 0.08;

  // Lips.
  const lipY = eyeY - (eyeY - chinY) * 0.64;
  const lipZ = surfaceZ(lipY, cx, band);
  const lipMaterial = new THREE.MeshPhysicalMaterial({ color: "#c9707f", roughness: 0.4, clearcoat: 0.4 });
  const upper = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), lipMaterial);
  upper.scale.set(eyeSpan * 0.26, eyeSpan * 0.055, eyeSpan * 0.045);
  upper.position.set(cx, lipY + eyeSpan * 0.04, lipZ);
  const lower = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), lipMaterial);
  lower.scale.set(eyeSpan * 0.22, eyeSpan * 0.07, eyeSpan * 0.05);
  lower.position.set(cx, lipY - eyeSpan * 0.05, lipZ);
  pieces.push(upper, lower);

  // Blush.
  const blushMaterial = new THREE.MeshBasicMaterial({
    color: "#f0849a",
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    map: makeSoftDot(),
  });
  const cheekY = eyeY - (eyeY - chinY) * 0.36;
  for (const box of [leftBox, rightBox]) {
    const x = box.getCenter(new THREE.Vector3()).x * 1.08 - cx * 0.08;
    const dot = new THREE.Mesh(new THREE.CircleGeometry(eyeSpan * 0.28, 24), blushMaterial);
    dot.position.set(x, cheekY, surfaceZ(cheekY, x, band) + eyeSpan * 0.01);
    pieces.push(dot);
  }

  for (const p of pieces) model.add(p);
  model.updateMatrixWorld(true);
  for (const p of pieces) head.attach(p);
  return () => pieces.forEach((p) => p.removeFromParent());
}

function makeSoftDot() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

/** Makes thick block eyebrows slimmer and lifts them a touch, for a softer look. */
function thinEyebrows(scene: THREE.Object3D) {
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !/brow/i.test((mesh.material as THREE.Material).name)) return;
    const pos = mesh.geometry.attributes.position;
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox!;
    const cy = (box.min.y + box.max.y) / 2;
    const lift = (box.max.y - box.min.y) * 0.15;
    for (let i = 0; i < pos.count; i++) pos.setY(i, cy + (pos.getY(i) - cy) * 0.5 + lift);
    pos.needsUpdate = true;
  });
}
