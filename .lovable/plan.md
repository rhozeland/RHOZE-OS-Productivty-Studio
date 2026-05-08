## Section 2 — The Heart: Fan Investment & Content

Three coordinated changes that reframe the economy as "shares in artists" and turn The Flow into a VIP-style unlock loop. Strictly UI/copy + a thin gating layer — no DB schema changes, no economic logic changes.

---

### 1. Language pivot (UI copy only)

A single source-of-truth helper `src/lib/economy-copy.ts` exporting:
- `CREDITS_LABEL = "Platform Credits"` (was "$RHOZE Token" in user-facing copy)
- `SHARES_LABEL = "Artist Shares"` / `SHARE_LABEL = "Share"` (was "Artist Coin")
- `MARKET_GROWTH_LABEL = "Market Growth"` (used wherever we currently say "bonding curve", "market cap progress", "price impact", etc.)
- Helpers: `formatShares(n)`, `formatCredits(n)`.

Then sweep the high-traffic surfaces and replace strings:
- `RhozeBalanceChip`, `RhozeInfoPopover`, `ClaimRhozeButton`, `PayWithRhozeButton` button labels
- Creator Pass page (`/credits`) tabs + copy: "$RHOZE" → "Platform Credits"
- Launchpad / Coin tab / `ProfileCoinTab` / `LaunchDetailPage` / `TradePanel` / `CreatorReadinessCard`: "Coin" → "Share", "bonding curve / market cap" → "Market Growth"
- `MintAddressChip`, `VaultRoomPage` ("Artist coins" → "Artist Shares")
- `CoinSwapPanel` / swap history: "Swap $RHOZE for Coin" → "Buy Shares with Platform Credits"

Internal code identifiers, table names, RPC names, env vars, ticker symbols on chain, and the on-chain `$RHOZE` SPL token name stay unchanged. The wordmark `$RHOZE` is preserved in the brand wallet/withdrawal contexts where it refers to the literal Solana token (per memory rule).

The `RhozeInfoPopover` gets a one-liner: *"Platform Credits are the in-app currency you spend on Artist Shares. They never leave the platform."*

### 2. The Flow — blur + Invest & Unlock

New component `src/components/flow/FlowUnlockGate.tsx` wraps the FlowCard media area and:
- Reads the viewer's `coin_holdings` for that artist (cached via React Query, key includes viewer + artist user_id).
- If viewer is signed-out OR holds 0 shares of the post author → render the media with `filter: blur(28px) saturate(0.6)` and a centered glass card:
  - Title: *"Locked · Hold shares to unlock"*
  - Subtitle: *"Invest in @artist to unlock their private feed"*
  - Primary button: **Invest & Unlock** → opens a new `<InvestUnlockSheet />` (bottom sheet on mobile, dialog on desktop) prefilled with the artist's launch / share-purchase flow.
- If viewer holds ≥ 1 share OR is the author → render normally (no blur). Owners pass through.
- Likes/comments/swipe still work on locked cards (blurred preview is teaser, action bar visible) but tapping the card body opens the unlock sheet instead of the comment sheet.

`InvestUnlockSheet` reuses the existing share-purchase RPC (`swap_rhoze_for_coin`) — buys 1 share by default with a slider for more, shows current Market Growth %, confirms with toast and invalidates the holdings query so the same card un-blurs in place.

Loading state: render skeleton (no blur flicker) while holdings query is pending for signed-in users.

### 3. Profile — primary CTA becomes Invest & Unlock

In `ProfileDetailPage.tsx` (and the Support tab), promote a single primary CTA above Follow/Message/Book:
- **Invest & Unlock** — opens the same `InvestUnlockSheet` for that artist.
- Sub-line: *"Buy a share to unlock private posts, drops, and behind-the-scenes."*
- If viewer already holds shares: button label flips to **Buy More Shares** and a green chip *"Unlocked · X shares"* appears next to it.
- If artist hasn't launched a share yet: CTA shows **Notify me when shares launch** (disabled action, tracked via existing follow).
- Existing Follow / Message / Book buttons demote to secondary (smaller, outline variant) below the primary CTA.

The Support tab keeps `<ProfileCoinTab />` but the heading becomes *"Artist Shares"* and the explainer is rewritten in plain language (no "bonding curve").

---

### Out of scope

- No DB migrations. Holdings, ledger tables, RPC names, on-chain ticker stay as-is.
- No changes to fee math, reward catalog, tier matrix.
- Pay-with-$RHOZE checkout (BookingCheckoutModal, etc.) keeps its $RHOZE label because that surface is the literal on-chain token, not platform credits. Only the in-app credit balance + artist coin language is renamed.
- Admin/dev-only surfaces (AdminPage internals, console logs) keep technical names.

### Files touched

New: `src/lib/economy-copy.ts`, `src/components/flow/FlowUnlockGate.tsx`, `src/components/profile/InvestUnlockSheet.tsx`.
Edited: `RhozeBalanceChip`, `RhozeInfoPopover`, `VaultRoomPage`, `CreditShopPage` (Creator Pass), `ProfileCoinTab`, `LaunchDetailPage`, `TradePanel`, `CoinSwapPanel`, `ProfileDetailPage`, `FlowCard` (wrap media in gate), `MintAddressChip`, `CreatorReadinessCard`.
