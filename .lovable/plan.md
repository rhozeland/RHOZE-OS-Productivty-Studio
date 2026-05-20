
# Rhozeland v10 — "Subscribe to creators, discover their tokens"

The platform stops trying to be a launchpad, a marketplace, and a token economy at once. Instead:

- **Fans pay USD subscriptions** ($5 / $10 / $25) to unlock creator private feeds, DMs, and perks. This is the only thing fans pay for.
- **Tokens are discovery-only.** If a creator has a token on pump.fun / Bags / anywhere on Solana, we display price + chart + a "Buy on pump.fun" deeplink. No bonding curve, no custody, no swaps.
- **Credits / $RHOZE disappear from fan-facing UI.** They survive only as a creator B2B currency (boosts, featured slots, future Rhozeland Launches partnership).
- **Events / Spaces become subscriber perks**, not public marketplaces.

---

## Phase 1 — Subscriptions (the spine)

### 1a. Enable Stripe payments
Use Lovable's built-in `enable_stripe_payments`. Pick **tax calculation only** (option 2) — works for global digital subscriptions, keeps fee floor low. Square stays only for legacy event/booking flows, marked deprecated.

### 1b. Schema
```sql
-- Creator-side: every creator gets the same 3 tiers (no per-creator config)
create table creator_subscription_tiers (
  id uuid pk,
  creator_id uuid → profiles,
  tier text check in ('basic','standard','premium'),    -- $5 / $10 / $25
  stripe_price_id text not null,
  perks jsonb,                                          -- ["Private feed","DMs","Early drops"]
  active bool default true
);

-- Fan-side: active subscriptions
create table creator_subscriptions (
  id uuid pk,
  subscriber_id uuid → profiles,
  creator_id uuid → profiles,
  tier text,
  stripe_subscription_id text,
  status text,                                          -- active|past_due|canceled
  current_period_end timestamptz,
  unique(subscriber_id, creator_id)                     -- one sub per creator per fan
);
```
Standard RLS: subscribers see their own subs; creators see who's subscribed to them.

### 1c. New UI
- **`<SubscribeToCreatorSheet />`** — replaces `<BackCreatorSheet />`. Three pricing cards ($5/$10/$25), Stripe Checkout redirect, "You're in" confirmation routing to private feed.
- **Profile primary CTA**: "Subscribe to {Name}" (was "Back {Name}").
- **`<SubscriberLock />`** — replaces `<BackerLock />`. Same overlay pattern, gates on `creator_subscriptions.status='active'`.
- **Creator dashboard panel** — "Your subscribers" with MRR, churn, latest 10 subscribers.

### 1d. Edge functions
- `create-subscription-checkout` — creates Stripe Checkout session
- `stripe-webhook` — handles `customer.subscription.created/updated/deleted`, writes to `creator_subscriptions`
- `creator-payout-monthly` — pg_cron monthly job that calculates 85% of net subs to each creator, queues payout

### 1e. Gating
Reuse `works.gating` jsonb with new `pool_type='subscriber_tier'` and `min_tier` field. `mint-work-unlock` edge fn branches on it.

---

## Phase 2 — Token discovery overlay (display + deeplink only)

### 2a. Schema
```sql
alter table profiles add column external_token jsonb;
-- Shape: { mint, symbol, source: 'pumpfun'|'birdeye', launch_url, verified_at }
```
Creators paste a Solana mint address in settings. We hit Birdeye API to verify it exists + cache `symbol/name`.

### 2b. UI
- **`<ProfileTokenCard />`** — shown on profile only if `external_token` is set. Renders: live price, 24h change, holders, mini sparkline (Birdeye `defi/price` + `defi/history_price`). Single CTA: "Buy {symbol} on pump.fun" → opens `https://pump.fun/{mint}` in new tab.
- **No swap widgets, no Jupiter embed, no bonding curve.**
- Kills `<ProfileCoinTab />` `<TradePanel />` `<InvestUnlockSheet />` buy/sell tabs and the simulated `coin_swap_ledger` write path.

### 2c. Edge function
- `fetch-token-snapshot` — proxies Birdeye, 5min cache by mint address. Stored in new `token_snapshots` table.

Birdeye needs an API key — I'll ask for `BIRDEYE_API_KEY` when we hit this phase.

---

## Phase 3 — Strip Credits from fan-facing UI

### What gets removed
- Sidebar "Creator Pass" tab (replaced with "My Subscriptions")
- `<RhozeBalanceChip />` from top bar
- All "Pay with Credits" toggles on event tickets, space bookings, marketplace
- `BuyRhozeSection` Top-up tab on /credits
- "Earn $RHOZE" prompts across the app
- Tier ladder (Spark/Bloom/Glow/Play) from profile + landing

### What stays (creator B2B only)
- `<BoostProfileSheet />` — paid with **USD via Stripe** (not Credits)
- `<VerifiedProBadge />` upgrade — paid with USD via Stripe
- Future `/launches` partnership page (Phase 4, not now)
- Existing Credits balances **read-only** on a single "Legacy Credits" page so holders can withdraw via existing wallet flow. No more topping up.

### Sidebar nav v10
1. **Home** (`/discover`)
2. **Discover** (`/market`)
3. **Inbox** (`/messages`)
4. **Subscriptions** (`/subscriptions` — what I subscribe to + my subscribers if I'm a creator)

---

## Phase 4 — Parked (document, don't build this loop)

- **Rhozeland Launches** curated partnership page — handpicked creators we co-launch on pump.fun. Apply form + admin queue. Build when we have ≥5 active subscribed creators.
- **Earn-by-holding tier rewards** — quiet backend cron drip for active users, no UI surface. Build only if Credits ecosystem shows life after Phase 3.
- **Events / Spaces as subscriber perks** — reframe the existing pages to show "Subscribers only" badges. Stop investing in them as public marketplaces.

---

## Build order this loop

I'll ship Phase 1 + start Phase 3 stripping in the same loop. Phase 2 (token overlay) comes next loop once we have Birdeye key.

1. Stripe enablement + tax config
2. Schema migration (subscription tiers + subscriptions)
3. `create-subscription-checkout` + `stripe-webhook` edge fns
4. `<SubscribeToCreatorSheet />` + profile CTA swap
5. `<SubscriberLock />` + gating extension
6. Subscriptions inbox page (`/subscriptions`)
7. Sidebar nav swap + remove `<RhozeBalanceChip />`
8. Hide Pay-with-Credits toggles on fan checkouts
9. Delete `<BackCreatorSheet />` `<TradePanel />` `<InvestUnlockSheet />` and their entry points
10. Memory update — v10 core rules replace v9.8 / v9.9 framing

Estimated scope: ~25-30 files touched, 1 migration, 2 edge functions, 1 Stripe enable, 1 secret request (Stripe pricing IDs created automatically by `batch_create_product` after enable).

---

## Technical notes

- Stripe products will be created with `batch_create_product` after enable — 3 products (basic/standard/premium) per creator is too many; instead we create **3 global products** ($5/$10/$25) and each subscription stores `creator_id` as metadata so the webhook can route to the right creator
- 85/15 revenue split: we don't use Stripe Connect in v10 (too much KYC overhead). Instead we pool fan payments → monthly batch payout to creators from our Stripe balance. Tracked in `creator_subscriptions` + `creator_payouts` table
- Birdeye free tier handles ~10k req/day — plenty for cached snapshots
- All deleted components stay on disk (commented `// v9-legacy`) for 30 days in case we need to revert
- Memory updates: replace "v9.8 framing" + "v9.9.1 Primary nav" Core rules with v10 equivalents
