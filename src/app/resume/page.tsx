import type { Metadata } from "next";
import Link from "next/link";
import { seedContent } from "@/content/seed";

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

/** A clean 2D résumé built from the same content as the 3D city. */
export default function ResumePage() {
  const c = seedContent;
  const p = c.profile;
  const categories = [...new Set(c.skills.map((s) => s.category))];
  return (
    <main className="min-h-dvh bg-[#f7f3ff] px-4 py-10 text-[#2e1065]">
      <div className="mx-auto max-w-3xl space-y-10">
        <header className="space-y-2">
          <Link href="/" className="text-sm text-violet-600 hover:underline">
            ← Back to the 3D city
          </Link>
          <h1 className="text-4xl font-extrabold text-[#4c1d95]">{p.name}</h1>
          <p className="text-lg font-semibold text-teal-700">{p.title}</p>
          <p>{p.location} · <a className="text-violet-700 underline" href={`mailto:${p.email}`}>{p.email}</a></p>
          <div className="flex flex-wrap gap-2 pt-2">
            {p.links.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="rounded-full bg-violet-700 px-4 py-1.5 text-sm font-semibold text-white">
                {l.label} ↗
              </a>
            ))}
            <a href="/cv/Wouroud_El_Khaldi-cv.pdf" download className="rounded-full bg-amber-400 px-4 py-1.5 text-sm font-semibold text-[#1a103d]">
              📄 Download CV (PDF)
            </a>
          </div>
        </header>

        <section className="space-y-3">
          <h2 className="border-b-2 border-amber-400 pb-1 text-xl font-bold">About</h2>
          {p.about.map((a) => (
            <p key={a}>{a}</p>
          ))}
        </section>

        <section className="space-y-5">
          <h2 className="border-b-2 border-amber-400 pb-1 text-xl font-bold">Experience</h2>
          {c.experience.map((job) => (
            <article key={job.id}>
              <h3 className="text-lg font-bold">
                {job.company} <span className="text-sm font-normal text-violet-600">· {job.type} · {job.location}</span>
              </h3>
              {job.roles.map((r) => (
                <p key={r.title} className="flex flex-wrap justify-between gap-2 font-semibold text-teal-800">
                  <span>{r.title}</span>
                  <span className="text-sm text-violet-600">{formatDate(r.start)} – {formatDate(r.end)}</span>
                </p>
              ))}
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                {job.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="border-b-2 border-amber-400 pb-1 text-xl font-bold">Skills</h2>
          {categories.map((cat) => (
            <p key={cat} className="text-sm">
              <strong className="capitalize">{cat}:</strong>{" "}
              {c.skills.filter((s) => s.category === cat).map((s) => s.name).join(", ")}
            </p>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="border-b-2 border-amber-400 pb-1 text-xl font-bold">Projects</h2>
          {c.projects.map((pr) => (
            <article key={pr.id}>
              <h3 className="font-bold">
                {pr.name} <span className="text-sm font-normal text-violet-600">· {pr.year} · {pr.category}</span>
              </h3>
              <p className="text-sm">{pr.pitch}</p>
              <p className="text-xs text-teal-800">{pr.tech.join(" · ")}</p>
            </article>
          ))}
        </section>

        <section className="space-y-2">
          <h2 className="border-b-2 border-amber-400 pb-1 text-xl font-bold">Education &amp; certificates</h2>
          {c.education.map((e) => (
            <p key={e.id} className="text-sm">
              <strong>{e.degree}</strong>, {e.field} · {e.school} ({formatDate(e.end)})
            </p>
          ))}
          {c.trainings.map((t) => (
            <p key={t.id} className="text-sm">
              <strong>{t.name}</strong> · {t.issuer ? `${t.issuer}, ` : ""}{t.provider} · {t.status === "in-progress" ? "in progress" : formatDate(t.date)}
              {t.verifyUrl && (
                <>
                  {" "}
                  · <a href={t.verifyUrl} target="_blank" rel="noreferrer" className="text-violet-700 underline">verify</a>
                </>
              )}
            </p>
          ))}
        </section>

        <section className="space-y-2">
          <h2 className="border-b-2 border-amber-400 pb-1 text-xl font-bold">Languages</h2>
          <p className="text-sm">{c.languages.map((l) => `${l.name} (${l.level === "native" ? "native" : l.level})`).join(" · ")}</p>
        </section>
      </div>
    </main>
  );
}
