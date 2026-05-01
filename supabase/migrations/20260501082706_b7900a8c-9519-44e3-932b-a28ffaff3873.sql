-- Phase 1: bridge Flow Mode to the Works/Verified IP pipeline.
-- Every Flow upload will now carry a SHA-256 content fingerprint and can
-- progress through a verification lifecycle ending in a Solana anchor.

ALTER TABLE public.flow_items
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS solana_signature text,
  ADD COLUMN IF NOT EXISTS anchored_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS work_id uuid REFERENCES public.works(id) ON DELETE SET NULL;

-- Constrain the lifecycle states. `none` = not yet submitted (default for
-- everything new + everything historical), `pending` = creator submitted
-- for review, `verified` = admin approved + anchored, `rejected`/`changes_requested`
-- = admin asked for fixes or said no.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'flow_items_verification_status_check'
  ) THEN
    ALTER TABLE public.flow_items
      ADD CONSTRAINT flow_items_verification_status_check
      CHECK (verification_status IN ('none', 'pending', 'verified', 'rejected', 'changes_requested'));
  END IF;
END $$;

-- Index for the ambient chip lookups (we read verification_status on every
-- card render in the feed).
CREATE INDEX IF NOT EXISTS flow_items_verification_status_idx
  ON public.flow_items (verification_status)
  WHERE verification_status <> 'none';

-- Index for hash lookups (Phase 2 verification flow will reverse-search by hash).
CREATE INDEX IF NOT EXISTS flow_items_content_hash_idx
  ON public.flow_items (content_hash)
  WHERE content_hash IS NOT NULL;