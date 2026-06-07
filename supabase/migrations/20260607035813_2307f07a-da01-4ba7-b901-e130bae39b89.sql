
CREATE POLICY "Public projects goals viewable"
ON public.project_goals
FOR SELECT
TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM public.projects p
  WHERE p.id = project_goals.project_id AND p.is_public = true
));

CREATE POLICY "Public projects smartboards viewable"
ON public.project_smartboards
FOR SELECT
TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM public.projects p
  WHERE p.id = project_smartboards.project_id AND p.is_public = true
));

GRANT SELECT ON public.project_goals TO anon;
GRANT SELECT ON public.project_smartboards TO anon;
