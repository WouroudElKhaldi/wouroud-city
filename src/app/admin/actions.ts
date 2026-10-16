"use server";

import { ObjectId } from "mongodb";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isAdmin, signInWithPassword, signOutAdmin as endSession } from "@/auth";
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

export type SignInState = { error: string | null };

/** The sign-in form's action: on success the page reloads signed in. */
export async function signIn(_: SignInState, form: FormData): Promise<SignInState> {
  const error = await signInWithPassword(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
  if (error) return { error };
  redirect("/admin");
}

export async function signOutAdmin() {
  await endSession();
  redirect("/admin");
}

export type AdminNote = { id: string; name: string; from?: string; message: string; at: string; hidden: boolean };

/** The newest 100 guestbook notes, hidden ones included. */
export async function guestbookNotes(): Promise<AdminNote[]> {
  if (!(await isAdmin())) return [];
  const database = await db();
  if (!database) return [];
  const docs = await database.collection("guestbook").find({}).sort({ at: -1 }).limit(100).toArray();
  return docs.map((d) => ({
    id: String(d._id),
    name: String(d.name),
    from: d.from ? String(d.from) : undefined,
    message: String(d.message),
    at: new Date(d.at).toISOString(),
    hidden: !!d.hidden,
  }));
}

const idSchema = z.string().regex(/^[a-f0-9]{24}$/);

/** Hide or show a note in the city, or delete it for good. */
export async function moderateNote(id: string, action: "hide" | "show" | "delete"): Promise<boolean> {
  if (!(await isAdmin()) || !idSchema.safeParse(id).success) return false;
  const database = await db();
  if (!database) return false;
  const filter = { _id: new ObjectId(id) };
  if (action === "delete") await database.collection("guestbook").deleteOne(filter);
  else await database.collection("guestbook").updateOne(filter, { $set: { hidden: action === "hide" } });
  return true;
}
