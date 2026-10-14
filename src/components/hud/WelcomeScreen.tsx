"use client";

import { useState } from "react";
import { seedContent } from "@/content/seed";
import { type AvatarKind, useCityStore } from "@/state/useCityStore";
import { GIRL_OUTFITS, type GirlOutfit, HIJAB_COLORS } from "@/world/outfits";
import { PERSONAS, type Persona } from "@/world/personas";

const AVATARS: { kind: AvatarKind; label: string; emoji: string }[] = [
  { kind: "girl", label: "Girl", emoji: "🧕" },
  { kind: "guy", label: "Guy", emoji: "🧑" },
  { kind: "robot", label: "Robot", emoji: "🤖" },
];

/**
 * The first thing a visitor sees: who they are (recruiter, developer, just visiting)
 * and how they look. The city keeps loading behind it, so entering is instant.
 */
export function WelcomeScreen() {
  const { persona, avatar, hijab, hijabColor, outfit, start, setAvatar, setHijab, setHijabColor, setOutfit } =
    useCityStore();
  const [choice, setChoice] = useState<Persona | null>(persona);
  const profile = seedContent.profile;

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
          {avatar === "girl" && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="welcome-chip cursor-pointer">
                <input type="checkbox" checked={hijab} onChange={(e) => setHijab(e.target.checked)} /> Hijab
              </label>
              {(Object.keys(GIRL_OUTFITS) as GirlOutfit[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setOutfit(key)}
                  aria-pressed={outfit === key}
                  className="welcome-chip"
                >
                  {GIRL_OUTFITS[key].label}
                </button>
              ))}
              {hijab && (
                <span className="ml-1 flex items-center gap-1.5">
                  {HIJAB_COLORS.map((h) => (
                    <button
                      key={h.color}
                      type="button"
                      title={`${h.label} hijab`}
                      aria-label={`${h.label} hijab`}
                      aria-pressed={hijabColor === h.color}
                      onClick={() => setHijabColor(h.color)}
                      className="hud-swatch"
                      style={{ background: h.color }}
                    />
                  ))}
                </span>
              )}
            </div>
          )}
        </section>

        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            disabled={!choice}
            onClick={() => choice && start(choice)}
            className="welcome-enter"
          >
            {choice ? "Enter the city →" : "Pick who's visiting to enter"}
          </button>
          <a href="/resume" className="text-sm text-amber-200 underline-offset-4 hover:underline">
            In a hurry? Skip to the résumé →
          </a>
          <p className="text-xs text-violet-200/80">
            <kbd>W A S D</kbd> walk · <kbd>Shift</kbd> run · <kbd>E</kbd> interact · <kbd>M</kbd> map · drag to look
          </p>
        </div>
      </div>
    </div>
  );
}
