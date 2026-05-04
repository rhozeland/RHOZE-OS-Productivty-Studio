
# Event Ticket Flow Polish

Goal: a Luma-grade buying experience for first-time visitors. They give us name + email, pay (or RSVP / request), get an emailed ticket, and a Rhozeland account is created in the background. Ticket lives in Creator Pass under a new **Tickets** tab.

---

## 1. Guest checkout with passwordless account creation

**New unified `EventCheckoutSheet`** replaces the current paid-only `TicketCheckoutDialog`. Handles all three modes (Free RSVP, Request to Join, Paid USD/$RHOZE) in one consistent two-step sheet:

- **Step 1 — Your info** (always shown for guests):
  - Name *
  - Email *
  - Trust strip: "We'll create your free Rhozeland account so you can access your ticket and pass anytime."
- **Step 2 — Confirm / Pay**:
  - Free → big "Confirm RSVP" button
  - Request → "Send request" button (host approves later)
  - Paid → existing Square card form / Pay with $RHOZE tabs

If the user is already signed in: skip Step 1, prefill from profile.

**Account creation** — on submit, call new edge function `claim-event-ticket`:
1. Look up user by email. If none, create auth user via service role (`email_confirm: false`, random password) + matching `profiles` row (display_name from name).
2. Send Supabase magic link to that email so they can sign in (`signInWithOtp`).
3. Issue the ticket row owned by that user_id.
4. Return ticket id + a one-shot ticket link signed with the user's email so guests can view their ticket immediately without waiting for the magic link.

For paid flows, payment (Square charge / $RHOZE verify) happens client-side first, then `claim-event-ticket` is called with the verified payment reference. Same settlement logic as today (tier-based platform fee).

---

## 2. Two new ticket modes

DB additions on `event_ticket_tiers`:
- `tier_kind` enum: `paid` | `free_rsvp` | `request`
- existing price columns ignored when `tier_kind != 'paid'`

DB additions on `event_tickets`:
- `status` already exists — extend with `'pending_approval'` for request mode
- `requested_at`, `approved_at`, `approved_by` nullable

Host-side: `EventManagePage` gets a "Pending requests" panel where they Approve/Decline (approve flips status → `issued` and triggers ticket-issued email).

---

## 3. Tickets tab in Creator Pass

`/credits?tab=tickets` — new tab between "My Pass" and "Purchases":
- Grid of upcoming tickets (cover image, event title, date, venue)
- Click → existing `/tickets/:id` detail page (already has QR + 3D pass)
- Empty state: "No tickets yet. Browse events →" linking to /discover?view=events
- Past tickets collapsed below in a "Past events" accordion

Also add a small "View tickets" link inside Purchases tab pointing here, so it's discoverable both ways.

---

## 4. Email confirmation

Single transactional template: `event_ticket_confirmation`
- Subject: "You're in — {{event.title}}"
- Body: event date/venue, big "View your ticket" button (deep link to `/tickets/:id`), QR fallback as inline image, plus "Sign in to Rhozeland" magic-link CTA for new accounts.

Sent from `claim-event-ticket` after successful issue.

---

## 5. Out of scope (this pass)

- Host custom form builder (skipping per your call — saved as a follow-up)
- Apple Wallet pass changes (keep existing `generate-apple-wallet-pass`)
- Refund flow

---

## Technical details

**Files added**
- `src/components/events/EventCheckoutSheet.tsx` — unified sheet, replaces TicketCheckoutDialog at all call sites
- `src/components/credits/TicketsTab.tsx` — list of user's tickets
- `src/components/events/EventRequestsPanel.tsx` — host approval UI
- `supabase/functions/claim-event-ticket/index.ts` — guest-or-user account + ticket issuance + email enqueue
- `supabase/functions/_shared/transactional-email-templates/event-ticket-confirmation.tsx`

**Files modified**
- `src/pages/CreditShopPage.tsx` — add Tickets tab
- `src/pages/EventDetailPage.tsx` — wire new sheet, show tier_kind correctly
- `src/pages/EventManagePage.tsx` — pending requests panel
- `src/components/events/TicketCheckoutDialog.tsx` — kept as thin wrapper or deleted (call sites updated)
- transactional email registry → register new template

**Migration**
- Add `tier_kind` enum + column on `event_ticket_tiers` (default `'paid'` for backfill)
- Add `requested_at`, `approved_at`, `approved_by` on `event_tickets`
- Extend `event_tickets.status` allowed values (it's already text, just docs)
- RLS: host can update status of `pending_approval` rows on their events; ticket holder can read their own rows (already covered)

**Security**
- `claim-event-ticket` validates email format, checks tier capacity, verifies payment reference server-side for paid mode (calls existing `verify-rhoze-payment` or trusts Square payment_id we just created with the user's session — same trust model as today).
- Service-role user creation only happens after payment is confirmed for paid tiers, so no spam-account vector.

---

## Build order

1. Migration (tier_kind + request fields)
2. `claim-event-ticket` edge function + email template
3. `EventCheckoutSheet` (replaces TicketCheckoutDialog)
4. Wire into EventDetailPage
5. Tickets tab in Creator Pass
6. Host requests panel in EventManagePage
7. Smoke test the three flows in browser

Estimated ~1 build cycle. Ready to ship on your go-ahead.
