"use client";

import { useState, useTransition } from "react";
import type { Content } from "@/content/schema";
import { contentSchema } from "@/content/schema";
import { publishSection, resetToSeed, type SectionKey } from "./actions";

const SECTIONS: { key: SectionKey; label: string; hint: string }[] = [
  { key: "profile", label: "Profile", hint: "Name, title, summary, links" },
  { key: "experience", label: "Experience", hint: "Business District buildings and offices" },
  { key: "projects", label: "Projects", hint: "Project Harbor; add screenshot paths to media" },
  { key: "skills", label: "Skills", hint: "Skill Downtown towers (level 1–10)" },
  { key: "education", label: "Education", hint: "Campus" },
  { key: "trainings", label: "Trainings", hint: "Training Park certificates" },
  { key: "languages", label: "Languages", hint: "Polyglot Quarter" },
  { key: "hobbies", label: "Hobbies", hint: "Hobby Quarter" },
  { key: "events", label: "Events", hint: "City events" },
  { key: "npcLines", label: "NPC lines", hint: "What people in the streets say" },
];

/**
 * Edit one section at a time as JSON, checked live against the same schema the site uses, then
 * publish. Every publish is kept in history on the server.
 */
export function AdminEditor({ content }: { content: Content }) {
  const [section, setSection] = useState<SectionKey>("projects");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ ok: boolean; lines: string[] } | null>(null);
  const [pending, start] = useTransition();
  const text = drafts[section] ?? JSON.stringify(content[section], null, 2);

  // Live check against the schema, like the server will.
  let problems: string[] = [];
  try {
    const value = JSON.parse(text);
    const result = contentSchema.shape[section].safeParse(value);
    if (!result.success) problems = result.error.issues.slice(0, 8).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
  } catch (e) {
    problems = [`JSON: ${(e as Error).message}`];
  }

  const publish = () =>
    start(async () => {
      const r = await publishSection(section, text);
      setStatus(r.ok ? { ok: true, lines: [`Published at ${new Date(r.at).toLocaleTimeString("en")}. The city shows it on the next visit.`] } : { ok: false, lines: r.errors });
    });

  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
      <nav className="flex flex-wrap gap-2 md:flex-col" aria-label="Sections">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => {
              setSection(s.key);
              setStatus(null);
            }}
            className={`rounded-xl px-3 py-2 text-left ${section === s.key ? "bg-violet-600 text-white" : "bg-white/5 hover:bg-white/10"}`}
          >
            <span className="block font-semibold">{s.label}</span>
            <span className="block text-xs text-violet-200">{s.hint}</span>
          </button>
        ))}
      </nav>
      <div>
        <textarea
          value={text}
          onChange={(e) => setDrafts((d) => ({ ...d, [section]: e.target.value }))}
          spellCheck={false}
          aria-label={`${section} as JSON`}
          className="h-[60vh] w-full rounded-xl bg-[#0b0720] p-3 font-mono text-sm text-violet-50 outline-none focus:ring-2 focus:ring-violet-400"
        />
        {problems.length > 0 ? (
          <ul className="mt-2 space-y-1 text-sm text-pink-200">
            {problems.map((p) => (
              <li key={p}>⚠ {p}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-teal-200">✓ Matches the schema</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="welcome-enter" disabled={pending || problems.length > 0} onClick={publish}>
            {pending ? "Publishing…" : "Publish this section"}
          </button>
          <button
            type="button"
            className="hud-chip text-white"
            onClick={() => setDrafts((d) => ({ ...d, [section]: JSON.stringify(content[section], null, 2) }))}
          >
            Undo my edits
          </button>
          <button
            type="button"
            className="hud-chip text-white"
            onClick={() => {
              const blob = new Blob([JSON.stringify(content, null, 2)], { type: "application/json" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "wouroud-city-content.json";
              a.click();
            }}
          >
            Download a backup
          </button>
          <button
            type="button"
            className="hud-chip text-pink-200"
            onClick={() => {
              if (window.confirm("Go back to the content in seed.ts? (Everything published stays in history.)")) start(async () => {
                const r = await resetToSeed();
                setStatus(r.ok ? { ok: true, lines: ["Back to seed.ts."] } : { ok: false, lines: r.errors });
              });
            }}
          >
            Reset to seed.ts
          </button>
        </div>
        {status && (
          <ul className={`mt-3 space-y-1 text-sm ${status.ok ? "text-teal-200" : "text-pink-200"}`} role="status">
            {status.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
