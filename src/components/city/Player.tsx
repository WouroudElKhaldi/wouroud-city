"use client";

import { useKeyboardControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Ecctrl, type EcctrlHandle } from "ecctrl";
import { EcctrlCameraControls, type EcctrlCameraControlsHandle } from "ecctrl/camera";
import { useEffect, useRef } from "react";
import type * as THREE from "three";
import { useCityStore } from "@/state/useCityStore";
import { Avatar } from "./Avatar";

export const keyboardMap = [
  { name: "forward", keys: ["ArrowUp", "KeyW"] },
  { name: "backward", keys: ["ArrowDown", "KeyS"] },
  { name: "leftward", keys: ["ArrowLeft", "KeyA"] },
  { name: "rightward", keys: ["ArrowRight", "KeyD"] },
  { name: "jump", keys: ["Space"] },
  { name: "run", keys: ["ShiftLeft", "ShiftRight"] },
];

type Controls = "forward" | "backward" | "leftward" | "rightward" | "jump" | "run";

const CAPSULE_HALF_HEIGHT = 0.4;
const CAPSULE_RADIUS = 0.3;
const FLOAT_HEIGHT = 0.3;
/** Distance from the controller's center down to the ground it floats above (the ground ray adds ~6 cm). */
const FEET_OFFSET = CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS + FLOAT_HEIGHT + 0.06;


/**
 * The visitor: an Ecctrl physics character, fed by the keyboard,
 * with a third-person camera that follows and can be orbited by dragging.
 * `position` is written every frame for the sun, the minimap and anything else that follows the player.
 */
export function Player({
  position,
  spawn,
  facing,
}: {
  position: React.RefObject<THREE.Vector3 | null>;
  spawn: [number, number, number];
  /** Yaw in radians; the avatar faces (sin, cos) of this angle. */
  facing: number;
}) {
  const controller = useRef<EcctrlHandle>(null);
  const camera = useRef<EcctrlCameraControlsHandle>(null);
  const [, getKeys] = useKeyboardControls<Controls>();
  const avatar = useCityStore((s) => s.avatar);
  const hijab = useCityStore((s) => s.hijab);

  useEffect(() => {
    // Start behind the player, looking the way they face.
    const fx = Math.sin(facing);
    const fz = Math.cos(facing);
    const [x, y, z] = spawn;
    camera.current?.setLookAt(x - fx * 8, y + 3, z - fz * 8, x + fx * 4, y, z + fz * 4, false);
  }, [spawn, facing]);

  useEffect(() => {
    // Lets the browser console move the player while debugging.
    if (process.env.NODE_ENV === "development") Object.assign(window, { __player: controller });
  }, []);

  useFrame(() => {
    const c = controller.current;
    if (!c) return;
    c.setMovement(getKeys());
    const p = c.currPos;
    position.current?.copy(p);
    camera.current?.moveTo(p.x, p.y + 0.6, p.z, true);
  });

  return (
    <>
      <Ecctrl
        ref={controller}
        position={spawn}
        rotation={[0, facing, 0]}
        capsuleHalfHeight={CAPSULE_HALF_HEIGHT}
        capsuleRadius={CAPSULE_RADIUS}
        floatHeight={FLOAT_HEIGHT}
        maxWalkVel={3.5}
        maxRunVel={8}
        jumpVel={5.5}
      >
        <group position={[0, -FEET_OFFSET, 0]}>
          <Avatar kind={avatar} hijab={hijab} controller={controller} />
        </group>
      </Ecctrl>
      <EcctrlCameraControls
        ref={camera}
        makeDefault
        smoothTime={0.12}
        minDistance={3}
        maxDistance={18}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI / 2 - 0.08}
      />
    </>
  );
}
