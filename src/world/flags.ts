/**
 * Feature flags read once from the URL in the browser.
 * The new Universal Base Character bodies are the default; add ?oldbody to the URL
 * to compare with the previous Quaternius people.
 */
export const USE_NEW_BODIES =
  typeof window === "undefined" || !new URLSearchParams(window.location.search).has("oldbody");
