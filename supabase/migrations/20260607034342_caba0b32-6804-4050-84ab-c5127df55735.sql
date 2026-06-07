
CREATE TABLE public.project_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX project_comments_project_idx ON public.project_comments(project_id, created_at DESC);
GRANT SELECT ON public.project_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_comments TO authenticated;
GRANT ALL ON public.project_comments TO service_role;
ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments visible on public projects"
  ON public.project_comments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_comments.project_id AND p.is_public = true));
CREATE POLICY "Authenticated users can comment on public projects"
  ON public.project_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.is_public = true));
CREATE POLICY "Users can delete own comments"
  ON public.project_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
