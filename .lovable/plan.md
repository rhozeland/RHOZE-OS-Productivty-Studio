# Pillar 2 — Coin-gated Private Feed

Fans who **hold a creator's pump.fun token in their connected Solana wallet** get the same private-feed access as $5/mo subscribers. Subscriptions stay the spine; token-holding is a parallel unlock for the on-chain crowd.

## How it feels

On a creator's profile / locked post:

- **Already subscribed** → no change, posts visible.
- **Not subscribed but holds ≥ N of $TICKER in their wallet** → posts unlock. Small chip: "Unlocked by holding $TICKER".
- **Otherwise** → unlock card now offers two paths:
  1. **Subscribe — $5/mo** (existing flow)
  2. **Hold $TICKER** — Connect Solana wallet → sign one-tap message → we verify balance → instant unlock for 24h (auto-refreshes while you hold).

If the creator has not linked a pump.fun token, path 2 is hidden — purely subscriber gate, same as today.

## Scope

**In v1 (this pass):**
- Private feed works only (matches Pillar 1 perk gating scope).
- Token gate threshold defaults to **any non-zero balance**; creator can later set a `min_tokens` in Settings (UI deferred to v1.1).
- Grants are 24h server-validated, refreshed on each visit while wallet still holds.
- Uses existing `useWallet()` from `@solana/wallet-adapter-react` + signMessage.

**Out of scope this turn:**
- DM gating, event gating, project gating.
- Per-post override of threshold.
- Pillar 3 (pump.fun creator rewards metrics + "why launch a coin?" education).

## Build

### DB (migration)
- New table `creator_token_grants`:
  - `user_id uuid`, `creator_id uuid`, `wallet_address text`, `mint_address text`, `balance numeric`, `expires_at timestamptz`, `created_at timestamptz`.
  - Unique on `(user_id, creator_id)`.
  - GRANTS: select+insert+update for `authenticated`, `ALL` for `service_role`. No anon.
  - RLS: user can SELECT own rows; only `service_role` can insert/update (writes go through edge fn).
- New SQL fn `public.holds_creator_token(_creator_id uuid)` — `security definer`, returns boolean if `auth.uid()` has a non-expired grant for that creator.
- Extend the existing works SELECT policy that ORs `is_subscribed_to(user_id)` → also OR `holds_creator_token(user_id)`. Same for the `gated-works` storage SELECT policy.

### Edge function `verify-token-grant`
- Input (Zod): `{ creatorId, walletAddress, signature (base58), message }`.
- Validates JWT (caller is signed-in).
- Looks up `profiles.token_mint_address` for creator (404 if none, requires admin-approved per existing gate).
- Verifies the signed message against `walletAddress` using `tweetnacl` (npm specifier).
- Calls Solana RPC `getTokenAccountsByOwner` for `{owner: walletAddress, mint}` and sums uiAmount.
- If balance > 0, upserts `creator_token_grants` row with `expires_at = now() + 24h`.
- Returns `{ granted: boolean, balance, expiresAt }`.

### Frontend
- New hook `useTokenGateAccess(creatorId)` — reads own active grant from DB.
- New sheet `<TokenGateConnectSheet />` — wallet connect button (reuses `WalletButton`) → "Sign to verify" → calls edge fn → toast + invalidate.
- Extend `<SubscriberLock />`:
  - Access check ORs token grant.
  - When locked AND creator has a `token_mint_address`+`token_ticker`, unlock card shows a second action: "Hold $TICKER to unlock" → opens `<TokenGateConnectSheet />`.
  - When unlocked via token, shows small chip "Unlocked by holding $TICKER".
- Tiny "Unlocked by holding $TICKER" chip exposed from SubscriberLock when grant path was used.

### Files
- `supabase/migrations/<new>.sql` — table + GRANTs + RLS + `holds_creator_token` fn + policy ORs.
- `supabase/functions/verify-token-grant/index.ts` — NEW.
- `src/hooks/useTokenGateAccess.ts` — NEW.
- `src/components/profile/TokenGateConnectSheet.tsx` — NEW.
- `src/components/profile/SubscriberLock.tsx` — extend with token-grant branch + dual unlock card.

### Technical notes
- Signed message is a fixed-format string: `Rhozeland token-gate access for {creatorId} at {ISO timestamp}` — must be < 5 min old.
- Solana RPC: use public mainnet endpoint (`clusterApiUrl("mainnet-beta")`) — same as `src/lib/solana.ts`.
- No new secrets needed; pump.fun mints are SPL tokens, public RPC suffices for read.
- RLS: keep existing policies, just OR the new check. No data migration needed.

## Out / next turn
- Pillar 3: pump.fun creator rewards metrics surfaced on profile + "why launch a coin?" education hub.
- Creator setting for `min_tokens` threshold in `/settings#token`.
