ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS show_token_chip boolean NOT NULL DEFAULT true;