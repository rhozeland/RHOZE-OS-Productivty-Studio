CREATE OR REPLACE FUNCTION public.is_admin_or_curator(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::public.app_role)
      OR public.has_role(_user_id, 'curator'::public.app_role);
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin_or_curator(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin_or_curator(uuid) TO authenticated;

DROP POLICY IF EXISTS "Admins view all concierge requests" ON public.concierge_requests;
DROP POLICY IF EXISTS "Admins update concierge requests" ON public.concierge_requests;

CREATE POLICY "Curators and admins view all concierge requests"
  ON public.concierge_requests FOR SELECT
  TO authenticated
  USING (public.is_admin_or_curator(auth.uid()));

CREATE POLICY "Curators and admins update concierge requests"
  ON public.concierge_requests FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_curator(auth.uid()))
  WITH CHECK (public.is_admin_or_curator(auth.uid()));