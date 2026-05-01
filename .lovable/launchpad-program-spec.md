# Rhozeland Launchpad — Anchor Program Spec (v1)

> **Status:** Spec only — not yet deployed. Lovable cannot run `anchor build` /
> `solana-test-validator`. This document is shovel-ready for a local Rust/Anchor
> session. Frontend wiring lives behind the `VITE_LAUNCHPAD_PROGRAM_ID` flag in
> `src/lib/launchpad-onchain.ts` — until that flag is set, the simulated curve
> from Step 4a remains the source of truth.

## Goal

Replace the DB-only `coin_launches` / `coin_trades` / `coin_holdings` simulation
in Supabase with a real Solana program that:

1. Mints a fresh **SPL token** per coin launch (1B supply, 6 decimals).
2. Custodies SOL + token reserves in **PDA-owned vaults** (no server custody).
3. Executes constant-product (`x*y=k`) bonding-curve trades with on-chain fee
   splits to creator + platform.
4. Triggers **graduation** when `real_sol_reserves >= 85 SOL`, locks the curve,
   and emits an event consumed by an off-chain worker that creates a Raydium
   pool with a creator-chosen LP lock duration.

## Token

- Per-launch SPL mint, 6 decimals, 1,000,000,000 total supply.
- Mint authority = `CurveAuthority` PDA. Freeze authority = none.
- All amounts on-chain are base units (respect 6 decimals).

## Program ID

- Devnet: TBD (generate via `anchor keys list` after first build, paste into
  `.env` as `VITE_LAUNCHPAD_PROGRAM_ID`).
- Mainnet: TBD (after audit).

## Accounts

### `Launch` PDA
Seeds: `["launch", work_id (16 bytes UUID)]`
Fields:
- `creator: Pubkey`
- `work_id: [u8; 16]` (mirrors Supabase `works.id`)
- `mint: Pubkey`
- `sol_vault: Pubkey` (PDA SystemAccount)
- `token_vault: Pubkey` (PDA token ATA)
- `virtual_sol_reserves: u64` (lamports; init = 30 SOL)
- `virtual_token_reserves: u64` (init = 1.073B × 1e6)
- `real_sol_reserves: u64` (lamports actually held)
- `real_token_reserves: u64` (tokens left in curve)
- `total_supply: u64` (= 1B × 1e6)
- `graduation_sol_target: u64` (lamports; default 85 × LAMPORTS_PER_SOL)
- `creator_fee_bps: u16` (default 200)
- `platform_fee_bps: u16` (default 100)
- `creator_fees_earned: u64`
- `lp_lock_months: u8`
- `status: LaunchStatus` (Live, Graduated, Cancelled)
- `created_at: i64`
- `graduated_at: Option<i64>`
- `bump: u8`

### `Holding` PDA (one per trader per launch)
Seeds: `["holding", launch.key(), trader (Pubkey)]`
Fields: `launch`, `trader`, `balance: u64`, `bump: u8`

### `CurveAuthority` PDA
Seeds: `["curve-auth", launch.key()]` — owns the mint + token vault.

### `PlatformConfig` PDA (singleton)
Seeds: `["platform-config"]`
Fields:
- `admin: Pubkey` (multisig)
- `platform_fee_recipient: Pubkey`
- `default_graduation_target: u64`
- `bump: u8`

## Instructions

1. **`initialize_platform`** — admin signs once; sets fee recipient.
2. **`create_launch`**
   - Args: `work_id: [u8; 16]`, `lp_lock_months: u8`, `name: String`,
     `symbol: String`, `uri: String` (off-chain metadata json)
   - Caller MUST be the verified-IP creator (verified off-chain, signed
     attestation passed in `remaining_accounts` OR enforced by an admin gate
     during the devnet phase).
   - Creates: `Launch` PDA, mint, sol vault, token vault, mints 1B tokens to
     token vault, sets virtual reserves.
3. **`buy`**
   - Args: `sol_in: u64`, `min_tokens_out: u64`
   - Slippage-protected; takes 3% fee, splits to creator + platform recipient,
     transfers net SOL to vault, transfers token output to trader's `Holding`
     account (program-owned, not an ATA, so refunds on cancel are simple).
   - Auto-calls internal `try_graduate` at the end.
4. **`sell`**
   - Args: `tokens_in: u64`, `min_sol_out: u64`
   - Mirror of buy; reduces holding, returns SOL minus fees.
