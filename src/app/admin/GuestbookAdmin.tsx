"use client";

import { useState, useTransition } from "react";
import { type AdminNote, moderateNote } from "./actions";

/** Guestbook moderation: hide a note from the city, show it again, or delete it. */
export function GuestbookAdmin({ notes: initial }: { notes: AdminNote[] }) {
  const [notes, setNotes] = useState(initial);
  const [pending, start] = useTransition();
  const act = (id: string, action: "hide" | "show" | "delete") =>
    start(async () => {
      if (action === "delete" && !window.confirm("Delete this note for good?")) return;
      if (!(await moderateNote(id, action))) return;
      setNotes((list) => (action === "delete" ? list.filter((n) => n.id !== id) : list.map((n) => (n.id === id ? { ...n, hidden: action === "hide" } : n))));
    });
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold text-white">Guestbook</h2>
      <p className="mt-1 text-sm text-violet-200">Notes show in the plaza right away. Hide anything you don&apos;t want there.</p>
      {notes.length === 0 ? (
        <p className="mt-3 text-violet-200">No notes yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {notes.map((n) => (
            <li key={n.id} className={`flex flex-wrap items-start justify-between gap-3 rounded-xl bg-white/5 p-3 ${n.hidden ? "opacity-50" : ""}`}>
              <div className="min-w-0 flex-1">
                <p dir="auto">{n.message}</p>
                <p className="mt-1 text-xs text-violet-200">
                  {n.name}
                  {n.from ? `, ${n.from}` : ""} · {new Date(n.at).toLocaleString("en")} {n.hidden && "· hidden"}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="hud-chip text-sm text-white" disabled={pending} onClick={() => act(n.id, n.hidden ? "show" : "hide")}>
                  {n.hidden ? "Show" : "Hide"}
                </button>
                <button type="button" className="hud-chip text-sm text-pink-200" disabled={pending} onClick={() => act(n.id, "delete")}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
