"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { isAdmin, signIn, signOut } from "@/auth";
import { type Content, contentSchema } from "@/content/schema";
import { seedContent } from "@/content/seed";
import { db } from "@/server/db";
import { CONTENT_TAG } from "@/server/content";

export type SectionKey = keyof Content;
export type PublishResult = { ok: true; at: string } | { ok: false; errors: string[] };

/** What's stored right now (not cached): the published version, or the seed. */
export async function storedContent(): Promise<{ content: Content; published: string | null }> {
  const database = await db();
  if (!database) return { content: seedContent, published: null };
  const doc = await database.collection<{ _id: string; data: unknown; at?: Date }>("content").findOne({ _id: "site" });
  const parsed = doc ? contentSchema.safeParse(doc.data) : null;
  return parsed?.success ? { content: parsed.data, published: doc?.at?.toISOString() ?? null } : { content: seedContent, published: null };
}

const messages = (error: z.ZodError) => error.issues.slice(0, 20).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);

/** Replace one section (profile, skills, projects…) with the edited JSON and publish the whole site. */
export async function publishSection(key: SectionKey, json: string): Promise<PublishResult> {
  if (!(await isAdmin())) return { ok: false, errors: ["Only the owner can publish."] };
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch (e) {
    return { ok: false, errors: [`That isn't valid JSON: ${(e as Error).message}`] };
  }
  const database = await db();
  if (!database) return { ok: false, errors: ["No database configured (MONGO_DB_URL)."] };
  const { content } = await storedContent();
  const next = contentSchema.safeParse({ ...content, [key]: value });
  if (!next.success) return { ok: false, errors: messages(next.error) };
  const at = new Date();
  await database.collection<{ _id: string; data: Content; at: Date }>("content").updateOne(
    { _id: "site" },
    { $set: { data: next.data, at } },
    { upsert: true },
  );
  // Keep a history of every publish, so a mistake can be rolled back.
  await database.collection("content_history").insertOne({ section: key, data: next.data, at });
  updateTag(CONTENT_TAG);
  return { ok: true, at: at.toISOString() };
}

/** Go back to the content in seed.ts. */
export async function resetToSeed(): Promise<PublishResult> {
  if (!(await isAdmin())) return { ok: false, errors: ["Only the owner can publish."] };
  const database = await db();
  if (!database) return { ok: false, errors: ["No database configured (MONGO_DB_URL)."] };
  await database.collection("content").deleteOne({ _id: "site" as never });
  updateTag(CONTENT_TAG);
  return { ok: true, at: new Date().toISOString() };
}

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/admin" });
}

export async function signOutAdmin() {
  await signOut({ redirectTo: "/admin" });
}
