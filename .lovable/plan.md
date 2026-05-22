# v10.3 — Simplify & Re-anchor

The product has drifted into too many surfaces. This loop cuts pages, collapses CTAs into one "Support" story, makes Discover scannable instead of visual-heavy, and turns Luma events into a revenue + on-chain proof funnel.

---

## 1. Money story — one CTA, layered

Every profile gets a single primary **Support {Name}** button. Two smaller chips sit beside it: **Book a call** and **Trade $TICKER** (only if creator has a token).

- **Support** opens a sheet with three rails, Subscribe is default and visually dominant:
  1. **Subscribe** — $5 / $10 / $25 monthly via Stripe (existing flow, 85/15 split). Unlocks gated works + DMs.
  2. **One-off support** — Tip $5 / $10 / custom via Stripe one-time. New flow.
  3. **Trade their coin** — Link out to pump.fun with read-only Jupiter price chip.
- **Book a call** — existing `StudioBookingModal`, 10–15% platform fee
- **Trade $TICKER** — existing `TokenDiscoveryChip` deeplink

Result: one revenue narrative on every profile. No more BackCreatorSheet vs SubscribeSheet vs ProfileCoinTab competing.

## 2. Nav — kill, merge, move

Sidebar becomes 4 tabs:

```
Home          → merged Home + Flow feed (subscribed creators first, Fresh rail below)
Discover      → dense Riipen × Dexscreener table (see §3)
Conversations → DMs + Inbox as left rail inside this page
Creator Pass  → unchanged
```

- **Kill Portfolio page** — `/portfolio` redirects to `/profile`. Works grid already lives on profile.
- **Kill Fan/Creator role switcher** — same UI for everyone, creator tools appear contextually when you have works/events.
- **Move Inbox under Conversations** — top-bar Inbox sibling removed. Inbox lives as left rail of `/messages`.
- **Merge Home + Flow** — `/home` shows subscribed creators' posts first, then a "Fresh on Rhozeland" rail. `/flow` stays as the fullscreen swipe surface, entered from a Home button.

## 3. Discover — Riipen × Dexscreener

`/discover` becomes a dense, scannable table by default. Columns:

```
Creator (avatar 32px + name + archetype dot)
Region
Subs (count)
Token ($TICKER · 24h ±%) — null if no token
Open listings (count)
Last active
[Support] button
```

- **Top 3 editorial cards** float above the table for taste (existing FeaturedCarousel, trimmed)
- **Kill blurry thumbnail cards**. If a row needs a visual, use a 40px archetype-gradient chip instead of a 400px void.
- Filter chips stay: Artist · Builder · Influencer · region · "Has token"
- Listings, open calls, events render as rows in the same table with a type pill (no separate `/market` page — that route redirects to `/discover?kind=listing`)

## 4. Luma embed + on-chain attendance

Calendar sync (ICS import/export) is out. Replace with a thinner, sharper play:

- **Profile field**: "Luma URL" (single input). Saved to `profiles.luma_url`.
- **Event embed**: when a Luma URL is on a profile, we embed the Luma event card via iframe on a new section of the profile + on `/events`. Zero scraping, zero ticket checkout (phase 1).
- **On-chain attendance** (phase 1 minimum):
  - After event end time, attendee taps "Claim attendance" on the event embed
  - We mint a Solana memo TX with `{event_url, attendee_wallet, claim_ts}` via existing memo-tx infra
  - Records to new `event_attendance_claims` table → drops $RHOZE reward → counts toward creator's "engagement score" on Discover
  - Honor system in phase 1 (no QR check-in). If abused, we add Luma OAuth in phase 2 to verify the RSVP.
- Kill `IcsImportCard`, `sync-ics-events` edge fn, `events.external_source/external_uid` cols are kept but unused.

## 5. What stays the same

- Stripe subscriptions, `creator_subscriptions` table, `is_subscribed_to()`, gated works
- Token chip + pump.fun deeplink
- Creator Pass / $RHOZE rewards mechanics
- Spaces booking + platform fee (10–15%)
- Archetypes, gradient system, onboarding

---

## Technical details

- **DB migration**: `profiles.luma_url text null`. New table `event_attendance_claims (id, user_id, luma_url, profile_id, memo_tx_signature, claimed_at)` with RLS (user_id = auth.uid()).
- **Edge fns**: new `claim-event-attendance` (writes memo + row + rewards). New `create-tip-checkout` (one-off Stripe Checkout, uses existing `payments-webhook` with a `tip` mode branch).
- **Components**:
  - New `<SupportSheet />` (3-rail tabbed sheet) — replaces `<BackCreatorSheet />` + `<SubscribeToCreatorSheet />` usage
  - New `<DiscoverTable />` — replaces `<CreatorsGrid />` as the Discover default
  - New `<LumaEventEmbed />` + new `<ClaimAttendanceButton />`
- **Routes deleted/redirected**:
  - `/portfolio` → `/profile`
  - `/market` → `/discover`
  - `/settings#calendar` removed
- **Files to retire** (kept on disk for revert):
  - `BackCreatorSheet.tsx`, `SubscribeToCreatorSheet.tsx` (callers updated to SupportSheet)
  - `IcsImportCard.tsx`, `sync-ics-events/`
  - `ConnectMatchDeck.tsx` (Match mode goes with /market)

## Build order (so we can stop anywhere and still have a working app)

1. **Nav cuts + redirects** — Portfolio kill, Inbox→Conversations, fan/creator switcher kill, sidebar to 4 tabs *(safe, no data changes)*
2. **SupportSheet + profile CTA collapse** — biggest UX win, no DB changes beyond reusing existing subscription flow
3. **Discover table** — replaces current card grid
4. **Home + Flow merge** — `/home` route reshape
5. **One-off tip checkout** — new Stripe flow
6. **Luma embed on profile + events**
7. **On-chain attendance claim** — DB + edge fn + UI

Each step is independently shippable.

## What this does NOT include

- Luma OAuth / verified RSVP (phase 2 if abused)
- QR check-in
- Paid Luma ticket reselling through Stripe (you picked embed-only)
- Any change to projects, smartboards, drop rooms, dashboard
