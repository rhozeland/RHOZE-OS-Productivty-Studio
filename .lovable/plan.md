# Tiers, Events Pivot & Coin-Launch Fee

## 1. Tier matrix cleanup (`src/lib/tier-matrix.ts`, `TierMatrix.tsx`)

- Remove all "Xh early coin access" perks (24h / 48h / 72h) — never landed as a real feature.
- Remove "Free coin launch (no platform fee)" from Play. Replace concept with a flat **coin-launch fee** that everyone pays (see §2).
- Keep the rest of the perks intact (multipliers, % off, IP anchors, coin drops, Discover boost, Featured placement, Verified Artist fast-track).

## 2. Coin launch transaction fee

- New constant `COIN_LAUNCH_FEE_RHOZE = 500` (≈ $5 at 100 $RHOZE/$1) in `src/lib/rewards-catalog.ts`.
- Surface it inline in the launchpad creation flow as "One-time launch fee: 500 $RHOZE". Deduct from `user_credits.balance` on submit (client-side optimistic, no DB schema change — uses existing credits ledger pattern).
- No tier discount on the fee for now (kept simple — can revisit).

## 3. CreatorPassUpgradeCta arrow fix

- Remove the standalone `→` arrow rendered under the body copy in `CreatorPassUpgradeCta.tsx`. The card already has the close X; the arrow was awkward and felt unfinished.

## 4. Conversations right-rail tabs (Events · Spaces · Artists)

- Add a right-side panel to `MessagesPage.tsx` (visible ≥lg) with three tabs: **Events**, **Spaces**, **Artists**.
- Each tab is a vertical scrollable list of compact discovery cards. Clicking a card deep-links to its detail page.
- Pulls from existing tables: `events` (upcoming, status=published), `studios` (active), `profiles` (verified artists).

## 5. Luma-style Events explore page

- New route `/events` rendering `EventsExplorePage.tsx`:
  - Hero strip: featured upcoming event(s).
  - **Browse by Category** grid (Tech, Food & Drink, AI, Arts & Culture, Climate, Fitness, Wellness, Crypto, Music, Community) with icons + event counts. Categories map to existing `events.category` field.
  - Region/date filter chips.
  - Grid of event cards below.
- Add `/events` to nav aliases; Conversations Events tab links here for "see all".

## 6. Event detail redesign (`EventDetailPage.tsx`)

Two-column Luma-style layout (≥md):
- **Left**: cover image, "Presented by" host card (links to profile), Hosted By collaborator list, attendee avatars + count, contact host link.
- **Right** (sticky): date/time block, location block (or "Register to See Address" for approval-required events), Registration card with status (Free / Approval Required / Paid) + primary CTA, About Event description below.

## 7. Paid events via Square

- Reuse existing `TicketCheckoutDialog` + `square-payment` edge function. Verify the dialog handles USD tier prices (it already does for $RHOZE; extend the Square branch).
- On successful payment, edge fn issues ticket with `purchase_currency='usd'`, `amount_paid=tier.price_usd`. Host's seller dashboard already aggregates `credit_transactions` — extend `square-payment` callback to credit the host (75% after 10% platform + 15% reserve, matching the existing 75/15/10 split).

## 8. Memory updates

- Update `mem://index.md` Core: note coin-launch fee, `/events` route, Conversations right-rail.
- Add `mem://features/events` summarizing the new structure.

## Out of scope for this pass
- Subscribing to hosts (Luma "Subscribe" pill) — placeholder only.
- Calendar integrations beyond existing google-calendar fn.
- Per-event custom registration questions (the Luma "Your Info" form). Tracked as future work.

## Files touched (estimate)
- `src/lib/tier-matrix.ts`, `src/lib/rewards-catalog.ts`
- `src/components/creators/TierMatrix.tsx`, `CreatorPassUpgradeCta.tsx`
- `src/components/launchpad/*` (fee surface)
- `src/pages/MessagesPage.tsx` (+ new `ConversationsRightRail.tsx`)
- new `src/pages/EventsExplorePage.tsx`
- `src/pages/EventDetailPage.tsx` (redesign)
- `src/components/events/TicketCheckoutDialog.tsx` + `supabase/functions/square-payment` (paid event branch)
- `src/App.tsx` route registration, `src/config/navigation.ts` alias
- `mem://index.md`, `mem://features/events`
