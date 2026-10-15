"use client";

import { RoundedBox } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Seat } from "@/state/useCityStore";
import { batchStatic, finishes } from "./luxury";
import { Person } from "./Person";
import { TEXT_FONT } from "@/world/fonts";
import { Text } from "./Text3D";

/**
 * Luxury office furniture at real-world sizes (meters): desks 0.75 high, seats cut to the
 * measured sitting pose (see SEAT), armrests 0.72. Every seat is modeled so that a sitter faces
 * +z in the piece's own space; `facing` turns the piece (and its sitter) around y.
 */

type V3 = [number, number, number];
type Finish = ReturnType<typeof finishes>;
export type Leather = "black" | "cognac" | "oxblood" | "cream" | "emerald" | "navy" | "blush" | "grey";

/** Height of a desk's work surface. */
export const DESK_TOP = 0.75;

const upholstery = (f: Finish, kind: Leather) =>
  ({
    black: f.leatherBlack,
    cognac: f.leatherCognac,
    oxblood: f.leatherOxblood,
    cream: f.leatherCream,
    emerald: f.velvetEmerald,
    navy: f.velvetNavy,
    blush: f.velvetBlush,
    grey: f.fabricGrey,
  })[kind];

/** A point `forward` meters ahead of (x, z) when facing `facing`. */
export const ahead = (x: number, z: number, facing: number, forward: number, side = 0): [number, number] => [
  x + Math.sin(facing) * forward + Math.cos(facing) * side,
  z + Math.cos(facing) * forward - Math.sin(facing) * side,
];

/** Merges its static children into a few meshes after they mount. */
export function Batch({ children }: { children: React.ReactNode }) {
  const source = useRef<THREE.Group>(null);
  const target = useRef<THREE.Group>(null);
  useLayoutEffect(() => batchStatic(source.current!, target.current!), []);
  return (
    <group>
      <group ref={source}>{children}</group>
      <group ref={target} />
    </group>
  );
}

/** A box collider placed in the parent's space (rotated with it). */
export function Block({ position, size, rotationY = 0 }: { position: V3; size: V3; rotationY?: number }) {
  return (
    <RigidBody type="fixed" colliders={false} position={position} rotation-y={rotationY}>
      <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} />
    </RigidBody>
  );
}

// ---------------------------------------------------------------------------
// Seating
// ---------------------------------------------------------------------------

/**
 * The seated body, measured from the Rocketbox "sit on a chair" pose as placed by Player.tsx
 * (relative to the seat point, sitter facing +z): hips 0.64–0.66 m up and 10 cm back,
 * knees 0.43–0.52 m up and 26–28 cm forward, calves angled back under the seat, toes on
 * the floor up to 42 cm forward. Every seat is cut to that shape: the cushion slopes from
 * SEAT.back at the rear to SEAT.front at its front edge, the backrest's face is 22 cm behind
 * the seat point, and nothing solid sits under the front of the seat where the calves go.
 */
export const SEAT = {
  /** Cushion top at its rear edge, and the rear edge's z. */
  back: 0.52,
  rearZ: -0.27,
  /** Cushion top at its front edge, and the front edge's z. */
  front: 0.46,
  frontZ: 0.12,
  /** Where the backrest's face is. */
  backrestZ: -0.22,
};
const SEAT_DEPTH = SEAT.frontZ - SEAT.rearZ;
const SEAT_TILT = Math.atan2(SEAT.back - SEAT.front, SEAT_DEPTH);
const SEAT_MID: V3 = [0, (SEAT.back + SEAT.front) / 2, (SEAT.rearZ + SEAT.frontZ) / 2];

/** A sloped seat cushion of the given width and thickness, top surface on the SEAT line. */
function Cushion({ width, thickness = 0.08, material, extraBack = 0 }: { width: number; thickness?: number; material: THREE.Material; extraBack?: number }) {
  return (
    <group position={SEAT_MID} rotation-x={SEAT_TILT}>
      <RoundedBox smoothness={2} bevelSegments={2}
        args={[width, thickness, SEAT_DEPTH + extraBack]}
        radius={Math.min(0.035, thickness / 2 - 0.001)}
        position={[0, -thickness / 2, -extraBack / 2]}
        material={material}
        castShadow
        receiveShadow
      />
    </group>
  );
}

/** A high-back executive chair: channel-stitched leather, chrome five-star base on casters. */
export function ExecChair({ position, facing = 0, leather = "black" }: { position: V3; facing?: number; leather?: Leather }) {
  const f = finishes();
  const hide = upholstery(f, leather);
  return (
    <group position={position} rotation-y={facing}>
      {/* Base: no spoke points forward, so the feet rest between the casters */}
      <group position={[0, 0, -0.06]}>
        {Array.from({ length: 5 }, (_, i) => (
          <group key={i} rotation-y={Math.PI + (i / 5) * Math.PI * 2}>
            <mesh position={[0, 0.075, 0.15]} rotation-x={0.12} material={f.chrome} castShadow>
              <boxGeometry args={[0.045, 0.03, 0.3]} />
            </mesh>
            <mesh position={[0, 0.028, 0.29]} material={f.plastic}>
              <sphereGeometry args={[0.028, 10, 8]} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 0.09, 0]} material={f.chrome}>
          <cylinderGeometry args={[0.05, 0.06, 0.06, 16]} />
        </mesh>
        <mesh position={[0, 0.25, 0]} material={f.chrome}>
          <cylinderGeometry args={[0.024, 0.024, 0.3, 12]} />
        </mesh>
        <mesh position={[0, 0.405, 0]} material={f.blackMetal}>
          <boxGeometry args={[0.24, 0.04, 0.24]} />
        </mesh>
      </group>
      {/* Seat: a shell under a thick cushion, both on the seat slope */}
      <group position={[0, -0.075, 0]}>
        <Cushion width={0.54} thickness={0.04} material={f.blackMetal} />
      </group>
      <Cushion width={0.52} thickness={0.075} material={hide} />
      {/* Backrest, its face 22 cm behind the seat point, with a headrest and stitched channels */}
      <group position={[0, SEAT.back, SEAT.backrestZ - 0.04]} rotation-x={-0.05}>
        <RoundedBox smoothness={2} bevelSegments={2} args={[0.5, 0.66, 0.08]} radius={0.035} position={[0, 0.39, 0]} material={hide} castShadow />
        <RoundedBox smoothness={2} bevelSegments={2} args={[0.32, 0.17, 0.08]} radius={0.035} position={[0, 0.82, 0]} material={hide} castShadow />
        {[0.2, 0.36, 0.52].map((y) => (
          <mesh key={y} position={[0, y, 0.041]} material={f.ebony}>
            <boxGeometry args={[0.42, 0.006, 0.004]} />
          </mesh>
        ))}
        <mesh position={[0, 0.72, -0.01]} material={f.chrome}>
          <boxGeometry args={[0.05, 0.1, 0.05]} />
        </mesh>
        <mesh position={[0, 0.06, -0.05]} material={f.chrome}>
          <boxGeometry args={[0.07, 0.24, 0.025]} />
        </mesh>
      </group>
      {/* Armrests beside the hips */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 0.29, 0.6, -0.12]} material={f.chrome}>
            <boxGeometry args={[0.03, 0.22, 0.03]} />
          </mesh>
          <mesh position={[s * 0.275, 0.49, -0.12]} material={f.chrome}>
            <boxGeometry args={[0.04, 0.025, 0.1]} />
          </mesh>
          <RoundedBox smoothness={2} bevelSegments={2} args={[0.07, 0.035, 0.3]} radius={0.015} position={[s * 0.29, 0.725, -0.1]} material={hide} />
        </group>
      ))}
    </group>
  );
}

