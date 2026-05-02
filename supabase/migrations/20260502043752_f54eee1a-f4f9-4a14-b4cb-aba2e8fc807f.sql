
CREATE TABLE public.flow_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_item_id uuid NOT NULL REFERENCES public.flow_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX flow_comments_item_idx ON public.flow_comments(flow_item_id, created_at DESC);
CREATE INDEX flow_comments_user_idx ON public.flow_comments(user_id);

ALTER TABLE public.flow_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flow_comments_select_all"
ON public.flow_comments FOR SELECT
USING (true);

CREATE POLICY "flow_comments_insert_own"
ON public.flow_comments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "flow_comments_delete_own_or_admin"
ON public.flow_comments FOR DELETE
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
