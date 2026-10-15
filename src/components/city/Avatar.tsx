"use client";

import { useFrame } from "@react-three/fiber";
import type { EcctrlHandle } from "ecctrl";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { AvatarKind } from "@/state/useCityStore";
import { registerNightGlow } from "@/world/env";

/**
 * Placeholder avatars built from primitives, so phase 0 needs no downloads.
 * They will be swapped for rigged low-poly models with real animations later;
 * the swing animation here is driven by the controller's speed.
 *
 * Model space: feet at y = 0, facing +z.
 */
export function Avatar({
  kind,
  controller,
}: {
  kind: AvatarKind;
  controller: React.RefObject<EcctrlHandle | null>;
}) {
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const phase = useRef(0);

  useFrame((state, delta) => {
    const c = controller.current;
    const speed = c?.isOnGround ? (c.moveSpeed ?? 0) : 0;
    const airborne = c ? !c.isOnGround : false;
    phase.current += delta * (4 + speed * 2.2);
    const amp = Math.min(0.9, speed * 0.22);
    const swing = Math.sin(phase.current) * amp;
    if (leftLeg.current) leftLeg.current.rotation.x = airborne ? -0.5 : swing;
    if (rightLeg.current) rightLeg.current.rotation.x = airborne ? 0.3 : -swing;
    if (leftArm.current) leftArm.current.rotation.x = airborne ? -2.4 : -swing * 0.9;
    if (rightArm.current) rightArm.current.rotation.x = airborne ? -2.4 : swing * 0.9;
    if (body.current) {
      const breathe = Math.sin(state.clock.elapsedTime * 2) * 0.012;
      body.current.position.y = Math.abs(Math.cos(phase.current)) * amp * 0.08 + breathe;
    }
  });

  const look = LOOKS[kind];

  return (
    <group ref={body}>
      {/* Legs pivot at the hips */}
      {[
        [leftLeg, 0.1],
        [rightLeg, -0.1],
      ].map(([ref, x]) => (
        <group key={x as number} ref={ref as React.RefObject<THREE.Group>} position={[x as number, 0.78, 0]}>
          <mesh position={[0, -0.38, 0]} castShadow>
            <capsuleGeometry args={[0.085, 0.55, 4, 10]} />
            <meshStandardMaterial color={look.legs} {...look.metal} />
          </mesh>
          <mesh position={[0, -0.74, 0.05]} castShadow>
            <boxGeometry args={[0.15, 0.08, 0.26]} />
            <meshStandardMaterial color={look.shoes} />
          </mesh>
        </group>
      ))}

      {/* Torso */}
      {kind === "robot" ? (
        <mesh position={[0, 1.08, 0]} castShadow>
          <boxGeometry args={[0.46, 0.55, 0.3]} />
          <meshStandardMaterial color={look.torso} {...look.metal} />
        </mesh>
      ) : (
        <mesh position={[0, 1.08, 0]} castShadow>
          <capsuleGeometry args={[0.2, 0.32, 4, 14]} />
          <meshStandardMaterial color={look.torso} />
        </mesh>
      )}
      {kind === "girl" && (
        <mesh position={[0, 0.62, 0]} castShadow>
          {/* Long dress */}
          <cylinderGeometry args={[0.21, 0.36, 0.72, 20]} />
          <meshStandardMaterial color={look.torso} />
        </mesh>
      )}

      {/* Arms pivot at the shoulders */}
      {[
        [leftArm, 0.29],
        [rightArm, -0.29],
      ].map(([ref, x]) => (
        <group key={x as number} ref={ref as React.RefObject<THREE.Group>} position={[x as number, 1.32, 0]}>
          <mesh position={[0, -0.26, 0]} castShadow>
            <capsuleGeometry args={[0.065, 0.4, 4, 10]} />
            <meshStandardMaterial color={look.sleeves} {...look.metal} />
          </mesh>
          <mesh position={[0, -0.52, 0]} castShadow>
            <sphereGeometry args={[0.07, 10, 10]} />
            <meshStandardMaterial color={look.skin} {...look.metal} />
          </mesh>
        </group>
      ))}

      {kind === "robot" ? <RobotHead /> : <HumanHead kind={kind} skin={look.skin} hair={look.hair} />}
    </group>
  );
}

const LOOKS = {
  girl: {
    torso: "#7c3aed",
    sleeves: "#7c3aed",
    legs: "#3b2d63",
    shoes: "#2d1f52",
    skin: "#efc3a4",
    hair: "#3a2418",
    metal: {},
  },
  guy: {
    torso: "#8b5cf6",
    sleeves: "#8b5cf6",
    legs: "#2d2a4a",
    shoes: "#1a103d",
    skin: "#e2b08c",
    hair: "#2a1a12",
    metal: {},
  },
  robot: {
    torso: "#c4b5fd",
    sleeves: "#a78bfa",
    legs: "#a78bfa",
    shoes: "#4c1d95",
    skin: "#ddd6fe",
    hair: "#000000",
    metal: { metalness: 0.7, roughness: 0.3 },
  },
} as const;

function HumanHead({ kind, skin, hair }: { kind: AvatarKind; skin: string; hair: string }) {
  return (
    <group position={[0, 1.6, 0]}>
      <mesh position={[0, -0.12, 0]}>
        <cylinderGeometry args={[0.06, 0.07, 0.1, 10]} />
        <meshStandardMaterial color={skin} />
      </mesh>
      <mesh castShadow>
        <sphereGeometry args={[0.17, 20, 20]} />
        <meshStandardMaterial color={skin} />
      </mesh>
      {/* Eyes */}
      {[0.06, -0.06].map((x) => (
        <mesh key={x} position={[x, 0.02, 0.155]}>
          <sphereGeometry args={[0.022, 8, 8]} />
          <meshStandardMaterial color="#1a103d" />
        </mesh>
      ))}
      {kind === "girl" ? (
        <group>
          <mesh position={[0, 0.04, -0.03]} castShadow>
            <sphereGeometry args={[0.18, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
            <meshStandardMaterial color={hair} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, -0.15, -0.14]} castShadow>
            <capsuleGeometry args={[0.1, 0.3, 4, 10]} />
            <meshStandardMaterial color={hair} />
          </mesh>
        </group>
      ) : (
        <mesh position={[0, 0.05, -0.02]} castShadow>
          <sphereGeometry args={[0.178, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.45]} />
          <meshStandardMaterial color={hair} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

function RobotHead() {
  const visor = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#1a103d", emissive: "#d946ef", emissiveIntensity: 1.2 }),
    [],
  );
  useEffect(() => registerNightGlow(visor, 1.2, 2.5), [visor]);
  return (
    <group position={[0, 1.62, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.36, 0.3, 0.32]} />
        <meshStandardMaterial color="#c4b5fd" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.02, 0.165]} material={visor}>
        <boxGeometry args={[0.28, 0.09, 0.01]} />
      </mesh>
      <mesh position={[0, 0.24, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.18, 6]} />
        <meshStandardMaterial color="#4c1d95" />
      </mesh>
      <mesh position={[0, 0.34, 0]} material={visor}>
        <sphereGeometry args={[0.04, 10, 10]} />
      </mesh>
    </group>
  );
}
