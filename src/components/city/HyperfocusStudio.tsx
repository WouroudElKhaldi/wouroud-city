"use client";

import { type ThreeEvent, useFrame, useLoader } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { Suspense, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Project } from "@/content/schema";
import { useCityStore } from "@/state/useCityStore";
import { sfx } from "@/world/sfx";
import { Rug, Sofa, sofaSeats, Table, TallPlant } from "./Furniture";
import { HighlightWall, OnWall, TechTiles, useRoom } from "./InteriorScene";
import { emitBurst } from "./Particles";
import { box, font, Panel, useCanvas, wrap } from "./roomKit";
import { Seats } from "./StreetDetails";
import { Text } from "./Text3D";
import { useProximity } from "./useProximity";

/**
 * The Hyperfocus studio, built from the app itself: "a planning, focus and career app built
 * for ADHD brains". The big screen walks through its features tab by tab; the companion pet
 * gains XP when you play with it; the music player makes a new track live in the browser (as
 * the app does); a focus timer runs a short sprint; and the screenshot wall shows the app's
 * real screenshots, the images listed in the project's `media` (public/images/projects/...).
 */

const FEATURES = [
  { tab: "Capture", line: "Dump every thought the moment it appears, sort it later", color: "#8b5cf6" },
  { tab: "Plan the day", line: "Turn the brain dump into today's short, doable list", color: "#06b6d4" },
  { tab: "Goals & skills", line: "Track goals and the skills that get you there", color: "#22c55e" },
  { tab: "LinkedIn posts", line: "Turn ideas into LinkedIn posts with AI", color: "#0a66c2" },
  { tab: "Calendar", line: "Everything on one calendar, nothing forgotten", color: "#f59e0b" },
  { tab: "Study log", line: "Log what you study and watch it add up", color: "#ec4899" },
  { tab: "Job applications", line: "Every application, status and follow-up in one place", color: "#14b8a6" },
  { tab: "AI chat", line: "An assistant that knows your plans and goals", color: "#a855f7" },
  { tab: "Companion pet", line: "A pet that earns XP when you get things done", color: "#f97316" },
  { tab: "Music", line: "80+ focus tracks, generated live in the browser", color: "#ef4444" },
];

const pointer = {
  onPointerOver: () => (document.body.style.cursor = "pointer"),
  onPointerOut: () => (document.body.style.cursor = ""),
};

export function HyperfocusStudio({ project, accent }: { project: Project; accent: string }) {
  const { width: W, depth: D } = useRoom();
  const seats = useMemo(() => sofaSeats("hf-sofa", -5.5, 3.4, Math.PI, 2.2), []);
  return (
    <group>
      <AppScreen project={project} />
      <Pet x={-3.5} z={-3.2} />
      <MusicPlayer x={3.6} z={-3.2} accent={accent} />
      <FocusTimer x={6.5} z={0.6} />
      <OnWall side="left">
        <HighlightWall items={[...project.description, ...project.highlights]} accent={accent} title="About Hyperfocus" />
      </OnWall>
      <OnWall side="right">
        <Screenshots media={project.media} accent={accent} />
        <TechTiles tech={project.tech} position={[W / 2 - 0.05, 0.3, 4.2]} rotationY={-Math.PI / 2} length={6} />
      </OnWall>
      <Rug position={[-5.5, 2.6]} width={3.6} depth={3} color="#1e1b4b" />
      <Sofa position={[-5.5, 0, 3.4]} facing={Math.PI} leather="navy" />
      <Table position={[-5.5, 0, 2.2]} width={1.1} depth={0.6} height={0.42} />
      <Seats seats={seats} />
      <TallPlant position={[W / 2 - 1.2, 0, -D / 2 + 1.2]} seed={51} />
    </group>
  );
}

