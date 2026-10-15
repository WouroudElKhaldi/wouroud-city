/**
 * Fonts for the 3D labels (troika text), served from /public/fonts so no label ever waits on a
 * CDN: without a font, troika looks one up on cdn.jsdelivr.net at runtime, and every scene with a
 * sign suspends until that answers. Inter (SIL OFL 1.1), Latin subset from Fontsource.
 * Characters outside the subset still fall back to troika's CDN lookup.
 */
export const TEXT_FONT = "/fonts/inter-400.woff";
export const TEXT_FONT_BOLD = "/fonts/inter-700.woff";
