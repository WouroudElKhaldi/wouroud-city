"use client";

import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { worldEnv } from "@/world/env";
import type { BuildingSpec } from "@/world/layout";
import { accents, palette } from "@/world/palette";
import { signatureFor, type TowerShape } from "@/world/signatures";
import { Emblem } from "./Emblems";
import { DistrictProps, Roof, roofHeight, styleFor, tinted } from "./Architecture";
import { useFacade, useGlowMaterial } from "./materials";

import { DARK, FLOOR, STONE } from "./buildingTheme";
import { TEXT_FONT } from "@/world/fonts";

export { DARK, FLOOR, STONE };

// ---------------------------------------------------------------------------
// Building
// ---------------------------------------------------------------------------

/**
 * A data-driven building. Footprint, height and color come from the layout;
 * the variant picks the architecture (HQ tower, studio, low-rise, workshop, skill tower).
 */
export function Building({ spec: raw }: { spec: BuildingSpec }) {
  const signature = useMemo(() => signatureFor(raw.id, raw.label), [raw.id, raw.label]);
  const style = useMemo(() => styleFor(raw), [raw]);
  // The district style tints the body toward the item's brand color and may put a pitched roof on top.
  const spec = useMemo(
    () => ({ ...raw, color: tinted(raw.color, signature?.accent, style.tint), pitched: style.roof !== "flat" }),
    [raw, signature, style],
  );
  const { width, depth, height } = spec;
  const roofH = roofHeight(style.roof, width, depth);
  const emblemY = height + roofH + (spec.variant === "tower" ? 4.6 : spec.variant === "hq" ? 4 : 3.2);
  const emblemScale = spec.variant === "tower" ? 2.3 : Math.min(4, Math.max(1.6, Math.min(width, depth) * 0.3));
  return (
    <group position={[spec.x, 0, spec.z]} rotation-y={spec.rotY}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[width / 2 + 0.3, height / 2, depth / 2 + 0.3]} position={[0, height / 2, 0]} />
      </RigidBody>
      {/* Stone plinth */}
      <mesh position={[0, 0.2, 0]} receiveShadow castShadow>
        <boxGeometry args={[width + 0.6, 0.4, depth + 0.6]} />
        <meshStandardMaterial color={STONE} roughness={0.85} />
      </mesh>
      {spec.variant === "hq" && <HqBuilding spec={spec} />}
      {spec.variant === "studio" && <StudioBuilding spec={spec} />}
      {spec.variant === "lowrise" && <LowriseBuilding spec={spec} />}
      {spec.variant === "workshop" && <WorkshopBuilding spec={spec} />}
      {spec.variant === "tower" && <SkillTower spec={spec} shape={signature?.shape ?? "box"} accent={signature?.accent} />}
      <Entrance spec={spec} />
      <Roof kind={style.roof} width={width} depth={depth} y={height + 0.3} color={style.roofColor} />
      <DistrictProps kind={style.props} spec={spec} accent={signature?.accent ?? accents.gold} />
      {signature && spec.variant !== "tower" && <AccentBand width={width} depth={depth} y={height - 0.25} color={tinted(signature.accent, "#ffffff", 0.55)} />}
      {signature && <Emblem signature={signature} y={emblemY} scale={emblemScale} />}
    </group>
  );
}

function seedOf(spec: BuildingSpec) {
  return Math.abs(spec.x * 0.37 + spec.z * 0.61);
}

function Box({
  size,
  position,
  material,
  color,
}: {
  size: [number, number, number];
  position: [number, number, number];
  material?: THREE.Material;
  color?: string;
}) {
  return (
    <mesh position={position} material={material} castShadow receiveShadow>
      <boxGeometry args={size} />
      {!material && <meshStandardMaterial color={color ?? DARK} roughness={0.7} />}
    </mesh>
  );
}

