# Spaces 2.0 — Spaces · Events · Residencies

## What we're building

Rename `/studios` → `/spaces` and turn it into the home of the **physical-and-gathered network** with three tabs:

- **Spaces** — existing studios marketplace (no behavioral change)
- **Events** — new: hosting, RSVP + paid ticketing, on-chain provenance
- **Residencies** — placeholder tab with a "Coming soon" state

Anyone authenticated can host. Tickets sell in fiat (Square) or $RHOZE, mirroring Projects (10% platform fee). Events get the full IP-anchoring treatment: manifest hash at publish, optional post-event artifact hashes, and proof-of-attendance hashes per ticket.

## Why anchoring an event makes sense

An event isn't a file, but its *terms* and *outputs* are. Three anchor layers, each reusing the existing `contribution_proofs` + `anchor-contribution` infra:

1. **Manifest** — at publish, hash a canonical JSON of `{title, host_id, starts_at, ends_at, venue, description, lineup, ticket_terms}`. One Solana memo. Proves "this event existed with these terms on this date."
2. **Artifacts** — after the event, host uploads recordings/photos/zines. Each file SHA-256'd and anchored exactly like a project deliverable, surfaced via `<VerifiedIPBadge />`.
3. **Proof-of-attendance** — when a ticket is issued, hash `{event_manifest_hash, holder_user_id, issued_at, ticket_id}`. Stored on the ticket row; one-tap "Anchor my attendance" button on the holder's ticket detail.

## URL & navigation moves

```text
/studios          → 301 redirect to /spaces?tab=spaces
/spaces           → new tabbed page (Spaces · Events · Residencies)
/spaces/events/:id          → event detail (public)
/spaces/events/new          → event create wizard
/spaces/events/:id/manage   → host dashboard (attendees, scans, payouts, artifacts)
/tickets/:id                → ticket detail (holder view, QR, anchor button)
```

Sidebar/dock label updates from "Studios" to "Spaces". Pillars v5 memory updated.

## Database (one migration)

```text
events
  id, host_id, space_id (nullable FK to studios), title, slug, description,
  cover_url, category, starts_at, ends_at, venue_name, venue_address,
  is_online, online_url, capacity, status (draft|published|cancelled|completed),
  manifest_hash, manifest_json, solana_signature, anchored_at,
  ticket_currency_modes (text[]), created_at, updated_at

event_ticket_tiers
  id, event_id, name, description, price_usd (nullable), price_rhoze (nullable),
  quantity_total, quantity_sold, sale_starts_at, sale_ends_at, is_active

event_tickets
  id, event_id, tier_id, holder_id, purchase_currency (usd|rhoze|free),
  amount_paid, payment_reference, status (issued|checked_in|refunded|cancelled),
  attendance_hash, solana_signature, anchored_at, qr_token (unique), issued_at, checked_in_at

event_artifacts
  id, event_id, uploader_id, file_url, file_name, file_size, file_type,
  sha256_hash, solana_signature, anchored_at, caption, created_at

event_check_ins  (audit trail)
  id, ticket_id, scanned_by, scanned_at, method
```

RLS sketch: events readable when `status='published'` or by host; tiers/tickets follow event visibility; tickets writable by holder for own; artifacts insertable by host or attendees with `checked_in` ticket; check-ins insertable by host only. Storage: new `event-artifacts` bucket (private, host + ticket-holders read).

## UI surfaces

**Events tab** — grid of cards (cover, title, date, venue, price-from, capacity bar). Filters: upcoming/past, free/paid, online/in-person, category. Search by title/venue.

