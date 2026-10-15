import type { Content } from "./schema";
import { seedContent } from "./seed";

/**
 * The content the city is showing right now. It starts as the seed and is replaced once at
 * startup with what the server read from MongoDB (published from /admin). `liveContent` is a
 * stand-in object that always reads the current content, so components can use it like the seed.
 */
let current: Content = seedContent;

export function setLiveContent(content: Content) {
  current = content;
}

export const liveContent = new Proxy({} as Content, {
  get: (_, key) => current[key as keyof Content],
});
