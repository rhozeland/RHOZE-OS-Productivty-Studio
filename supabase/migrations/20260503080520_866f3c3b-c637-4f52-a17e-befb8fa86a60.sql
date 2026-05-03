-- Anchor retry tracking on event_tickets
ALTER TABLE public.event_tickets
  ADD COLUMN IF NOT EXISTS anchor_attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS anchor_last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS anchor_last_error text,
  ADD COLUMN IF NOT EXISTS anchor_proof_id uuid REFERENCES public.contribution_proofs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS event_tickets_pending_anchor_idx
  ON public.event_tickets (anchor_last_attempt_at)
  WHERE status = 'checked_in' AND solana_signature IS NULL;

-- Allow host (event creator) to update anchor metadata on tickets for their event.
-- The existing UPDATE policy for hosts already covers this if it allows full row update.
-- (No new policy needed if "Hosts manage tickets" exists; verify by listing policies in app.)
