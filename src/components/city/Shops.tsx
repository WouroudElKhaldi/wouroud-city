"use client";

import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { useCityStore, type Seat } from "@/state/useCityStore";
import { NPC_PEOPLE } from "@/world/outfits";
import { type MenuItem, shopInfo } from "@/world/shops";
import { sfx } from "@/world/sfx";
import { Bookcase, Painting, SideChair, Table, TallPlant, workSeat } from "./Furniture";
import { OnWall, useRoom } from "./InteriorScene";
import { emitBurst } from "./Particles";
import { Person } from "./Person";
import { box, font, Panel, useCanvas, wrap } from "./roomKit";
import { Seats } from "./StreetDetails";
import { useProximity } from "./useProximity";

/**
 * Inside a neighborhood shop. Cafés and restaurants have a counter with a menu: order with
 * E (or by clicking the menu board), the dish is served on the table with the candle, sit
 * there and it's eaten bite by bite, then you're rested and fed. Other shops have a counter
 * where the shopkeeper has something to say or to sell.
 */

const TABLES = [
  { x: -6, z: 0.5, served: true },
  { x: -2, z: 2.5, served: false },
  { x: 2, z: 2.5, served: false },
  { x: 6, z: 0.5, served: false },
];
const EAT_SECONDS = 7;

export function ShopRoom({ label }: { label: string }) {
  const { width: W, depth: D } = useRoom();
  const info = shopInfo(label);
  const food = info.kind === "food";
  const openMenu = useCityStore((s) => s.openMenu);
  const toast = useCityStore((s) => s.toast);
  const lineAt = useRef(0);

  const visitCounter = () => {
    if (food) {
      openMenu(label);
      sfx.pop();
      return;
    }
    const lines = info.lines ?? [];
    toast(lines[lineAt.current++ % Math.max(1, lines.length)] ?? "Thanks for stopping by!", label);
    sfx.sparkle();
    emitBurst({ position: new THREE.Vector3(0, 1.8, -D / 2 + 2.6), kind: "sparkle", count: 18, colors: [info.accent, "#ffffff"], spread: 0.6 });
  };
  const counter = useMemo(() => new THREE.Vector3(0, 0, -D / 2 + 3.6), [D]);
  useProximity({ id: `counter-${label}`, label: info.verb, radius: 2.4, where: counter, run: visitCounter });

  const seats = useMemo<Seat[]>(
    () =>
      TABLES.flatMap((t, i) => [
        workSeat(`shop-t${i}-a`, t.x - 0.72, t.z, Math.PI / 2),
        workSeat(`shop-t${i}-b`, t.x + 0.72, t.z, -Math.PI / 2),
      ]),
    [],
  );

  return (
    <group>
      {/* Counter with a marble top and the shopkeeper behind it */}
      <group position={[0, 0, -D / 2 + 2.4]}>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[2.6, 0.55, 0.45]} position={[0, 0.55, 0]} />
        </RigidBody>
        <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
          <boxGeometry args={[5.2, 1.1, 0.9]} />
          <meshStandardMaterial color="#3a2418" roughness={0.45} />
        </mesh>
        <mesh position={[0, 1.13, 0]} receiveShadow>
          <boxGeometry args={[5.3, 0.06, 1]} />
          <meshStandardMaterial color="#efe9df" roughness={0.15} />
        </mesh>
        <mesh position={[0, 0.6, 0.46]}>
          <boxGeometry args={[5.2, 0.08, 0.02]} />
          <meshStandardMaterial color={info.accent} emissive={info.accent} emissiveIntensity={0.6} />
        </mesh>
        <group position={[1.4, 0, -1.1]} rotation-y={0}>
          <Suspense fallback={null}>
            <Person look={NPC_PEOPLE[label.length % NPC_PEOPLE.length]} animation="idle" detail={false} />
          </Suspense>
        </group>
        {food && <CounterGoods accent={info.accent} />}
      </group>

      <OnWall side="back">
        {food ? (
          <MenuBoard label={label} onClick={visitCounter} />
        ) : (
          [-6, 6].map((x, i) => <Bookcase key={x} position={[x, 0, -D / 2 + 0.35]} width={2.6} seed={label.length + i} />)
        )}
      </OnWall>

      {/* Tables for two with fitted chairs; the first one has a candle and gets the orders */}
      {TABLES.map((t, i) => (
        <group key={i}>
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider args={[0.42, 0.37, 0.42]} position={[t.x, 0.37, t.z]} />
          </RigidBody>
          <Table position={[t.x, 0, t.z]} width={0.85} depth={0.85} top={i % 2 ? "walnut" : "marbleWhite"} />
          <SideChair position={[t.x - 0.72, 0, t.z]} facing={Math.PI / 2} />
          <SideChair position={[t.x + 0.72, 0, t.z]} facing={-Math.PI / 2} />
          {t.served && <Candle x={t.x} z={t.z} />}
        </group>
      ))}
      <Seats seats={seats} />
      {food && <ServedDish shop={label} x={TABLES[0].x} z={TABLES[0].z} />}

      <OnWall side="left">
        <Painting position={[-W / 2 + 0.06, 2.6, -1]} rotationY={Math.PI / 2} width={2.2} height={1.5} seed={label.length} palette={[info.accent, "#f6c453", "#1a103d", "#f4f1ea"]} />
      </OnWall>
      <TallPlant position={[W / 2 - 1.2, 0, -D / 2 + 1.2]} seed={label.length + 3} />
      <TallPlant position={[-W / 2 + 1.2, 0, -D / 2 + 1.2]} seed={label.length + 5} />
    </group>
  );
}

