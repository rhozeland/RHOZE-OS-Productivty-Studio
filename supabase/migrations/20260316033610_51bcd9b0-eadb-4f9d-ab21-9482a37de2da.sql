
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS vision text,
  ADD COLUMN IF NOT EXISTS scope_of_work text,
  ADD COLUMN IF NOT EXISTS runtime_notes text,
  ADD COLUMN IF NOT EXISTS categories text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS project_type text DEFAULT 'standard';