/** Full-time job: lobby podium, main tower, setback crown, neon corner strips, antenna. */
function HqBuilding({ spec }: { spec: BuildingSpec }) {
  const { width, depth, height, floors, color, facing } = spec;
  const towerFloors = Math.max(2, Math.round((floors - 1) * 0.72));
  const crownFloors = Math.max(1, floors - 1 - towerFloors);
  const tw = width * 0.8;
  const cw = width * 0.58;
  const podiumTop = FLOOR + 0.4;
  const towerTop = podiumTop + towerFloors * FLOOR;
  const seed = seedOf(spec);

  const towerMat = useFacade(color, tw, towerFloors, seed, true);
  const crownMat = useFacade(color, cw, crownFloors, seed + 0.3, true);
  const lobbyMat = useGlowMaterial(palette.lampLight, 0.15, 1.4, "#2a1f55");
  const neon = useGlowMaterial(spec.crown ? palette.magenta : palette.neon, 0.6, 3);

  return (
    <group>
      {/* Podium with a glass lobby */}
      <Box size={[width, FLOOR, depth]} position={[0, 0.4 + FLOOR / 2, 0]} material={lobbyMat} />
      <Box size={[width + 0.3, 0.35, depth + 0.3]} position={[0, podiumTop, 0]} color={STONE} />
      {/* Tower */}
      <Box size={[tw, towerFloors * FLOOR, depth * 0.8]} position={[0, podiumTop + (towerFloors * FLOOR) / 2, 0]} material={towerMat} />
      <Box size={[tw + 0.3, 0.3, depth * 0.8 + 0.3]} position={[0, towerTop, 0]} color={STONE} />
      {/* Setback crown */}
      <Box size={[cw, crownFloors * FLOOR, depth * 0.58]} position={[0, towerTop + (crownFloors * FLOOR) / 2, 0]} material={crownMat} />
      <Box size={[cw + 0.3, 0.4, depth * 0.58 + 0.3]} position={[0, height + 0.2, 0]} color={DARK} />
      {/* Neon strips running up the street-facing corners */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[(facing * tw) / 2, podiumTop + (towerFloors * FLOOR) / 2, (side * depth * 0.8) / 2]}
          material={neon}
        >
          <boxGeometry args={[0.18, towerFloors * FLOOR, 0.18]} />
        </mesh>
      ))}
      <Antenna position={[cw * 0.25, height + 0.4, 0]} tall={4.5} />
      <RooftopUnits width={cw} depth={depth * 0.58} y={height + 0.4} count={2} />
      {spec.crown && spec.filler && <Crown y={height + 6.4} size={Math.min(width, depth) * 0.16} material={neon} />}
    </group>
  );
}

/** Freelance: a mid-rise studio with balcony bands and a rooftop garden. */
function StudioBuilding({ spec }: { spec: BuildingSpec }) {
  const { width, depth, height, floors, color, facing } = spec;
  const bodyMat = useFacade(color, width, floors, seedOf(spec));
  const balconyGlow = useGlowMaterial(palette.neon, 0.2, 1.6, "#f3e8ff");
  return (
    <group>
      <Box size={[width, height - 0.4, depth]} position={[0, 0.4 + (height - 0.4) / 2, 0]} material={bodyMat} />
      {/* Balconies every other floor on the street side */}
      {Array.from({ length: Math.floor(floors / 2) }, (_, i) => {
        const y = 0.4 + (i * 2 + 2) * FLOOR - 0.2;
        return (
          <group key={i} position={[(facing * width) / 2 + facing * 0.55, y, 0]}>
            <Box size={[1.1, 0.18, depth * 0.85]} position={[0, 0, 0]} color="#f3e8ff" />
            <mesh position={[facing * 0.53, 0.45, 0]} material={balconyGlow}>
              <boxGeometry args={[0.05, 0.9, depth * 0.85]} />
            </mesh>
          </group>
        );
      })}
      <Box size={[width + 0.3, 0.5, depth + 0.3]} position={[0, height + 0.05, 0]} color={DARK} />
      {!spec.pitched && <RooftopGarden width={width} depth={depth} y={height + 0.3} />}
    </group>
  );
}

/** Internship / volunteer: a friendly low-rise with an awning and rooftop units. */
function LowriseBuilding({ spec }: { spec: BuildingSpec }) {
  const { width, depth, height, floors, color } = spec;
  const bodyMat = useFacade(color, width, floors, seedOf(spec));
  return (
    <group>
      <Box size={[width, height - 0.4, depth]} position={[0, 0.4 + (height - 0.4) / 2, 0]} material={bodyMat} />
      <Box size={[width + 0.4, 0.6, depth + 0.4]} position={[0, height + 0.1, 0]} color={DARK} />
      {!spec.pitched && <RooftopUnits width={width} depth={depth} y={height + 0.4} count={3} tank />}
    </group>
  );
}

