
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS external_source text,
  ADD COLUMN IF NOT EXISTS external_uid text,
  ADD COLUMN IF NOT EXISTS external_url text,
  ADD COLUMN IF NOT EXISTS external_synced_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS events_host_external_unique
  ON public.events (host_id, external_source, external_uid)
  WHERE external_source IS NOT NULL AND external_uid IS NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS luma_ics_url text,
  ADD COLUMN IF NOT EXISTS ics_last_synced_at timestamptz;
