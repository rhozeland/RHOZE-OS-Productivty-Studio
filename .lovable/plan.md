# Profile + Connect cleanup

Two surfaces, three waves. Roadmap polish is parked for a follow-up turn (you flagged it last).

---

## Wave A — Multi-coin schema

New table so a creator can link **>1 pump.fun token**.

```text
public.creator_tokens
  id uuid pk
  user_id uuid → profiles.user_id
  mint_address text unique
  ticker text
  name text
  is_primary bool         -- one per user
  status text             -- 'pending' | 'approved' | 'rejected'
  created_at timestamptz
```

- Backfill from existing `profiles.token_mint_address` / `token_ticker` (one row each, `is_primary=true`, `status=approved`).
- Keep `profiles.token_*` cols populated to the primary token for back-compat (a trigger mirrors `is_primary` row → profile).
- RLS: public read on `status='approved'`; owner can insert as pending; admin approves (reuses existing `review_token_submission` pattern — extended to accept a `creator_token_id`).
- Admin queue (`/admin?tab=tokens`) keeps working; queries `creator_tokens` instead of pending-shadow cols.

---

## Wave B — Profile shell rewrite

### Header (above tabs)
1. Existing hero (banner, avatar, name, location, tier, bio, links) — unchanged.
2. **NEW compact `<InvestorSignalStrip />`** directly under links: one row, 4 inline stats (Readiness `58/100` · Verified IP `0/5` · Contributions `54` · Tenure `2mo`) + tiny "Verify (5)" pill on the right when owner. Collapses from the current 230-px card to ~56 px.
3. **NEW `<CreatorActivityTicker />`** just below: 3 most-recent activity rows in a slim card, fades in/out on a 6 s rotation (framer-motion `AnimatePresence`). Same data source as the existing `CreatorActivityCard`.

### Tabs (replaces current Overview/Posts split)
```text
Overview · Works · Verified · Projects
```
- **Overview**: bio expanded · coin gallery (see Wave C) · recent posts strip · backers/subscribers · spaces.
- **Works**: full grid of all posts (current Posts tab content, full-bleed).
- **Verified**: `VerifiedIPHub` for this creator — only anchored/IP-verified works. (Reuses existing `<VerifiedIPBadge />` filter; new query: `works.verification_status='approved'`.)
- **Projects**: existing public `projects` (was the "Building" surface) — published releases + ongoing.

### Removed from profile
- `<StartCoinCta />` "Start Indoléstic's artist coin" card → moved into the **Coins gallery empty state** (only renders when zero tokens).
- `<CreatorRewardsCard />` is folded into each gallery tile (per-coin rewards estimate) rather than a separate card.
- Standalone "LIVE PROJECT $INDO" card → replaced by gallery.

---

## Wave C — Coin gallery

New `<CreatorCoinsGallery />` (src/components/profile/coins/).

- Lists all `creator_tokens` where `user_id=profile.user_id AND status='approved'`, primary first.
- Per-tile (`<CoinGalleryTile />`):
  - Ticker + mint short + `is_primary` chip.
  - **Birdeye-enriched stats**: Market Cap · **All-Time High** · **% from ATH** · 24h vol · Holders · **Est. creator rewards** (`volumeUsd × 5 bps`).
  - 7-day sparkline (reuses existing `useCreatorTokenMetrics`).
  - CTAs: "Trade on pump.fun" (primary) + owner-only "Open my rewards" → `pump.fun/profile/<wallet>`.
- `useCreatorTokenMetrics` extended to also pull **ATH** from Birdeye's `/defi/token_overview` (`history24hPrice`, `priceChange24hPercent` already there; add `priceAth` field — public endpoint).
- Owner-only **"+ Add another coin"** button at bottom → opens `<LinkPumpFunTokenSheet />` (reuses existing settings flow, just inline).
- Empty state (no tokens) → renders `<StartCoinCta />` inside the gallery slot.

---

## Wave D — Connect → Project flow fix

**Bug today:** "Start a Project" on Connect → instantly inserts a row in `projects`, navigates to Inbox, but the recipient's RLS hides the unsigned project → "project link isn't available."

**Fix:** Route every Connect "Start a Project" CTA through the existing **`<ProposalSheet />`** (roadmap-first proposal system you already have).

1. **Audit `ConnectBoard` + `MarketRoomPage`** — every "Start a Project" / "Hire" / "Work together" button now opens `<ProposalSheet />` instead of `NewProjectDialog`.
2. **Proposal sheet flow** (already built, just re-wired):
   - Step 1: brief + scope.
   - Step 2: **AI roadmap drafter runs automatically** (`useAiRoadmapDraft`) — owner reviews/edits milestones.
   - Step 3: terms preview + signature (anchored via `anchor-proposal-signature`).
   - Step 4: send → recipient sees a **Proposal** card in Inbox (`ProjectsInbox` proposals strip already supports "Your turn to sign").
3. **Project only materializes** when both sides sign (existing `sign_project_proposal` RPC) → at that moment it appears in Inbox as a real project thread, no "not available" error possible.
4. Kill the old `NewProjectDialog` path from Connect entry points (`NewProjectDialog` stays for owner-internal use inside Projects page).
5. `ProjectsInbox` proposal-strip empty state gets a "Start your first proposal →" CTA pointing to `/market?kind=hire`.

---

## Technical notes

- Migration is **additive** — old `profiles.token_*` cols stay populated so legacy components don't break during the swap.
- `<TokenDiscoveryChip />`, `<CoinsInMotionLane />`, `<CreatorTokenPanel />` keep reading `profiles.token_mint_address` (primary token) — no change.
- `useCreatorTokenMetrics` gains an optional `includeAth` flag; default off to avoid extra fetches on Discover.
- All profile mounts read from `creator_tokens` via new `useCreatorTokens(userId)` hook.
- Roadmap-tab cleanup (the "messy" part you mentioned) is **deferred** to a follow-up turn — flagging it here so I don't conflate scope.

---

## Sequence

1. Migration → `creator_tokens` table + backfill + RLS + GRANTs.
2. `useCreatorTokens` hook + extend `useCreatorTokenMetrics` w/ ATH.
3. Build `<InvestorSignalStrip />`, `<CreatorActivityTicker />`, `<CreatorCoinsGallery />`, `<CoinGalleryTile />`.
4. Rewrite `ProfileDetailPage` header + tab set; remove `StartCoinCta` / `LIVE PROJECT` card mounts.
5. Rewire `ConnectBoard` + every "Start a Project" entry → `<ProposalSheet />`.
6. Smoke check: build, console-error sweep, verify profile loads with 0 / 1 / 2 tokens, verify proposal flow lands in inbox correctly.

Confirm and I'll start with the migration.
