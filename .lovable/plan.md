# Plan — Inquiry-to-Roadmap & Token Approval Gate

Two coordinated changes that tighten the business model into one rail.

---

## Part A — Inquiry → Shared Roadmap → Sign

**The problem today.** A listing inquiry lands in DMs as plain text. The creator has to manually open the project tool, build a roadmap alone, then convince the fan it matches what they asked for. There's no shared draft, no two-sided sign.

**The fix.** Introduce a `project_proposals` object that *either party* can edit until both sign, then converts into a real `project_contracts` row using the existing milestone/escrow pipeline. Nothing about milestone release or payouts changes — we're only adding the negotiation layer in front of it.

### Database

New table `project_proposals`:
- `id`, `created_by`, `client_id`, `specialist_id`, `title`, `summary`, `budget_credits` (nullable for free collabs), `currency` (`credits` | `usd`)
- `status`: `draft` | `awaiting_creator` | `awaiting_client` | `signed` | `declined` | `expired`
- `client_signed_at`, `specialist_signed_at`
- `source_listing_id` (nullable) → `marketplace_listings.id`
- `source_message_id` (nullable) → `messages.id`
- `contract_id` (nullable) → `project_contracts.id` once converted

New table `project_proposal_milestones` — same shape as `project_milestones` minus contract_id (uses `proposal_id`). Drafted by either side; locked on sign.

RPC `sign_project_proposal(_proposal_id)`:
- Marks the caller's side signed.
- When both sides signed → creates `project_contracts` row + clones milestones into `project_milestones` (pending) + nulls out the proposal's editability + writes contract_id back.

RLS: only client + specialist can read/write their proposal. Both `GRANT`s and policies included.

### UI

1. **`<ProposalSheet />`** — single sheet used everywhere. Two columns on desktop, stacked on mobile:
   - Left: editable title/summary/budget + milestone list (add/remove/edit rows).
   - Right: live preview + "Sign & send" button.
   - Header shows whose turn it is ("Waiting on Jane to review" / "Your turn to sign").
   - Once signed by both, sheet flips to a success state with a "Open project" link.

2. **Entry points** (all open `<ProposalSheet />`):
   - **Listing lightbox** — replace today's "Start a project from this listing" → opens proposal pre-filled with listing title/price + the listing owner as `specialist_id`.
   - **DM thread** — new "Propose a project" button in `MessagesPage` composer; pre-fills the other participant as counterparty.
   - **SupportSheet "Work together" tab** — Commission action opens proposal (replaces the current `sessionStorage.newProjectPrefill` → NewProjectDialog hack).
   - **`/concierge` page** — concierge requests stay as their own intake; unchanged.

3. **Inbox surface** — `MessagesPage` Projects tab gets a "Proposals" group above active projects: rows show "Awaiting your signature" / "Awaiting their signature" with one-tap open.

### Notifications

On status change, insert into `notifications` (already exists): "Jane sent you a project proposal", "Mark signed your proposal — your turn", "Project locked — work starts now".

---

## Part B — Token Approval Gate

Today any Verified Artist can paste a `token_mint_address` into Settings and it instantly shows on their profile. You want a one-click admin approval in between.

### Database

Add to `profiles`:
- `token_submission_status`: `none` | `pending` | `approved` | `rejected`
- `token_submitted_at`, `token_reviewed_at`, `token_review_note`

Trigger `enforce_token_approval`:
- When `token_mint_address` is set/changed by a non-admin, status flips to `pending` and the new value is stored in a shadow column `token_mint_address_pending` (not on `token_mint_address` until approved).
- Admin RPC `approve_token_submission(_user_id, _approve bool, _note)` moves it to live or rejects.

### UI

1. **Settings → Verified IP** — token field now shows status pill ("Pending review" / "Approved" / "Rejected — {note}"). Submit button text becomes "Submit for review".
2. **`/admin?tab=tokens`** — new `<AdminTokenSubmissions />` table: pending rows with creator card, ticker, mint address (copy button), "Approve" / "Reject with reason" buttons.
3. **Profile `<TokenDiscoveryChip />`** — only renders when `token_submission_status === 'approved'`. Verified Artists with pending submissions see a private "Awaiting review" badge in their own Settings only.

---

## Sequencing

Ship in this order so each step is reviewable:

1. Migration: `project_proposals` + `project_proposal_milestones` + RLS + RPC.
2. `<ProposalSheet />` component + wire into ListingLightbox + DM composer + SupportSheet.
3. Inbox proposals group in MessagesPage.
4. Migration: token approval columns + trigger + admin RPC.
5. Settings status pill + AdminTokenSubmissions tab.
6. Memory update (v10.4 framing).

---

## Out of scope (intentionally)

- Public projects + backers (next round, will reuse the same contract/milestone primitives).
- Reframing Concierge as headline offer (next round).
- Changes to milestone release, escrow, payouts, or platform fee — all stay as-is.
- DM gating, subscription tiers, gradient system — untouched.

---

## Technical notes

- `project_proposals` uses the same role split as `project_contracts` (client = funder, specialist = creator) so conversion is trivial.
- The signed proposal becomes immutable; further changes happen on the resulting `project_contracts` like today.
- Token shadow column lets the trigger be additive — no risk to existing approved tokens.
- All new tables ship with explicit `GRANT`s to `authenticated` + `service_role` (no `anon` — proposals are auth-only).

Want me to start with step 1 (migration), or revise the plan first?
