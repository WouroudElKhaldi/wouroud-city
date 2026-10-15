"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parseRoom, sceneDistrict } from "@/world/interiors";
import { seedContent } from "@/content/seed";
import { type SceneId, useCityStore } from "@/state/useCityStore";
import { DISTRICTS, type DistrictId, HUB, landmarkDoorstep, landmarkPlacement } from "@/world/districts";
import { playerState } from "@/world/env";
import { computeHubLayout } from "@/world/hubLayout";
import { computeDistrictLayout, doorPoint, RING, SPOKES } from "@/world/layout";
import { accents, palette } from "@/world/palette";
import { PERSONAS } from "@/world/personas";

/**
 * The map, drawn as SVG from the same layout data as the 3D world.
 * Collapsed: a round minimap in the corner that follows the player.
 * Expanded (M or click): the whole hub or district; click a place to get a
 * glowing path to it. The player arrow updates every frame without re-rendering React.
 */

type MapPlace = { id: string; x: number; z: number; label: string; color: string; highlight: boolean; target: { x: number; z: number } };
type MapData = {
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  shapes: React.ReactNode;
  places: MapPlace[];
};

function useMapData(scene: SceneId, highlights: DistrictId[]): MapData {
  return useMemo(() => {
    if (scene === "hub") {
      const hub = computeHubLayout();
      const places: MapPlace[] = DISTRICTS.map((d) => {
        const p = landmarkPlacement(d.id);
        const door = landmarkDoorstep(d.id, HUB.landmarkRadius + 2);
        return {
          id: d.id,
          x: p.x,
          z: p.z,
          label: d.name,
          color: d.color,
          highlight: highlights.includes(d.id),
          target: { x: door.x, z: door.z },
        };
      });
      const shapes = (
        <>
          {hub.roads.map((r, i) => (
            <rect
              key={i}
              x={r.x - HUB.roadHalfWidth}
              y={r.z - r.length / 2}
              width={HUB.roadHalfWidth * 2}
              height={r.length}
              fill={palette.road}
              transform={`rotate(${(-r.rotationY * 180) / Math.PI} ${r.x} ${r.z})`}
            />
          ))}
          <circle cx={0} cy={0} r={HUB.plazaRadius} fill={palette.plaza} stroke={accents.gold} strokeWidth={1} />
          <circle cx={0} cy={0} r={5} fill={accents.mint} />
          {places.map((p) => (
            <circle key={p.id} cx={p.x} cy={p.z} r={HUB.landmarkRadius} fill="#e6dcfa" stroke={p.color} strokeWidth={2.5} />
          ))}
        </>
      );
      return { bounds: { minX: -85, maxX: 85, minZ: -85, maxZ: 85 }, shapes, places };
    }

    // Rooms have no map of their own; build the district one so hooks stay in order (hidden below).
    const layout = computeDistrictLayout(seedContent, sceneDistrict(scene) ?? "business");
    const places: MapPlace[] = layout.buildings
      .filter((b) => !b.filler)
      .map((b) => ({
        id: b.id,
        x: b.x,
        z: b.z,
        label: b.label,
        color: b.color,
        highlight: false,
        target: doorPoint(b, 2.5),
      }));
    places.push({
      id: "exit",
      x: layout.exit.x,
      z: layout.exit.z,
      label: "Exit to Central Plaza",
      color: accents.gold,
      highlight: true,
      target: { x: layout.exit.x, z: layout.exit.z - 3 },
    });
    const road = RING.roadHalfWidth * 2;
    const shapes = (
      <>
        <circle r={layout.innerRadius} fill={palette.sidewalk} />
        <circle r={layout.ringRadius - RING.roadHalfWidth} fill={palette.grass} />
        <circle r={layout.ringRadius} fill="none" stroke={palette.road} strokeWidth={road} />
        <rect x={-RING.roadHalfWidth} y={layout.ringRadius} width={road} height={layout.gateZ + 6 - layout.ringRadius} fill={palette.road} />
        {SPOKES.map((a) => (
          <rect key={a} x={-1.5} y={RING.plazaRadius} width={3} height={layout.ringRadius - RING.plazaRadius} fill={palette.sidewalk} transform={`rotate(${(-a * 180) / Math.PI})`} />
        ))}
        <circle r={RING.plazaRadius} fill={palette.plaza} stroke={accents.gold} strokeWidth={0.8} />
        <circle r={4} fill={accents.mint} />
        {layout.buildings.map((b) => (
          <rect
            key={b.id}
            x={-b.width / 2}
            y={-b.depth / 2}
            width={b.width}
            height={b.depth}
            rx={1}
            fill={b.filler ? "#cbbfe6" : b.color}
            stroke="#ffffff"
            strokeWidth={0.4}
            transform={`translate(${b.x} ${b.z}) rotate(${(-b.rotY * 180) / Math.PI})`}
          />
        ))}
      </>
    );
    const r = layout.outerRadius + 6;
    return { bounds: { minX: -r, maxX: r, minZ: -r, maxZ: Math.max(r, layout.gateZ + 8) }, shapes, places };
  }, [scene, highlights]);
}