/** A meeting / guest chair: walnut legs at the corners, upholstered seat and back. */
export function SideChair({ position, facing = 0, leather = "cognac" }: { position: V3; facing?: number; leather?: Leather }) {
  const f = finishes();
  const hide = upholstery(f, leather);
  const legs: [number, number, number][] = [
    [-0.21, SEAT.frontZ - 0.04, SEAT.front - 0.07],
    [0.21, SEAT.frontZ - 0.04, SEAT.front - 0.07],
    [-0.21, SEAT.rearZ + 0.04, SEAT.back - 0.07],
    [0.21, SEAT.rearZ + 0.04, SEAT.back - 0.07],
  ];
  return (
    <group position={position} rotation-y={facing}>
      {legs.map(([x, z, h]) => (
        <mesh key={`${x}${z}`} position={[x, h / 2, z]} material={f.walnut} castShadow>
          <cylinderGeometry args={[0.02, 0.014, h, 8]} />
        </mesh>
      ))}
      <group position={[0, -0.07, 0]}>
        <Cushion width={0.48} thickness={0.035} material={f.walnut} />
      </group>
      <Cushion width={0.47} thickness={0.07} material={hide} />
      <group position={[0, SEAT.back, SEAT.backrestZ - 0.03]} rotation-x={-0.1}>
        {[-0.21, 0.21].map((x) => (
          <mesh key={x} position={[x, 0.22, -0.01]} material={f.walnut}>
            <boxGeometry args={[0.035, 0.46, 0.03]} />
          </mesh>
        ))}
        <RoundedBox smoothness={2} bevelSegments={2} args={[0.46, 0.34, 0.06]} radius={0.025} position={[0, 0.29, 0]} material={hide} castShadow />
      </group>
    </group>
  );
}

const plainCache = new Map<string, THREE.MeshStandardMaterial>();
/** One shared plain material per color (so merged furniture stays one mesh per color). */
export function plain(color: string, roughness = 0.6) {
  const key = `${color}:${roughness}`;
  let m = plainCache.get(key);
  if (!m) plainCache.set(key, (m = new THREE.MeshStandardMaterial({ color, roughness })));
  return m;
}

/**
 * A modern conference / café chair: a padded seat and a molded back on a black steel sled
 * frame. The runners sit at the sides, so the calves and feet fit between them.
 */
export function ConferenceChair({ position, facing = 0, color = "#0fc48d" }: { position: V3; facing?: number; color?: string }) {
  const f = finishes();
  const shell = plain(color, 0.55);
  return (
    <group position={position} rotation-y={facing}>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.23, 0, 0]}>
          <mesh position={[0, 0.012, (SEAT.rearZ + SEAT.frontZ) / 2]} material={f.blackMetal}>
            <boxGeometry args={[0.022, 0.024, SEAT_DEPTH - 0.02]} />
          </mesh>
          <mesh position={[0, (SEAT.front - 0.06) / 2, SEAT.frontZ - 0.04]} material={f.blackMetal}>
            <boxGeometry args={[0.022, SEAT.front - 0.06, 0.022]} />
          </mesh>
          <mesh position={[0, (SEAT.back - 0.06) / 2, SEAT.rearZ + 0.03]} material={f.blackMetal}>
            <boxGeometry args={[0.022, SEAT.back - 0.06, 0.022]} />
          </mesh>
          <mesh position={[0, SEAT.back + 0.22, SEAT.backrestZ - 0.06]} rotation-x={-0.12} material={f.blackMetal}>
            <boxGeometry args={[0.022, 0.48, 0.022]} />
          </mesh>
        </group>
      ))}
      <group position={[0, -0.06, 0]}>
        <Cushion width={0.5} thickness={0.025} material={f.blackMetal} />
      </group>
      <Cushion width={0.48} thickness={0.06} material={shell} />
      <group position={[0, SEAT.back, SEAT.backrestZ - 0.03]} rotation-x={-0.12}>
        <RoundedBox smoothness={2} bevelSegments={2} args={[0.48, 0.32, 0.05]} radius={0.02} position={[0, 0.34, 0]} material={shell} castShadow />
      </group>
    </group>
  );
}

/** A coworker sitting the way the player sits (Player.tsx: root 5 cm up, 10 cm back). */
export function SeatedPerson({ id, seat }: { id: string; seat: Seat }) {
  const [x, z] = ahead(seat.x, seat.z, seat.facing, -0.1);
  return (
    <group position={[x, seat.y + 0.05, z]} rotation-y={seat.facing}>
      <Person look={{ id, body: id.startsWith("Female") ? "female" : "male" }} animation="sit" detail={false} floor={seat.y} />
    </group>
  );
}