/** The app on the back wall: click (or E) to go through the features. */
function AppScreen({ project }: { project: Project }) {
  const { depth: D } = useRoom();
  const [tab, setTab] = useState(0);
  const f = FEATURES[tab];
  const { texture } = useCanvas(
    1920,
    1080,
    (ctx, w, h) => {
      ctx.fillStyle = "#0f0d1a";
      ctx.fillRect(0, 0, w, h);
      // Sidebar with every feature.
      box(ctx, 0, 0, 430, h, 0, "#17142a");
      ctx.fillStyle = "#ffffff";
      ctx.font = font(52, "800");
      ctx.fillText("Hyperfocus", 40, 90);
      ctx.fillStyle = "#a5a3c9";
      ctx.font = font(26);
      ctx.fillText("for ADHD brains", 40, 130);
      FEATURES.forEach((x, i) => {
        const y = 190 + i * 84;
        if (i === tab) box(ctx, 20, y - 50, 390, 70, 16, x.color);
        ctx.fillStyle = i === tab ? "#ffffff" : "#cfcde8";
        ctx.font = font(32, i === tab ? "700" : "");
        ctx.fillText(x.tab, 50, y);
      });
      // Main panel for the selected feature.
      ctx.fillStyle = f.color;
      ctx.font = font(30, "700");
      ctx.fillText(f.tab.toUpperCase(), 500, 110);
      ctx.fillStyle = "#ffffff";
      ctx.font = font(64, "800");
      wrap(ctx, f.line, 500, 200, w - 580, 74);
      // A friendly mock of the screen: cards, a progress ring, checkboxes.
      for (let i = 0; i < 3; i++) {
        box(ctx, 500 + i * 450, 430, 420, 420, 28, "#1c1932");
        box(ctx, 530 + i * 450, 460, 120, 16, 8, f.color);
        for (let k = 0; k < 4; k++) {
          box(ctx, 530 + i * 450, 520 + k * 72, 34, 34, 8, k < 2 - i + 2 ? f.color : undefined, "#4b4870");
          box(ctx, 590 + i * 450, 528 + k * 72, 260 - k * 30, 18, 9, "#34304f");
        }
      }
      ctx.fillStyle = "#a5a3c9";
      ctx.font = font(30);
      ctx.fillText(`${project.role} · ${project.year} · click for the next feature`, 500, 960);
    },
    tab,
  );
  const next = () => {
    setTab((t) => (t + 1) % FEATURES.length);
    sfx.click();
  };
  const where = useMemo(() => new THREE.Vector3(0, 0, -D / 2 + 4.2), [D]);
  useProximity({ id: "hf-screen", label: "Show the next Hyperfocus feature", radius: 2.2, where, run: next });
  return (
    <OnWall side="back">
      <Panel
        position={[0, 2.85, -D / 2 + 0.06]}
        width={8.2}
        height={4.6}
        map={texture}
        frame="#111"
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (e.delta > 6) return;
          e.stopPropagation();
          next();
        }}
      />
    </OnWall>
  );
}

