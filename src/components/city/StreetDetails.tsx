"use client";

import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { CylinderCollider, RigidBody } from "@react-three/rapier";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { registerNightGlow, worldEnv } from "@/world/env";
import { type Billboard, type LampSpot, STREET } from "@/world/layout";
import { palette } from "@/world/palette";

function useInstanceMatrices(ref: React.RefObject<THREE.InstancedMesh | null>, matrices: THREE.Matrix4[]) {
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [ref, matrices]);
}

function at(x: number, y: number, z: number, rotY = 0) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)),
    new THREE.Vector3(1, 1, 1),
  );
}

/** Raised curbs along both edges of the avenue, and a zebra crossing at the plaza. */
export function Curbs({ avenueEndZ }: { avenueEndZ: number }) {
  const length = STREET.startZ + 6 - avenueEndZ;
  const centerZ = (STREET.startZ + 6 + avenueEndZ) / 2;
  const stripes = useMemo(() => {
    const out: number[] = [];
    for (let x = -STREET.roadHalfWidth + 0.8; x < STREET.roadHalfWidth - 0.4; x += 1.2) out.push(x);
    return out;
  }, []);
  return (
    <group>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (STREET.roadHalfWidth + 0.12), 0.08, centerZ]} receiveShadow castShadow>
          <boxGeometry args={[0.25, 0.16, length]} />
          <meshStandardMaterial color="#f5f0ff" roughness={0.8} />
        </mesh>
      ))}
      {stripes.map((x) => (
        <mesh key={x} position={[x, 0.025, STREET.startZ + 2.5]} receiveShadow>
          <boxGeometry args={[0.6, 0.01, 3]} />
          <meshStandardMaterial color="#f8f5ff" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Benches, planters and bins between the lamps, all instanced so dozens of them cost a few draw calls.
 */
export function StreetFurniture({ lamps }: { lamps: LampSpot[] }) {
  const seats = useRef<THREE.InstancedMesh>(null);
  const backs = useRef<THREE.InstancedMesh>(null);
  const legs = useRef<THREE.InstancedMesh>(null);
  const planters = useRef<THREE.InstancedMesh>(null);
  const flowers = useRef<THREE.InstancedMesh>(null);
  const bins = useRef<THREE.InstancedMesh>(null);

  const m = useMemo(() => {
    const seatM: THREE.Matrix4[] = [];
    const backM: THREE.Matrix4[] = [];
    const legM: THREE.Matrix4[] = [];
    const planterM: THREE.Matrix4[] = [];
    const flowerM: THREE.Matrix4[] = [];
    const binM: THREE.Matrix4[] = [];
    lamps.forEach(({ x: lx, z }, i) => {
      const side = Math.sign(lx);
      const x = side * (STREET.roadHalfWidth + STREET.sidewalkWidth - 0.7);
      const bz = z - 3.5;
      // Bench faces the road
      const rot = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      seatM.push(at(x, 0.48, bz, rot));
      backM.push(at(x + side * 0.28, 0.85, bz, rot));
      legM.push(at(x, 0.24, bz - 0.8, rot), at(x, 0.24, bz + 0.8, rot));
      planterM.push(at(x, 0.35, z - 10.5));
      flowerM.push(at(x, 0.85, z - 10.5, i));
      binM.push(at(lx - side * -0.2, 0.45, z + 1.2));
    });
    return { seatM, backM, legM, planterM, flowerM, binM };
  }, [lamps]);

  useInstanceMatrices(seats, m.seatM);
  useInstanceMatrices(backs, m.backM);
  useInstanceMatrices(legs, m.legM);
  useInstanceMatrices(planters, m.planterM);
  useInstanceMatrices(flowers, m.flowerM);
  useInstanceMatrices(bins, m.binM);

  return (
    <group>
      <instancedMesh ref={seats} args={[undefined, undefined, m.seatM.length]} castShadow receiveShadow>
        <boxGeometry args={[2, 0.1, 0.5]} />
        <meshStandardMaterial color="#c4a7e7" roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={backs} args={[undefined, undefined, m.backM.length]} castShadow>
        <boxGeometry args={[2, 0.55, 0.08]} />
        <meshStandardMaterial color="#c4a7e7" roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={legs} args={[undefined, undefined, m.legM.length]} castShadow>
        <boxGeometry args={[0.1, 0.48, 0.45]} />
        <meshStandardMaterial color={palette.lampPole} metalness={0.5} roughness={0.4} />
      </instancedMesh>
      <instancedMesh ref={planters} args={[undefined, undefined, m.planterM.length]} castShadow receiveShadow>
        <boxGeometry args={[1.4, 0.7, 1.4]} />
        <meshStandardMaterial color="#4c1d95" roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={flowers} args={[undefined, undefined, m.flowerM.length]} castShadow>
        <icosahedronGeometry args={[0.62, 0]} />
        <meshStandardMaterial color="#f0abfc" flatShading roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={bins} args={[undefined, undefined, m.binM.length]} castShadow>
        <cylinderGeometry args={[0.28, 0.24, 0.9, 12]} />
        <meshStandardMaterial color="#6d28d9" metalness={0.3} roughness={0.5} />
      </instancedMesh>
    </group>
  );
}

const CODE_LINES = [
  "const city = build(wouroud.skills);",
  "await deploy({ region: 'tripoli' });",
  "if (bug) { coffee++; fix(bug); }",
  "git commit -m \"ship it, not perfect\"",
  "SELECT * FROM dreams WHERE done = true;",
  "model.predict(nextBigThing);",
];

/** Free-standing holographic screens scrolling code: the city's software theme on every block. */
export function CodeBillboards({ spots }: { spots: Billboard[] }) {
  const screen = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#120a2b",
        emissive: "#3b1d8f",
        emissiveIntensity: 0.6,
        transparent: true,
        opacity: 0.88,
      }),
    [],
  );
  useEffect(() => registerNightGlow(screen, 0.6, 1.4), [screen]);

  return (
    <group>
      {spots.map((s, i) => (
        <group key={`${s.x}:${s.z}`} position={[s.x, 0, s.z]} rotation-y={s.side > 0 ? -Math.PI / 2 : Math.PI / 2}>
          <RigidBody type="fixed" colliders={false}>
            <CylinderCollider args={[1.5, 0.3]} position={[-1.6, 1.5, 0]} />
            <CylinderCollider args={[1.5, 0.3]} position={[1.6, 1.5, 0]} />
          </RigidBody>
          {[-1.6, 1.6].map((x) => (
            <mesh key={x} position={[x, 1.6, 0]} castShadow>
              <boxGeometry args={[0.14, 3.2, 0.14]} />
              <meshStandardMaterial color={palette.lampPole} metalness={0.5} roughness={0.4} />
            </mesh>
          ))}
          <mesh position={[0, 3.3, 0]} material={screen} castShadow>
            <boxGeometry args={[3.6, 1.7, 0.1]} />
          </mesh>
          <ScrollingCode line={CODE_LINES[i % CODE_LINES.length]} />
        </group>
      ))}
    </group>
  );
}

