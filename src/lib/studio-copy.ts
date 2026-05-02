/**
 * studio-copy — small helpers that keep marketing copy in sync with the
 * structured fields a studio owner edits in Manage Studio.
 *
 * Why: short_description is a free-text field people type once and forget.
 * If they later move (or fix) their city/country, the one-liner still
 * references the old city ("…in the heart of Atlanta…" while city = Toronto).
 * Rather than nag the owner, we transparently swap any known-stale city
 * mention in the rendered string.
 *
 * This is a pure presentation-layer helper — we never mutate the row in the
 * DB. Owners can still edit the field directly in Manage Studio whenever
 * they want to rewrite the line themselves.
 */

// Cities we've seen typed into short_description that are NOT actually
// where the studio lives. Add to this list if more legacy values surface.
// Lowercase entries; matched case-insensitively.
const KNOWN_LEGACY_CITIES = [
  "atlanta",
  "los angeles",
  "la",
  "new york",
  "nyc",
  "miami",
  "chicago",
  "london",
  "paris",
  "tokyo",
  "seoul",
  "berlin",
];

/**
 * Returns a short description rewritten so that any stale city reference is
 * replaced by the studio's current city.
 *
 * - If the description already mentions the current city, returns it as-is.
 * - If no legacy city is detected, returns it as-is.
 * - Otherwise the first stale city match is swapped for the current one.
 */
export function rewriteShortDescription(
  short: string | null | undefined,
  city: string | null | undefined,
): string {
  if (!short) return "";
  const trimmedCity = (city ?? "").trim();
  if (!trimmedCity) return short;

  const lower = short.toLowerCase();
  if (lower.includes(trimmedCity.toLowerCase())) return short;

  for (const legacy of KNOWN_LEGACY_CITIES) {
    // Word-boundary regex so "la" doesn't match "label", etc.
    const re = new RegExp(`\\b${legacy.replace(/\s+/g, "\\s+")}\\b`, "i");
    if (re.test(short)) {
      return short.replace(re, trimmedCity);
    }
  }
  return short;
}
