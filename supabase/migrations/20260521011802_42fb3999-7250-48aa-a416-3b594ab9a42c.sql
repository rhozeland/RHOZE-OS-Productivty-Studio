
ALTER TABLE public.flow_items
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS flow_items_archived_at_idx
  ON public.flow_items (archived_at)
  WHERE archived_at IS NULL;

-- Replace public SELECT policies so archived posts are hidden from everyone
-- except the owner (and admins, via their existing policy).
DROP POLICY IF EXISTS "Anyone can view flow items" ON public.flow_items;
DROP POLICY IF EXISTS "Public can view flow items" ON public.flow_items;

CREATE POLICY "Anyone can view active flow items"
  ON public.flow_items FOR SELECT
  TO authenticated
  USING (archived_at IS NULL OR auth.uid() = user_id);

CREATE POLICY "Public can view active flow items"
  ON public.flow_items FOR SELECT
  TO anon
  USING (archived_at IS NULL);

-- Allow owners to update their own flow posts (edit title/description, archive).
DROP POLICY IF EXISTS "Users can update own flow items" ON public.flow_items;
CREATE POLICY "Users can update own flow items"
  ON public.flow_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
