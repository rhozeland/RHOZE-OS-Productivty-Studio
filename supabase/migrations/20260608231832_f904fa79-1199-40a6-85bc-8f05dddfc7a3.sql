CREATE TABLE public.flow_reposts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flow_item_id uuid NOT NULL REFERENCES public.flow_items(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, flow_item_id)
);

CREATE INDEX flow_reposts_user_idx ON public.flow_reposts (user_id, created_at DESC);
CREATE INDEX flow_reposts_item_idx ON public.flow_reposts (flow_item_id);

GRANT SELECT ON public.flow_reposts TO anon;
GRANT SELECT, INSERT, DELETE ON public.flow_reposts TO authenticated;
GRANT ALL ON public.flow_reposts TO service_role;

ALTER TABLE public.flow_reposts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reposts"
  ON public.flow_reposts FOR SELECT
  USING (true);

CREATE POLICY "Users can repost"
  ON public.flow_reposts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own reposts"
  ON public.flow_reposts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
