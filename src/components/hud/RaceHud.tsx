"use client";

import { useEffect, useState } from "react";
import { useCityStore } from "@/state/useCityStore";

const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

/** Countdown lights, lap and place while racing on the Arcade Pier, and the result at the end. */
export function RaceHud() {
  const race = useCityStore((s) => s.race);
  const startRace = useCityStore((s) => s.startRace);
  const updateRace = useCityStore((s) => s.updateRace);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!race || race.phase === "finished") return;
    const t = window.setInterval(() => setNow(performance.now()), 100);
    return () => window.clearInterval(t);
  }, [race]);
  if (!race || race.phase === "grid") return null;

  if (race.phase === "finished") {
    const won = race.position === 1;
    return (
      <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-[#0d0820]/40 p-4">
        <div className="welcome-card max-w-sm text-center">
          <p className="text-sm tracking-[0.25em] text-amber-200 uppercase">Ring Road Rally</p>
          <p className="mt-2 text-5xl font-extrabold text-white">{ordinal(race.position)}</p>
          <p className="text-violet-200">
            {won ? "You beat every bot! 🏆" : race.position === 2 ? "So close. One more go?" : "The bots were quick today."} · {race.time?.toFixed(1)} s
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <button type="button" className="welcome-enter" onClick={startRace}>
              Race again
            </button>
            <button type="button" className="hud-chip text-white" onClick={() => updateRace(null)}>
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  const left = Math.ceil((race.goAt - now) / 1000);
  const elapsed = Math.max(0, (now - race.goAt) / 1000);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-20 z-20 flex flex-col items-center gap-2 text-white">
      {race.phase === "countdown" ? (
        <div className="hud-panel flex items-center gap-3 px-5 py-3">
          {[3, 2, 1].map((n) => (
            <span
              key={n}
              className={`h-8 w-8 rounded-full border-2 border-white/30 ${left <= n && left > 0 ? "bg-red-500 shadow-[0_0_16px_#ef4444]" : "bg-black/40"}`}
            />
          ))}
          <span className="ml-2 text-3xl font-extrabold">{left > 0 ? left : "GO!"}</span>
        </div>
      ) : (
        <div className="hud-panel flex items-center gap-5 px-5 py-2 text-center">
          <div>
            <p className="text-[0.65rem] tracking-widest text-violet-200 uppercase">Lap</p>
            <p className="text-2xl font-extrabold">
              {Math.min(race.lap + 1, race.laps)}/{race.laps}
            </p>
          </div>
          <div>
            <p className="text-[0.65rem] tracking-widest text-amber-200 uppercase">Place</p>
            <p className="text-2xl font-extrabold text-amber-200">
              {ordinal(race.position)}/{race.racers}
            </p>
          </div>
          <div>
            <p className="text-[0.65rem] tracking-widest text-violet-200 uppercase">Time</p>
            <p className="text-2xl font-extrabold tabular-nums">{elapsed.toFixed(1)}</p>
          </div>
        </div>
      )}
      <p className="hud-panel text-xs text-violet-100">W/S drive · A/D steer · Shift boost · E gives up</p>
    </div>
  );
}
