"use client";

import { useEffect } from "react";
import { useCityStore } from "@/state/useCityStore";
import { districtById, landmarkDoorstep } from "@/world/districts";
import { STREET } from "@/world/layout";
import { PERSONAS } from "@/world/personas";
import { Minimap } from "./Minimap";

export const CV_URL = "/cv/Wouroud_El_Khaldi-cv.pdf";

/** On-screen controls over the 3D city. */
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
    toggleMuted,
    interact,
    goTo,
    showWelcome,
    setWaypoint,
  } = useCityStore();

  // E or Enter activates whatever the player is standing next to.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyE" || e.code === "Enter") interact();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [interact]);

  const place = scene === "hub" ? "Central Plaza" : districtById(scene).name;
  const prompt = seat ? "Stand up" : nearby?.label;
  const p = persona ? PERSONAS[persona] : null;

  /** Guided tour: in the hub, point to the next recommended district; in a district, back to the plaza. */
  const nextStop = () => {
    if (!p) return;
    if (scene !== "hub") {
      setWaypoint({ x: 0, z: STREET.startZ + 19, label: "the exit to Central Plaza" });
      return;
    }
    const visited = useCityStore.getState().cameFrom;
    const order = p.tour;
    const next = order[visited ? (order.indexOf(visited) + 1) % order.length : 0];
    const door = landmarkDoorstep(next, 13);
    setWaypoint({ x: door.x, z: door.z, label: districtById(next).name });
  };

  return (
    <>
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 text-sm text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col items-start gap-2">
            <div className="hud-panel pointer-events-auto">
              <p className="text-base font-semibold tracking-wide">Wouroud&apos;s City</p>
              <p className="text-violet-200">{place}</p>
            </div>
            <Minimap />
            {scene !== "hub" && (
              <button type="button" onClick={() => goTo("hub")} className="hud-panel hud-button pointer-events-auto">
                ← Back to the city
              </button>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={toggleMuted}
                className="hud-panel hud-button pointer-events-auto"
                aria-label={muted ? "Turn sound on" : "Mute sound"}
              >
                {muted ? "🔇" : "🔊"}
              </button>
              <button type="button" onClick={toggleTime} className="hud-panel hud-button pointer-events-auto">
                {timeMode === "day" ? "☀️ Day" : "🌙 Night"}
              </button>
            </div>
            {p && (
              <div className="hud-panel pointer-events-auto flex flex-wrap items-center justify-end gap-2">
                <span>
                  {p.emoji} Visiting as <strong>{p.label}</strong>
                </span>
                <button type="button" className="hud-chip" onClick={showWelcome}>
                  Change look
                </button>
              </div>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className="hud-panel hud-button hud-gold pointer-events-auto" onClick={nextStop}>
                ✦ {waypoint ? `Heading to ${waypoint.label}` : "Guide me: next stop"}
              </button>
              {persona === "recruiter" && (
                <a href={CV_URL} download className="hud-panel hud-button hud-gold pointer-events-auto">
                  📄 Download CV
                </a>
              )}
              <a href="/resume" className="hud-panel hud-button pointer-events-auto">
                Résumé page
              </a>
            </div>
            <div className="flex w-72 flex-col gap-2">
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
          <div className="flex justify-center">
            <button type="button" onClick={interact} className="hud-panel hud-prompt pointer-events-auto">
              <kbd>E</kbd> {prompt}
            </button>
          </div>
        )}

        <div className="hud-panel max-w-sm self-start text-violet-100">
          <p>
            <kbd>W A S D</kbd> walk · <kbd>Shift</kbd> run · <kbd>Space</kbd> jump · <kbd>E</kbd> interact · <kbd>M</kbd> map
          </p>
          <p>Drag to look · scroll to zoom · click trees, lamps, balls, flowers, cars and buildings</p>
        </div>
      </div>

      {/* Fade to black between scenes */}
      <div
        className="pointer-events-none absolute inset-0 bg-[#0d0820] transition-opacity duration-[450ms]"
        style={{ opacity: fading ? 1 : 0 }}
      />
    </>
  );
}
