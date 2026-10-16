import { BACKEND } from "./backend";
import { DATABASES } from "./databases";
import { FRONTEND } from "./frontend";
import { LANGUAGES } from "./languages";
import { MORE } from "./more";
import { TOOLS } from "./tools";
import type { SigComponent } from "./types";

/** Every skill's signature pieces, by id (see houses.ts for which house uses which). */
export const SIGNATURES: Record<string, SigComponent> = { ...LANGUAGES, ...FRONTEND, ...BACKEND, ...DATABASES, ...TOOLS, ...MORE };
