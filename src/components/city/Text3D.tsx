"use client";

import { Text as DreiText } from "@react-three/drei";
import { type ComponentProps, Suspense } from "react";
import { TEXT_FONT } from "@/world/fonts";

/**
 * Every 3D label in the city. drei's Text suspends until its font (and any fallback font for
 * characters the font lacks: Arabic, ₿, →, emoji...) has loaded, and a suspended label holds up
 * the whole scene. Each label gets its own Suspense boundary instead, so the city appears at once
 * and a label whose fallback glyphs come from troika's CDN just pops in a moment later.
 * The default font is the self-hosted Inter (see world/fonts.ts).
 */
export function Text({ font = TEXT_FONT, ...props }: ComponentProps<typeof DreiText>) {
  return (
    <Suspense fallback={null}>
      <DreiText font={font} {...props} />
    </Suspense>
  );
}
