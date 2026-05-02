CREATE OR REPLACE FUNCTION public.create_project_with_owner(
  _title text,
  _description text DEFAULT NULL,
  _vision text DEFAULT NULL,
  _scope_of_work text DEFAULT NULL,
  _project_type text DEFAULT 'standard',
  _status text DEFAULT 'active',
  _cover_color text DEFAULT '#7c3aed'
)
RETURNS public.projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _project public.projects;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to create a project.' USING ERRCODE = '42501';
  END IF;

  IF _title IS NULL OR btrim(_title) = '' THEN
    RAISE EXCEPTION 'Project title is required.' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.projects (
    user_id,
    title,
    description,
    vision,
    scope_of_work,
    project_type,
    status,
    cover_color
  )
  VALUES (
    _uid,
    btrim(_title),
    NULLIF(btrim(_description), ''),
    NULLIF(btrim(_vision), ''),
    NULLIF(btrim(_scope_of_work), ''),
    COALESCE(NULLIF(btrim(_project_type), ''), 'standard'),
    COALESCE(NULLIF(btrim(_status), ''), 'active'),
    COALESCE(NULLIF(btrim(_cover_color), ''), '#7c3aed')
  )
  RETURNING * INTO _project;

  RETURN _project;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_project_with_owner(text, text, text, text, text, text, text) TO authenticated;