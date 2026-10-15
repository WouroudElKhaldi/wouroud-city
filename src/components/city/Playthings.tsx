"use client";

import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { BallCollider, CuboidCollider, type RapierRigidBody, RigidBody } from "@react-three/rapier";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useCityStore } from "@/state/useCityStore";
import { playerState } from "@/world/env";
import { sfx } from "@/world/sfx";
import { CAR_SCALE, CarModel } from "./CarModel";
import { emitBurst } from "./Particles";
import { surface } from "./surfaces";
import { useProximity } from "./useProximity";

/** Ignore clicks that were really the end of a camera drag. */
function isClick(e: ThreeEvent<MouseEvent>) {
  return e.delta <= 6;
}

const pointer = {
  onPointerOver: () => (document.body.style.cursor = "pointer"),
  onPointerOut: () => (document.body.style.cursor = ""),
};

// ---------------------------------------------------------------------------
// Balls
// ---------------------------------------------------------------------------

/**
 * Ball skins painted on an equirectangular canvas. The soccer ball is a real truncated-icosahedron
 * pattern: every pixel takes the nearest of the 12 pentagon centers (icosahedron vertices) or 20
 * hexagon centers (face centers); pentagons are black, seams are drawn where two panels meet.
 */
function makeBallTexture(kind: "soccer" | "beach") {
  const w = 512;
  const h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext("2d")!;
  const img = c.createImageData(w, h);
  const ico = new THREE.IcosahedronGeometry(1, 0);
  const pos = ico.attributes.position;
  const pent: THREE.Vector3[] = [];
  const hex: THREE.Vector3[] = [];
  for (let i = 0; i < pos.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(pos, i);
    const b = new THREE.Vector3().fromBufferAttribute(pos, i + 1);
    const d = new THREE.Vector3().fromBufferAttribute(pos, i + 2);
    hex.push(a.clone().add(b).add(d).normalize());
    for (const v of [a, b, d]) if (!pent.some((p) => p.distanceToSquared(v) < 1e-4)) pent.push(v.clone().normalize());
  }
  const centers = [...pent.map((v) => ({ v, black: true })), ...hex.map((v) => ({ v, black: false }))];
  const beach = [
    [220, 40, 50],
    [250, 250, 250],
    [30, 90, 200],
    [250, 200, 30],
    [250, 250, 250],
    [40, 160, 80],
  ];
  const dir = new THREE.Vector3();
  for (let y = 0; y < h; y++) {
    const lat = (0.5 - (y + 0.5) / h) * Math.PI;
    for (let x = 0; x < w; x++) {
      const lon = ((x + 0.5) / w) * Math.PI * 2;
      let r = 250;
      let g = 250;
      let b = 250;
      if (kind === "soccer") {
        // Same mapping as three's SphereGeometry UVs.
        dir.set(-Math.cos(lon) * Math.cos(lat), Math.sin(lat), Math.sin(lon) * Math.cos(lat));
        let best = -2;
        let second = -2;
        let black = false;
        for (const cn of centers) {
          // Pentagons are a little smaller than hexagons on a real ball.
          const d = dir.dot(cn.v) + (cn.black ? -0.012 : 0);
          if (d > best) {
            second = best;
            best = d;
            black = cn.black;
          } else if (d > second) second = d;
        }
        const seam = best - second < 0.012;
        const v = seam ? 70 : black ? 28 : 246;
        r = g = b = v;
      } else {
        const panel = beach[Math.floor((lon / (Math.PI * 2)) * 6) % 6];
        const cap = Math.abs(lat) > 1.25;
        [r, g, b] = cap ? [250, 250, 250] : panel;
      }
      const k = (y * w + x) * 4;
      img.data[k] = r;
      img.data[k + 1] = g;
      img.data[k + 2] = b;
      img.data[k + 3] = 255;
    }
  }
  c.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Physics balls: walk into them to dribble, click to kick them away. */
export function Balls({ spots }: { spots: { x: number; z: number; kind: "soccer" | "beach" }[] }) {
  return (
    <group>
      {spots.map((s, i) => (
        <Ball key={i} {...s} />
      ))}
    </group>
  );
}

function Ball({ x, z, kind }: { x: number; z: number; kind: "soccer" | "beach" }) {
  const body = useRef<RapierRigidBody>(null);
  const texture = useMemo(() => makeBallTexture(kind), [kind]);
  const radius = kind === "beach" ? 0.55 : 0.35;
  const lastSound = useRef(0);

  const kick = (e: ThreeEvent<MouseEvent>) => {
    if (!isClick(e) || !body.current) return;
    e.stopPropagation();
    const dir = e.ray.direction.clone().setY(0).normalize();
    const strength = kind === "beach" ? 1.6 : 3;
    body.current.applyImpulse({ x: dir.x * strength, y: strength * 0.9, z: dir.z * strength }, true);
    sfx.kick();
  };

  useFrame(() => {
    const b = body.current;
    if (!b) return;
    const p = b.translation();
    // Bring lost balls back home.
    if (p.y < -5 || Math.abs(p.x - x) > 60 || Math.abs(p.z - z) > 60) {
      b.setTranslation({ x, y: 2, z }, true);
      b.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
  });

  return (
    <RigidBody
      ref={body}
      colliders={false}
      position={[x, radius + 0.2, z]}
      restitution={0.7}
      friction={0.6}
      linearDamping={0.35}
      angularDamping={0.3}
      mass={kind === "beach" ? 0.15 : 0.45}
      onCollisionEnter={() => {
        const now = performance.now();
        if (now - lastSound.current > 250 && playerState.speed > 1) {
          lastSound.current = now;
          sfx.kick();
        }
      }}
    >
      <BallCollider args={[radius]} />
      <mesh castShadow onClick={kick} {...pointer}>
        <sphereGeometry args={[radius, 40, 28]} />
        <meshPhysicalMaterial map={texture} roughness={kind === "beach" ? 0.25 : 0.5} clearcoat={kind === "beach" ? 0.8 : 0.3} clearcoatRoughness={0.2} />
      </mesh>
    </RigidBody>
  );
}

// ---------------------------------------------------------------------------
// Cones and crates
// ---------------------------------------------------------------------------

/** Traffic cones and wooden crates. Knock them over; they tidy themselves up later. */
export function Knockables({ spots }: { spots: { x: number; z: number; kind: "cone" | "box"; rot?: number }[] }) {
  return (
    <group>
      {spots.map((s, i) => (
        <Knockable key={i} {...s} />
      ))}
    </group>
  );
}

function Knockable({ x, z, kind, rot = 0 }: { x: number; z: number; kind: "cone" | "box"; rot?: number }) {
  const body = useRef<RapierRigidBody>(null);
  const disturbedAt = useRef<number | null>(null);
  const half = kind === "cone" ? [0.19, 0.36, 0.19] : [0.4, 0.4, 0.4];

  useFrame(() => {
    const b = body.current;
    if (!b) return;
    const p = b.translation();
    const moved = Math.hypot(p.x - x, p.z - z) > 0.4 || Math.abs(b.rotation().w) < 0.98;
    if (!moved) {
      disturbedAt.current = null;
      return;
    }
    disturbedAt.current ??= performance.now();
    const v = b.linvel();
    const resting = Math.abs(v.x) + Math.abs(v.y) + Math.abs(v.z) < 0.05;
    if (resting && performance.now() - disturbedAt.current > 20000) {
      b.setTranslation({ x, y: 0.6, z }, true);
      b.setRotation(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0)), true);
      b.setLinvel({ x: 0, y: 0, z: 0 }, true);
      b.setAngvel({ x: 0, y: 0, z: 0 }, true);
      disturbedAt.current = null;
    }
  });

  return (
    <RigidBody
      ref={body}
      colliders={false}
      position={[x, 0.05, z]}
      rotation={[0, rot, 0]}
      mass={kind === "cone" ? 0.4 : 1}
      friction={0.8}
      onCollisionEnter={() => {
        if (playerState.speed > 1.5) sfx.clunk();
      }}
    >
      <CuboidCollider args={half as [number, number, number]} position={[0, half[1], 0]} />
      <group
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (!isClick(e) || !body.current) return;
          e.stopPropagation();
          const dir = e.ray.direction.clone().setY(0).normalize();
          body.current.applyImpulse({ x: dir.x * 2, y: 0.6, z: dir.z * 2 }, true);
          body.current.applyTorqueImpulse({ x: dir.z * 0.4, y: 0, z: -dir.x * 0.4 }, true);
          sfx.clunk();
        }}
        {...pointer}
      >
        {kind === "cone" ? <TrafficCone /> : <Crate />}
      </group>
    </RigidBody>
  );
}

