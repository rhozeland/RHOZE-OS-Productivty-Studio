ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_type text
    CHECK (user_type IN ('fan','creator'));