/**
 * music-copy.ts — v11 music-native vocabulary tokens.
 *
 * Centralized labels so we can do the "creator → musician" surface swap
 * without touching every component. UI labels only — DB column names and
 * code identifiers stay as-is (creator, work, project, event…).
 *
 * Import the named constant for the surface you're touching:
 *   import { CREATOR_NOUN, WORK_NOUN, PROJECT_NOUN } from "@/lib/music-copy";
 */

export const CREATOR_NOUN = "Artist";
export const CREATOR_NOUN_PLURAL = "Artists";
export const CREATOR_NOUN_LOWER = "artist";

export const WORK_NOUN = "Track";
export const WORK_NOUN_PLURAL = "Tracks";

export const PROJECT_NOUN = "Release";
export const PROJECT_NOUN_PLURAL = "Releases";

/** Events + Spaces merge into one umbrella in v11 — used on Connect filters. */
export const LIVE_NOUN = "Live";
export const LIVE_TAGLINE = "Shows, sessions & spaces";

/** Concierge SKU rebrand. */
export const AR_BRAND = "A&R";
export const AR_BRAND_LONG = "Artist Development";
export const AR_TAGLINE = "Tell us the release. We scope it, staff it, ship it.";
export const AR_ROSTER_BADGE = "On the Rhozeland Roster";

/** Coin / token call-to-action copy (musician-first framing). */
export const COIN_CTA = "Start your artist coin";
export const COIN_CTA_SUB =
  "Launch a $TICKER on pump.fun. Fans discover & trade it from your profile.";
