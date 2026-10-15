"use client";

import { useEffect, useRef, useState } from "react";
import { liveContent } from "@/content/live";
import { useCityStore } from "@/state/useCityStore";
import { track } from "@/state/progress";
import { answer, type Answer, SUGGESTIONS } from "@/world/askWouroud";
import { landmarkDoorstep } from "@/world/districts";
import { sfx } from "@/world/sfx";

type Message = { from: "you" | "wouroud"; text: string; go?: Answer["go"] };

/** Chat with Wouroud in the plaza: questions about her work, answered from the portfolio. */
export function AskWouroud() {
  const asking = useCityStore((s) => s.asking);
  const setAsking = useCityStore((s) => s.setAsking);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const profile = liveContent.profile;

  useEffect(() => {
    if (!asking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAsking(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [asking, setAsking]);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  if (!asking) return null;
  const ask = (q: string) => {
    const text = q.trim();
    if (!text) return;
    const a = answer(text, liveContent);
    setMessages((m) => [...m, { from: "you", text }, { from: "wouroud", text: a.text, go: a.go }]);
    setDraft("");
    sfx.talk();
    track({ type: "talk" });
  };
  const showWay = (go: NonNullable<Answer["go"]>) => {
    const door = landmarkDoorstep(go.district);
    useCityStore.getState().setWaypoint({ x: door.x, z: door.z, label: go.label });
    setAsking(false);
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-end justify-center bg-[#0d0820]/40 p-3 sm:items-center" role="dialog" aria-label="Ask Wouroud">
      <div className="welcome-card flex max-h-[85dvh] w-full max-w-lg flex-col">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={profile.photo ?? "/images/wouroud.png"} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-amber-300" />
          <div className="flex-1">
            <p className="font-bold text-white">{profile.name}</p>
            <p className="text-xs text-violet-200">{profile.title}</p>
          </div>
          <button type="button" className="hud-chip text-white" onClick={() => setAsking(false)}>
            Bye <kbd>Esc</kbd>
          </button>
        </div>
        <div ref={list} className="mt-3 min-h-24 flex-1 space-y-2 overflow-y-auto pr-1">
          {messages.length === 0 && (
            <p className="rounded-xl bg-white/10 p-3 text-sm text-white">Hi! I&apos;m Wouroud. Welcome to my city. Ask me anything about my work, or pick a question below.</p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.from === "you" ? "text-right" : ""}>
              <p className={`inline-block max-w-[85%] rounded-xl p-2.5 text-left text-sm ${m.from === "you" ? "bg-violet-600 text-white" : "bg-white/10 text-white"}`}>{m.text}</p>
              {m.go && (
                <button type="button" className="hud-chip mt-1 block text-xs text-amber-200" onClick={() => showWay(m.go!)}>
                  ✦ Show me the way to {m.go.label}
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" className="hud-chip text-xs text-white" onClick={() => ask(s)}>
              {s}
            </button>
          ))}
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            ask(draft);
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask about a skill, a project, a job…"
            aria-label="Your question"
            className="min-w-0 flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm text-white placeholder:text-violet-300"
          />
          <button type="submit" className="welcome-enter px-4 py-2 text-sm">
            Ask
          </button>
        </form>
      </div>
    </div>
  );
}
