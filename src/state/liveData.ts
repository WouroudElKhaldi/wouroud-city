"use client";

import { create } from "zustand";

/**
 * Data from visitors, shown inside the city: the guestbook notes and the arcade's best scores.
 * Loaded once when something in the city needs it, refreshed after you sign or post a score.
 * Offline (no database) everything stays empty and the boards say so.
 */

export type Note = { name: string; from?: string; message: string; at: string };
export type ScoreRow = { name: string; score: number };
export type ScoreGame = "stack" | "flappy" | "rally";

type LiveData = {
  notes: Note[] | null;
  notesOffline: boolean;
  scores: Partial<Record<ScoreGame, ScoreRow[]>>;
  scoresOffline: boolean;
  loadNotes: () => Promise<void>;
  loadScores: () => Promise<void>;
  sign: (note: { name: string; from?: string; message: string }) => Promise<string | null>;
};

export const useLiveData = create<LiveData>((set, get) => ({
  notes: null,
  notesOffline: false,
  scores: {},
  scoresOffline: false,
  loadNotes: async () => {
    const d = (await fetch("/api/guestbook")
      .then((r) => r.json())
      .catch(() => null)) as { notes: Note[]; offline?: boolean } | null;
    set({ notes: d?.notes ?? [], notesOffline: !d || !!d.offline });
  },
  loadScores: async () => {
    const games: ScoreGame[] = ["rally", "flappy", "stack"];
    const results = await Promise.all(
      games.map((g) =>
        fetch(`/api/scores?game=${g}`)
          .then((r) => r.json() as Promise<{ scores: ScoreRow[]; offline?: boolean }>)
          .catch(() => null),
      ),
    );
    const scores: Partial<Record<ScoreGame, ScoreRow[]>> = {};
    games.forEach((g, i) => (scores[g] = results[i]?.scores ?? []));
    set({ scores, scoresOffline: results.every((r) => !r || r.offline) });
  },
  sign: async (note) => {
    const res = await fetch("/api/guestbook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(note),
    }).catch(() => null);
    if (res?.ok) {
      await get().loadNotes();
      return null;
    }
    const d = (await res?.json().catch(() => null)) as { error?: string; offline?: boolean } | null;
    if (d?.offline) return "The guestbook is offline right now.";
    return d?.error ?? "Couldn't sign right now, try again in a moment.";
  },
}));
