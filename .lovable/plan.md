# v7 Phase 4 — Two Audiences, One Loop

Sharpen Rhozeland into a **two-sided market** with one currency bridging it:

- **Fans / Traders** consume, support, speculate. Earn $RHOZE through engagement + commerce. Swap into artist coins to back creators they believe in.
- **Verified Artists** upload IP, launch coins, monetize. Their badge = trust signal that protects against impersonation.

This phase introduces the **Verified Artist tier**, **tiered upload gating**, a **rebalanced hybrid rewards model**, and surfaces the **fan → artist coin swap** as a first-class funnel.

---

## 1. Verified Artist tier (identity layer)

**New profile state:** `verification_status` = `none | pending | verified | revoked` (default `none`).

**What changes for unverified users (Fans):**
- Full consumer experience: browse, buy works, hold $RHOZE, swap into artist coins, comment, follow, attend Spaces.
- Can still upload, but uploads are flagged `unverified_work` — visually watermarked with an **"Unverified"** chip on cards and detail pages.
- Cannot mint Verified IP, launch a coin, list paid services, or host paid Spaces.

**What unlocks at Verified:**
- **Verified Artist** badge (new `<VerifiedArtistBadge />`, distinct from per-work `<VerifiedIPBadge />`) on profile, cards, and authored content.
- Mint Verified IP, launch a coin, list paid offerings, host paid Spaces.

**Verification flow (manual now):**
- New page `/settings/verification` → submission form: 30-second selfie video, 2+ social links, contact email, connected wallet (already required), brief artist bio.
- Stores into new `artist_verification_requests` table.
- New `AdminArtistVerifications` panel (mirrors existing `AdminWorkVerifications`) → review queue with approve/reject + note.
- Approval flips `profiles.verification_status` to `verified` and fires a notification + email.

## 2. Tiered upload gating (anti-impersonation)

**Universal upload paths** (works, drops, posts) gain a server-side check:
- If `verification_status !== 'verified'` and the user attempts to mark a work as Verified IP → blocked with a CTA modal pointing to `/settings/verification`.
- Unverified uploads are saved with `is_unverified = true` on the work row; UI surfaces an **Unverified** chip everywhere the work appears.
- Coin launch + paid services + paid Spaces creation paths get a hard gate (button disabled, tooltip → "Become a Verified Artist to unlock").

## 3. Hybrid rewards rebalance

Update `src/lib/rewards-catalog.ts` (or create if missing) — single source of truth for action → $RHOZE amounts. All credits continue to go through the existing **Admin Reward Gate** (`pending_rewards` → admin approves → `user_credits`).

**Engagement (small, daily-capped):**
- like_work: 0.5 $RHOZE (cap 20/day)
- follow_artist: 1 $RHOZE (cap 10/day)
- comment_work: 0.5 $RHOZE (cap 20/day)
- attend_space: 5 $RHOZE (per event)
- complete_profile: 25 $RHOZE (one-time)

**Commerce (bigger, the real driver):**
- buy_work: 5% of fiat spend converted to $RHOZE
- hold_artist_coin_7d: 10 $RHOZE per coin held continuously 7 days
- refer_paying_user: 100 $RHOZE
- attend_paid_space: 25 $RHOZE
- swap_into_artist_coin: 2% rebate on first swap per coin

A new `/rewards` page section ("How you earn") visualizes the full catalog so fans see the loop clearly.

## 4. Fan → artist coin swap funnel

**Discover page** — new lane **"Trending Artists"** showing top 6 verified artists with active coins. Each card has:
- Verified artist badge, recent work thumbnail, coin price + 24h delta sparkline, **"Swap $RHOZE →"** quick CTA opening the existing `TradePanel` modal.

**Profile (Coin tab)** stays canonical — already wired to `swap_rhoze_for_coin` RPC. Promote the swap CTA above the chart so it's the first thing a fan sees on a verified artist's profile.

**Landing page hero** — refresh subcopy to name the loop: *"Discover artists. Earn $RHOZE by supporting them. Swap into their coin and grow together."* (Keeps the v7 ownership pitch, clarifies the two-audience flywheel.)

---

## Technical plan

**Database (one migration):**
1. `ALTER TABLE profiles ADD COLUMN verification_status text DEFAULT 'none' CHECK (verification_status IN ('none','pending','verified','revoked'))`.
2. `ALTER TABLE profiles ADD COLUMN verified_at timestamptz`.
3. `CREATE TABLE artist_verification_requests` (id, user_id, video_url, social_links jsonb, contact_email, bio, wallet_address, status, reviewer_id, review_note, decided_at, created_at, updated_at) + RLS (owner read/write own pending; admins via `has_role` read/update all).
4. `ALTER TABLE works ADD COLUMN is_unverified boolean DEFAULT false`.
5. New storage bucket `artist-verification` (private) for selfie videos with owner-folder policies.
6. Trigger: when `artist_verification_requests.status` flips to `approved`, set `profiles.verification_status='verified'` + `verified_at=now()` + insert notification.
7. Server-side `before insert` trigger on `coin_launches`, `services`, paid Spaces tables → reject if author not verified.

**Frontend (new + edited):**
- `src/components/profile/VerifiedArtistBadge.tsx` — new (distinct visual from VerifiedIPBadge).
- `src/components/works/UnverifiedWorkChip.tsx` — new.
- `src/pages/settings/VerificationPage.tsx` — new, mounted at `/settings/verification`.
- `src/components/admin/AdminArtistVerifications.tsx` — new admin panel.
- `src/lib/rewards-catalog.ts` — new/updated single source of truth + `/rewards` page consumes it.
- `src/components/discover/TrendingArtistsLane.tsx` — new Discover lane.
- Edits: `DiscoverPage.tsx`, `ProfileDetailPage.tsx` (promote swap CTA), `LandingPage.tsx` (subcopy), `SettingsPage.tsx` (add Verification module → 9 modules total), upload modals (gate Verified IP toggle), coin launch + service create + paid Space create flows (gate behind verified).

**Memory updates:**
- `mem://features/verified-artist` — new file documenting tier, gating rules, badge usage.
- `mem://features/rewards-catalog` — new file with the canonical action→amount table.
- Update `mem://arch/pillars-v7` to mark Phase 4 shipped + add two-audience framing.
- Update `mem://index.md` Core: add "Verified Artist tier gates IP/coin/paid surfaces; unverified can still consume + swap + upload as Unverified."

**Out of scope (deferred):**
- Automated verification (social OAuth proof, ID checks) — manual queue only for now.
- On-chain verification proof — future Anchor program work.
- Reward farming defenses beyond per-action daily caps — revisit if abuse appears.

---

Approve and I'll execute in this order: migration → badge components → verification flow → upload gating → rewards catalog → Discover Trending lane → memory updates → typecheck.