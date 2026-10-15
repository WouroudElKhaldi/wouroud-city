"use client";

import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { seedContent } from "@/content/seed";
import type { Experience, Project } from "@/content/schema";
import { useCityStore, type Seat } from "@/state/useCityStore";
import type { DistrictId } from "@/world/districts";
import { worldEnv } from "@/world/env";
import { parseRoom, ROOM, type RoomScene } from "@/world/interiors";
import { computeDistrictLayout } from "@/world/layout";
import { accents } from "@/world/palette";
import { signatureFor } from "@/world/signatures";
import { Emblem } from "./Emblems";
import { TradingDesk, TradingFloor } from "./TradingFloor";
import { useGlowMaterial } from "./materials";
import { makeWalkers, Pedestrians } from "./Pedestrians";
import { Seats } from "./StreetDetails";
import { useProximity } from "./useProximity";
import { TEXT_FONT } from "@/world/fonts";

const W = ROOM.width;
const D = ROOM.depth;
const H = ROOM.height;
const INK = "#1a103d";
const PAPER = "#fbf8ff";

/**
 * Inside a building: a job's office or a project's studio, built from its content.
 * The room sits at the origin; the way out is in the middle of the front wall (+z).
 * Walls are one-sided and face inward, so when the camera swings outside the room
 * the wall in between disappears instead of blocking the view (a dollhouse view).
 */
