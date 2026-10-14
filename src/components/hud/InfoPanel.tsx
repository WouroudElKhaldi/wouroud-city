"use client";

import { useEffect } from "react";
import { seedContent } from "@/content/seed";
import type { Experience, Project, Skill, Training } from "@/content/schema";
import { useCityStore } from "@/state/useCityStore";
import { districtById } from "@/world/districts";
import { sfx } from "@/world/sfx";

function formatDate(date: string | null) {
  if (!date) return "Present";
  const [y, m] = date.split("-");
  if (!m) return y;
  return new Date(Number(y), Number(m) - 1).toLocaleString("en", { month: "short", year: "numeric" });
}

function Chips({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-1.5">
      {items.map((t) => (
        <li key={t} className="panel-chip">
          {t}
        </li>
      ))}
    </ul>
  );
}

function Bullets({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="mt-3 list-disc space-y-1.5 pl-5 text-violet-50/95">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

function ExperienceView({ job }: { job: Experience }) {
  return (
    <>
      <p className="panel-kicker">
        {job.type.replace("-", " ")} · {job.location}
        {job.remote ? " · remote" : ""}
      </p>
      <h2 className="panel-title">{job.company}</h2>
      {job.formerName && <p className="text-sm text-violet-200">Formerly {job.formerName}</p>}
      <ol className="mt-3 space-y-1">
        {job.roles.map((r) => (
          <li key={r.title} className="flex flex-wrap justify-between gap-2">
            <span className="font-semibold text-white">{r.title}</span>
            <span className="text-amber-200">
              {formatDate(r.start)} – {formatDate(r.end)}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-3">{job.summary}</p>
      <Bullets items={job.highlights} />
      <Chips items={job.tech} />
      {job.plaque && <p className="panel-plaque">★ {job.plaque}</p>}
    </>
  );
}

function SkillView({ skill }: { skill: Skill }) {
  const usedIn = seedContent.projects.filter((p) => p.tech.some((t) => t.toLowerCase().includes(skill.name.toLowerCase().replace(".js", ""))));
  return (
    <>
      <p className="panel-kicker">Skill · {skill.category}</p>
      <h2 className="panel-title">{skill.name}</h2>
      <div className="mt-4">
        <div className="flex justify-between text-sm">
          <span>Level</span>
          <span className="text-amber-200">{skill.level}/10</span>
        </div>
        <div className="panel-meter">
          <span style={{ width: `${skill.level * 10}%` }} />
        </div>
        <p className="mt-2 text-sm">
          {skill.years} year{skill.years === 1 ? "" : "s"} of experience
        </p>
      </div>
      {skill.note && <p className="mt-3">{skill.note}</p>}
      {usedIn.length > 0 && (
        <>
          <p className="mt-4 text-sm font-semibold text-white">Used in</p>
          <Chips items={usedIn.map((p) => p.name)} />
        </>
      )}
    </>
  );
}

function ProjectView({ project }: { project: Project }) {
  const status = { live: "Live", offline: "Not deployed (demo on request)", "in-progress": "In progress", private: "Private" }[project.status];
  return (
    <>
      <p className="panel-kicker">
        {project.category === "client" ? "Client project" : project.category === "work-private" ? "Professional work" : "Project"} ·{" "}
        {project.year} · {status}
      </p>
      <h2 className="panel-title">{project.name}</h2>
      <p className="mt-2 text-lg text-violet-50">{project.pitch}</p>
      {project.description.map((d) => (
        <p key={d} className="mt-3">
          {d}
        </p>
      ))}
      <Bullets items={project.highlights} />
      <p className="mt-3 text-sm">
        <span className="text-violet-200">Role:</span> {project.role}
      </p>
      <Chips items={project.tech} />
      {project.links.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {project.links.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="panel-link">
              {l.label} ↗
            </a>
          ))}
        </div>
      )}
      {project.plaque && <p className="panel-plaque">★ {project.plaque}</p>}
    </>
  );
}

function TrainingView({ t }: { t: Training }) {
  return (
    <>
      <p className="panel-kicker">
        {t.kind} · {t.provider}
        {t.issuer ? ` · ${t.issuer}` : ""} · {formatDate(t.date)}
        {t.status === "in-progress" ? " · in progress" : ""}
      </p>
      <h2 className="panel-title">{t.name}</h2>
      <p className="mt-3">{t.summary}</p>
      {t.courses.length > 0 && (
        <>
          <p className="mt-4 text-sm font-semibold text-white">{t.courses.length} courses</p>
          <Bullets items={t.courses} />
        </>
      )}
      {t.verifyUrl && (
        <a href={t.verifyUrl} target="_blank" rel="noreferrer" className="panel-link mt-4 inline-block">
          Verify certificate ↗
        </a>
      )}
    </>
  );
}

function PanelBody({ district, id }: { district: string; id: string }) {
  const c = seedContent;
  switch (district) {
    case "business": {
      const job = c.experience.find((e) => e.id === id);
      return job ? <ExperienceView job={job} /> : null;
    }
    case "skills": {
      const skill = c.skills.find((s) => s.id === id);
      return skill ? <SkillView skill={skill} /> : null;
    }
    case "projects": {
      const project = c.projects.find((p) => p.id === id);
      return project ? <ProjectView project={project} /> : null;
    }
    case "training": {
      const t = c.trainings.find((x) => x.id === id);
      return t ? <TrainingView t={t} /> : null;
    }
    case "campus": {
      const e = c.education.find((x) => x.id === id);
      return e ? (
        <>
          <p className="panel-kicker">Studies · {e.location}</p>
          <h2 className="panel-title">{e.degree}</h2>
          <p className="mt-2 text-lg">{e.field}</p>
          <p className="mt-1 text-violet-200">
            {e.school} · {formatDate(e.start)} – {formatDate(e.end)}
          </p>
          <Bullets items={e.notes} />
        </>
      ) : null;
    }
    case "languages": {
      const l = c.languages.find((x) => x.id === id);
      const level = l?.level === "native" ? 100 : { A1: 20, A2: 35, B1: 50, B2: 65, C1: 82, C2: 95 }[l?.level ?? "A1"];
      return l ? (
        <>
          <p className="panel-kicker">Language</p>
          <h2 className="panel-title">
            {l.flag} {l.name}
          </h2>
          <p className="mt-2 text-2xl">{l.greeting}</p>
          <div className="mt-4">
            <div className="flex justify-between text-sm">
              <span>Level</span>
              <span className="text-amber-200">{l.level === "native" ? "Native" : l.level}</span>
            </div>
            <div className="panel-meter">
              <span style={{ width: `${level}%` }} />
            </div>
          </div>
        </>
      ) : null;
    }
    case "hobbies": {
      const h = c.hobbies.find((x) => x.id === id);
      return h ? (
        <>
          <p className="panel-kicker">Hobby</p>
          <h2 className="panel-title">{h.name}</h2>
          <p className="mt-3">{h.description}</p>
          <p className="panel-plaque">🎨 Coming soon inside: {h.interaction}</p>
        </>
      ) : null;
    }
    default:
      return (
        <>
          <p className="panel-kicker">Arcade Pier</p>
          <h2 className="panel-title">Full Stack Arcade</h2>
          <p className="mt-3">
            Stack the stack: drop blocks labelled HTML, CSS, JS, React, Node, MongoDB… as high as you can. The game opens soon.
          </p>
        </>
      );
  }
}

/** Details for the building you are standing at. Esc or the close button returns to the city. */
export function InfoPanel() {
  const panel = useCityStore((s) => s.panel);
  const openPanel = useCityStore((s) => s.openPanel);

  useEffect(() => {
    if (!panel) return;
    sfx.pop();
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") openPanel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, openPanel]);

  if (!panel) return null;
  const district = districtById(panel.district);

  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-end p-4" onClick={() => openPanel(null)}>
      <article
        className="info-panel"
        style={{ borderColor: district.accent }}
        onClick={(e) => e.stopPropagation()}
        aria-label="Building details"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-xs tracking-widest text-violet-200 uppercase">{district.name}</span>
          <button type="button" className="hud-chip text-white" onClick={() => openPanel(null)}>
            Close <kbd>Esc</kbd>
          </button>
        </div>
        <PanelBody district={panel.district} id={panel.id} />
      </article>
    </div>
  );
}
