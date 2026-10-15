"use client";

import { useFrame } from "@react-three/fiber";
import type { EcctrlHandle } from "ecctrl";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { type AvatarKind, useCityStore } from "@/state/useCityStore";
import { registerNightGlow } from "@/world/env";

/**
 * The robot avatar, and the plain placeholder people see for a moment while a Rocketbox body
 * loads. Model space: feet at y = 0, facing +z.
 */
export function Avatar({
  kind,
  controller,
}: {
  kind: AvatarKind;
  controller: React.RefObject<EcctrlHandle | null>;
}) {
  return kind === "robot" ? <Robot controller={controller} /> : <Placeholder kind={kind} controller={controller} />;
}

/** A plain stand-in shown for a moment while a Rocketbox body loads. */
function Placeholder({
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

// ---------------------------------------------------------------------------------------------
// The robot
// ---------------------------------------------------------------------------------------------

const PEARL = new THREE.MeshPhysicalMaterial({ color: "#f3f1f6", roughness: 0.28, metalness: 0.1, clearcoat: 0.8, clearcoatRoughness: 0.15 });
const GRAPHITE = new THREE.MeshStandardMaterial({ color: "#2a2a33", roughness: 0.45, metalness: 0.8 });
const VISOR = new THREE.MeshPhysicalMaterial({ color: "#0d0b1a", roughness: 0.05, metalness: 0.2, clearcoat: 1, transmission: 0 });

type Limb = { upper: THREE.Group | null; lower: THREE.Group | null };

/**
 * A humanoid robot at adult proportions (1.78 m): pearl-white shell panels over graphite joints,
 * a glass visor with glowing eyes that blink, a chest light, and two-segment arms and legs. It
 * walks, runs, jumps, sits and waves with a procedural rig driven by the controller and store.
 */
function Robot({ controller }: { controller: React.RefObject<EcctrlHandle | null> }) {
  const root = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const legs = useRef<Limb[]>([{ upper: null, lower: null }, { upper: null, lower: null }]);
  const arms = useRef<Limb[]>([{ upper: null, lower: null }, { upper: null, lower: null }]);
  const eyes = useRef<THREE.Mesh[]>([]);
  const phase = useRef(0);
  const glow = useMemo(() => new THREE.MeshStandardMaterial({ color: "#f0abfc", emissive: "#d946ef", emissiveIntensity: 1.6, toneMapped: false }), []);
  useEffect(() => registerNightGlow(glow, 1.6, 3.2), [glow]);

  useFrame((state, delta) => {
    const c = controller.current;
    const store = useCityStore.getState();
    const seated = !!store.seat || (!!store.driving && store.driving.model !== "horse");
    const speed = c?.isOnGround ? (c.moveSpeed ?? 0) : 0;
    const airborne = c ? !c.isOnGround && !seated : false;
    const t = state.clock.elapsedTime;
    phase.current += delta * (3 + speed * 1.9);
    const stride = Math.min(1, speed / 6);
    const s = Math.sin(phase.current);
    const ease = (obj: THREE.Object3D | null, x: number, k = 12) => {
      if (obj) obj.rotation.x = THREE.MathUtils.damp(obj.rotation.x, x, k, delta);
    };
    const gesture = !!store.gesture && performance.now() - store.gesture.at < 1400;

    legs.current.forEach((leg, i) => {
      const side = i === 0 ? 1 : -1;
      if (seated) {
        ease(leg.upper, -Math.PI / 2);
        ease(leg.lower, Math.PI / 2);
      } else if (airborne) {
        ease(leg.upper, i === 0 ? -0.9 : -0.2);
        ease(leg.lower, i === 0 ? 1.3 : 0.4);
      } else {
        const swing = s * side * 0.75 * stride;
        ease(leg.upper, swing, 20);
        // The knee bends as the leg swings forward.
        ease(leg.lower, Math.max(0, -Math.cos(phase.current + (side > 0 ? 0 : Math.PI))) * 1.1 * stride + 0.05, 20);
      }
    });
    arms.current.forEach((arm, i) => {
      const side = i === 0 ? 1 : -1;
      if (gesture && i === 1) {
        // Wave with the right arm.
        ease(arm.upper, -2.6, 10);
        if (arm.lower) arm.lower.rotation.z = Math.sin(t * 10) * 0.5;
        ease(arm.lower, -0.4, 10);
      } else if (seated) {
        ease(arm.upper, -0.5);
        ease(arm.lower, -0.9);
        if (arm.lower) arm.lower.rotation.z = 0;
      } else if (airborne) {
        ease(arm.upper, -2.3);
        ease(arm.lower, -0.3);
      } else {
        ease(arm.upper, -s * side * 0.6 * stride, 20);
        ease(arm.lower, -0.25 - stride * 0.6, 20);
        if (arm.lower) arm.lower.rotation.z = 0;
      }
    });
    if (torso.current) {
      torso.current.position.y = seated ? -0.42 : Math.abs(Math.cos(phase.current)) * 0.04 * stride + Math.sin(t * 2) * 0.006;
      torso.current.rotation.x = THREE.MathUtils.damp(torso.current.rotation.x, seated ? -0.05 : stride * 0.12, 8, delta);
    }
    if (head.current) {
      head.current.rotation.y = Math.sin(t * 0.5) * 0.15 * (1 - stride);
      head.current.rotation.x = Math.sin(t * 0.7) * 0.04;
    }
    // Blink every few seconds.
    const blink = (t % 4.2) < 0.12 ? 0.1 : 1;
    eyes.current.forEach((e) => (e.scale.y = blink));
    if (root.current) root.current.position.y = 0;
  });


  return (
    <group ref={root}>
      <group ref={torso}>
        {/* Legs: hip joint, thigh shell, knee, shin shell, foot */}
        {[0.11, -0.11].map((x, i) => (
          <group key={x} ref={(el) => void (legs.current[i].upper = el)} position={[x, 0.92, 0]}>
            <mesh material={GRAPHITE}>
              <sphereGeometry args={[0.075, 16, 12]} />
            </mesh>
            <mesh position={[0, -0.22, 0]} material={PEARL} castShadow>
              <capsuleGeometry args={[0.075, 0.28, 6, 14]} />
            </mesh>
            <group ref={(el) => void (legs.current[i].lower = el)} position={[0, -0.44, 0]}>
              <mesh material={GRAPHITE}>
                <sphereGeometry args={[0.062, 14, 10]} />
              </mesh>
              <mesh position={[0, -0.21, 0]} material={PEARL} castShadow>
                <capsuleGeometry args={[0.06, 0.28, 6, 14]} />
              </mesh>
              <mesh position={[0, -0.21, 0.065]} material={glow}>
                <boxGeometry args={[0.03, 0.16, 0.01]} />
              </mesh>
              <mesh position={[0, -0.445, 0.05]} material={GRAPHITE} castShadow>
                <boxGeometry args={[0.13, 0.06, 0.26]} />
              </mesh>
            </group>
          </group>
        ))}

        {/* Pelvis, abdomen and chest */}
        <mesh position={[0, 0.96, 0]} material={GRAPHITE} castShadow>
          <boxGeometry args={[0.32, 0.14, 0.2]} />
        </mesh>
        <mesh position={[0, 1.1, 0]} material={GRAPHITE}>
          <cylinderGeometry args={[0.11, 0.13, 0.16, 16]} />
        </mesh>
        <mesh position={[0, 1.3, 0]} scale={[1, 1, 0.68]} material={PEARL} castShadow>
          <sphereGeometry args={[0.23, 28, 20]} />
        </mesh>
        <mesh position={[0, 1.33, 0.15]} material={glow}>
          <circleGeometry args={[0.035, 20]} />
        </mesh>
        <mesh position={[0, 1.42, 0]} material={PEARL}>
          <boxGeometry args={[0.46, 0.08, 0.2]} />
        </mesh>

        {/* Arms: shoulder, upper arm, elbow, forearm, hand */}
        {[0.27, -0.27].map((x, i) => (
          <group key={x} ref={(el) => void (arms.current[i].upper = el)} position={[x, 1.42, 0]}>
            <mesh material={GRAPHITE}>
              <sphereGeometry args={[0.07, 16, 12]} />
            </mesh>
            <mesh position={[0, -0.16, 0]} material={PEARL} castShadow>
              <capsuleGeometry args={[0.055, 0.2, 6, 12]} />
            </mesh>
            <group ref={(el) => void (arms.current[i].lower = el)} position={[0, -0.32, 0]}>
              <mesh material={GRAPHITE}>
                <sphereGeometry args={[0.05, 12, 10]} />
              </mesh>
              <mesh position={[0, -0.14, 0]} material={PEARL} castShadow>
                <capsuleGeometry args={[0.045, 0.18, 6, 12]} />
              </mesh>
              <mesh position={[0, -0.3, 0.01]} material={GRAPHITE}>
                <boxGeometry args={[0.07, 0.1, 0.04]} />
              </mesh>
            </group>
          </group>
        ))}

        {/* Neck and head with a glass visor and two glowing eyes */}
        <mesh position={[0, 1.5, 0]} material={GRAPHITE}>
          <cylinderGeometry args={[0.045, 0.055, 0.1, 12]} />
        </mesh>
        <group ref={head} position={[0, 1.66, 0]}>
          <mesh scale={[1, 1.08, 1]} material={PEARL} castShadow>
            <sphereGeometry args={[0.13, 28, 22]} />
          </mesh>
          <mesh position={[0, 0.0, 0.05]} scale={[1, 0.62, 0.7]} material={VISOR}>
            <sphereGeometry args={[0.122, 28, 20, -Math.PI / 2.4, Math.PI / 1.2, Math.PI / 3.2, Math.PI / 2.6]} />
          </mesh>
          {[-0.045, 0.045].map((x, i) => (
            <mesh key={x} ref={(m) => void (m && (eyes.current[i] = m))} position={[x, 0.01, 0.125]} material={glow}>
              <capsuleGeometry args={[0.012, 0.02, 4, 8]} />
            </mesh>
          ))}
          {[-1, 1].map((sx) => (
            <mesh key={sx} position={[sx * 0.13, 0, 0]} rotation-z={Math.PI / 2} material={GRAPHITE}>
              <cylinderGeometry args={[0.035, 0.035, 0.03, 16]} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}
