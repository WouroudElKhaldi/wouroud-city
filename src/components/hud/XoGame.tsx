"use client";

import { useCallback, useEffect, useState } from "react";
import { useCityStore } from "@/state/useCityStore";
import { sfx } from "@/world/sfx";

/**
 * XO (tic-tac-toe) against a bot, in the Arcade Pier's XO Lounge. You are X and start;
 * the bot is O. Three levels:
 *  - Easy: plays at random, though it takes a win when one is right there half the time
 *  - Medium: wins when it can, blocks your wins, otherwise prefers center and corners
 *  - Hard: perfect play (minimax), it can't be beaten, only drawn
 * The score for the session stays on screen.
 */

type Cell = "X" | "O" | null;
type Level = "easy" | "medium" | "hard";

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function winner(b: Cell[]): { who: "X" | "O"; line: number[] } | null {
  for (const line of LINES) {
    const [a, c, d] = line;
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return { who: b[a] as "X" | "O", line };
  }
  return null;
}

const free = (b: Cell[]) => b.flatMap((c, i) => (c ? [] : [i]));

/** A move that completes a line for `who`, if there is one. */
function finishing(b: Cell[], who: "X" | "O") {
  return free(b).find((i) => {
    const next = [...b];
    next[i] = who;
    return winner(next)?.who === who;
  });
}

function minimax(b: Cell[], turn: "X" | "O", depth: number): number {
  const w = winner(b);
  if (w) return w.who === "O" ? 10 - depth : depth - 10;
  const moves = free(b);
  if (!moves.length) return 0;
  const scores = moves.map((i) => {
    const next = [...b];
    next[i] = turn;
    return minimax(next, turn === "O" ? "X" : "O", depth + 1);
  });
  return turn === "O" ? Math.max(...scores) : Math.min(...scores);
}

function botMove(b: Cell[], level: Level): number {
  const moves = free(b);
  const random = () => moves[Math.floor(Math.random() * moves.length)];
  if (level === "easy") {
    const win = finishing(b, "O");
    return win !== undefined && Math.random() < 0.5 ? win : random();
  }
  if (level === "medium") {
    const win = finishing(b, "O");
    if (win !== undefined) return win;
    const block = finishing(b, "X");
    if (block !== undefined && Math.random() < 0.85) return block;
    const pref = [4, 0, 2, 6, 8].filter((i) => !b[i]);
    return pref.length && Math.random() < 0.7 ? pref[Math.floor(Math.random() * pref.length)] : random();
  }
  // Hard: best score; among equals pick at random so games vary.
  let best = -Infinity;
  let picks: number[] = [];
  for (const i of moves) {
    const next = [...b];
    next[i] = "O";
    const s = minimax(next, "X", 1);
    if (s > best) {
      best = s;
      picks = [i];
    } else if (s === best) picks.push(i);
  }
  return picks[Math.floor(Math.random() * picks.length)];
}

const LEVELS: { id: Level; label: string; note: string }[] = [
  { id: "easy", label: "Easy", note: "A relaxed bot" },
  { id: "medium", label: "Medium", note: "Blocks and grabs wins" },
  { id: "hard", label: "Hard", note: "Never loses" },
];

export function XoGame() {
  const setActivity = useCityStore((s) => s.setActivity);
  const [level, setLevel] = useState<Level>("medium");
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null));
  const [thinking, setThinking] = useState(false);
  const [score, setScore] = useState({ you: 0, bot: 0, draws: 0 });
  const result = winner(board);
  const full = free(board).length === 0;
  const over = !!result || full;

  const reset = useCallback(() => {
    setBoard(Array(9).fill(null));
    setThinking(false);
  }, []);

  const play = (i: number) => {
    if (board[i] || over || thinking) return;
    const next = [...board];
    next[i] = "X";
    sfx.click();
    setBoard(next);
    const w = winner(next);
    if (w || !free(next).length) {
      finish(w?.who ?? null);
      return;
    }
    // The bot "thinks" for a moment so its move is easy to follow.
    setThinking(true);
    window.setTimeout(() => {
      const after = [...next];
      after[botMove(next, level)] = "O";
      sfx.pop();
      setBoard(after);
      setThinking(false);
      const w2 = winner(after);
      if (w2 || !free(after).length) finish(w2?.who ?? null);
    }, 420);
  };

  const finish = (who: "X" | "O" | null) => {
    if (who === "X") sfx.coin();
    else if (who === "O") sfx.clunk();
    setScore((s) => ({
      you: s.you + (who === "X" ? 1 : 0),
      bot: s.bot + (who === "O" ? 1 : 0),
      draws: s.draws + (who ? 0 : 1),
    }));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActivity(null);
      const n = Number(e.key);
      if (n >= 1 && n <= 9) {
        // Number keys map to the board like a phone keypad: 1 2 3 on top.
        document.getElementById(`xo-cell-${n - 1}`)?.click();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setActivity]);

  const status = result
    ? result.who === "X"
      ? "You win! 🎉"
      : "The bot wins this one"
    : full
      ? "Draw"
      : thinking
        ? "The bot is thinking…"
        : "Your move (X)";

  return (
    <div className="activity-backdrop pointer-events-auto absolute inset-0 z-40 flex flex-col overflow-y-auto">
      <div className="flex items-center justify-between gap-3 p-3 text-white sm:p-4">
        <div>
          <p className="text-xs tracking-[0.25em] text-amber-200 uppercase">Arcade Pier · XO Lounge</p>
          <h2 className="text-xl font-extrabold sm:text-2xl">XO vs the bot</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="hud-panel text-center">
            <p className="text-[0.65rem] tracking-widest text-violet-200 uppercase">You · Bot · Draw</p>
            <p className="text-xl font-extrabold">
              {score.you} · {score.bot} · {score.draws}
            </p>
          </div>
          <button type="button" className="hud-panel hud-button" onClick={() => setActivity(null)}>
            Leave <kbd>Esc</kbd>
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-5 p-4">
        <div className="flex flex-wrap justify-center gap-2" role="radiogroup" aria-label="Bot level">
          {LEVELS.map((l) => (
            <button
              key={l.id}
              type="button"
              role="radio"
              aria-checked={level === l.id}
              onClick={() => {
                setLevel(l.id);
                reset();
              }}
              className={`hud-chip text-white ${level === l.id ? "ring-2 ring-amber-300" : ""}`}
            >
              <span className="font-bold">{l.label}</span> <span className="text-violet-200">· {l.note}</span>
            </button>
          ))}
        </div>

        <p className="text-lg font-bold text-white" aria-live="polite">
          {status}
        </p>

        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-[#1a103d]/70 p-3 shadow-2xl">
          {board.map((cell, i) => {
            const lit = result?.line.includes(i);
            return (
              <button
                key={i}
                id={`xo-cell-${i}`}
                type="button"
                onClick={() => play(i)}
                aria-label={`Cell ${i + 1}${cell ? `, ${cell}` : ""}`}
                className={`flex h-20 w-20 items-center justify-center rounded-xl text-5xl font-black transition sm:h-28 sm:w-28 sm:text-6xl ${
                  lit ? "bg-amber-300 text-[#1a103d]" : "bg-white/10 hover:bg-white/20"
                } ${cell === "X" ? "text-pink-300" : "text-teal-300"}`}
              >
                {cell}
              </button>
            );
          })}
        </div>

        {over && (
          <button type="button" className="welcome-enter" onClick={reset}>
            Play again
          </button>
        )}
        <p className="text-sm text-violet-200">Click a square or press 1–9 · you start as X</p>
      </div>
    </div>
  );
}
