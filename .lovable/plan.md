## What we're building

Rhozeland becomes a **project-first** platform: artists open projects, collaborate, upload in real time, supporters watch and back. Spaces, events, charts, and the AI-build framing fold away. Tiles die.

---

## 1. Home = "Studio + Live Projects feed" (replaces /discover as the landing destination)

Single page everyone lands on after auth. Two zones, stacked:

**Top — Your Studio** (compact, only if signed in)
- "Continue working" row: your active projects (horizontal scroll, max 6) + one "Start a project" tile.
- Pending invites strip (1 line each, Accept/Decline inline).
- Quick stats line: active projects · supporters · pending payouts. No charts page, no chart widgets.

**Below — Live Projects feed** (vertical, infinite)
- Each row = one project update card: cover/upload, project title, owner + collabs, latest milestone, "X supporters · live now" pill, Back / Comment / Open buttons.
- Sorted by recent activity (new upload, new milestone, new collab joined).
- No tile grids. No artists row. No spaces/events row. No opportunities row.
- Filter bar (sticky, minimal): All · Following · Music · Visual · Photo.

Guests see only the feed (no Studio zone) + a thin "Sign in to start a project" banner.

Routing: `/` and `/discover` both render this. `/home` redirects here. Sidebar "Home" + "Discover" collapse into a single "Home" entry.

---

## 2. Project page — the atomic unit, rebuilt

Replace today's Overview/Roadmap/Timeline/Board/Story/Team tabs with **three** tabs:

**Build** (default)
- Combined roadmap+timeline (the one we just redesigned — keep).
- Below it: **Upload stream** — chronological feed of every file/note/link the team drops in. This is what supporters watch live. Owners + collabs can post inline (drag-drop file, paste link, type note). Each entry shows author avatar + timestamp + cheer/comment.
- Board (mood/refs) folded in as a collapsible at the bottom of Build.

**Backers**
- Supporters list, total backed, comments wall.
- "Attach event/space" button → owner spins up an event or in-person session tied to this project. Supporters can buy tickets, splits auto to project collabs per the existing revenue_split_configs.
- **ICO ramp card**: shows progress to qualification thresholds (e.g. ≥X supporters AND ≥$Y backed). When qualified, "Start tokenization with Rhozeland" CTA pings concierge. Until then: locked state showing what's needed.

**Team & money**
- Collaborators (invite by handle/email, accept flow, role).
- Money toggle: Free · Paid · Mixed. Per-milestone price if Paid/Mixed. Rhozeland fee surfaces inline using existing platform-fee tiers.
- Revenue splits editor (existing component).

Remove: "Story" tab, separate "Timeline" tab, AI roadmap drafter button, "Build with AI" copy.

---

## 3. Deletions (hard cuts)

- **`/charts`** route + ChartsPage + nav entry. Any coin signal that mattered → small "$TICKER · MC $X" chip on project cards when owner has an approved token.
- **Standalone Spaces & Events as nav destinations**: remove from sidebar + ⌘K + Discover. `/spaces`, `/events`, `/studios` routes redirect to `/`. Spaces/events still exist *attached to a project* via the Backers tab. Existing detail routes (`/events/:id`, `/studios/:id`) stay mounted for direct links / tickets to keep working.
- **Discover tile-grid sections**: Artists grid, Opportunities grid, Spaces grid, Coins-in-Motion lane → all removed. Replaced by the single Live Projects feed above.
- **AI-build framing**: remove `<AiRoadmapDraftButton />` from project create + ProjectsPage. Remove copy mentioning "AI drafts your roadmap." Edge fn `draft-project-roadmap` stays on disk (no nav references) for possible later revival.

---

## 4. Sidebar after cuts

5 entries → **4**: **Home** · **Connect** (DMs + invites) · **Projects** (your project inbox) · **Creator Pass**. Profile via avatar.

---

## Technical notes

- New component: `src/components/home/LiveProjectsFeed.tsx` — pulls from `projects` joined with most-recent `project_deliverables`, `project_milestones`, `project_collaborators`. Sorted by `greatest(latest_upload_at, latest_milestone_at)`.
- New component: `src/components/home/StudioStrip.tsx` — your active projects + invites.
- New component: `src/components/project/UploadStream.tsx` — chronological feed inside Build tab; reads `project_deliverables` + a new lightweight `project_story_updates` row type for inline notes (table already exists).
- New component: `src/components/project/IcoRampCard.tsx` — reads project supporter count + total backed, compares against threshold constants in `src/lib/ico-thresholds.ts` (new). When qualified, calls existing `claim_concierge_request` flow with `intake_tier='ico'`.
- `src/App.tsx`: redirects for `/charts`, `/spaces`, `/events`, `/studios`, `/discover`, `/home`. Remove `<Route>`s for ChartsPage. Remove sidebar entries in `src/config/navigation.ts`.
- ProjectDetailPage: replace tab list with Build / Backers / Team & money. Move existing Board, Story content into Build's collapsibles.
- Keep `event_*` and `studio_*` tables/RLS untouched — only the *entry points* change.

---

## Out of scope this pass

- Visual redesign of cards (we'll do that next once structure lands — saves rework).
- Tokenization wiring beyond a CTA into existing concierge flow.
- Migrations: none needed. All structural changes are routing + component-level.
- Mobile-specific tuning.

---

## Order I'll ship in

1. Cuts first (Charts page, sidebar entries, Discover tile sections, AI button) — fastest signal that the noise is gone.
2. Live Projects feed + Studio strip on the new Home.
3. Project page restructure (Build / Backers / Team & money) with Upload stream + ICO ramp card.
4. Quick polish pass.

Approve and I'll start with step 1.