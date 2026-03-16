
CREATE TABLE public.project_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.project_deliverables ENABLE ROW LEVEL SECURITY;

-- Project owner can CRUD deliverables
CREATE POLICY "Project owners can manage deliverables"
  ON public.project_deliverables FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_deliverables.project_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.project_collaborators WHERE project_id = project_deliverables.project_id AND user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_deliverables.project_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.project_collaborators WHERE project_id = project_deliverables.project_id AND user_id = auth.uid())
  );