5. **`claim_holding`** — once graduated, trader can convert their `Holding` PDA
   into a real ATA balance for the SPL mint (one-shot withdraw).
6. **`graduate`** (permissionless crank, also called inline by `buy`)
   - Triggers when `real_sol_reserves >= graduation_sol_target`.
   - Sets `status = Graduated`, freezes `buy`/`sell`, emits `LaunchGraduated`
     event with `(launch, mint, sol_vault, token_vault, lp_lock_months)`.
   - An off-chain worker subscribes via `logsSubscribe` and creates the
     Raydium AMM v4 pool, then locks LP per `lp_lock_months`.
7. **`cancel_launch`** — creator only, only if zero trades exist; refunds nothing
   (curve is empty), marks Cancelled.
8. **`withdraw_creator_fees`** — creator signs; transfers `creator_fees_earned`
   from sol_vault → creator wallet, resets counter.

## Fee math (every trade)

```
total_fee_bps   = creator_fee_bps + platform_fee_bps   // default 300
fee_lamports    = sol_in * total_fee_bps / 10_000
creator_cut     = sol_in * creator_fee_bps / 10_000
platform_cut    = fee_lamports - creator_cut
net_sol         = sol_in - fee_lamports
new_virt_sol    = virtual_sol_reserves + net_sol
new_virt_tok    = (virtual_sol_reserves * virtual_token_reserves) / new_virt_sol
tokens_out      = virtual_token_reserves - new_virt_tok
require(tokens_out <= real_token_reserves)
require(tokens_out >= min_tokens_out)   // slippage
```

Sell mirrors with `(token_in, sol_out)` swapped and fee taken from `sol_out`.

## Errors

- `Unauthorized`
- `LaunchClosed` (not Live)
- `SlippageExceeded`
- `InsufficientLiquidity`
- `AlreadyGraduated`
- `TradesExistCannotCancel`
- `InvalidFeeBps` (sum > 1000 = 10%)
- `WorkNotVerified`

## Off-chain integration (Lovable side, post-deploy)

1. Deploy program → copy program ID.
2. User pastes ID into `.env` as `VITE_LAUNCHPAD_PROGRAM_ID`.
3. `src/lib/launchpad-onchain.ts` reads the flag; when set, `LaunchCoinDialog`
   and `TradePanel` route through Anchor instead of the `simulate_coin_trade`
   RPC.
4. Mirror events into Supabase via a worker (`logsSubscribe` on the program ID)
   so the existing `coin_launches` / `coin_trades` tables keep powering the
   `/launchpad` browse + leaderboard UIs.
5. Display the on-chain link (`https://solscan.io/account/<launch_pda>?cluster=devnet`)
   on the launch detail page.

## Raydium graduation worker (separate Node service, not in Lovable)

- Subscribes to `LaunchGraduated` events.
- Reads `sol_vault` + `token_vault` balances.
- Calls Raydium SDK `Liquidity.makeCreatePoolV4InstructionV2`.
- Calls Raydium LP lock program (or Streamflow) for `lp_lock_months`.
- Writes `raydium_pool_id` + `lp_lock_signature` back to `coin_launches` via
  the Supabase service role.

## Audit checklist (before mainnet)

- [ ] Reentrancy on `buy` (vault transfer + fee transfers in same tx)
- [ ] Integer overflow on curve math (use `checked_mul` / `checked_div` on u128)
- [ ] PDA seed collisions across `work_id`
- [ ] Front-running protection (slippage args mandatory, never default to 0)
- [ ] Graduation race (two `buy` txs cross the threshold simultaneously)
- [ ] Fee BPS bounds (≤ 1000)
- [ ] Devnet load test: 100 concurrent launches, 10k trades
- [ ] Third-party audit (Halborn, OtterSec, or Neodyme)

## Rough milestones for the Rust session

1. `anchor init rhoze-launchpad` + program ID generation
2. `initialize_platform` + `create_launch` + mint setup + tests
3. `buy` with curve math + fee splits + tests
4. `sell` + `Holding` PDA + tests
5. `try_graduate` + event emission + tests
6. `claim_holding` + `withdraw_creator_fees` + tests
7. Devnet deploy + IDL export
8. Generate TS client (`@coral-xyz/anchor` → `program.methods.*`)
9. Wire Lovable client (this repo, `src/lib/launchpad-onchain.ts` already stubbed)
10. Build Raydium graduation worker (separate Node service)
11. Audit → mainnet
