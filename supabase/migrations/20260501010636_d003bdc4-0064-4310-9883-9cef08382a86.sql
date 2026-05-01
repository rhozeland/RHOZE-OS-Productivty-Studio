ALTER TABLE public.project_deliverables
  ADD COLUMN IF NOT EXISTS solana_signature text,
  ADD COLUMN IF NOT EXISTS anchored_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_project_deliverables_solana_signature
  ON public.project_deliverables(solana_signature)
  WHERE solana_signature IS NOT NULL;