/** Bootcamp: a workshop with a sawtooth roof of glowing skylights. */
function WorkshopBuilding({ spec }: { spec: BuildingSpec }) {
  const { width, depth, height, floors, color } = spec;
  const bodyMat = useFacade(color, width, floors, seedOf(spec));
  const skylight = useGlowMaterial("#c4b5fd", 0.25, 2.2, "#c7d2fe");
  const teeth = 4;
  const toothDepth = depth / teeth;
  return (
    <group>
      <Box size={[width, height - 0.4, depth]} position={[0, 0.4 + (height - 0.4) / 2, 0]} material={bodyMat} />
      {Array.from({ length: teeth }, (_, i) => {
        const z = -depth / 2 + toothDepth * (i + 0.5);
        return (
          <group key={i} position={[0, height, z]}>
            {/* A right-triangle prism: the sloped back plus a glazed vertical face */}
            <mesh rotation={[0, Math.PI / 2, 0]} position={[0, 0, 0]} castShadow>
              <cylinderGeometry args={[toothDepth * 0.58, toothDepth * 0.58, width, 3, 1]} />
              <meshStandardMaterial color={DARK} roughness={0.6} flatShading />
            </mesh>
            <mesh position={[0, toothDepth * 0.25, toothDepth * 0.29]} rotation={[-0.5, 0, 0]} material={skylight}>
              <planeGeometry args={[width * 0.94, toothDepth * 0.42]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** Skill: a glass tower with glowing edges, a rotating level ring and, for top skills, a spire. */
function SkillTower({ spec, shape, accent }: { spec: BuildingSpec; shape: TowerShape; accent?: string }) {
  const { width, depth, height, floors, color } = spec;
  const bodyMat = useFacade(color, width, floors, seedOf(spec), true);
  const edge = accent ?? (spec.crown ? palette.magenta : "#c4b5fd");
  const neon = useGlowMaterial(edge, 0.5, 3);
  const ring = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (ring.current) ring.current.rotation.y += delta * 0.5;
  });
  const bodyH = height - 0.4;
  const r = Math.min(width, depth) / 2;
  return (
    <group>
      {shape === "box" && (
        <>
          <Box size={[width, bodyH, depth]} position={[0, 0.4 + bodyH / 2, 0]} material={bodyMat} />
          <EdgeGlow width={width + 0.02} height={bodyH} depth={depth + 0.02} y={0.4 + bodyH / 2} color={edge} />
        </>
      )}
      {(shape === "cylinder" || shape === "hex" || shape === "tapered") && (
        <mesh position={[0, 0.4 + bodyH / 2, 0]} material={bodyMat} castShadow receiveShadow rotation-y={shape === "hex" ? Math.PI / 6 : 0}>
          <cylinderGeometry
            args={[shape === "tapered" ? r * 0.62 : r, shape === "hex" ? r * 1.05 : r, bodyH, shape === "cylinder" ? 28 : shape === "hex" ? 6 : 4]}
          />
        </mesh>
      )}
      {shape === "stepped" &&
        [1, 0.78, 0.56].map((k, i) => {
          const h = bodyH / 3;
          return <Box key={k} size={[width * k, h, depth * k]} position={[0, 0.4 + h * i + h / 2, 0]} material={bodyMat} />;
        })}
      {shape === "twisted" &&
        Array.from({ length: Math.max(3, floors) }, (_, i) => {
          const n = Math.max(3, floors);
          const h = bodyH / n;
          return (
            <mesh key={i} position={[0, 0.4 + h * i + h / 2, 0]} rotation-y={(i / n) * (Math.PI / 2)} material={bodyMat} castShadow>
              <boxGeometry args={[width * 0.9, h * 0.94, depth * 0.9]} />
            </mesh>
          );
        })}
      {/* Glowing collar in the skill's brand color */}
      {shape !== "box" && (
        <mesh position={[0, height - 0.1, 0]} material={neon}>
          <cylinderGeometry args={[r * (shape === "tapered" || shape === "stepped" ? 0.66 : 1.02), r * (shape === "tapered" || shape === "stepped" ? 0.66 : 1.02), 0.25, shape === "hex" ? 6 : 28]} />
        </mesh>
      )}
      {shape === "box" && <Box size={[width + 0.25, 0.3, depth + 0.25]} position={[0, height + 0.15, 0]} color={DARK} />}
      <group ref={ring} position={[0, height + 1.6, 0]}>
        <mesh rotation-x={Math.PI / 2} material={neon}>
          <torusGeometry args={[width * 0.42, 0.07, 8, 40]} />
        </mesh>
        {spec.badge &&
          [0, Math.PI].map((r) => (
            <Text font={TEXT_FONT}
              key={r}
              rotation-y={r}
              position={[Math.sin(r) * 0.01, 0, Math.cos(r) * 0.01]}
              fontSize={1.1}
              anchorX="center"
              anchorY="middle"
              material={neon}
            >
              {spec.badge}
            </Text>
          ))}
      </group>
      {spec.crown && !accent && (
        <mesh position={[0, height + 4.2, 0]} material={neon}>
          <coneGeometry args={[0.35, 3, 6]} />
        </mesh>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Details shared by several variants
// ---------------------------------------------------------------------------

/** Doorway, canopy with a glow strip, and the neon name sign facing the street. */
function Entrance({ spec }: { spec: BuildingSpec }) {
  const { width, depth, facing } = spec;
  const front = (facing * width) / 2;
  const rot = facing === 1 ? Math.PI / 2 : -Math.PI / 2;
  const doorWidth = Math.min(3.2, depth * 0.45);
  const signMat = useGlowMaterial(spec.crown ? palette.magenta : palette.neon, 0.35, 2.6);
  const doorMat = useGlowMaterial(palette.lampLight, 0.1, 1.2, "#2a1f55");
  const isTower = spec.variant === "tower";
  const signY = isTower ? 3.2 : 4.4;

  return (
    <group>
      {/* Door with warm light behind the glass */}
      <mesh position={[front + facing * 0.03, 0.4 + 1.25, 0]} rotation-y={rot} material={doorMat}>
        <planeGeometry args={[doorWidth, 2.5]} />
      </mesh>
      {/* Canopy */}
      <Box size={[1.6, 0.16, doorWidth + 1.2]} position={[front + facing * 0.8, 3.15, 0]} color={DARK} />
      <mesh position={[front + facing * 1.6, 3.15, 0]} material={signMat}>
        <boxGeometry args={[0.06, 0.1, doorWidth + 1.2]} />
      </mesh>
      {/* Name sign */}
      <group position={[front + facing * 0.06, signY, 0]} rotation-y={rot}>
        <Text font={TEXT_FONT}
          fontSize={Math.min(isTower ? 0.6 : 1.05, ((depth * 0.92) / Math.max(5, spec.label.length)) * 1.7)}
          maxWidth={depth * 0.95}
          anchorX="center"
          anchorY="bottom"
          textAlign="center"
          material={signMat}
          outlineWidth={0.025}
          outlineColor="#1a103d"
        >
          {spec.label}
        </Text>
        <Text font={TEXT_FONT}
          position={[0, -0.18, 0]}
          fontSize={isTower ? 0.26 : 0.36}
          maxWidth={depth * 0.95}
          anchorX="center"
          anchorY="top"
          textAlign="center"
          color="#ffffff"
          outlineWidth={0.02}
          outlineColor="#1a103d"
        >
          {spec.sublabel}
        </Text>
      </group>
    </group>
  );
}

/** Glowing outline on every edge of a box, brighter at night. */
export function EdgeGlow({ width, height, depth, y, color }: { width: number; height: number; depth: number; y: number; color: string }) {
  const geometry = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(width, height, depth)), [width, height, depth]);
  const material = useMemo(
    () => new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35, toneMapped: false }),
    [color],
  );
  useFrame(() => {
    material.opacity = 0.35 + worldEnv.night * 0.65;
  });
  return <lineSegments geometry={geometry} material={material} position={[0, y, 0]} />;
}

export function Antenna({ position, tall }: { position: [number, number, number]; tall: number }) {
  const light = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (light.current) light.current.emissiveIntensity = Math.sin(clock.elapsedTime * 3) > 0.6 ? 4 : 0.3;
  });
  return (
    <group position={position}>
      <mesh position={[0, tall / 2, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.12, tall, 6]} />
        <meshStandardMaterial color="#d6bcfa" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, tall + 0.1, 0]}>
        <sphereGeometry args={[0.16, 10, 10]} />
        <meshStandardMaterial ref={light} color="#ff4d6d" emissive="#ff1744" emissiveIntensity={1} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Crown({ y, size, material }: { y: number; size: number; material: THREE.Material }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.6;
  });
  return (
    <mesh ref={ref} position={[0, y, 0]} material={material}>
      <octahedronGeometry args={[size, 0]} />
    </mesh>
  );
}

function RooftopUnits({ width, depth, y, count, tank }: { width: number; depth: number; y: number; count: number; tank?: boolean }) {
  return (
    <group position={[0, y, 0]}>
      {Array.from({ length: count }, (_, i) => (
        <group key={i} position={[-width * 0.25 + (i % 2) * width * 0.3, 0.4, -depth * 0.2 + i * depth * 0.18]}>
          <Box size={[1.4, 0.8, 1]} position={[0, 0, 0]} color="#cbd5e1" />
          <mesh position={[0, 0.41, 0]} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[0.32, 16]} />
            <meshStandardMaterial color="#475569" />
          </mesh>
        </group>
      ))}
      {tank && (
        <group position={[width * 0.28, 0, depth * 0.22]}>
          {[-0.5, 0.5].map((dx) =>
            [-0.5, 0.5].map((dz) => (
              <mesh key={`${dx}${dz}`} position={[dx, 0.7, dz]}>
                <cylinderGeometry args={[0.05, 0.05, 1.4, 5]} />
                <meshStandardMaterial color={DARK} />
              </mesh>
            )),
          )}
          <mesh position={[0, 2, 0]} castShadow>
            <cylinderGeometry args={[0.9, 0.9, 1.4, 14]} />
            <meshStandardMaterial color="#8b6fc4" roughness={0.8} />
          </mesh>
          <mesh position={[0, 2.9, 0]} castShadow>
            <coneGeometry args={[0.95, 0.5, 14]} />
            <meshStandardMaterial color={DARK} />
          </mesh>
        </group>
      )}
    </group>
  );
}

