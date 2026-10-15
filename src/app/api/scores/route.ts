import { z } from "zod";
import { db } from "@/server/db";

/**
 * The Arcade Pier leaderboard. GET ?game=stack|flappy|rally gives the top 10; POST adds a score.
 * Stack and Firewall Flyer rank by points (higher is better), the rally by time (lower is better).
 * Scores are checked against what's possible in each game, names are trimmed and cleaned, and one
 * visitor can't post more than a few times a minute.
 */

const GAMES = {
  stack: { min: 1, max: 400, better: "high" },
  flappy: { min: 1, max: 999, better: "high" },
  rally: { min: 20, max: 900, better: "low" },
} as const;
type Game = keyof typeof GAMES;

const gameSchema = z.enum(Object.keys(GAMES) as [Game, ...Game[]]);
const postSchema = z.object({
  game: gameSchema,
  name: z.string().trim().min(1).max(16),
  score: z.number().finite(),
});

const recent = new Map<string, number[]>();
function tooMany(ip: string) {
  const now = Date.now();
  const list = (recent.get(ip) ?? []).filter((t) => now - t < 60_000);
  list.push(now);
  recent.set(ip, list);
  return list.length > 5;
}

const clean = (name: string) => name.replace(/[^\p{L}\p{N} ._'-]/gu, "").replace(/\s+/g, " ").trim() || "Visitor";

export async function GET(request: Request) {
  const game = gameSchema.safeParse(new URL(request.url).searchParams.get("game"));
  if (!game.success) return Response.json({ error: "Unknown game" }, { status: 400 });
  try {
    const database = await db();
    if (!database) return Response.json({ offline: true, scores: [] });
    const rule = GAMES[game.data];
    const scores = await database
      .collection("scores")
      .find({ game: game.data }, { projection: { _id: 0, name: 1, score: 1, at: 1 } })
      .sort({ score: rule.better === "high" ? -1 : 1, at: 1 })
      .limit(10)
      .toArray();
    return Response.json({ scores });
  } catch {
    return Response.json({ offline: true, scores: [] });
  }
}

export async function POST(request: Request) {
  const body = postSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid score" }, { status: 400 });
  const { game, name, score } = body.data;
  const rule = GAMES[game];
  if (score < rule.min || score > rule.max) return Response.json({ error: "Score out of range" }, { status: 400 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (tooMany(ip)) return Response.json({ error: "Slow down a little" }, { status: 429 });
  try {
    const database = await db();
    if (!database) return Response.json({ offline: true }, { status: 503 });
    await database.collection("scores").insertOne({
      game,
      name: clean(name),
      score: game === "rally" ? Math.round(score * 10) / 10 : Math.round(score),
      at: new Date(),
    });
    return Response.json({ ok: true }, { status: 201 });
  } catch {
    return Response.json({ offline: true }, { status: 503 });
  }
}
