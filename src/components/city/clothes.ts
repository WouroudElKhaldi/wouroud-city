import * as THREE from "three";

/**
 * Clothes for the Universal Base Characters (UE-style rig: pelvis, spine_01..03,
 * clavicle, upperarm, lowerarm, hand, thigh, calf, foot, neck_01, Head).
 *
 * A garment layer copies the body's own triangles for some regions, smooths
 * them (so fabric doesn't trace muscles or curves), and pushes them outward.
 * It shares the body's skeleton and weights, so it moves exactly with every
 * animation. Long skirts and longer tops are flared lathe shapes on the pelvis.
 */

export type Region = "chest" | "pelvis" | "neck" | "arms" | "forearms" | "hands" | "thighs" | "calves" | "feet" | "head";

function regionOf(bone: string): Region {
  if (bone === "Head") return "head";
  if (bone === "neck_01") return "neck";
  if (/^(index|middle|pinky|ring|thumb)_|^hand_/.test(bone)) return "hands";
  if (/^lowerarm/.test(bone)) return "forearms";
  if (/^upperarm/.test(bone)) return "arms";
  if (/^thigh/.test(bone)) return "thighs";
  if (/^calf/.test(bone)) return "calves";
  if (/^(foot|ball)/.test(bone)) return "feet";
  if (bone === "pelvis" || bone === "root") return "pelvis";
  return "chest";
}

function dominant(skinIndex: THREE.BufferAttribute, skinWeight: THREE.BufferAttribute, i: number) {
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

export function fabric(color: string, opts: { sheen?: number; roughness?: number } = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: opts.roughness ?? 0.82,
    sheen: opts.sheen ?? 0.8,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.45),
    side: THREE.DoubleSide,
  });
}

export type LayerOptions = {
  /** Distance pushed out from the skin (meters) */
  inflate: number;
  /** Smoothing passes: more = looser, hides body shape */
  smooth?: number;
  /** Also take triangles with only some corners in the regions (closes gaps at seams) */
  generous?: boolean;
};

/** A skinned fabric layer over the given body regions. Returns the mesh (already added next to the body). */
export function addLayer(body: THREE.SkinnedMesh, regions: Region[], material: THREE.Material, opts: LayerOptions) {
  const g = body.geometry;
  const index = g.index!;
  const skinIndex = g.attributes.skinIndex as THREE.BufferAttribute;
  const skinWeight = g.attributes.skinWeight as THREE.BufferAttribute;
  const bones = body.skeleton.bones;
  const inRegion = new Uint8Array(g.attributes.position.count);
  for (let i = 0; i < inRegion.length; i++) inRegion[i] = regions.includes(regionOf(bones[dominant(skinIndex, skinWeight, i)]?.name ?? "")) ? 1 : 0;

  const keep: number[] = [];
  for (let t = 0; t < index.count; t += 3) {
    const a = index.getX(t);
    const b = index.getX(t + 1);
    const c = index.getX(t + 2);
    const n = inRegion[a] + inRegion[b] + inRegion[c];
    if (n === 3 || (opts.generous && n >= 2)) keep.push(a, b, c);
  }

  const layer = g.clone();
  layer.setIndex(keep);
  const pos = layer.attributes.position as THREE.BufferAttribute;
  // The skin's own surface and normals, to keep the fabric outside it after smoothing.
  layer.computeVertexNormals();
  const skin = (pos.array as Float32Array).slice();
  const skinNormal = (layer.attributes.normal.array as Float32Array).slice();

  // Laplacian smoothing over the kept surface: fabric skims over muscle and curves.
  const passes = opts.smooth ?? 0;
  if (passes > 0) {
    const neighbors = new Map<number, Set<number>>();
    for (let t = 0; t < keep.length; t += 3) {
      const tri = [keep[t], keep[t + 1], keep[t + 2]];
      for (const v of tri) {
        let set = neighbors.get(v);
        if (!set) neighbors.set(v, (set = new Set()));
        for (const w of tri) if (w !== v) set.add(w);
      }
    }
    const p = pos.array as Float32Array;
    for (let pass = 0; pass < passes; pass++) {
      const next = p.slice();
      for (const [v, set] of neighbors) {
        let x = 0;
        let y = 0;
        let z = 0;
        for (const w of set) {
          x += p[w * 3];
          y += p[w * 3 + 1];
          z += p[w * 3 + 2];
        }
        const n = set.size;
        next[v * 3] = p[v * 3] * 0.5 + (x / n) * 0.5;
        next[v * 3 + 1] = p[v * 3 + 1] * 0.5 + (y / n) * 0.5;
        next[v * 3 + 2] = p[v * 3 + 2] * 0.5 + (z / n) * 0.5;
      }
      p.set(next);
    }
  }
  // Smoothing shrinks a surface, so measure each point against the skin it came from
  // and push it back out until it is at least `inflate` above the skin.
  const p = pos.array as Float32Array;
  for (const v of new Set(keep)) {
    const i = v * 3;
    const nx = skinNormal[i];
    const ny = skinNormal[i + 1];
    const nz = skinNormal[i + 2];
    const above = (p[i] - skin[i]) * nx + (p[i + 1] - skin[i + 1]) * ny + (p[i + 2] - skin[i + 2]) * nz;
    const push = Math.max(0, opts.inflate - above);
    p[i] += nx * push;
    p[i + 1] += ny * push;
    p[i + 2] += nz * push;
  }
  pos.needsUpdate = true;
  layer.computeVertexNormals();

  const mesh = new THREE.SkinnedMesh(layer, material);
  mesh.bind(body.skeleton, body.bindMatrix);
  mesh.position.copy(body.position);
  mesh.quaternion.copy(body.quaternion);
  mesh.scale.copy(body.scale);
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  body.parent?.add(mesh);
  return mesh;
}

