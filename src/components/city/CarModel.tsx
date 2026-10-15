"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useCityStore } from "@/state/useCityStore";

/** Kenney car models are about 2.5 units long and 1.15 tall; this makes them about 4 m long and
 *  1.8 m tall: real-car sized next to the 1.7 m people (2.2 made them twice a person's height). */
export const CAR_SCALE = 1.6;

/** How a car is moving, for its wheels: speed in m/s (negative backing up), steer in -1..1. */
export type CarMotion = { speed: number; steer: number };

const WHEEL_RADIUS = 0.3;
/** Door swing, seconds: open, hold while someone gets in or out, close. */
const OPEN = 0.35;
const HOLD = 0.55;
const CLOSE = 0.4;
const DOOR_ANGLE = 1.1;

/** Six planes bounding a local box; `inward` flips them to keep the inside instead of cutting it out. */
function boxPlanes(box: THREE.Box3, matrix: THREE.Matrix4, inward: boolean, out: THREE.Plane[]) {
  const s = inward ? -1 : 1;
  const faces: [THREE.Vector3, THREE.Vector3][] = [
    [new THREE.Vector3(s, 0, 0), new THREE.Vector3(box.max.x, 0, 0)],
    [new THREE.Vector3(-s, 0, 0), new THREE.Vector3(box.min.x, 0, 0)],
    [new THREE.Vector3(0, s, 0), new THREE.Vector3(0, box.max.y, 0)],
    [new THREE.Vector3(0, -s, 0), new THREE.Vector3(0, box.min.y, 0)],
    [new THREE.Vector3(0, 0, s), new THREE.Vector3(0, 0, box.max.z)],
    [new THREE.Vector3(0, 0, -s), new THREE.Vector3(0, 0, box.min.z)],
  ];
  // three.js clips a plane's negative side: outward normals cut the box out (with
  // clipIntersection), inward normals keep only the box.
  faces.forEach(([n, p], i) => out[i].setFromNormalAndCoplanarPoint(n, p).applyMatrix4(matrix));
}

/**
 * A Kenney car whose wheels roll and steer, and whose driver door (on the car's
 * left, +x) swings open and shut when someone gets in or out.
 * The door is cut out of the body with clipping planes and redrawn on a hinge.
 */
export function CarModel({ id, model, motion }: { id: string; model: string; motion?: React.RefObject<CarMotion> }) {
  const { scene } = useGLTF(`/models/cars/${model}.glb`);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.localClippingEnabled = true;
  }, [gl]);

  const rig = useMemo(() => {
    const root = scene.clone(true);
    const wheels: { node: THREE.Object3D; front: boolean }[] = [];
    let body: THREE.Mesh | null = null;
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
      if (/^wheel-(front|back)-(left|right)$/.test(o.name)) {
        o.rotation.order = "YXZ";
        wheels.push({ node: o, front: o.name.includes("front") });
      }
      if (o.name === "body" && mesh.isMesh) body = mesh;
    });
    if (!body) return { root, wheels, door: null };
    const b = body as THREE.Mesh;

    // The door: from just behind the front wheel arch back toward the rear arch, sill to roofline.
    b.geometry.computeBoundingBox();
    const bb = b.geometry.boundingBox!;
    const front = Math.min(...wheels.filter((w) => w.front).map((w) => w.node.position.z)) - b.position.z;
    const back = Math.max(...wheels.filter((w) => !w.front).map((w) => w.node.position.z)) - b.position.z;
    const zFront = front - WHEEL_RADIUS - 0.05;
    const zBack = Math.max(zFront - 0.78, back + WHEEL_RADIUS + 0.05);
    const height = bb.max.y - bb.min.y;
    const doorBox = new THREE.Box3(
      new THREE.Vector3(bb.max.x - 0.3, bb.min.y + height * 0.1, zBack),
      new THREE.Vector3(bb.max.x + 0.1, bb.min.y + height * 0.9, zFront),
    );

    const bodyMaterial = (b.material as THREE.MeshStandardMaterial).clone();
    const holePlanes = Array.from({ length: 6 }, () => new THREE.Plane());
    bodyMaterial.clippingPlanes = holePlanes;
    bodyMaterial.clipIntersection = true;
    b.material = bodyMaterial;

    const doorMaterial = bodyMaterial.clone();
    const doorPlanes = Array.from({ length: 6 }, () => new THREE.Plane());
    doorMaterial.clippingPlanes = doorPlanes;
    doorMaterial.clipIntersection = false;
    doorMaterial.side = THREE.DoubleSide;

    // Hinge on the front edge of the door; the door mesh shares the body's geometry and frame.
    const hinge = new THREE.Group();
    hinge.position.set(bb.max.x - 0.05, 0, zFront);
    const panel = new THREE.Mesh(b.geometry, doorMaterial);
    panel.position.set(-hinge.position.x, 0, -zFront);
    panel.castShadow = true;
    hinge.add(panel);
    hinge.visible = false;
    b.add(hinge);

    // A dark cabin behind the opening, so the open door doesn't show through the car.
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(bb.max.x * 2 - 0.25, height * 0.55, zFront - zBack + 0.2),
      new THREE.MeshStandardMaterial({ color: "#2a2440", roughness: 0.9 }),
    );
    cabin.position.set(0, bb.min.y + height * 0.4, (zFront + zBack) / 2);
    cabin.visible = false;
    b.add(cabin);

    return { root, wheels, door: { body: b, box: doorBox, hinge, panel, cabin, holePlanes, doorPlanes } };
  }, [scene]);

  const state = useMemo(() => ({ spin: 0, swingFrom: -1 }), []);

  // Swing the door whenever someone gets into or out of this car.
  useEffect(
    () =>
      useCityStore.subscribe((s, prev) => {
        if (s.doorSwing !== prev.doorSwing && s.doorSwing?.id === id) state.swingFrom = s.doorSwing.at;
      }),
    [id, state],
  );
  useEffect(() => {
    const swing = useCityStore.getState().doorSwing;
    if (swing?.id === id && performance.now() - swing.at < 300) state.swingFrom = swing.at;
  }, [id, state]);

  const far = useMemo(() => new THREE.Box3(new THREE.Vector3(0, -1e4, 0), new THREE.Vector3(0.01, -1e4 + 0.01, 0.01)), []);

  useFrame((_, delta) => {
    const m = motion?.current;
    if (m) {
      state.spin += (m.speed * delta) / (WHEEL_RADIUS * CAR_SCALE);
      for (const w of rig.wheels) {
        w.node.rotation.x = state.spin;
        w.node.rotation.y = w.front ? m.steer * 0.45 : 0;
      }
    }

    const door = rig.door;
    if (!door) return;
    const t = state.swingFrom < 0 ? Infinity : (performance.now() - state.swingFrom) / 1000;
    const ease = (x: number) => x * x * (3 - 2 * x);
    const open =
      t < OPEN ? ease(Math.max(0, t / OPEN)) : t < OPEN + HOLD ? 1 : t < OPEN + HOLD + CLOSE ? 1 - ease((t - OPEN - HOLD) / CLOSE) : 0;
    const showing = open > 0.001;
    door.hinge.visible = showing;
    door.cabin.visible = showing;
    door.hinge.rotation.y = -open * DOOR_ANGLE;
    door.body.updateMatrixWorld(true);
    // Closed: the hole box sits far underground, so nothing is cut and no shader recompiles.
    boxPlanes(showing ? door.box : far, door.body.matrixWorld, false, door.holePlanes);
    if (showing) boxPlanes(door.box, door.panel.matrixWorld, true, door.doorPlanes);
  });

  return <primitive object={rig.root} />;
}
