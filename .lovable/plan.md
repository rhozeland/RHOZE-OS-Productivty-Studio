# One Pipeline: Upload → Verify → (Optionally) Launch a Coin

You're right that everything we've built — Flow uploads, Works fingerprinting, Spaces, Events, Hub — is really one motion: **register a creation, prove it's yours, give it a lifeline.** This plan unifies them around that single idea.

## The mental model

```text
                                     ┌──────────────────┐
   Upload anywhere (Flow, Works,     │  Verified IP     │   ┌───────────────┐
   Listing, Project, Event)  ──────► │  (admin review,  │──►│  Launch coin  │
   → SHA-256 fingerprint instantly   │   anchor on Sol) │   │  (optional)   │
                                     └──────────────────┘   └───────────────┘
```

Three states for any creation:
1. **Fingerprinted** — hashed in the browser the moment it's uploaded. Free, automatic, invisible to the user.
2. **Verified** — creator submitted it for review, an admin confirmed authorship/originality, then it's anchored on Solana with a public proof. Earns the **Verified** badge.
3. **Launched** — creator mints a token tied to the asset. Supporters buy in on a bonding curve. Becomes a tradeable lifeline for the work.

We stop saying "provenance" in the UI. We say **Verified** (badge), **Receipts** (tooltip-friendly nickname for the hash + Solscan link), and **Launch a Coin**.

---

## Phase 1 — Fix Flow Mode + bridge it to Works

**Flow Mode stays.** It becomes the public browser for creative IP. Today it's buggy because we routed `/flow` → `/projects` and the upload pipeline drifted from the Works pipeline. We re-anchor it.

- Restore `/flow` as a real page (un-redirect). Inside Projects → Tools, "Flow" launches `/flow`.
- Every Flow upload runs the SHA-256 hash in the browser (same `computeContentHash` already used by Works). The hash + file metadata is saved on the `flow_items` row.
- Below every Flow card, show one of three chips:
  - `Fingerprinted` (gray, default) — has a hash, not yet submitted for review
  - `Pending review` (amber) — creator submitted it
  - `Verified` (the existing `<VerifiedIPBadge />`) — anchored on Solana
- A "Verify this work" CTA on each of the user's own Flow cards opens a one-screen submission form (title, description, optional supporting links). It creates a Work record + a verification request.
- Old Flow posts (uploaded before today) get **no automatic backfill**. Instead, the "Verify this work" CTA on those cards still works — when the creator clicks it, we re-hash the file from storage server-side and create the Work + request. So the door is open, but only when the creator actively chooses it.

**What this does for Flow:** it stops being a throwaway swipe feed and becomes a public registry where every card can earn a blue check.

---

## Phase 2 — Verification application & admin review

A new lightweight workflow, modelled on the existing studio-application + admin-review patterns.

- New table `work_verification_requests`: `work_id`, `applicant_id`, `status` (`pending` / `approved` / `rejected` / `changes_requested`), `applicant_note`, `supporting_urls[]`, `reviewer_id`, `review_note`, `decided_at`.
- Creator submits → status `pending`, notification fires to admins.
- New admin tab in `/admin` → **IP Verifications** (sits next to Studio Applications). Lists pending requests with: file preview, hash, applicant profile, supporting links, side-by-side reverse-image hint area for future automation, Approve / Request changes / Reject buttons.
- On approve → call existing `anchor-contribution` edge function → write `solana_signature` onto the `works` row → set request to `approved` → fire notification + email to creator → `<VerifiedIPBadge />` appears everywhere that Work surfaces.
- Settings → Provenance gets a new section "My Verification Requests" listing status + admin notes for each submission.

**Backfill of historical uploads** is the same flow with the rehash-from-storage helper. We don't bulk-import anything — each piece is opt-in by the creator and reviewed before it earns the badge.

---

## Phase 3 — Word choice + UX polish

- "Provenance" stays as a section name in Settings (creators searching for it will find it) but the body copy uses **Verified IP** and **Receipts** consistently.
- Tooltip everywhere the hash appears: *"Receipts: a tamper-proof fingerprint of this file recorded on Solana. Click to view on Solscan."*
- The "Verify" badge gets a hover card explaining: who reviewed it, when it was anchored, the SHA-256, the Solana tx.

---

## Phase 4 — Launchpad (`pump.fun for artists`)