/** Ripple a lathe's radius into soft folds, stronger toward the hem. */
function folds(geometry: THREE.BufferGeometry, top: number, height: number, count: number, amount: number) {
  const pos = geometry.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const depth = THREE.MathUtils.clamp((top - v.y) / height, 0, 1);
    const k = 1 + Math.sin(Math.atan2(v.z, v.x) * count) * amount * depth;
    pos.setXYZ(i, v.x * k, v.y, v.z * k);
  }
  geometry.computeVertexNormals();
}

/**
 * A flared skirt or the lower part of a long top, hanging from the pelvis.
 * `from` and `to` are heights as fractions of the hip→ankle length (0 = hips, 1 = ankles).
 */
export function addFlare(model: THREE.Object3D, material: THREE.Material, from: number, to: number, opts: { flare?: number; folds?: number } = {}) {
  model.updateMatrixWorld(true);
  const toModel = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const at = (name: string) => {
    const bone = model.getObjectByName(name);
    return bone ? new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld).applyMatrix4(toModel) : null;
  };
  const pelvis = at("pelvis");
  const thighL = at("thigh_l");
  const thighR = at("thigh_r");
  const foot = at("foot_l");
  const pelvisBone = model.getObjectByName("pelvis");
  if (!pelvis || !thighL || !thighR || !foot || !pelvisBone) return null;
  const hip = thighL.distanceTo(thighR);
  const length = pelvis.y - foot.y;
  const top = pelvis.y + length * 0.12 - length * from;
  const bottom = pelvis.y - length * to;
  const height = top - bottom;
  const rTop = hip * 1.02;
  const rBottom = hip * (opts.flare ?? 1.7);
  const profile = [
    new THREE.Vector2(rTop * 0.96, top),
    new THREE.Vector2(rTop, top - height * 0.08),
    new THREE.Vector2(THREE.MathUtils.lerp(rTop, rBottom, 0.5) * 1.03, top - height * 0.45),
    new THREE.Vector2(rBottom * 0.96, top - height * 0.85),
    new THREE.Vector2(rBottom, bottom),
  ];
  const geometry = new THREE.LatheGeometry(profile, 72);
  folds(geometry, top, height, opts.folds ?? 9, 0.035);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(pelvis.x, 0, pelvis.z);
  mesh.scale.set(1, 1, 0.82);
  mesh.castShadow = true;
  model.add(mesh);
  model.updateMatrixWorld(true);
  pelvisBone.attach(mesh);
  return mesh;
}

