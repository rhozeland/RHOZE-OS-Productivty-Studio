
-- Allow users to update their own smartboard items (needed for resize)
CREATE POLICY "Users can update own items"
  ON public.smartboard_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