/** The companion pet: a round little creature that bounces, earns XP and levels up. */
function Pet({ x, z }: { x: number; z: number }) {
  const body = useRef<THREE.Group>(null);
  const [xp, setXp] = useState(0);
  const level = Math.floor(xp / 50) + 1;
  const hop = useRef(-10);
  const play = () => {
    hop.current = performance.now() / 1000;
    const next = xp + 15;
    setXp(next);
    sfx.chirp();
    if (Math.floor(next / 50) > Math.floor(xp / 50)) {
      sfx.coin();
      emitBurst({ position: new THREE.Vector3(x, 1.8, z), kind: "sparkle", count: 30, colors: ["#f97316", "#fde68a", "#ffffff"], spread: 0.8 });
      useCityStore.getState().toast(`Your Hyperfocus pet reached level ${Math.floor(next / 50) + 1}! In the app it levels up when you finish tasks.`, "Level up!");
    }
  };
  const where = useMemo(() => new THREE.Vector3(x, 0, z + 1.5), [x, z]);
  useProximity({ id: "hf-pet", label: "Play with the companion pet", radius: 2, where, run: play });
  useFrame(() => {
    const t = performance.now() / 1000;
    const age = t - hop.current;
    if (body.current) {
      body.current.position.y = 0.95 + (age < 0.5 ? Math.sin((age / 0.5) * Math.PI) * 0.5 : Math.abs(Math.sin(t * 2)) * 0.05);
      body.current.rotation.y = Math.sin(t * 0.8) * 0.4;
      const s = 0.8 + Math.min(level, 6) * 0.08;
      body.current.scale.setScalar(s);
    }
  });
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.6, 0.4, 0.6]} position={[0, 0.4, 0]} />
      </RigidBody>
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.6, 0.7, 0.8, 32]} />
        <meshStandardMaterial color="#1c1932" roughness={0.4} />
      </mesh>
      <group
        ref={body}
        onClick={(e) => {
          if (e.delta > 6) return;
          e.stopPropagation();
          play();
        }}
        {...pointer}
      >
        <mesh castShadow>
          <sphereGeometry args={[0.32, 32, 24]} />
          <meshStandardMaterial color="#f97316" roughness={0.5} />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh position={[s * 0.11, 0.08, 0.27]}>
              <sphereGeometry args={[0.07, 16, 12]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            <mesh position={[s * 0.11, 0.08, 0.33]}>
              <sphereGeometry args={[0.035, 12, 10]} />
              <meshStandardMaterial color="#111" />
            </mesh>
            <mesh position={[s * 0.2, 0.32, 0]} rotation-z={s * -0.4}>
              <coneGeometry args={[0.07, 0.18, 12]} />
              <meshStandardMaterial color="#f97316" />
            </mesh>
          </group>
        ))}
      </group>
      <Text position={[0, 1.75, 0]} fontSize={0.16} color="#1a103d" anchorX="center">
        {`Level ${level} · ${xp % 50}/50 XP`}
      </Text>
    </group>
  );
}

/** A music player that plays a freshly generated track, like the app's 80+ live tracks. */
function MusicPlayer({ x, z, accent }: { x: number; z: number; accent: string }) {
  const [n, setN] = useState(0);
  const bars = useRef<THREE.Mesh[]>([]);
  const playingAt = useRef(-10);
  const play = () => {
    const next = n + 1;
    setN(next);
    playingAt.current = performance.now() / 1000;
    sfx.track(next);
  };
  const where = useMemo(() => new THREE.Vector3(x, 0, z + 1.5), [x, z]);
  useProximity({ id: "hf-music", label: "Play a generated focus track", radius: 2, where, run: play });
  useFrame(() => {
    const t = performance.now() / 1000;
    const on = t - playingAt.current < 4.8;
    bars.current.forEach((b, i) => {
      b.scale.y = on ? 0.3 + Math.abs(Math.sin(t * (6 + i) + i)) * 1.4 : 0.3;
    });
  });
  return (
    <group
      position={[x, 0, z]}
      onClick={(e) => {
        if (e.delta > 6) return;
        e.stopPropagation();
        play();
      }}
      {...pointer}
    >
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.7, 0.4, 0.5]} position={[0, 0.4, 0]} />
      </RigidBody>
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[1.4, 0.8, 1]} />
        <meshStandardMaterial color="#1c1932" roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.1, 0]} castShadow>
        <boxGeometry args={[1.2, 0.6, 0.35]} />
        <meshStandardMaterial color="#2a2540" roughness={0.3} />
      </mesh>
      {[-0.38, 0.38].map((sx) => (
        <mesh key={sx} position={[sx, 1.1, 0.18]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.17, 0.17, 0.02, 24]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      ))}
      {Array.from({ length: 5 }, (_, i) => (
        <mesh key={i} ref={(m) => void (m && (bars.current[i] = m))} position={[-0.16 + i * 0.08, 1.1, 0.18]}>
          <boxGeometry args={[0.05, 0.25, 0.02]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.5} toneMapped={false} />
        </mesh>
      ))}
      <Text position={[0, 1.6, 0]} fontSize={0.14} color="#1a103d" anchorX="center">
        {n ? `Track #${n} · generated live` : "Click for a focus track"}
      </Text>
    </group>
  );
}

