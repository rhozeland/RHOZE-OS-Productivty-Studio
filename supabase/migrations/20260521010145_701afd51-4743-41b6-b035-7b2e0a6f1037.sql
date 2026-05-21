ALTER TABLE public.works ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS works_user_archived_idx ON public.works (user_id, archived_at);

DROP POLICY IF EXISTS "Public or subscribed works are viewable" ON public.works;
CREATE POLICY "Public or subscribed works are viewable"
ON public.works
FOR SELECT
USING (
  archived_at IS NULL
  AND (
    visibility = 'public'
    OR (auth.uid() IS NOT NULL AND auth.uid() <> user_id AND is_subscribed_to(user_id))
  )
);