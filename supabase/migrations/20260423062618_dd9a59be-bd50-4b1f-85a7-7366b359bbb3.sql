ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS flow_feed_scope text,
  ADD COLUMN IF NOT EXISTS flow_preferred_categories text[];

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_flow_feed_scope_check
  CHECK (flow_feed_scope IS NULL OR flow_feed_scope IN ('all', 'preferred'));