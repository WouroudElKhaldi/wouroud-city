import type { Content } from "@/content/schema";
import type { DistrictId } from "./districts";

/**
 * "Ask Wouroud": answers about her work, written from the portfolio content (no AI service, so it
 * stays free and works offline). A question is matched to an intent by keywords, or to a specific
 * skill, project or company by name. Each answer can offer to show the way to a district.
 */

export type Answer = { text: string; go?: { district: DistrictId; label: string } };

export const SUGGESTIONS = [
  "What do you do?",
  "Where do you work?",
  "What are your best projects?",
  "What's your tech stack?",
  "How did you start coding?",
  "What did you study?",
  "Which languages do you speak?",
  "What do you do for fun?",
  "How can I contact you?",
];

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s.+#]/gu, " ").replace(/\s+/g, " ").trim();
const has = (q: string, words: string[]) => words.some((w) => new RegExp(`(^|\\s)${w}`).test(q));
/** Lower-cases only the first letter, so acronyms (AI, ADHD, UI) survive mid-sentence. */
const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
const atJob = (j: Content["experience"][number]) => (j.type === "freelance" ? `freelancing as a ${j.roles[0].title.replace(/^Freelance /, "")}` : `${j.roles[0].title} at ${j.company}`);
const list = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

function month(date: string | null) {
  if (!date) return "now";
  const [y, m] = date.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleString("en", { month: "short", year: "numeric" });
}

export function answer(question: string, c: Content): Answer {
  const q = norm(question);
  const p = c.profile;

  // A specific skill, project or company named in the question.
  const skill = c.skills.find((s) => q.includes(norm(s.name)) || q.includes(norm(s.id)));
  const project = c.projects.find((x) => q.includes(norm(x.name)) || q.includes(norm(x.id)));
  const job = c.experience.find((j) => q.includes(norm(j.company)) || q.includes(norm(j.id)));
  if (project) {
    return {
      text: `${project.name}: ${project.pitch} ${project.description[0] ?? ""} My role: ${lowerFirst(project.role)}. Built with ${list(project.tech.slice(0, 6))}.`,
      go: { district: "projects", label: "Project Harbor" },
    };
  }
  if (job) {
    const r = job.roles[0];
    return {
      text: `At ${job.company} I'm ${r.end ? "was" : "working as"} ${r.title} (${month(r.start)} – ${month(r.end)}). ${job.summary}`,
      go: { district: "business", label: "the Business District" },
    };
  }
  if (skill && !has(q, ["stack", "skills"])) {
    const used = c.projects.filter((x) => x.tech.some((t) => norm(t).includes(norm(skill.name)) || norm(skill.name).includes(norm(t)))).map((x) => x.name);
    return {
      text: `${skill.name}: level ${skill.level}/10, about ${skill.years} year${skill.years === 1 ? "" : "s"} of use.${used.length ? ` I used it in ${list(used.slice(0, 4))}.` : ""}`,
      go: { district: "skills", label: "Skill Downtown" },
    };
  }

  if (has(q, ["contact", "email", "hire", "reach", "linkedin", "github", "freelance"])) {
    return { text: `Email me at ${p.email}. ${p.links.map((l) => `${l.label}: ${l.url}`).join(" · ")}. ${p.about[p.about.length - 1] ?? ""}` };
  }
  if (has(q, ["work", "job", "company", "employ", "current", "now"])) {
    const current = c.experience.filter((j) => j.roles[0].end === null);
    return {
      text: `Right now: ${list(current.map(atJob))}. Before that: ${list(c.experience.filter((j) => j.roles[0].end !== null).map((j) => j.company))}.`,
      go: { district: "business", label: "the Business District" },
    };
  }
  if (has(q, ["project", "built", "build", "portfolio", "app", "best"])) {
    const top = c.projects.filter((x) => x.tier === "flagship" || x.tier === "featured");
    return {
      text: `My favorites: ${top.map((x) => `${x.name} (${lowerFirst(x.pitch.replace(/\.$/, ""))})`).slice(0, 4).join("; ")}.`,
      go: { district: "projects", label: "Project Harbor" },
    };
  }
  if (has(q, ["stack", "skill", "tech", "know", "language you", "framework", "tools", "good at"])) {
    const top = [...c.skills].sort((a, b) => b.level - a.level || b.years - a.years).slice(0, 8).map((s) => s.name);
    return { text: `My strongest: ${list(top)}. My top skills on LinkedIn: ${list(p.topSkills)}.`, go: { district: "skills", label: "Skill Downtown" } };
  }
  if (has(q, ["start", "began", "story", "journey", "learn", "self taught", "how did"])) {
    return { text: p.story.slice(0, 3).join(" ") };
  }
  if (has(q, ["study", "studied", "degree", "university", "school", "education", "college"])) {
    const e = c.education[0];
    return {
      text: e ? `${e.degree} in ${e.field} at ${e.school}, ${e.location}. I also earned ${c.trainings.filter((t) => t.status === "completed").length} certificates, including Meta, IBM and Google ones.` : "I learned mostly on my own and through certificates.",
      go: { district: "campus", label: "the Campus" },
    };
  }
  if (has(q, ["certificate", "course", "training", "bootcamp"])) {
    return {
      text: `Certificates and programs: ${list(c.trainings.slice(0, 6).map((t) => t.name))}.`,
      go: { district: "training", label: "Training Park" },
    };
  }
  if (has(q, ["speak", "languages", "arabic", "english", "french"])) {
    return {
      text: list(c.languages.map((l) => `${l.name} (${l.level === "native" ? "native" : l.level})`)) + ". " + c.languages.map((l) => l.greeting).join(" "),
      go: { district: "languages", label: "the Polyglot Quarter" },
    };
  }
  if (has(q, ["fun", "hobby", "hobbies", "free time", "paint", "draw", "crochet", "horse"])) {
    return { text: `Away from code: ${list(c.hobbies.map((h) => h.name.toLowerCase()))}.`, go: { district: "hobbies", label: "the Hobby Quarter" } };
  }
  if (has(q, ["where", "live", "from", "location", "based"])) return { text: `I'm based in ${p.location}.` };
  if (has(q, ["cv", "resume", "résumé"])) return { text: "You can read my résumé as a regular page (Résumé page in the menu) and download the PDF there." };
  if (has(q, ["game", "play", "arcade"])) return { text: "Try the Arcade Pier: Full Stack, XO against a bot, Firewall Flyer and a car race.", go: { district: "arcade", label: "the Arcade Pier" } };
  if (has(q, ["who", "about", "yourself", "do you do", "what do you", "hi", "hello", "hey", "salam", "marhaba"])) {
    return { text: `Hi, I'm ${p.name}, a ${p.title} in ${p.location}. ${p.shortBio}` };
  }
  return { text: "Good question! I don't have an answer for that one here. Try one of the suggestions, or walk into the buildings: each one tells a part of my story." };
}
