
ALTER TABLE public.project_collaborators DROP CONSTRAINT IF EXISTS project_collaborators_role_check;
ALTER TABLE public.project_collaborators ADD CONSTRAINT project_collaborators_role_check CHECK (role = ANY (ARRAY['admin'::text, 'member'::text, 'owner'::text]));

CREATE OR REPLACE FUNCTION public.project_member_role(_project_id uuid, _user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.projects p WHERE p.id = _project_id AND p.user_id = _user_id) THEN 'owner'
    WHEN EXISTS (SELECT 1 FROM public.project_collaborators WHERE project_id = _project_id AND user_id = _user_id AND role = 'owner') THEN 'owner'
    ELSE (
      SELECT role FROM public.project_collaborators
      WHERE project_id = _project_id AND user_id = _user_id
      LIMIT 1
    )
  END
$function$;
