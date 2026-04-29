
# Rhozeland 2.0 — Spaces & People

A strategic restructure. The app stops being a "social productivity feed" and becomes a **discovery + matchmaking marketplace** where every interaction starts with either *finding a space* or *finding a person*. Tools like Flow, Drop Rooms, and Smartboards stop competing for attention in the nav — they live inside Projects as collaboration utilities.

---

## The new mental model

```text
                       RHOZELAND APP
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
     SPACES               PEOPLE              PROJECTS
   (Physical /         (Talent +           (where work
    Digital toggle)     Matchmaking)        actually happens)
        │                    │                    │
   ┌────┴────┐          ┌────┴────┐         ┌─────┴─────┐
   Studios   Digital    Browse    Brand     Flow  Drop   Smart
  (vetted)   Rooms      directory briefs   Mode  Rooms  boards
                                  (broker            (now utilities)
                                   + algo)
```

**Spaces** = where creation happens (a studio you book, or a digital room you join).
**People** = who you create with (browse, get matched, or brief Rhozeland to broker).
**Projects** = the container where collaboration tools live, after a match or booking turns into actual work.

---

## Pillar 1 — Spaces (Physical / Digital toggle)

A single `/spaces` hub with a prominent toggle:

- **Physical** — the existing Studios catalog, repositioned as Rhozeland-vetted partner venues (recording, photo, video, beauty bars, etc.). This is the "creative agency" surface investors saw.
- **Digital** — Drop Rooms reframed as bookable digital spaces (live A/V rooms, async collab rooms, brand activation rooms). Same primitive, marketing flips from "ephemeral hangout" to "your digital studio."

Filters apply to both: vertical (Beauty / Fashion / Music / Marketing / Other), region, capacity, price.

---

## Pillar 2 — People (with all three matchmaking modes)

A `/people` hub that does all three matchmaking depths in parallel:

1. **Browse directory** — searchable profiles by vertical, region, language, rate. Free, DM-based. (Fast path.)
2. **Submit a brief** — brand fills a structured brief (goal, budget, region, deliverables). Two outcomes:
   - **Algorithmic matches** surface immediately (ranked profiles based on tags + reputation).
   - **Rhozeland Concierge** option on the same brief — flag it for our team to broker manually for a fee. East↔West bridge plays go through this lane.
3. **Get listed** — creators opt into the directory, set bridge interests (e.g. "open to Eastern beauty brands"), pricing, and availability.

This is where the East↔West bridging thesis lives explicitly: a region toggle + "open to cross-market collabs" flag on every profile.

---

## Pillar 3 — Projects (now the home for collab tools)

Flow Mode, Drop Rooms, and Smartboards are demoted from top-nav destinations and re-homed inside a Project workspace:

- A Project is created when a booking, brief, or hire turns into real work.
- Inside a project: **Smartboard** (the canvas), **Drop Room** (live session), **Flow** (project-scoped feed of updates/inspo), milestones, files, payments.
- Standalone `/flow`, `/drop-rooms`, `/smartboards` routes stay alive as legacy redirects → push users into "open inside a project."

For power users (creators who want a public Flow feed) we keep a "Creator Workspace" view under their profile — same components, just exposed publicly.

---

## Navigation & home changes

**New top nav (logged-in):** Home · Spaces · People · Projects · Marketplace · Messages

**New homepage (logged-in):** three big cards — *Find a Space*, *Find a Person*, *Open a Project* — plus continued-activity rail (your active projects, upcoming bookings, new matches).

**New homepage (guest):** same three cards with auth-gated CTAs. No more Flow Mode preview.

**Removed from top nav:** Flow, Drop Rooms, Smartboards, Creators Hub. (Routes preserved as redirects → Projects or People.)

---

## Phased rollout

Since you didn't pick a rollout pace, I'm proposing **three phases** so we can ship value early and adjust:

**Phase 1 — IA + Shell (this session, if approved)**
- New `/spaces` page with Physical/Digital toggle (Physical = existing Studios query, Digital = existing Drop Rooms query).
- New `/people` page with Browse tab + Brief tab (algo matches) + Concierge upgrade flag.
- Rebuild homepage around the three big cards.
- Top-nav restructure + redirects from `/flow`, `/drop-rooms`, `/smartboards`, `/creators` → new homes.
- Old Creators Hub gamification (leaderboard, journey, $RHOZE earn grid) moved into a `/people/creator-pulse` sub-tab so we don't lose it.

**Phase 2 — Projects as collab container**
- New Project workspace shell with tabs: Overview · Smartboard · Drop Room · Flow · Files · Payments.
- Migrate existing Smartboards/DropRooms/Flow posts to be project-scoped (with a "Personal" default project for backfill).

**Phase 3 — Matchmaking depth**
- Brief schema + algorithmic matching (tag overlap + reputation score).
- Concierge intake flow + admin queue for brokered intros.
- East↔West region toggle and cross-market flags on profiles + briefs.

---

## Technical notes

- **No destructive DB changes in Phase 1.** Spaces page reuses `studios` and `drop_rooms` tables. People page reuses `profiles`. Old routes stay mounted as components but render redirects.
- **Phase 2** adds a `projects` ↔ `smartboards` / `drop_rooms` / `flow_posts` relationship (nullable `project_id` columns; existing rows keep working).
- **Phase 3** adds `briefs`, `brief_matches`, `concierge_requests` tables + RLS.
- **Memory updates:** new entries for `arch/pillars-v2`, `features/spaces-hub`, `features/people-hub`, `features/projects-workspace`. Mark `creators-hub` and `flow-mode` memories as superseded (kept for reference).
- **No business-logic changes to payments, $RHOZE economy, or auth** in Phase 1 — purely a navigation/IA reshape.

---

## What I need from you to start Phase 1

Just a thumbs-up on this plan. Once approved I'll execute Phase 1 in one pass: new `/spaces`, new `/people`, new homepage, top-nav restructure, legacy redirects. Phases 2 and 3 we'd schedule as separate work blocks.
