"use client";

import { useEffect, useState } from "react";
import { useLiveData } from "@/state/liveData";

/**
 * The Arcade Pier leaderboard for one game, shown on its game-over screen: the top 10 and a form to
 * add your score under a name (remembered in this browser). Works offline too: it says so.
 */

type Game = "stack" | "flappy" | "rally";
type Row = { name: string; score: number };
const NAME_KEY = "wouroud-city:arcade-name";

function readName() {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function Leaderboard({ game, score, unit = "" }: { game: Game; score: number; unit?: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [name, setName] = useState(readName);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const load = () =>
    fetch(`/api/scores?game=${game}`)
      .then((r) => r.json())
      .then((d: { scores: Row[]; offline?: boolean }) => {
        setRows(d.scores);
        setOffline(!!d.offline);
      })
      .catch(() => setOffline(true));

  useEffect(() => {
    let alive = true;
    fetch(`/api/scores?game=${game}`)
      .then((r) => r.json())
      .then((d: { scores: Row[]; offline?: boolean }) => {
        if (!alive) return;
        setRows(d.scores);
        setOffline(!!d.offline);
      })
      .catch(() => alive && setOffline(true));
    return () => {
      alive = false;
    };
  }, [game]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || sent) return;
    try {
      localStorage.setItem(NAME_KEY, name.trim());
    } catch {
      // Name memory is a convenience only.
    }
    const res = await fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game, name: name.trim(), score }),
    }).catch(() => null);
    if (res?.ok) {
      setSent(true);
      setError("");
      void load();
      // The Hall of Fame on the pier shows the new score too.
      void useLiveData.getState().loadScores();
    } else {
      const d = (await res?.json().catch(() => null)) as { error?: string; offline?: boolean } | null;
      if (d?.offline) setOffline(true);
      setError(d?.error ?? "Couldn't save the score right now.");
    }
  };

  if (offline) return <p className="mt-3 text-xs text-violet-200">🏆 Leaderboard offline right now.</p>;
  return (
    <div className="mt-4 text-left">
      <p className="text-xs tracking-[0.2em] text-amber-200 uppercase">Top 10</p>
      {rows === null ? (
        <p className="text-sm text-violet-200">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-violet-200">No scores yet. Be the first!</p>
      ) : (
        <ol className="mt-1 max-h-40 space-y-0.5 overflow-y-auto text-sm text-white">
          {rows.map((r, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span>
                {i + 1}. {r.name}
              </span>
              <span className="font-bold text-amber-200">
                {r.score}
                {unit}
              </span>
            </li>
          ))}
        </ol>
      )}
      {!sent && score > 0 && (
        <form onSubmit={submit} className="mt-3 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 16))}
            placeholder="Your name"
            aria-label="Your name for the leaderboard"
            className="min-w-0 flex-1 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white placeholder:text-violet-300"
          />
          <button type="submit" className="hud-chip text-sm text-white">
            Save {score}
            {unit}
          </button>
        </form>
      )}
      {sent && <p className="mt-2 text-sm text-teal-200">Saved! 🎉</p>}
      {error && <p className="mt-2 text-sm text-pink-200">{error}</p>}
    </div>
  );
}
