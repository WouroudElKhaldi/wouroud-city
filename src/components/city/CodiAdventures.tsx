"use client";

import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useCityStore } from "@/state/useCityStore";
import { sfx } from "@/world/sfx";
import { OnWall } from "./InteriorScene";
import { emitBurst } from "./Particles";
import { box, font, Panel, useCanvas, wrap } from "./roomKit";
import { Text } from "./Text3D";
import { useProximity } from "./useProximity";

/**
 * "Adventures with our mentors": the fun side of the Codi Tech bootcamp, along the campus's
 * right wall. A wall of polaroids (click one for its story), a foosball table you can play and
 * a mentor's riddle stand. The captions are general on purpose until the owner sends the real
 * stories and names (see ADVENTURES below; edit freely).
 */

export const ADVENTURES: { title: string; story: string; scene: "hike" | "night" | "lunch" | "stage" | "games" | "review"; color: string }[] = [
  { title: "Outings with our mentors", story: "Days out of the classroom with the mentors: fresh air, long talks about careers, and the best ideas came on the way back.", scene: "hike", color: "#22c55e" },
  { title: "Hackathon nights", story: "Late nights shipping features against the clock, pizza on the desks and mentors jumping in to unblock us.", scene: "night", color: "#2d6cdf" },
  { title: "Team lunches", story: "Lunch with the cohort and the mentors: manakish, laughs and whiteboard sketches on napkins.", scene: "lunch", color: "#f7941d" },
  { title: "Demo Day", story: "Presenting our apps on stage. Nervous for five minutes, proud for a long time.", scene: "stage", color: "#e6007e" },
  { title: "Game breaks", story: "Foosball and quick games between sprints: the mentors were suspiciously good at foosball.", scene: "games", color: "#ffc20e" },
  { title: "Code reviews with mentors", story: "Mentors reviewing our pull requests line by line. Tough love that made us real developers.", scene: "review", color: "#7b3fa0" },
];

const RIDDLES: [string, string][] = [
  ["I have keys but no locks, and I open with a click. What am I?", "A keyboard (or a JavaScript object, depending on the mentor)."],
  ["Why did the developer go broke?", "Because they used up all their cache."],
  ["What's a React developer's favorite hook at the beach?", "useWave() … no wait, useState(sunny)."],
  ["How many mentors does it take to fix a bug?", "One to fix it, and the whole cohort to say 'it works on my machine'."],
];

const pointer = {
  onPointerOver: () => (document.body.style.cursor = "pointer"),
  onPointerOut: () => (document.body.style.cursor = ""),
};

