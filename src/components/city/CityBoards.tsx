"use client";

import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { type Note, type ScoreGame, useLiveData } from "@/state/liveData";
import { useCityStore } from "@/state/useCityStore";
import { box, font, Panel, useCanvas, wrap } from "./roomKit";
import { surface } from "./surfaces";
import { Text } from "./Text3D";
import { useProximity } from "./useProximity";

/**
 * What visitors leave behind, shown in the city itself:
 *  - the guestbook stand by the hub fountain: a board with the newest notes and a lectern with an
 *    open book; press E to read them all and sign (hud/Guestbook.tsx)
 *  - the Hall of Fame on the Arcade Pier, beside the rally's start line: the top 3 of each game
 * Both refresh every couple of minutes and after you sign or save a score.
 */

const REFRESH_MS = 120_000;

function useRefresh(load: () => Promise<void>) {
  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(t);
  }, [load]);
}

const IRON = new THREE.MeshStandardMaterial({ color: "#23222a", metalness: 0.75, roughness: 0.4 });

/** Two cast-iron posts holding a board, like a notice board in a park. */
function Posts({ width, height, top }: { width: number; height: number; top: number }) {
  return (
    <>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (width / 2 + 0.08), top / 2, -0.05]} material={IRON} castShadow>
          <cylinderGeometry args={[0.05, 0.065, top, 12]} />
        </mesh>
      ))}
      <mesh position={[0, top - height / 2 - 0.06 + height + 0.1, -0.05]} material={IRON} castShadow>
        <boxGeometry args={[width + 0.4, 0.08, 0.16]} />
      </mesh>
    </>
  );
}

const ago = (at: string) => {
  const days = Math.floor((Date.now() - new Date(at).getTime()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : days < 30 ? `${days} days ago` : new Date(at).toLocaleDateString("en", { month: "short", year: "numeric" });
};

function drawNotes(ctx: CanvasRenderingContext2D, w: number, h: number, notes: Note[] | null, offline: boolean) {
  ctx.fillStyle = "#f7efe0";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#d53f8c";
  ctx.fillRect(0, 0, w, 16);
  ctx.fillStyle = "#7c3aed";
  ctx.font = font(34, "700");
  ctx.fillText("THE CITY GUESTBOOK", 40, 70);
  ctx.fillStyle = "#1a103d";
  ctx.font = font(64, "800");
  ctx.fillText("Notes from visitors", 40, 146);
  ctx.font = font(30);
  ctx.fillStyle = "#6b5f80";
  ctx.fillText("Press E at the lectern to read them all and sign", 40, 196);
  let y = 250;
  if (!notes || notes.length === 0) {
    ctx.font = font(40);
    ctx.fillStyle = "#3a3150";
    ctx.fillText(offline ? "The guestbook is resting right now." : notes ? "No notes yet. Be the first to sign!" : "Loading…", 40, y + 40);
    return;
  }
  const colors = ["#fde68a", "#bae6fd", "#fbcfe8", "#bbf7d0", "#ddd6fe"];
  notes.slice(0, 5).forEach((n, i) => {
    if (y > h - 120) return;
    // A sticky note per message.
    const top = y;
    ctx.font = font(36);
    const lines: string[] = [];
    let row = "";
    for (const word of n.message.split(" ")) {
      const next = row ? `${row} ${word}` : word;
      if (ctx.measureText(next).width > w - 140 && row) {
        lines.push(row);
        row = word;
      } else row = next;
    }
    if (row) lines.push(row);
    const shown = lines.slice(0, 3);
    if (lines.length > 3) shown[2] = `${shown[2].slice(0, -1)}…`;
    const height = 40 + shown.length * 44 + 46;
    if (top + height > h - 20) return;
    box(ctx, 30, top, w - 60, height, 14, colors[i % colors.length]);
    ctx.fillStyle = "#1a103d";
    shown.forEach((l, k) => ctx.fillText(l, 60, top + 54 + k * 44));
    ctx.font = font(28, "700");
    ctx.fillStyle = "#7c2d5a";
    ctx.fillText(`— ${n.name}${n.from ? `, ${n.from}` : ""} · ${ago(n.at)}`, 60, top + height - 22);
    y = top + height + 18;
  });
}

/** The guestbook by the hub fountain. Faces +z in its own frame. */
export function GuestbookStand({ x, z, facing }: { x: number; z: number; facing: number }) {
  const notes = useLiveData((s) => s.notes);
  const offline = useLiveData((s) => s.notesOffline);
  const loadNotes = useLiveData((s) => s.loadNotes);
  useRefresh(loadNotes);
  const key = `${offline}|${notes?.map((n) => n.at).join(",") ?? "loading"}`;
  const { texture } = useCanvas(900, 1200, (ctx, w, h) => drawNotes(ctx, w, h, notes, offline), key);
  // The lectern sits in front of the board; that's where E works.
  const lectern = useMemo(() => new THREE.Vector3(x + Math.sin(facing) * 1.1, 0, z + Math.cos(facing) * 1.1), [x, z, facing]);
  useProximity({
    id: "guestbook",
    label: "Sign the guestbook",
    radius: 2.4,
    where: lectern,
    run: () => useCityStore.getState().setActivity("guestbook"),
  });
  return (
    <group position={[x, 0, z]} rotation-y={facing}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.95, 1.2, 0.12]} position={[0, 1.2, -0.05]} />
        <CuboidCollider args={[0.3, 0.55, 0.25]} position={[0, 0.55, 1.1]} />
      </RigidBody>
      <Posts width={1.5} height={2} top={2.75} />
      <Panel position={[0, 1.65, 0]} width={1.5} height={2} map={texture} frame="#5b3a22" />
      <Text position={[0, 2.85, 0.03]} fontSize={0.16} color="#fde68a" outlineWidth={0.012} outlineColor="#1a103d" anchorX="center" anchorY="middle">
        GUESTBOOK
      </Text>
      {/* Lectern with an open book */}
      <group position={[0, 0, 1.1]} rotation-y={Math.PI}>
        <mesh position={[0, 0.5, 0]} material={surface("wood", "#6b4428")} castShadow>
          <boxGeometry args={[0.18, 1, 0.18]} />
        </mesh>
        <mesh position={[0, 0.03, 0]} material={IRON} receiveShadow>
          <cylinderGeometry args={[0.32, 0.36, 0.06, 20]} />
        </mesh>
        <group position={[0, 1.05, 0]} rotation-x={-0.35}>
          <mesh material={surface("wood", "#5a3820")} castShadow>
            <boxGeometry args={[0.62, 0.05, 0.44]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.14, 0.04, 0]} rotation-z={s * -0.06}>
              <boxGeometry args={[0.27, 0.025, 0.36]} />
              <meshStandardMaterial color="#fbf6ea" roughness={0.9} />
            </mesh>
          ))}
          <mesh position={[0.2, 0.07, 0.08]} rotation-z={0.5} rotation-y={0.6}>
            <cylinderGeometry args={[0.008, 0.008, 0.2, 6]} />
            <meshStandardMaterial color="#d53f8c" />
          </mesh>
        </group>
      </group>
    </group>
  );
}

