# Rhozeland v6 — Discovery Network for Independent Artists

## The 5-word pitch

**"Get discovered. Get supported. On-chain."**

Longer form, for landing & pitch decks:

> Rhozeland is a discovery + support network for independent artists.
> Fans find creators they care about, support them in any way that fits, and both sides get rewarded on-chain for the attention they create together.

## What changes in framing

| Today (v5) | New (v6) |
|---|---|
| "Decentralized productivity studio" | "Discovery network for independent artists" |
| Problem = managing creative work | Problem = nobody knows you exist & nobody buys |
| Hero promise = earn $RHOZE | Hero promise = get known, get supported |
| $RHOZE is the product | $RHOZE is the retention loop |
| Projects is a top-level pillar | Projects is a power tool inside profiles |
| Front door = Dashboard / Home acts | Front door = a creator discovery feed |
| Audience = "creators" (vague) | Audience = independent artists / musicians (sharp), architecture ready for brands |

## The four jobs Rhozeland does (in order)

1. **Get found** — feed-led discovery, profiles that read like press kits, shareable links artists actually want to send.
2. **Get cared about** — Works (verified IP), Conversations (the artist's voice), Events (real-life proof) all build belief.
3. **Get supported** — Offerings (services / merch / digital goods), Coins (skin in the game), Events (tickets), DMs (direct deals). Support can land on-platform OR off-platform via outbound links.
4. **Get rewarded** — both sides earn $RHOZE for the attention loop: creators for shipping, fans for showing up early, sharing, holding, buying. Reward = retention, not headline.

## Navigation v6 (proposed)

```text
Dock:  Discover  ·  Hub  ·  Spaces  ·  Inbox
                                       (was Projects)
```

- **Discover** (new front door, replaces Home/Dashboard split)
  - A vertical, feed-led page: hero featured artist → trending creators → fresh works → live events → coins moving today.
  - First thing a logged-out visitor sees. Same page logged in, just personalized.
  - Replaces the current "Good morning, X" dashboard as the default landing — dashboard becomes a profile sub-tab.

- **Hub** (mostly unchanged, lightly renamed)
  - Conversations · Offerings · Opportunities · Works
  - Stays the "creator activity" surface.

- **Spaces** (unchanged)
  - Physical network: Spaces · Events · Residencies.

- **Inbox** (new — replaces Projects in dock)
  - DMs + Inquiries + Collab requests in one place.
  - This is the consumer surface fans expect: "did the artist reply?".

- **Projects** demoted
  - Lives as a tab on the artist's own profile: **"Building"** (open collabs, projects in progress).
  - Full project tooling (Roadmap / Tools / Scope / Vault) stays — only the *entry point* moves.
  - Dock no longer carries it.

## Profile becomes the product

The artist profile is the highest-leverage page on the platform. It's what they share. It needs to feel like a press kit + storefront + fan club, not a settings screen.

Profile tab order (revised):

1. **Overview** — bio, links, hero work, live now (event / drop / open inquiry).
2. **Works** — verified IP grid, the proof.
3. **Offerings** — services / merch / digital goods to buy now.
4. **Coin** — `$TICKER` chart, holders, "speculate" CTA. Always visible if launched.
5. **Building** — current Projects (open collabs, public roadmap). NEW home for projects.
6. **Events** — past + upcoming.
7. **Support** — single page that surfaces every way to back this artist (buy offering, book session, hold coin, attend event, tip, off-platform links).

The "Support" tab is the single answer to *"how do I help this artist?"* — currently that answer is scattered across 5 surfaces.

## Rewards reframed (not removed)

`$RHOZE` stays, but the story changes:

- Creators earn for **shipping** (verified work, events held, sales made).
- Fans earn for **showing up early** (early follower, first holder, event attendee, sharer).
- Public-facing copy: *"Both sides get rewarded for the attention you build together."*
- Remove "earn $RHOZE" from hero copy. Move it to a single "How rewards work" page + a small badge inside the profile.

## Hackathon-ready demo arc (what a judge sees in 90 seconds)

1. **Landing** — bold one-liner: "Get discovered. Get supported. On-chain." → Discover feed visible without signup.
2. **Discover feed** — scroll a curated artist, tap their profile.
3. **Artist profile** — see their work, hear a track, see their `$TICKER`, see their offerings, see their next event.
4. **Support** — buy a beat / book a session / hold the coin in 2 taps.
5. **Reward receipt** — both buyer and creator see "+X $RHOZE for early support" on-chain memo.

That's the loop. Five surfaces, one story.

## What stays exactly as-is

- Spaces hub, Events, Residencies.
- Hub lanes (Conversations / Offerings / Opportunities / Works).
- Launchpad mechanics, coin gating to Verified IP.
- Solana anchoring of Works, contributions, splits.
- Auth, RLS, wallet binding, all backend logic.

## Technical scope (rough phasing — for the build call later)

**Phase 1 — Framing (no schema changes, ~UI + copy only)**
- Rewrite landing hero, meta tags, onboarding copy, dashboard greeting copy.
- New `/discover` route as the new index; old `/` redirects there.
- Move Projects out of dock; add `Inbox` dock entry that wraps existing messages + inquiries.
- Add a "Building" tab on profile that lists the user's own Projects.

**Phase 2 — Discover feed**
- Server-side ordered feed query: featured artists → trending creators (by recent activity) → fresh verified works → live events → moving coins.
- Tap-through cards land on profile, not on standalone subpages.

**Phase 3 — Profile as product**
- Reorder tabs, add **Support** tab that aggregates offerings + coin + events + tip + outbound links.
- Inline coin chart on profile (uses existing `coin_launches` data).

**Phase 4 — Rewards copy + page**
- Single `/rewards` explainer.
- Strip $RHOZE from primary CTAs everywhere.

No DB schema changes are required for Phases 1–3. Phase 4 may add a small `outbound_links` table on profiles (off-platform support targets).

## Open call to make before we build

Two more decisions I'd want locked before writing code:

1. **Discover sort logic** — pure recency, editorial curation (admin-picked), or algorithmic (verified IP × engagement × recency)? My recommendation: **editorial featured slot + algorithmic below**, so we can hand-pick a hero artist for the demo.
2. **What replaces "Dashboard"?** — I'd fold creator stats (sales, followers, coin holders, $RHOZE earned) into a new **"Studio"** sub-tab on the user's own profile, viewable only by them. Removes the orphan "/dashboard" route entirely. OK to proceed that way?

Answer those in chat and I'll move to the implementation plan.