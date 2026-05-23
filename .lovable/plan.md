## Goal

Tie everything back to one revenue spine: **subscriptions = recurring**, **transactional fees = bookings + events + projects**. Replace the current "Subscribe-only" sheet with a unified support hub, make the Trade panel feel like real on-chain data (not a casino), simplify the feed CTA, and bring Listings back to Discover as a lane that funnels into Projects.

---

## 1. Unified `SupportCreatorSheet` (replaces `SubscribeToCreatorSheet`)

New 3-tab sheet, opened by every "support/back" entry point. Order chosen to lead with transactional value (what you said sub/tip are less hot right now):

**Tab 1 — Work together** (default)
Three stacked cards, all rendered only if the creator has them:
- **Commission a project** → opens `NewProjectDialog` prefilled with this creator as collaborator. Fee badge: "Platform fee {tier}%".
- **Book a space** → if creator owns ≥1 `studios` row, lists them inline → routes to `StudioDetailPage` booking modal.
- **Attend an event** → if creator has upcoming `events`, shows the next 1–2 with date + price → `EventDetailPage`.
Empty state for each tells the fan "this creator doesn't offer X yet" instead of hiding silently — so the tab never looks empty.

**Tab 2 — Subscribe & Tip**
- Top: the existing 3-tier subscribe cards (Basic/Standard/Premium) — kept verbatim, just compacted.
- Bottom: one-tap Tip row ($1 / $5 / $20 / custom) → `create-tip-checkout` (already exists).
- Footer line: "Creator keeps 85% · Rhozeland 15%."

**Tab 3 — Trade** (only if `profiles.token_mint_address` is set)
Rebuilt as `<CreatorTokenPanel />` — see §2.

Files:
- New: `src/components/profile/SupportCreatorSheet.tsx` (wraps existing Subscribe + new tabs).
- Keep `SubscribeToCreatorSheet.tsx` on disk; re-export from new sheet for back-compat.
- Wire every current `<SubscribeToCreatorSheet />` call site to `<SupportCreatorSheet defaultTab="…" />`: `ProfileDetailPage`, `FlowCreatorPeek`, profile cards, etc.

---

## 2. `<CreatorTokenPanel />` — real on-chain data, not degenerate

Replaces the current `<TokenDiscoveryChip />` inside Trade tab (chip stays as a tiny header summary on profile only).

Data sources (server-side hook `useCreatorTokenMetrics(mint)`):
- **Birdeye public API** (`/defi/token_overview`, `/defi/price_history`) — primary, no key needed for basic fields. Falls back to **pump.fun frontend API** (`https://frontend-api.pump.fun/coins/{mint}`) for holders + MC pre-migration, then Jupiter price v3 as last resort.
- Returns: `priceUsd`, `change24h`, `marketCap`, `liquidityUsd`, `holderCount`, `topHolderPct`, `sparkline7d[]`.

Panel layout (editorial, mono numerics, no neon):
```text
┌───────────────────────────────────────────────┐
│ $TICKER   $0.00042  ▲ 12.4% (24h)             │
│ ────────── 7d sparkline (svg, 60px tall) ──── │
│                                               │
│ Market cap   Liquidity    Holders   Top wallet│
│ $128.4k      $42.1k       312       8.2%      │
│                                               │
│ [ Trade on pump.fun ↗ ]                       │
│                                               │
│ Data: Birdeye · Updated 14s ago               │
└───────────────────────────────────────────────┘
```
- Top-wallet pct turns amber ≥30%, red ≥50% (trust signal, not alarmism).
- Sparkline = pure SVG polyline, no library.
- No swap UI, ever. Trade button is a `pump.fun/coin/{mint}` deeplink.

Files:
- New: `src/hooks/useCreatorTokenMetrics.ts`
- New: `src/components/profile/CreatorTokenPanel.tsx`
- Update: `src/components/profile/TokenDiscoveryChip.tsx` → keep as compact 1-line summary, gains `onOpenTrade` prop that pops `SupportCreatorSheet` with `defaultTab="trade"`.

---

## 3. Feed CTA — clickable creator, not a column

Today some feed components render a wide "Support" column next to the post. Remove it.

- In flow cards / feed rows / `FlowCreatorPeek`: the avatar + display name become a single button → opens `SupportCreatorSheet`.
- A small ♡ icon sits inline next to the name as a visual affordance ("this opens support, not the profile").
- "View profile →" moves to a secondary link inside the sheet header.
- Profile page itself keeps a real Profile route; only the **feed** retargets the avatar.

Files touched: `FlowCard`, `FlowCreatorPeek`, `DiscoverTable` creator cell, any "Back this creator" column wrappers. (Will read exact components during implementation.)

---

## 4. Listings return to Discover + funnel into Projects

- Re-mount a "Open calls & listings" lane on `DiscoverPage` between Featured creators and Trending tokens.
- Source: existing `listings` table (Hire/Collab/Project request types).
- Click a tile → `<ListingLightbox />` (new Dialog) with: title, creator chip, budget range, scope summary, attachments thumbnails, "Message creator" + **primary** "Start a project from this listing" → opens `NewProjectDialog` prefilled (name = listing title, accent + collaborator from listing, scope text imported as the first roadmap note).
- Standalone `/listings/:id` page stays mounted for owners managing their listing (and as a permalink), but Discover never routes there directly — lightbox first.

Files:
- New: `src/components/discover/ListingsLane.tsx`
- New: `src/components/listings/ListingLightbox.tsx`
- Update: `src/pages/DiscoverPage.tsx` to render the lane.
- Update: `NewProjectDialog` to accept `prefillFromListing?: ListingRow`.

---

## 5. Technical notes

- All Birdeye/pump.fun fetches run client-side from React Query hooks (CORS-friendly endpoints only). No new edge function needed.
- No DB migration this loop — `creator_subscription_tiers`, `listings`, `studios`, `events`, `profiles.token_mint_address` all already exist.
- `SupportCreatorSheet` is the new single entry point; legacy `BackCreatorSheet` / `SubscribeToCreatorSheet` callsites get swapped, files stay on disk for revert.
- Memory update at the end: replace v10.2 framing line with v10.3 "Unified Support hub + Birdeye-backed Trade panel + Listings lane → Projects funnel."

---

## What I'm NOT touching this loop

- No changes to Stripe products, tiers, or platform-fee math.
- No DB migration.
- No edge functions added or modified.
- DM gating, RLS, auth — untouched.
- Creator Pass page, Portfolio page, sidebar nav — untouched (last loop's work stands).