// ---------------------------------------------------------------------------
// Outfits
// ---------------------------------------------------------------------------

export type OutfitKind =
  /** Her long dress: loose top and sleeves to the wrists, ankle-length flared skirt, fabric legs */
  | "abaya"
  /** Her blazer look: loose jacket to the wrists, a top that falls past the hips, wide trousers */
  | "blazer-modest"
  /** Her casual look: loose long tunic to mid-thigh, wide trousers */
  | "tunic"
  /** Men: shirt with long sleeves and trousers */
  | "shirt"
  /** Men: t-shirt and trousers */
  | "tee"
  /** Men: suit jacket over a shirt */
  | "suit"
  /** Women without hijab (NPCs): t-shirt and trousers */
  | "tee-women";

export type OutfitColors = { top: string; bottom: string; shoes: string; accent?: string };

/** Dress a base character. Returns a function that takes everything off again. */
export function dressUp(model: THREE.Object3D, kind: OutfitKind, colors: OutfitColors) {
  let body: THREE.SkinnedMesh | null = null;
  model.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (m.isSkinnedMesh && /^Skin/.test((m.material as THREE.Material).name)) body = m;
  });
  if (!body) return () => {};
  const b: THREE.SkinnedMesh = body;
  const added: THREE.Object3D[] = [];
  const add = (o: THREE.Object3D | null) => {
    if (o) added.push(o);
  };
  const top = fabric(colors.top);
  const bottom = fabric(colors.bottom);
  const shoes = new THREE.MeshStandardMaterial({ color: colors.shoes, roughness: 0.5 });

  switch (kind) {
    case "abaya":
      // One flowing garment: everything but hands, feet and face, kept loose.
      add(addLayer(b, ["chest", "pelvis", "neck", "arms", "forearms"], top, { inflate: 0.022, smooth: 8, generous: true }));
      add(addLayer(b, ["thighs", "calves"], top, { inflate: 0.012, smooth: 3, generous: true }));
      add(addFlare(model, top, 0, 1.0, { flare: 1.75, folds: 10 }));
      break;
    case "blazer-modest":
      add(addLayer(b, ["chest", "pelvis", "neck", "arms", "forearms"], top, { inflate: 0.022, smooth: 7, generous: true }));
      add(addLayer(b, ["thighs", "calves"], bottom, { inflate: 0.02, smooth: 4, generous: true }));
      add(addFlare(model, top, 0, 0.42, { flare: 1.35, folds: 6 }));
      break;
    case "tunic":
      add(addLayer(b, ["chest", "pelvis", "neck", "arms", "forearms"], top, { inflate: 0.02, smooth: 7, generous: true }));
      add(addLayer(b, ["thighs", "calves"], bottom, { inflate: 0.02, smooth: 4, generous: true }));
      add(addFlare(model, top, 0, 0.5, { flare: 1.4, folds: 7 }));
      break;
    case "shirt":
      add(addLayer(b, ["chest", "arms", "forearms"], top, { inflate: 0.014, smooth: 4, generous: true }));
      add(addLayer(b, ["pelvis", "thighs", "calves"], bottom, { inflate: 0.012, smooth: 3, generous: true }));
      break;
    case "suit":
      add(addLayer(b, ["chest", "arms", "forearms"], top, { inflate: 0.018, smooth: 5, generous: true }));
      add(addLayer(b, ["pelvis", "thighs", "calves"], bottom, { inflate: 0.013, smooth: 3, generous: true }));
      if (colors.accent) add(addLayer(b, ["neck"], fabric(colors.accent), { inflate: 0.006, smooth: 1, generous: true }));
      break;
    case "tee":
    case "tee-women":
      add(addLayer(b, ["chest", "arms"], top, { inflate: 0.012, smooth: 4, generous: true }));
      add(addLayer(b, ["pelvis", "thighs", "calves"], bottom, { inflate: 0.012, smooth: 3, generous: true }));
      break;
  }
  add(addLayer(b, ["feet"], shoes, { inflate: 0.01, smooth: 2, generous: true }));
  return () => added.forEach((o) => o.removeFromParent());
}
