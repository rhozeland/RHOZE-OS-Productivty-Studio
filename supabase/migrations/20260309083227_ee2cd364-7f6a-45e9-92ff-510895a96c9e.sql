
CREATE TABLE public.project_smartboards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  smartboard_id UUID NOT NULL REFERENCES public.smartboards(id) ON DELETE CASCADE,
  linked_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, smartboard_id)
);

ALTER TABLE public.project_smartboards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view project smartboards they collaborate on"
ON public.project_smartboards
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.project_collaborators WHERE project_id = project_smartboards.project_id AND user_id = auth.uid())
);

CREATE POLICY "Project owners can manage smartboard links"
ON public.project_smartboards
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.project_collaborators WHERE project_id = project_smartboards.project_id AND user_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.project_collaborators WHERE project_id = project_smartboards.project_id AND user_id = auth.uid())
);
