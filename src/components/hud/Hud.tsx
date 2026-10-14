"use client";

import { useEffect } from "react";
import { type AvatarKind, useCityStore } from "@/state/useCityStore";
import { districtById } from "@/world/districts";
import { GIRL_OUTFITS, type GirlOutfit } from "@/world/outfits";

const avatars: { kind: AvatarKind; label: string }[] = [
  { kind: "girl", label: "Girl" },
  { kind: "guy", label: "Guy" },
  { kind: "robot", label: "Robot" },
];

/** On-screen controls over the 3D city. */
export function Hud() {
  const {
    avatar,
    hijab,
    outfit,
    timeMode,
    muted,
    scene,
    nearby,
    seat,
    fading,
    toasts,
    setAvatar,
    setHijab,
    setOutfit,
    toggleTime,
    toggleMuted,
    interact,
    goTo,
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

  return (
    <>
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 text-sm text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col items-start gap-2">
            <div className="hud-panel pointer-events-auto">
              <p className="text-base font-semibold tracking-wide">Wouroud&apos;s City</p>
              <p className="text-violet-200">{place}</p>
            </div>
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
            <div className="hud-panel pointer-events-auto flex flex-wrap items-center justify-end gap-1">
              {avatars.map((a) => (
                <button
                  key={a.kind}
                  type="button"
                  onClick={() => setAvatar(a.kind)}
                  aria-pressed={avatar === a.kind}
                  className="hud-chip"
                >
                  {a.label}
                </button>
              ))}
              {avatar === "girl" && (
                <label className="ml-1 flex cursor-pointer items-center gap-1.5 px-1">
                  <input type="checkbox" checked={hijab} onChange={(e) => setHijab(e.target.checked)} />
                  Hijab
                </label>
              )}
            </div>
            {avatar === "girl" && (
              <div className="hud-panel pointer-events-auto flex flex-wrap items-center justify-end gap-1">
                {(Object.keys(GIRL_OUTFITS) as GirlOutfit[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setOutfit(key)}
                    aria-pressed={outfit === key}
                    className="hud-chip"
                  >
                    {GIRL_OUTFITS[key].label}
                  </button>
                ))}
              </div>
            )}
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
            <kbd>W A S D</kbd> walk · <kbd>Shift</kbd> run · <kbd>Space</kbd> jump · <kbd>E</kbd> interact
          </p>
          <p>Drag to look · scroll to zoom · click trees, lamps, balls, flowers and cars</p>
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
