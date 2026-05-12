## v9 — Creator-first profile refocus

The thesis: **a Rhozeland profile is a place to back a creator.** Everything else (events, spaces, drops, bookings) is *a way to support them*, not a separate destination. This plan rewires the profile around that single idea.

---

### 1. Collapse profile tabs: 4 → 3

**Before:** Overview · Support · Works · Building
**After:** **Support** (default) · **Works** · **About**

- `Building` is removed from the public profile. The data (projects this user owns) moves to the owner's private dashboard only.
- `Overview` becomes `About` — a thinner tab for bio, role, region, on-chain reputation, joined date. It's no longer the default landing.
- `?tab=support` stays the canonical default. `?tab=overview` and `?tab=building` redirect to `support`.

### 2. Support tab becomes a single backing surface

Rebuild the Support tab as a vertical stack with one primary CTA at top, in this order:

```
┌─────────────────────────────────────────┐
│  Header: name · role · Follow button    │
│                                         │
│  ╔═══════════════════════════════════╗  │
│  ║   [ Back {name} ]   ← primary CTA ║  │
│  ║   small: "How this works"         ║  │
│  ╚═══════════════════════════════════╝  │
│                                         │
│  1. Artist Shares (ProfileCoinTab)      │
│  2. Their Happenings (events + spaces)  │
│  3. Their Works (preview, 4 tiles)      │
│  4. Send a tip / DM                     │
└─────────────────────────────────────────┘
```

The standalone "Book a session" section is **removed from the profile body**. Booking lives only inside the Support CTA sheet (next section).

### 3. New `SupportCreatorSheet` — one sheet, every path

A new bottom sheet / dialog opened by the primary "Back {name}" button. It lists every way to support, in this order:

1. **Buy Artist Shares** — opens the existing TradePanel inline.
2. **Show up** — lists upcoming events + spaces hosted by this creator; tapping goes to event/space detail.
3. **Work with them** — lists their public offerings/services (existing `useProfileOfferings` data); tapping opens the existing `BookingCheckoutModal`. This replaces the dedicated "Book a session" card on the profile.
4. **Send a tip** — opens DM composer with a quick-tip preset (uses existing tip flow if present, otherwise a simple "Message" CTA).

The sheet uses the same `creator_id` everywhere, so we don't duplicate data fetches — we lift the existing queries up.

### 4. Soft-mention crypto framing

Per your pick, we keep the v9 vocabulary (Artist Shares · Platform Credits · Market Growth) but make raw token words invisible on the profile body:

- "Coin", "$RHOZE", "mint", "bonding curve" don't appear in the Support tab labels.
- A small italic "How this works →" link under the primary CTA opens `/credits?tab=how` for the curious.
- Inside the Shares section, the existing `MintAddressChip` and Market Growth % stay (people who scroll into the chart already opted into detail), but the headline copy reads "Back {name}'s career" not "Buy coin".
- The About tab keeps the on-chain reputation card (it's proof, not pitch).

### 5. About tab (slimmed Overview)

Just three blocks, no marketing:
- Bio + role + region
- Skills / specialties chips
- On-chain reputation (existing `CreatorReadinessCard` + `ContributionProofCard`)

Member-since timestamp moves here too.

### 6. Cleanup

- Remove `Building` tab + its `TabsContent` block from `ProfileDetailPage.tsx`.
- Remove the standalone profile booking card / "Book a session" entry point (the modal component stays — it's reused inside the sheet).
- Update `?tab=` deep-link redirect map: `building` → `support`, `coin` → `support` (already), `overview` → `about`.
- Update memory: `mem://features/profiles` + Core index entry to v9 framing.

### Technical notes

- New file: `src/components/profile/SupportCreatorSheet.tsx` (Sheet from `@/components/ui/sheet`, sections lazy-render). Reuses `ProfileCoinTab`, `BookingCheckoutModal`, and event/space query hooks already in the file.
- Edit: `src/pages/ProfileDetailPage.tsx` — tab list, default value, redirect map, primary CTA, remove Building + standalone booking card, About tab content.
- Edit: `src/components/RhozeInfoPopover.tsx` copy (already uses "Artist Shares" / "Platform Credits" — no change needed, just verify).
- No DB / RLS / edge function changes. Pure frontend.

### Out of scope (call out next, if you want)

- Reframing Discover lanes around "Back a creator" verbs.
- Removing the public Building/Projects route entirely.
- A homepage rewrite around the new thesis.
- Renaming the `?tab=support` slug to `?tab=back` (would break inbound links — defer).
