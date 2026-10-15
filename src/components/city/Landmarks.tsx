"use client";

import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { CylinderCollider, RigidBody, RoundCylinderCollider } from "@react-three/rapier";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { type DistrictDef, HUB } from "@/world/districts";
import { Antenna, DARK, EdgeGlow, STONE } from "./Building";
import { useFacade, useGlowMaterial } from "./materials";
import { Portal } from "./Portal";
import { useCityStore } from "@/state/useCityStore";
import { TEXT_FONT } from "@/world/fonts";

/**
 * One landmark per district, standing on the ring around Central Plaza.
 * Local space: the platform is centered on the origin and the door faces +z (toward the plaza).
 */
export function Landmark({ district }: { district: DistrictDef }) {
  const Model = MODELS[district.id];
  const goTo = useCityStore((s) => s.goTo);
  return (
    <group>
      <Platform district={district} />
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[8, 6.4]} position={[0, 8, -0.8]} />
        {/* The platform you stand on; rounded edges let you step up without jumping. */}
        <RoundCylinderCollider args={[0.1, HUB.landmarkRadius - 0.2, 0.2]} position={[0, 0.1, 0]} />
      </RigidBody>
      <Model district={district} />
      <Portal
        id={`enter-${district.id}`}
        prompt={`Enter ${district.name}`}
        onEnter={() => goTo(district.id)}
        label={`Enter ${district.name}`}
        color={district.accent}
        position={[0, 0.4, 6.4]}
      />
      <NameArch district={district} />
    </group>
  );
}

function Platform({ district }: { district: DistrictDef }) {
  const ring = useGlowMaterial(district.accent, 0.4, 2.4);
  const r = HUB.landmarkRadius;
  return (
    <group>
      <mesh position={[0, 0.2, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[r, r + 0.4, 0.4, 64]} />
        <meshStandardMaterial color={STONE} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.41, 0]} rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[r - 0.6, 64]} />
        <meshStandardMaterial color="#e6dcfa" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.42, 0]} rotation-x={-Math.PI / 2} material={ring}>
        <ringGeometry args={[r - 0.9, r - 0.6, 96]} />
      </mesh>
    </group>
  );
}

/** The district's name on an arch over the approach road. */
function NameArch({ district }: { district: DistrictDef }) {
  const glow = useGlowMaterial(district.accent, 0.5, 2.6);
  const z = HUB.landmarkRadius + 2.5;
  return (
    <group position={[0, 0, z]}>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 4.6, 3, 0]} castShadow>
          <boxGeometry args={[0.45, 6, 0.45]} />
          <meshStandardMaterial color={district.color} />
        </mesh>
      ))}
      <mesh position={[0, 6.1, 0]} castShadow>
        <boxGeometry args={[9.8, 1.6, 0.4]} />
        <meshStandardMaterial color={DARK} />
      </mesh>
      <mesh position={[0, 5.25, 0.22]} material={glow}>
        <boxGeometry args={[9.6, 0.08, 0.04]} />
      </mesh>
      {[0.21, -0.21].map((dz) => (
        <group key={dz} position={[0, 0, dz]} rotation-y={dz > 0 ? 0 : Math.PI}>
          <Text font={TEXT_FONT} position={[0, 6.35, 0]} fontSize={0.6} material={glow} anchorX="center" anchorY="middle">
            {district.name}
          </Text>
          <Text font={TEXT_FONT} position={[0, 5.75, 0]} fontSize={0.3} color="#e9d8fd" anchorX="center" anchorY="middle">
            {district.tagline}
          </Text>
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

type ModelProps = { district: DistrictDef };

function Solid({
  args,
  position,
  rotation,
  color,
  material,
  metal,
}: {
  args: [number, number, number];
  position: [number, number, number];
  rotation?: [number, number, number];
  color?: string;
  material?: THREE.Material;
  metal?: boolean;
}) {
  return (
    <mesh position={position} rotation={rotation} material={material} castShadow receiveShadow>
      <boxGeometry args={args} />
      {!material && <meshStandardMaterial color={color ?? DARK} metalness={metal ? 0.6 : 0.1} roughness={metal ? 0.3 : 0.7} />}
    </mesh>
  );
}

function Spin({ speed, axis = "y", children, ...props }: { speed: number; axis?: "x" | "y" | "z"; children: React.ReactNode } & React.ComponentProps<"group">) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation[axis] += delta * speed;
  });
  return (
    <group ref={ref} {...props}>
      {children}
    </group>
  );
}

