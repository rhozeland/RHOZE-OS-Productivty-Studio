# Launchpad accessibility + rewards visibility + chart-style detail page

Three goals from your message:
1. **Accessibility** — Launchpad should be reachable from Hub, not buried.
2. **$RHOZE rewards visibility** — bring back the per-task / per-milestone earning breakdown that used to be front-and-center.
3. **Trading terminal feel** — pump.fun / Padre / Bullx-style chart layout on the launch detail page, with a chart that's togglable.

---

## 1. Hub: add Launchpad as a 5th lane

In `src/pages/HubPage.tsx`:
- Add a new lane `coins` (icon: `Coins`, label "Coins", tagline "Artist coins on the bonding curve.").
- Lane query selects from `coin_launches` (status = `live` or `graduated`), reusing the same card styling pattern as `LaunchpadPage`'s `LaunchCard`.
- Empty state: "No coins minted yet — verify a Work to launch one." with a CTA to `/works`.
- The full `/launchpad` route stays as-is (it's the dedicated browser); the Hub lane is the discovery surface.

Also add a small **"Launchpad"** chip-link in the Hub hero subtitle area so even users on other lanes see it exists.

## 2. Rewards visibility — Launchpad earnings card

Two placements:

**A. Inside `/launchpad`** (top of page, under the mode banner):
- New component `LaunchpadEarnPanel` showing:
  - Current $RHOZE balance (from `useRhozeBalance` if wallet connected, else `user_credits.balance`).
  - Reward streak chip (reuses `RhozeStreakBadge`).
  - A compact 2-column grid of the 6 reward actions from `RewardsDashboard`'s `REWARD_ACTIONS` constant (Post to Flow +2, Like/Save +1, Review +3, **Milestone Approved +10**, Drop Room +1, 7-Day Streak +5) with icon, action name, and reward amount.
  - "See all rewards →" link to `/dashboard?tab=rewards` (existing route).
- Goal: every visitor to /launchpad immediately sees how to earn $RHOZE.

**B. Inside the launch detail trade panel** (`TradePanel.tsx`):
- A small footer line under the existing "3% fee" disclaimer: "Trades by Verified IP holders earn +1 $RHOZE per buy" (matches existing claim-rhoze patterns; copy only — no business logic change unless you ask).

## 3. Pump.fun-style detail page

Rebuild `src/pages/LaunchDetailPage.tsx` layout to a 2-column terminal:

```text
┌─────────────────────────────────────────┬──────────────┐
│  Header: $TICKER  Name  VerifiedIP      │   Trade      │
│  Price · Mcap · 24h vol · Holders       │   Panel      │
├─────────────────────────────────────────┤              │
│  [Chart  |  Bonding Curve]  ← TOGGLE    │              │
│  ┌─────────────────────────────────┐    │              │
│  │                                  │   │              │
│  │   Recharts area/line chart of    │   │              │
│  │   price over time (from          │   │              │
│  │   coin_trades.price_per_token)   │   │              │
│  │                                  │   │              │
│  └─────────────────────────────────┘    │              │
│  Timeframe: [1H] [6H] [1D] [ALL]        │              │
├─────────────────────────────────────────┤   Holdings   │
│  Trades  |  Holders  |  About           │   On-chain   │
│  (recent trades table — existing)        │   addresses  │
└─────────────────────────────────────────┴──────────────┘
```

### New component: `src/components/launchpad/PriceChartCard.tsx`
- Pulls `coin_trades` (id, price_per_token, created_at, side, sol_amount) for the launch, ordered ascending.
- Uses `recharts` (already installed) — `AreaChart` with gradient fill, emerald→fuchsia matching the brand.
- View toggle (segmented control):
  - **Price** (default) — line chart of `price_per_token` over time.
  - **Bonding Curve** — static line of `real_sol_reserves` toward `graduation_sol_target` (the existing progress bar visualized).
- Timeframe pills: 1H / 6H / 1D / ALL — filter the data window.
- Empty state when 0 trades: "Chart will appear after the first trade." with a faded illustrative line.
- Tooltip: price + time + side dot (green buy / red sell).

### Detail page restructure
- Header strip: ticker + name + Verified IP badge + status badges, with a 4-stat row (Price, Mcap, 24h Vol from `coin_trades`, Holders count from `coin_holdings`).
- Below header: `PriceChartCard` (the new chart), then under it the existing **bonding-curve progress bar** and **Recent trades** list as tabs (`Trades | Holders | About`) — pump.fun pattern.
- Right column unchanged: `LaunchpadModeBanner`, `TradePanel`, then user holdings card + `OnChainAddressesCard` + `OnChainBalancesCard` collapsed into one stack.
- Mobile: column collapses; chart sits above trade panel; trade panel sticks to bottom on small viewports.

### Holders tab
- Lightweight: `select trader_id, balance from coin_holdings where launch_id = X order by balance desc limit 25` joined to `profiles_public` for display name/avatar. Shows balance and % of supply.

---

## Files

**Created**
- `src/components/launchpad/LaunchpadEarnPanel.tsx`
- `src/components/launchpad/PriceChartCard.tsx`
- `src/components/launchpad/HoldersList.tsx`

**Edited**
- `src/pages/HubPage.tsx` — add `coins` lane + tab + query + grid + Launchpad chip in hero.
- `src/pages/LaunchpadPage.tsx` — render `LaunchpadEarnPanel` above the tabs.
- `src/pages/LaunchDetailPage.tsx` — restructure layout, mount chart + tabs.
- `src/components/launchpad/TradePanel.tsx` — add the "+1 $RHOZE per buy" reward hint line (copy only).

## Out of scope (won't touch)
- No DB migrations — all data sources already exist (`coin_launches`, `coin_trades`, `coin_holdings`, `credit_transactions`, `user_credits`).
- No changes to bonding curve / fee math / on-chain flow / IDL pipeline.
- No new $RHOZE issuance logic; the trade-reward line is informational and tracks the existing reward system (will be wired on the server side later if you want).

## Notes / decisions made
- Recharts (already in deps) over `lightweight-charts` — keeps bundle lean and matches the rest of the app's charting.
- Hub chip-link kept tiny instead of adding Launchpad to the dock by default; the dock is locked at 4 pillars per the v5 spec, and users can already pin Launchpad via Settings → Dock Customizer.
- Reward amounts pulled from the existing `REWARD_ACTIONS` constant so the source of truth stays in `RewardsDashboard.tsx` (will refactor to a shared module if you want).