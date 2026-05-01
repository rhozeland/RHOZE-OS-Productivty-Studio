ALTER TABLE public.project_deliverables
  ADD COLUMN IF NOT EXISTS file_url text,
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS file_size bigint,
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS file_uploaded_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_project_deliverables_content_hash
  ON public.project_deliverables (content_hash)
  WHERE content_hash IS NOT NULL;