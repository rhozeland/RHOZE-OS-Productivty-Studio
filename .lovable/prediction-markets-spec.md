# Prediction Markets — Spec (Not Implemented)

Status: **parked / future**. Captured 2026-05-12 from creator conversation. No code
yet — this file is the source of truth when we pick it up.

## Thesis

Fans don't just want to *back* a creator (Shares, tickets, bookings) — they want
to **bet on the trajectory**. A prediction market on Rhozeland lets anyone stake
$RHOZE on whether an upcoming drop, event, or career milestone hits a target.

It compounds the creator-first thesis: every release becomes an event with
upside *and* a public belief curve attached to it.

## Market types (v0)

1. **Will this work hit N likes / plays / views by {date}?** — auto-resolvable
   against `flow_items.like_count` or external streaming counts (manual at first).
2. **Will this event sell out / hit N attendees?** — resolves against
   `event_tickets` count at `event.starts_at`.
3. **Will this artist verify / launch a coin / hit Glow tier by {date}?** —
   resolves against `profiles.verification_status` or `user_credits.balance`.

All markets are **binary (YES/NO)**, fixed-window, $RHOZE-denominated.

## Mechanics

- **Stake currency:** $RHOZE (in-app `user_credits.balance`). No fiat.
- **Pricing:** simple parimutuel pool (no LMSR/AMM in v0). YES pool + NO pool;
  winners split the loser pool pro-rata minus 3% house fee → platform_fee
  ledger.
- **Min stake:** 10 $RHOZE. Max stake per user per market: 5,000 $RHOZE.
- **Resolution:** admin marks `outcome` after the window closes (manual v0). v1
  adds Solana oracle / multisig signers.
- **Creator cut:** 1% of the loser pool routed to the creator the market is
  *about* (opt-out per artist). Aligns incentives without letting them
  manipulate odds.
- **Self-betting:** artist may NOT bet on their own market (DB trigger).

## Surfaces

- **Profile → Back tab:** new "Predict their next move" card under Shares.
- **Work / Event detail:** inline "Will this hit X?" chip with current odds.
- **Discover stream:** `kind=prediction` filter showing hottest open markets.
- **Creator Pass:** "Predictions" tab showing your open positions + P&L.

## Schema (sketch)

```sql
create table prediction_markets (
  id uuid pk,
  creator_id uuid references profiles(user_id),
  subject_type text check (subject_type in ('work','event','milestone')),
  subject_id uuid,                  -- work_id / event_id / null
  question text not null,
  target_metric text,               -- 'likes','attendees','tier'
  target_value numeric,
  closes_at timestamptz not null,
  resolves_at timestamptz not null,
  status text default 'open',       -- open | closed | resolved | voided
  outcome boolean,                  -- null until resolved
  yes_pool numeric default 0,
  no_pool numeric default 0,
  created_at timestamptz default now()
);

create table prediction_positions (
  id uuid pk,
  market_id uuid references prediction_markets,
  user_id uuid references profiles(user_id),
  side boolean not null,            -- true=YES, false=NO
  stake numeric not null,
  payout numeric,                   -- filled on resolve
  created_at timestamptz default now()
);
```

Both tables RLS: positions readable by owner + market creator; markets public-read.

## What we are NOT doing in v0

- No on-chain settlement, no AMM, no perpetuals.
- No cash-out before resolution (illiquid by design — keeps it simple, keeps
  whales from front-running).
- No social leaderboards (added in v1 once volume justifies it).
- No regulated jurisdictions gating — v0 ships as a play-money skin if legal
  flags it; toggle via `feature_flag.predictions_real_stakes`.

## Open questions

- Real $RHOZE stakes vs play-money simulation first? (lean: simulation first
  since coins are already simulated.)
- Should we surface a market automatically when a work is anchored as Verified
  IP? Or always opt-in?
- Resolution disputes: 24h challenge window before payout, or instant on admin
  call?

## Trigger to revisit

Build this after:
- v9 profile refocus has been live for ≥2 weeks and Support sheet usage data exists
- Featured Creator card cleanup ships
- At least 10 active artist coins + 5 paid events live (otherwise nothing to
  bet on)
