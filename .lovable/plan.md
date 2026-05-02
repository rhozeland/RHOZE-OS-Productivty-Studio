## Part 1 — Flow Mode: drop "Save", add "Like" + inline comments

**Swipe map (new):**
- Up = **Like** (already a `flow_interaction` action; persists, fires reward)
- Down = **Comment** (opens lightweight inline thread sheet — no modal)
- Left = **Pass** (unchanged)
- Right = **Next** (unchanged)
- Send-to-friend stays available as a small icon button on the card (no longer a swipe gesture, removes the popup-on-swipe friction).

**FlowCard action bar (bottom of card):**
- Replace `Save` button with `Like` (heart icon, filled when liked, count visible).
- Keep `Send` (icon-only, no label) — still opens existing FlowShareDialog.
- Add `Comment` button (icon + count) → opens the same inline sheet as swipe-down.

**Comment sheet:**
- New `<FlowCommentSheet />` — a bottom Sheet (not Dialog), max-h 70vh, glass background. Shows comment list + input. Reuses existing `flow_comments` table if it exists; otherwise add one.
- Compact, no popup feeling — slides up from bottom edge.

**Cleanup:**
- Remove `savePickerOpen` dialog, `smartboards` query, save→smartboard branch in `performAction`.
- Update onboarding tutorial overlay copy & idle hints (Save → Like, Share → Comment).
- Update `playSwipeSound` mapping.
- Smartboards stay reachable via Projects → Tools (unchanged).

**DB:**
- Add `flow_comments` table if not present: `id, flow_item_id, user_id, body, created_at`. RLS: read public for items in public scope; insert auth'd users; delete own or admin.
- `flow_interactions.action = 'like'` already supported; no schema change needed.

---

## Part 2 — Discover page redesign

**New top section: Globe + Featured carousel (combined hero)**

```text
┌─────────────────────────────────────────────────────────┐
│  [3D rotating globe]      │   FEATURED                  │
│   • pulsing pins per      │   ┌─────────────────────┐   │
│     region with artists   │   │  Artist · Event ·   │   │
│   • click pin → filters   │   │  Space (shuffles)   │   │
│     featured + feed       │   │  with arrows + dots │   │
│                           │   └─────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

- **3D globe**: `react-globe.gl` (uses three.js). Pins built from `profiles.region_code` aggregated counts. Clicking a pin sets `marketFilter` AND filters the carousel.
- **Featured carousel**: shuffles between featured artist, featured event, featured space. Auto-advances every 6s, manual arrows + dot indicators. Each slide styled per type, all clickable.
- Place at top of Discover, replaces standalone "Featured artist" + standalone "By region" strip.

**Remove:**
- Current "Trending this week" creator row (entire section) — per user request.
- Current "By region" pill strip (replaced by globe).
- `<TrendingArtistsLane />` — gone for now (memory-noted).

**Keep + upgrade: Fresh works → infinite scroll**
- Keep tile grid styling.
- Use `useInfiniteQuery` with page size 16, cursor by `created_at`. IntersectionObserver sentinel to load next page.
- Verified-IP-first ordering preserved within first batch only (subsequent pages chronological so cursor stays stable).

**Keep as-is:**
- Showing up soon (events) — small carousel below Fresh.
- Coins moving today.
- Empty state + sign-up nudge.

**New files:**
- `src/components/discover/DiscoverGlobe.tsx` — react-globe.gl wrapper, lazy-loaded via `React.lazy` so three.js doesn't bloat initial bundle.
- `src/components/discover/FeaturedCarousel.tsx` — auto-advancing carousel for artist/event/space.
- `src/components/discover/FreshWorksGrid.tsx` — extracted infinite-scroll grid.
- `src/components/flow/FlowCommentSheet.tsx` — inline comment sheet.

**Memory updates:**
- Update Flow Mode memory: Save→Like+Comment, Smartboard save removed.
- Update Discover memory: globe hero, no Trending lane.

## Technical details

**Dependencies:**
- `react-globe.gl@2.27` + `three@0.160` (already present? will verify before adding).
- No version bumps to react/framer-motion.

**Globe behavior:**
- Initial camera lat/lng centered on equator. Auto-rotate at 0.5°/s until user interacts.
- Pin size scales with artist count per region. Hover shows tooltip with region label + count.
- Mobile: globe height 280px; desktop 380px. Falls back to a static "select region" pill list if WebGL unavailable.
- Lazy loaded with Suspense + skeleton globe placeholder.

**Carousel:**
- `framer-motion` AnimatePresence + slide transition.
- Pauses auto-advance on hover.
- 3 source queries (featured artist, featured event, featured space) combined into a single slide array; randomized order on mount.

**Fresh works infinite scroll:**
- `useInfiniteQuery({ getNextPageParam: lastPage => lastPage.length === 16 ? lastPage[15].created_at : undefined })`.
- Sentinel div with IntersectionObserver triggers `fetchNextPage`.
- Verified-first sort applied to first page only to avoid cursor confusion.

**Flow comments table (if needed):**
```sql
CREATE TABLE public.flow_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_item_id uuid NOT NULL REFERENCES flow_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE flow_comments ENABLE ROW LEVEL SECURITY;
-- Read: public; Insert: auth.uid() = user_id; Delete: own row or admin.
CREATE INDEX flow_comments_item_idx ON flow_comments(flow_item_id, created_at DESC);
```
Will check if it already exists in types before migrating.
