/**
 * Single source of truth for the user-facing economy language pivot.
 *
 * v9 framing (Section 2 of "The Heart"):
 *  - "$RHOZE Token" → "Platform Credits" (the in-app currency)
 *  - "Artist Coin"  → "Artist Share"     (skin in an artist's career)
 *  - "Bonding curve / market cap"        → "Market Growth"
 *
 * Internal identifiers (table names, RPCs, env vars, on-chain SPL ticker)
 * stay as-is — only UI strings change. The literal `$RHOZE` wordmark is
 * preserved on Solana wallet / withdrawal surfaces (per brand memory).
 */
export const CREDITS_LABEL = "Platform Credits";
export const CREDITS_LABEL_SHORT = "Credits";
export const SHARES_LABEL = "Artist Shares";
export const SHARE_LABEL = "Share";
export const MARKET_GROWTH_LABEL = "Market Growth";

export const CREDITS_BLURB =
  "Platform Credits are the in-app currency you spend on Artist Shares. They never leave the platform.";

export const SHARES_BLURB =
  "Buy a Share to back the artist and unlock their private feed, drops, and behind-the-scenes.";

export const formatCredits = (n: number) =>
  `${Math.round(n).toLocaleString()} ${CREDITS_LABEL_SHORT}`;

export const formatShares = (n: number) => {
  const rounded = Number(n).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
  return `${rounded} ${n === 1 ? SHARE_LABEL : SHARES_LABEL}`;
};