function Bob({ children, amount = 0.3, speed = 1.2, ...props }: { children: React.ReactNode; amount?: number; speed?: number } & React.ComponentProps<"group">) {
  const ref = useRef<THREE.Group>(null);
  const base = (props.position as [number, number, number] | undefined)?.[1] ?? 0;
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = base + Math.sin(clock.elapsedTime * speed) * amount;
  });
  return (
    <group ref={ref} {...props}>
      {children}
    </group>
  );
}

/** Business District: a miniature skyline of glass towers on a podium. */
function BusinessModel({ district }: ModelProps) {
  const t1 = useFacade(district.color, 5, 8, 0.1, true);
  const t2 = useFacade("#553c9a", 6, 11, 0.4, true);
  const t3 = useFacade("#805ad5", 5, 6, 0.7, true);
  const neon = useGlowMaterial(district.accent, 0.6, 3);
  return (
    <group position={[0, 0.4, -1.5]}>
      <Solid args={[15, 2.4, 9]} position={[0, 1.2, 0]} color={STONE} />
      <Solid args={[5, 25.6, 5]} position={[-5, 2.4 + 12.8, -0.5]} material={t1} />
      <Solid args={[6, 35.2, 6]} position={[0.5, 2.4 + 17.6, -1]} material={t2} />
      <Solid args={[5, 19.2, 5]} position={[5.5, 2.4 + 9.6, 0]} material={t3} />
      <EdgeGlow width={6.05} height={35.2} depth={6.05} y={2.4 + 17.6} color={district.accent} />
      <mesh position={[0.5, 38.4, -1]} material={neon}>
        <boxGeometry args={[6.2, 0.3, 6.2]} />
      </mesh>
      <group position={[0.5, 37.8, -1]}>
        <Antenna position={[0, 0.8, 0]} tall={5} />
      </group>
      {/* A stylised briefcase on the podium roof */}
      <group position={[-1.5, 3.2, 3]}>
        <Solid args={[2.2, 1.5, 0.7]} position={[0, 0.75, 0]} color="#6b4a3a" />
        <mesh position={[0, 1.65, 0]}>
          <torusGeometry args={[0.35, 0.08, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#2a1a12" />
        </mesh>
      </group>
    </group>
  );
}

/** Skill Downtown: towers rising like a bar chart, under a holographic ring. */
function SkillsModel({ district }: ModelProps) {
  const heights = [6, 9, 12, 16, 20, 25];
  const glass = useFacade(district.color, 3, 8, 0.2, true);
  const neon = useGlowMaterial(district.accent, 0.7, 3.2);
  return (
    <group position={[0, 0.4, -2]}>
      {heights.map((h, i) => {
        const x = -7.5 + i * 3;
        return (
          <group key={h}>
            <Solid args={[2.4, h, 2.4]} position={[x, h / 2, 0]} material={glass} />
            <EdgeGlow width={2.45} height={h} depth={2.45} y={h / 2} color={district.accent} />
          </group>
        );
      })}
      <Spin speed={0.4} position={[0, 30, 0]}>
        <mesh rotation-x={Math.PI / 2} material={neon}>
          <torusGeometry args={[7.5, 0.12, 8, 64]} />
        </mesh>
        <mesh rotation-x={Math.PI / 2.3} material={neon}>
          <torusGeometry args={[6.2, 0.07, 8, 64]} />
        </mesh>
      </Spin>
      <Bob position={[0, 30, 0]} amount={0.4}>
        <Text font={TEXT_FONT} fontSize={3} material={neon} anchorX="center" anchorY="middle">
          {"</>"}
        </Text>
      </Bob>
    </group>
  );
}

/** Campus: a columned university hall with a dome and a graduation cap on top. */
function CampusModel({ district }: ModelProps) {
  const gold = useGlowMaterial(district.accent, 0.2, 1.4, "#fde68a");
  const walls = useFacade("#e9d8fd", 14, 3, 0.3);
  const pediment = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-7, 0);
    shape.lineTo(7, 0);
    shape.lineTo(0, 2.6);
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: 1.2, bevelEnabled: false });
  }, []);
  return (
    <group position={[0, 0.4, -2]}>
      {/* Steps */}
      {[0, 1, 2].map((s) => (
        <Solid key={s} args={[15 - s, 0.3, 10 - s * 0.6]} position={[0, 0.15 + s * 0.3, 0.6 - s * 0.3]} color="#f5f0ff" />
      ))}
      <Solid args={[13, 7, 7]} position={[0, 0.9 + 3.5, -0.6]} material={walls} />
      {/* Columns */}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[-5 + i * 2, 0.9 + 3.5, 3.3]} castShadow>
          <cylinderGeometry args={[0.38, 0.45, 7, 16]} />
          <meshStandardMaterial color="#f5f0ff" />
        </mesh>
      ))}
      {/* Pediment */}
      <mesh position={[0, 8.5, 2.4]} geometry={pediment} castShadow>
        <meshStandardMaterial color={district.color} />
      </mesh>
      <Solid args={[14, 0.6, 8]} position={[0, 8.2, -0.4]} color={district.color} />
      {/* Drum and dome */}
      <mesh position={[0, 9.8, -1.2]} castShadow>
        <cylinderGeometry args={[3.4, 3.4, 2.6, 32]} />
        <meshStandardMaterial color="#f5f0ff" />
      </mesh>
      <mesh position={[0, 11.1, -1.2]} castShadow>
        <sphereGeometry args={[3.4, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={district.color} metalness={0.3} roughness={0.4} />
      </mesh>
      {/* Graduation cap */}
      <Bob position={[0, 15.6, -1.2]} amount={0.25}>
        <Spin speed={0.5}>
          <Solid args={[3.2, 0.18, 3.2]} position={[0, 0, 0]} rotation={[0, Math.PI / 4, 0]} color="#1a103d" />
          <mesh position={[0, -0.5, 0]}>
            <cylinderGeometry args={[0.9, 1, 0.9, 20]} />
            <meshStandardMaterial color="#1a103d" />
          </mesh>
          <mesh position={[1.1, -0.6, 1.1]} material={gold}>
            <cylinderGeometry args={[0.06, 0.06, 1.3, 6]} />
          </mesh>
          <mesh position={[1.1, -1.3, 1.1]} material={gold}>
            <sphereGeometry args={[0.18, 10, 10]} />
          </mesh>
        </Spin>
      </Bob>
    </group>
  );
}

