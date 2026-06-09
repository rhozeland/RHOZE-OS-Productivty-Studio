
CREATE TABLE public.project_story_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  phase TEXT,
  image_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_story_updates_project ON public.project_story_updates(project_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_story_updates TO authenticated;
GRANT SELECT ON public.project_story_updates TO anon;
GRANT ALL ON public.project_story_updates TO service_role;

ALTER TABLE public.project_story_updates ENABLE ROW LEVEL SECURITY;

-- Public updates are viewable by anyone; private only by project owner + collaborators
CREATE POLICY "Story updates: public visible to all"
  ON public.project_story_updates FOR SELECT
  USING (
    is_public = true
    OR auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.project_collaborators c
      WHERE c.project_id = project_story_updates.project_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Story updates: owner/collaborators can insert"
  ON public.project_story_updates FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.project_collaborators c WHERE c.project_id = project_story_updates.project_id AND c.user_id = auth.uid())
    )
  );

CREATE POLICY "Story updates: author can update"
  ON public.project_story_updates FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Story updates: author or project owner can delete"
  ON public.project_story_updates FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid())
  );

CREATE TRIGGER trg_project_story_updates_updated_at
  BEFORE UPDATE ON public.project_story_updates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
