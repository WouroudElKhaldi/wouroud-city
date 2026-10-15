"use client";

import { useKeyboardControls } from "@react-three/drei";
import { CuboidCollider } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import { Ecctrl, type EcctrlHandle } from "ecctrl";
import { EcctrlCameraControls, type EcctrlCameraControlsHandle } from "ecctrl/camera";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useCityStore } from "@/state/useCityStore";
import { playerState } from "@/world/env";
import { touchInput } from "@/world/touch";
import { Avatar } from "./Avatar";
import type { CharacterAnimation } from "./Character";
import { Person } from "./Person";
import { playerLook } from "@/world/outfits";
import { CAR_SCALE, CarModel, type CarMotion } from "./CarModel";
import { HorseModel, SADDLE_HEIGHT } from "./Horse";

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
/** How high the body's center floats above the ground at rest: the avatar's soles go exactly there. */
const REST_HEIGHT = CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS + FLOAT_HEIGHT;


const GESTURE_SECONDS = 1.3;
const STILL = { forward: false, backward: false, leftward: false, rightward: false, jump: false, run: false, joystick: { x: 0, y: 0 } };

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
  const outfitKey = useCityStore((s) => s.outfit);
  const seat = useCityStore((s) => s.seat);
  const driving = useCityStore((s) => s.driving);
  const riding = driving?.model === "horse";
  /** The car's own speed and heading while driving (m/s, radians). */
  const car = useRef({ speed: 0, heading: 0, steer: 0 });
  const [animation, setAnimation] = useState<CharacterAnimation>("idle");
  const seatQuat = useMemo(() => new THREE.Quaternion(), []);
  /** Seconds the controller has been off the ground; tiny bumps don't count as falling. */
  const airborne = useRef(0);

  useEffect(() => {
    // Start behind the player, looking the way they face.
    const fx = Math.sin(facing);
    const fz = Math.cos(facing);
    const [x, y, z] = spawn;
    camera.current?.setLookAt(x - fx * 8, y + 3, z - fz * 8, x + fx * 4, y, z + fz * 4, false);
  }, [spawn, facing]);

  // Seated: kinematic body. Otherwise dynamic again.
  useEffect(() => {
    const body = controller.current?.body;
    if (!body) return;
    body.setBodyType(seat ? 2 : 0, true);
  }, [seat]);

  // Getting into a car: start from the car's heading, pull the camera back for a wider view.
  useEffect(() => {
    if (driving) {
      // Sit in the car where it's parked, facing the way it's parked.
      const { x, z, rot } = driving.from;
      car.current = { speed: 0, heading: rot, steer: 0 };
      controller.current?.body?.setTranslation({ x, y: 1, z }, true);
      void camera.current?.dollyTo(driving.model === "horse" ? 8 : 11, true);
    } else {
      void camera.current?.dollyTo(7, true);
    }
  }, [driving]);

  useEffect(() => {
    // Lets the browser console move the player while debugging.
    if (process.env.NODE_ENV === "development") Object.assign(window, { __player: controller });
  }, []);

  useFrame((_, delta) => {
    const c = controller.current;
    if (!c) return;
    const k = getKeys();
    // The keyboard and the on-screen joystick drive the same controller.
    const keys = {
      ...k,
      run: k.run || touchInput.run,
      jump: k.jump || touchInput.jump,
      joystick: { x: touchInput.x, y: touchInput.y },
    };
    const moving = k.forward || k.backward || k.leftward || k.rightward || touchInput.x !== 0 || touchInput.y !== 0;
    const store = useCityStore.getState();

    if (store.seat) {
      // Any movement gets you up again.
      if (moving || keys.jump) store.stand();
      const s = store.seat;
      // Kinematic while seated: the bench can't push the body and gravity can't pull it, so no shaking.
      c.body.setNextKinematicTranslation({ x: s.x, y: s.y + FEET_OFFSET, z: s.z });
      c.body.setNextKinematicRotation(seatQuat.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, s.facing));
      c.setMovement(STILL);
    } else if (store.driving && c.body) {
      // Arcade car: throttle and steering from the keyboard or the joystick, brake with Space.
      const throttle = (k.forward ? 1 : 0) - (k.backward ? 1 : 0) + touchInput.y;
      const steer = (k.leftward ? 1 : 0) - (k.rightward ? 1 : 0) - touchInput.x;
      const st = car.current;
      st.steer = THREE.MathUtils.clamp(steer, -1, 1);
      const horse = store.driving.model === "horse";
      const top = horse ? (keys.run ? 13 : 6.5) : keys.run ? 26 : 17;
      if (keys.jump) st.speed = THREE.MathUtils.damp(st.speed, 0, 4, delta);
      else if (throttle) st.speed = THREE.MathUtils.clamp(st.speed + throttle * (throttle * st.speed < 0 ? 22 : horse ? 6 : 9) * delta, horse ? -2 : -7, top);
      else st.speed = THREE.MathUtils.damp(st.speed, 0, 0.9, delta);
      // Steering needs speed, and reverses when backing up.
      st.heading += steer * (horse ? 2.4 : 1.6) * delta * (horse ? 1 : THREE.MathUtils.clamp(st.speed / 7, -1, 1));
      // Bumping into something takes the speed away.
      const lv = c.body.linvel();
      const actual = Math.hypot(lv.x, lv.z);
      if (Math.abs(st.speed) > 4 && actual < Math.abs(st.speed) * 0.3) st.speed *= 0.5;
      c.body.setLinvel({ x: Math.sin(st.heading) * st.speed, y: Math.min(lv.y, 0), z: Math.cos(st.heading) * st.speed }, true);
      c.body.setRotation(seatQuat.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, st.heading), true);
      c.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      // The camera swings around behind the car (or horse) once it gets going.
      if (Math.abs(st.speed) > 1.5) {
        const cam = camera.current;
        if (cam) {
          const behind = st.heading + Math.PI;
          const diff = Math.atan2(Math.sin(behind - cam.azimuthAngle), Math.cos(behind - cam.azimuthAngle));
          void cam.rotateAzimuthTo(cam.azimuthAngle + diff * Math.min(1, delta * 2.5), false);
        }
      }
      if (store.exitCar) {
        // Park where we are and step out to the driver's side.
        const p = c.body.translation();
        store.stopDriving({ x: p.x, z: p.z, rot: st.heading });
        const side = st.heading + Math.PI / 2;
        c.body.setTranslation({ x: p.x + Math.sin(side) * 2.4, y: p.y + 0.6, z: p.z + Math.cos(side) * 2.4 }, true);
        c.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        st.speed = 0;
      }
    } else if (!store.started || store.panel || store.mapOpen || store.activity) {
      // Welcome screen, info panel or big map open: stand still.
      c.setMovement(STILL);
    } else {
      c.setMovement(keys);
    }

    // Safety net: if a collision ever tips the capsule over, stand it back up, keeping its heading.
    const q = c.body?.rotation() ?? { x: 0, y: 0, z: 0, w: 1 };
    const tilt = 1 - 2 * (q.x * q.x + q.z * q.z);
    if (tilt < 0.82) {
      const yaw = Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.x * q.x));
      c.body.setRotation(seatQuat.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yaw), true);
      c.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }

    // Ecctrl only updates currPos while it is enabled; in a car or on a bench read the body.
    const p = (store.driving || store.seat) && c.body ? c.body.translation() : c.currPos;
    position.current?.copy(p);
    playerState.position.set(p.x, p.y - FEET_OFFSET, p.z);
    playerState.speed = store.driving ? Math.abs(car.current.speed) : c.isOnGround ? c.moveSpeed : 0;
    if (store.driving) playerState.heading = car.current.heading;
    else if (c.moveSpeed > 0.3) playerState.heading = Math.atan2(c.currLinVel.x, c.currLinVel.z);
    camera.current?.moveTo(p.x, p.y + 0.6, p.z, true);

    airborne.current = c.isOnGround ? 0 : airborne.current + delta;
    let next: CharacterAnimation;
    const gesture = store.gesture;
    if (store.seat || store.driving?.model === "horse") next = "sit";
    else if (gesture && performance.now() - gesture.at < GESTURE_SECONDS * 1000 && c.moveSpeed < 0.5) next = gesture.name;
    else if (airborne.current > 0.18) next = c.verticalSpeed > 0.5 ? "jump" : "fall";
    // Hysteresis: a clip only changes when the speed clearly crosses a threshold,
    // so the walk cycle isn't restarted every few frames.
    else if (c.moveSpeed > (animation === "sprint" ? 4.2 : 4.8)) next = "sprint";
    else if (c.moveSpeed > (animation === "walk" || animation === "sprint" ? 0.25 : 0.5)) next = "walk";
    else next = "idle";
    if (next !== animation) setAnimation(next);
  });

  return (
    <>
      <Ecctrl
        ref={controller}
        position={spawn}
        rotation={[0, facing, 0]}
        enable={!seat && !driving}
        capsuleHalfHeight={CAPSULE_HALF_HEIGHT}
        capsuleRadius={CAPSULE_RADIUS}
        floatHeight={FLOAT_HEIGHT}
        maxWalkVel={3.5}
        maxRunVel={8}
        jumpVel={5.5}
      >
        {driving?.model === "horse" ? (
          <group position={[0, -(CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS), 0]}>
            <CuboidCollider args={[0.35, 0.6, 1.1]} position={[0, 0.9, 0]} />
            <HorseModel ridden />
          </group>
        ) : (
          driving && (
            <Suspense fallback={null}>
              <DrivenCar id={driving.id} model={driving.model} motion={car} />
            </Suspense>
          )
        )}
        <group
          position={
            riding
              ? [0, -(CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS) + SADDLE_HEIGHT + 0.27 - 0.48, -0.15]
              : [0, seat ? -FEET_OFFSET + 0.05 : -REST_HEIGHT, seat ? -0.1 : 0]
          }
          visible={!driving || riding}
        >
          {avatar === "robot" ? (
            <Avatar kind="robot" controller={controller} />
          ) : (
            <Suspense fallback={<Avatar kind={avatar} controller={controller} />}>
              <Person look={playerLook(avatar, outfitKey)} animation={animation} matchPlayerSpeed />
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

/** The car around the player while driving: the model, a car-sized collider and headlights. */
function DrivenCar({ id, model, motion }: { id: string; model: string; motion: React.RefObject<CarMotion> }) {
  // The capsule rests on the ground while driving, its center 0.7 m up.
  const ground = -(CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS);
  return (
    <group position={[0, ground, 0]}>
      <CuboidCollider args={[0.75 * CAR_SCALE, 0.45 * CAR_SCALE, 1.2 * CAR_SCALE]} position={[0, 0.75 * CAR_SCALE, 0]} />
      <group scale={CAR_SCALE} position={[0, 0.3 * CAR_SCALE, 0]}>
        <CarModel id={id} model={model} motion={motion} />
      </group>
      {[-0.45, 0.45].map((hx) => (
        <mesh key={hx} position={[hx * CAR_SCALE, 0.55 * CAR_SCALE, 1.28 * CAR_SCALE]}>
          <sphereGeometry args={[0.16, 10, 10]} />
          <meshStandardMaterial color="#fef9c3" emissive="#fef08a" emissiveIntensity={3} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
