"use client";

import { useMemo } from "react";
import { Batch } from "../Furniture";
import { flat } from "./finishKit";
import { useHouse } from "./SkillHouse";

/**
 * The house's light fittings, in its style (pendants, neon tubes, industrial cages, ceiling panels,
 * track spots, lanterns, bulb strings, chandeliers), and a handful of real point lights: two over the
 * hall and one per walled room, at most seven, so the frame rate holds.
 */
export function HouseLights() {
  const { def, plan } = useHouse();
  const { H, hall, rooms } = plan;
  const color = def.lightColor;

  // Fittings: a grid over the hall, one in each room.
  const spots = useMemo(() => {
    const out: [number, number][] = [];
    const nx = Math.max(1, Math.round(hall.w / 5));
    const nz = Math.max(1, Math.round(hall.d / 5));
    for (let i = 0; i < nx; i++)
      for (let k = 0; k < nz; k++) out.push([hall.x - hall.w / 2 + (hall.w / nx) * (i + 0.5), hall.z - hall.d / 2 + (hall.d / nz) * (k + 0.5)]);
    for (const r of rooms) out.push([r.x, r.z]);
    return out;
  }, [hall, rooms]);

  const lamps = useMemo(() => {
    const out: [number, number][] = [
      [hall.x, hall.z - hall.d * 0.22],
      [hall.x, hall.z + hall.d * 0.22],
    ];
    for (const r of rooms.filter((r) => !r.open).slice(0, 5)) out.push([r.x, r.z]);
    for (const r of rooms.filter((r) => r.open)) if (out.length < 7) out.push([r.x, r.z]);
    return out.slice(0, 7);
  }, [hall, rooms]);

  const glow = flat(color, 0.4, 0, color, 2.2);
  const metal = flat("#222226", 0.4, 0.7);
  const brass = flat("#c9a45a", 0.25, 0.9);
  const drop = def.lights === "chandelier" ? 1.4 : def.lights === "pendant" || def.lights === "lantern" ? 1.3 : 0.6;

  return (
    <group>
      <Batch>
        {spots.map(([x, z], i) => (
          <group key={i} position={[x, H, z]}>
            {def.lights === "pendant" && (
              <>
                <mesh position={[0, -drop / 2, 0]} material={metal}>
                  <cylinderGeometry args={[0.006, 0.006, drop, 4]} />
                </mesh>
                <mesh position={[0, -drop - 0.1, 0]} material={flat(def.trim, 0.5, 0.2)}>
                  <coneGeometry args={[0.28, 0.26, 20, 1, true]} />
                </mesh>
                <mesh position={[0, -drop - 0.2, 0]} material={glow}>
                  <sphereGeometry args={[0.08, 10, 8]} />
                </mesh>
              </>
            )}
            {def.lights === "neon" && (
              <mesh position={[0, -0.15, 0]} rotation-y={(i % 2) * (Math.PI / 2)} material={glow}>
                <boxGeometry args={[3, 0.06, 0.06]} />
              </mesh>
            )}
            {def.lights === "industrial" && (
              <>
                <mesh position={[0, -0.6, 0]} material={metal}>
                  <cylinderGeometry args={[0.01, 0.01, 1.2, 4]} />
                </mesh>
                <mesh position={[0, -1.3, 0]} material={metal}>
                  <cylinderGeometry args={[0.12, 0.45, 0.32, 18, 1, true]} />
                </mesh>
                <mesh position={[0, -1.4, 0]} material={glow}>
                  <sphereGeometry args={[0.11, 10, 8]} />
                </mesh>
              </>
            )}
            {def.lights === "panel" && (
              <mesh position={[0, -0.03, 0]} material={glow}>
                <boxGeometry args={[1.2, 0.04, 1.2]} />
              </mesh>
            )}
            {def.lights === "track" && (
              <>
                <mesh position={[0, -0.05, 0]} material={metal}>
                  <boxGeometry args={[3.2, 0.05, 0.06]} />
                </mesh>
                {[-1.2, -0.4, 0.4, 1.2].map((dx) => (
                  <group key={dx} position={[dx, -0.18, 0]} rotation-x={0.35}>
                    <mesh material={metal}>
                      <cylinderGeometry args={[0.05, 0.07, 0.2, 10]} />
                    </mesh>
                    <mesh position={[0, -0.1, 0]} material={glow}>
                      <circleGeometry args={[0.05, 10]} />
                    </mesh>
                  </group>
                ))}
              </>
            )}
            {def.lights === "lantern" && (
              <>
                <mesh position={[0, -drop / 2, 0]} material={metal}>
                  <cylinderGeometry args={[0.006, 0.006, drop, 4]} />
                </mesh>
                <mesh position={[0, -drop - 0.22, 0]} material={flat(color, 0.5, 0, color, 0.9)}>
                  <cylinderGeometry args={[0.18, 0.2, 0.4, 6]} />
                </mesh>
                <mesh position={[0, -drop, 0]} material={metal}>
                  <cylinderGeometry args={[0.05, 0.22, 0.08, 6]} />
                </mesh>
              </>
            )}
            {def.lights === "bulbs" &&
              Array.from({ length: 6 }, (_, k) => (
                <mesh key={k} position={[-1.5 + k * 0.6, -0.5 - Math.sin((k / 5) * Math.PI) * 0.35, 0]} material={glow}>
                  <sphereGeometry args={[0.06, 8, 6]} />
                </mesh>
              ))}
            {def.lights === "chandelier" && (
              <>
                <mesh position={[0, -drop / 2, 0]} material={brass}>
                  <cylinderGeometry args={[0.012, 0.012, drop, 6]} />
                </mesh>
                <mesh position={[0, -drop, 0]} rotation-x={Math.PI / 2} material={brass}>
                  <torusGeometry args={[0.45, 0.025, 6, 24]} />
                </mesh>
                {Array.from({ length: 8 }, (_, k) => (
                  <mesh key={k} position={[Math.cos((k / 8) * Math.PI * 2) * 0.45, -drop + 0.08, Math.sin((k / 8) * Math.PI * 2) * 0.45]} material={glow}>
                    <sphereGeometry args={[0.045, 8, 6]} />
                  </mesh>
                ))}
              </>
            )}
          </group>
        ))}
      </Batch>
      {lamps.map(([x, z], i) => (
        <pointLight key={i} position={[x, H - 1.3, z]} intensity={i < 2 ? 30 : 16} distance={i < 2 ? 20 : 12} decay={2} color={color} />
      ))}
    </group>
  );
}
