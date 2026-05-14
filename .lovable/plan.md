
This is a big one — splitting into 4 phases so we can ship + review each before the next.

## Phase 1 — Bug fixes (ship first, ~30 min)

**1a. Audio/Drop thumbnail still blank until hover**
Root cause this time is almost certainly the **mosaic wrapper**, not `FlowThumbnail` itself. The colorful gradient lives on `FlowThumbnail`'s root `<div>` via inline `style={{ backgroundImage }}`. The mosaic now wraps it in `<div className="absolute inset-0 transition-transform ... group-hover:scale-105">` — but if that wrapper has no explicit height OR the parent tile uses `aspect-*` without `relative`, the absolute child collapses until a transform creates a stacking context.

Fix: audit `ConversationsMosaic.tsx` tile container — ensure parent has `relative` + concrete height (aspect-ratio), drop the inner wrapper and pass `absolute inset-0` directly as `FlowThumbnail`'s `className` (and remove the conflicting `relative` from FlowThumbnail's own root so className wins). Verify in browser before declaring done.

**1b. Flow Mode return / navigation bug**
- Exiting Flow → lands on `/discover` top instead of prior scroll position
- Tapping next card after audio reverts to the audio item

Fix in `FlowModePage.tsx` + entry points: store referrer scroll Y in sessionStorage on Flow open, restore on close. Audit the swipe-next handler — likely a stale closure on `currentIndex` when the audio tile's `<audio>` element re-mounts.

## Phase 2 — Discover composer restructure (~1 hr)

Remove the noisy 6-pill row (Update / Offering / Event / Space / Work / Launch) shown in screenshot. Replace with:
- **Single primary action**: "Share something" → opens an inline composer (NOT a modal/lightbox per user's explicit ask)
- Composer has a **type selector** at the top: Update · Work · Event · Space · Prediction
- Selection swaps the form fields below in-place
- "Launch" + "Offering" removed from the composer entirely (Launches stay accessible from profile Support tab; Offerings from marketplace)

## Phase 3 — Launches simplification (~1.5 hr)

Per the user's gripes about the bonding-curve chart being confusing & LP-lock being irrelevant in simulation:

- **Hide the price chart by default**, collapsible "Show chart" toggle
- **Hero stats reframed**: Market Cap (big) · Your P&L · Holders · Price (small, with tooltip explaining "fractional share price")
- **Remove**: LP lock card, Graduation bar (or gate behind `VITE_LAUNCHPAD_PROGRAM_ID` flag — only relevant on-chain)
- Keep Trades ledger, make it more prominent
- Add subtle gamification: streak chip ("3 buys in a row"), holder rank badge

## Phase 4 — Prediction Markets MVP (~2-3 hr)

Spec already exists at `.lovable/prediction-markets-spec.md`. User wants this **now** as a peer to Shares/Events/Spaces, not parked. Scoped MVP:

- DB: `prediction_markets` + `prediction_positions` tables (per spec, simulated $RHOZE only — flag-gated)
- Composer: "Prediction" type in Phase 2 selector → matches user's screenshot (Question / Yes-No / Closes in 1h·24h·7d / optional description)
- Surface card: matches screenshot 3 (compact card with YES/NO bars, "Closes in <1h", Open CTA) — embeddable in Discover stream + profile Support tab
- Detail sheet: matches screenshot 4 (Pick a side / Buy in $5/$10/$25/$50 / Buy button) — uses in-app credits
- Resolution: admin-only v0 (per spec)
- Creator cut: 1% of loser pool routed to subject creator (opt-out)

## Technical notes

- Composer type-switching uses URL state (`?compose=prediction`) so it's deep-linkable
- Prediction tables get RLS: markets public-read, positions readable by owner + market creator
- Self-betting blocked by DB trigger
- All currency math in `user_credits.balance` — zero on-chain in v0
- Update memory: flip prediction-markets from "parked" → "v0 shipped", add composer restructure note

## Order of operations

1. Phase 1 bugs (you confirm fixed in preview)
2. Phase 2 composer (review the type-selector UX)
3. Phase 3 Launches cleanup (review what got hidden vs kept)
4. Phase 4 Predictions MVP (DB migration → I'll send for approval first, then build UI)

Want me to kick off Phase 1 immediately and you review before I move on? Or batch 1+2 together?