export function InteriorScene({ scene }: { scene: RoomScene }) {
  const room = parseRoom(scene)!;
  const spec = useMemo(
    () =>
      computeDistrictLayout(seedContent, room.district).buildings.find(
        (b) => b.id === room.id,
      ),
    [room.district, room.id],
  );
  const job = seedContent.experience.find((e) => e.id === room.id);
  const project = seedContent.projects.find((p) => p.id === room.id);
  const accent = spec?.color ?? "#7c3aed";
  const label = spec?.label ?? job?.company ?? project?.name ?? "Building";

  // Two people at work, walking a loop around the middle of the room.
  const walkers = useMemo(
    () =>
      makeWalkers(
        `room-${room.id}`,
        room.district,
        [],
        [
          [
            [-7.2, -6.2],
            [7.2, -6.2],
            [7.2, 3.4],
            [-7.2, 3.4],
          ],
          [
            [6.6, 3.4],
            [-6.6, 3.4],
            [-6.6, -6.2],
            [6.6, -6.2],
          ],
        ],
      ),
    [room.id, room.district],
  );

  return (
    <group>
      <Shell accent={accent} />
      <OnWall side="front">
        <ExitDoor id={room.id} district={room.district} accent={accent} />
      </OnWall>
      <InfoKiosk
        district={room.district}
        id={room.id}
        label={label}
        accent={accent}
      />
      {job ? (
        <Office job={job} accent={accent} />
      ) : project ? (
        <Studio project={project} accent={accent} />
      ) : null}
      <Pedestrians walkers={walkers} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// The room
// ---------------------------------------------------------------------------

type Side = "front" | "back" | "left" | "right";

/**
 * Things mounted on a wall. The walls themselves vanish when the camera is behind
 * them; this hides what hangs on them too, so it never blocks the view from outside.
 */
function OnWall({ side, children }: { side: Side; children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    const p = camera.position;
    const outside =
      side === "front"
        ? p.z > D / 2
        : side === "back"
          ? p.z < -D / 2
          : side === "left"
            ? p.x < -W / 2
            : p.x > W / 2;
    if (group.current) group.current.visible = !outside;
  });
  return <group ref={group}>{children}</group>;
}

/** Polished marble: warm white with soft grey and gold veins, cut into 1.5 m tiles. */
let marbleTexture: THREE.CanvasTexture | null = null;
function marble() {
  if (marbleTexture) return marbleTexture;
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f3eee6";
  ctx.fillRect(0, 0, size, size);
  let seed = 11;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // Cloudy base
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(${200 + random() * 30},${195 + random() * 30},${190 + random() * 30},0.06)`;
    ctx.beginPath();
    ctx.arc(random() * size, random() * size, 40 + random() * 140, 0, Math.PI * 2);
    ctx.fill();
  }
  // Veins
  const vein = (color: string, width: number, alpha: number) => {
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = width;
    let x = random() * size;
    let y = random() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 14; k++) {
      x += (random() - 0.3) * 110;
      y += (random() - 0.5) * 90;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  };
  for (let i = 0; i < 16; i++) vein("#9a9187", 1 + random() * 2.5, 0.25);
  for (let i = 0; i < 7; i++) vein("#c9a45a", 1 + random() * 1.5, 0.35);
  // Tile joints (the texture spans 2 x 2 tiles)
  ctx.strokeStyle = "rgba(120,110,100,0.45)";
  ctx.lineWidth = 3;
  for (const p of [0, size / 2, size]) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }
  marbleTexture = new THREE.CanvasTexture(canvas);
  marbleTexture.colorSpace = THREE.SRGBColorSpace;
  marbleTexture.wrapS = marbleTexture.wrapT = THREE.RepeatWrapping;
  marbleTexture.repeat.set(W / 3, D / 3);
  marbleTexture.anisotropy = 8;
  return marbleTexture;
}

const WALNUT = "#4a2e1f";
const IVORY = "#f6f0e4";
const GOLD = "#c9a45a";

const WALLS = [
  { side: "back", pos: [0, 0, -D / 2], rot: 0, len: W },
  { side: "front", pos: [0, 0, D / 2], rot: Math.PI, len: W },
  { side: "left", pos: [-W / 2, 0, 0], rot: Math.PI / 2, len: D },
  { side: "right", pos: [W / 2, 0, 0], rot: -Math.PI / 2, len: D },
] as { side: Side; pos: [number, number, number]; rot: number; len: number }[];

/**
 * The room's architecture in a luxury finish: marble floor with a gold inlay, walnut
 * wainscoting under ivory walls, crown molding, and a coffered ceiling with chandeliers.
 */
function Shell({ accent }: { accent: string }) {
  const sky = useRef<THREE.MeshStandardMaterial>(null);
  const day = useMemo(() => new THREE.Color("#cfe8ff"), []);
  const night = useMemo(() => new THREE.Color("#241a55"), []);
  useFrame(() => {
    if (sky.current) sky.current.emissive.lerpColors(day, night, worldEnv.night);
  });
  const gold = useMemo(() => new THREE.MeshStandardMaterial({ color: GOLD, metalness: 0.85, roughness: 0.25 }), []);
  const floor = useMemo(() => marble(), []);

  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[W / 2 + 1, 0.5, D / 2 + 1]} position={[0, -0.5, 0]} />
        <CuboidCollider args={[W / 2 + 1, H, 0.5]} position={[0, H, -D / 2 - 0.5]} />
        <CuboidCollider args={[W / 2 + 1, H, 0.5]} position={[0, H, D / 2 + 0.5]} />
        <CuboidCollider args={[0.5, H, D / 2 + 1]} position={[-W / 2 - 0.5, H, 0]} />
        <CuboidCollider args={[0.5, H, D / 2 + 1]} position={[W / 2 + 0.5, H, 0]} />
      </RigidBody>

      {/* Marble floor with a gold inlay border, and a plum rug with a gold frame */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial map={floor} roughness={0.12} metalness={0.05} envMapIntensity={1.4} />
      </mesh>
      {[
        [0, -D / 2 + 0.7, W - 1.4, 0.07],
        [0, D / 2 - 0.7, W - 1.4, 0.07],
        [-W / 2 + 0.7, 0, 0.07, D - 1.4],
        [W / 2 - 0.7, 0, 0.07, D - 1.4],
      ].map(([x, z, w, d], i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[x, 0.004, z]} material={gold}>
          <planeGeometry args={[w, d]} />
        </mesh>
      ))}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, -1]} receiveShadow>
        <planeGeometry args={[15, 8]} />
        <meshStandardMaterial color="#3b1d4f" roughness={1} />
      </mesh>
      {[
        [15, 8, 0.12],
        [14.2, 7.2, 0.05],
      ].map(([w, d, t], i) => (
        <group key={i} position={[0, 0.008, -1]}>
          {[
            [0, -d / 2, w, t],
            [0, d / 2, w, t],
            [-w / 2, 0, t, d],
            [w / 2, 0, t, d],
          ].map(([x, z, pw, pd], k) => (
            <mesh key={k} rotation-x={-Math.PI / 2} position={[x, 0, z]}>
              <planeGeometry args={[pw, pd]} />
              <meshStandardMaterial color={GOLD} roughness={0.6} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Walls: ivory above walnut wainscoting, gold chair rail, crown molding */}
      {WALLS.map(({ side, pos, rot, len }) => (
        <group key={side} position={pos} rotation-y={rot}>
          <mesh position={[0, H / 2, 0]} receiveShadow castShadow>
            <planeGeometry args={[len, H]} />
            <meshStandardMaterial color={IVORY} roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.6, 0.012]} receiveShadow>
            <planeGeometry args={[len, 1.2]} />
            <meshStandardMaterial color={WALNUT} roughness={0.55} />
          </mesh>
          {/* Raised panels in the wainscoting */}
          {Array.from({ length: Math.floor(len / 1.6) }, (_, i) => (
            <mesh key={i} position={[-len / 2 + 0.8 + i * 1.6 + (len % 1.6) / 2, 0.62, 0.016]}>
              <planeGeometry args={[1.3, 0.8]} />
              <meshStandardMaterial color="#5a3826" roughness={0.5} />
            </mesh>
          ))}
          <mesh position={[0, 1.2, 0.02]} material={gold}>
            <planeGeometry args={[len, 0.05]} />
          </mesh>
          <mesh position={[0, 0.06, 0.02]}>
            <planeGeometry args={[len, 0.12]} />
            <meshStandardMaterial color="#2b1a12" />
          </mesh>
          <mesh position={[0, H - 0.12, 0.02]}>
            <planeGeometry args={[len, 0.24]} />
            <meshStandardMaterial color="#efe6d4" roughness={0.6} />
          </mesh>
          <mesh position={[0, H - 0.26, 0.022]} material={gold}>
            <planeGeometry args={[len, 0.035]} />
          </mesh>
          <mesh position={[0, H - 0.5, 0.02]}>
            <planeGeometry args={[len, 0.06]} />
            <meshStandardMaterial color={accent} />
          </mesh>
        </group>
      ))}

      {/* Walnut pilasters with gold capitals beside the door and in the corners */}
      <OnWall side="front">
        {[-1.75, 1.75].map((x) => (
          <Pilaster key={x} position={[x, 0, D / 2 - 0.12]} gold={gold} />
        ))}
      </OnWall>
      {[
        [-W / 2 + 0.12, -D / 2 + 0.12],
        [W / 2 - 0.12, -D / 2 + 0.12],
        [-W / 2 + 0.12, D / 2 - 0.12],
        [W / 2 - 0.12, D / 2 - 0.12],
      ].map(([x, z], i) => (
        <Pilaster key={i} position={[x, 0, z]} gold={gold} />
      ))}

      {/* Coffered ceiling, chandeliers and warm light */}
      <mesh rotation-x={Math.PI / 2} position={[0, H, 0]} castShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color="#f1e9da" />
      </mesh>
      {[-8, -4, 0, 4, 8].map((x) => (
        <mesh key={`bx${x}`} position={[x, H - 0.11, 0]}>
          <boxGeometry args={[0.22, 0.22, D]} />
          <meshStandardMaterial color={IVORY} roughness={0.7} />
        </mesh>
      ))}
      {[-6, -2, 2, 6].map((z) => (
        <mesh key={`bz${z}`} position={[0, H - 0.11, z]}>
          <boxGeometry args={[W, 0.22, 0.22]} />
          <meshStandardMaterial color={IVORY} roughness={0.7} />
        </mesh>
      ))}
      {[-6, 6].map((x) => (
        <Chandelier key={x} position={[x, H, -1]} gold={gold} />
      ))}
      <Chandelier position={[0, H, 4]} gold={gold} small />
      <pointLight position={[0, H - 1.2, -1]} intensity={18} distance={14} decay={2} color="#ffe2b8" />

      {/* Tall windows on the right wall with slim black-and-gold frames */}
      <OnWall side="right">
        {[-5, 0, 5].map((z) => (
          <group key={z} position={[W / 2 - 0.02, 3.2, z]} rotation-y={-Math.PI / 2}>
            <mesh>
              <planeGeometry args={[3.4, 2.6]} />
              <meshStandardMaterial ref={z === 0 ? sky : undefined} color="#9fc7ef" emissive="#cfe8ff" emissiveIntensity={0.8} />
            </mesh>
            {[-1.7, 0, 1.7].map((x) => (
              <mesh key={x} position={[x, 0, 0.02]}>
                <boxGeometry args={[0.07, 2.66, 0.05]} />
                <meshStandardMaterial color="#14110f" metalness={0.5} roughness={0.4} />
              </mesh>
            ))}
            {[-1.3, 1.3].map((y) => (
              <mesh key={y} position={[0, y, 0.02]}>
                <boxGeometry args={[3.47, 0.07, 0.05]} />
                <meshStandardMaterial color="#14110f" metalness={0.5} roughness={0.4} />
              </mesh>
            ))}
            <mesh position={[0, -1.36, 0.06]} material={gold}>
              <boxGeometry args={[3.6, 0.05, 0.14]} />
            </mesh>
          </group>
        ))}
      </OnWall>

      {/* Sconces flanking the door */}
      <OnWall side="front">
        {[-2.6, 2.6].map((x) => (
          <group key={x} position={[x, 2.6, D / 2 - 0.08]}>
            <mesh material={gold}>
              <boxGeometry args={[0.12, 0.3, 0.06]} />
            </mesh>
            <mesh position={[0, 0.2, -0.12]}>
              <cylinderGeometry args={[0.1, 0.07, 0.22, 16, 1, true]} />
              <meshStandardMaterial color="#fff4dc" emissive="#ffd9a0" emissiveIntensity={1.5} side={THREE.DoubleSide} toneMapped={false} />
            </mesh>
          </group>
        ))}
      </OnWall>

      {/* Olive trees in brass planters in the corners */}
      {[
        [-W / 2 + 1, -D / 2 + 1],
        [W / 2 - 1, -D / 2 + 1],
        [-W / 2 + 1, D / 2 - 1],
        [W / 2 - 1, D / 2 - 1],
      ].map(([x, z], i) => (
        <Plant key={i} x={x} z={z} tall={i < 2} gold={gold} />
      ))}
    </group>
  );
}

function Pilaster({ position, gold }: { position: [number, number, number]; gold: THREE.Material }) {
  return (
    <group position={position}>
      <mesh position={[0, H / 2, 0]} castShadow>
        <boxGeometry args={[0.34, H, 0.24]} />
        <meshStandardMaterial color={WALNUT} roughness={0.5} />
      </mesh>
      <mesh position={[0, H - 0.6, 0]} material={gold}>
        <boxGeometry args={[0.42, 0.12, 0.3]} />
      </mesh>
      <mesh position={[0, 0.1, 0]} material={gold}>
        <boxGeometry args={[0.42, 0.2, 0.3]} />
      </mesh>
    </group>
  );
}

/** A gold chandelier: three tiers of rings with warm bulbs and hanging crystals. */
function Chandelier({ position, gold, small }: { position: [number, number, number]; gold: THREE.Material; small?: boolean }) {
  const s = small ? 0.7 : 1;
  const bulb = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#fff7e6", emissive: "#ffd79a", emissiveIntensity: 2.2, toneMapped: false }),
    [],
  );
  const crystal = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#ffffff", metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.6 }),
    [],
  );
  const tiers: [number, number, number][] = [
    [0.95 * s, -1.1, 12],
    [0.66 * s, -0.85, 9],
    [0.38 * s, -0.62, 6],
  ];
  return (
    <group position={position}>
      <mesh position={[0, -0.3, 0]} material={gold}>
        <cylinderGeometry args={[0.02, 0.02, 0.6, 8]} />
      </mesh>
      <mesh position={[0, -0.03, 0]} material={gold}>
        <cylinderGeometry args={[0.18, 0.12, 0.06, 20]} />
      </mesh>
      {tiers.map(([r, y, n], t) => (
        <group key={t} position={[0, y, 0]}>
          <mesh rotation-x={Math.PI / 2} material={gold}>
            <torusGeometry args={[r, 0.022, 8, 40]} />
          </mesh>
          {Array.from({ length: n }, (_, i) => {
            const a = (i / n) * Math.PI * 2;
            return (
              <group key={i} position={[Math.cos(a) * r, 0, Math.sin(a) * r]}>
                <mesh position={[0, 0.07, 0]} material={bulb}>
                  <sphereGeometry args={[0.045, 10, 8]} />
                </mesh>
                <mesh position={[0, -0.12, 0]} material={crystal}>
                  <octahedronGeometry args={[0.04, 0]} />
                </mesh>
              </group>
            );
          })}
        </group>
      ))}
      <mesh position={[0, -1.25, 0]} material={crystal}>
        <octahedronGeometry args={[0.1 * s, 0]} />
      </mesh>
      <pointLight position={[0, -1, 0]} intensity={14 * s} distance={12} decay={2} color="#ffdcae" />
    </group>
  );
}

function Plant({ x, z, tall, gold }: { x: number; z: number; tall: boolean; gold: THREE.Material }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.4, 0]} material={gold} castShadow>
        <cylinderGeometry args={[0.36, 0.26, 0.8, 24]} />
      </mesh>
      <mesh position={[0, 0.81, 0]}>
        <cylinderGeometry args={[0.33, 0.33, 0.02, 24]} />
        <meshStandardMaterial color="#3b2a1e" />
      </mesh>
      {/* A sculpted olive tree: trunk and layered canopy */}
      <mesh position={[0, 1.3, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.06, 1, 8]} />
        <meshStandardMaterial color="#5a4030" />
      </mesh>
      {(tall ? [1.7, 2.15, 2.55] : [1.6, 1.95]).map((y, i) => (
        <mesh key={y} position={[i % 2 ? 0.12 : -0.1, y, 0]} rotation-y={i} castShadow>
          <icosahedronGeometry args={[0.5 - i * 0.08, 1]} />
          <meshStandardMaterial color={i % 2 ? "#3f6b3a" : "#4f7d46"} roughness={0.9} flatShading />
        </mesh>
      ))}
    </group>
  );
}

/** The way out: a glass door in the middle of the front wall with a glowing sign above it. */
function ExitDoor({
  id,
  district,
  accent,
}: {
  id: string;
  district: DistrictId;
  accent: string;
}) {
  const where = useMemo(() => new THREE.Vector3(0, 0, D / 2 - 1.2), []);
  useProximity({
    id: `leave-${id}`,
    label: "Go back outside",
    radius: 2,
    where,
    run: () => useCityStore.getState().goTo(district),
  });
  const sign = useGlowMaterial(accents.mint, 1.2, 2, "#0f2a2a");
  return (
    <group position={[0, 0, D / 2 - 0.03]} rotation-y={Math.PI}>
      {/* Frame, then two glass leaves */}
      <mesh position={[0, 1.55, -0.01]}>
        <planeGeometry args={[2.7, 3.1]} />
        <meshStandardMaterial color="#2d1f52" />
      </mesh>
      {[-0.63, 0.63].map((x) => (
        <mesh key={x} position={[x, 1.5, 0]}>
          <planeGeometry args={[1.15, 2.85]} />
          <meshStandardMaterial
            color="#9fc7ef"
            emissive="#cfe8ff"
            emissiveIntensity={0.55}
            roughness={0.15}
          />
        </mesh>
      ))}
      {[-0.18, 0.18].map((x) => (
        <mesh key={x} position={[x, 1.3, 0.03]}>
          <boxGeometry args={[0.05, 0.6, 0.05]} />
          <meshStandardMaterial
            color={accents.gold}
            metalness={0.6}
            roughness={0.3}
          />
        </mesh>
      ))}
      <mesh position={[0, 3.45, 0.02]} material={sign}>
        <boxGeometry args={[1.6, 0.42, 0.05]} />
      </mesh>
      <Text font={TEXT_FONT}
        position={[0, 3.45, 0.06]}
        fontSize={0.22}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        WAY OUT
      </Text>
      <mesh position={[0, 0.01, 0.9]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[2.4, 1.4]} />
        <meshStandardMaterial color={accent} roughness={1} />
      </mesh>
    </group>
  );
}

/** A standing screen near the entrance that opens the building's full info panel. */
function InfoKiosk({
  district,
  id,
  label,
  accent,
}: {
  district: DistrictId;
  id: string;
  label: string;
  accent: string;
}) {
  const where = useMemo(() => new THREE.Vector3(7, 0, D / 2 - 2.6), []);
  useProximity({
    id: `kiosk-${id}`,
    label: `Read about ${label}`,
    radius: 2.2,
    where,
    run: () => useCityStore.getState().openPanel({ district, id }),
  });
  const screen = useGlowMaterial(accent, 0.6, 1.2, "#20163f");
  return (
    <group position={[7, 0, D / 2 - 3.4]}>
      <mesh position={[0, 0.6, 0]} castShadow>
        <boxGeometry args={[0.5, 1.2, 0.4]} />
        <meshStandardMaterial color="#2d1f52" />
      </mesh>
      <mesh position={[0, 1.55, 0.05]} rotation-x={-0.25} material={screen}>
        <boxGeometry args={[1.3, 0.85, 0.08]} />
      </mesh>
      <Text font={TEXT_FONT}
        position={[0, 1.6, 0.11]}
        rotation-x={-0.25}
        fontSize={0.13}
        color="#ffffff"
        maxWidth={1.1}
        textAlign="center"
        anchorX="center"
      >
        {`About ${label}\nPress E`}
      </Text>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Wall pieces
// ---------------------------------------------------------------------------

/** A framed board with a heading and a paragraph. */
function Board({
  position,
  rotationY = 0,
  width,
  height,
  title,
  body,
  accent,
}: {
  position: [number, number, number];
  rotationY?: number;
  width: number;
  height: number;
  title?: string;
  body: string;
  accent: string;
}) {
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh position={[0, 0, -0.03]} castShadow>
        <boxGeometry args={[width + 0.14, height + 0.14, 0.05]} />
        <meshStandardMaterial color={accent} />
      </mesh>
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color={PAPER} roughness={0.85} />
      </mesh>
      {title && (
        <Text font={TEXT_FONT}
          position={[-width / 2 + 0.2, height / 2 - 0.2, 0.01]}
          fontSize={0.2}
          color={accent}
          anchorX="left"
          anchorY="top"
          maxWidth={width - 0.4}
        >
          {title}
        </Text>
      )}
      <Text font={TEXT_FONT}
        position={[
          -width / 2 + 0.2,
          title ? height / 2 - 0.55 : height / 2 - 0.2,
          0.01,
        ]}
        fontSize={0.17}
        lineHeight={1.3}
        color={INK}
        anchorX="left"
        anchorY="top"
        maxWidth={width - 0.4}
      >
        {body}
      </Text>
    </group>
  );
}

/** The tech stack as colored tiles, two rows along a wall. */
function TechTiles({
  tech,
  position,
  rotationY,
  length,
}: {
  tech: string[];
  position: [number, number, number];
  rotationY: number;
  length: number;
}) {
  const colors = [
    "#7c3aed",
    accents.teal,
    "#d53f8c",
    accents.goldDeep,
    "#4c51bf",
    accents.tealDeep,
  ];
  const perRow = Math.ceil(tech.length / 2);
  const step = length / Math.max(perRow, 1);
  return (
    <group position={position} rotation-y={rotationY}>
      <Text font={TEXT_FONT}
        position={[0, 1.45, 0.02]}
        fontSize={0.24}
        color={INK}
        anchorX="center"
      >
        Tech stack
      </Text>
      {tech.map((t, i) => {
        const row = Math.floor(i / perRow);
        const col = i % perRow;
        const x = -length / 2 + step * (col + 0.5);
        return (
          <group key={t} position={[x, 0.85 - row * 0.62, 0]}>
            <mesh position={[0, 0, -0.02]}>
              <boxGeometry args={[step - 0.15, 0.48, 0.05]} />
              <meshStandardMaterial color={colors[i % colors.length]} />
            </mesh>
            <Text font={TEXT_FONT}
              position={[0, 0, 0.02]}
              fontSize={0.16}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
              maxWidth={step - 0.25}
              textAlign="center"
            >
              {t}
            </Text>
          </group>
        );
      })}
    </group>
  );
}

/** Highlights as boards on the left wall, in two rows. */
function HighlightWall({
  items,
  accent,
  title,
}: {
  items: string[];
  accent: string;
  title: string;
}) {
  const shown = items.slice(0, 6);
  const perRow = Math.max(1, Math.ceil(shown.length / 2));
  const span = D - 4;
  const step = span / perRow;
  return (
    <group>
      <Text font={TEXT_FONT}
        position={[-W / 2 + 0.02, 4.55, 0]}
        rotation-y={Math.PI / 2}
        fontSize={0.32}
        color={INK}
        anchorX="center"
      >
        {title}
      </Text>
      {shown.map((h, i) => {
        const row = Math.floor(i / perRow);
        const col = i % perRow;
        const z = -span / 2 + step * (col + 0.5);
        return (
          <Board
            key={i}
            position={[-W / 2 + 0.06, row === 0 ? 3.35 : 1.55, z]}
            rotationY={Math.PI / 2}
            width={step - 0.5}
            height={1.5}
            body={h}
            accent={accent}
          />
        );
      })}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Office (a job) and studio (a project)
// ---------------------------------------------------------------------------

const monthYear = (m: string | null) => {
  if (!m) return "now";
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1).toLocaleString("en", {
    month: "short",
    year: "numeric",
  });
};

function Office({ job, accent }: { job: Experience; accent: string }) {
  // Sahme Trading builds trading platforms: its office is a trading floor.
  const trading = job.id === "sahme";
  const seats = useMemo<Seat[]>(
    () =>
      [-5, 0, 5].flatMap((x) =>
        [-3, 1].map((z) => ({
          id: `desk-${x}-${z}`,
          x,
          y: 0,
          z: z + 0.95,
          facing: Math.PI,
        })),
      ),
    [],
  );
  return (
    <group>
      {/* The company wall */}
      <OnWall side="back">
        <group position={[0, 0, -D / 2 + 0.02]}>
          <mesh position={[0, 3.1, 0]}>
            <planeGeometry args={[14, 3.4]} />
            <meshStandardMaterial color="#2d1f52" />
          </mesh>
          <mesh position={[0, 4.75, 0.01]}>
            <planeGeometry args={[14, 0.1]} />
            <meshStandardMaterial
              color={accent}
              emissive={accent}
              emissiveIntensity={0.8}
            />
          </mesh>
          <Text font={TEXT_FONT}
            position={[0, 4.25, 0.02]}
            fontSize={0.62}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
          >
            {job.company}
          </Text>
          {job.formerName && (
            <Text font={TEXT_FONT}
              position={[0, 3.78, 0.02]}
              fontSize={0.2}
              color="#d6bcfa"
              anchorX="center"
            >
              {`formerly ${job.formerName}`}
            </Text>
          )}
          {job.roles.map((r, i) => (
            <Text font={TEXT_FONT}
              key={r.title}
              position={[0, 3.35 - i * 0.36, 0.02]}
              fontSize={0.24}
              color={i === 0 ? accents.gold : "#e9d8fd"}
              anchorX="center"
            >
              {`${r.title} · ${monthYear(r.start)} – ${monthYear(r.end)}`}
            </Text>
          ))}
          <Text font={TEXT_FONT}
            position={[0, 2.35 - job.roles.length * 0.18, 0.02]}
            fontSize={0.2}
            color="#f5f0ff"
            anchorX="center"
            maxWidth={12.5}
            textAlign="center"
            lineHeight={1.35}
          >
            {`${job.summary}\n${job.location}${job.remote ? " · remote" : ""} · ${job.type}`}
          </Text>
          {/* Sideboard under the wall */}
          <mesh position={[0, 0.45, 0.45]} castShadow receiveShadow>
            <boxGeometry args={[10, 0.9, 0.8]} />
            <meshStandardMaterial color="#5b4a8a" />
          </mesh>
        </group>
      </OnWall>

      <OnWall side="left">
        <HighlightWall
          items={job.highlights}
          accent={accent}
          title="What I do here"
        />
      </OnWall>
      <OnWall side="right">
        <TechTiles
          tech={job.tech}
          position={[W / 2 - 0.05, 0.5, 0]}
          rotationY={-Math.PI / 2}
          length={D - 4}
        />
      </OnWall>

      {/* Desks with monitors and chairs */}
      {[-5, 0, 5].flatMap((x) =>
        [-3, 1].map((z) =>
          trading ? (
            <TradingDesk key={`${x}${z}`} x={x} z={z} seed={x * 3 + z + 20} duck={x === 5 && z === 1} />
          ) : (
            <Desk key={`${x}${z}`} x={x} z={z} accent={accent} />
          ),
        ),
      )}
      <Seats seats={seats} />

      {/* Reception desk by the entrance */}
      <group position={[-7.5, 0, D / 2 - 2.4]}>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[1.8, 0.55, 0.45]} position={[0, 0.55, 0]} />
        </RigidBody>
        <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.6, 1.1, 0.9]} />
          <meshStandardMaterial color="#f5f0ff" />
        </mesh>
        <mesh position={[0, 0.55, 0.46]}>
          <planeGeometry args={[3.6, 0.3]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={0.6}
          />
        </mesh>
        <Text font={TEXT_FONT}
          position={[0, 0.55, 0.47]}
          fontSize={0.18}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
        >
          {job.company}
        </Text>
      </group>

      {trading && <TradingFloor wall={(side, node) => <OnWall side={side}>{node}</OnWall>} />}

      {job.plaque && (
        <OnWall side="front">
          <Plaque text={job.plaque} />
        </OnWall>
      )}
    </group>
  );
}

function Desk({ x, z, accent }: { x: number; z: number; accent: string }) {
  const screen = useGlowMaterial(accent, 0.7, 1.4, "#140d2e");
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.9, 0.38, 0.42]} position={[0, 0.38, 0]} />
      </RigidBody>
      <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.8, 0.06, 0.85]} />
        <meshStandardMaterial color="#e9dcc6" roughness={0.6} />
      </mesh>
      {[-0.8, 0.8].map((lx) => (
        <mesh key={lx} position={[lx, 0.36, 0]} castShadow>
          <boxGeometry args={[0.06, 0.72, 0.75]} />
          <meshStandardMaterial color="#3b2d63" />
        </mesh>
      ))}
      {/* Monitor, keyboard and a mug */}
      <mesh position={[0, 1.12, -0.28]} material={screen} castShadow>
        <boxGeometry args={[0.95, 0.56, 0.04]} />
      </mesh>
      {[0.2, 0.32, 0.44].map((y, i) => (
        <mesh key={y} position={[-0.25 + i * 0.08, 0.98 + y * 0.6, -0.255]}>
          <planeGeometry args={[0.5 - i * 0.12, 0.035]} />
          <meshBasicMaterial
            color={i === 1 ? accents.gold : "#e9d8fd"}
            toneMapped={false}
          />
        </mesh>
      ))}
      <mesh position={[0, 0.82, -0.28]}>
        <boxGeometry args={[0.06, 0.16, 0.06]} />
        <meshStandardMaterial color="#2d1f52" />
      </mesh>
      <mesh position={[0, 0.78, 0.08]}>
        <boxGeometry args={[0.6, 0.02, 0.2]} />
        <meshStandardMaterial color="#2d1f52" />
      </mesh>
      <mesh position={[0.6, 0.83, 0.05]}>
        <cylinderGeometry args={[0.05, 0.05, 0.12, 12]} />
        <meshStandardMaterial color={accents.mint} />
      </mesh>
      {/* Chair */}
      <group position={[0, 0, 0.95]}>
        <mesh position={[0, 0.46, 0]} castShadow>
          <boxGeometry args={[0.55, 0.08, 0.55]} />
          <meshStandardMaterial color="#4c3a7a" />
        </mesh>
        <mesh position={[0, 0.82, 0.26]} castShadow>
          <boxGeometry args={[0.55, 0.65, 0.07]} />
          <meshStandardMaterial color="#4c3a7a" />
        </mesh>
        <mesh position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.44, 8]} />
          <meshStandardMaterial color="#2d1f52" />
        </mesh>
      </group>
    </group>
  );
}

function Plaque({ text }: { text: string }) {
  return (
    <group position={[-3.2, 2.2, D / 2 - 0.04]} rotation-y={Math.PI}>
      <mesh position={[0, 0, -0.02]}>
        <boxGeometry args={[2.6, 0.7, 0.04]} />
        <meshStandardMaterial
          color={accents.goldDeep}
          metalness={0.6}
          roughness={0.3}
        />
      </mesh>
      <Text font={TEXT_FONT}
        position={[0, 0, 0.01]}
        fontSize={0.16}
        color={INK}
        anchorX="center"
        anchorY="middle"
        maxWidth={2.3}
        textAlign="center"
      >
        {text}
      </Text>
    </group>
  );
}

function Studio({ project, accent }: { project: Project; accent: string }) {
  const screen = useGlowMaterial(accent, 0.25, 0.5, "#140d2e");
  const signature = useMemo(
    () => signatureFor(project.id, project.name),
    [project.id, project.name],
  );
  const seats = useMemo<Seat[]>(
    () =>
      [-3.4, 3.4].flatMap((x) =>
        [-0.6, 0.6].map((dx) => ({
          id: `sofa-${x}-${dx}`,
          x: x + dx,
          y: 0,
          z: 2.6,
          facing: Math.PI,
        })),
      ),
    [],
  );
  return (
    <group>
      {/* The big screen */}
      <OnWall side="back">
        <group position={[0, 0, -D / 2 + 0.05]}>
          <mesh position={[0, 3, 0]} material={screen}>
            <boxGeometry args={[15, 3.6, 0.08]} />
          </mesh>
          <Text font={TEXT_FONT}
            position={[0, 4.15, 0.06]}
            fontSize={0.7}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
          >
            {project.name}
          </Text>
          <Text font={TEXT_FONT}
            position={[0, 3.45, 0.06]}
            fontSize={0.28}
            color={accents.honey}
            anchorX="center"
            maxWidth={13.5}
            textAlign="center"
          >
            {project.pitch}
          </Text>
          <Text font={TEXT_FONT}
            position={[0, 2.55, 0.06]}
            fontSize={0.2}
            color="#e9d8fd"
            anchorX="center"
            maxWidth={13.5}
            textAlign="center"
            lineHeight={1.4}
          >
            {`${project.role}\n${project.kind} · ${project.category} · ${project.year} · ${project.status}`}
          </Text>
        </group>
      </OnWall>

      {/* Pedestal with the project's emblem floating above it */}
      <group position={[0, 0, -3.6]}>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[1.1, 0.4, 1.1]} position={[0, 0.4, 0]} />
        </RigidBody>
        <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[1.1, 1.25, 0.8, 32]} />
          <meshStandardMaterial color="#2d1f52" />
        </mesh>
        <mesh position={[0, 0.81, 0]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[0.7, 0.95, 40]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={1.2}
            toneMapped={false}
          />
        </mesh>
        {signature && <Emblem signature={signature} y={2.2} scale={0.9} />}
      </group>

      {/* Story on the left wall, tech on the right */}
      <OnWall side="left">
        <HighlightWall
          items={[...project.description, ...project.highlights]}
          accent={accent}
          title="About the project"
        />
      </OnWall>
      <OnWall side="right">
        <TechTiles
          tech={project.tech}
          position={[W / 2 - 0.05, 0.5, 0]}
          rotationY={-Math.PI / 2}
          length={D - 4}
        />
      </OnWall>

      {/* Two sofas facing the screen, with a coffee table */}
      {[-3.4, 3.4].map((x) => (
        <group key={x} position={[x, 0, 2.6]}>
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider args={[1.3, 0.3, 0.2]} position={[0, 0.6, 0.45]} />
          </RigidBody>
          <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.6, 0.5, 0.9]} />
            <meshStandardMaterial color="#6b46c1" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.7, 0.42]} castShadow>
            <boxGeometry args={[2.6, 0.8, 0.22]} />
            <meshStandardMaterial color="#6b46c1" roughness={0.9} />
          </mesh>
          {[-1.25, 1.25].map((ax) => (
            <mesh key={ax} position={[ax, 0.45, 0]} castShadow>
              <boxGeometry args={[0.2, 0.5, 0.9]} />
              <meshStandardMaterial color="#553c9a" roughness={0.9} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, 0.3, 1.2]} castShadow receiveShadow>
        <cylinderGeometry args={[0.8, 0.8, 0.08, 28]} />
        <meshStandardMaterial color="#e9dcc6" />
      </mesh>
      <Seats seats={seats} />

      {project.plaque && (
        <OnWall side="front">
          <Plaque text={project.plaque} />
        </OnWall>
      )}
    </group>
  );
}