/** Draws one polaroid scene: a tiny illustration of the adventure. */
function drawScene(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, a: (typeof ADVENTURES)[number]) {
  const sky = ctx.createLinearGradient(0, y, 0, y + h);
  sky.addColorStop(0, a.scene === "night" ? "#1e1b4b" : "#bfe3ff");
  sky.addColorStop(1, a.scene === "night" ? "#312e81" : "#fef3c7");
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);
  const people = (count: number, baseY: number, color = "#24234a") => {
    for (let i = 0; i < count; i++) {
      const px = x + w * (0.2 + (i / Math.max(1, count - 1)) * 0.6);
      ctx.fillStyle = ["#f25c94", "#2d6cdf", "#f7941d", "#7b3fa0", "#22c55e"][i % 5];
      box(ctx, px - 12, baseY - 34, 24, 34, 8);
      ctx.fill();
      ctx.fillStyle = "#f1c9a5";
      ctx.beginPath();
      ctx.arc(px, baseY - 44, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.fillRect(px - 10, baseY - 54, 20, 6);
    }
  };
  switch (a.scene) {
    case "hike":
      ctx.fillStyle = "#4d7c3a";
      ctx.beginPath();
      ctx.moveTo(x, y + h * 0.75);
      ctx.lineTo(x + w * 0.35, y + h * 0.3);
      ctx.lineTo(x + w * 0.6, y + h * 0.6);
      ctx.lineTo(x + w * 0.8, y + h * 0.35);
      ctx.lineTo(x + w, y + h * 0.7);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.fill();
      people(4, y + h * 0.92);
      break;
    case "night":
      ctx.fillStyle = "#fde68a";
      for (let i = 0; i < 20; i++) ctx.fillRect(x + ((i * 37) % w), y + ((i * 23) % (h * 0.4)), 2, 2);
      ctx.fillStyle = "#111827";
      ctx.fillRect(x + w * 0.15, y + h * 0.55, w * 0.7, h * 0.12);
      ctx.fillStyle = "#60a5fa";
      for (let i = 0; i < 3; i++) ctx.fillRect(x + w * (0.2 + i * 0.22), y + h * 0.44, w * 0.16, h * 0.1);
      people(3, y + h * 0.95, "#111827");
      break;
    case "lunch":
      ctx.fillStyle = "#b45309";
      ctx.fillRect(x + w * 0.1, y + h * 0.6, w * 0.8, h * 0.08);
      ctx.fillStyle = "#fef3c7";
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(x + w * (0.2 + i * 0.2), y + h * 0.58, 14, 0, Math.PI * 2);
        ctx.fill();
      }
      people(5, y + h * 0.55);
      break;
    case "stage":
      ctx.fillStyle = "#e6007e";
      ctx.fillRect(x + w * 0.2, y + h * 0.15, w * 0.6, h * 0.35);
      ctx.fillStyle = "#ffffff";
      ctx.font = font(22, "800");
      ctx.textAlign = "center";
      ctx.fillText("DEMO DAY", x + w / 2, y + h * 0.36);
      ctx.textAlign = "left";
      ctx.fillStyle = "#374151";
      ctx.fillRect(x, y + h * 0.75, w, h * 0.25);
      people(2, y + h * 0.75);
      break;
    case "games":
      ctx.fillStyle = "#15803d";
      ctx.fillRect(x + w * 0.15, y + h * 0.45, w * 0.7, h * 0.25);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h * 0.57, 6, 0, Math.PI * 2);
      ctx.fill();
      people(4, y + h * 0.42);
      break;
    case "review":
      ctx.fillStyle = "#0b1020";
      ctx.fillRect(x + w * 0.2, y + h * 0.18, w * 0.6, h * 0.4);
      ctx.fillStyle = "#22c55e";
      for (let i = 0; i < 5; i++) ctx.fillRect(x + w * 0.25, y + h * (0.24 + i * 0.06), w * (0.2 + (i % 3) * 0.12), 5);
      people(2, y + h * 0.92);
      break;
  }
}

