import * as THREE from "three";

/**
 * Realistic outdoor surfaces (asphalt, paving, stone, lawn, granite, wood, bark) from the textures in
 * /public/textures. Materials are shared singletons, so a whole scene of roads costs one shader.
 *
 * Most surfaces are mapped in world space ("world"): the texture is projected from above for floors
 * and from the side for walls, curbs and plinths, at a real-world size in meters, so meshes need no
 * UVs and neighbors line up seamlessly. A slow, large noise varies the brightness so the repeat of
 * the tile is not visible from a distance.
 *
 * Textures load in the background (no Suspense): the surface shows its base color for a moment
 * and sharpens when the image arrives, so the city never waits on them.
 */

export type SurfaceKind = "asphalt" | "pavers" | "stone" | "grass" | "granite" | "wood" | "bark" | "darkStone";

type Spec = {
  map: string;
  normal: string;
  /** Meters covered by one texture tile ("world" mapping) or UV repeats ("uv" mapping) */
  scale: number;
  mapping: "world" | "uv";
  roughness: number;
  metalness?: number;
  normalScale: number;
  color?: string;
  /** Strength of the large-scale brightness variation */
  variation: number;
};

const SPECS: Record<SurfaceKind, Spec> = {
  asphalt: { map: "asphalt_c", normal: "asphalt_n", scale: 4, mapping: "world", roughness: 0.9, normalScale: 0.7, variation: 0.22 },
  pavers: { map: "pavers_c", normal: "pavers_n", scale: 2.4, mapping: "world", roughness: 0.82, normalScale: 0.9, variation: 0.16 },
  stone: { map: "stone_c", normal: "stone_n", scale: 4.8, mapping: "world", roughness: 0.42, normalScale: 0.6, variation: 0.1 },
  grass: { map: "grass_c", normal: "grass_n", scale: 6, mapping: "world", roughness: 1, normalScale: 0.8, variation: 0.35 },
  granite: { map: "granite_c", normal: "granite_n", scale: 1.2, mapping: "world", roughness: 0.55, normalScale: 0.5, variation: 0.06 },
  darkStone: { map: "granite_c", normal: "granite_n", scale: 1.2, mapping: "world", roughness: 0.35, normalScale: 0.4, color: "#3a3540", variation: 0.04 },
  wood: { map: "wood_c", normal: "wood_n", scale: 1, mapping: "uv", roughness: 0.6, normalScale: 0.5, variation: 0 },
  bark: { map: "bark_c", normal: "bark_n", scale: 1, mapping: "uv", roughness: 0.95, normalScale: 1, variation: 0 },
};

const loader = typeof window === "undefined" ? null : new THREE.TextureLoader();
const textures = new Map<string, THREE.Texture>();

export function surfaceTexture(name: string, color: boolean) {
  let t = textures.get(name);
  if (!t && loader) {
    t = loader.load(`/textures/${name}.webp`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    textures.set(name, t);
  }
  return t!;
}

const materials = new Map<string, THREE.MeshStandardMaterial>();

/**
 * The shared material for a surface. `tint` multiplies the texture (e.g. a colored stone band);
 * `repeat` sets UV repeats for "uv"-mapped surfaces.
 */
export function surface(kind: SurfaceKind, tint?: string, repeat: [number, number] = [1, 1]) {
  const key = `${kind}|${tint ?? ""}|${repeat.join("x")}`;
  let m = materials.get(key);
  if (m) return m;
  const spec = SPECS[kind];
  const map = surfaceTexture(spec.map, true);
  const normalMap = surfaceTexture(spec.normal, false);
  if (spec.mapping === "uv" && map) {
    map.repeat.set(...repeat);
    normalMap.repeat.set(...repeat);
  }
  m = new THREE.MeshStandardMaterial({
    map,
    normalMap,
    normalScale: new THREE.Vector2(spec.normalScale, spec.normalScale),
    roughness: spec.roughness,
    metalness: spec.metalness ?? 0,
    color: tint ?? spec.color ?? "#ffffff",
  });
  if (spec.mapping === "world") worldMapped(m, spec.scale, spec.variation);
  m.name = `surface-${kind}`;
  materials.set(key, m);
  return m;
}

/**
 * Projects the material's map and normal map in world space, picking the axis by the surface's
 * world normal (floors from above, walls from the side), and adds a large brightness variation.
 */
export function worldMapped(material: THREE.MeshStandardMaterial, metersPerTile: number, variation: number) {
  material.customProgramCacheKey = () => `world-${metersPerTile}-${variation}`;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTile = { value: 1 / metersPerTile };
    shader.uniforms.uVariation = { value: variation };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTile;\nvarying vec3 vSurfWorld;")
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        vec4 surfW = vec4(transformed, 1.0);
        vec3 surfN = objectNormal;
        #ifdef USE_INSTANCING
          surfW = instanceMatrix * surfW;
          surfN = mat3(instanceMatrix) * surfN;
        #endif
        surfW = modelMatrix * surfW;
        surfN = normalize(mat3(modelMatrix) * surfN);
        vSurfWorld = surfW.xyz;
        vec2 surfUv = abs(surfN.y) > 0.6 ? surfW.xz : (abs(surfN.x) > abs(surfN.z) ? surfW.zy : surfW.xy);
        surfUv *= uTile;
        #ifdef USE_MAP
          vMapUv = surfUv;
        #endif
        #ifdef USE_NORMALMAP
          vNormalMapUv = surfUv;
        #endif`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uVariation;
        varying vec3 vSurfWorld;
        float surfHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float surfNoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(surfHash(i), surfHash(i + vec2(1.0, 0.0)), f.x), mix(surfHash(i + vec2(0.0, 1.0)), surfHash(i + vec2(1.0, 1.0)), f.x), f.y);
        }`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        float surfVar = surfNoise(vSurfWorld.xz * 0.045) * 0.65 + surfNoise(vSurfWorld.xz * 0.19) * 0.35;
        diffuseColor.rgb *= 1.0 + (surfVar - 0.5) * 2.0 * uVariation;`,
      );
  };
  material.needsUpdate = true;
  return material;
}

/** Road paint: slightly worn, a touch glossy. */
export function paint(color: string) {
  const key = `paint|${color}`;
  let m = materials.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.65,
      map: surfaceTexture("asphalt_c", true),
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    // The asphalt grain shows through the paint: lift it so the paint stays bright.
    m.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `#ifdef USE_MAP
          vec4 grain = texture2D(map, vMapUv * 6.0);
          diffuseColor.rgb *= 0.78 + grain.r * 0.6;
        #endif`,
      );
    };
    materials.set(key, m);
  }
  return m;
}

/**
 * Rain makes the ground wet: paving, asphalt and stone get glossy and a little darker. `amount`
 * 0..1, eased by Weather. Only the outdoor ground surfaces react (not bark or wood).
 */
const WET_KINDS = ["asphalt", "pavers", "stone", "granite", "darkStone"];
const dryRoughness = new Map<THREE.MeshStandardMaterial, number>();
const dryColor = new Map<THREE.MeshStandardMaterial, THREE.Color>();
export function setWetness(amount: number) {
  for (const [key, m] of materials) {
    if (!WET_KINDS.includes(key.split("|")[0])) continue;
    if (!dryRoughness.has(m)) {
      dryRoughness.set(m, m.roughness);
      dryColor.set(m, m.color.clone());
    }
    m.roughness = THREE.MathUtils.lerp(dryRoughness.get(m)!, 0.12, amount);
    m.color.copy(dryColor.get(m)!).multiplyScalar(1 - amount * 0.25);
  }
}