function ScrollingCode({ line }: { line: string }) {
  const text = useRef<THREE.Mesh>(null);
  const caret = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (caret.current) caret.current.visible = Math.floor(clock.elapsedTime * 2) % 2 === 0;
  });
  return (
    <group position={[0, 3.3, 0.07]}>
      <Text position={[-1.65, 0.55, 0]} fontSize={0.17} color="#a78bfa" anchorX="left" anchorY="middle">
        {"● ● ●   wouroud.ts"}
      </Text>
      <Text
        ref={text}
        position={[-1.65, 0.05, 0]}
        fontSize={0.2}
        maxWidth={3.3}
        color="#f0abfc"
        anchorX="left"
        anchorY="middle"
      >
        {line}
      </Text>
      <mesh ref={caret} position={[-1.55, -0.45, 0]}>
        <planeGeometry args={[0.12, 0.24]} />
        <meshBasicMaterial color="#e9d8fd" toneMapped={false} />
      </mesh>
      <Text position={[-1.35, -0.45, 0]} fontSize={0.16} color="#c4b5fd" anchorX="left" anchorY="middle">
        {"> ready"}
      </Text>
    </group>
  );
}

/** A circular fountain around the plaza monument, with gently rippling water and jets. */
export function Fountain() {
  const water = useRef<THREE.Mesh>(null);
  const jets = useRef<THREE.Group>(null);
  const waterMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#a78bfa",
        emissive: "#7c3aed",
        emissiveIntensity: 0.15,
        metalness: 0.2,
        roughness: 0.05,
        transparent: true,
        opacity: 0.82,
      }),
    [],
  );
  useEffect(() => registerNightGlow(waterMat, 0.15, 0.9), [waterMat]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (water.current) water.current.position.y = 0.55 + Math.sin(t * 1.4) * 0.02;
    if (jets.current) {
      jets.current.children.forEach((jet, i) => {
        jet.scale.y = 0.85 + Math.sin(t * 3 + i) * 0.15;
      });
    }
    waterMat.opacity = 0.8 + worldEnv.night * 0.1;
  });

  const jetAngles = useMemo(() => Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2), []);

  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.6, 5.2]} position={[0, 0.6, 0]} />
      </RigidBody>
      {/* Basin rim */}
      <mesh position={[0, 0.5, 0]} rotation-x={Math.PI / 2} castShadow receiveShadow>
        <torusGeometry args={[5, 0.35, 12, 64]} />
        <meshStandardMaterial color="#f5f0ff" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.25, 0]} receiveShadow>
        <cylinderGeometry args={[5, 5, 0.5, 64]} />
        <meshStandardMaterial color="#3b2d63" />
      </mesh>
      <mesh ref={water} position={[0, 0.55, 0]} rotation-x={-Math.PI / 2} material={waterMat}>
        <circleGeometry args={[4.85, 64]} />
      </mesh>
      <group ref={jets}>
        {jetAngles.map((a) => (
          <mesh key={a} position={[Math.cos(a) * 3.6, 1.1, Math.sin(a) * 3.6]} rotation-z={Math.cos(a) * 0.25} rotation-x={-Math.sin(a) * 0.25}>
            <cylinderGeometry args={[0.04, 0.12, 1.2, 8]} />
            <meshStandardMaterial color="#e9d8fd" transparent opacity={0.6} emissive="#c4b5fd" emissiveIntensity={0.4} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
