# v11 — Music-Native Rhozeland

**Status:** Spec / framing doc. Nothing implemented yet.
**Decided:** Hard pivot — Musician is THE default archetype.
**Author:** Distilled from May 29 2026 product review with Michael Lé + Madiha.

---

## 1. Positioning

> **Rhozeland — Where independent musicians get discovered, launch a coin, and get backed.**

- The atomic unit of the platform is a **musician** (singer, rapper, producer, beatmaker, DJ, band).
- Other roles — **producer · engineer · videographer · visual artist · promoter · manager** — exist only as *supporting collaborators* in a musician's orbit. They are not co-equal archetypes anymore.
- The product is the **bridge between a musician's career and the on-chain capital that wants to back it** (pump.fun), with the operational glue (gigs, studios, projects, listings) needed to make the bridge real.

### One-line pitches
- **For fans / investors:** "Discover real musicians, see them building, back them with a coin."
- **For musicians:** "Get paid for your work, prove what you ship, launch a coin with help."
- **For supporters (producers/visuals/promoters):** "Find artists who need you. Get hired. Earn $RHOZE."

---

## 2. The four meeting decisions, codified

| # | Decision | Implementation |
|---|---|---|
| 1 | **Remove "Match Made"** | Delete `<ConnectMatchDeck />` from MarketRoomPage. Retire `/connect/match` route + `ConnectMatchPage`. Drop `useMixedConnectRows`. Keep the files on disk one version for revert. |
| 2 | **"Start a coin" = primary creator CTA** | Profile owner-view (when no `token_mint_address`): hero CTA = **"Launch your coin on pump.fun → with Rhozeland support"**. Dashboard top card mirrors. Post-onboarding Ready step nudges. |
| 3 | **Pump.fun = the discovery layer** | Promote `<TokenDiscoveryChip />` above the fold on profile (currently in `<SupportSheet />` Trade tab only). Add a **"Coins in motion" lane** to Discover, sorted by pump.fun 24h volume (uses existing `useCreatorTokenMetrics`). |
| 4 | **Merge Events + Spaces → "Live"** | Connect filters collapse from 4 → **3**: `Hire · Live · Listings`. The "Live" feed interleaves `useEventRows()` + `useSpaceRows()` (events get date pill, spaces get hourly-rate pill). Standalone `/events` `/spaces` routes stay mounted for direct links but the unified surface is the front door. Per Madiha: **Listings stay distinct** because they're the primary $RHOZE-earn surface. |

---

## 3. Vocabulary swap (UI only — DB unchanged)

Centralize in a new `src/lib/music-copy.ts`. All references read from there, no inline strings.

| Old | New |
|---|---|
| Creator | **Artist** (default) / **Musician** (when emphasized) |
| Works | **Tracks · Releases · Visuals** (context-derived from work type) |
| Project | **Release · EP · Tour · Music video · Drop** (user picks template at creation) |
| Spaces | **Studios & venues** |
| Events | **Shows & sessions** |
| Concierge | **A&R** (Artists & Repertoire — the music-industry term for label-side artist development) |
| "Backed by Rhozeland" | **"On the Rhozeland Roster"** |
| Generic "Creator Pass" | Stays as "Creator Pass" — universal enough |

Internal identifiers (table names, RPCs, env vars, $RHOZE wordmark on Solana surfaces) **do not change**. This is a copy-only swap.

---

## 4. Archetype model — hard pivot

### Before (v9.3 → v10.3)
```
Creator (umbrella)
├── Artist
├── Builder
└── Influencer
```

### After (v11)
```
Music (umbrella)
├── Musician           ← default, gravitational center
├── Producer
├── Engineer / Mixer
├── Visual (videographer, photographer, designer)
└── Promoter / Manager
```

### Migration plan
- `profiles.archetype` CHECK constraint expands: `('musician','producer','engineer','visual','promoter')`. Old values (`'artist'|'builder'|'influencer'`) migrate:
  - `artist` → `musician` (default — they self-correct if not music)
  - `builder` → `producer` (most builders on the platform make beats; outliers re-pick in settings)
  - `influencer` → `promoter`
- Onboarding archetype step rewrites: **"What's your role in music?"** Six tiles (5 above + "I'm here to discover").
- Discover archetype filter (`<ArchetypeFilter />`) becomes a 5-pill row. Default = `musician`.
- Color tokens in `tailwind.config.ts`:
  - `--archetype-musician` → rose (carry over from artist)
  - `--archetype-producer` → violet (new)
  - `--archetype-engineer` → teal (new)
  - `--archetype-visual` → amber (carry from influencer)
  - `--archetype-promoter` → emerald (new)
- `archetypeBannerGradient()` in `src/lib/archetypes.ts` gets 3 new colorways.

### Discovery side-effect
The "Coins in motion" lane and Featured lane both default to musicians-only. Toggle to widen to all roles is a secondary filter, not the default view.

---

## 5. A&R (formerly Concierge)

Rename the existing flow, retune the copy. Mechanics stay identical.

| File / route | Old | New |
|---|---|---|
| `<ConciergeIntakeSheet />` | Concierge intake | `<ArtistDevelopmentSheet />` — "Apply for A&R support" |
| `/concierge` | Public landing | `/label-services` — pitch is "Launch a coin with us. We handle the fundraising, you handle the music." |
| `<BackedByRhozelandBadge />` | "Backed by Rhozeland" pill | `<RhozelandRosterBadge />` — "On the Rhozeland Roster" |
| `/admin?tab=concierge` | Concierge queue | `/admin?tab=ar` — A&R pipeline |
| `concierge_requests` table | (unchanged — internal) | (unchanged) |
| `convert_concierge_request` RPC | (unchanged) | (unchanged) |

