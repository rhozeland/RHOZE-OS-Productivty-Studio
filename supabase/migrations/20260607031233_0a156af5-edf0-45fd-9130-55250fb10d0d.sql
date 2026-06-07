
-- Add cover_image_url to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS cover_image_url text;

-- Update create_project_with_owner to accept cover image url
CREATE OR REPLACE FUNCTION public.create_project_with_owner(
  _title text,
  _description text DEFAULT NULL,
  _vision text DEFAULT NULL,
  _scope_of_work text DEFAULT NULL,
  _project_type text DEFAULT 'standard',
  _status text DEFAULT 'active',
  _cover_color text DEFAULT '#7c3aed',
  _cover_image_url text DEFAULT NULL
)
RETURNS public.projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  IF _cover_image_url IS NULL OR btrim(_cover_image_url) = '' THEN
    RAISE EXCEPTION 'A project cover image is required.' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.projects (
    user_id, title, description, vision, scope_of_work,
    project_type, status, cover_color, cover_image_url
  )
  VALUES (
    _uid, btrim(_title), _description, _vision, _scope_of_work,
    _project_type, _status, _cover_color, _cover_image_url
  )
  RETURNING * INTO _project;

  RETURN _project;
END;
$function$;

-- Allow uploads to listing-media folder 'project-covers/<uid>/...' by owner
DO $$ BEGIN
  CREATE POLICY "Users upload own project covers"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'listing-media'
    AND (storage.foldername(name))[1] = 'project-covers'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users update own project covers"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'listing-media'
    AND (storage.foldername(name))[1] = 'project-covers'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