/** A real-size traffic cone (72 cm): orange PVC with two reflective white bands on a black base. */
function TrafficCone() {
  const parts = useMemo(() => CONE_PARTS(), []);
  return (
    <group>
      <mesh geometry={parts.base} material={RUBBER} castShadow receiveShadow />
      <mesh geometry={parts.body} material={CONE_ORANGE} castShadow />
      <mesh geometry={parts.bands} material={REFLECTIVE} />
    </group>
  );
}

const RUBBER = new THREE.MeshStandardMaterial({ color: "#1d1d20", roughness: 0.85 });
const CONE_ORANGE = new THREE.MeshPhysicalMaterial({ color: "#f05a12", roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.35 });
const REFLECTIVE = new THREE.MeshStandardMaterial({ color: "#f4f4f4", roughness: 0.25, metalness: 0.3, emissive: "#ffffff", emissiveIntensity: 0.05 });
const CONE_PARTS = () => {
  const radius = (y: number) => 0.155 - (y / 0.7) * 0.125;
  const band = (y0: number, y1: number) =>
    new THREE.LatheGeometry([new THREE.Vector2(radius(y0) + 0.002, y0), new THREE.Vector2(radius(y1) + 0.002, y1)], 32);
  const body = new THREE.LatheGeometry(
    [
      [0.17, 0.03],
      [0.155, 0.04],
      [0.03, 0.7],
      [0.024, 0.715],
      [0, 0.716],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
    32,
  );
  const base = new THREE.BoxGeometry(0.38, 0.035, 0.38).translate(0, 0.0175, 0);
  const bands = mergeGeometries([band(0.38, 0.47), band(0.52, 0.58)])!;
  return { base, body, bands };
};

/** A wooden shipping crate (80 cm) with a darker frame. */
function Crate() {
  const frame = useMemo(() => {
    const s = 0.8;
    const t = 0.07;
    const list: THREE.BufferGeometry[] = [];
    for (const x of [-1, 1])
      for (const z of [-1, 1]) list.push(new THREE.BoxGeometry(t, s, t).translate((x * (s - t)) / 2, s / 2, (z * (s - t)) / 2));
    for (const y of [t / 2, s - t / 2])
      for (const z of [-1, 1]) list.push(new THREE.BoxGeometry(s, t, t).translate(0, y, (z * (s - t)) / 2 + z * 0.004));
    for (const y of [t / 2, s - t / 2])
      for (const x of [-1, 1]) list.push(new THREE.BoxGeometry(t, t, s).translate((x * (s - t)) / 2 + x * 0.004, y, 0));
    // A diagonal brace on two faces.
    for (const z of [-1, 1]) list.push(new THREE.BoxGeometry(s * 1.25, t * 0.9, t * 0.6).rotateZ(Math.PI / 4).translate(0, s / 2, z * (s / 2 + 0.01)));
    return mergeGeometries(list.map((g) => g.toNonIndexed()))!;
  }, []);
  return (
    <group>
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow material={surface("wood", "#d8b080", [2, 2])}>
        <boxGeometry args={[0.76, 0.76, 0.76]} />
      </mesh>
      <mesh geometry={frame} castShadow material={surface("wood", "#8a6038", [1, 3])} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Pigeons
// ---------------------------------------------------------------------------

type BirdState = {
  home: THREE.Vector3;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  mode: "ground" | "flying" | "returning";
  timer: number;
  heading: number;
};

/** Pigeons pecking on the plaza. Get close and they scatter into the sky, then come back. */
export function Pigeons({ center, radius, count = 10 }: { center: [number, number]; radius: number; count?: number }) {
  const birds = useMemo<BirdState[]>(
    () =>
      Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + i;
        const r = radius * (0.4 + ((i * 37) % 10) / 16);
        const home = new THREE.Vector3(center[0] + Math.cos(a) * r, 0, center[1] + Math.sin(a) * r);
        return { home, pos: home.clone(), vel: new THREE.Vector3(), mode: "ground" as const, timer: (i % 4) * 0.7, heading: a };
      }),
    [center, radius, count],
  );
  const groups = useRef<(THREE.Group | null)[]>([]);
  const wings = useRef<(THREE.Group | null)[][]>([]);
  const heads = useRef<(THREE.Object3D | null)[]>([]);

  useFrame(({ clock }, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const t = clock.elapsedTime;
    let scattered = false;
    birds.forEach((b, i) => {
      const g = groups.current[i];
      if (!g) return;
      const dx = b.pos.x - playerState.position.x;
      const dz = b.pos.z - playerState.position.z;
      const close = dx * dx + dz * dz < 4.5 * 4.5;

      if (b.mode === "ground") {
        if (close) {
          b.mode = "flying";
          b.timer = 8 + Math.random() * 6;
          const away = new THREE.Vector3(dx, 0, dz).normalize();
          b.vel.set(away.x * 6 + (Math.random() - 0.5) * 3, 5 + Math.random() * 2, away.z * 6 + (Math.random() - 0.5) * 3);
          scattered = true;
        } else {
          // Peck around home.
          b.timer -= delta;
          if (b.timer < 0) {
            b.timer = 1 + Math.random() * 3;
            b.heading += (Math.random() - 0.5) * 2;
          }
          b.pos.x += Math.sin(b.heading) * delta * 0.25;
          b.pos.z += Math.cos(b.heading) * delta * 0.25;
          if (b.pos.distanceTo(b.home) > 1.5) b.heading = Math.atan2(b.home.x - b.pos.x, b.home.z - b.pos.z);
        }
      } else if (b.mode === "flying") {
        b.timer -= delta;
        b.vel.y = Math.max(b.vel.y - delta * 0.6, 0.6);
        b.pos.addScaledVector(b.vel, delta);
        b.heading = Math.atan2(b.vel.x, b.vel.z);
        if (b.timer < 0) b.mode = "returning";
      } else {
        const to = b.home.clone().sub(b.pos);
        const dist = to.length();
        if (dist < 0.3) {
          b.mode = "ground";
          b.pos.copy(b.home);
        } else {
          b.vel.copy(to.normalize().multiplyScalar(Math.min(7, dist * 1.2 + 1)));
          b.pos.addScaledVector(b.vel, delta);
          b.heading = Math.atan2(b.vel.x, b.vel.z);
        }
      }

      g.position.copy(b.pos);
      g.rotation.y = b.heading;
      const airborne = b.mode !== "ground";
      const flap = airborne ? Math.sin(t * 22 + i) * 0.9 : 0.05;
      wings.current[i]?.forEach((w, side) => {
        if (w) w.rotation.z = (side === 0 ? 1 : -1) * flap;
      });
      const head = heads.current[i];
      if (head) head.position.y = 0.25 + (airborne ? 0 : Math.max(0, Math.sin(t * 6 + i * 2)) * -0.08);
    });
    if (scattered) sfx.chirp();
  });

  return (
    <group>
      {birds.map((_, i) => (
        <group key={i} ref={(el) => void (groups.current[i] = el)}>
          {/* Body: a plump teardrop, pale grey on the back, darker tail */}
          <mesh position={[0, 0.15, 0]} rotation-x={0.25} scale={[0.085, 0.085, 0.16]} geometry={PIGEON.sphere} material={i % 4 === 0 ? PIGEON.pale : PIGEON.grey} castShadow />
          <mesh position={[0, 0.13, -0.15]} rotation-x={-0.25} scale={[0.06, 0.012, 0.09]} geometry={PIGEON.sphere} material={PIGEON.dark} castShadow />
          {/* Neck with the green-purple sheen, then the head */}
          <mesh position={[0, 0.2, 0.09]} rotation-x={-0.5} scale={[0.058, 0.07, 0.058]} geometry={PIGEON.sphere} material={PIGEON.neck} />
          <group ref={(el) => void (heads.current[i] = el)} position={[0, 0.25, 0.12]}>
            <mesh scale={[0.042, 0.042, 0.048]} geometry={PIGEON.sphere} material={PIGEON.grey} castShadow />
            <mesh position={[0, -0.006, 0.05]} rotation-x={Math.PI / 2} geometry={PIGEON.beak} material={PIGEON.beakMat} />
            <mesh position={[0, 0.004, 0.042]} scale={[0.012, 0.008, 0.01]} geometry={PIGEON.sphere} material={PIGEON.cere} />
            {[-1, 1].map((sx) => (
              <mesh key={sx} position={[sx * 0.028, 0.01, 0.025]} scale={0.009} geometry={PIGEON.sphere} material={PIGEON.eye} />
            ))}
          </group>
          {/* Legs */}
          {[-1, 1].map((sx) => (
            <mesh key={sx} position={[sx * 0.025, 0.04, 0.01]} geometry={PIGEON.leg} material={PIGEON.legMat} />
          ))}
          {[0, 1].map((side) => (
            <group
              key={side}
              ref={(el) => {
                wings.current[i] ??= [];
                wings.current[i][side] = el;
              }}
              position={[side === 0 ? 0.06 : -0.06, 0.18, 0]}
            >
              {/* Folded wing with two dark bars */}
              <mesh position={[side === 0 ? 0.06 : -0.06, 0, -0.03]} scale={[0.09, 0.014, 0.14]} geometry={PIGEON.sphere} material={PIGEON.wing} castShadow />
              {[-0.02, -0.06].map((z) => (
                <mesh key={z} position={[side === 0 ? 0.07 : -0.07, 0.012, z]} scale={[0.06, 0.004, 0.012]} geometry={PIGEON.sphere} material={PIGEON.dark} />
              ))}
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

/** Shared pigeon parts: a rock dove's blue-grey, iridescent neck, coral legs, orange eyes. */
const PIGEON = {
  sphere: new THREE.SphereGeometry(1, 16, 12),
  beak: new THREE.ConeGeometry(0.008, 0.03, 8),
  leg: new THREE.CylinderGeometry(0.005, 0.005, 0.08, 6),
  grey: new THREE.MeshStandardMaterial({ color: "#8e95a3", roughness: 0.85 }),
  pale: new THREE.MeshStandardMaterial({ color: "#c9cbd0", roughness: 0.85 }),
  dark: new THREE.MeshStandardMaterial({ color: "#3e4350", roughness: 0.85 }),
  wing: new THREE.MeshStandardMaterial({ color: "#a3a9b5", roughness: 0.8 }),
  neck: new THREE.MeshPhysicalMaterial({ color: "#5c6f6a", roughness: 0.45, iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [200, 600] }),
  beakMat: new THREE.MeshStandardMaterial({ color: "#2a2628", roughness: 0.5 }),
  cere: new THREE.MeshStandardMaterial({ color: "#e8e4e0", roughness: 0.7 }),
  eye: new THREE.MeshStandardMaterial({ color: "#e0701c", roughness: 0.2 }),
  legMat: new THREE.MeshStandardMaterial({ color: "#d06a6a", roughness: 0.6 }),
};

// ---------------------------------------------------------------------------
// Parked cars
// ---------------------------------------------------------------------------

export type ParkedCar = { id: string; model: string; x: number; z: number; rot: number };

const CAR_NAMES: Record<string, string> = {
  sedan: "sedan",
  taxi: "taxi",
  suv: "SUV",
  police: "police car",
  "hatchback-sports": "sports car",
  van: "van",
};

/**
 * Parked cars: click one and it honks, flashes its lights and bounces on its
 * suspension. Walk up to one and press E to drive it; it stays where you park it.
 */
export function ParkedCars({ cars }: { cars: ParkedCar[] }) {
  const driving = useCityStore((s) => s.driving);
  const parked = useCityStore((s) => s.parked);
  return (
    <group>
      {cars.map((c) =>
        driving?.id === c.id ? null : <Car key={c.id} {...c} {...parked[c.id]} />,
      )}
    </group>
  );
}

function Car({ id, model, x, z, rot }: ParkedCar) {
  const startDriving = useCityStore((s) => s.startDriving);
  const where = useMemo(() => new THREE.Vector3(x, 0, z), [x, z]);
  useProximity({
    id: `car-${id}`,
    label: `Drive the ${CAR_NAMES[model] ?? "car"}`,
    radius: 3.4,
    where,
    run: () => startDriving({ id, model, from: { x, z, rot } }),
  });
  const bounce = useRef<THREE.Group>(null);
  const lights = useMemo(
    () =>
      new THREE.MeshStandardMaterial({ color: "#fef9c3", emissive: "#fef08a", emissiveIntensity: 0, toneMapped: false, transparent: true, opacity: 0 }),
    [],
  );
  const honkedAt = useRef(-10);
  const pendingHonk = useRef(false);
  const scale = CAR_SCALE;

  useFrame(({ clock }) => {
    if (pendingHonk.current) {
      pendingHonk.current = false;
      honkedAt.current = clock.elapsedTime;
    }
    const age = clock.elapsedTime - honkedAt.current;
    if (bounce.current) bounce.current.position.y = age < 0.8 ? Math.abs(Math.sin(age * 14)) * 0.12 * (1 - age / 0.8) : 0;
    const lit = age < 1.2 && Math.floor(age * 6) % 2 === 0;
    lights.emissiveIntensity = lit ? 6 : 0;
    lights.opacity = lit ? 1 : 0;
  });

  return (
    <group position={[x, 0, z]} rotation-y={rot}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.75 * scale, 0.6 * scale, 1.27 * scale]} position={[0, 0.6 * scale, 0]} />
      </RigidBody>
      <group ref={bounce}>
        <group
          scale={scale}
          position={[0, 0.3 * scale, 0]}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            if (!isClick(e)) return;
            e.stopPropagation();
            pendingHonk.current = true;
            sfx.honk();
            emitBurst({ position: new THREE.Vector3(x, 2.6, z), kind: "sparkle", count: 8, colors: ["#fde68a"], spread: 0.5 });
          }}
          {...pointer}
        >
          <CarModel id={id} model={model} />
        </group>
        {/* Headlights */}
        {[-0.45, 0.45].map((hx) => (
          <mesh key={hx} position={[hx * scale, 0.55 * scale, 1.28 * scale]} material={lights}>
            <sphereGeometry args={[0.16, 10, 10]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}


/** Cones and crates are built in code now; nothing to fetch. */
export function preloadPlaythings() {}