function RooftopGarden({ width, depth, y }: { width: number; depth: number; y: number }) {
  const spots: [number, number, string][] = [
    [-width * 0.28, -depth * 0.25, palette.foliage[0]],
    [width * 0.2, -depth * 0.3, palette.foliage[1]],
    [-width * 0.1, depth * 0.25, palette.foliage[3]],
  ];
  return (
    <group position={[0, y, 0]}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]} receiveShadow>
        <planeGeometry args={[width * 0.9, depth * 0.9]} />
        <meshStandardMaterial color="#8fb98a" roughness={1} />
      </mesh>
      {spots.map(([x, z, c]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <mesh position={[0, 0.35, 0]}>
            <cylinderGeometry args={[0.1, 0.14, 0.7, 6]} />
            <meshStandardMaterial color={palette.trunk} />
          </mesh>
          <mesh position={[0, 1.15, 0]} castShadow>
            <icosahedronGeometry args={[0.75, 0]} />
            <meshStandardMaterial color={c} flatShading />
          </mesh>
        </group>
      ))}
      {/* Pergola */}
      <group position={[width * 0.22, 0, depth * 0.2]}>
        {[
          [-0.9, -0.7],
          [0.9, -0.7],
          [-0.9, 0.7],
          [0.9, 0.7],
        ].map(([px, pz]) => (
          <mesh key={`${px}${pz}`} position={[px, 1, pz]}>
            <boxGeometry args={[0.12, 2, 0.12]} />
            <meshStandardMaterial color="#f3e8ff" />
          </mesh>
        ))}
        <mesh position={[0, 2.05, 0]} castShadow>
          <boxGeometry args={[2.1, 0.1, 1.7]} />
          <meshStandardMaterial color="#f3e8ff" />
        </mesh>
      </group>
    </group>
  );
}

/** A glowing band in the item's brand color just under the roof line. */
function AccentBand({ width, depth, y, color }: { width: number; depth: number; y: number; color: string }) {
  const glow = useGlowMaterial(color, 0.5, 2.4, color);
  const t = 0.22;
  return (
    <group position={[0, y, 0]}>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[(s * (width + t)) / 2, 0, 0]} material={glow}>
            <boxGeometry args={[t, 0.3, depth + t * 2]} />
          </mesh>
          <mesh position={[0, 0, (s * (depth + t)) / 2]} material={glow}>
            <boxGeometry args={[width, 0.3, t]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
