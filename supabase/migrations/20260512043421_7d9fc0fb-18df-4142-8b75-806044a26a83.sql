ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS archetype text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_archetype_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_archetype_check
  CHECK (archetype IS NULL OR archetype IN ('artist', 'builder', 'influencer'));

CREATE INDEX IF NOT EXISTS idx_profiles_archetype
  ON public.profiles (archetype)
  WHERE archetype IS NOT NULL;