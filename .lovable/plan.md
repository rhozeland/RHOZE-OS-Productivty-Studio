# Gamify Rhozeland — HUD Dock + XP Celebrations

Yes, we can absolutely gamify this. Here's the proposal, broken into three layers so we can ship it in slices instead of one giant drop.

---

## Layer 1 — The HUD Dock (the centerpiece)

Bring DockBar back, but reinvented as a **gaming HUD** inspired by your reference (dark glass pill + glowing gem orb on the left).

```text
┌──────────────────────────────────────────────────────────────┐
│  ◉   Lv 4  ████████░░  120/200 XP   🔥 7d   ◬ 240   [⌂][◎][✦] │
│  GEM                                                          │
└──────────────────────────────────────────────────────────────┘
```

- **Left orb (the "gem")**: animated iridescent sphere whose color/intensity = current Tier (Spark→Bloom→Glow→Play). Click → opens Creator Pass.
- **XP bar**: thin progress segment with shimmer; fills in real time when XP is awarded.
- **Streak chip**: 🔥 N-day streak (from existing StreakCard data).
- **$RHOZE balance chip**: live balance, click → /credits.
- **Nav pills**: Discover · Conversations · Profile (matches v8 nav, not the old DockBar's saved config).
- **Bottom-anchored, glassmorphic, dark**. Hides on scroll-down (existing behavior).
- Mobile: collapses to just the gem + XP bar; tap to expand.

This replaces the current dead `DockBar.tsx` (kept on disk for revert). Sidebar stays as the primary nav; dock is the **persistent player HUD**.

## Layer 2 — Celebration system (the dopamine)

A global `<RewardToast />` portal that listens for events and fires:

- **+XP burst**: small numeric "+15 XP" floats up from the gem with particle confetti.
- **+$RHOZE drop**: coin icon rains into the balance chip.
- **Level up**: full-screen flash, gem pulses, "LEVEL 5 — Builder" banner with sound + haptic.
- **Streak extended**: flame burst on the streak chip.
- **Verified IP minted / coin launched / first booking**: themed confetti.

Implementation:
- New `useRewardEvents()` hook listening on a Supabase realtime channel for the current user's `pending_rewards` and `credit_transactions` inserts.
- New `<CelebrationProvider>` mounted in `AppLayout`, uses framer-motion + canvas-confetti.
- Reuses existing `playSwipeSound` pattern for short audio cues.
- Respects `prefers-reduced-motion` (and a new Settings toggle "HUD effects").

## Layer 3 — XP unification

Right now XP lives in two places (CreatorJourney's local calc + StreakCard). Consolidate:

- Reuse `CreatorJourney`'s `LEVEL_XP` + 5-title ladder (Newcomer → Pro) as the canonical model — already shipped, no DB change needed.
- Compute XP from `pending_rewards` + `credit_transactions` (already done in CreatorJourney).
- Expose via a single `useCreatorXP()` hook so HUD, Creator Pass, and profile show the same numbers.
- Add a small `<XpTicker />` on the HUD that subscribes and animates deltas.

---

## What ships in this round

1. New `src/components/hud/HudDock.tsx` (the reference-style dock).
2. New `src/components/hud/RewardCelebration.tsx` + `CelebrationProvider`.
3. New `src/hooks/useCreatorXP.ts` (extracted from CreatorJourney).
4. Mount HUD + provider in `AppLayout` (auth-only, hidden on /auth /onboarding /flow).
5. Settings toggle: "HUD & celebration effects" (on by default).
6. Wire celebration triggers to existing reward inserts via realtime — no schema change.

## What I will **not** change in this round
- Sidebar nav, route structure, Creator Pass page layout — all stay.
- The deferred view-milestone rewards.
- DockBar.tsx itself (stays on disk; HUD lives at a new path).

## Tech notes
- Glow/gem: layered radial gradients + `iridescent-blob` keyframe already in index.css.
- Particles: `canvas-confetti` (tiny, 8KB) — add as dep.
- Realtime: one channel per user filtered to `pending_rewards.user_id=eq.{uid}` and `credit_transactions.user_id=eq.{uid}`.
- All colors via semantic tokens (no raw hex in components).

---

Approve and I'll build all six items in one pass. If you'd rather phase it (HUD first, celebrations second), say the word.