/** A focus timer: a 25-second sprint (the app's are 25 minutes). */
function FocusTimer({ x, z }: { x: number; z: number }) {
  const [left, setLeft] = useState<number | null>(null);
  const timer = useRef<number | null>(null);
  const start = () => {
    if (timer.current) return;
    setLeft(25);
    sfx.click();
    timer.current = window.setInterval(() => {
      setLeft((l) => {
        if (l === null) return null;
        if (l <= 1) {
          if (timer.current) window.clearInterval(timer.current);
          timer.current = null;
          sfx.coin();
          useCityStore.getState().toast("Focus sprint done! In Hyperfocus that's 25 minutes, then a break and XP for your pet.", "Hyperfocus");
          return null;
        }
        return l - 1;
      });
    }, 1000);
  };
  const where = useMemo(() => new THREE.Vector3(x, 0, z + 1.3), [x, z]);
  useProximity({ id: "hf-timer", label: "Start a focus sprint", radius: 1.8, where, run: start });
  return (
    <group
      position={[x, 0, z]}
      onClick={(e) => {
        if (e.delta > 6) return;
        e.stopPropagation();
        start();
      }}
      {...pointer}
    >
      <Table position={[0, 0, 0]} width={1.2} depth={0.7} top="marbleBlack" />
      <mesh position={[0, 1.0, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.22, 0.04, 12, 48]} />
        <meshStandardMaterial color="#8b5cf6" emissive="#8b5cf6" emissiveIntensity={left !== null ? 2 : 0.4} toneMapped={false} />
      </mesh>
      <Text position={[0, 1.02, 0.05]} fontSize={0.13} color="#1a103d" anchorX="center" anchorY="middle">
        {left !== null ? `${left}s` : "Focus"}
      </Text>
    </group>
  );
}

/** The app's screenshots (project.media), or frames waiting for them. */
function Screenshots({ media, accent }: { media: string[]; accent: string }) {
  const { width: W } = useRoom();
  const shots = media.filter((m) => /\.(png|jpe?g|webp)$/i.test(m)).slice(0, 3);
  const empty = useCanvas(1200, 750, (ctx, w, h) => {
    ctx.fillStyle = "#17142a";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = accent;
    ctx.setLineDash([24, 16]);
    ctx.lineWidth = 6;
    ctx.strokeRect(30, 30, w - 60, h - 60);
    ctx.fillStyle = "#cfcde8";
    ctx.font = font(48, "700");
    ctx.textAlign = "center";
    ctx.fillText("Screenshots of the app", w / 2, h / 2 - 20);
    ctx.font = font(30);
    ctx.fillText("coming from the Hyperfocus app", w / 2, h / 2 + 34);
  });
  return (
    <group>
      {[-5.5, -1.6].map((z, i) =>
        shots[i] ? (
          <Suspense key={z} fallback={null}>
            <Shot url={shots[i]} position={[W / 2 - 0.06, 2.7, z]} />
          </Suspense>
        ) : (
          <Panel key={z} position={[W / 2 - 0.06, 2.7, z]} rotationY={-Math.PI / 2} width={3.4} height={2.1} map={empty.texture} frame="#111" />
        ),
      )}
    </group>
  );
}

function Shot({ url, position }: { url: string; position: [number, number, number] }) {
  const tex = useLoader(THREE.TextureLoader, url);
  tex.colorSpace = THREE.SRGBColorSpace;
  const img = tex.image as { width: number; height: number } | undefined;
  const aspect = img ? img.width / img.height : 16 / 10;
  return <Panel position={position} rotationY={-Math.PI / 2} width={2.1 * aspect} height={2.1} map={tex} frame="#111" />;
}
