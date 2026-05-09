
# Splits v2 — Collaborators + Platform, locked at lock

One model, applied everywhere. Two parties only:

1. **Collaborators pool** — anyone working on the thing (artist, brand, second artist, producer, friend who brought the deal). Team configures % shares that must sum to 100. No "creator vs curator vs buyback" anymore.
2. **Platform fee** — taken off the top, tier-based on the project lead:
   - Spark / Bloom → 15%
   - Glow → 10%
   - Play → 7%

**Lock behavior:** Splits + platform fee % are **frozen at project lock**. SHA-256 of the canonical table is anchored on Solana via memo. After lock, splits cannot be rewritten. Tier upgrades only help on *future* projects.

**Migration:** Existing configs are converted in place — old `creator_id` becomes a single collaborator at 100%. If a curator was accepted, they're added as a collaborator at the curator %; lead's % drops by that amount. Buyback % is folded into the lead. Nothing is deleted.

---

## Implementation

### 1. Database migration
- New table `revenue_split_collaborators` (`id, config_id, user_id, pct, created_at`) with RLS so collaborators of the same config can read it; lead can write before lock.
- Add `revenue_split_configs.locked_at TIMESTAMPTZ`, `locked_platform_fee_bps INT`, `splits_hash TEXT`.
- Keep `revenue_split_configs.creator_id` as **lead** (rename in code, not in SQL — avoids breakage).
- Data migration: for every existing active config, insert a row in `revenue_split_collaborators` for the creator at `creator_pct + buyback_pct`, and if `curator_id` is set, a row for them at `curator_pct`. Old % columns kept (nullable) for rollback safety; UI ignores them.
- New SQL function `lock_split_config(config_id)` — sets `locked_at`, snapshots current `get_platform_fee_bps()` for the lead, computes splits hash, returns the row.

### 2. UI rebuild — `RevenueSplitConfig.tsx`
- Replace 3 sliders + buyback wallet with a **collaborator list**:
  - Each row: avatar + name + % stepper + remove
  - "Add collaborator" → opens user search (reuses curator-invite picker UI)
  - Live "must sum to 100%" validation
  - Lead row pinned, can't be removed
- Read-only **Platform fee** card below: "Your tier (Glow) → 10% platform fee. Hold more $RHOZE to drop it."
- "Linked work" + splits fingerprint sections kept as-is.
- Lock state: once `locked_at` is set, the whole panel becomes read-only with a "Locked at {date} · 0x{hash}" badge linking to Solscan.

### 3. Curator → Collaborator reframe
- `CuratorInviteSection` → `CollaboratorInviteSection`. Same DB rows, new copy ("Invite collaborator"). Accepting an invite inserts into `revenue_split_collaborators`.
- `CuratorInvitesInbox` → `CollaboratorInvitesInbox`. Notifications updated.

### 4. Edge function rewrite — `split-revenue/index.ts`
On milestone approval:
1. Load config + collaborators. **Require** `locked_at IS NOT NULL` (else error: "Splits must be locked before payout").
2. Compute `platform_amount = floor(total * locked_platform_fee_bps / 10000)`.
3. `pool = total - platform_amount`. For each collaborator: `award_rhoze(user_id, floor(pool * pct / 100))`. Rounding dust goes to lead.
4. Memo includes `{ protocol: "rhozeland", type: "split_payout", config_id, splits_hash, platform_bps, total, platform_amount }`.
5. Notifications fan out to every collaborator + (if applicable) on-chain buyback wallet logic removed entirely.

### 5. Project lock flow
- `ProjectLockButton` (or wherever lock currently happens) calls `lock_split_config` after collecting signatures. The platform fee at that moment becomes `locked_platform_fee_bps`. `anchor-roadmap` edge fn memos the splits hash.

### 6. Copy + surface sweep
- Kill the words **curator** and **buyback** in user-facing copy across:
  - Landing page, /credits "How rewards work" tab, project workspace, marketplace, profile pricing, Spaces booking confirmation, all email templates.
- Replace with **collaborator** + the 15/10/7 platform-fee line.
- Update [Revenue Splits](mem://features/revenue-splits) and [Rhoze Economy](mem://features/rhoze-economy) memories. Add a "Splits v2" core line to index.

### 7. What stays the same
- `src/lib/platform-fee.ts` — already correct, no change.
- Spaces bookings, event tickets, marketplace, paid project milestones — already use tier-based fee. They just stop being "the special case" now.
- Splits fingerprint anchoring on Solana — same SHA-256 mechanism, just over the new shape.

---

## Out of scope for this pass
- Bringing back the buyback pool as a separate SKU (could return later as an opt-in "tip the ecosystem" toggle, but not now).
- On-chain SPL splits via Anchor program — still spec only, unchanged.

After approval I'll run the DB migration first, wait for you to confirm, then do the code sweep in one pass.
