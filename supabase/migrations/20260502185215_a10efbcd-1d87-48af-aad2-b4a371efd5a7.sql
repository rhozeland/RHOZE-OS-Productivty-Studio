ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS creator_roles text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_profiles_creator_roles ON public.profiles USING GIN (creator_roles);