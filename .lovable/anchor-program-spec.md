# Rhozeland Anchor Program Spec (v1)

> **Status:** Spec only — not yet implemented. This document is shovel-ready
> for a future Rust/Anchor session (Lovable cannot run `anchor build` /
> `solana-test-validator`; deployment requires a local Rust toolchain).

## Goal

Replace the DB-only escrow + splits + disputes + royalties currently in
Supabase with a real Solana program using the Anchor framework, so funds
are custodied by a PDA — not by Rhozeland — and every state transition is
publicly verifiable on-chain.

## Token

- $RHOZE (SPL Token, mainnet-beta). Mint address pinned in program constants.
- All amounts are SPL token base units (respect mint decimals).

## Program ID

- Devnet: TBD (generate via `anchor keys list` after first build)
- Mainnet: TBD (after audit)

## Accounts

### `Contract` PDA
Seeds: `["contract", project_id (u128), client (Pubkey)]`
Fields:
- `client: Pubkey`
- `specialist: Pubkey`
- `total_amount: u64`
- `escrowed_amount: u64`
- `released_amount: u64`
- `status: ContractStatus` (Draft, Active, Disputed, Completed, Refunded)
- `auto_release_seconds: i64`
- `created_at: i64`
- `splits_hash: [u8; 32]` — SHA256 of canonical split table (immutable after lock)
- `bump: u8`

### `Milestone` PDA
Seeds: `["milestone", contract.key(), milestone_index (u8)]`
Fields:
- `contract: Pubkey`
- `index: u8`
- `amount: u64`
- `status: MilestoneStatus` (Pending, Submitted, Approved, Disputed, Cancelled)
- `submitted_at: Option<i64>`
- `approved_at: Option<i64>`

### `Split` PDA (one per recipient)
Seeds: `["split", contract.key(), recipient (Pubkey)]`
Fields:
- `contract: Pubkey`
- `recipient: Pubkey`
- `basis_points: u16` (0–10_000; sum of all splits MUST = 10_000)
- `bump: u8`

### `EscrowVault` (token account, owned by program PDA)
Seeds: `["vault", contract.key()]`
Holds the escrowed $RHOZE for the contract's lifetime.

### `Royalty` PDA (optional, per-listing)
Seeds: `["royalty", listing_id (u128)]`
Fields:
- `creator: Pubkey`
- `basis_points: u16` (royalty on resale)
- `recipients: Vec<(Pubkey, u16)>` (max 8)

## Instructions

1. **`initialize_contract`** — client signs; creates Contract PDA in Draft.
2. **`add_split`** — client/specialist; only in Draft; appends Split PDA.
3. **`add_milestone`** — either party; only in Draft.
4. **`lock_escrow`** — client signs; Draft → Active; transfers `total_amount`
   $RHOZE from client ATA → EscrowVault; freezes splits (sets `splits_hash`).
5. **`submit_milestone`** — specialist signs; Pending → Submitted.
6. **`approve_milestone`** — client signs; Submitted → Approved; transfers
   `milestone.amount` × `(split.basis_points / 10_000)` to each recipient ATA
   atomically. If last milestone, deduct 10% platform fee, mark Completed.
7. **`open_dispute`** — either party; Active → Disputed.
8. **`resolve_dispute`** — admin multisig signs (3-of-5 squad); routes funds
   per resolution: refund client, release to specialist, or split.
9. **`cancel_contract`** — only in Draft, by initiator.
10. **`auto_release`** — permissionless crank; releases milestone if
    `now > submitted_at + auto_release_seconds` and not disputed.
11. **`register_royalty`** — creator signs; pins royalty config for a listing.
12. **`pay_with_royalty`** — buyer signs; buys listing with $RHOZE, automatically
    splits per Royalty PDA before forwarding to seller.

## Errors
- `InvalidSplitTotal` (≠ 10_000)
- `InvalidStatus`
- `Unauthorized`
- `InsufficientEscrow`
- `MilestoneAlreadyApproved`
- `DisputeWindowExpired`
- `SplitsLocked`

## Off-chain integration (Lovable side, post-deploy)

- Replace `lock_escrow_credits` SQL RPC with a client-side call to
  `lock_escrow` + `confirmTransaction`.
- Mirror on-chain state into `project_contracts` via a worker that
  subscribes to program logs (`logsSubscribe`) and updates Supabase.
- Show on-chain link (`https://solscan.io/account/<contract_pda>`) on
  the contract page so users can verify independently.

## Audit checklist (before mainnet)
- [ ] Reentrancy on `approve_milestone` (multi-recipient transfer loop)
- [ ] Integer overflow on basis-point math
- [ ] PDA seed collisions
- [ ] Admin multisig key rotation flow
- [ ] Devnet load test with 100 concurrent contracts
- [ ] Third-party audit (Halborn, OtterSec, or Neodyme)

## Rough milestones for the Rust session
1. `anchor init rhoze-escrow` + program ID generation
2. Implement `initialize_contract` + `add_split` + `add_milestone` + tests
3. Implement `lock_escrow` + EscrowVault + tests
4. Implement `approve_milestone` with multi-recipient distribution + tests
5. Implement disputes + auto_release + tests
6. Implement royalties + tests
7. Devnet deploy + IDL export
8. Generate TS client (`@coral-xyz/anchor` → `program.methods.*`)
9. Wire Lovable client (replace memo-only flow)
10. Audit → mainnet
