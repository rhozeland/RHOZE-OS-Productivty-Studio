
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS linked_token_mint text,
  ADD COLUMN IF NOT EXISTS linked_token_ticker text,
  ADD COLUMN IF NOT EXISTS linked_token_name text,
  ADD COLUMN IF NOT EXISTS linked_token_image_url text;

ALTER TABLE public.works
  ADD COLUMN IF NOT EXISTS linked_token_ticker text,
  ADD COLUMN IF NOT EXISTS linked_token_name text,
  ADD COLUMN IF NOT EXISTS linked_token_image_url text;
