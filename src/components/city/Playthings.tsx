"use client";

import { useGLTF } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { BallCollider, CuboidCollider, type RapierRigidBody, RigidBody } from "@react-three/rapier";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { playerState } from "@/world/env";
import { sfx } from "@/world/sfx";
import { emitBurst } from "./Particles";

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

function makeBallTexture(kind: "soccer" | "beach") {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const c = canvas.getContext("2d")!;
  if (kind === "beach") {
    const stripes = ["#f472b6", "#ffffff", "#a78bfa", "#fde68a", "#ffffff", "#67e8f9"];
    stripes.forEach((col, i) => {
      c.fillStyle = col;
      c.fillRect((i * 256) / stripes.length, 0, 256 / stripes.length + 1, 128);
    });
  } else {
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, 256, 128);
    c.fillStyle = "#2e1065";
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 6; col++) {
        const x = col * 44 + (row % 2) * 22 + 10;
        const y = row * 44 + 20;
        c.beginPath();
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
          c.lineTo(x + Math.cos(a) * 11, y + Math.sin(a) * 11);
        }
        c.fill();
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
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
        <sphereGeometry args={[radius, 24, 16]} />
        <meshStandardMaterial map={texture} roughness={0.45} />
      </mesh>
    </RigidBody>
  );
}

// ---------------------------------------------------------------------------
// Cones and crates
// ---------------------------------------------------------------------------

/** Traffic cones and crates from the Car Kit. Knock them over; they tidy themselves up later. */
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
  const { scene } = useGLTF(`/models/cars/${kind}.glb`);
  const model = useMemo(() => {
    const m = scene.clone(true);
    m.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    return m;
  }, [scene]);
  const body = useRef<RapierRigidBody>(null);
  const disturbedAt = useRef<number | null>(null);
  const scale = kind === "cone" ? 1.6 : 1.5;
  const half = kind === "cone" ? [0.32, 0.48, 0.32] : [0.55, 0.55, 0.55];

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
      <primitive
        object={model}
        scale={scale}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (!isClick(e) || !body.current) return;
          e.stopPropagation();
          const dir = e.ray.direction.clone().setY(0).normalize();
          body.current.applyImpulse({ x: dir.x * 2, y: 0.6, z: dir.z * 2 }, true);
          body.current.applyTorqueImpulse({ x: dir.z * 0.4, y: 0, z: -dir.x * 0.4 }, true);
          sfx.clunk();
        }}
        {...pointer}
      />
    </RigidBody>
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
  const heads = useRef<(THREE.Mesh | null)[]>([]);

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
      if (head) head.position.y = 0.2 + (airborne ? 0 : Math.max(0, Math.sin(t * 6 + i * 2)) * -0.08);
    });
    if (scattered) sfx.chirp();
  });

  return (
    <group>
      {birds.map((_, i) => (
        <group key={i} ref={(el) => void (groups.current[i] = el)} scale={1.3}>
          <mesh position={[0, 0.12, 0]} scale={[0.09, 0.08, 0.15]} castShadow>
            <sphereGeometry args={[1, 10, 8]} />
            <meshStandardMaterial color={i % 3 === 0 ? "#e9d8fd" : "#8b80a6"} />
          </mesh>
          <mesh ref={(el) => void (heads.current[i] = el)} position={[0, 0.2, 0.12]}>
            <sphereGeometry args={[0.055, 10, 8]} />
            <meshStandardMaterial color="#6b5b8a" />
          </mesh>
          <mesh position={[0, 0.2, 0.18]} rotation-x={Math.PI / 2}>
            <coneGeometry args={[0.018, 0.05, 6]} />
            <meshStandardMaterial color="#f59e0b" />
          </mesh>
          {[0, 1].map((side) => (
            <group
              key={side}
              ref={(el) => {
                wings.current[i] ??= [];
                wings.current[i][side] = el;
              }}
              position={[side === 0 ? 0.06 : -0.06, 0.15, 0]}
            >
              <mesh position={[side === 0 ? 0.1 : -0.1, 0, 0]} scale={[0.12, 0.01, 0.08]}>
                <boxGeometry args={[1, 1, 1]} />
                <meshStandardMaterial color="#a39bc0" />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Parked cars
// ---------------------------------------------------------------------------

export type ParkedCar = { model: string; x: number; z: number; rot: number };

/** Parked cars: click one and it honks, flashes its lights and bounces on its suspension. */
export function ParkedCars({ cars }: { cars: ParkedCar[] }) {
  return (
    <group>
      {cars.map((c, i) => (
        <Car key={i} {...c} />
      ))}
    </group>
  );
}

function Car({ model, x, z, rot }: ParkedCar) {
  const { scene } = useGLTF(`/models/cars/${model}.glb`);
  const object = useMemo(() => {
    const m = scene.clone(true);
    m.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return m;
  }, [scene]);
  const bounce = useRef<THREE.Group>(null);
  const lights = useMemo(
    () =>
      new THREE.MeshStandardMaterial({ color: "#fef9c3", emissive: "#fef08a", emissiveIntensity: 0, toneMapped: false, transparent: true, opacity: 0 }),
    [],
  );
  const honkedAt = useRef(-10);
  const pendingHonk = useRef(false);
  const scale = 2.2;

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
        <primitive
          object={object}
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
        />
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


export function preloadPlaythings() {
  useGLTF.preload("/models/cars/cone.glb");
  useGLTF.preload("/models/cars/box.glb");
}