/** Where a sofa's sitters go, in the sofa's own space (x along the sofa, z forward). */
export function sofaSlots(length: number) {
  const inner = length - 0.36;
  const count = Math.max(1, Math.round(inner / 0.62));
  const w = inner / count;
  return Array.from({ length: count }, (_, i) => ({ x: -inner / 2 + w * (i + 0.5), z: 0, w }));
}
/** A sofa's depth, back to front; its seat point is SOFA_BACK in front of its back. */
const SOFA_BACK = 0.52;
export const SOFA_DEPTH = SOFA_BACK + SEAT.frontZ + 0.06;

/**
 * A Chesterfield-style settee (or, short, an armchair): rolled arms, a button-tufted back
 * and brass legs. It stands on legs with an open front, so the calves fit under the seat.
 * Its origin is the seat point, so the back is SOFA_BACK behind it.
 */
export function Sofa({ position, facing = 0, length = 2.2, leather = "cognac" }: { position: V3; facing?: number; length?: number; leather?: Leather }) {
  const f = finishes();
  const hide = upholstery(f, leather);
  const slots = sofaSlots(length);
  const rear = -SOFA_BACK;
  const front = SEAT.frontZ + 0.06;
  const inner = length - 0.36;
  const buttons = Math.max(2, Math.floor((length - 0.4) / 0.22));
  return (
    <group position={position} rotation-y={facing}>
      {/* Brass legs at the corners */}
      {[-1, 1].flatMap((sx) =>
        [rear + 0.06, front - 0.06].map((z) => (
          <mesh key={`${sx}${z}`} position={[sx * (length / 2 - 0.08), 0.15, z]} material={f.brass} castShadow>
            <cylinderGeometry args={[0.022, 0.014, 0.3, 10]} />
          </mesh>
        )),
      )}
      {/* Seat deck: ends at the front of the cushions; open underneath */}
      <RoundedBox smoothness={2} bevelSegments={2} args={[length - 0.04, 0.12, front - rear]} radius={0.03} position={[0, 0.36, (front + rear) / 2]} material={hide} castShadow receiveShadow />
      {slots.map((s) => (
        <group key={s.x} position={[s.x, 0, 0]}>
          <Cushion width={s.w - 0.015} thickness={0.1} material={hide} />
        </group>
      ))}
      {/* Back cushion (its face 22 cm behind the seat point) and the frame behind it */}
      <RoundedBox smoothness={2} bevelSegments={2} args={[inner, 0.5, 0.16]} radius={0.05} position={[0, 0.7, SEAT.backrestZ - 0.08]} material={hide} castShadow />
      <RoundedBox smoothness={2} bevelSegments={2} args={[length, 0.66, 0.12]} radius={0.04} position={[0, 0.63, rear + 0.06]} material={hide} castShadow />
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (length / 2 - 0.09), 0, (front + rear) / 2]}>
          <RoundedBox smoothness={2} bevelSegments={2} args={[0.18, 0.32, front - rear]} radius={0.03} position={[0, 0.5, 0]} material={hide} castShadow />
          <mesh position={[s * 0.02, 0.67, 0]} rotation-x={Math.PI / 2} material={hide} castShadow>
            <cylinderGeometry args={[0.09, 0.09, front - rear, 18]} />
          </mesh>
        </group>
      ))}
      {/* Tufting buttons */}
      {Array.from({ length: buttons }, (_, i) =>
        [0.62, 0.8].map((y, r) => (
          <mesh
            key={`${i}${r}`}
            position={[-(buttons - 1) * 0.11 + i * 0.22 + (r ? 0.11 : 0), y, SEAT.backrestZ + 0.002]}
            material={f.ebony}
            visible={!(r && i === buttons - 1)}
          >
            <sphereGeometry args={[0.012, 6, 5]} />
          </mesh>
        )),
      )}
    </group>
  );
}

/** Seats for a sofa placed at (x, z) facing `facing`. */
export function sofaSeats(id: string, x: number, z: number, facing: number, length: number): Seat[] {
  return sofaSlots(length).map((s, i) => {
    const [sx, sz] = ahead(x, z, facing, s.z, s.x);
    return { id: `${id}-${i}`, x: sx, y: 0, z: sz, facing };
  });
}

/** A low bean bag. */
export function BeanBag({ position, color }: { position: V3; color: string }) {
  return (
    <mesh position={[position[0], 0.24, position[2]]} scale={[1, 0.62, 1]} castShadow>
      <sphereGeometry args={[0.45, 22, 16]} />
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Desks and what goes on them
// ---------------------------------------------------------------------------

/**
 * A walnut desk with a leather writing pad, brass sled legs and a drawer pedestal.
 * In its own space the front (where the knees go) is at −z: turn it by the sitter's
 * facing and put it `DESK_REACH` ahead of the chair.
 */
export function Desk({ width = 1.6, depth = 0.8, pedestal = true }: { width?: number; depth?: number; pedestal?: boolean }) {
  const f = finishes();
  return (
    <group>
      <RoundedBox smoothness={2} bevelSegments={2} args={[width, 0.045, depth]} radius={0.012} position={[0, DESK_TOP - 0.0225, 0]} material={f.walnut} castShadow receiveShadow />
      <mesh position={[0, DESK_TOP + 0.002, -depth / 2 + 0.24]} material={f.leatherBlack} receiveShadow>
        <boxGeometry args={[width * 0.55, 0.004, 0.38]} />
      </mesh>
      {/* Brass sled legs on both ends */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (width / 2 - 0.05), 0, 0]}>
          {[-1, 1].map((e) => (
            <mesh key={e} position={[0, (DESK_TOP - 0.045) / 2, e * (depth / 2 - 0.06)]} material={f.brass} castShadow>
              <boxGeometry args={[0.035, DESK_TOP - 0.045, 0.035]} />
            </mesh>
          ))}
          <mesh position={[0, 0.0175, 0]} material={f.brass}>
            <boxGeometry args={[0.035, 0.035, depth - 0.08]} />
          </mesh>
          <mesh position={[0, DESK_TOP - 0.07, 0]} material={f.brass}>
            <boxGeometry args={[0.035, 0.03, depth - 0.08]} />
          </mesh>
        </group>
      ))}
      {/* Modesty panel at the far side, well clear of the knees */}
      <mesh position={[0, DESK_TOP - 0.24, depth / 2 - 0.05]} material={f.walnutDark}>
        <boxGeometry args={[width - 0.14, 0.34, 0.02]} />
      </mesh>
      {pedestal && (
        <group position={[width / 2 - 0.3, 0, 0.02]}>
          <mesh position={[0, DESK_TOP - 0.045 - 0.27, 0]} material={f.walnutDark} castShadow>
            <boxGeometry args={[0.4, 0.54, depth - 0.12]} />
          </mesh>
          {[0, 1, 2].map((k) => (
            <group key={k} position={[0, DESK_TOP - 0.13 - k * 0.17, -(depth - 0.12) / 2 - 0.005]}>
              <mesh material={f.walnut}>
                <boxGeometry args={[0.37, 0.15, 0.01]} />
              </mesh>
              <mesh position={[0, 0, -0.012]} material={f.brass}>
                <boxGeometry args={[0.1, 0.012, 0.012]} />
              </mesh>
            </group>
          ))}
        </group>
      )}
    </group>
  );
}

