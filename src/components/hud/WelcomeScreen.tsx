"use client";

import { useProgress } from "@react-three/drei";
import { useEffect, useState } from "react";
import { seedContent } from "@/content/seed";
import { type AvatarKind, useCityStore } from "@/state/useCityStore";
import { LOOKS } from "@/world/outfits";
import { PERSONAS, type Persona } from "@/world/personas";
import { useIsTouch } from "@/world/touch";

const AVATARS: { kind: AvatarKind; label: string; emoji: string }[] = [
  { kind: "girl", label: "Girl", emoji: "🧕" },
  { kind: "guy", label: "Guy", emoji: "🧑" },
  { kind: "robot", label: "Robot", emoji: "🤖" },
];

/** Give up waiting for the loader after this long, so a failed asset never locks the door. */
const LOAD_TIMEOUT_MS = 25000;

/**
 * True once the city's models and textures have finished loading. The canvas is
 * code-split, so "nothing loading yet" (total 0) does not count as ready.
 */
function useCityReady() {
  const idle = useProgress((s) => s.total > 0 && !s.active);
  const raw = useProgress((s) => s.progress);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  // Models load in waves (each Suspense boundary starts the next), so wait for a
  // quiet second before calling it done; once ready it stays ready.
  useEffect(() => {
    if (ready || !idle) return;
    const t = window.setTimeout(() => setReady(true), 1000);
    return () => window.clearTimeout(t);
  }, [idle, ready]);
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, []);
  // Never let the bar move backwards when a new wave adds more files.
  if (raw > progress) setProgress(raw);
  return { ready, progress: ready ? 100 : Math.min(progress, 99) };
}

/**
 * The first thing a visitor sees: who they are (recruiter, developer, just visiting)
 * and how they look. The city loads behind it, with progress on the enter button.
 */
export function WelcomeScreen() {
  const { persona, avatar, outfit, start, setAvatar, setOutfit } = useCityStore();
  const [choice, setChoice] = useState<Persona | null>(persona);
  const profile = seedContent.profile;
  const touch = useIsTouch();
  const { ready, progress } = useCityReady();

  return (
    <div className="welcome-backdrop pointer-events-auto absolute inset-0 z-30 flex items-center justify-center overflow-y-auto p-4">
      <div className="welcome-card my-auto w-full max-w-3xl">
        <header className="mb-6 text-center">
          <p className="text-sm tracking-[0.3em] text-amber-200/90 uppercase">Welcome to</p>
          <h1 className="welcome-title">Wouroud&apos;s City</h1>
          <p className="mt-2 text-violet-100">
            The 3D portfolio of <strong className="text-white">{profile.name}</strong>, {profile.title}
          </p>
        </header>

        <section aria-labelledby="who" className="mb-6">
          <h2 id="who" className="welcome-step">
            <span>1</span> Who&apos;s visiting?
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {(Object.keys(PERSONAS) as Persona[]).map((key) => {
              const p = PERSONAS[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setChoice(key)}
                  aria-pressed={choice === key}
                  className="persona-card"
                >
                  <span className="text-3xl" aria-hidden>
                    {p.emoji}
                  </span>
                  <span className="text-lg font-semibold text-white">{p.label}</span>
                  <span className="text-sm text-violet-100/90">{p.blurb}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="look" className="mb-7">
          <h2 id="look" className="welcome-step">
            <span>2</span> Choose your look
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {AVATARS.map((a) => (
              <button
                key={a.kind}
                type="button"
                onClick={() => setAvatar(a.kind)}
                aria-pressed={avatar === a.kind}
                className="welcome-chip"
              >
                <span aria-hidden>{a.emoji}</span> {a.label}
              </button>
            ))}
          </div>
          {avatar !== "robot" && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {LOOKS[avatar].map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setOutfit(l.id)}
                  aria-pressed={outfit === l.id}
                  className="welcome-chip"
                >
                  {l.label}
                </button>
              ))}
            </div>
          )}
        </section>

        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            disabled={!choice || !ready}
            onClick={() => choice && start(choice)}
            className="welcome-enter"
          >
            {!choice ? "Pick who's visiting to enter" : ready ? "Enter the city →" : `Building the city… ${Math.round(progress)}%`}
          </button>
          {!ready && (
            <div className="welcome-progress" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label="Loading the city">
              <span style={{ width: `${Math.max(4, progress)}%` }} />
            </div>
          )}
          <a href="/resume" className="text-sm text-amber-200 underline-offset-4 hover:underline">
            In a hurry? Skip to the résumé →
          </a>
          <p className="text-xs text-violet-200/80">
            {touch ? (
              "Joystick to walk · drag to look · pinch to zoom · tap things to play with them"
            ) : (
              <>
                <kbd>W A S D</kbd> walk · <kbd>Shift</kbd> run · <kbd>E</kbd> interact · <kbd>M</kbd> map · drag to look
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
