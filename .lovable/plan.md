
# Connect → Projects refactor

A focused, multi-surface cleanup grouped into four waves. Wave A and B are pure surface fixes (no migrations). Wave C and D add the AI copilot + verified-coin-on-project capability.

---

## Wave A — Kill the phantom "Building in Public" lane

**Problem:** `PublicReleasesLane` pulls `profiles.token_ticker` for any public release owner and slaps a `$TICKER` chip on the card — even when the user never attached the coin to that project. The whole lane is also off-strategy.

**Fix:**
- Unmount `<PublicReleasesLane />` from `DiscoverPage.tsx` (line 376).
- Delete `src/components/discover/PublicReleasesLane.tsx` (no other callers).
- Leave the `/release/:slug` page + `is_public` flag on projects alone — owners can still share links manually; we just stop the auto-attached coin lie.

---

## Wave B — Connect page: Listings → Projects, swap Post → Start a Project, drop emojis

**`/market` (MarketRoomPage + ConnectBoard):**
- Rename the **Listings** filter chip → **Projects**. URL alias: `?kind=listings` keeps working; we also accept `?kind=projects`.
- Replace the floating **"Post"** button (currently top-right of MarketRoomPage) with a single **"Start a Project"** button. Click → opens the existing `ProposalSheet` (or `NewProjectDialog` for the no-counterparty path) — same dialog used today for "Start a project from this listing", just without a pre-seeded counterparty.
- Remove the `PostMenuButton` dropdown from the Connect page entirely (Work/Listing/Event/Space). Posting an event or space still lives in their dedicated create pages — Connect is now a discovery/start surface only.
- Strip emoji glyphs from any visible labels under `src/components/connect/` and from the AI roadmap description composer (`composeMilestoneDescription` in `useAiRoadmapDraft.ts` currently emits 🎯 / 📈 — replace with plain `Strategy —` / `Target —`).

**EMPTY_COPY** updates `call` + `listings` to read "No open projects yet — be the first to start one."

---

## Wave C — Move voice intake into the listing/proposal flow

Currently `<AiRoadmapDraftButton />` has a voice mic that lives **inside** an existing project's Roadmap tab. That's backwards — by the time you're in the roadmap, the brief is already locked. Move voice capture to where the brief is actually being authored:

- **Add voice mic** to `<ProposalSheet />`'s brief step (the "What / When / Vibe" textarea trio). Same `useVoiceBrief` hook, drops a transcript into the `what` field.
- **Remove** the voice mic from the in-project `<AiRoadmapDraftButton />` (the AI button stays; it just re-drafts silently from the existing project context).

---

## Wave D — Verified-coin-on-project + AI auto-roadmap + Copilot chat

**D1. Attach coin to a project (verified only)**
- New nullable col `projects.linked_token_id uuid references public.creator_tokens(id)`.
- Owner-only `<AttachCoinToProjectCard />` on `ProjectDetailPage` (Roadmap tab, near `PublishReleaseCard`) — dropdown of the owner's `status='approved'` creator_tokens; "None" clears the link.
- `PublicReleasesLane` is gone, but `ReleasePage` (public `/release/:slug`) gets the coin chip **only when `projects.linked_token_id` resolves to an approved token**. No more profile-token fallback.

**D2. AI auto-roadmap on project create (no empty roadmaps)**
- Today the auto-draft only fires from `ProjectsPage` when created via that page. Move the auto-draft into a DB-side hook + client-side fallback so **every** newly-created project (including those born from `sign_project_proposal`) gets `draft-project-roadmap` invoked once.
- Server side: the `sign_project_proposal` RPC already materializes goals from the proposal milestones — keep that path. For projects without a proposal (direct create), trigger a one-shot client effect on first load of `ProjectDetailPage` when `goals.length === 0`.

**D3. Roadmap Copilot chat (new)**
- New component `<RoadmapCopilot />` mounted as a collapsible right-side panel on the Roadmap tab of `ProjectDetailPage`.
- New edge function `roadmap-copilot` (Gemini 2.5 Pro, streaming) — system prompt includes the project, current goals + milestones, both collaborators' profiles + recent works, and the linked token (if any). Returns either a chat reply or a structured `proposed_changes` payload (add/edit/reorder milestones).
- Apply-changes button writes through to `project_goals` (with the existing RLS — owner/specialist only).
- **Out of scope for this wave:** AI-generated smartboards, Instagram/socials deep-dive scraping (no scraping infra + ToS risk). I'll add a placeholder "Generate intro brief" action in the Copilot that summarizes what we already have on file (profile bio + linked socials + recent works) — no scraping.

---

## Sequence

1. Wave A (delete lane, unmount) — pure deletion, ships in one pass.
2. Wave B (Connect rename + button swap + emoji strip).
3. Wave C (move voice mic to proposal sheet).
4. Migration for `projects.linked_token_id` → then D1 UI.
5. D2 auto-roadmap fallback.
6. D3 Copilot edge function + panel.

I'll execute waves A→C in one go (no migration needed), then pause for confirmation before the D wave since it adds DB + edge-function surface area.

---

## Technical notes

- `PublicReleasesLane` deletion is safe — only one caller (`DiscoverPage`).
- `ConnectBoard`'s `kind="listings"` branch already wraps `call`-rows, so renaming the chip is a label-only change in `MarketRoomPage`.
- The "start a project with no counterparty" path needs `ProposalSheet` to accept an empty `counterpartyId` — today it requires one. Fall back to `NewProjectDialog` when no counterparty is set.
- For D2, avoid double-drafts: gate the client fallback on `goals.length === 0 && !contract` (proposal-born projects always have a contract).
- For D3, store chat history in a new `project_copilot_messages` table (project_id, role, content, created_at) with RLS scoped via `useProjectRole`.