/** A slim monitor on a chrome stand; `map` is what it shows. Faces −z (toward the sitter). */
export function Monitor({ position, rotationY = 0, width = 0.6, height = 0.36, map }: { position: V3; rotationY?: number; width?: number; height?: number; map: THREE.Texture }) {
  const f = finishes();
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh material={f.blackMetal} castShadow>
        <boxGeometry args={[width + 0.02, height + 0.02, 0.02]} />
      </mesh>
      <mesh position={[0, 0, -0.011]} rotation-y={Math.PI}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={map} toneMapped={false} />
      </mesh>
      <mesh position={[0, -height / 2 - 0.1, 0.03]} material={f.chrome}>
        <boxGeometry args={[0.035, 0.22, 0.02]} />
      </mesh>
    </group>
  );
}

/** Things on a desk, relative to the desk's center (front edge at −z). */
export function DeskSet({
  depth = 0.8,
  screens,
  extras = [],
}: {
  depth?: number;
  screens: THREE.Texture[];
  extras?: ("lamp" | "phone" | "headset" | "calculator" | "papers" | "mug" | "plant" | "nameplate" | "laptop")[];
}) {
  const f = finishes();
  const front = -depth / 2;
  const spread = screens.length === 3 ? [-0.63, 0, 0.63] : screens.length === 2 ? [-0.32, 0.32] : [0];
  const turn = screens.length === 3 ? [0.32, 0, -0.32] : screens.length === 2 ? [0.12, -0.12] : [0];
  return (
    <group>
      {screens.map((map, i) => (
        <Monitor
          key={i}
          position={[spread[i], DESK_TOP + 0.34, depth / 2 - 0.22 + (screens.length === 3 && i !== 1 ? -0.1 : 0)]}
          rotationY={turn[i]}
          map={map}
        />
      ))}
      {screens.length > 0 && (
        <>
          <mesh position={[0, DESK_TOP + 0.01, front + 0.24]} material={f.blackMetal}>
            <boxGeometry args={[0.44, 0.018, 0.14]} />
          </mesh>
          <mesh position={[0.32, DESK_TOP + 0.012, front + 0.24]} material={f.blackMetal}>
            <boxGeometry args={[0.06, 0.022, 0.1]} />
          </mesh>
        </>
      )}
      {extras.includes("laptop") && (
        <group position={[0, DESK_TOP, front + 0.3]}>
          <mesh position={[0, 0.008, 0]} material={f.chrome}>
            <boxGeometry args={[0.34, 0.015, 0.24]} />
          </mesh>
          <mesh position={[0, 0.12, 0.12]} rotation-x={-0.2} material={f.chrome}>
            <boxGeometry args={[0.34, 0.23, 0.01]} />
          </mesh>
        </group>
      )}
      {extras.includes("lamp") && (
        // Banker's lamp: brass stand, green glass shade
        <group position={[-0.62, DESK_TOP, depth / 2 - 0.2]}>
          <mesh position={[0, 0.015, 0]} material={f.brass}>
            <cylinderGeometry args={[0.08, 0.09, 0.03, 20]} />
          </mesh>
          <mesh position={[0, 0.17, 0]} material={f.brass}>
            <cylinderGeometry args={[0.012, 0.012, 0.3, 8]} />
          </mesh>
          <mesh position={[0, 0.33, -0.02]} rotation-x={Math.PI / 2} scale={[1, 1, 0.5]} material={f.greenShade}>
            <cylinderGeometry args={[0.07, 0.07, 0.32, 20, 1, false, 0, Math.PI]} />
          </mesh>
        </group>
      )}
      {extras.includes("phone") && (
        <group position={[0.55, DESK_TOP, front + 0.22]} rotation-y={-0.3}>
          <mesh position={[0, 0.03, 0]} rotation-x={-0.25} material={f.blackMetal}>
            <boxGeometry args={[0.2, 0.06, 0.18]} />
          </mesh>
          <mesh position={[-0.05, 0.075, 0]} material={f.plastic}>
            <boxGeometry args={[0.05, 0.03, 0.2]} />
          </mesh>
        </group>
      )}
      {extras.includes("headset") && (
        <group position={[-0.45, DESK_TOP + 0.12, front + 0.28]}>
          <mesh rotation-x={Math.PI / 2} material={f.blackMetal}>
            <torusGeometry args={[0.09, 0.012, 6, 20, Math.PI]} />
          </mesh>
          {[-0.09, 0.09].map((x) => (
            <mesh key={x} position={[x, -0.02, 0]} rotation-z={Math.PI / 2} material={f.leatherBlack}>
              <cylinderGeometry args={[0.04, 0.04, 0.03, 14]} />
            </mesh>
          ))}
        </group>
      )}
      {extras.includes("calculator") && (
        <group position={[0.5, DESK_TOP, front + 0.25]} rotation-y={0.2}>
          <mesh position={[0, 0.015, 0]} rotation-x={-0.12} material={f.plastic}>
            <boxGeometry args={[0.16, 0.03, 0.22]} />
          </mesh>
          <mesh position={[0, 0.06, 0.13]} rotation-x={-0.5} material={f.paper}>
            <boxGeometry args={[0.07, 0.002, 0.14]} />
          </mesh>
        </group>
      )}
      {extras.includes("papers") && (
        <group position={[-0.5, DESK_TOP, front + 0.26]} rotation-y={0.15}>
          {[0, 1, 2].map((k) => (
            <mesh key={k} position={[k * 0.01, 0.003 + k * 0.004, k * 0.01]} rotation-y={k * 0.08} material={f.paper}>
              <boxGeometry args={[0.21, 0.003, 0.297]} />
            </mesh>
          ))}
          <mesh position={[0.14, 0.008, 0.02]} rotation-y={0.5} rotation-z={Math.PI / 2} material={f.brass}>
            <cylinderGeometry args={[0.006, 0.006, 0.14, 6]} />
          </mesh>
        </group>
      )}
      {extras.includes("mug") && (
        <mesh position={[0.62, DESK_TOP + 0.05, front + 0.4]} material={f.ivory}>
          <cylinderGeometry args={[0.042, 0.038, 0.1, 16]} />
        </mesh>
      )}
      {extras.includes("plant") && (
        <group position={[0.68, DESK_TOP, depth / 2 - 0.15]}>
          <mesh position={[0, 0.06, 0]} material={f.marbleWhite}>
            <cylinderGeometry args={[0.07, 0.06, 0.12, 16]} />
          </mesh>
          {[0, 1, 2, 3, 4].map((k) => (
            <mesh key={k} position={[Math.sin(k * 1.3) * 0.04, 0.17 + (k % 2) * 0.04, Math.cos(k * 1.3) * 0.04]} material={f.leaf}>
              <icosahedronGeometry args={[0.06, 0]} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

/** A brass nameplate on a walnut block, readable from the visitor's side of the desk. */
export function Nameplate({ position, name, title, rotationY = 0 }: { position: V3; name: string; title: string; rotationY?: number }) {
  const f = finishes();
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh position={[0, 0.03, 0]} material={f.walnutDark}>
        <boxGeometry args={[0.36, 0.06, 0.06]} />
      </mesh>
      <mesh position={[0, 0.045, -0.031]} rotation-x={-0.4} material={f.brass}>
        <boxGeometry args={[0.34, 0.06, 0.004]} />
      </mesh>
      <Text font={TEXT_FONT} position={[0, 0.054, -0.036]} rotation={[-0.4, Math.PI, 0]} fontSize={0.024} color="#1a1208" anchorX="center" anchorY="middle">
        {name}
      </Text>
      <Text font={TEXT_FONT} position={[0, 0.032, -0.044]} rotation={[-0.4, Math.PI, 0]} fontSize={0.012} color="#3a2a12" anchorX="center" anchorY="middle">
        {title}
      </Text>
    </group>
  );
}

/**
 * A complete workstation: an executive chair at (x, z) and its desk ahead of it,
 * with screens and desk things. Its seat is `workSeat(id, x, z, facing)`.
 */
export function Workstation({
  x,
  z,
  facing,
  screens,
  extras,
  leather = "black",
  width = 1.6,
  chair = true,
}: {
  x: number;
  z: number;
  facing: number;
  screens: THREE.Texture[];
  extras?: Parameters<typeof DeskSet>[0]["extras"];
  leather?: Leather;
  width?: number;
  chair?: boolean;
}) {
  const [dx, dz] = ahead(x, z, facing, DESK_REACH);
  return (
    <group>
      {chair && <ExecChair position={[x, 0, z]} facing={facing} leather={leather} />}
      {/* The desk's own front (−z) must face the chair: turn it to face back at the sitter */}
      <group position={[dx, 0, dz]} rotation-y={facing}>
        <Desk width={width} />
        <DeskSet screens={screens} extras={extras} />
      </group>
      <Block position={[dx, 0.38, dz]} size={[width, 0.76, 0.8]} rotationY={facing} />
    </group>
  );
}

/** Distance from a chair's center to its desk's center. */
export const DESK_REACH = 0.78;

export const workSeat = (id: string, x: number, z: number, facing: number): Seat => ({ id, x, y: 0, z, facing });

// ---------------------------------------------------------------------------
// Storage, tables, lamps and decor
// ---------------------------------------------------------------------------

/** A walnut bookcase with books, a few bound ledgers and ornaments. Back against −z. */
export function Bookcase({ position, rotationY = 0, width = 1.8, height = 2.3, seed = 1 }: { position: V3; rotationY?: number; width?: number; height?: number; seed?: number }) {
  const f = finishes();
  const shelves = Math.floor((height - 0.1) / 0.4);
  const books = useMemo(() => {
    let s = seed * 9301 + 49297;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const palette = ["#5e1a1d", "#1e2a4d", "#1f5a47", "#3a2316", "#7a5a2a", "#2b2b2b", "#8a5230", "#d8cbb0"];
    const out: { x: number; y: number; w: number; h: number; c: string; lean: number }[] = [];
    for (let k = 0; k < shelves; k++) {
      let x = -width / 2 + 0.06;
      const y = 0.1 + k * 0.4;
      while (x < width / 2 - 0.1) {
        if (r() < 0.12) {
          x += 0.18 + r() * 0.2; // a gap for an ornament
          continue;
        }
        const w = 0.025 + r() * 0.035;
        const h = 0.22 + r() * 0.12;
        out.push({ x: x + w / 2, y, w, h, c: palette[Math.floor(r() * palette.length)], lean: 0 });
        x += w + 0.003;
      }
    }
    return out;
  }, [width, shelves, seed]);
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh position={[0, height / 2, -0.17]} material={f.walnutDark}>
        <boxGeometry args={[width, height, 0.02]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (width / 2 - 0.02), height / 2, 0]} material={f.walnut} castShadow>
          <boxGeometry args={[0.04, height, 0.36]} />
        </mesh>
      ))}
      {Array.from({ length: shelves + 1 }, (_, k) => (
        <mesh key={k} position={[0, 0.08 + k * 0.4, 0]} material={f.walnut}>
          <boxGeometry args={[width - 0.04, 0.03, 0.34]} />
        </mesh>
      ))}
      <mesh position={[0, height - 0.03, 0.01]} material={f.walnut} castShadow>
        <boxGeometry args={[width + 0.06, 0.06, 0.4]} />
      </mesh>
      {books.map((b, i) => (
        <mesh key={i} position={[b.x, b.y + b.h / 2, 0.01]}>
          <boxGeometry args={[b.w, b.h, 0.24]} />
          <meshStandardMaterial color={b.c} roughness={0.7} />
        </mesh>
      ))}
      {/* Gold-leaf spine bands on a few books */}
      {books
        .filter((_, i) => i % 4 === 0)
        .map((b, i) => (
          <mesh key={`g${i}`} position={[b.x, b.y + b.h * 0.8, 0.131]} material={f.brass}>
            <boxGeometry args={[b.w * 0.9, 0.01, 0.002]} />
          </mesh>
        ))}
      <Block position={[0, height / 2, 0]} size={[width, height, 0.4]} />
    </group>
  );
}

/** A walnut sideboard with brass handles. Back against −z. */
export function Credenza({ position, rotationY = 0, width = 2.2 }: { position: V3; rotationY?: number; width?: number }) {
  const f = finishes();
  const doors = Math.round(width / 0.55);
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh position={[0, 0.42, 0]} material={f.walnut} castShadow receiveShadow>
        <boxGeometry args={[width, 0.68, 0.5]} />
      </mesh>
      <mesh position={[0, 0.775, 0]} material={f.marbleBlack} castShadow>
        <boxGeometry args={[width + 0.04, 0.03, 0.54]} />
      </mesh>
      {Array.from({ length: doors }, (_, i) => (
        <group key={i} position={[-width / 2 + (width / doors) * (i + 0.5), 0.42, 0.252]}>
          <mesh material={f.walnutDark}>
            <boxGeometry args={[width / doors - 0.03, 0.6, 0.01]} />
          </mesh>
          <mesh position={[(i % 2 ? -1 : 1) * (width / doors / 2 - 0.06), 0.05, 0.012]} material={f.brass}>
            <boxGeometry args={[0.012, 0.16, 0.012]} />
          </mesh>
        </group>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (width / 2 - 0.06), 0.04, 0]} material={f.brass}>
          <boxGeometry args={[0.03, 0.08, 0.44]} />
        </mesh>
      ))}
      <Block position={[0, 0.4, 0]} size={[width, 0.8, 0.54]} />
    </group>
  );
}

