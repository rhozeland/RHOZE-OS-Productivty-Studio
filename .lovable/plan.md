## What ships

Six changes, in this order. Stripe Connect (#3 on your list) is explicitly deferred — no work there.

---

### 1. Token-attached works
**Goal:** make coins feel like they *own* something concrete.

- Migration: add `works.linked_token_mint TEXT NULL` (nullable, no FK — pump.fun mints live off-platform).
- New component `<WorkTokenChip />` (compact variant of `TokenDiscoveryChip`) — renders inside `WorksLightbox` header + on work tiles in `CreatorsGrid` / `ReleasePage` when `linked_token_mint` is set AND the creator's `token_submission_status='approved'`.
- Upload/edit work UI: add a "Attach a coin" picker in `StreamComposer` + the work edit sheet. Picker = creator's own `profiles.token_mint_address` (one-click) OR paste any approved mint. Only owners can attach.
- Bonus surfacing: on `ProfileDetailPage` Works tab, attached-coin works get a subtle "Backs $TICKER" caption.

### 2. A&R splitter wallet — docs + settings field (zero on-chain code)
**Choice:** **Squads v4 multisig**, not Streamflow. Why: pump.fun creator wallets need a *receiving address that's also signable*, and Squads gives us a clean PDA the artist controls + we co-sign withdrawals. Streamflow is vesting (one-way drip) — wrong primitive here.

- Migration: add `profiles.ar_splitter_address TEXT NULL` + `profiles.ar_splitter_share_bps INT NULL` (e.g. 2500 = 25% to Rhozeland treasury). Both admin-editable only.
- New doc page `/ar-splitter` (`<ArSplitterGuidePage />`) — 3-step illustrated guide:
  1. Create a Squads multisig with you + Rhozeland treasury as signers, splits 75/25.
  2. Set the multisig PDA as your pump.fun coin's creator wallet (paste address → pump.fun creator dashboard).
  3. Tell us — paste the address into A&R intake; we verify on-chain and countersign.
- `<ConciergeIntakeSheet />` gains an optional "Splitter address (if you've already deployed)" field that writes into `concierge_requests.splitter_address` (new col).
- Admin `/admin?tab=concierge` queue surfaces the splitter address + share so we can verify before approving.
- Link to `/ar-splitter` from: `WhyLaunchCoinPage` tier 3 card, `ConciergeIntakeSheet` header, and the new auto-pinned admin docs row.

### 3. Discover hierarchy — Projects/Releases as the hero unit
**Goal:** first-time visitor instantly sees "tokenized music projects with milestones," not a flat content feed.

New top-of-page lane on `DiscoverPage`:

```text
[Hero: gradient + "Music projects, building in public"]
  ↓
<PublicReleasesLane /> — large project/release cards, 2-up on mobile / 3-up desktop
  Each card shows:
    • cover + title + creator chip
    • status pill (Drafting · In production · Released)
    • milestone progress bar (X of Y milestones done)
    • nested mini-rows: next event (if any) · space (if any) · $TICKER chip (if any)
    • cheer count + "Open release →"
  ↓
<CoinsInMotionLane /> (existing, demoted to underneath)
  ↓
<ListingsLane /> (existing)
  ↓
<CreatorsGrid /> (existing, demoted)
```

Data source: `projects.is_public=true ORDER BY (cheer_count desc, updated_at desc) LIMIT 12`, joined with milestones aggregate + next event + linked space + creator profile token chip.

### 4. /why-coin three-tier "Help me launch" ladder
**Goal:** every visitor self-sorts into a path.

Replace the current "Ready when you are" footer section with `<LaunchLadder />`:

```text
TIER 1 — Do it yourself
  "You know what you're doing"     [Launch on pump.fun ↗]
TIER 2 — Curated match (A&R lite)
  "We pair you with a curator"     [Request a match → opens ConciergeIntakeSheet w/ tier=curated]
TIER 3 — Full Rhozeland Roster
  "We co-pilot the launch + A&R"   [Apply to roster → opens ConciergeIntakeSheet w/ tier=roster]
```

`concierge_requests` already exists; add `tier` enum col (`diy | curated | roster`). Default existing rows to `curated`.

### 5. Auto-roadmap on project create
- `NewProjectDialog` (and `ProposalSheet` → "Accept & start project"): immediately after `projects.insert` succeeds, fire `useAiRoadmapDraft` with project name + budget + brief (and both profiles if known) → write returned milestones into `project_milestones` with status `draft`.
- Show a one-line "✨ Drafting your roadmap…" toast → on success "Roadmap ready — review on your project page."
- Owner can edit/delete any draft milestone before locking.
- ProjectsInbox already pills `Roadmap drafting` for `status='draft'` projects — no change needed there.

### 6. /release/:slug → pre-filled pump.fun handoff
- Update the "Tokenize this release" button on `ReleasePage` to deeplink with pre-filled querystring:
  `https://pump.fun/create?name=<release title>&symbol=<auto-ticker from title>&description=<release vision, 240 chars>&image=<cover_url>`
- Also drop a tiny "Copy details" affordance (clipboard JSON) as fallback if pump.fun ignores the params.
- After launch, the artist returns to `/settings#token`, pastes the mint, admin approves — token then auto-attaches to the release via the new `works.linked_token_mint` field on the release's hero work.

---

## Migration summary (one file)
- `ALTER TABLE works ADD COLUMN linked_token_mint TEXT;`
- `ALTER TABLE profiles ADD COLUMN ar_splitter_address TEXT, ADD COLUMN ar_splitter_share_bps INT;`
- `ALTER TABLE concierge_requests ADD COLUMN splitter_address TEXT, ADD COLUMN tier TEXT NOT NULL DEFAULT 'curated' CHECK (tier IN ('diy','curated','roster'));`

## Out of scope (explicitly)
- Stripe Connect collaborator payouts — deferred until real volume.
- On-chain Squads PDA deployment helper — manual process for now.
- Token chip auto-attach trigger on token approval — manual link from settings for v1.

## Suggested execution order
1 → 5 → 6 → 4 → 3 → 2 (token plumbing first so other surfaces can render the chip; A&R last since it's mostly docs).