export function Minimap() {
  const scene = useCityStore((s) => s.scene);
  const persona = useCityStore((s) => s.persona);
  const mapOpen = useCityStore((s) => s.mapOpen);
  const setMapOpen = useCityStore((s) => s.setMapOpen);
  const setWaypoint = useCityStore((s) => s.setWaypoint);
  const waypoint = useCityStore((s) => s.waypoint);
  const highlights = useMemo(() => (persona ? PERSONAS[persona].highlights : []), [persona]);
  const data = useMapData(scene, highlights);

  // M toggles the big map, Escape closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyM") setMapOpen(!useCityStore.getState().mapOpen);
      if (e.code === "Escape") setMapOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setMapOpen]);

  if (parseRoom(scene)) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setMapOpen(true)}
        className="minimap pointer-events-auto"
        aria-label="Open the map (M)"
        title="Open the map (M)"
      >
        <MapSvg data={data} mode="mini" waypoint={waypoint} />
        <span className="minimap-north">N</span>
      </button>

      {mapOpen && (
        <div
          className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-[#0d0820]/60 p-4 backdrop-blur-sm"
          onClick={() => setMapOpen(false)}
        >
          <div className="map-panel" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="font-semibold text-white">
                {scene === "hub" ? "Wouroud's City" : DISTRICTS.find((d) => d.id === scene)?.name} · pick a place to get directions
              </p>
              <button type="button" className="hud-chip text-white" onClick={() => setMapOpen(false)}>
                Close ✕
              </button>
            </div>
            <MapSvg
              data={data}
              mode="full"
              waypoint={waypoint}
              onPick={(p) => setWaypoint({ x: p.target.x, z: p.target.z, label: p.label })}
            />
            <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Fast travel">
              <span className="mr-1 self-center text-xs tracking-widest text-violet-200 uppercase">Fast travel</span>
              {[{ id: "hub", name: "Central Plaza" }, ...DISTRICTS].map((d) => (
                <button
                  key={d.id}
                  type="button"
                  disabled={scene === d.id}
                  className="hud-chip text-sm text-white disabled:opacity-40"
                  onClick={() => {
                    setMapOpen(false);
                    useCityStore.getState().goTo(d.id as SceneId);
                  }}
                >
                  {d.name}
                </button>
              ))}
            </div>
            {highlights.length > 0 && scene === "hub" && (
              <p className="mt-2 text-xs text-amber-100">✦ Glowing pins are recommended for you as a {PERSONAS[persona!].label.toLowerCase()}.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function MapSvg({
  data,
  mode,
  waypoint,
  onPick,
}: {
  data: MapData;
  mode: "mini" | "full";
  waypoint: { x: number; z: number; label: string } | null;
  onPick?: (p: MapPlace) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const world = useRef<SVGGElement>(null);
  // How much CSS shrinks the full map (on phones); labels grow back to stay readable.
  const [fit, setFit] = useState(1);
  const arrow = useRef<SVGGElement>(null);
  const size = mode === "mini" ? 170 : 640;
  const { bounds } = data;
  // Mini: fixed scale around the player. Full: fit everything.
  const scale =
    mode === "mini" ? 1.15 : Math.min(size / (bounds.maxX - bounds.minX), size / (bounds.maxZ - bounds.minZ)) * 0.94;

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const { x, z } = playerState.position;
      const deg = (Math.atan2(Math.sin(playerState.heading), -Math.cos(playerState.heading)) * 180) / Math.PI;
      if (mode === "mini") {
        world.current?.setAttribute("transform", `translate(${size / 2} ${size / 2}) scale(${scale}) translate(${-x} ${-z})`);
        arrow.current?.setAttribute("transform", `translate(${size / 2} ${size / 2}) rotate(${deg})`);
      } else {
        const cx = (bounds.minX + bounds.maxX) / 2;
        const cz = (bounds.minZ + bounds.maxZ) / 2;
        world.current?.setAttribute("transform", `translate(${size / 2} ${size / 2}) scale(${scale}) translate(${-cx} ${-cz})`);
        arrow.current?.setAttribute(
          "transform",
          `translate(${size / 2 + (x - cx) * scale} ${size / 2 + (z - cz) * scale}) rotate(${deg})`,
        );
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [mode, size, scale, bounds]);

  useEffect(() => {
    if (mode !== "full" || !svg.current) return;
    const el = svg.current;
    const observer = new ResizeObserver(() => setFit(Math.min(1, el.clientWidth / size) || 1));
    observer.observe(el);
    return () => observer.disconnect();
  }, [mode, size]);

  const labelSize = mode === "full" ? Math.min(11 / fit, 20) / scale : 0;

  return (
    <svg
      ref={svg}
      width={mode === "mini" ? "100%" : size}
      height={mode === "mini" ? "100%" : size}
      viewBox={`0 0 ${size} ${size}`}
      className={mode === "full" ? "map-svg" : undefined}
      role={mode === "full" ? "img" : undefined}
      aria-label={mode === "full" ? "City map" : undefined}
    >
      <rect width={size} height={size} fill={palette.grass} />
      <g ref={world}>
        {data.shapes}
        {waypoint && (
          <g>
            <circle cx={waypoint.x} cy={waypoint.z} r={mode === "mini" ? 4 : 6 / scale + 2} fill="none" stroke={accents.gold} strokeWidth={mode === "mini" ? 1.5 : 3 / scale}>
              <animate attributeName="r" values={`${3};${8};${3}`} dur="1.6s" repeatCount="indefinite" />
            </circle>
            <circle cx={waypoint.x} cy={waypoint.z} r={2} fill={accents.gold} />
          </g>
        )}
        {data.places.map((p) => (
          <g
            key={p.id}
            onClick={onPick ? () => onPick(p) : undefined}
            style={onPick ? { cursor: "pointer" } : undefined}
          >
            {p.highlight && (
              <circle cx={p.x} cy={p.z} r={mode === "mini" ? 6 : 9} fill="none" stroke={accents.gold} strokeWidth={1.5}>
                <animate attributeName="opacity" values="1;0.2;1" dur="1.8s" repeatCount="indefinite" />
              </circle>
            )}
            <circle cx={p.x} cy={p.z} r={mode === "mini" ? 3.2 : 4.5} fill={p.color} stroke="#ffffff" strokeWidth={1} />
            {mode === "full" && (
              <text
                x={p.x}
                y={p.z - 6 / scale - 4}
                fontSize={labelSize}
                textAnchor="middle"
                fill="#1a103d"
                stroke="#ffffff"
                strokeWidth={3 / scale}
                paintOrder="stroke"
                fontWeight={600}
              >
                {p.label}
              </text>
            )}
          </g>
        ))}
      </g>
      <g ref={arrow}>
        <circle r={mode === "mini" ? 7 : 9} fill="#ffffff" opacity={0.85} />
        <path d="M0 -9 L6 6 L0 3 L-6 6 Z" fill={palette.magenta} stroke="#ffffff" strokeWidth={1.2} />
      </g>
    </svg>
  );
}
