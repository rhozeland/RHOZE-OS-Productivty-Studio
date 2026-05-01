ALTER TABLE public.moodboard_items
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS link_url text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;

ALTER TABLE public.moodboard_items
  ALTER COLUMN file_url DROP NOT NULL,
  ALTER COLUMN file_name DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='moodboard_items'
      AND policyname='Users can update own moodboard items'
  ) THEN
    CREATE POLICY "Users can update own moodboard items"
      ON public.moodboard_items
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS moodboard_items_project_position_idx
  ON public.moodboard_items (project_id, position);