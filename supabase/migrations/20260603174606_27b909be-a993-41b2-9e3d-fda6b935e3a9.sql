ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS spotify_url text,
  ADD COLUMN IF NOT EXISTS soundcloud_url text,
  ADD COLUMN IF NOT EXISTS bandcamp_url text,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;