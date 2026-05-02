ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS region_code text;

-- Constrain to ISO-style 2-letter codes (uppercase) when present
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_region_code_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_region_code_check
  CHECK (region_code IS NULL OR region_code ~ '^[A-Z]{2}$');

CREATE INDEX IF NOT EXISTS idx_profiles_region_code
  ON public.profiles (region_code) WHERE region_code IS NOT NULL;