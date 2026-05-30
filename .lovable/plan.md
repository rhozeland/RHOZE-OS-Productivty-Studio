# Pillar 6 — Simplify & Ship

The product is built. This pass strips it down to what a first-time artist actually needs: **post work → get on a roadmap → attach a coin**. Everything else becomes optional or hidden.

---

## 1. Side navigation — collapse to 3 + Pass

**Current:** Discover · Feed · Portfolio · Creator Pass
**New:** Discover · Feed · Creator Pass

- Remove **Portfolio** from sidebar. Page stays mounted at `/portfolio` (deep-linkable from Pass) but not a primary tab.
- Inbox/Messages stays in the InboxDrawer (already off the sidebar).
- Admin link unchanged.

## 2. Posting — collapse to "post work"

**Current:** StreamComposer offers Update / Work / Event / Space / Prediction pills.
**New:** Single composer = **Post Work**. Three media kinds only:

- **Audio** (upload or embed: SoundCloud / Spotify / YouTube / Audius / Bandcamp)
- **Visual** (upload or embed: YouTube / Vimeo)
- **Photo** (upload)

No title required, no description required, no "write a note" type. Optional caption (1 line). After posting:
- Inline "🔗 Attach to coin" button (only if creator has approved token) → calls existing `AttachCoinToWorkButton` logic.
- Inline "🛡 Anchor as Verified IP" link → existing flow.

Retire `NoteComposer` from the public Feed surface (keep file for DMs).

## 3. Events — demote, don't delete

- **Remove** the Luma iframe embed (`LumaEventEmbed`) from profiles. Replace with a plain "Upcoming" list that renders whatever the creator pastes (Luma / Eventbrite / Resident Advisor / Bandsintown URLs). No iframe, no parsing — just a labeled link with date if provided.
- **Remove** the ICS sync card from Settings (`IcsImportCard`). The `sync-ics-events` edge fn + cron stay on disk but are unmounted.
- **Gate event creation** on Rhozeland (`/spaces/events/new`) behind `verification_status='verified'` OR `verified_pro_at IS NOT NULL`. Unverified users see a "Verified Artists can host events on Rhozeland" upsell pointing to `/settings/verification`.
- Events on the roadmap stay — milestones can be "Host listening party" etc., and link to either an external URL or a hosted Rhozeland event.
- **Discover:** remove the `Live` chip on `MarketRoomPage` (5 filters → 4: All · Find Artists · Listings · For You). `?kind=live|event|space` deeplinks redirect to `?kind=all`.

## 4. Profile & portfolio metrics — bullish only

`CreatorTokenPanel` / `TokenDiscoveryChip` / `PortfolioPage` currently surface market cap + 24h change + 7d sparkline + (in some places) liquidity, holders, volume.

**Keep:** Market Cap · 24h % · All-Time High · pump.fun link
**Drop:** Liquidity, holder count, 7d volume, "you'd earn $X" projections, raw $RHOZE balance widgets that show 6+ zeros.
**`PortfolioPage`:** remove dollar-total hero. Show holdings as a clean list of coins held (ticker · MC · 24h% · ATH) + a single "View on pump.fun" CTA per row. No portfolio-value chart.
**`CreatorRewardsCard`:** keep but reword — "Estimated creator rewards" stays, drop the explainer math, just show the number + pump.fun link.

Add `allTimeHighUsd` to `useCreatorTokenMetrics` (track rolling max of `marketCapUsd` per session in localStorage; persist later if needed).

## 5. AI roadmap — keep the feature, soften the framing

You're mixed on "Powered by AI" — I agree it's trendy and risks feeling generic. Proposal:

- **Keep** the auto-draft on project creation (it works and saves time).
- **Drop** the "Powered by AI" badge / chip language on `ProjectsPage` and `AiRoadmapDraftButton`. Replace with **"Draft a roadmap"** (button) and **"Suggested milestones"** (section header). The intelligence is implicit; the user doesn't need to be told.
- Keep the system prompt music-native and style-aware (already shipped in Pillar 5).

## 6. Dead-route cleanup

Audit and either redirect or remove from sidebar/⌘K/footers:
- `/launchpad/*` — already redirects, confirm no stale links.
- `/coin/:slug` — same.
- `/connect/match` — already redirects to `/market`.
- `/hub`, `/stream`, `/people`, `/profiles`, `/creators`, `/network`, `/marketplace` — confirm all redirect to `/discover` or its `?kind=` variants and aren't surfaced in nav.
- `/rewards` — confirm redirects to `/credits`.
- Remove **Treasury** link from sidebar footer (keep route mounted for transparency, just stop advertising it).

## 7. What I'm NOT touching

- DB schema for events/studios — staying. Just hiding the entry points.
- `ClaimAttendanceButton` / on-chain attendance — stays (used in roadmap event milestones).
- Subscriptions, proposals, concierge — all working, untouched.
- Coin-gated feed, token approval gate — untouched.

---

## Technical notes (for me)

- `AppSidebar.tsx`: drop Portfolio + Feed reorder.
- `StreamComposer.tsx`: gut to 3 media kinds; reuse existing upload pipeline from `WorksPage` / `UploadFileMeta`. Add inline embed-URL field that pipes through `getDirectThumbnail` + `fetch-link-metadata`.
- `ProfileDetailPage.tsx`: replace `<LumaEventEmbed />` block with a simple `<ExternalEventsList />` reading from a new `profiles.upcoming_links jsonb` (array of `{url, label, date?}`). Migration adds the column.
- `MarketRoomPage.tsx`: remove Live filter chip + `useEventRows` from the mixed deck.
- `EventCreatePage.tsx`: wrap in `useArtistVerification` gate.
- `useCreatorTokenMetrics.ts`: extend return type with `allTimeHighUsd`; track via localStorage `rhoze:ath:<mint>`.
- `PortfolioPage.tsx`: rewrite layout — drop hero $-total, drop chart, table-only.
- `IcsImportCard` / `LumaEventEmbed`: unmount, keep files on disk for revert.

---

## Open question for you

**Bandsintown / Songkick support in the "upcoming links" field?** I'd default to allow-any-URL with light validation (must be https) and not whitelist domains. Cleaner, more flexible, less code. OK?

If yes, I'll proceed with all of the above in one pass. If you want to peel anything off (e.g. keep Portfolio in sidebar, keep "AI" branding, keep Luma embed) — say so and I'll revise before starting.