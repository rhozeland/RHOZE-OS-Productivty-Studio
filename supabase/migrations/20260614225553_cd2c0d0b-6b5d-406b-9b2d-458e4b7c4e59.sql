
REVOKE SELECT (contact_email) ON public.concierge_requests FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.get_concierge_contact_email(_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT contact_email
  FROM public.concierge_requests
  WHERE id = _id
    AND (
      client_id = auth.uid()
      OR scoped_by = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
    )
$$;

REVOKE ALL ON FUNCTION public.get_concierge_contact_email(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_concierge_contact_email(uuid) TO authenticated;