The A&R copy explicitly mentions:
- "We help you launch your coin on pump.fun."
- "We bring the first wave of investors."
- "25% of any fundraising or fee-bearing engagement we close on your behalf."
- "$1k minimum project value."

---

## 6. Listing → Roadmap → Lock workflow (Michael's correction)

Today the listing-to-project handoff is hidden inside `<ProposalSheet />`. Make it the explicit, named pipeline:

1. **Fan/client inquires on a listing** → opens `<ListingLightbox />` → "Start a project from this listing" → currently jumps straight to `NewProjectDialog`.
2. **NEW:** That click should instead create a **draft Proposal** scoped to the listing (uses existing `project_proposals` + `_milestones` tables). Both parties land in the same proposal builder.
3. **Both parties define milestones, deliverables, budget.**
4. **Both sign** → `sign_project_proposal` RPC fires → real project locked.
5. The locked project gets an `is_public` flag. If true, surfaces on `/release/:slug` (see §7).

### Inbox view (`ProjectsInbox`)
The "Listings & inquiries" pipeline at top adds clearer status pills:
- `Inquired` (lightbox click logged, no proposal yet)
- `Roadmap drafting` (proposal open, milestones being negotiated)
- `Your turn to sign` / `Waiting on them`
- `Locked` (becomes a project)

---

## 7. Build-in-public — public roadmaps (Solana hackathon angle)

New optional surface, only built once §1–§6 ship.

- `projects.is_public boolean default false` + RLS allows public read when true.
- Public project page: `/release/:slug` — shows milestone board, supporter count, comment thread, "Cheer this release" button (free, just a counter).
- When a public project crosses an engagement threshold (e.g. 50 cheers + 5 backers), an admin can flip a **"Tokenize this release"** flag. That unlocks a CTA: "Launch a coin for this release with Rhozeland A&R."
- This is the **explicit bridge** from project work → tokenization that Michael wants. The coin is for the *release*, not (necessarily) the *artist*.

### Why it works for the hackathon
- "Build in public" is the canonical Solana/Pump.fun cultural narrative.
- Public roadmaps are social proof investors can scroll before backing.
- The graduation from "this release got cheered" to "this release has a coin" is a clean, on-chain-anchored moment.

---

## 8. What's NOT changing

- Subscriptions ($5/$10/$25/mo Stripe) — keep, they're transactional revenue.
- $RHOZE Credits economy, rewards catalog, tier ladder — unchanged.
- All payment paths (Square, Stripe, $RHOZE).
- All RLS, edge functions, DB schemas (modulo the archetype CHECK widen).
- Sidebar nav (4 tabs).
- Flow Mode mechanics.
- Profile detail page structure (Overview / Support / Works / Building tabs).

---

## 9. Ship plan

### Tier 1 — positioning (ships first, ~1 PR)
- [ ] `src/lib/music-copy.ts` — single source for vocabulary
- [ ] Sweep call sites for "Creator" / "Works" / "Project" / "Events" / "Spaces" / "Concierge" → music-copy refs
- [ ] Remove `<ConnectMatchDeck />` + `/connect/match`
- [ ] Merge Events + Spaces → "Live" filter in Connect (and Flow already trimmed)
- [ ] Profile owner-view: "Launch your coin on pump.fun" hero CTA (when no token)
- [ ] Rename Concierge → A&R surfaces + route

### Tier 2 — discovery (second PR)
- [ ] "Coins in motion" lane on Discover (uses `useCreatorTokenMetrics`)
- [ ] Promote `<TokenDiscoveryChip />` above the fold on profile
- [ ] Listing → Proposal pipeline polish (clearer status pills in `ProjectsInbox`)
- [ ] Onboarding archetype rewrite (5 music roles, default Musician)

### Tier 3 — bridge to capital (third PR, post-review)
- [ ] Archetype DB migration (artist→musician, builder→producer, influencer→promoter, add engineer + visual)
- [ ] New archetype color tokens + gradients
- [ ] `projects.is_public` + `/release/:slug` public page
- [ ] "Tokenize this release" graduation flow

### Tier 4 — later
- [ ] Music-specific work types (track / release / visual / live set) replacing generic "work"
- [ ] Spotify / SoundCloud / Bandcamp embed support on tracks
- [ ] Genre + mood tagging on profiles for richer discovery

---

## 10. Risk register

| Risk | Mitigation |
|---|---|
| Non-musicians on the platform feel pushed out | Keep all five archetypes. Discover toggle to widen filter. No data deleted. |
| "A&R" is industry jargon | Keep the pill compact; pair with subtitle "Artist development & coin launch support" on the landing page. |
| Removing Match Made loses a delightful surface | If usage data later shows demand, rebuild as a Musician-only collab matcher. |
| Merging Events + Spaces obscures venue hosts | Live filter sub-tabs (Tonight · This week · Studios) preserve discoverability. |
| Public roadmaps leak private project data | `is_public` defaults to false. Toggle is explicit per-project. Sensitive fields (budget, files) stay private even when public. |

---

## 11. Naming open questions

- "Live" vs "Happening" vs "Shows & Studios" for the merged category — vote on copy in Tier 1 PR.
- `/release/:slug` vs `/drop/:slug` vs `/project/:slug/public` — defer to Tier 3.
- Whether to drop "Rhozeland" in favor of a more music-coded name later. Not now — brand equity already built.
