ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS featured_visual_url text,
  ADD COLUMN IF NOT EXISTS featured_visual_external_url text,
  ADD COLUMN IF NOT EXISTS featured_visual_mime text,
  ADD COLUMN IF NOT EXISTS featured_visual_title text;