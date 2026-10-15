import { z } from "zod";
import { db } from "@/server/db";

/**
 * The city guestbook. GET gives the 30 newest notes the owner hasn't hidden; POST adds one
 * (a name, an optional "from", and up to 200 characters). Notes show right away and the owner
 * can hide or delete them from /admin. One visitor can sign a few times per ten minutes.
 */

const postSchema = z.object({
  name: z.string().trim().min(1).max(24),
  from: z.string().trim().max(32).optional(),
  message: z.string().trim().min(2).max(200),
});

const recent = new Map<string, number[]>();
function tooMany(ip: string) {
  const now = Date.now();
  const list = (recent.get(ip) ?? []).filter((t) => now - t < 600_000);
  list.push(now);
  recent.set(ip, list);
  return list.length > 3;
}

/** Plain text only: no control characters, no markup, single spaces. */
const clean = (text: string) =>
  text
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Links are the usual spam: keep them out of the city. */
const spammy = (text: string) => /https?:\/\/|www\.|\.(com|net|ru|xyz)\b/i.test(text);

export async function GET() {
  try {
    const database = await db();
    if (!database) return Response.json({ offline: true, notes: [] });
    const notes = await database
      .collection("guestbook")
      .find({ hidden: { $ne: true } }, { projection: { _id: 0, name: 1, from: 1, message: 1, at: 1 } })
      .sort({ at: -1 })
      .limit(30)
      .toArray();
    return Response.json({ notes });
  } catch {
    return Response.json({ offline: true, notes: [] });
  }
}

export async function POST(request: Request) {
  const body = postSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Write a name and a short note (up to 200 characters)." }, { status: 400 });
  const name = clean(body.data.name);
  const from = clean(body.data.from ?? "");
  const message = clean(body.data.message);
  if (!name || message.length < 2) return Response.json({ error: "Write a name and a short note." }, { status: 400 });
  if (spammy(message) || spammy(name) || spammy(from)) return Response.json({ error: "No links in the guestbook, please." }, { status: 400 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (tooMany(ip)) return Response.json({ error: "Thanks! You've signed a few times already, try again later." }, { status: 429 });
  try {
    const database = await db();
    if (!database) return Response.json({ offline: true }, { status: 503 });
    await database.collection("guestbook").insertOne({ name, from: from || undefined, message, at: new Date(), hidden: false });
    return Response.json({ ok: true }, { status: 201 });
  } catch {
    return Response.json({ offline: true }, { status: 503 });
  }
}
