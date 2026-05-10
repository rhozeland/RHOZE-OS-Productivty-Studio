# Creator-First Refocus (v8.9)

**Thesis shift:** The creator is the atomic unit. Events, Spaces, and Offerings are *ways to back a creator you already care about* — not standalone destinations. Discovery still surfaces all of it, but framed around artists.

Soft simplification — Rooms structure (Scene / Market / Vault) stays. Creator Pass stays prominent. Events keeps a discovery role *inside* Discover.

---

## 1. Discover (Scene Room) — lead with creators

- **Featured carousel** (`FeaturedCarousel`) re-weighted: Artists become the primary card type. Events and Spaces still rotate in but tagged as *"by {creator}"* — the artist is the headline, the event/space is the supporting detail.
- **Add "Trending Artists" lane back** as the first lane under the globe (component already exists: `TrendingArtistsLane`). It was removed in v7.5 — bring it back as the lead lane.
- **Stream toggle** (All / Events / Flow): rename **Events → "Happening"**, keep the filter, but reframe copy as "events from artists you're discovering." No mechanical change, just framing.
- **Mosaic** stays, but Offering / Space / Event cards get a more prominent *creator chip* at the top of each card so the artist reads first.

## 2. Profile becomes the support hub

The Support tab already holds Follow/Message/Book + ProfileCoinTab. Extend it so a fan sees **every way to back this creator** in one place:

- **New section: "Upcoming events"** — events this creator is hosting or featured in (query `event_collaborators` + `events.host_id`).
- **New section: "Spaces"** — studios/spaces this creator hosts (already partially done on space detail; invert it).
- **Existing:** Offerings (services), Coin, Book session.
- Order: Book → Tickets/Events → Offerings → Coin → Spaces. Most-direct support first.

This is the highest-leverage change — it's where the new thesis becomes real for fans.

## 3. Demote Events/Spaces standalone browse

- `/events` Luma-style explore page → keep mounted (deep links exist) but **remove from any nav surface**. Audit: side nav, top bar, ⌘K, landing page, dashboard CTAs, conversations right rail.
- `/spaces`, `/studios` browse → same treatment. Detail routes (`/spaces/events/:id`, `/studios/:id`) stay fully live.
- Conversations right rail (xl+) currently has Events/Spaces/Artists tabs → collapse to **Artists only**. Events and Spaces in that rail were redundant with Discover.
- ⌘K palette: Artists results bumped to top; Events/Spaces still searchable but ranked below.

## 4. Market Room — reframe as "Creator Services"

`MarketRoomPage` currently has 3 category tiles: Studio Booking, Gigs & Jobs, Services. Re-order and re-label so the creator-as-seller reads first:

- **Services** (hire creators) → first tile, larger
- **Studio Booking** → second
- **Gigs & Jobs** → third

Header copy: "Room 2 · The Market" → keep, but subtitle becomes "Hire creators · book their spaces · open calls."

## 5. Landing page

- Hero copy already says "Own a piece of the artists you love" — good.
- Remove any Events/Spaces standalone CTAs from the landing one-pager. Single primary CTA → "Discover artists."
- Keep tier ladder + how-it-works.

## 6. Routes / redirects

No route deletions — preserve every deep link. Add soft redirects:

- `/events` (no params) → `/discover?view=events` (already exists as a deep-link alias)
- `/spaces`, `/studios` (no params) → `/discover?kind=space` (already exists)

Confirms what `Navigation v8` memory already documents — we just stop *promoting* these in nav.

---

## Technical notes

- **Files touched (presentation only):**
  - `src/components/AppSidebar.tsx` — audit for any Events/Spaces top-level entries (should be none per v8.5, verify).
  - `src/pages/DiscoverPage.tsx` — re-add `TrendingArtistsLane`, re-weight `FeaturedCarousel`.
  - `src/components/discover/FeaturedCarousel.tsx` — bias toward artist cards (read existing logic, then adjust shuffle weights).
  - `src/components/profile/*` Support tab — add Events + Spaces sections (new sub-components, query existing tables).
  - `src/pages/MarketRoomPage.tsx` — reorder tiles, update copy.
  - `src/pages/LandingPage.tsx` — remove Events/Spaces CTAs if present.
  - `src/components/messages/*` right rail — drop Events/Spaces tabs, keep Artists.
  - `src/pages/EventsListPanel.tsx`, `src/pages/SpacesPage.tsx`, `src/pages/StudiosPage.tsx` — leave mounted, remove nav references.
  - `src/components/CommandPalette` (or equivalent) — re-rank Artists first.

- **No DB / RLS / edge function changes.** Pure frontend reframe. Existing `event_collaborators`, `studios`, `events`, `marketplace_listings` tables already keyed to user_id.

- **Memory updates after ship:**
  - Update `mem://index.md` Core with Navigation v8.9 framing.
  - Update `mem://arch/navigation-v8` → v8.9.
  - Update `mem://features/profiles` to document Support tab Events + Spaces sections.

---

## Out of scope (explicit)

- Rooms structure (Scene / Market / Vault) — stays untouched.
- Creator Pass / `/credits` — stays untouched, still in Personal nav.
- $RHOZE economy, tier matrix, platform fee — no changes.
- Flow Mode — no changes.
- Any backend / migrations / edge fns.

## Risks

- **Deep links from emails / external posts** to `/events` and `/spaces` browse pages still work but feel less "first-class." Acceptable trade.
- **SEO**: if `/events` was indexed, demoting it from nav reduces internal link equity. Low concern — these aren't primary acquisition pages.
- **Profile Support tab gets long.** Mitigate with collapsible sections and only render sections that have content.

---

Ship in one pass. Rollback = revert this changeset; no data migrations.
