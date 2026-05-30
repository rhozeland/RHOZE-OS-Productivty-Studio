# Pillar 3 — Creator rewards metrics + "Why launch a coin?" education

Surfaces the **passive pump.fun creator-rewards stream** to artists who already linked a token, and gives every artist (and curious fan) a dedicated editorial page that explains *why launching a coin is worth it*.

## What ships

### 1. CreatorRewardsCard (owner-only)
Renders on `ProfileDetailPage` when the viewer is the owner AND they have an admin-approved `token_mint_address`. Replaces the visual hierarchy of the StartCoinCta slot in that case.

- Pulls volume + market cap from `useCreatorTokenMetrics` (already lives in repo).
- Estimates lifetime creator rewards = `volumeUsd × 0.05%` (pump.fun's published rate, ~5 bps).
- Primary CTA: deeplink to `https://pump.fun/profile/<creatorWallet>` — the artist's own pump.fun rewards dashboard. Wallet comes from pump.fun's coin response (`creator` field), with `profiles.solana_wallet` as fallback.
- Secondary link → `/why-coin` ("How rewards work").
- Hidden from visitors — rewards are personal.

### 2. useCreatorTokenMetrics — extended
Adds two read-only fields without breaking existing consumers:
- `creatorWallet: string | null` — pulled from pump.fun's `creator` response field.
- `volumeUsd: number | null` — cumulative USD volume reported by pump.fun.

No new network calls; same single pump.fun fetch already in place.

### 3. WhyLaunchCoinPage at `/why-coin`
Editorial education hub, public route, no auth required. Sections:
- Hero with dual CTA (Launch on pump.fun · I already have a coin).
- "Three reasons artists are launching now" — creator rewards · fan ownership · self-fueling discovery.
- "How rewards work" — ~0.05% explanation + concrete examples ($10k / $100k / $1M traded).
- "What Rhozeland adds on top" — token-gated feed (Pillar 2) · Coins-in-Motion lane · admin-approved & read-only.
- Common questions FAQ (5 items).
- Footer CTA mirror.

Also accessible via `/launch-coin` redirect.

### 4. StartCoinCta — small upgrade
Promotes the new education page above the "already have a coin?" tertiary link, so the discovery surface is "Why launch a coin? See the full pitch →" first, "Link existing" second.

## Files

- **New** `src/components/profile/CreatorRewardsCard.tsx`
- **New** `src/pages/WhyLaunchCoinPage.tsx`
- **Edit** `src/hooks/useCreatorTokenMetrics.ts` — add `creatorWallet` + `volumeUsd` fields.
- **Edit** `src/App.tsx` — register `/why-coin` + `/launch-coin` routes.
- **Edit** `src/pages/ProfileDetailPage.tsx` — mount CreatorRewardsCard when owner has token.
- **Edit** `src/components/profile/StartCoinCta.tsx` — add education link.

## Out of scope (next turn)
- Public coin-economics dashboard / leaderboard (per-creator rewards earned).
- Backend cache of pump.fun volume to avoid client-side rate limits.
- Push notifications when a creator crosses reward thresholds.
- Pillar 4 ("Coin x Project funding" — using coin rewards to fund release roadmaps).