/** The menu on the back wall, drawn from the shop's items. Click it to order. */
function MenuBoard({ label, onClick }: { label: string; onClick: () => void }) {
  const { depth: D } = useRoom();
  const info = shopInfo(label);
  const items = info.menu ?? [];
  const { texture } = useCanvas(
    1600,
    900,
    (ctx, w, h) => {
      ctx.fillStyle = "#1c1a1f";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = info.accent;
      ctx.fillRect(0, 0, w, 16);
      ctx.fillStyle = "#fde68a";
      ctx.font = font(84, "800");
      ctx.fillText(label, 70, 140);
      ctx.font = font(36);
      ctx.fillStyle = "#cbd5e1";
      ctx.fillText("Press E at the counter, or tap this menu, to order", 70, 200);
      let y = 300;
      for (const item of items) {
        box(ctx, 70, y - 42, 30, 30, 8, item.color);
        ctx.fillStyle = "#f4f1ea";
        ctx.font = font(48, "700");
        ctx.fillText(item.name, 130, y - 14);
        ctx.fillStyle = "#fde68a";
        ctx.textAlign = "right";
        ctx.fillText(item.price, w - 70, y - 14);
        ctx.textAlign = "left";
        if (item.note) {
          ctx.fillStyle = "#94a3b8";
          ctx.font = font(30);
          wrap(ctx, item.note, 130, y + 24, w - 400, 34);
        }
        y += item.note ? 120 : 92;
      }
    },
    label,
  );
  return (
    <Panel
      position={[0, 3, -D / 2 + 0.06]}
      width={7}
      height={3.9}
      map={texture}
      frame="#2b1a12"
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (e.delta > 6) return;
        e.stopPropagation();
        onClick();
      }}
    />
  );
}

