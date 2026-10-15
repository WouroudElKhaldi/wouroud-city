"use client";

import { useEffect, useState } from "react";
import { useCityStore } from "@/state/useCityStore";
import { districtById, landmarkDoorstep } from "@/world/districts";
import { seedContent } from "@/content/seed";
import { parseRoom, roomSize, sceneDistrict } from "@/world/interiors";
import { computeDistrictLayout } from "@/world/layout";
import { PERSONAS } from "@/world/personas";
import { useIsTouch } from "@/world/touch";
import { Minimap } from "./Minimap";
import { TouchControls } from "./TouchControls";

export const CV_URL = "/cv/Wouroud_El_Khaldi-cv.pdf";

const WEATHER_ICON = { clear: "🌤️", rain: "🌧️", snow: "❄️", fog: "☁️" } as const;

/** On-screen controls over the 3D city. Phones get a compact bar, a menu sheet and touch controls. */
export function Hud() {
  const {
    timeMode,
    muted,
    scene,
    nearby,
    seat,
    fading,
    toasts,
    persona,
    waypoint,
    toggleTime,
    weather,
    cycleWeather,
    toggleMuted,
    interact,
    goTo,
    showWelcome,
    setWaypoint,
  } = useCityStore();
  const touch = useIsTouch();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(true);

  // E or Enter activates whatever the player is standing next to.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyE" || e.code === "Enter") interact();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [interact]);

  // On phones the controls hint goes away after a while; the screen is small.
  useEffect(() => {
    if (!touch) return;
    const t = window.setTimeout(() => setShowHelp(false), 9000);
    return () => window.clearTimeout(t);
  }, [touch]);

  const room = parseRoom(scene);
  const district = sceneDistrict(scene);
  const roomLabel = room && computeDistrictLayout(seedContent, room.district).buildings.find((b) => b.id === room.id)?.label;
  const place = !district ? "Central Plaza" : room ? `${roomLabel ?? "Inside"} · ${districtById(district).name}` : districtById(district).name;
  const driving = useCityStore((st) => st.driving);
  const riding = driving?.model === "horse";
  const prompt = seat ? "Stand up" : riding ? "Get off the horse" : driving ? "Get out of the car" : nearby?.label;
  const p = persona ? PERSONAS[persona] : null;

  /** Guided tour: in the hub, point to the next recommended district; in a district, back to the plaza. */
  const nextStop = () => {
    if (!p) return;
    if (room) {
      setWaypoint({ x: 0, z: roomSize(room.id).depth / 2 - 1, label: "the way out" });
      return;
    }
    if (district) {
      const { exit } = computeDistrictLayout(seedContent, district);
      setWaypoint({ x: exit.x, z: exit.z - 3, label: "the exit to Central Plaza" });
      return;
    }
    const cameFrom = useCityStore.getState().cameFrom;
    const visited = cameFrom && sceneDistrict(cameFrom);
    const order = p.tour;
    const next = order[visited ? (order.indexOf(visited) + 1) % order.length : 0];
    const door = landmarkDoorstep(next, 13);
    setWaypoint({ x: door.x, z: door.z, label: districtById(next).name });
  };

  const secondary = (
    <>
      {p && (
        <div className="hud-panel pointer-events-auto flex flex-wrap items-center justify-center gap-2">
          <span>
            {p.emoji} Visiting as <strong>{p.label}</strong>
          </span>
          <button type="button" className="hud-chip" onClick={showWelcome}>
            Change look
          </button>
        </div>
      )}
      {persona === "recruiter" && (
        <a href={CV_URL} download className="hud-panel hud-button hud-gold pointer-events-auto">
          📄 Download CV
        </a>
      )}
      <button type="button" className="hud-panel hud-button pointer-events-auto" onClick={() => useCityStore.getState().takePhoto()}>
        📸 Photo
      </button>
      <a href="/resume" className="hud-panel hud-button pointer-events-auto">
        Résumé page
      </a>
    </>
  );

  return (
    <>
      <div className="hud-root pointer-events-none absolute inset-0 flex flex-col justify-between p-3 text-sm text-white sm:p-4">
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="flex shrink-0 flex-col items-start gap-2">
            <div className="hud-panel pointer-events-auto">
              <p className="font-semibold tracking-wide sm:text-base">Wouroud&apos;s City</p>
              <p className="text-xs text-violet-200 sm:text-sm">{place}</p>
            </div>
            <Minimap />
            {room ? (
              <button type="button" onClick={() => goTo(room.district)} className="hud-panel hud-button pointer-events-auto">
                ← {touch ? "Outside" : "Back outside"}
              </button>
            ) : (
              scene !== "hub" && (
                <button type="button" onClick={() => goTo("hub")} className="hud-panel hud-button pointer-events-auto">
                  ← {touch ? "Plaza" : "Back to the city"}
                </button>
              )
            )}
          </div>

          <div className="flex min-w-0 flex-col items-end gap-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={toggleMuted}
                className="hud-panel hud-button pointer-events-auto"
                aria-label={muted ? "Turn sound on" : "Mute sound"}
              >
                {muted ? "🔇" : "🔊"}
              </button>
              <button
                type="button"
                onClick={toggleTime}
                className="hud-panel hud-button pointer-events-auto"
                aria-label={timeMode === "day" ? "Switch to night" : "Switch to day"}
              >
                {timeMode === "day" ? "☀️" : "🌙"}
                <span className="hidden sm:inline"> {timeMode === "day" ? "Day" : "Night"}</span>
              </button>
              <button
                type="button"
                onClick={cycleWeather}
                className="hud-panel hud-button pointer-events-auto"
                aria-label={`Weather: ${weather}. Change weather`}
                title="Change the weather"
              >
                {WEATHER_ICON[weather]}
                <span className="hidden capitalize sm:inline"> {weather}</span>
              </button>
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className="hud-panel hud-button pointer-events-auto sm:hidden"
                aria-label="Open menu"
              >
                ☰
              </button>
            </div>
            <div className="hidden flex-wrap justify-end gap-2 sm:flex">{secondary}</div>
            <button
              type="button"
              className="hud-panel hud-button hud-gold pointer-events-auto max-w-[11rem] truncate sm:max-w-none"
              onClick={nextStop}
            >
              ✦ {waypoint ? `Heading to ${waypoint.label}` : touch ? "Next stop" : "Guide me: next stop"}
            </button>
            <div className="flex w-[min(18rem,calc(100vw-9.5rem))] flex-col gap-2 sm:w-72">
              {toasts.map((t) => (
                <div key={t.id} className="hud-panel hud-toast">
                  {t.title && <p className="font-semibold text-fuchsia-200">{t.title}</p>}
                  <p>{t.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {prompt && (
          <div className={`flex justify-center ${touch ? "mb-36" : ""}`}>
            <button type="button" onClick={interact} className="hud-panel hud-prompt pointer-events-auto max-w-[85vw] truncate">
              {touch ? "👆" : <kbd>E</kbd>} {prompt}
            </button>
          </div>
        )}

        {touch ? (
          showHelp &&
          !prompt && (
            <div className="hud-panel mb-36 self-center text-center text-xs text-violet-100">
              Joystick to walk, push to the edge to run · drag to look · pinch to zoom · tap trees, cars and buildings
            </div>
          )
        ) : driving ? (
          <div className="hud-panel max-w-sm self-start text-violet-100">
            <p>
              {riding ? "🐴" : "🚗"} <kbd>W</kbd>/<kbd>S</kbd> {riding ? "ride" : "drive"} · <kbd>A</kbd>/<kbd>D</kbd> steer ·{" "}
              <kbd>Shift</kbd> {riding ? "gallop" : "boost"} · <kbd>Space</kbd> {riding ? "stop" : "brake"} · <kbd>E</kbd> get {riding ? "off" : "out"}
            </p>
          </div>
        ) : (
          <div className="hud-panel max-w-sm self-start text-violet-100">
            <p>
              <kbd>W A S D</kbd> walk · <kbd>Shift</kbd> run · <kbd>Space</kbd> jump · <kbd>E</kbd> interact · <kbd>M</kbd> map
            </p>
            <p>Drag to look · scroll to zoom · click trees, lamps, balls, flowers, cars and buildings</p>
          </div>
        )}
      </div>

      {touch && <TouchControls />}

      {menuOpen && (
        <div
          className="pointer-events-auto absolute inset-0 z-30 flex items-end bg-[#0d0820]/55 backdrop-blur-sm sm:hidden"
          onClick={() => setMenuOpen(false)}
        >
          <div className="hud-sheet w-full" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold text-white">Menu</p>
              <button type="button" className="hud-chip text-white" onClick={() => setMenuOpen(false)}>
                Close ✕
              </button>
            </div>
            <div className="flex flex-col items-stretch gap-2 text-center text-sm text-white">{secondary}</div>
          </div>
        </div>
      )}

      {/* Fade to black between scenes */}
      <div
        className="pointer-events-none absolute inset-0 z-40 bg-[#0d0820] transition-opacity duration-[450ms]"
        style={{ opacity: fading ? 1 : 0 }}
      />
    </>
  );
}
