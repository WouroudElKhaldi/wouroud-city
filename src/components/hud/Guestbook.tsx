"use client";

import { useEffect, useState } from "react";
import { track } from "@/state/progress";
import { useLiveData } from "@/state/liveData";
import { useCityStore } from "@/state/useCityStore";
import { sfx } from "@/world/sfx";

/**
 * The guestbook by the hub fountain: read what other visitors wrote and leave a note. New notes
 * appear on the board in the plaza right away. The name is remembered with the arcade name.
 */

const NAME_KEY = "wouroud-city:arcade-name";

function readName() {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function Guestbook() {
  const setActivity = useCityStore((s) => s.setActivity);
  const notes = useLiveData((s) => s.notes);
  const offline = useLiveData((s) => s.notesOffline);
  const [name, setName] = useState(readName);
  const [from, setFrom] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    void useLiveData.getState().loadNotes();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActivity(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setActivity]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending || !name.trim() || message.trim().length < 2) return;
    setSending(true);
    try {
      localStorage.setItem(NAME_KEY, name.trim());
    } catch {
      // Name memory is a convenience only.
    }
    const problem = await useLiveData.getState().sign({ name: name.trim(), from: from.trim() || undefined, message: message.trim() });
    setSending(false);
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    setSigned(true);
    setMessage("");
    sfx.coin();
    track({ type: "guestbook" });
  };

  return (
    <div className="activity-backdrop pointer-events-auto absolute inset-0 z-40 flex flex-col overflow-y-auto">
      <div className="flex items-center justify-between gap-3 p-3 text-white sm:p-4">
        <div>
          <p className="text-xs tracking-[0.25em] text-amber-200 uppercase">Central Plaza</p>
          <h2 className="text-xl font-extrabold sm:text-2xl">The city guestbook</h2>
        </div>
        <button type="button" className="hud-panel hud-button" onClick={() => setActivity(null)}>
          Leave <kbd>Esc</kbd>
        </button>
      </div>

      <div className="mx-auto grid w-full max-w-4xl flex-1 gap-4 p-4 md:grid-cols-[1fr_1.2fr]">
        <form onSubmit={submit} className="hud-panel flex h-fit flex-col gap-3 text-white">
          <p className="text-sm text-violet-200">Say hi, tell Wouroud what you liked, or leave a tip for the next visitor.</p>
          <label className="flex flex-col gap-1 text-xs tracking-wider text-violet-200 uppercase">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 24))}
              required
              className="rounded-lg bg-white/10 px-3 py-2 text-sm tracking-normal text-white normal-case"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs tracking-wider text-violet-200 uppercase">
            From (optional)
            <input
              value={from}
              onChange={(e) => setFrom(e.target.value.slice(0, 32))}
              placeholder="Beirut, a recruiter at…, a friend"
              className="rounded-lg bg-white/10 px-3 py-2 text-sm tracking-normal text-white normal-case placeholder:text-violet-300"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs tracking-wider text-violet-200 uppercase">
            Your note
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 200))}
              required
              rows={4}
              className="resize-none rounded-lg bg-white/10 px-3 py-2 text-sm tracking-normal text-white normal-case"
            />
            <span className="self-end text-[0.65rem] normal-case">{message.length}/200</span>
          </label>
          <button type="submit" className="welcome-enter" disabled={sending || offline}>
            {sending ? "Signing…" : "Sign the guestbook ✍️"}
          </button>
          {signed && <p className="text-sm text-teal-200">Thank you! Your note is on the board in the plaza.</p>}
          {error && <p className="text-sm text-pink-200">{error}</p>}
          {offline && <p className="text-sm text-violet-200">The guestbook is offline right now.</p>}
        </form>

        <div className="hud-panel text-white">
          <p className="text-xs tracking-[0.2em] text-amber-200 uppercase">Latest notes</p>
          {notes === null ? (
            <p className="mt-2 text-sm text-violet-200">Loading…</p>
          ) : notes.length === 0 ? (
            <p className="mt-2 text-sm text-violet-200">No notes yet. Be the first to sign!</p>
          ) : (
            <ul className="mt-2 max-h-[55vh] space-y-3 overflow-y-auto pr-1">
              {notes.map((n, i) => (
                <li key={`${n.at}-${i}`} className="rounded-xl bg-white/5 p-3">
                  <p dir="auto" className="text-sm">
                    {n.message}
                  </p>
                  <p className="mt-1 text-xs text-violet-200">
                    — <span className="font-bold text-pink-200">{n.name}</span>
                    {n.from ? `, ${n.from}` : ""} · {new Date(n.at).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
