
# Phase A — Fix the Shares / back-a-creator UX (ship first)

The current speculation UI (`ProfileCoinTab`, `InvestUnlockSheet`, `TradePanel`) leaks crypto vocabulary, shows mint addresses, bonding-curve math, slippage selectors, and "$RHOZE pool" pickers to a user who just wants to back someone. We rebuild it as a single, non-crypto-native flow. On-chain language stays under the hood.

## A1. Rename + reframe (UI only — DB columns untouched)

Already half-done in `src/lib/economy-copy.ts`. Audit and finish:
- "Artist Coin" → **"Artist Shares"** everywhere user-visible
- "$RHOZE" on profile/back flow → **"Credits"** (keep "$RHOZE" only on /credits Top-up + Wallet withdrawal)
- "Bonding curve / market cap" → **"Backers" + "Momentum"**
- Hide mint address, slippage %, "pool type", "simulation mode" chips from non-admin views

## A2. New `<BackCreatorSheet />` — single flow, 3 screens

Replaces today's `SupportCreatorSheet` umbrella + `InvestUnlockSheet` + `TradePanel` for the *back* path.

```text
┌──────────────────────────────────────────┐
│  Back {Name}                       [x]   │
│  ──────────────────────────────────────  │
│  Screen 1: AMOUNT                        │
│  [ $5 ] [ $10 ] [ $25 ] [ custom ]       │
│  "≈ {N} Shares · unlocks private feed"   │
│  ──────────────────────────────────────  │
│  Screen 2: WHAT YOU GET                  │
│  ✓ Private feed access                   │
│  ✓ Early drops + behind-the-scenes       │
│  ✓ Your share grows if {Name} grows      │
│  ──────────────────────────────────────  │
│  Screen 3: PAY                           │
│  ( ) Credits  (balance: 1,240)           │
│  ( ) Card  ($5.00 via Square)            │
│  [ Back {Name} ]                         │
└──────────────────────────────────────────┘
```

Backed users land on a **"You're in" confirmation** with one CTA: "Open their private feed →".

## A3. Backer-only private feed (the *intrinsic* reason to back)

This is what makes Shares feel valuable instead of speculative.
- New `works.gating.backer_only` boolean (extends existing `gating` jsonb)
- `<BackerLock />` overlay on Flow/Profile work tiles when user holds 0 shares
- Creator gets a toggle on upload: "Backers only"
- Already wired through `mint-work-unlock` edge fn — extend with `pool_type='backer'`

## A4. Kill speculation-first surfaces on profile

- Remove `TrendingArtistsLane` from Discover (already gated, but also drop the "price / 24h volume" chip from `ProfileCoinTab` summary)
- `ProfileCoinTab` becomes `ProfileBackersPanel`: shows backer count, momentum sparkline, "Back them" CTA. No price chart, no buy/sell tabs.
- Power-user "Trade" view stays — moved behind a "View market →" link for users who actually want it

## A5. Fix the broken Verified IP "Register" button

Side investigation triggered by your note that clicking register seems to register everything. Audit `<VerifiedIPHub />` + `approve-work-verification` fn; likely a stale React state issue selecting all rows. Reproduce, fix, write a regression test.

---

# Phase B — Revenue, phased (after A ships)

## B1. Lock in platform fee on fiat (already infra-ready)

- `get_platform_fee_bps()` + `src/lib/platform-fee.ts` exist
- Audit the 4 paid surfaces: event tickets, Spaces bookings, Marketplace, Projects. Confirm fee is actually withheld on Square payouts (not just credits flows).
- **Stop subsidizing**: if a buyer pays with Credits, creator still gets credited — but no fee waiver. Same fee % applies. This makes the loop self-funded.

## B2. Paid artist partnerships / Featured slots

- New `featured_pin_until` already exists on `profiles` (admin-set). Add a self-serve **"Boost"** flow:
  - 3 SKUs: `Featured 24h ($15)` · `Featured 7d ($75)` · `Discover globe pin 24h ($30)`
  - Square checkout → writes `featured_pin_until` + `featured_tier`
  - Admin dashboard tracks revenue + impressions
- Soft-launches with an "Apply to be featured" link first so we curate before opening self-serve

## B3. Premium Verified Artist tier (one-time fiat)

- Current Verified Artist = earned via 3 approved works (free, keep it)
- Add **"Verified Pro"** badge: $29 one-time, unlocks:
  - Custom profile banner uploads (vs gradient)
  - Priority in Connect matching
  - Lower platform fee tier (skip Spark, start at Bloom 10%)
  - "Pro" chip next to name
- Square one-time payment → `profiles.verified_pro_at` timestamp

---

# Phase C — Events / Spaces / Luma (parked for now, scoped here)

Out of scope for this loop but documented so we don't lose it:
- Spaces booking: add Credits payment option (mirrors event ticket checkout)
- EventDetailPage: hoist `EventMediaCarousel` above the fold
- Luma sync: new `luma_event_links` table + `connect-luma` edge fn. Requires Luma API key from user.

---

# What I'll actually build this turn (Phase A)

Order of implementation:
1. **A5 first** (Verified IP register bug — small, concrete, unblocks trust)
2. **A1** copy sweep (mechanical, low risk)
3. **A2** new `<BackCreatorSheet />` flow
4. **A4** strip speculation chrome from profile, fold trade view behind link
5. **A3** backer-only gating toggle on upload + lock overlay

Phase B + C in follow-up loops once A is live and we have real backing data.

---

# Technical notes

- `economy-copy.ts` already centralizes labels — extend it, don't sprinkle new strings
- Reuse existing `swap_rhoze_for_coin` RPC for credit→shares path; add new `back_creator_fiat` edge fn for Square path that calls the same RPC server-side after payment confirms
- Backer-only gating extends the existing `works.gating` jsonb — no schema migration beyond a new `pool_type='backer'` branch in `mint-work-unlock`
- Keep all on-chain language (mint address, Solana, simulation chips) behind a `?dev=1` query flag for admins
- Memory update at the end: replace v9 "Support sheet umbrella" core rule with the new single-flow Back sheet

Estimated scope for Phase A: ~12-15 files touched, 1 small migration (backer_only flag handling), no breaking schema changes.
