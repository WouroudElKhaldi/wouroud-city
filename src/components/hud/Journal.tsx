"use client";

import { useEffect } from "react";
import { useCityStore } from "@/state/useCityStore";
import { levelOf, QUESTS, track, useProgress } from "@/state/progress";

/**
 * The adventure journal (J or the 📖 button): level and XP, every quest with its progress, and the
 * badges earned. It also announces each quest the moment it's completed.
 */
export function Journal() {
  const open = useProgress((s) => s.journalOpen);
  const setOpen = useProgress((s) => s.setJournalOpen);
  const progress = useProgress((s) => s.progress);
  const done = useProgress((s) => s.done);
  const xp = useProgress((s) => s.xp);
  const fresh = useProgress((s) => s.fresh);
  const clearFresh = useProgress((s) => s.clearFresh);

  // Things that happen in the city count toward quests.
  const scene = useCityStore((s) => s.scene);
  useEffect(() => {
    track({ type: "scene", scene });
  }, [scene]);
  useEffect(
    () =>
      useCityStore.subscribe((now, before) => {
        if (now.seat && !before.seat) track({ type: "sit" });
        if (now.driving && !before.driving && now.driving.id !== "race-car" && now.driving.model !== "horse") track({ type: "drive" });
        if (now.photoAt !== before.photoAt && now.photoAt) track({ type: "photo" });
      }),
    [],
  );

  // Announce completed quests.
  useEffect(() => {
    if (!fresh.length) return;
    const toast = useCityStore.getState().toast;
    for (const q of fresh) toast(`${q.icon} ${q.title}: ${q.text.toLowerCase()}. +${q.xp} XP`, "Quest complete!");
    clearFresh();
  }, [fresh, clearFresh]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if (e.code === "KeyJ") setOpen(!useProgress.getState().journalOpen);
      if (e.key === "Escape" && useProgress.getState().journalOpen) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  if (!open) return null;
  const level = levelOf(xp);
  const into = xp % 100;
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-[#0d0820]/55 p-4" role="dialog" aria-label="Adventure journal">
      <div className="welcome-card max-h-[90dvh] w-full max-w-2xl overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.25em] text-amber-200 uppercase">Adventure journal</p>
            <h2 className="text-2xl font-extrabold text-white">Level {level}</h2>
            <div className="mt-2 h-2 w-56 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-amber-300" style={{ width: `${into}%` }} />
            </div>
            <p className="mt-1 text-sm text-violet-200">
              {xp} XP · {done.length}/{QUESTS.length} quests
            </p>
          </div>
          <button type="button" className="hud-chip text-white" onClick={() => setOpen(false)}>
            Close <kbd>J</kbd>
          </button>
        </div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {QUESTS.map((q) => {
            const ok = done.includes(q.id);
            const v = Math.min(q.goal, q.value(progress));
            return (
              <li key={q.id} className={`rounded-xl p-3 ${ok ? "bg-amber-300/15 ring-1 ring-amber-300/50" : "bg-white/5"}`}>
                <p className="font-bold text-white">
                  <span className={ok ? "" : "opacity-40 grayscale"}>{q.icon}</span> {q.title}
                  <span className="float-right text-xs text-amber-200">+{q.xp} XP</span>
                </p>
                <p className="text-sm text-violet-200">{q.text}</p>
                {q.goal > 1 && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full bg-teal-300" style={{ width: `${(v / q.goal) * 100}%` }} />
                  </div>
                )}
                <p className="mt-1 text-xs text-violet-300">{ok ? "✓ Done" : `${v}/${q.goal}`}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