/** Pastries under glass domes and a coffee machine on the counter. */
function CounterGoods({ accent }: { accent: string }) {
  return (
    <group position={[0, 1.16, 0]}>
      <mesh position={[-1.4, 0.22, -0.1]} castShadow>
        <boxGeometry args={[0.7, 0.44, 0.45]} />
        <meshStandardMaterial color="#c0c4cc" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[-1.4, 0.46, -0.1]}>
        <boxGeometry args={[0.72, 0.04, 0.47]} />
        <meshStandardMaterial color={accent} />
      </mesh>
      {[0, 0.9].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.25, 0.25, 0.03, 24]} />
            <meshStandardMaterial color="#f4f1ea" />
          </mesh>
          <mesh position={[0, 0.1, 0]}>
            <sphereGeometry args={[0.12, 14, 10]} />
            <meshStandardMaterial color={x ? "#d99a3e" : "#7a4a22"} roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.12, 0]}>
            <sphereGeometry args={[0.24, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshPhysicalMaterial color="#ffffff" transmission={0.9} roughness={0.05} thickness={0.02} transparent opacity={0.35} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Candle({ x, z }: { x: number; z: number }) {
  const flame = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (flame.current) flame.current.scale.y = 1 + Math.sin(clock.elapsedTime * 13 + x) * 0.15;
  });
  return (
    <group position={[x + 0.22, 0.76, z - 0.22]}>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.12, 12]} />
        <meshStandardMaterial color="#f8f4ea" />
      </mesh>
      <mesh ref={flame} position={[0, 0.15, 0]}>
        <coneGeometry args={[0.015, 0.05, 8]} />
        <meshStandardMaterial color="#ffd27a" emissive="#ffb347" emissiveIntensity={3} toneMapped={false} />
      </mesh>
    </group>
  );
}

/**
 * The order on the candle table. Sitting at that table eats it bit by bit; when it's gone
 * you get a toast and the table is free for the next order.
 */
function ServedDish({ shop, x, z }: { shop: string; x: number; z: number }) {
  const order = useCityStore((s) => (s.order?.shop === shop ? s.order : null));
  const food = useRef<THREE.Group>(null);
  const eaten = useRef(0);
  const lastOrder = useRef<number | null>(null);
  useFrame((_, delta) => {
    const store = useCityStore.getState();
    const o = store.order;
    if (!o || o.shop !== shop) return;
    if (lastOrder.current !== o.at) {
      lastOrder.current = o.at;
      eaten.current = 0;
      emitBurst({ position: new THREE.Vector3(x, 1.1, z), kind: "sparkle", count: 14, colors: ["#fde68a", "#ffffff"], spread: 0.4 });
    }
    const seated = store.seat?.id.startsWith("shop-t0-");
    if (seated) {
      const before = eaten.current;
      eaten.current = Math.min(1, eaten.current + delta / EAT_SECONDS);
      // A little crumb or sip every so often.
      if (Math.floor(before * 6) !== Math.floor(eaten.current * 6)) sfx.pop();
      if (eaten.current >= 1) {
        store.finishOrder();
        store.toast(`That ${o.item.name} was delicious. You feel rested and ready to explore again!`, shop);
        sfx.coin();
        emitBurst({ position: new THREE.Vector3(x, 1.4, z), kind: "sparkle", count: 30, colors: ["#fde68a", "#f0abfc", "#ffffff"], spread: 0.8 });
      }
    }
    if (food.current) {
      const left = 1 - eaten.current;
      food.current.scale.set(1, Math.max(0.05, left), 1);
    }
  });
  if (!order) return null;
  return (
    <group position={[x, 0.76, z]}>
      <Dish item={order.item} food={food} />
    </group>
  );
}