/** Training Park: an open pavilion with a giant certificate and a turning medal. */
function TrainingModel({ district }: ModelProps) {
  const ribbon = useGlowMaterial(district.accent, 0.3, 1.6, "#a7f3d0");
  const medal = useGlowMaterial("#fde68a", 0.3, 1.6, "#fbbf24");
  const certificate = useMemo(() => makeCertificateTexture(), []);
  return (
    <group position={[0, 0.4, -1.5]}>
      {/* Pavilion */}
      {[-5, 5].map((x) =>
        [-3.5, 2.5].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 3.5, z]} castShadow>
            <cylinderGeometry args={[0.3, 0.35, 7, 12]} />
            <meshStandardMaterial color="#f5f0ff" />
          </mesh>
        )),
      )}
      <mesh position={[0, 7.4, -0.5]} castShadow>
        <boxGeometry args={[12.5, 0.5, 8.5]} />
        <meshStandardMaterial color={district.color} />
      </mesh>
      <mesh position={[0, 8.4, -0.5]} rotation-y={Math.PI / 4} castShadow>
        <coneGeometry args={[8.3, 2.2, 4]} />
        <meshStandardMaterial color={DARK} flatShading />
      </mesh>
      {/* Certificate on an easel stand */}
      <group position={[0, 0, -1]}>
        <Solid args={[0.2, 4.5, 0.2]} position={[-2, 2.25, -0.4]} rotation={[0.12, 0, 0]} color={STONE} />
        <Solid args={[0.2, 4.5, 0.2]} position={[2, 2.25, -0.4]} rotation={[0.12, 0, 0]} color={STONE} />
        <mesh position={[0, 3.6, 0]} rotation-x={-0.12} castShadow>
          <boxGeometry args={[5.2, 3.6, 0.12]} />
          <meshStandardMaterial map={certificate} />
        </mesh>
      </group>
      {/* Medal */}
      <Bob position={[3.5, 5, 2]} amount={0.25}>
        <Spin speed={1}>
          <mesh material={medal}>
            <cylinderGeometry args={[0.9, 0.9, 0.18, 32]} />
          </mesh>
          <mesh rotation-x={Math.PI / 2} position={[0, 0, 0]} material={medal}>
            <torusGeometry args={[0.95, 0.08, 8, 32]} />
          </mesh>
          {[-0.35, 0.35].map((x) => (
            <mesh key={x} position={[x, 1.2, 0]} rotation-z={x > 0 ? -0.35 : 0.35} material={ribbon}>
              <boxGeometry args={[0.4, 1.8, 0.05]} />
            </mesh>
          ))}
        </Spin>
      </Bob>
    </group>
  );
}

function makeCertificateTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 360;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fffaf0";
  ctx.fillRect(0, 0, 512, 360);
  ctx.strokeStyle = "#805ad5";
  ctx.lineWidth = 14;
  ctx.strokeRect(14, 14, 484, 332);
  ctx.strokeStyle = "#d6bcfa";
  ctx.lineWidth = 3;
  ctx.strokeRect(32, 32, 448, 296);
  ctx.fillStyle = "#4c1d95";
  ctx.textAlign = "center";
  ctx.font = "bold 40px Georgia, serif";
  ctx.fillText("CERTIFICATE", 256, 110);
  ctx.font = "22px Georgia, serif";
  ctx.fillText("of completion", 256, 145);
  ctx.font = "italic 34px Georgia, serif";
  ctx.fillStyle = "#1a103d";
  ctx.fillText("Wouroud El Khaldi", 256, 215);
  ctx.fillStyle = "#d69e2e";
  ctx.beginPath();
  ctx.arc(256, 285, 26, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeFlagTexture(kind: "lb" | "uk" | "fr") {
  const canvas = document.createElement("canvas");
  canvas.width = 240;
  canvas.height = 160;
  const c = canvas.getContext("2d")!;
  if (kind === "fr") {
    ["#0055a4", "#ffffff", "#ef4135"].forEach((col, i) => {
      c.fillStyle = col;
      c.fillRect(i * 80, 0, 80, 160);
    });
  } else if (kind === "lb") {
    c.fillStyle = "#ed1c24";
    c.fillRect(0, 0, 240, 160);
    c.fillStyle = "#ffffff";
    c.fillRect(0, 40, 240, 80);
    c.fillStyle = "#00a651";
    // A simple cedar: stacked triangles and a trunk
    for (let i = 0; i < 4; i++) {
      const w = 24 + i * 14;
      const y = 50 + i * 15;
      c.beginPath();
      c.moveTo(120, y);
      c.lineTo(120 - w / 2, y + 18);
      c.lineTo(120 + w / 2, y + 18);
      c.closePath();
      c.fill();
    }
    c.fillRect(116, 110, 8, 8);
  } else {
    c.fillStyle = "#012169";
    c.fillRect(0, 0, 240, 160);
    c.strokeStyle = "#ffffff";
    c.lineWidth = 30;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(240, 160);
    c.moveTo(240, 0);
    c.lineTo(0, 160);
    c.stroke();
    c.strokeStyle = "#c8102e";
    c.lineWidth = 10;
    c.stroke();
    c.fillStyle = "#ffffff";
    c.fillRect(100, 0, 40, 160);
    c.fillRect(0, 60, 240, 40);
    c.fillStyle = "#c8102e";
    c.fillRect(108, 0, 24, 160);
    c.fillRect(0, 68, 240, 24);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function Flag({ kind, position }: { kind: "lb" | "uk" | "fr"; position: [number, number, number] }) {
  const texture = useMemo(() => makeFlagTexture(kind), [kind]);
  const geometry = useMemo(() => new THREE.PlaneGeometry(2.4, 1.6, 12, 1), []);
  const base = useMemo(() => geometry.attributes.position.array.slice(), [geometry]);
  useFrame(({ clock }) => {
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3];
      const wave = Math.sin(x * 2.2 - clock.elapsedTime * 3 + position[0]) * 0.12 * ((x + 1.2) / 2.4);
      pos.setZ(i, wave);
    }
    pos.needsUpdate = true;
  });
  return (
    <group position={position}>
      <mesh position={[0, 4, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.09, 8, 8]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[1.25, 7, 0]} geometry={geometry}>
        <meshStandardMaterial map={texture} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** Polyglot Quarter: an embassy with the flags of the languages spoken, and speech bubbles. */
function LanguagesModel({ district }: ModelProps) {
  const walls = useFacade("#f3e8ff", 12, 3, 0.5);
  const bubble = useGlowMaterial(district.accent, 0.2, 1.2, "#ffffff");
  const greetings: [string, [number, number, number]][] = [
    ["Marhaba!", [-5, 12.5, 0]],
    ["Hello!", [0, 14, 0]],
    ["Bonjour !", [5, 12.5, 0]],
  ];
  return (
    <group position={[0, 0.4, -2.5]}>
      <Solid args={[13, 7.5, 7]} position={[0, 3.75, 0]} material={walls} />
      <Solid args={[14, 0.7, 8]} position={[0, 7.85, 0]} color={district.color} />
      <Solid args={[4, 2, 4]} position={[0, 9.2, 0]} color={district.color} />
      <mesh position={[0, 10.5, 0]} castShadow>
        <coneGeometry args={[3, 1.6, 4]} />
        <meshStandardMaterial color={DARK} flatShading />
      </mesh>
      <Flag kind="lb" position={[-4.5, 0, 4.4]} />
      <Flag kind="uk" position={[-1.2, 0, 4.4]} />
      <Flag kind="fr" position={[2.1, 0, 4.4]} />
      {greetings.map(([text, pos], i) => (
        <Bob key={text} position={pos} amount={0.35} speed={1 + i * 0.3}>
          <mesh material={bubble} scale={[1, 0.55, 0.25]}>
            <sphereGeometry args={[2, 24, 16]} />
          </mesh>
          <mesh position={[-0.7, -1, 0]} rotation-z={0.6} material={bubble}>
            <coneGeometry args={[0.35, 0.9, 8]} />
          </mesh>
          {[0.52, -0.52].map((z) => (
            <Text font={TEXT_FONT}
              key={z}
              position={[0, 0, z]}
              rotation-y={z > 0 ? 0 : Math.PI}
              fontSize={0.6}
              color="#4c1d95"
              anchorX="center"
              anchorY="middle"
            >
              {text}
            </Text>
          ))}
        </Bob>
      ))}
    </group>
  );
}

/** Project Harbor: a striped lighthouse with a sweeping beam, a pool and a boat. */
function ProjectsModel({ district }: ModelProps) {
  const lamp = useGlowMaterial("#fef9c3", 0.6, 4, "#fefce8");
  const water = useGlowMaterial("#06b6d4", 0.15, 0.6, "#67e8f9");
  const beamMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#fef9c3",
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  );
  const stripes = 6;
  const segment = 3;
  return (
    <group position={[0, 0.4, -2]}>
      {/* Pool and boat */}
      <mesh position={[-4.5, 0.05, 2]} rotation-x={-Math.PI / 2} material={water}>
        <circleGeometry args={[3.4, 40]} />
      </mesh>
      <Bob position={[-4.5, 0.35, 2]} amount={0.08} speed={1.6}>
        <Solid args={[1.2, 0.5, 2.6]} position={[0, 0, 0]} color="#f5f0ff" />
        <mesh position={[0, 1.4, 0]} rotation-y={Math.PI / 2}>
          <coneGeometry args={[0.9, 2.2, 3]} />
          <meshStandardMaterial color={district.accent} flatShading />
        </mesh>
      </Bob>
      {/* Lighthouse tower */}
      {Array.from({ length: stripes }, (_, i) => {
        const bottom = 2.6 - i * 0.22;
        const top = 2.6 - (i + 1) * 0.22;
        return (
          <mesh key={i} position={[2.5, segment / 2 + i * segment, -1]} castShadow>
            <cylinderGeometry args={[top, bottom, segment, 24]} />
            <meshStandardMaterial color={i % 2 === 0 ? "#f5f0ff" : district.color} />
          </mesh>
        );
      })}
      <group position={[2.5, stripes * segment, -1]}>
        <mesh position={[0, 0.2, 0]} castShadow>
          <cylinderGeometry args={[1.9, 1.9, 0.4, 24]} />
          <meshStandardMaterial color={DARK} />
        </mesh>
        <mesh position={[0, 1.4, 0]} material={lamp}>
          <cylinderGeometry args={[1.1, 1.1, 2, 16]} />
        </mesh>
        <mesh position={[0, 3, 0]} castShadow>
          <coneGeometry args={[1.5, 1.4, 16]} />
          <meshStandardMaterial color={district.color} />
        </mesh>
        <Spin speed={0.9} position={[0, 1.4, 0]}>
          <mesh position={[0, 0, 9]} rotation-x={-Math.PI / 2} material={beamMaterial}>
            <coneGeometry args={[2.6, 18, 24, 1, true]} />
          </mesh>
        </Spin>
      </group>
    </group>
  );
}

/** Hobby Quarter: a giant easel with a painting, a palette, a brush and a ball of yarn. */
function HobbiesModel({ district }: ModelProps) {
  const painting = useMemo(() => makePaintingTexture(), []);
  const dots = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#a855f7", "#ffffff"];
  return (
    <group position={[0, 0.4, -2]}>
      {/* Easel */}
      <Solid args={[0.35, 13, 0.35]} position={[-3.2, 6.3, 0.6]} rotation={[0.12, 0, 0.12]} color="#8b5e3c" />
      <Solid args={[0.35, 13, 0.35]} position={[3.2, 6.3, 0.6]} rotation={[0.12, 0, -0.12]} color="#8b5e3c" />
      <Solid args={[0.35, 12, 0.35]} position={[0, 5.8, -2]} rotation={[-0.3, 0, 0]} color="#8b5e3c" />
      <Solid args={[8, 0.4, 0.8]} position={[0, 4.2, 0.9]} color="#8b5e3c" />
      <mesh position={[0, 8.2, 0.7]} rotation-x={-0.12} castShadow>
        <boxGeometry args={[7.5, 7.5, 0.25]} />
        <meshStandardMaterial map={painting} />
      </mesh>
      {/* Palette */}
      <group position={[5.2, 0.6, 3]} rotation={[-0.3, 0.4, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[2.2, 2.2, 0.2, 32]} />
          <meshStandardMaterial color="#d6a77a" />
        </mesh>
        {dots.map((c, i) => {
          const a = (i / dots.length) * Math.PI * 1.5;
          return (
            <mesh key={c} position={[Math.cos(a) * 1.4, 0.15, Math.sin(a) * 1.4]}>
              <sphereGeometry args={[0.32, 12, 8]} />
              <meshStandardMaterial color={c} />
            </mesh>
          );
        })}
      </group>
      {/* Giant brush */}
      <group position={[-5.5, 3.2, 2.4]} rotation={[0, 0, 0.5]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.2, 0.28, 6, 12]} />
          <meshStandardMaterial color="#4c1d95" />
        </mesh>
        <mesh position={[0, 3.3, 0]}>
          <cylinderGeometry args={[0.32, 0.25, 0.6, 12]} />
          <meshStandardMaterial color="#d6d3d1" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0, 4.1, 0]}>
          <coneGeometry args={[0.35, 1.1, 12]} />
          <meshStandardMaterial color={district.accent} />
        </mesh>
      </group>
      {/* Yarn ball */}
      <Spin speed={0.6} position={[-6, 1.2, -2.6]}>
        <mesh castShadow>
          <sphereGeometry args={[1.2, 20, 16]} />
          <meshStandardMaterial color="#f472b6" roughness={1} />
        </mesh>
        {[0, 0.7, 1.4, 2.1].map((r) => (
          <mesh key={r} rotation={[r, r * 0.7, 0]}>
            <torusGeometry args={[1.22, 0.04, 6, 40]} />
            <meshStandardMaterial color="#db2777" />
          </mesh>
        ))}
      </Spin>
    </group>
  );
}

function makePaintingTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const c = canvas.getContext("2d")!;
  const sky = c.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, "#7c3aed");
  sky.addColorStop(0.55, "#f0abfc");
  sky.addColorStop(1, "#fde68a");
  c.fillStyle = sky;
  c.fillRect(0, 0, 512, 512);
  c.fillStyle = "#fef3c7";
  c.beginPath();
  c.arc(360, 200, 60, 0, Math.PI * 2);
  c.fill();
  // Brush-stroke hills
  const hills = ["#4c1d95", "#6d28d9", "#a78bfa"];
  hills.forEach((col, i) => {
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(0, 512);
    for (let x = 0; x <= 512; x += 16) c.lineTo(x, 330 + i * 50 + Math.sin(x / 60 + i) * 30);
    c.lineTo(512, 512);
    c.closePath();
    c.fill();
  });
  c.strokeStyle = "#f5f0ff";
  c.lineWidth = 22;
  c.strokeRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Arcade Pier: a giant arcade cabinet and a turning Ferris wheel. */
function ArcadeModel({ district }: ModelProps) {
  const screenTex = useMemo(() => makeArcadeScreen(), []);
  const screen = useMemo(
    () => new THREE.MeshStandardMaterial({ map: screenTex, emissive: "#ffffff", emissiveMap: screenTex, emissiveIntensity: 0.8, toneMapped: false }),
    [screenTex],
  );
  const neon = useGlowMaterial(district.accent, 0.6, 3);
  const pink = useGlowMaterial(district.color, 0.5, 2.5);
  const cabins = 10;
  return (
    <group position={[0, 0.4, -1.5]}>
      {/* Ferris wheel behind */}
      <group position={[0, 0, -4]}>
        {[-1.2, 1.2].map((z) => (
          <group key={z} position={[0, 0, z]}>
            <Solid args={[0.4, 12, 0.4]} position={[-3, 6, 0]} rotation={[0, 0, -0.25]} color={DARK} />
            <Solid args={[0.4, 12, 0.4]} position={[3, 6, 0]} rotation={[0, 0, 0.25]} color={DARK} />
          </group>
        ))}
        <Spin speed={0.25} axis="z" position={[0, 11.5, 0]}>
          <mesh material={pink}>
            <torusGeometry args={[8, 0.18, 8, 64]} />
          </mesh>
          {Array.from({ length: cabins }, (_, i) => {
            const a = (i / cabins) * Math.PI * 2;
            return (
              <group key={i}>
                <mesh rotation-z={a} position={[Math.cos(a) * 4, Math.sin(a) * 4, 0]}>
                  <boxGeometry args={[8, 0.1, 0.1]} />
                  <meshStandardMaterial color="#e9d8fd" />
                </mesh>
                <mesh position={[Math.cos(a) * 8, Math.sin(a) * 8 - 0.7, 0]} material={i % 2 ? neon : pink}>
                  <boxGeometry args={[1, 1, 1]} />
                </mesh>
              </group>
            );
          })}
        </Spin>
      </group>
      {/* Arcade cabinet */}
      <group position={[0, 0, 2.2]}>
        <Solid args={[5, 9, 3.4]} position={[0, 4.5, 0]} color="#2e1065" />
        <mesh position={[0, 6.3, 1.72]} rotation-x={-0.12} material={screen}>
          <planeGeometry args={[4, 3.2]} />
        </mesh>
        <Solid args={[5.2, 1.2, 1.4]} position={[0, 3.7, 2.1]} rotation={[0.35, 0, 0]} color="#4c1d95" />
        <mesh position={[-1.2, 4.6, 2.5]}>
          <cylinderGeometry args={[0.08, 0.08, 0.7, 8]} />
          <meshStandardMaterial color="#1a103d" />
        </mesh>
        <mesh position={[-1.2, 5, 2.5]} material={pink}>
          <sphereGeometry args={[0.25, 12, 12]} />
        </mesh>
        {[0.4, 1, 1.6].map((x, i) => (
          <mesh key={x} position={[x, 4.4, 2.45]} rotation-x={0.35} material={i === 1 ? neon : pink}>
            <cylinderGeometry args={[0.2, 0.2, 0.12, 16]} />
          </mesh>
        ))}
        <Solid args={[5.4, 1.2, 3.6]} position={[0, 9.4, 0]} material={neon} />
        <Text font={TEXT_FONT} position={[0, 9.4, 1.82]} fontSize={0.7} color="#2e1065" anchorX="center" anchorY="middle">
          FULL STACK
        </Text>
      </group>
    </group>
  );
}