**Event create wizard** (`InlineFormPanel` reused from the onboarding refactor):
1. Basics (title, description, category, cover)
2. When/Where (date range, venue or online URL, optional link to one of host's Spaces)
3. Tickets (add tiers; each tier picks USD, $RHOZE, or both; capacity per tier)
4. Review → Publish (computes manifest hash, anchors via `anchor-contribution`, shows Solscan link)

**Event detail page** — hero (cover, title, date, host w/ verified badge), description, ticket tiers with buy buttons, attendee count (privacy-respecting), `<VerifiedIPBadge />` for the manifest, artifacts gallery (post-event), share.

**Ticket detail** (`/tickets/:id`) — gradient gym-card style matching Creator Pass, QR for check-in, "Anchor my attendance" button → writes hash + memo, shows Solscan link once anchored.

**Host manage page** — tabs: Overview · Attendees (with check-in scanner) · Artifacts (upload + anchor) · Settlement (USD revenue, $RHOZE credited via admin gate, 10% platform fee shown). Reuses patterns from `StudioManagePage` and `ProjectScopeDeliverables`.

**Residencies tab** — single empty-state card: "Long-form residencies at member Spaces — coming soon. Want to host one? [Contact us]." No DB, no routes.

## Payments

- **Fiat** — extend the existing Square card form (`SquareCardForm`, `BookingCheckoutModal`). On success: insert `event_tickets` row, generate `qr_token`, fire `event-ticket-purchased` notification + email, deduct 10% platform fee into `credit_transactions`.
- **$RHOZE** — same pattern as Hub Offerings $RHOZE purchases: deduct from buyer's wallet via admin reward gate, credit host (75/15/10 split where applicable), insert ticket row.
- **Free RSVP** — single button, instant ticket, no payment leg.

## Anchoring integration

Reuses `anchor-contribution` edge function (no new function needed). Three new `action_type` values in `contribution_proofs`:
- `event_manifest`
- `event_artifact`
- `event_attendance`

Each writes `solana_signature` back to its host row (events / event_artifacts / event_tickets). `<VerifiedIPBadge />` already accepts a signature; we surface it on event cards, ticket cards, and the artifacts gallery.

## Notifications & email

Templates added (queued, branded): `event-published`, `event-ticket-purchased`, `event-reminder-24h`, `event-checked-in`, `event-artifact-uploaded`. All 7-day auto-purge per existing rules.

## Security

- RLS on every new table from day one.
- `qr_token` is a 24-char random nanoid; check-in endpoint validates token + host identity server-side.
- Attendance anchoring requires the holder's auth context — no third-party can anchor someone else's attendance.
- Wallet locking + 1:1 binding rules unchanged.
- Square + $RHOZE flows reuse existing audited paths; no new payment surface.

## Out of scope for this plan

- Recurring events / series
- Waitlists & refund automation (manual via host for v1)
- Co-hosts / revenue splits across multiple hosts (use existing revenue_split_configs in a follow-up)
- Residency application flow
- Calendar (.ics) export — easy follow-up
- Map view of in-person events

## File-level changes

```text
NEW
  supabase/migrations/<timestamp>_events.sql           tables, RLS, bucket, policies
  supabase/functions/event-checkin/index.ts            QR validation + attendance log
  src/pages/SpacesHubPage.tsx                          tabbed shell (Spaces|Events|Residencies)
  src/pages/events/EventsListTab.tsx
  src/pages/events/EventDetailPage.tsx
  src/pages/events/EventCreatePage.tsx
  src/pages/events/EventManagePage.tsx
  src/pages/TicketDetailPage.tsx
  src/components/events/EventCard.tsx
  src/components/events/TicketTierEditor.tsx
  src/components/events/TicketPurchaseModal.tsx        wraps Square + $RHOZE flows
  src/components/events/EventArtifactUploader.tsx      reuses content-hash + anchor pattern
  src/components/events/AttendeeCheckInScanner.tsx
  src/components/events/EventManifestPreview.tsx
  src/lib/event-manifest.ts                            canonical JSON + hash helper
  mem://features/spaces-events                          new feature memory

EDIT
  src/App.tsx                                          routes; redirect /studios → /spaces
  src/components/AppSidebar.tsx                        label "Studios" → "Spaces"
  src/components/AppLayout.tsx                         dock label
  src/config/navigation.ts                             route + label
  src/pages/StudiosPage.tsx                            becomes "Spaces" tab content (export as component)
  src/integrations/supabase/types.ts                   auto-regenerated post-migration
  mem://index.md                                       update navigation core line + add memory ref
  mem://features/studios-marketplace                   note it now lives under /spaces?tab=spaces
  mem://arch/pillars-v5                                add Events as physical-network surface
```

## Build order

1. **Migration first** — schema + RLS + storage bucket + policies, then await approval.
2. **Tabbed shell** — `/spaces` with existing studios as tab 1; redirect `/studios`.
3. **Events read path** — list + detail (no auth-gated actions yet).
4. **Event create + manifest anchoring** — wizard, hash, `anchor-contribution` call.
5. **Free RSVP tickets** — simplest ticket flow end-to-end.
6. **Paid tickets** — Square first, then $RHOZE.
7. **Host manage + check-in** — scanner + attendee list + artifact uploads with anchoring.
8. **Attendance anchoring** — holder-side button on ticket detail.
9. **Notifications + emails**.
10. **Residencies stub** + memory updates + nav parity tests.

This delivers a complete event lifecycle — publish → sell → attend → archive → verify — with provenance baked into every layer.