const GAMES: { id: ScoreGame; title: string; unit: string; color: string }[] = [
  { id: "rally", title: "Ring Road Rally", unit: "s", color: "#f6c453" },
  { id: "flappy", title: "Firewall Flyer", unit: "", color: "#5eead4" },
  { id: "stack", title: "Full-Stack Arcade", unit: "", color: "#f472b6" },
];

/** The arcade's Hall of Fame: the best three of every game. Faces +z in its own frame. */
export function HallOfFame({ x, z, facing }: { x: number; z: number; facing: number }) {
  const scores = useLiveData((s) => s.scores);
  const offline = useLiveData((s) => s.scoresOffline);
  const loadScores = useLiveData((s) => s.loadScores);
  useRefresh(loadScores);
  const key = `${offline}|${GAMES.map((g) => (scores[g.id] ?? []).slice(0, 3).map((r) => `${r.name}:${r.score}`).join(",")).join("|")}`;
  const { texture } = useCanvas(
    1500,
    800,
    (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "#1a103d");
      grad.addColorStop(1, "#2d1b69");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#fde68a";
      ctx.font = font(76, "800");
      ctx.textAlign = "center";
      ctx.fillText("🏆 HALL OF FAME", w / 2, 100);
      ctx.font = font(30);
      ctx.fillStyle = "#c4b5fd";
      ctx.fillText(offline ? "Scores are resting right now" : "Visitors' best, live from the arcade", w / 2, 150);
      const col = w / 3;
      GAMES.forEach((g, i) => {
        const cx = col * i + col / 2;
        box(ctx, col * i + 24, 190, col - 48, h - 230, 22, "rgba(255,255,255,0.06)", g.color, 4);
        ctx.fillStyle = g.color;
        ctx.font = font(40, "800");
        ctx.fillText(g.title, cx, 250);
        const rows = scores[g.id];
        ctx.font = font(40, "700");
        if (!rows || rows.length === 0) {
          ctx.fillStyle = "#c4b5fd";
          ctx.font = font(32);
          wrap(ctx, rows ? "No scores yet. Be the first!" : "Loading…", cx, 360, col - 100, 42);
          return;
        }
        rows.slice(0, 3).forEach((r, k) => {
          const y = 340 + k * 130;
          ctx.fillStyle = ["#fde68a", "#e5e7eb", "#fdba74"][k];
          ctx.font = font(56, "800");
          ctx.fillText(["🥇", "🥈", "🥉"][k], cx - (col - 130) / 2 + 20, y + 20);
          ctx.textAlign = "left";
          ctx.fillStyle = "#ffffff";
          ctx.font = font(40, "700");
          const name = r.name.length > 12 ? `${r.name.slice(0, 11)}…` : r.name;
          ctx.fillText(name, cx - (col - 130) / 2 + 70, y);
          ctx.fillStyle = g.color;
          ctx.font = font(34, "700");
          ctx.fillText(`${r.score}${g.unit}`, cx - (col - 130) / 2 + 70, y + 46);
          ctx.textAlign = "center";
        });
      });
      ctx.textAlign = "left";
    },
    key,
  );
  return (
    <group position={[x, 0, z]} rotation-y={facing}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.95, 1.4, 0.12]} position={[0, 1.4, -0.05]} />
      </RigidBody>
      <Posts width={3.6} height={1.92} top={3.15} />
      <Panel position={[0, 2.05, 0]} width={3.6} height={1.92} map={texture} frame="#0f0a24" />
    </group>
  );
}