export function CodiAdventures({ wallX, depth }: { wallX: number; depth: number }) {
  const toast = useCityStore((s) => s.toast);
  const [picked, setPicked] = useState(-1);
  const cols = 3;
  const { texture } = useCanvas(
    1800,
    1200,
    (ctx, w, h) => {
      ctx.fillStyle = "#f6f1e7";
      ctx.fillRect(0, 0, w, h);
      // Cork texture.
      for (let i = 0; i < 1500; i++) {
        ctx.fillStyle = `rgba(150,110,60,${Math.random() * 0.15})`;
        ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3);
      }
      ctx.fillStyle = "#24234a";
      ctx.font = font(72, "800");
      ctx.fillText("Adventures with our mentors", 60, 110);
      ctx.font = font(32);
      ctx.fillStyle = "#6b7280";
      ctx.fillText("Codi Tech · Aug 2023 – Mar 2024 · click a photo", 60, 160);
      ADVENTURES.forEach((a, i) => {
        const cw = 500;
        const ch = 440;
        const x = 70 + (i % cols) * 570;
        const y = 210 + Math.floor(i / cols) * 490;
        ctx.save();
        ctx.translate(x + cw / 2, y + ch / 2);
        ctx.rotate(((i * 37) % 7 - 3) * 0.012);
        ctx.translate(-cw / 2, -ch / 2);
        ctx.fillStyle = "rgba(0,0,0,0.15)";
        ctx.fillRect(8, 10, cw, ch);
        ctx.fillStyle = i === picked ? "#fff7d6" : "#ffffff";
        ctx.fillRect(0, 0, cw, ch);
        drawScene(ctx, 24, 24, cw - 48, ch - 130, a);
        ctx.fillStyle = "#24234a";
        ctx.font = font(34, "700");
        wrap(ctx, a.title, 28, ch - 70, cw - 56, 38);
        ctx.fillStyle = a.color;
        ctx.beginPath();
        ctx.arc(cw / 2, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    },
    picked,
  );

  const pick = (i: number) => {
    setPicked(i);
    const a = ADVENTURES[i];
    toast(a.story, a.title);
    sfx.pop();
    emitBurst({ position: new THREE.Vector3(wallX - 0.5, 2.5, -6), kind: "petal", count: 20, colors: [a.color, "#ffffff", "#ffc20e"], spread: 1 });
  };

  const width = 7.8;
  const height = 5.2;
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6 || !e.uv) return;
    e.stopPropagation();
    // Which photo was clicked, from the click's spot on the board.
    const px = e.uv.x * 1800;
    const py = (1 - e.uv.y) * 1200;
    const col = Math.floor((px - 70) / 570);
    const row = Math.floor((py - 210) / 490);
    const i = row * cols + col;
    if (col >= 0 && col < cols && row >= 0 && i < ADVENTURES.length) pick(i);
  };
  const where = useMemo(() => new THREE.Vector3(wallX - 2.2, 0, -6), [wallX]);
  useProximity({ id: "codi-adventures", label: "Look at the adventure photos", radius: 2.4, where, run: () => pick((picked + 1) % ADVENTURES.length) });

  return (
    <group>
      <OnWall side="right">
        <Panel position={[wallX - 0.06, 2.5, -6]} rotationY={-Math.PI / 2} width={width} height={height} map={texture} frame="#8a6038" onClick={onClick} />
      </OnWall>
      <Foosball x={wallX - 4.2} z={-6.2} />
      <RiddleStand x={wallX - 2} z={-depth / 2 + 1.6} />
    </group>
  );
}

