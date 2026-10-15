import { cacheLife, cacheTag } from "next/cache";
import { type Content, contentSchema } from "@/content/schema";
import { seedContent } from "@/content/seed";
import { db } from "./db";

/** The cache tag publishing from /admin refreshes. */
export const CONTENT_TAG = "content";

/**
 * The portfolio content: the version published from /admin (MongoDB `content` collection, document
 * "site"), checked against the Zod schema; the seed when there is no database, nothing published
 * yet, or the stored version doesn't validate. Cached until the next publish.
 */
export async function getContent(): Promise<Content> {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("max");
  try {
    const database = await db();
    if (!database) return seedContent;
    const doc = await database.collection<{ _id: string; data: unknown }>("content").findOne({ _id: "site" });
    if (!doc) return seedContent;
    const parsed = contentSchema.safeParse(doc.data);
    return parsed.success ? parsed.data : seedContent;
  } catch {
    return seedContent;
  }
}
