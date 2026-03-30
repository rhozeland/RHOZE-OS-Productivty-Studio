
CREATE OR REPLACE FUNCTION public.lookup_user_by_display_name(_name text)
RETURNS TABLE(user_id uuid, display_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.display_name
  FROM public.profiles p
  WHERE lower(p.display_name) = lower(_name)
  LIMIT 1;
$$;
