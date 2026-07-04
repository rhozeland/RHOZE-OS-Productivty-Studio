# Kinetic Bento — Profile bottom half + immersive Coin Launcher

Scope stays inside the two surfaces you called out. Nothing above Reputation Signals changes (avatar, name, tier badge, Boost, Reputation Signals card all stay). Nav, sidebar, discover, flow — untouched.

## 1. Design tokens (scoped, not app-wide)

- Install `@fontsource/archivo-black` + `@fontsource/hind`, wire into Tailwind as `font-display` / `font-body`.
- Add a **self-contained** `.kinetic-theme` class in `index.css` exposing the midnight/mint palette (`--kb-bg #0a0f1e`, `--kb-surface #141c33`, `--kb-accent #2dd4a8`, `--kb-fg #e8f0f8`). Only the two new surfaces opt in — the rest of the app keeps its current light theme, so nothing else breaks.

## 2. Profile bottom half → Kinetic Bento canvas

Replace everything below the Reputation Signals card on `ProfileDetailPage` (the tab strip + tabs' worth of `<CreatorCoinsGallery />`, `<CreatorRewardsCard />`, projects grid, works grid, backing lane, services block, holdings, etc.) with a single **bento canvas** — no tab strip.

Tile inventory:

- **Featured Release** (2×2): most-recent public project or top work, cinematic thumbnail, title in Archivo Black, mint accent subtitle. Owner sees inline "Attach coin" / "Start release" ghost buttons.
- **Coin panel** (1×2): if a `creator_tokens` row exists → ticker + live sparkline (existing `useCreatorTokenMetrics`) + MC + rewards. If not and owner → "Attach a coin" CTA that opens the new launcher. Non-owner + no coin → tile hides.
- **Backing** (1×1): mint accent card, total holders + 24h delta.
- **Services** (1×2): the creator's `creator_roles` and top offering rows as a bulleted list.
- **Flow strip** (2×1): last 6 works as a real thumbnail grid (image/video/audio), each clicks through to the Flow post. Uses actual `works` rows — this is what replaces the sad text placeholders.
- **Investor Signal** (1×1): keeps the readiness number you like, condensed.
- **Collaborators** (1×1): avatar stack + count.

Deleted from public profile:
- The "Backing" tab (holdings/subscriptions the current user has in *other* creators) — moved to `/my-projects` only. Not shown on public profiles anymore.
- The full tabs strip (image / projects / megaphone / briefcase / heart icons).

## 3. Immersive Coin Launcher (replaces `AttachCoinFlowSheet`)

Convert the right-side Sheet into a fullscreen shadcn `Dialog` (`sm:max-w-none w-screen h-screen`) styled with the kinetic theme. Three steps in one canvas:

- **Step 1 — Paste CA**: giant centered `<input>`, big Archivo Black "ATTACH COIN" title, mint Verify button. Same edge fn (`creator-token-metrics`) fetches preview on paste.
- **Step 2 — Live token card + Target picker**: token preview card (ticker, price, 24h delta, sparkline) on the left; two huge tiles on the right → "Attach to a Release" vs "Attach to a Track".
- **Step 3 — Thumbnail picker**: 3-col grid of the user's actual `works` (image/video/audio thumbnails with play badge for AV), or `projects` covers. Selected tile gets mint ring + check.
- **Step 4 — Celebration**: same as today but bigger — confetti burst, coin chip spring-flies onto a preview of the target card.

### Track picker bug fix

Root cause of "No posts yet": the current picker only queries when `step === "pick-work"` and doesn't preload. Combined with a stale `user` on first render, the query never fires. New launcher:
- Prefetches `works` + `projects` on open (both `enabled: open && !!user?.id`).
- Falls back to `flow_items` if works comes up empty (safety net).
- Shows a skeleton grid while loading instead of the "No posts" copy — that empty label only shows after the query resolves with 0 rows.

## 4. Files

**New**
- `src/components/profile/bento/ProfileBentoCanvas.tsx` — the grid
- `src/components/profile/bento/tiles/{FeaturedReleaseTile,CoinPanelTile,BackingTile,ServicesTile,FlowStripTile,InvestorSignalTile,CollaboratorsTile}.tsx`
- `src/components/coin/AttachCoinLauncher.tsx` — fullscreen dialog (replaces `AttachCoinFlowSheet` at call sites)

**Edited**
- `src/pages/ProfileDetailPage.tsx` — swap tabs region for `<ProfileBentoCanvas />`
- `src/pages/StudioPage.tsx` — swap `<AttachCoinFlowSheet />` → `<AttachCoinLauncher />`
- Any other call sites of `AttachCoinFlowSheet` (grep first)
- `src/index.css` — `.kinetic-theme` tokens + font-family utilities
- `tailwind.config.ts` — register `font-display` / `font-body`
- `src/main.tsx` (or app entry) — `@fontsource` imports

**Untouched**
- Sidebar, Discover, Flow, Messages, Creator Pass, settings, admin
- Everything on the profile *above* Reputation Signals

## 5. Out of scope for this pass

- Coin chip fly-into-thumbnail animation (basic confetti + spring-in only; layout animation is a follow-up).
- Full mobile pass — desktop first at the 1440 prototype size, mobile falls back to a single-column stack of the same tiles.
- Deleting the old `AttachCoinFlowSheet.tsx` file — kept on disk one pass for revert safety.

Confirm and I'll build in this order: fonts + theme → launcher (unblocks the coin flow bug) → bento canvas → wire call sites.