This is the bold part. We give creators an option (never a requirement) to mint a token tied to a Verified Work, Space, or Event. Holders become supporters. The token becomes the asset's lifeline.

**Constraints we're committing to:**
- Token is only available **after** the asset reaches `Verified` status. No verification, no coin. This protects the brand and prevents spam mints.
- Built on Solana. Token = SPL. Launch = bonding curve (constant-product, like pump.fun) priced in **SOL**, not $RHOZE. Creator gets a fixed % of every trade; platform gets a fixed %; rest goes into the curve.
- A migration threshold (e.g., curve hits X SOL of liquidity) graduates the token to a Raydium pool, locks LP. After graduation, Rhozeland just shows the chart and links out.

**What ships in this phase:**
- A new on-chain Solana program (Anchor) for the bonding curve — biggest piece of work; spec lives in `.lovable/anchor-program-spec.md` and gets extended.
- New tables: `asset_tokens` (one row per launched asset → mint address, curve PDA, creator %, status), `token_trades` (indexer cache for the chart).
- New page `/launch/:asset_type/:asset_id` — single-screen launch form: name, ticker, image (defaults to the Work's file), creator share %, confirm. Connects wallet, signs, mint goes live.
- `/coin/:mint` page — chart, buy/sell, holder list, "About this Work/Space/Event" panel that pulls in the verified hash + Solscan receipt + owner profile.
- Surface the "Launch a coin" button on every Verified asset detail page (Works, Spaces, Events, eligible Hub offerings).
- Indexer edge function (`index-token-trades`) polls the program for trade events and caches them for chart rendering. No third-party indexer dependency.

**Legal/comms note (not code):** before launch we surface an in-app disclaimer that this is permissionless, creators are responsible for their own representations, and the platform takes no custody. We'll want to revisit terms-of-service text — flagged as a non-engineering follow-up.

---

## Build order (so we don't try to do everything at once)

1. **Un-break Flow Mode** + add fingerprinting on every Flow upload (no review yet, just the chip). *Smallest, ships value immediately.*
2. **Verification request flow** + admin review tab + opt-in backfill of old uploads.
3. **Vocabulary pass** (Verified / Receipts / tooltips).
4. **Launchpad — Phase 4a:** the Anchor program + `asset_tokens` schema + a thin "Launch coin" form on Verified Works only. SOL-denominated bonding curve. No chart yet, just buy/sell + holder list.
5. **Launchpad — Phase 4b:** the chart, the indexer, graduation to Raydium, opening up to Spaces and Events.

We pause for your review between each step rather than shipping it all at once.

---

## Technical notes

- **Existing infra reused:** `computeContentHash`, `works` table, `work_attachments`, `anchor-contribution` edge function, `<VerifiedIPBadge />`, admin role gating via `has_role()`.
- **New tables (Phase 2):** `work_verification_requests` with RLS — creators see only their own, admins see all (via `has_role(auth.uid(), 'admin')`).
- **New tables (Phase 4):** `asset_tokens`, `token_trades` — both readable by anyone (these are public-by-design), insert/update only via edge functions using the service role.
- **New edge functions:** `request-work-verification`, `approve-work-verification` (wraps the anchor call so review + anchor are atomic), `rehash-stored-file` (server-side re-hash from storage for backfill), `launch-asset-token` (builds and submits the Anchor mint tx), `index-token-trades`.
- **Solana program:** new Anchor workspace under `programs/rhoze-launchpad/`. Spec extended in `.lovable/anchor-program-spec.md`. Devnet first, mainnet after audit.
- **Buffer polyfill** stays as is — already in place for Solana web3 on the client.
- **Fee model (Phase 4):** 1% platform, 1% to a creator-treasury PDA, rest to the curve — concrete numbers locked in during step 4a.

---

## Two open product calls I need from you

1. **Word for the badge** — you skipped that question. I'll default to **"Verified"** (matches the existing badge component and is the most universally understood) unless you want **"Receipts"** as the badge wording with "Verified" reserved for the tooltip.
2. **Token denomination** — I've assumed **SOL** for the bonding curve because that's how pump.fun works and it gives the asset real liquidity from day one. The alternative is **$RHOZE-denominated**, which keeps everything inside our economy but bootstraps slower. Confirm SOL or flip to $RHOZE before step 4a.