/** A foosball table: E or click shoots the ball; sometimes it's a goal. */
function Foosball({ x, z }: { x: number; z: number }) {
  const ball = useRef<THREE.Mesh>(null);
  const rods = useRef<THREE.Group>(null);
  const shot = useRef({ at: -10, dir: 1, goal: false });
  const [score, setScore] = useState([0, 0]);
  const shoot = () => {
    const goal = Math.random() < 0.45;
    const dir = Math.random() < 0.5 ? 1 : -1;
    shot.current = { at: performance.now() / 1000, dir, goal };
    sfx.kick();
    if (goal) {
      window.setTimeout(() => {
        sfx.coin();
        setScore((s) => (dir > 0 ? [s[0] + 1, s[1]] : [s[0], s[1] + 1]));
        emitBurst({ position: new THREE.Vector3(x, 1.2, z + dir * 0.7), kind: "sparkle", count: 20, colors: ["#ffc20e", "#ffffff"], spread: 0.5 });
      }, 450);
    }
  };
  const where = useMemo(() => new THREE.Vector3(x - 1.1, 0, z), [x, z]);
  useProximity({ id: "foosball", label: "Play foosball", radius: 1.8, where, run: shoot });
  useFrame(() => {
    const age = performance.now() / 1000 - shot.current.at;
    const s = shot.current;
    if (ball.current) {
      const k = Math.min(1, age / 0.45);
      const reach = s.goal ? 0.72 : 0.5;
      ball.current.position.z = age < 0.45 ? s.dir * reach * k : age < 1.2 && !s.goal ? s.dir * reach * (1 - (age - 0.45) / 0.75) : s.goal && age < 1.4 ? s.dir * reach : 0;
      ball.current.position.x = age < 0.45 ? Math.sin(k * 6) * 0.1 : 0;
    }
    if (rods.current) rods.current.rotation.z = age < 0.3 ? Math.sin((age / 0.3) * Math.PI) * 0.8 : 0;
  });
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.42, 0.45, 0.75]} position={[0, 0.45, 0]} />
      </RigidBody>
      <mesh position={[0, 0.75, 0]} castShadow>
        <boxGeometry args={[0.85, 0.22, 1.5]} />
        <meshStandardMaterial color="#24234a" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.865, 0]}>
        <boxGeometry args={[0.75, 0.01, 1.4]} />
        <meshStandardMaterial color="#15803d" roughness={0.9} />
      </mesh>
      {[-0.3, 0.3].map((lx) =>
        [-0.6, 0.6].map((lz) => (
          <mesh key={`${lx}${lz}`} position={[lx, 0.32, lz]} castShadow>
            <boxGeometry args={[0.08, 0.64, 0.08]} />
            <meshStandardMaterial color="#e6007e" />
          </mesh>
        )),
      )}
      <group
        ref={rods}
        onClick={(e) => {
          if (e.delta > 6) return;
          e.stopPropagation();
          shoot();
        }}
        {...pointer}
      >
        {[-0.45, -0.15, 0.15, 0.45].map((rz, i) => (
          <group key={rz} position={[0, 0.95, rz]}>
            <mesh rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.012, 0.012, 1.1, 8]} />
              <meshStandardMaterial color="#c0c4cc" metalness={0.9} roughness={0.2} />
            </mesh>
            {[-0.2, 0, 0.2].map((px) => (
              <mesh key={px} position={[px, -0.05, 0]}>
                <boxGeometry args={[0.04, 0.12, 0.03]} />
                <meshStandardMaterial color={i % 2 ? "#2d6cdf" : "#f7941d"} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
      <mesh ref={ball} position={[0, 0.885, 0]}>
        <sphereGeometry args={[0.025, 12, 10]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <Text position={[0, 1.3, 0]} rotation-y={-Math.PI / 2} fontSize={0.14} color="#24234a" anchorX="center">
        {`Orange ${score[0]} : ${score[1]} Blue`}
      </Text>
    </group>
  );
}

/** A mentor's riddle on a little stand: E or click for a riddle, again for the answer. */
function RiddleStand({ x, z }: { x: number; z: number }) {
  const toast = useCityStore((s) => s.toast);
  const step = useRef(0);
  const ask = () => {
    const n = step.current++;
    const [q, a] = RIDDLES[Math.floor(n / 2) % RIDDLES.length];
    toast(n % 2 === 0 ? q : a, n % 2 === 0 ? "A mentor's riddle" : "Answer");
    sfx.click();
  };
  const where = useMemo(() => new THREE.Vector3(x, 0, z + 1.1), [x, z]);
  useProximity({ id: "codi-riddle", label: "Ask a mentor's riddle", radius: 1.8, where, run: ask });
  return (
    <group
      position={[x, 0, z]}
      onClick={(e) => {
        if (e.delta > 6) return;
        e.stopPropagation();
        ask();
      }}
      {...pointer}
    >
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.08, 1.1, 12]} />
        <meshStandardMaterial color="#24234a" />
      </mesh>
      <mesh position={[0, 1.25, 0]} rotation-x={-0.3} castShadow>
        <boxGeometry args={[0.9, 0.6, 0.05]} />
        <meshStandardMaterial color="#ffc20e" />
      </mesh>
      <Text position={[0, 1.26, 0.04]} rotation-x={-0.3} fontSize={0.09} color="#24234a" anchorX="center" anchorY="middle" maxWidth={0.8} textAlign="center">
        {"Mentor's riddle\nPress E"}
      </Text>
    </group>
  );
}
