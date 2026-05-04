-- Add ticket modes and approval workflow
ALTER TYPE event_ticket_status ADD VALUE IF NOT EXISTS 'pending_approval';
ALTER TYPE event_ticket_status ADD VALUE IF NOT EXISTS 'declined';

ALTER TABLE public.event_ticket_tiers
  ADD COLUMN IF NOT EXISTS tier_kind text NOT NULL DEFAULT 'paid'
    CHECK (tier_kind IN ('paid','free_rsvp','request'));

ALTER TABLE public.event_tickets
  ADD COLUMN IF NOT EXISTS guest_name text,
  ADD COLUMN IF NOT EXISTS guest_email text,
  ADD COLUMN IF NOT EXISTS requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid;

-- Backfill: any tier with price 0 → free_rsvp; rest stay paid
UPDATE public.event_ticket_tiers
SET tier_kind = 'free_rsvp'
WHERE (COALESCE(price_usd,0) = 0 AND COALESCE(price_rhoze,0) = 0)
  AND tier_kind = 'paid';

-- Allow hosts/collaborators to update ticket status (approve/decline pending requests).
-- Policy already exists for collaborators ("Collaborators update tickets") via can_manage_event,
-- so no new policy needed — verify by listing existing policies.
COMMENT ON COLUMN public.event_ticket_tiers.tier_kind IS
  'paid | free_rsvp | request — drives checkout UX';
COMMENT ON COLUMN public.event_tickets.guest_name IS
  'Captured from guest checkout before account creation';
