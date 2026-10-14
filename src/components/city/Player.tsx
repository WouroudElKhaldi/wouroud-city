"use client";

import { useKeyboardControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Ecctrl, type EcctrlHandle } from "ecctrl";
import { EcctrlCameraControls, type EcctrlCameraControlsHandle } from "ecctrl/camera";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useCityStore } from "@/state/useCityStore";
import { playerState } from "@/world/env";
import { Avatar } from "./Avatar";
import { GIRL_OUTFITS, GUY_OUTFIT } from "@/world/outfits";
import { Character, type CharacterAnimation } from "./Character";

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


const GESTURE_SECONDS = 1.3;

/**
 * The visitor: an Ecctrl physics character, fed by the keyboard, with a
 * third-person camera that follows and can be orbited by dragging.
 * It writes its position and speed to `playerState` every frame for everything
 * that reacts to the player (plants, pigeons, prompts, the sun's shadows).
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
  const outfitKey = useCityStore((s) => s.outfit);
  const hijabColor = useCityStore((s) => s.hijabColor);
  const seat = useCityStore((s) => s.seat);
  const [animation, setAnimation] = useState<CharacterAnimation>("idle");
  const outfit = avatar === "guy" ? GUY_OUTFIT : GIRL_OUTFITS[outfitKey];
  const wearsHijab = avatar === "girl" && hijab;
  const seatQuat = useMemo(() => new THREE.Quaternion(), []);

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
    const keys = getKeys();
    const store = useCityStore.getState();

    if (store.seat) {
      // Any movement key gets you up again.
      if (keys.forward || keys.backward || keys.leftward || keys.rightward || keys.jump) store.stand();
      const s = store.seat;
      c.body.setTranslation({ x: s.x, y: s.y + FEET_OFFSET, z: s.z }, true);
      c.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      c.body.setRotation(seatQuat.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, s.facing), true);
      c.setMovement({ forward: false, backward: false, leftward: false, rightward: false, jump: false, run: false });
    } else if (!store.started || store.panel || store.mapOpen) {
      // Welcome screen, info panel or big map open: stand still.
      c.setMovement({ forward: false, backward: false, leftward: false, rightward: false, jump: false, run: false });
    } else {
      c.setMovement(keys);
    }

    const p = c.currPos;
    position.current?.copy(p);
    playerState.position.set(p.x, p.y - FEET_OFFSET, p.z);
    playerState.speed = c.isOnGround ? c.moveSpeed : 0;
    if (c.moveSpeed > 0.3) playerState.heading = Math.atan2(c.currLinVel.x, c.currLinVel.z);
    camera.current?.moveTo(p.x, p.y + 0.6, p.z, true);

    let next: CharacterAnimation;
    const gesture = store.gesture;
    if (store.seat) next = "sit";
    else if (gesture && performance.now() - gesture.at < GESTURE_SECONDS * 1000 && c.moveSpeed < 0.5) next = gesture.name;
    else if (!c.isOnGround) next = c.verticalSpeed > 0.5 ? "jump" : "fall";
    else if (c.moveSpeed > 4.6) next = "sprint";
    else if (c.moveSpeed > 0.35) next = "walk";
    else next = "idle";
    if (next !== animation) setAnimation(next);
  });

  return (
    <>
      <Ecctrl
        ref={controller}
        position={spawn}
        rotation={[0, facing, 0]}
        enable={!seat}
        capsuleHalfHeight={CAPSULE_HALF_HEIGHT}
        capsuleRadius={CAPSULE_RADIUS}
        floatHeight={FLOAT_HEIGHT}
        maxWalkVel={3.5}
        maxRunVel={8}
        jumpVel={5.5}
      >
        <group position={[0, -FEET_OFFSET + (seat ? 0.05 : 0), seat ? -0.1 : 0]}>
          {avatar === "robot" ? (
            <Avatar kind="robot" hijab={false} controller={controller} />
          ) : (
            <Suspense fallback={<Avatar kind={avatar} hijab={hijab} controller={controller} />}>
              <Character
                file={outfit.file}
                colors={outfit.colors}
                // Wearing a hijab always means a fully covering outfit.
                modest={wearsHijab || outfit.alwaysModest ? outfit.modest : undefined}
                animation={animation}
                hijab={wearsHijab}
                hijabColor={hijabColor}
              />
            </Suspense>
          )}
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