/** A plate, bowl, cup, glass, wrap, pizza or cone with the food in its color. */
function Dish({ item, food }: { item: MenuItem; food: React.RefObject<THREE.Group | null> }) {
  const china = <meshStandardMaterial color="#f8f6f1" roughness={0.25} />;
  const fill = <meshStandardMaterial color={item.color} roughness={0.7} />;
  switch (item.dish) {
    case "cup":
      return (
        <group>
          <mesh position={[0, 0.005, 0]}>
            <cylinderGeometry args={[0.09, 0.09, 0.01, 24]} />
            {china}
          </mesh>
          <mesh position={[0, 0.05, 0]}>
            <cylinderGeometry args={[0.05, 0.04, 0.08, 20, 1, true]} />
            <meshStandardMaterial color="#f8f6f1" roughness={0.25} side={THREE.DoubleSide} />
          </mesh>
          <group ref={food} position={[0, 0.012, 0]}>
            <mesh position={[0, 0.035, 0]}>
              <cylinderGeometry args={[0.046, 0.04, 0.07, 20]} />
              {fill}
            </mesh>
          </group>
        </group>
      );
    case "glass":
      return (
        <group>
          <mesh position={[0, 0.07, 0]}>
            <cylinderGeometry args={[0.045, 0.04, 0.14, 20, 1, true]} />
            <meshPhysicalMaterial color="#ffffff" transmission={0.9} roughness={0.05} thickness={0.01} transparent opacity={0.4} side={THREE.DoubleSide} />
          </mesh>
          <group ref={food} position={[0, 0.005, 0]}>
            <mesh position={[0, 0.06, 0]}>
              <cylinderGeometry args={[0.042, 0.038, 0.12, 20]} />
              <meshStandardMaterial color={item.color} roughness={0.3} transparent opacity={0.85} />
            </mesh>
          </group>
        </group>
      );
    case "bowl":
      return (
        <group>
          <mesh position={[0, 0.04, 0]}>
            <sphereGeometry args={[0.11, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
            <meshStandardMaterial color="#f8f6f1" roughness={0.25} side={THREE.DoubleSide} />
          </mesh>
          <group ref={food} position={[0, 0.03, 0]}>
            <mesh position={[0, 0.005, 0]} scale={[1, 0.35, 1]}>
              <sphereGeometry args={[0.095, 20, 10]} />
              {fill}
            </mesh>
          </group>
        </group>
      );
    case "pizza":
      return (
        <group>
          <mesh position={[0, 0.005, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.01, 32]} />
            <meshStandardMaterial color="#8a6038" roughness={0.6} />
          </mesh>
          <group ref={food} position={[0, 0.012, 0]}>
            <mesh position={[0, 0.006, 0]}>
              <cylinderGeometry args={[0.17, 0.17, 0.012, 32]} />
              <meshStandardMaterial color="#e3b065" roughness={0.8} />
            </mesh>
            <mesh position={[0, 0.014, 0]}>
              <cylinderGeometry args={[0.15, 0.15, 0.006, 32]} />
              {fill}
            </mesh>
          </group>
        </group>
      );
    case "wrap":
      return (
        <group>
          <mesh position={[0, 0.005, 0]}>
            <cylinderGeometry args={[0.13, 0.13, 0.01, 24]} />
            {china}
          </mesh>
          <group ref={food} position={[0, 0.04, 0]}>
            <mesh rotation-z={Math.PI / 2}>
              <capsuleGeometry args={[0.035, 0.14, 6, 12]} />
              {fill}
            </mesh>
          </group>
        </group>
      );
    case "cone":
      return (
        <group position={[0, 0.0, 0]}>
          <mesh position={[0, 0.07, 0]} rotation-x={Math.PI}>
            <coneGeometry args={[0.04, 0.14, 16]} />
            <meshStandardMaterial color="#c98a3e" roughness={0.8} />
          </mesh>
          <group ref={food} position={[0, 0.14, 0]}>
            <mesh position={[0, 0.03, 0]}>
              <sphereGeometry args={[0.048, 16, 12]} />
              {fill}
            </mesh>
          </group>
        </group>
      );
    default:
      return (
        <group>
          <mesh position={[0, 0.005, 0]}>
            <cylinderGeometry args={[0.13, 0.13, 0.01, 28]} />
            {china}
          </mesh>
          <group ref={food} position={[0, 0.012, 0]}>
            <mesh position={[0, 0.012, 0]} scale={[1, 0.3, 1]}>
              <sphereGeometry args={[0.09, 20, 10]} />
              {fill}
            </mesh>
          </group>
        </group>
      );
  }
}
