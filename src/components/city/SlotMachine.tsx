"use client";

import { Text } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useCityStore } from "@/state/useCityStore";
import { accents } from "@/world/palette";
import { emitBurst } from "./Particles";
import { useProximity } from "./useProximity";

/**
 * A crypto slot machine. Walk up and press E (or click the lever): the three reels
 * spin and stop one after another. Three of a kind pays by the table, any pair
 * pays double the bet. Credits refill when they run out — it's only for fun.
 */

const SYMBOLS = ["₿", "Ξ", "🚀", "💎", "🐂", "7"];
const PAYOUT: Record<string, number> = { "🚀": 50, "💎": 30, "₿": 20, "7": 15, "Ξ": 10, "🐂": 8 };
const BET = 10;
const START_CREDITS = 100;
const REEL_RADIUS = 0.26;
const STOP_AT = [1.1, 1.6, 2.1];
const SLICE = (Math.PI * 2) / SYMBOLS.length;

/** The reel strip: the symbols around the cylinder, each drawn turned to read upright on the drum. */
function reelTexture() {
  const cell = 128;
  const canvas = document.createElement("canvas");
  canvas.width = cell * SYMBOLS.length;
  canvas.height = cell;
  const ctx = canvas.getContext("2d")!;
  SYMBOLS.forEach((s, i) => {
    ctx.fillStyle = i % 2 ? "#fffaf0" : "#f5f0ff";
    ctx.fillRect(i * cell, 0, cell, cell);
    ctx.save();
    ctx.translate(i * cell + cell / 2, cell / 2);
    ctx.rotate(Math.PI / 2);
    ctx.font = `bold ${s === "₿" || s === "Ξ" || s === "7" ? 96 : 84}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = s === "₿" ? "#f7931a" : s === "Ξ" ? "#6272c3" : s === "7" ? "#dc2626" : "#111827";
    ctx.fillText(s, 0, 6);
    ctx.restore();
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Drum angle that shows symbol `i` at the front. */
const faceAngle = (i: number) => (i + 0.5) * SLICE;

type Spin = { start: number; from: number[]; to: number[]; result: number[] };

export function SlotMachine({ position, rotationY = 0 }: { position: [number, number, number]; rotationY?: number }) {
  const texture = useMemo(reelTexture, []);
  useEffect(() => () => texture.dispose(), [texture]);
  const reels = useRef<(THREE.Group | null)[]>([]);
  const lever = useRef<THREE.Group>(null);
  const lights = useMemo(() => Array.from({ length: 10 }, () => new THREE.MeshBasicMaterial({ color: accents.gold, toneMapped: false })), []);
  const angles = useRef([faceAngle(0), faceAngle(3), faceAngle(5)]);
  const spin = useRef<Spin | null>(null);
  const pending = useRef(false);
  const winFlash = useRef(-10);
  const [credits, setCredits] = useState(START_CREDITS);
  const [message, setMessage] = useState("Press E to play");
  const creditsRef = useRef(START_CREDITS);
  creditsRef.current = credits;

  const play = () => {
    if (spin.current || pending.current) return;
    if (creditsRef.current < BET) {
      setCredits(START_CREDITS);
      useCityStore.getState().toast(`Free refill: ${START_CREDITS} credits`, "Crypto Slots");
    }
    setCredits((c) => Math.max(c, BET) - BET);
    setMessage("Spinning…");
    pending.current = true;
  };

  // The front of the machine, in world space, for the E prompt.
  const where = useMemo(() => {
    const v = new THREE.Vector3(0, 0, 1.1).applyAxisAngle(THREE.Object3D.DEFAULT_UP, rotationY);
    return v.add(new THREE.Vector3(...position));
  }, [position, rotationY]);
  useProximity({ id: "slot-machine", label: `Play Crypto Slots (${BET} credits)`, radius: 1.8, where, run: play });

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (pending.current) {
      pending.current = false;
      const result = [0, 1, 2].map(() => Math.floor(Math.random() * SYMBOLS.length));
      const from = [...angles.current];
      // Spin forward several full turns, landing exactly on the result.
      const to = from.map((a, i) => {
        const base = a + Math.PI * 2 * (3 + i);
        const target = faceAngle(result[i]);
        const extra = (((target - base) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        return base + extra;
      });
      spin.current = { start: t, from, to, result };
    }

    const s = spin.current;
    if (s) {
      const age = t - s.start;
      s.to.forEach((to, i) => {
        const k = Math.min(1, age / STOP_AT[i]);
        // Fast start, gentle settle with a tiny bounce at the end.
        const ease = 1 - Math.pow(1 - k, 3);
        angles.current[i] = s.from[i] + (to - s.from[i]) * ease;
      });
      if (age >= STOP_AT[2]) {
        spin.current = null;
        settle(s.result, t);
      }
    }
    reels.current.forEach((r, i) => r && (r.rotation.x = angles.current[i]));

    // Lever: down while the reels start, then back up.
    if (lever.current) {
      const age = s ? t - s.start : 10;
      lever.current.rotation.x = age < 0.35 ? (age / 0.35) * 1.1 : age < 0.7 ? (1 - (age - 0.35) / 0.35) * 1.1 : 0;
    }

    // Marquee lights chase; they flash together after a win.
    const flashing = t - winFlash.current < 2.5;
    lights.forEach((m, i) => {
      const on = flashing ? Math.floor(t * 8) % 2 === 0 : Math.floor(t * 4 + i) % 3 === 0;
      m.color.set(on ? accents.gold : "#5b4a8a");
    });
  });

  const settle = (result: number[], t: number) => {
    const [a, b, c] = result.map((i) => SYMBOLS[i]);
    let win = 0;
    if (a === b && b === c) win = BET * PAYOUT[a];
    else if (a === b || b === c || a === c) win = BET * 2;
    if (win > 0) {
      setCredits((x) => x + win);
      setMessage(a === b && b === c ? `JACKPOT ${a}${b}${c}  +${win}` : `Pair!  +${win}`);
      winFlash.current = t;
      const p = new THREE.Vector3(...position).add(new THREE.Vector3(0, 2.2, 0.4).applyAxisAngle(THREE.Object3D.DEFAULT_UP, rotationY));
      emitBurst({ position: p, kind: "sparkle", count: a === b && b === c ? 40 : 16, colors: [accents.gold, "#f7931a", accents.mint], spread: 0.9 });
      if (a === b && b === c) useCityStore.getState().toast(`Three ${a}! You won ${win} credits.`, "Jackpot!");
    } else {
      setMessage("No luck — try again!");
    }
  };

  const cabinet = "#4c1d95";
  return (
    <group position={position} rotation-y={rotationY}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.6, 1, 0.45]} position={[0, 1, 0]} />
      </RigidBody>
      {/* Cabinet */}
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 1, 0.9]} />
        <meshStandardMaterial color={cabinet} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.35, -0.08]} castShadow>
        <boxGeometry args={[1.2, 0.7, 0.74]} />
        <meshStandardMaterial color={cabinet} roughness={0.5} />
      </mesh>
      {/* Gold trim and the play shelf */}
      <mesh position={[0, 1.0, 0.4]} castShadow>
        <boxGeometry args={[1.24, 0.08, 0.2]} />
        <meshStandardMaterial color={accents.gold} metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Reel window: a gold bezel the drums turn behind */}
      {[
        [0, 1.65, 1.08, 0.06],
        [0, 1.11, 1.08, 0.06],
        [-0.51, 1.38, 0.06, 0.6],
        [0.51, 1.38, 0.06, 0.6],
        [-0.16, 1.38, 0.03, 0.5],
        [0.16, 1.38, 0.03, 0.5],
      ].map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, 0.45]} castShadow>
          <boxGeometry args={[w, h, 0.05]} />
          <meshStandardMaterial color={accents.gold} metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
      {[-0.32, 0, 0.32].map((x, i) => (
        <group key={x} position={[x, 1.38, 0.17]} ref={(g) => void (reels.current[i] = g)}>
          <mesh rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[REEL_RADIUS, REEL_RADIUS, 0.28, SYMBOLS.length * 6, 1, true]} />
            <meshStandardMaterial map={texture} roughness={0.4} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      {/* Glass over the reels and a pay line */}
      <mesh position={[0, 1.38, 0.455]}>
        <planeGeometry args={[1.0, 0.5]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.08} roughness={0.05} />
      </mesh>
      <mesh position={[0, 1.38, 0.46]}>
        <planeGeometry args={[1.0, 0.012]} />
        <meshBasicMaterial color="#ef4444" toneMapped={false} />
      </mesh>
      {/* Marquee with chasing lights */}
      <group position={[0, 1.92, -0.05]}>
        <mesh castShadow>
          <boxGeometry args={[1.3, 0.42, 0.6]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
        <Text position={[0, 0.02, 0.31]} fontSize={0.15} color={accents.gold} anchorX="center" anchorY="middle" outlineWidth={0.008} outlineColor="#7c2d12">
          CRYPTO SLOTS
        </Text>
        {lights.map((m, i) => (
          <mesh key={i} position={[-0.58 + i * 0.129, i % 2 ? 0.17 : -0.17, 0.31]} material={m}>
            <sphereGeometry args={[0.025, 8, 8]} />
          </mesh>
        ))}
      </group>
      {/* Credits and message display */}
      <mesh position={[0, 0.85, 0.455]}>
        <planeGeometry args={[0.9, 0.22]} />
        <meshBasicMaterial color="#0b1020" />
      </mesh>
      <Text position={[0, 0.89, 0.46]} fontSize={0.065} color="#22c55e" anchorX="center" anchorY="middle">
        {`CREDITS ${credits}   BET ${BET}`}
      </Text>
      <Text position={[0, 0.8, 0.46]} fontSize={0.05} color="#fde68a" anchorX="center" anchorY="middle">
        {message}
      </Text>
      {/* Pay table */}
      <Text position={[0, 0.45, 0.455]} fontSize={0.055} color="#e9d8fd" anchorX="center" anchorY="middle" textAlign="center" lineHeight={1.3}>
        {"🚀×50  💎×30  ₿×20\n7×15  Ξ×10  🐂×8\nany pair ×2"}
      </Text>
      {/* Lever on the right side: click it to play */}
      <group
        ref={lever}
        position={[0.66, 1.15, 0.05]}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          play();
        }}
      >
        <mesh position={[0, 0.28, 0]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, 0.56, 10]} />
          <meshStandardMaterial color="#d1d5db" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.58, 0]} castShadow>
          <sphereGeometry args={[0.075, 16, 12]} />
          <meshStandardMaterial color="#ef4444" roughness={0.3} />
        </mesh>
      </group>
      <mesh position={[0.63, 1.15, 0.05]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.06, 0.06, 0.08, 16]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.8} />
      </mesh>
    </group>
  );
}