function makeArcadeScreen() {
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 320;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#0b0620";
  c.fillRect(0, 0, 400, 320);
  const blocks = ["HTML", "CSS", "JS", "React", "Node", "MongoDB"];
  const colors = ["#f97316", "#3b82f6", "#facc15", "#22d3ee", "#22c55e", "#a855f7"];
  blocks.forEach((b, i) => {
    const w = 220 - i * 14;
    const x = 90 + (i % 2) * 12 + i * 7;
    const y = 280 - i * 40;
    c.fillStyle = colors[i];
    c.fillRect(x, y, w, 34);
    c.fillStyle = "#0b0620";
    c.font = "bold 20px monospace";
    c.textAlign = "center";
    c.fillText(b, x + w / 2, y + 24);
  });
  c.fillStyle = "#f0abfc";
  c.font = "bold 22px monospace";
  c.textAlign = "left";
  c.fillText("HI 2048", 12, 28);
  c.fillText("1UP", 330, 28);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const MODELS: Record<DistrictDef["id"], (props: ModelProps) => React.JSX.Element> = {
  business: BusinessModel,
  skills: SkillsModel,
  campus: CampusModel,
  training: TrainingModel,
  languages: LanguagesModel,
  projects: ProjectsModel,
  hobbies: HobbiesModel,
  arcade: ArcadeModel,
};

