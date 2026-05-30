ALTER TABLE public.project_approvals
  ADD COLUMN IF NOT EXISTS scope_accepted_at timestamptz;

COMMENT ON COLUMN public.project_approvals.scope_accepted_at IS
  'Set when a party explicitly accepts the Square-style scope review screen, before signing the roadmap.';