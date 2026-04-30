## Applying the S33R Thesis to Rhozeland

The S33R piece argues the real blockchain shift in music is **infrastructure** (rights, royalties, settlement, provenance) — not NFTs. Rhozeland already has the bones for the *creator-services* version of that stack. To "apply" the thesis we (a) reframe what we have using S33R's vocabulary, and (b) extend the model from one-off projects → ongoing IP/royalty streams (music being the launch vertical).

This plan is a phased build. We can start with Phase 1 alone if you want a quick win.

---

### How Rhozeland already maps to the S33R stack

| S33R layer | Rhozeland today | Gap |
|---|---|---|
| **Provenance** | `anchor_contribution` edge fn writes Solana memos at milestone events | Not extended to audio files / IP works |
| **Data normalization** | Internal — every payment is one Square charge → one `credit_transactions` row | No external DSP ingestion |
| **Programmable IP / splits** | `revenue_split_configs` (creator/curator/buyback %) + curator invite handshake | No multi-recipient splits, no royalty-on-resale |
| **Settlement** | Square fiat payouts (5–8 day manual) + $RHOZE off-chain credits | No stablecoin rails; Anchor escrow still spec only (`.lovable/anchor-program-spec.md`) |
| **Capital** | Withdrawal panel ($10 min, manual) | No advances / streams as collateral |
| **Applications** | Hub, Spaces, Projects | — |

So we already own **Provenance + Splits + Applications**. The S33R-aligned roadmap is: harden splits → add a **Work** primitive (the IP asset) → add **stablecoin (USDC) settlement** → expose **royalty streams** as objects you can point earnings at.

---

### Phase 1 — Rename & reframe (1 session, no schema changes)

Pure framing work. Lets us pitch the existing product in S33R's language.

- Add a new public page `/infrastructure` (linked from landing nav) that walks through the four-layer stack with our own component names: *Provenance · Splits · Settlement · Capital*. Each layer shows a real Rhozeland screenshot + one sentence on what's live vs. coming.
- Update landing page hero subtitle from "decentralized productivity studio" to something like *"Programmable revenue infrastructure for independent creators."*
- Rename `RevenueSplitConfig` UI label "Revenue Split" → "Programmable Split" and add a one-line caption: *"Executable code, not a contract clause."*
- Add a `splits_hash` column display (we already store splits; show their SHA-256 hash in the UI as a "fingerprint" — this is the same field the Anchor spec freezes on lock, so we're priming users for it).

### Phase 2 — Works (the IP asset primitive) (1 session)

The piece's strongest claim is that *rights become programmable financial assets*. Right now in our DB the asset is implicit — a `listing` or a `contract`. Make it explicit.

New table `works`:
- `id`, `owner_id`, `title`, `kind` (`song`, `design`, `writing`, `service`, `other`)
- `iswc/isrc` (nullable, for music)
- `created_at`, `provenance_signature` (Solana memo tx hash from anchor-contribution at registration)
- `file_url` (storage), `sha256` (content hash)

A `revenue_split_configs` row gets an optional `work_id` FK. So one Work can have many splits over time, and earnings from any listing/contract attached to a Work flow through that Work's active split.

UI: a `/works` page (new side-nav entry, music vertical first) where a creator drops an audio file, we hash + register it via the existing `anchor-contribution` function (one memo tx = timestamped registration), and the Work appears with its on-chain proof link.

This is the **Provenance + IP-asset** combo from the article in one shipped feature.

### Phase 3 — Multi-recipient splits + royalty-on-resale (1 session)

Today `revenue_split_configs` is a single row with `creator_pct / curator_pct / buyback_pct`. To represent real music splits (producer 20%, vocalist 30%, label 25%, writer 25%) we need an array.

- New table `split_recipients(id, split_config_id, recipient_user_id, wallet_address, basis_points)`
- Constraint: sum of `basis_points` per config = 10000
- Update `split-revenue` edge function to fan out to N recipients instead of 3 fixed buckets
- Update `RevenueSplitConfig` UI to add/remove rows with sliders, mirrors the Anchor spec's `Split` PDA so we can swap to on-chain later with zero data migration
- Add optional `royalty_basis_points` on `works` (resale royalty) — used when a listing is re-sold

### Phase 4 — Stablecoin (USDC) settlement opt-in (1 session)

The article's biggest unlock: months → minutes. We already have the Solana plumbing.

- Add `payout_currency` (`fiat_usd` | `usdc_solana`) preference per recipient on `split_recipients`
- New edge function `payout-usdc` — given a payout amount + wallet, build & submit an SPL transfer of USDC (devnet first, mainnet after audit)
- `split-revenue` reads each recipient's preference and routes accordingly (Square for fiat recipients, USDC tx for crypto recipients) — all in the same atomic milestone approval
- Show a "Settled in 12s · [tx link]" badge on `RevenueSplitLog` rows paid via USDC vs the existing "Manual payout in 5–8 days" line for fiat

### Phase 5 — Pitch this as the music vertical

Once 1–4 ship, we have a credible "music infrastructure" angle to take to S33R-type partners and to the hackathon judges:

- Landing variant `/for-music` showing the same product with music-specific copy (ISRC fields, royalty splits, sub-minute USDC payouts to collaborators)
- Case study / demo project: one Work, three collaborators, one paid milestone, three USDC transfers visible on Solana explorer, all in <2 minutes

---

### Technical notes

- Phase 2's content hash + memo registration reuses the existing `anchor-contribution` edge function — no new on-chain code needed.
- Phase 3 keeps the schema shape compatible with the `Split` PDA in `.lovable/anchor-program-spec.md`, so when we eventually deploy the Anchor program (out of scope here — needs Rust toolchain) we can mirror DB rows → PDAs 1:1.
- Phase 4 USDC: use the existing lightweight Solana JSON-RPC pattern (per our edge-function memory rule) — `@solana/web3.js` + `@solana/spl-token` via dynamic import only inside the function. Devnet USDC mint: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`.
- No changes to auth, RLS posture stays strict (recipients can only see their own splits/payouts).

---

### What to decide

Three orthogonal choices — I'd like your call before building:

1. **Scope to start with**: Phase 1 only (framing, ~30 min) · Phase 1+2 (framing + Works, ~2 sessions) · Full 1→4 (full stack, ~4 sessions).
2. **Music-first or generic**: Do we put music vocabulary (ISRC, royalty, DSP) front-and-center, or keep "Works" generic and let music be one `kind` among many?
3. **USDC network**: Devnet only for the demo (safe, free, instant) or wire mainnet behind a feature flag (real, but needs treasury USDC + audit caveats)?
