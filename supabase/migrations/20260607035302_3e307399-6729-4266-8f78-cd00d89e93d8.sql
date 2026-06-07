
-- Public read for project_contracts when underlying project is public
CREATE POLICY "Public projects contracts viewable"
ON public.project_contracts
FOR SELECT
TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM public.projects p
  WHERE p.id = project_contracts.project_id AND p.is_public = true
));

-- Public read for project_milestones when underlying project is public
CREATE POLICY "Public projects milestones viewable"
ON public.project_milestones
FOR SELECT
TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM public.project_contracts c
  JOIN public.projects p ON p.id = c.project_id
  WHERE c.id = project_milestones.contract_id AND p.is_public = true
));

-- Public read for project_deliverables when project is public
CREATE POLICY "Public projects deliverables viewable"
ON public.project_deliverables
FOR SELECT
TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM public.projects p
  WHERE p.id = project_deliverables.project_id AND p.is_public = true
));

-- Public read for collaborator roster when project is public
CREATE POLICY "Public projects collaborators viewable"
ON public.project_collaborators
FOR SELECT
TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM public.projects p
  WHERE p.id = project_collaborators.project_id AND p.is_public = true
));

GRANT SELECT ON public.project_contracts TO anon;
GRANT SELECT ON public.project_milestones TO anon;
GRANT SELECT ON public.project_deliverables TO anon;
GRANT SELECT ON public.project_collaborators TO anon;
