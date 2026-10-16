"use client";

import { Text as DreiText } from "@react-three/drei";
import { type ComponentProps, Suspense } from "react";
import { TEXT_FONT, TEXT_FONT_ARABIC } from "@/world/fonts";

/**
 * Every 3D label in the city. drei's Text suspends until its font (and any fallback font for
 * characters the font lacks: Arabic, ₿, →, emoji...) has loaded, and a suspended label holds up
 * the whole scene. Each label gets its own Suspense boundary instead, so the city appears at once
 * and a label whose fallback glyphs come from troika's CDN just pops in a moment later.
 * The default font is the self-hosted Inter (with symbol glyphs merged in: arrows, ✓, ★, shapes), or
 * Inter + Noto Sans Arabic for Arabic text (see world/fonts.ts and public/fonts/README.txt).
 */
export function Text({ font, children, ...props }: ComponentProps<typeof DreiText>) {
  // Emoji have no glyphs in our fonts (and troika would fetch a fallback font for them): drop them.
  const text = typeof children === "string" ? children.replace(EMOJI, "").replace(/ {2,}/g, " ").trim() : children;
  // Arabic text gets the self-hosted Arabic font; everything else Inter.
  const arabic = typeof text === "string" && /[\u0600-\u06FF]/.test(text);
  return (
    <Suspense fallback={null}>
      <DreiText font={font ?? (arabic ? TEXT_FONT_ARABIC : TEXT_FONT)} {...props}>
        {text}
      </DreiText>
    </Suspense>
  );
}

/** Pictographic emoji, their variation selectors and joiners. */
const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}]\uFE0F?|\uFE0F|\u200D/gu;
