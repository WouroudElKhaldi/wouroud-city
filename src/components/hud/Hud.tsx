"use client";

import { type AvatarKind, useCityStore } from "@/state/useCityStore";

const avatars: { kind: AvatarKind; label: string }[] = [
  { kind: "girl", label: "Girl" },
  { kind: "guy", label: "Guy" },
  { kind: "robot", label: "Robot" },
];

/** On-screen controls over the 3D city. */
export function Hud() {
  const { avatar, hijab, timeMode, setAvatar, setHijab, toggleTime } = useCityStore();

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 text-sm text-white">
      <div className="flex items-start justify-between gap-3">
        <div className="hud-panel pointer-events-auto">
          <p className="text-base font-semibold tracking-wide">Wouroud&apos;s City</p>
          <p className="text-violet-200">Prototype · phase 0</p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <button type="button" onClick={toggleTime} className="hud-panel hud-button pointer-events-auto">
            {timeMode === "day" ? "☀️ Day" : "🌙 Night"}
          </button>
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
        </div>
      </div>

      <div className="hud-panel max-w-xs self-start text-violet-100">
        <p>
          <kbd>W A S D</kbd> or arrows to walk · <kbd>Shift</kbd> to run · <kbd>Space</kbd> to jump
        </p>
        <p>Drag to look around · scroll to zoom</p>
      </div>
    </div>
  );
}
