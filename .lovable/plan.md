
# v10.2 — Lean into discovery, stop pretending to be a launchpad

Three workstreams, shippable in this order so each one stands on its own.

---

## 1. Kill the simulated launchpad (cleanup)

Rip out every page and component that pretends Rhozeland operates a token. Replace with the existing read-only `<TokenDiscoveryChip />`.

**Routes & pages to remove from the app router (`src/App.tsx`):**
- `/coin/:id` → `LaunchDetailPage` (the Back / Withdraw / "BACKING MOMENTUM" UI in your screenshots)
- `/launchpad` → already redirects, leave the redirect
- The `<LaunchpadWalletBridge />` mount (no longer needed)

**Files to delete (code + tests):**
- `src/pages/LaunchDetailPage.tsx`
- `src/pages/LaunchpadPage.tsx`, `src/pages/LaunchRedirect.tsx`
- `src/components/launchpad/` entire folder (DropCoinCard, TradePanel, LaunchpadWalletBridge, MintAddressChip, etc.)
- `src/components/profile/ProfileCoinTab.tsx` (already unmounted on profile, kill the dead code)
- `src/components/creators/CreatorReadinessCard.tsx` "investor signal"
- `src/lib/launchpad-onchain.ts`, `src/lib/launchpad-idl-*.ts`, `src/lib/launchpad-error-decoder.ts`
- `supabase/functions/mint-work-unlock/` (the simulated-pool variant)
- `.lovable/launchpad-program-spec.md`, `.lovable/anchor-program-spec.md`

**DB cleanup (migration):**
- Drop tables: `coin_swap_ledger`, `coin_holdings`, `coin_launches` (cascade), `rhoze_booking_ledger`, `featured_boost_purchases` *(keep — still used by boosts)*
- Drop RPCs: `swap_rhoze_for_coin`, `get_coin_market`, vanity-CA trigger
- Drop `works.gating` pool_type `launch` handling — keep `rhoze_pool` only

**Profile / Flow cleanup:**
- Confirm `<TokenDiscoveryChip creatorId={…} />` is rendered on `ProfileDetailPage` overview header and `FlowCreatorPeek` (already is per memory) — verify the "Launches" card in screenshot 1 is gone.

---

## 2. Token discovery lane on Discover home

Add one horizontal lane on `/discover` between Featured Creators and Fresh Works, titled **"Trending creator tokens"**.

**Data:** new `<TrendingTokensLane />` component.
- Query `profiles` where `token_mint_address is not null` AND `show_token_chip != false`.
- For each mint, batch-fetch live data from **Jupiter Price v3** (`/price/v3?ids=mint1,mint2,…`) — we already proved this works in `useRhozeMarketPrice`. Single request, no rate-limit pain.
- Fall back to DexScreener `/tokens/v1/solana/{mint}` for 24h volume + price change %.

**Card UI (Dexscreener-ish, compact):**
- Avatar + creator name (link → profile)
- `$TICKER` + truncated CA
- Live price (USD)
- 24h % change (green/red)
- Market cap chip
- "Trade ↗" → pump.fun deeplink

**Schema change:** move `mint_address` from `coin_launches` (about to be dropped) to `profiles.token_mint_address text` + `profiles.token_ticker text`. One coin per creator. Settings UI to paste it in (Profile settings → "Link your token" field, validates as Solana pubkey).

**Empty state:** lane hidden entirely if no creator has linked a token yet.

---

## 3. Luma connect — promote and tighten

The plumbing already exists (`profiles.luma_ics_url` + `sync-ics-events` edge fn). What's missing is visibility.

- **Promote the connector to the Profile page** (`ProfileDetailPage` for own profile) — small "Connect your Luma calendar" card under the hero if `luma_ics_url is null`. One field, pastes ICS URL, runs `sync-ics-events`, shows count of synced events.
- **Settings → Calendar tab** — keep `<IcsImportCard />`, add status row: last sync time, # of imported events, "Sync now" button, "Disconnect" button.
- **Event create flow (`EventCreatePage`)** — add a top banner: "Already use Luma? Connect once and your events appear here automatically. [Connect]". Skip the form entirely.
- The ICS sync already handles both free and paid Luma events (it just mirrors them with the `external_url` linking back to Luma for RSVP/checkout). No code change needed there — works as-is.

---

## 4. Rhozeland-hosted paid events (Stripe)

For events created natively on Rhozeland (not Luma-mirrored), let the host charge USD via Stripe Embedded Checkout with our tier-based platform fee.

**Schema (migration):**
```sql
alter table events
  add column price_usd_cents int,            -- null = free
  add column stripe_account_id text;         -- host's Stripe Connect acct (future; null = funds to platform for now)

create table event_tickets (
  id uuid pk default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  buyer_id uuid references auth.users(id),
  amount_cents int not null,
  platform_fee_cents int not null,
  stripe_session_id text not null,
  stripe_payment_intent text,
  status text not null default 'pending',   -- pending | paid | refunded
  created_at timestamptz default now()
);
-- RLS: buyer + host can read; service role writes.
```

**Edge functions:**
- `create-event-ticket-checkout` — takes `event_id`, resolves host, computes platform fee via `get_platform_fee_bps()`, creates Stripe Embedded session with `application_fee_amount` (or simple platform-collects-all v0), returns clientSecret. Mirrors `create-subscription-checkout` shell.
- Extend `payments-webhook` to handle `checkout.session.completed` for `mode=payment` with `metadata.kind='event_ticket'` → upsert into `event_tickets`, mark `status='paid'`, anchor ticket via existing `anchor-event-ticket` flow.

**UI:**
- `EventCreatePage` — add "Price" field (free / USD amount). If priced, show fee preview ("You get $X, Rhozeland fee Y%").
- `EventDetailPage` — primary CTA becomes "Get ticket — $X" → opens Stripe embedded sheet (same pattern as `<SubscribeToCreatorSheet />`). Existing free RSVP CTA stays for free events.
- Order confirmation surfaces in `/messages` inbox + email (reuse `event-ticket-confirmation` template).

**Stripe Connect deferred.** For v10.2, funds go to the platform Stripe account and we manually pay out hosts (same model as Spaces today). Note this on `EventCreatePage`. Connect onboarding becomes its own loop later.

---

## Order of operations

1. **Migration A** — `profiles.token_mint_address` + `token_ticker` columns; data backfill from `coin_launches` before dropping it.
2. **Workstream 1** (cleanup) — delete files, drop tables, update router.
3. **Workstream 2** (Trending tokens lane + profile token-link settings UI).
4. **Workstream 3** (Luma promotion — pure UI, no schema).
5. **Migration B** + **Workstream 4** (paid events). This is the cash-flow piece.

Each workstream ends in a working app. We can ship #1+#2 first to see the lane live before touching events.

---

## Open items I'll handle as I go

- Tax handling on event tickets — I'll ask which option (full compliance vs calculation-only vs none) when we hit workstream #4.
- Whether to email hosts a weekly payout summary — separate small task once paid events have data.
- Memory updates: drop launchpad/coin-swap/booking-ledger entries, add `v10.2-discovery`, `v10.2-paid-events`, `v10-token-link`.

Ready to start with workstream #1?
