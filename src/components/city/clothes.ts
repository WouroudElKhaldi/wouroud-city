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
  /**
   * Loose drape for the torso: below `hang` meters under the shoulders, the fabric falls
   * from the widest point above it instead of following the waist and chest, like a loose
   * top. The value is how far below the shoulder line the hanging starts.
   */
  hang?: number;
  /** Extra room for sleeves (meters added to inflate on arms and forearms) */
  sleeveRoom?: number;
};

/** A skinned fabric layer over the given body regions. Returns the mesh (already added next to the body). */
export function addLayer(body: THREE.SkinnedMesh, regions: Region[], material: THREE.Material, opts: LayerOptions) {
  const g = body.geometry;
  const index = g.index!;
  const skinIndex = g.attributes.skinIndex as THREE.BufferAttribute;
  const skinWeight = g.attributes.skinWeight as THREE.BufferAttribute;
  const bones = body.skeleton.bones;
  const inRegion = new Uint8Array(g.attributes.position.count);
  const regionOfVertex: Region[] = new Array(inRegion.length);
  for (let i = 0; i < inRegion.length; i++) {
    regionOfVertex[i] = regionOf(bones[dominant(skinIndex, skinWeight, i)]?.name ?? "");
    inRegion[i] = regions.includes(regionOfVertex[i]) ? 1 : 0;
  }

  const keep: number[] = [];
  for (let t = 0; t < index.count; t += 3) {
    const a = index.getX(t);
    const b = index.getX(t + 1);
    const c = index.getX(t + 2);
    const n = inRegion[a] + inRegion[b] + inRegion[c];
    if (n === 3 || (opts.generous && n >= 2)) keep.push(a, b, c);
  }

  const layer = g.clone();
  // The converted bodies store vertices interleaved (all attributes packed per vertex).
  // Copy each attribute into its own plain array so positions can be edited directly.
  for (const name of Object.keys(layer.attributes)) {
    const attr = layer.attributes[name];
    if ((attr as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute) {
      layer.setAttribute(name, (attr as THREE.InterleavedBufferAttribute).clone());
    }
  }
  layer.setIndex(keep);
  const pos = layer.attributes.position as THREE.BufferAttribute;
  const p = pos.array as Float32Array;

  // The body is split along texture seams (the same point appears as several
  // vertices). Weld by position so smoothing and pushing move every copy of a
  // point together; otherwise the seams tear open into holes.
  const canon = new Int32Array(pos.count).fill(-1);
  const keyToId = new Map<string, number>();
  const used = [...new Set(keep)];
  for (const v of used) {
    const key = `${Math.round(p[v * 3] * 1e3)},${Math.round(p[v * 3 + 1] * 1e3)},${Math.round(p[v * 3 + 2] * 1e3)}`;
    let id = keyToId.get(key);
    if (id === undefined) keyToId.set(key, (id = keyToId.size));
    canon[v] = id;
  }
  const count = keyToId.size;
  const pointRegion: Region[] = new Array(count);
  for (const v of used) pointRegion[canon[v]] ??= regionOfVertex[v];
  const cp = new Float32Array(count * 3);
  for (const v of used) cp.set([p[v * 3], p[v * 3 + 1], p[v * 3 + 2]], canon[v] * 3);

  // Skin normals per welded point (area-weighted face normals).
  const cn = new Float32Array(count * 3);
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const fn = new THREE.Vector3();
  for (let t = 0; t < keep.length; t += 3) {
    const [i0, i1, i2] = [canon[keep[t]], canon[keep[t + 1]], canon[keep[t + 2]]];
    e1.set(cp[i1 * 3] - cp[i0 * 3], cp[i1 * 3 + 1] - cp[i0 * 3 + 1], cp[i1 * 3 + 2] - cp[i0 * 3 + 2]);
    e2.set(cp[i2 * 3] - cp[i0 * 3], cp[i2 * 3 + 1] - cp[i0 * 3 + 1], cp[i2 * 3 + 2] - cp[i0 * 3 + 2]);
    fn.crossVectors(e1, e2);
    for (const i of [i0, i1, i2]) {
      cn[i * 3] += fn.x;
      cn[i * 3 + 1] += fn.y;
      cn[i * 3 + 2] += fn.z;
    }
  }
  for (let i = 0; i < count; i++) {
    const l = Math.hypot(cn[i * 3], cn[i * 3 + 1], cn[i * 3 + 2]) || 1;
    cn[i * 3] /= l;
    cn[i * 3 + 1] /= l;
    cn[i * 3 + 2] /= l;
  }
  const skin = cp.slice();

  // Laplacian smoothing on the welded surface: fabric skims over muscle and curves.
  const passes = opts.smooth ?? 0;
  if (passes > 0) {
    const neighbors: Set<number>[] = Array.from({ length: count }, () => new Set<number>());
    for (let t = 0; t < keep.length; t += 3) {
      const tri = [canon[keep[t]], canon[keep[t + 1]], canon[keep[t + 2]]];
      for (const v of tri) for (const w of tri) if (w !== v) neighbors[v].add(w);
    }
    for (let pass = 0; pass < passes; pass++) {
      const next = cp.slice();
      for (let v = 0; v < count; v++) {
        const set = neighbors[v];
        if (!set.size) continue;
        let x = 0;
        let y = 0;
        let z = 0;
        for (const w of set) {
          x += cp[w * 3];
          y += cp[w * 3 + 1];
          z += cp[w * 3 + 2];
        }
        const n = set.size;
        next[v * 3] = cp[v * 3] * 0.5 + (x / n) * 0.5;
        next[v * 3 + 1] = cp[v * 3 + 1] * 0.5 + (y / n) * 0.5;
        next[v * 3 + 2] = cp[v * 3 + 2] * 0.5 + (z / n) * 0.5;
      }
      cp.set(next);
    }
  }
  // Smoothing shrinks a surface, so measure each point against the skin it came from
  // and push it back out until it is at least `inflate` above the skin.
  for (let i = 0; i < count; i++) {
    const k = i * 3;
    const above = (cp[k] - skin[k]) * cn[k] + (cp[k + 1] - skin[k + 1]) * cn[k + 1] + (cp[k + 2] - skin[k + 2]) * cn[k + 2];
    const room = pointRegion[i] === "arms" || pointRegion[i] === "forearms" ? (opts.sleeveRoom ?? 0) : 0;
    const push = Math.max(0, opts.inflate + room - above);
    cp[k] += cn[k] * push;
    cp[k + 1] += cn[k + 1] * push;
    cp[k + 2] += cn[k + 2] * push;
  }
  if (opts.hang !== undefined) hangTorso(cp, pointRegion, count, opts.hang);
  for (const v of used) p.set([cp[canon[v] * 3], cp[canon[v] * 3 + 1], cp[canon[v] * 3 + 2]], v * 3);
  pos.needsUpdate = true;
  layer.computeVertexNormals();
  layer.computeBoundingBox();
  layer.computeBoundingSphere();

  const mesh = new THREE.SkinnedMesh(layer, material);
  mesh.bind(body.skeleton, body.bindMatrix);
  mesh.position.copy(body.position);
  mesh.quaternion.copy(body.quaternion);
  mesh.scale.copy(body.scale);
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  mesh.boundingSphere = layer.boundingSphere!.clone();
  mesh.boundingBox = layer.boundingBox!.clone();
  // Fabric layers are decoration: don't let pointer raycasts walk the skeleton.
  mesh.raycast = () => {};
  body.parent?.add(mesh);
  return mesh;
}

/**
 * Makes torso fabric loose. In cylindrical coordinates around the body's vertical
 * axis, the fabric takes a smoothed outer envelope of the body: it bridges over
 * muscles, curves and the waist instead of dipping into them. Below `startBelow`
 * meters under the top of the torso, it also hangs: it never gets narrower than the
 * widest point above it in the same direction (tapering slowly), like a loose top
 * falling from the chest and shoulders.
 */
function hangTorso(cp: Float32Array, region: Region[], count: number, startBelow: number) {
  const torso: number[] = [];
  let top = -Infinity;
  let bottom = Infinity;
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < count; i++) {
    // The neck stays close-fitting under the hijab; only chest and hips go loose.
    if (region[i] !== "chest" && region[i] !== "pelvis") continue;
    torso.push(i);
    top = Math.max(top, cp[i * 3 + 1]);
    bottom = Math.min(bottom, cp[i * 3 + 1]);
    cx += cp[i * 3];
    cz += cp[i * 3 + 2];
  }
  if (!torso.length) return;
  cx /= torso.length;
  cz /= torso.length;

  const A = 96; // angle bins
  const STEP = 0.015; // meters per height bin
  const H = Math.ceil((top - bottom) / STEP) + 1;
  const angleBin = (i: number) => {
    const ang = Math.atan2(cp[i * 3 + 2] - cz, cp[i * 3] - cx);
    return Math.floor(((ang + Math.PI) / (Math.PI * 2)) * A) % A;
  };
  const heightBin = (i: number) => Math.min(H - 1, Math.max(0, Math.round((cp[i * 3 + 1] - bottom) / STEP)));
  const radius = (i: number) => Math.hypot(cp[i * 3] - cx, cp[i * 3 + 2] - cz);

  // 1. Widest radius per cell.
  let env = new Float32Array(A * H).fill(-1);
  for (const i of torso) {
    const k = heightBin(i) * A + angleBin(i);
    env[k] = Math.max(env[k], radius(i));
  }
  // 2. Smooth outer envelope: dilate then average, around the body and then up/down.
  // Every averaged value is a max over a window containing the original cell, so the
  // envelope never cuts into the body.
  const pass = (src: Float32Array, along: "angle" | "height", reach: number) => {
    const dil = new Float32Array(src.length).fill(-1);
    const out = new Float32Array(src.length).fill(-1);
    const at = (h: number, a: number) => src[h * A + (((a % A) + A) % A)];
    for (let h = 0; h < H; h++)
      for (let ai = 0; ai < A; ai++) {
        let m = -1;
        for (let d = -reach; d <= reach; d++) {
          const v = along === "angle" ? at(h, ai + d) : h + d >= 0 && h + d < H ? at(h + d, ai) : -1;
          if (v > m) m = v;
        }
        dil[h * A + ai] = m;
      }
    for (let h = 0; h < H; h++)
      for (let ai = 0; ai < A; ai++) {
        let sum = 0;
        let n = 0;
        for (let d = -reach; d <= reach; d++) {
          const hh = along === "height" ? h + d : h;
          const aa = along === "angle" ? (((ai + d) % A) + A) % A : ai;
          if (hh < 0 || hh >= H) continue;
          const v = dil[hh * A + aa];
          if (v < 0) continue;
          sum += v;
          n++;
        }
        out[h * A + ai] = n ? sum / n : -1;
      }
    return out;
  };
  env = pass(env, "angle", 8);
  env = pass(env, "height", 3);

  // 3. Hang: going down, never narrower than the widest point above (slow taper).
  const startH = Math.round((top - startBelow - bottom) / STEP);
  const taper = 0.12; // narrows 12% per meter of fall
  for (let ai = 0; ai < A; ai++) {
    let widest = -1;
    let widestH = H - 1;
    for (let h = H - 1; h >= 0; h--) {
      const k = h * A + ai;
      if (env[k] < 0) continue;
      if (h < startH && widest > 0) env[k] = Math.max(env[k], widest * (1 - taper * (widestH - h) * STEP));
      if (env[k] > widest) {
        widest = env[k];
        widestH = h;
      }
    }
  }

  // 4. Move each torso point out to the envelope, from the start line down
  //    (blending in over 6 cm so there is no ledge).
  const BLEND = 6;
  for (const i of torso) {
    const h = heightBin(i);
    const w = THREE.MathUtils.clamp((startH - h) / BLEND, 0, 1);
    if (w <= 0) continue;
    const r = radius(i);
    const target = r + (env[h * A + angleBin(i)] - r) * w;
    if (target > r && r > 1e-6) {
      const k = target / r;
      cp[i * 3] = cx + (cp[i * 3] - cx) * k;
      cp[i * 3 + 2] = cz + (cp[i * 3 + 2] - cz) * k;
    }
  }
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
export function addFlare(
  model: THREE.Object3D,
  material: THREE.Material,
  from: number,
  to: number,
  opts: { flare?: number; folds?: number; topRadius?: number } = {},
) {
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
  const rTop = hip * (opts.topRadius ?? 1.02);
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
      add(addLayer(b, ["chest", "pelvis", "neck", "arms", "forearms"], top, { inflate: 0.02, smooth: 30, generous: true, hang: 0.09, sleeveRoom: 0.008 }));
      add(addLayer(b, ["thighs", "calves"], top, { inflate: 0.012, smooth: 3, generous: true }));
      add(addFlare(model, top, -0.06, 1.0, { flare: 1.85, folds: 10, topRadius: 1.3 }));
      break;
    case "blazer-modest":
      add(addLayer(b, ["chest", "pelvis", "neck", "arms", "forearms"], top, { inflate: 0.02, smooth: 30, generous: true, hang: 0.09, sleeveRoom: 0.008 }));
      add(addLayer(b, ["thighs", "calves"], bottom, { inflate: 0.024, smooth: 6, generous: true }));
      add(addFlare(model, top, -0.06, 0.42, { flare: 1.8, folds: 6, topRadius: 1.3 }));
      break;
    case "tunic":
      add(addLayer(b, ["chest", "pelvis", "neck", "arms", "forearms"], top, { inflate: 0.02, smooth: 30, generous: true, hang: 0.09, sleeveRoom: 0.008 }));
      add(addLayer(b, ["thighs", "calves"], bottom, { inflate: 0.024, smooth: 6, generous: true }));
      add(addFlare(model, top, -0.06, 0.5, { flare: 1.85, folds: 7, topRadius: 1.3 }));
      break;
    // Everyday clothes sit naturally: tops drape from the chest and cover the waistband,
    // trousers have a little room, so no outfit traces the athletic base body.
    case "shirt":
      add(addLayer(b, ["pelvis", "thighs", "calves"], bottom, { inflate: 0.016, smooth: 6, generous: true }));
      add(addLayer(b, ["chest", "pelvis", "arms", "forearms"], top, { inflate: 0.02, smooth: 20, generous: true, hang: 0.12, sleeveRoom: 0.006 }));
      break;
    case "suit":
      add(addLayer(b, ["pelvis", "thighs", "calves"], bottom, { inflate: 0.016, smooth: 6, generous: true }));
      add(addLayer(b, ["chest", "pelvis", "arms", "forearms"], top, { inflate: 0.024, smooth: 20, generous: true, hang: 0.12, sleeveRoom: 0.006 }));
      if (colors.accent) add(addLayer(b, ["neck"], fabric(colors.accent), { inflate: 0.006, smooth: 1, generous: true }));
      break;
    case "tee":
      add(addLayer(b, ["pelvis", "thighs", "calves"], bottom, { inflate: 0.016, smooth: 6, generous: true }));
      add(addLayer(b, ["chest", "pelvis", "arms"], top, { inflate: 0.02, smooth: 20, generous: true, hang: 0.12, sleeveRoom: 0.006 }));
      break;
    case "tee-women":
      // A relaxed long-sleeve top and loose trousers.
      add(addLayer(b, ["pelvis", "thighs", "calves"], bottom, { inflate: 0.022, smooth: 8, generous: true }));
      add(addLayer(b, ["chest", "pelvis", "arms", "forearms"], top, { inflate: 0.02, smooth: 30, generous: true, hang: 0.09, sleeveRoom: 0.008 }));
      break;
  }
  add(addLayer(b, ["feet"], shoes, { inflate: 0.01, smooth: 2, generous: true }));
  return () => added.forEach((o) => o.removeFromParent());
}
