# Releases + Build-in-Public rework

Two concrete moves. First one is fast and visible. Second is the real workspace lift.

## 1. Kill the pop-up chain on /my-projects

Right now clicking **New Release → Start Blank** stacks three modals: Pick → Create → Invite. That's what the first two screenshots complain about.

Replace with an **inline expanding panel** anchored to the "New Release" tile (like screenshot 3, but the tile itself grows in place):

```text
┌──────────────────────────────────────┐
│  CREATE                              │
│  New Release                         │
│  Spin up a fresh project…            │
│  ─────────────────────────────       │
│  ▸ Name your release  [_________]    │
│  ▸ Accent  ● ● ● ● ●                 │
│  ▸ Invite  [search collaborators]    │
│  ▸ (optional) Attach a $coin ▾       │
│                                      │
│  [ Skip & open canvas ]  [ Create → ]│
└──────────────────────────────────────┘
```

- No overlay dim, no z-index stack. Framer-motion height/opacity transition.
- Same panel handles rename, color, invites, coin attach — all optional.
- Clicking Create writes the project row, fires invites in the background, then slides the whole page into the workspace (no route jump feels — use a soft cross-fade to `/projects/:id`).
- "Bring in your team" (screenshot 2) becomes a section *inside* this panel, not a second modal.

## 2. Rework the release workspace into a build-in-public hub

The current `/projects/:id/canvas` is a 4-lane board. The user wants the depth of the previous project system (roadmap, smartboards, drop rooms, disputes, activity, messaging) fused with the fun/wow of the canvas, framed around **fans watching artists build in public**.

New shape at `/projects/:id` (canvas becomes one of several modes, not a separate URL):

```text
┌─── Release header (accent bar, cover, title, status pill, cheer count) ───┐
│  Owner · collaborators · $TICKER chip · Publish toggle · Share            │
├────────────────────────────────────────────────────────────────────────────┤
│  Mode tabs:  Canvas · Roadmap · Vault · Room · Activity                    │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  <selected mode renders here — no page jumps, framer transitions>          │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
                   ┌──────────────────────────────────┐
                   │  Floating AI Copilot (existing)  │
                   └──────────────────────────────────┘
```

### Modes

- **Canvas** — the existing FigJam-lite board (Ideas / In progress / Review / Released). Drag media in, AI drafts milestones. Untouched functionally.
- **Roadmap** — reuses `StageRoadmap` + `MilestoneTracker` + `ProgressChart` + `AiRoadmapDraftButton`. Signed agreement card stays at the top. This is where the *technical* project management lives.
- **Vault** — `ProjectScopeDeliverables` + Verified IP anchoring. File spine.
- **Room** — merged Drop Room + Smartboard + project messages in one column: pinned smartboards on the left, live chat on the right. Uses existing `DropRoomLauncher` + `chat_group_messages` under the hood.
- **Activity** — story updates (`StoryUpdates`), cheers, backer joins, milestone approvals, disputes (`ProjectDisputes`) — one reverse-chronological feed. This is what public fans see when the release is published.

### Build-in-public layer

For any release with `is_public=true`:

- The public `/release/:slug` page (already exists) gets a new **Live feed** section pulling from Activity — same rows, read-only.
- **Cheer** stays. Add a lightweight **"Should this become a coin?"** vote widget (thumbs up counter on the release row, no new token, just a signal). When it crosses a threshold the owner sees a "Ready to tokenize" nudge inside Activity that deep-links to the existing pump.fun start-a-coin flow.
- Fans see: cover, vision, roadmap milestones (public ones only), latest activity, cheer + vote, owner chip, $TICKER if attached.

### What we're NOT doing this pass

- No new messaging surface — Room reuses existing chat tables.
- No new dispute engine — surfacing the existing one inside Activity.
- No changes to Connect / DMs / notifications globally.
- No schema migrations required — everything above rides existing tables (`projects`, `project_goals`, `project_milestones`, `project_story_updates`, `project_cheers`, `project_deliverables`, `drop_rooms`, `chat_group_messages`, `project_disputes`, `canvas_cards`).

## Technical notes

- New file: `src/components/project/InlineNewReleasePanel.tsx` — replaces the modal chain from `StartProjectPicker`.
- Rework `ProjectDetailPage.tsx` (existing) to host the 5-mode tab shell; move canvas rendering out of the separate `/projects/:id/canvas` route into a Canvas tab. Old route redirects to `/projects/:id?mode=canvas`.
- New `src/components/project/ReleaseActivityFeed.tsx` aggregates cheers + story updates + milestone events + disputes into one list.
- New `src/components/project/CoinVoteWidget.tsx` — a single column on `projects` (`coin_vote_count int`) + a `project_coin_votes` table (user_id, project_id, unique). One migration.
- Public `ReleasePage` gets a new `<PublicActivityStream />` section reading the same feed with `is_public` filter.

## Order of work

1. Ship the inline New Release panel (removes the pop-up complaint immediately).
2. Ship the 5-mode workspace shell around existing components (no new features, just fusion).
3. Add the Activity feed + public stream on `/release/:slug`.
4. Add the coin-vote widget + migration.

Steps 1 and 2 are the visible wins. 3 and 4 are the build-in-public payoff.

Want me to start with step 1 only, or run 1 → 2 in the same pass?
