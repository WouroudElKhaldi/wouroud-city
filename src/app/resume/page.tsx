import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { seedContent } from "@/content/seed";
import type { Experience, Language, Project, SkillCategory } from "@/content/schema";

export const metadata: Metadata = {
  title: "Résumé · Wouroud El Khaldi",
  description: "Wouroud El Khaldi, Mid-Senior Full Stack Software Engineer: experience, skills, projects and certificates.",
};

function formatDate(date: string | null) {
  if (!date) return "Present";
  const [y, m] = date.split("-");
  if (!m) return y;
  return new Date(Number(y), Number(m) - 1).toLocaleString("en", { month: "short", year: "numeric" });
}

const categoryLabels: Record<SkillCategory, string> = {
  languages: "Languages",
  frontend: "Front end",
  backend: "Back end",
  databases: "Databases & ORMs",
  tools: "Tools",
  state: "State management",
  hosting: "Hosting & cloud",
  design: "Design",
  architecture: "Architecture",
  ai: "AI",
};

const typeStyles: Record<Experience["type"], { label: string; dot: string; badge: string }> = {
  "full-time": { label: "Full-time", dot: "bg-violet-600", badge: "bg-violet-100 text-violet-800" },
  freelance: { label: "Freelance", dot: "bg-teal-500", badge: "bg-teal-50 text-teal-800" },
  internship: { label: "Internship", dot: "bg-violet-400", badge: "bg-violet-50 text-violet-700" },
  apprenticeship: { label: "Bootcamp", dot: "bg-indigo-500", badge: "bg-indigo-50 text-indigo-700" },
  volunteer: { label: "Volunteer", dot: "bg-amber-500", badge: "bg-amber-50 text-amber-800" },
};

const projectStatus: Record<Project["status"], { label: string; cls: string }> = {
  live: { label: "Live", cls: "bg-teal-50 text-teal-700 ring-teal-200" },
  offline: { label: "Archived", cls: "bg-slate-50 text-slate-600 ring-slate-200" },
  "in-progress": { label: "In progress", cls: "bg-amber-50 text-amber-800 ring-amber-200" },
  private: { label: "Private", cls: "bg-violet-50 text-violet-700 ring-violet-200" },
};

const tierOrder: Record<Project["tier"], number> = { flagship: 0, featured: 1, standard: 2 };

const languageScore: Record<Language["level"], number> = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6, native: 6 };

/** Section heading with a small gold accent bar. */
function SectionTitle({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="mb-5 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-violet-900">
      <span className="h-4 w-1 rounded-full bg-gradient-to-b from-amber-400 to-amber-500" />
      {children}
      <span className="h-px flex-1 bg-violet-200/70" />
    </h2>
  );
}

function SideTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-[0.7rem] font-bold uppercase tracking-[0.2em] text-violet-500">{children}</h2>;
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_1px_2px_rgb(46_16_101/0.04),0_8px_24px_-12px_rgb(46_16_101/0.12)] print:break-inside-avoid print:shadow-none ${className}`}>
      {children}
    </div>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return <span className="rounded-md bg-violet-50 px-2 py-0.5 text-[0.7rem] font-medium text-violet-700 ring-1 ring-violet-100 ring-inset">{children}</span>;
}

/** A clean 2D résumé built from the same content as the 3D city. */
export default function ResumePage() {
  const c = seedContent;
  const p = c.profile;
  const categories = [...new Set(c.skills.map((s) => s.category))];
  const projects = [...c.projects].sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier] || b.year - a.year);
  const firstStart = c.experience.flatMap((j) => j.roles.map((r) => r.start)).sort()[0];
  const stats = [
    { value: firstStart.slice(0, 4), label: "building since" },
    { value: `${c.projects.length}`, label: "projects" },
    { value: `${c.trainings.filter((t) => t.kind === "certificate" && t.status === "completed").length}`, label: "certificates" },
    { value: "25+", label: "payment providers" },
  ];

  return (
    <main className="min-h-dvh bg-[#f6f2fd] text-slate-700 print:bg-white">
      {/* Hero */}
      <header className="relative overflow-hidden bg-[#1a103d] text-white print:bg-white print:text-slate-900">
        <div aria-hidden className="pointer-events-none absolute inset-0 print:hidden">
          <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-violet-600/40 blur-3xl" />
          <div className="absolute -right-20 top-10 h-80 w-80 rounded-full bg-teal-400/20 blur-3xl" />
          <div className="absolute -bottom-40 left-1/2 h-80 w-[36rem] -translate-x-1/2 rounded-full bg-amber-400/15 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgb(255_255_255)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255)_1px,transparent_1px)] [background-size:40px_40px]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 pt-6 pb-24 sm:px-8 print:pb-6">
          <nav className="flex items-center justify-between print:hidden">
            <Link href="/" className="group inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-violet-100 ring-1 ring-white/15 backdrop-blur transition hover:bg-white/15">
              <span className="transition group-hover:-translate-x-0.5">←</span> Back to the 3D city
            </Link>
            <a href="/cv/Wouroud_El_Khaldi-cv.pdf" download className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-300 to-amber-400 px-4 py-2 text-sm font-bold text-[#1a103d] shadow-lg shadow-amber-500/20 transition hover:brightness-105">
              <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
                <path d="M10 2a1 1 0 0 1 1 1v8.59l2.3-2.3a1 1 0 1 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.42L9 11.6V3a1 1 0 0 1 1-1ZM4 16a1 1 0 1 0 0 2h12a1 1 0 1 0 0-2H4Z" />
              </svg>
              Download CV
            </a>
          </nav>

          <div className="mt-10 flex flex-col items-center gap-8 text-center md:flex-row md:items-center md:gap-10 md:text-left">
            {p.photo && (
              <div className="relative shrink-0">
                <div className="absolute -inset-1.5 rounded-full bg-gradient-to-br from-amber-300 via-violet-400 to-teal-300 opacity-90 print:hidden" />
                <Image
                  src={p.photo}
                  alt={p.name}
                  width={320}
                  height={320}
                  loading="eager"
                  className="relative h-36 w-36 rounded-full border-4 border-[#1a103d] object-cover object-[62%_42%] sm:h-40 sm:w-40 print:h-28 print:w-28 print:border-white"
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold tracking-[0.25em] text-amber-300 uppercase print:text-amber-600">Résumé</p>
              <h1 className="mt-2 bg-gradient-to-r from-violet-200 via-white to-amber-200 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl print:text-violet-900">
                {p.name}
              </h1>
              <p className="mt-2 text-lg font-semibold text-teal-300 sm:text-xl print:text-teal-700">{p.title}</p>
              <p className="mt-3 max-w-2xl text-violet-100/80 print:text-slate-600">{p.headline}</p>
              <ul className="mt-5 flex flex-wrap justify-center gap-2 text-sm md:justify-start">
                <li className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/15 print:ring-slate-300">
                  <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4 text-teal-300" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18s6-5.33 6-10a6 6 0 1 0-12 0c0 4.67 6 10 6 10Zm0-7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" clipRule="evenodd" />
                  </svg>
                  {p.location}
                </li>
                <li>
                  <a href={`mailto:${p.email}`} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/15 transition hover:bg-white/20 print:ring-slate-300">
                    <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4 text-amber-300" fill="currentColor">
                      <path d="M2.5 5.5A2 2 0 0 1 4.5 4h11a2 2 0 0 1 2 1.5L10 10 2.5 5.5Z" />
                      <path d="M2.5 7.6V14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7.6l-7 4.2a1 1 0 0 1-1 0l-7-4.2Z" />
                    </svg>
                    {p.email}
                  </a>
                </li>
                {p.links.map((l) => (
                  <li key={l.url}>
                    <a href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/15 transition hover:bg-white/20 print:ring-slate-300">
                      {l.label} <span aria-hidden className="text-violet-300">↗</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </header>

      {/* Stats strip, overlapping the hero */}
      <div className="relative mx-auto -mt-12 max-w-6xl px-4 sm:px-8 print:mt-0">
        <dl className="grid grid-cols-2 overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-xl shadow-violet-900/10 sm:grid-cols-4 print:shadow-none">
          {stats.map((s, i) => (
            <div key={s.label} className={`px-5 py-4 text-center ${i > 0 ? "sm:border-l" : ""} ${i % 2 === 1 ? "border-l" : ""} ${i > 1 ? "border-t sm:border-t-0" : ""} border-violet-100`}>
              <dt className="sr-only">{s.label}</dt>
              <dd className="text-2xl font-extrabold text-violet-800">{s.value}</dd>
              <dd className="text-xs font-medium tracking-wide text-slate-500 uppercase">{s.label}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-8 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-10 print:grid-cols-[14rem_minmax(0,1fr)] print:py-6">
        {/* Sidebar */}
        <aside className="order-2 space-y-6 lg:order-1 print:order-1">
          <Card>
            <SideTitle>Top skills</SideTitle>
            <ul className="flex flex-wrap gap-1.5">
              {p.topSkills.map((s) => (
                <li key={s} className="rounded-full bg-gradient-to-r from-amber-100 to-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-200 ring-inset">
                  {s}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <SideTitle>Skills</SideTitle>
            <div className="space-y-4">
              {categories.map((cat) => (
                <div key={cat}>
                  <h3 className="mb-1.5 text-xs font-semibold text-slate-500">{categoryLabels[cat]}</h3>
                  <ul className="flex flex-wrap gap-1.5">
                    {c.skills
                      .filter((s) => s.category === cat)
                      .sort((a, b) => b.level - a.level)
                      .map((s) => (
                        <li
                          key={s.id}
                          title={`${s.years} yr${s.years === 1 ? "" : "s"}`}
                          className={`rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                            s.level >= 8
                              ? "bg-violet-700 text-white ring-violet-700"
                              : s.level >= 6
                                ? "bg-violet-100 text-violet-800 ring-violet-200"
                                : "bg-white text-slate-600 ring-slate-200"
                          }`}
                        >
                          {s.name}
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-violet-100 pt-3 text-[0.65rem] text-slate-500">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-violet-700" /> Expert</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-violet-200" /> Proficient</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm ring-1 ring-slate-300" /> Familiar</span>
            </p>
          </Card>

          <Card>
            <SideTitle>Languages</SideTitle>
            <ul className="space-y-3">
              {c.languages.map((l) => (
                <li key={l.id}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-semibold text-slate-800">
                      <span className="mr-1.5">{l.flag}</span>
                      {l.name}
                    </span>
                    <span className="text-xs text-slate-500">{l.level === "native" ? "Native" : l.level}</span>
                  </div>
                  <div className="mt-1.5 flex gap-1" aria-hidden>
                    {Array.from({ length: 6 }, (_, i) => (
                      <span key={i} className={`h-1.5 flex-1 rounded-full ${i < languageScore[l.level] ? "bg-gradient-to-r from-teal-400 to-teal-500" : "bg-slate-100"}`} />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <SideTitle>Education</SideTitle>
            <ul className="space-y-4">
              {c.education.map((e) => (
                <li key={e.id}>
                  <p className="text-sm font-semibold leading-snug text-slate-800">{e.degree}</p>
                  <p className="text-sm text-violet-700">{e.field}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {e.school} · {formatDate(e.start)} – {formatDate(e.end)}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </aside>

        {/* Main column */}
        <div className="order-1 min-w-0 space-y-12 lg:order-2 print:order-2">
          <section>
            <SectionTitle>About</SectionTitle>
            <div className="space-y-3 text-[0.95rem] leading-relaxed">
              {p.about.map((a, i) => (
                <p key={a} className={i === 0 ? "text-lg leading-relaxed font-medium text-slate-800" : ""}>
                  {a}
                </p>
              ))}
            </div>
          </section>

          <section>
            <SectionTitle>Experience</SectionTitle>
            <ol className="relative space-y-6 before:absolute before:top-2 before:bottom-2 before:left-[7px] before:w-0.5 before:bg-gradient-to-b before:from-violet-300 before:via-violet-200 before:to-transparent">
              {c.experience.map((job) => {
                const t = typeStyles[job.type];
                return (
                  <li key={job.id} className="relative pl-8">
                    <span className={`absolute top-6 left-0 h-4 w-4 rounded-full ring-4 ring-[#f6f2fd] print:ring-white ${t.dot}`} />
                    <Card>
                      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">{job.company}</h3>
                          {job.formerName && <p className="text-xs text-slate-500">formerly {job.formerName}</p>}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span className={`rounded-full px-2.5 py-0.5 font-semibold ${t.badge}`}>{t.label}</span>
                          <span className="rounded-full bg-slate-50 px-2.5 py-0.5 text-slate-600 ring-1 ring-slate-200 ring-inset">
                            {job.location}
                            {job.remote && job.location !== "Remote" && !job.location.includes("remote") ? " · Remote" : ""}
                          </span>
                        </div>
                      </div>

                      <ul className="mt-3 space-y-1">
                        {job.roles.map((r, i) => (
                          <li key={r.title} className="flex flex-wrap items-baseline justify-between gap-x-4">
                            <span className={`font-semibold ${i === 0 ? "text-violet-800" : "text-violet-600/80"}`}>{r.title}</span>
                            <span className="text-sm font-medium whitespace-nowrap text-slate-500 tabular-nums">
                              {formatDate(r.start)} – {formatDate(r.end)}
                            </span>
                          </li>
                        ))}
                      </ul>

                      <ul className="mt-3 space-y-1.5 text-sm leading-relaxed">
                        {job.highlights.map((h) => (
                          <li key={h} className="flex gap-2.5">
                            <span aria-hidden className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                            <span>{h}</span>
                          </li>
                        ))}
                      </ul>

                      <ul className="mt-4 flex flex-wrap gap-1.5">
                        {job.tech.map((tech) => (
                          <li key={tech}>
                            <Tag>{tech}</Tag>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  </li>
                );
              })}
            </ol>
          </section>

          <section>
            <SectionTitle>Projects</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              {projects.map((pr) => {
                const st = projectStatus[pr.status];
                const flagship = pr.tier === "flagship";
                return (
                  <Card key={pr.id} className={`flex flex-col ${flagship ? "sm:col-span-2 border-violet-200 bg-gradient-to-br from-white to-violet-50/70" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-slate-900">
                          {pr.name}
                          {flagship && <span className="ml-2 align-middle text-[0.65rem] font-bold tracking-wider text-amber-600 uppercase">★ Flagship</span>}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {pr.year} · <span className="capitalize">{pr.category.replace("-", " ")}</span> · {pr.role}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ring-1 ring-inset ${st.cls}`}>{st.label}</span>
                    </div>
                    <p className="mt-2 flex-1 text-sm leading-relaxed">{pr.pitch}</p>
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {pr.tech.map((tech) => (
                        <li key={tech}>
                          <Tag>{tech}</Tag>
                        </li>
                      ))}
                    </ul>
                    {pr.links.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold">
                        {pr.links.map((l) => (
                          <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="text-violet-700 hover:underline">
                            {l.label} ↗
                          </a>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>

          <section>
            <SectionTitle>Certificates &amp; training</SectionTitle>
            <ul className="grid gap-3 sm:grid-cols-2">
              {c.trainings.map((t) => (
                <li key={t.id} className="flex gap-3 rounded-xl border border-violet-100 bg-white p-4 print:break-inside-avoid">
                  <span
                    aria-hidden
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base ${
                      t.status === "in-progress" ? "bg-amber-50 text-amber-600" : "bg-teal-50 text-teal-600"
                    }`}
                  >
                    {t.kind === "bootcamp" ? "⌘" : t.kind === "scholarship" ? "✦" : t.status === "in-progress" ? "◔" : "✓"}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm leading-snug font-semibold text-slate-800">{t.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {t.issuer ? `${t.issuer} · ` : ""}
                      {t.provider} · {t.status === "in-progress" ? <span className="font-medium text-amber-700">In progress</span> : formatDate(t.date)}
                    </p>
                    {t.verifyUrl && (
                      <a href={t.verifyUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-semibold text-violet-700 hover:underline">
                        Verify credential ↗
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <footer className="border-t border-violet-100 py-8 text-center text-sm text-slate-500 print:hidden">
        Prefer the fun version?{" "}
        <Link href="/" className="font-semibold text-violet-700 hover:underline">
          Walk through Wouroud&apos;s City →
        </Link>
      </footer>
    </main>
  );
}
