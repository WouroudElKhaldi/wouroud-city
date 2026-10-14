import { seedContent } from "@/content/seed";

/** The public address. Set NEXT_PUBLIC_SITE_URL on Vercel once the domain is known. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** schema.org Person, so search engines understand who the site is about. */
export function personJsonLd() {
  const p = seedContent.profile;
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: p.name,
    jobTitle: p.title,
    description: p.shortBio,
    email: `mailto:${p.email}`,
    image: `${SITE_URL}${p.photo ?? ""}`,
    url: SITE_URL,
    address: { "@type": "PostalAddress", addressLocality: "Tripoli", addressCountry: "LB" },
    sameAs: p.links.map((l) => l.url),
    knowsAbout: seedContent.skills.filter((s) => s.level >= 7).map((s) => s.name),
    knowsLanguage: seedContent.languages.map((l) => l.name),
  };
}