/** A four-drawer filing cabinet in walnut. */
export function FilingCabinet({ position, rotationY = 0 }: { position: V3; rotationY?: number }) {
  const f = finishes();
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh position={[0, 0.66, 0]} material={f.walnutDark} castShadow>
        <boxGeometry args={[0.5, 1.32, 0.6]} />
      </mesh>
      {[0, 1, 2, 3].map((k) => (
        <group key={k} position={[0, 0.18 + k * 0.32, 0.302]}>
          <mesh material={f.walnut}>
            <boxGeometry args={[0.46, 0.29, 0.01]} />
          </mesh>
          <mesh position={[0, 0.06, 0.01]} material={f.brass}>
            <boxGeometry args={[0.14, 0.02, 0.015]} />
          </mesh>
          <mesh position={[0, 0.1, 0.008]} material={f.paper}>
            <planeGeometry args={[0.1, 0.03]} />
          </mesh>
        </group>
      ))}
      <Block position={[0, 0.66, 0]} size={[0.5, 1.32, 0.6]} />
    </group>
  );
}

/** A round or rectangular table: marble top on a brass base. */
export function Table({
  position,
  width = 1.2,
  depth,
  height = 0.74,
  top = "marbleWhite",
}: {
  position: V3;
  width?: number;
  depth?: number;
  height?: number;
  top?: "marbleWhite" | "marbleBlack" | "marbleGreen" | "walnut";
}) {
  const f = finishes();
  const round = depth === undefined;
  return (
    <group position={position}>
      {round ? (
        <>
          <mesh position={[0, height - 0.02, 0]} material={f[top]} castShadow receiveShadow>
            <cylinderGeometry args={[width / 2, width / 2, 0.04, 40]} />
          </mesh>
          <mesh position={[0, height - 0.045, 0]} material={f.brass}>
            <torusGeometry args={[width / 2 - 0.01, 0.008, 6, 40]} />
          </mesh>
          <mesh position={[0, (height - 0.04) / 2, 0]} material={f.brass} castShadow>
            <cylinderGeometry args={[0.05, 0.07, height - 0.04, 16]} />
          </mesh>
          <mesh position={[0, 0.02, 0]} material={f.brass}>
            <cylinderGeometry args={[Math.min(0.32, width / 3), Math.min(0.34, width / 3), 0.04, 30]} />
          </mesh>
        </>
      ) : (
        <>
          <RoundedBox smoothness={2} bevelSegments={2} args={[width, 0.05, depth]} radius={0.015} position={[0, height - 0.025, 0]} material={f[top]} castShadow receiveShadow />
          {[-1, 1].map((s) => (
            <group key={s} position={[s * (width / 2 - 0.25), 0, 0]}>
              <mesh position={[0, (height - 0.05) / 2, 0]} material={f.brass} castShadow>
                <boxGeometry args={[0.06, height - 0.05, 0.06]} />
              </mesh>
              <mesh position={[0, 0.02, 0]} material={f.brass}>
                <boxGeometry args={[0.08, 0.04, depth! * 0.7]} />
              </mesh>
              <mesh position={[0, height - 0.07, 0]} material={f.brass}>
                <boxGeometry args={[0.06, 0.04, depth! * 0.7]} />
              </mesh>
            </group>
          ))}
        </>
      )}
      <Block position={[0, height / 2, 0]} size={round ? [width * 0.75, height, width * 0.75] : [width, height, depth!]} />
    </group>
  );
}

