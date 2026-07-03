
-- 1) Admin SELECT policy on email_send_log for auditing
CREATE POLICY "Admins can read email send log"
ON public.email_send_log
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2) Restrict column-level SELECT on sensitive payout_details jsonb columns.
--    After this, no client role (anon/authenticated) can read the raw column
--    via `select *` or explicit projection. Retrieval must go through the
--    SECURITY DEFINER RPCs below, which enforce owner-or-admin access.
REVOKE SELECT (payout_details) ON public.withdrawal_requests FROM authenticated, anon;
REVOKE SELECT (payout_details) ON public.host_payout_requests FROM authenticated, anon;

-- 3) SECURITY DEFINER RPCs to fetch payout details on-demand.
CREATE OR REPLACE FUNCTION public.get_withdrawal_payout_details(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _details jsonb;
BEGIN
  SELECT user_id, payout_details INTO _owner, _details
  FROM public.withdrawal_requests
  WHERE id = _id;

  IF _owner IS NULL THEN
    RETURN NULL;
  END IF;

  IF auth.uid() = _owner OR has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN _details;
  END IF;

  RAISE EXCEPTION 'not authorized';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_host_payout_details(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _details jsonb;
BEGIN
  SELECT host_id, payout_details INTO _owner, _details
  FROM public.host_payout_requests
  WHERE id = _id;

  IF _owner IS NULL THEN
    RETURN NULL;
  END IF;

  IF auth.uid() = _owner OR has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN _details;
  END IF;

  RAISE EXCEPTION 'not authorized';
END;
$$;

REVOKE ALL ON FUNCTION public.get_withdrawal_payout_details(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_host_payout_details(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_withdrawal_payout_details(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_host_payout_details(uuid) TO authenticated;