/** A brass arc floor lamp with a warm linen shade. */
export function FloorLamp({ position, rotationY = 0 }: { position: V3; rotationY?: number }) {
  const f = finishes();
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh position={[0, 0.02, 0]} material={f.marbleBlack}>
        <cylinderGeometry args={[0.16, 0.17, 0.04, 24]} />
      </mesh>
      <mesh position={[0, 0.8, 0]} material={f.brass}>
        <cylinderGeometry args={[0.012, 0.012, 1.56, 8]} />
      </mesh>
      <mesh position={[0, 1.6, 0]} material={f.shade}>
        <cylinderGeometry args={[0.16, 0.22, 0.28, 24, 1, true]} />
      </mesh>
      <mesh position={[0, 1.55, 0]} material={f.bulb}>
        <sphereGeometry args={[0.04, 10, 8]} />
      </mesh>
    </group>
  );
}

/** A brass dome pendant hanging from the ceiling at height `ceiling`. */
export function Pendant({ position, ceiling, drop = 1.6 }: { position: [number, number]; ceiling: number; drop?: number }) {
  const f = finishes();
  const y = ceiling - drop;
  return (
    <group position={[position[0], 0, position[1]]}>
      <mesh position={[0, ceiling - drop / 2, 0]} material={f.brassDark}>
        <cylinderGeometry args={[0.006, 0.006, drop, 4]} />
      </mesh>
      <mesh position={[0, y, 0]} material={f.brass}>
        <sphereGeometry args={[0.28, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh position={[0, y - 0.02, 0]} rotation-x={Math.PI / 2} material={f.shade}>
        <circleGeometry args={[0.27, 24]} />
      </mesh>
      <mesh position={[0, y - 0.05, 0]} material={f.bulb}>
        <sphereGeometry args={[0.06, 12, 8]} />
      </mesh>
    </group>
  );
}

/** A fiddle-leaf fig (or a tall palm) in a fluted brass planter. */
export function TallPlant({ position, height = 1.9, seed = 1 }: { position: V3; height?: number; seed?: number }) {
  const f = finishes();
  const leaves = useMemo(() => {
    let s = seed * 7919 + 13;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    return Array.from({ length: 22 }, (_, i) => {
      const t = i / 22;
      const a = r() * Math.PI * 2;
      const rad = 0.12 + r() * 0.22;
      return { p: [Math.cos(a) * rad, 0.85 + t * (height - 0.85), Math.sin(a) * rad] as V3, a, s: 0.16 + r() * 0.08 };
    });
  }, [height, seed]);
  return (
    <group position={position}>
      <mesh position={[0, 0.3, 0]} material={f.brass} castShadow>
        <cylinderGeometry args={[0.28, 0.22, 0.6, 16]} />
      </mesh>
      <mesh position={[0, 0.61, 0]} material={f.soil}>
        <cylinderGeometry args={[0.26, 0.26, 0.02, 16]} />
      </mesh>
      <mesh position={[0, 0.6 + (height - 0.6) / 2, 0]} material={f.walnutDark}>
        <cylinderGeometry args={[0.022, 0.03, height - 0.6, 6]} />
      </mesh>
      {leaves.map((l, i) => (
        <mesh key={i} position={l.p} rotation={[0.5, l.a, 0.3]} scale={[1, 0.25, 1.4]} material={i % 3 ? f.leaf : f.leafLight} castShadow>
          <sphereGeometry args={[l.s, 7, 5]} />
        </mesh>
      ))}
      <Block position={[0, 0.5, 0]} size={[0.5, 1, 0.5]} />
    </group>
  );
}

/** A rug with a woven border. */
export function Rug({ position, width, depth, color, border = "#c9a45a", rotationY = 0 }: { position: [number, number]; width: number; depth: number; color: string; border?: string; rotationY?: number }) {
  return (
    <group position={[position[0], 0.006, position[1]]} rotation-y={rotationY}>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
      {[
        [width, 0.1, 0, -depth / 2 + 0.2],
        [width, 0.1, 0, depth / 2 - 0.2],
        [0.1, depth, -width / 2 + 0.2, 0],
        [0.1, depth, width / 2 - 0.2, 0],
      ].map(([w, d, x, z], i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[x, 0.002, z]}>
          <planeGeometry args={[i < 2 ? w - 0.3 : w, i < 2 ? d : d - 0.3]} />
          <meshStandardMaterial color={border} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/** A framed abstract painting (drawn once on a canvas). Hangs facing +z. */
export function Painting({ position, rotationY = 0, width = 1.4, height = 1, seed = 1, palette }: { position: V3; rotationY?: number; width?: number; height?: number; seed?: number; palette: string[] }) {
  const f = finishes();
  const map = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = Math.round((512 * height) / width);
    const ctx = canvas.getContext("2d")!;
    let s = seed * 104729 + 7;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    ctx.fillStyle = palette[0];
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = palette[1 + (i % (palette.length - 1))];
      ctx.globalAlpha = 0.55 + r() * 0.4;
      ctx.beginPath();
      if (i % 3 === 0) ctx.arc(r() * 512, r() * canvas.height, 30 + r() * 120, 0, Math.PI * 2);
      else ctx.rect(r() * 450, r() * canvas.height, 40 + r() * 200, 8 + r() * 90);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#c9a45a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height * (0.3 + r() * 0.4));
    ctx.bezierCurveTo(170, r() * canvas.height, 340, r() * canvas.height, 512, canvas.height * r());
    ctx.stroke();
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [width, height, seed, palette]);
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh position={[0, 0, -0.025]} material={f.brass} castShadow>
        <boxGeometry args={[width + 0.12, height + 0.12, 0.05]} />
      </mesh>
      <mesh position={[0, 0, 0.002]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial map={map} roughness={0.8} />
      </mesh>
    </group>
  );
}

/** A spinning antique globe on a walnut stand. Click it to spin. */
export function Globe({ position }: { position: V3 }) {
  const f = finishes();
  const ball = useRef<THREE.Mesh>(null);
  const spin = useRef(0.2);
  const map = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#c9b58a";
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = "#7a5a2a";
    // Rough continents
    const blobs = [
      [110, 80, 50, 40],
      [140, 170, 28, 50],
      [270, 75, 45, 28],
      [280, 150, 32, 55],
      [370, 85, 80, 38],
      [420, 185, 30, 18],
    ];
    for (const [x, y, rx, ry] of blobs) {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(60,40,20,0.35)";
    for (let i = 1; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo((i * 512) / 8, 0);
      ctx.lineTo((i * 512) / 8, 256);
      ctx.moveTo(0, (i * 256) / 8);
      ctx.lineTo(512, (i * 256) / 8);
      ctx.stroke();
    }
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useFrame((_, delta) => {
    spin.current = Math.max(0.2, spin.current - delta * 1.5);
    if (ball.current) ball.current.rotation.y += spin.current * delta;
  });
  return (
    <group position={position}>
      {[0, 1, 2].map((k) => (
        <mesh key={k} position={[Math.cos((k * Math.PI * 2) / 3) * 0.16, 0.3, Math.sin((k * Math.PI * 2) / 3) * 0.16]} rotation-z={0.15} material={f.walnut}>
          <cylinderGeometry args={[0.02, 0.025, 0.6, 8]} />
        </mesh>
      ))}
      <mesh position={[0, 0.62, 0]} material={f.walnut}>
        <torusGeometry args={[0.25, 0.025, 8, 30]} />
      </mesh>
      <mesh position={[0, 0.82, 0]} rotation-x={Math.PI / 2} rotation-y={0.4} material={f.brass}>
        <torusGeometry args={[0.24, 0.008, 6, 40]} />
      </mesh>
      <mesh
        ref={ball}
        position={[0, 0.82, 0]}
        rotation-z={0.41}
        castShadow
        userData={{ live: true }}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          spin.current = 9;
        }}
      >
        <sphereGeometry args={[0.22, 32, 20]} />
        <meshStandardMaterial map={map} roughness={0.5} />
      </mesh>
      <Block position={[0, 0.5, 0]} size={[0.5, 1, 0.5]} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Glass partitions and department signs
// ---------------------------------------------------------------------------

/**
 * A glass office wall along x (from x0 to x1 at z) or along z (from z0 to z1 at x),
 * with brass mullions, a frosted privacy band, a solid ivory wall above, and an open
 * doorway at each of `doors` (centers along the wall).
 */
export function GlassWall({
  axis,
  at,
  from,
  to,
  doors = [],
  ceiling,
  doorWidth = 1.7,
}: {
  axis: "x" | "z";
  at: number;
  from: number;
  to: number;
  doors?: number[];
  ceiling: number;
  doorWidth?: number;
}) {
  const f = finishes();
  const GLASS_TOP = 3.1;
  const cuts = [...doors].sort((a, b) => a - b);
  const segments: [number, number][] = [];
  let start = from;
  for (const d of cuts) {
    segments.push([start, d - doorWidth / 2]);
    start = d + doorWidth / 2;
  }
  segments.push([start, to]);
  const place = (along: number, y: number, across = 0): V3 => (axis === "x" ? [along, y, at + across] : [at + across, y, along]);
  const rot = axis === "x" ? 0 : Math.PI / 2;
  return (
    <group>
      {segments
        .filter(([a, b]) => b - a > 0.05)
        .map(([a, b]) => {
          const len = b - a;
          const mid = (a + b) / 2;
          const mullions = Math.max(1, Math.round(len / 1.5));
          return (
            <group key={a}>
              <mesh position={place(mid, GLASS_TOP / 2)} rotation-y={rot} material={f.glass}>
                <planeGeometry args={[len, GLASS_TOP]} />
              </mesh>
              <mesh position={place(mid, 1.1)} rotation-y={rot} material={f.frostGlass}>
                <boxGeometry args={[len, 0.14, 0.012]} />
              </mesh>
              <mesh position={place(mid, 0.04)} rotation-y={rot} material={f.brass}>
                <boxGeometry args={[len, 0.08, 0.06]} />
              </mesh>
              {Array.from({ length: mullions + 1 }, (_, i) => (
                <mesh key={i} position={place(a + (len / mullions) * i, GLASS_TOP / 2)} rotation-y={rot} material={f.brass}>
                  <boxGeometry args={[0.035, GLASS_TOP, 0.05]} />
                </mesh>
              ))}
              <RigidBody type="fixed" colliders={false}>
                <CuboidCollider args={axis === "x" ? [len / 2, 1.6, 0.06] : [0.06, 1.6, len / 2]} position={place(mid, 1.6)} />
              </RigidBody>
            </group>
          );
        })}
      {/* Solid wall above the glass, all along (over the doorway too) */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={place((from + to) / 2, (GLASS_TOP + ceiling) / 2, s * 0.06)} rotation-y={rot + (s < 0 ? Math.PI : 0)} material={f.ivory}>
          <planeGeometry args={[to - from, ceiling - GLASS_TOP]} />
        </mesh>
      ))}
      <mesh position={place((from + to) / 2, GLASS_TOP, 0)} rotation-y={rot} material={f.walnut}>
        <boxGeometry args={[to - from, 0.08, 0.14]} />
      </mesh>
      {/* A glass door standing open against the wall */}
      {cuts.map((door) => (
        <group key={door} position={place(door - doorWidth / 2, 0)} rotation-y={rot}>
          <group rotation-y={-Math.PI / 2 + 0.25}>
            <mesh position={[doorWidth / 2 - 0.05, 1.3, 0]} material={f.glass}>
              <boxGeometry args={[doorWidth - 0.12, 2.5, 0.012]} />
            </mesh>
            {[0.06, 2.55].map((y) => (
              <mesh key={y} position={[doorWidth / 2 - 0.05, y, 0]} material={f.brass}>
                <boxGeometry args={[doorWidth - 0.12, 0.06, 0.03]} />
              </mesh>
            ))}
            <mesh position={[doorWidth - 0.25, 1.1, 0.05]} material={f.brass}>
              <cylinderGeometry args={[0.015, 0.015, 0.9, 8]} />
            </mesh>
          </group>
          <mesh position={[doorWidth / 2, 2.8, 0]} material={f.brass}>
            <boxGeometry args={[doorWidth, 0.06, 0.08]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Gold letters on a walnut fascia, above a department's door. Faces +z. */
export function DeptSign({ position, rotationY = 0, name, line }: { position: V3; rotationY?: number; name: string; line?: string }) {
  const f = finishes();
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh position={[0, 0, -0.02]} material={f.walnutDark}>
        <boxGeometry args={[Math.max(2.4, name.length * 0.2 + 0.6), line ? 0.66 : 0.48, 0.04]} />
      </mesh>
      <Text font={TEXT_FONT} position={[0, line ? 0.1 : 0, 0.005]} fontSize={0.24} letterSpacing={0.12} color="#e6c27a" anchorX="center" anchorY="middle">
        {name.toUpperCase()}
      </Text>
      {line && (
        <Text font={TEXT_FONT} position={[0, -0.18, 0.005]} fontSize={0.1} letterSpacing={0.05} color="#d9c8a6" anchorX="center" anchorY="middle">
          {line}
        </Text>
      )}
    </group>
  );
}
