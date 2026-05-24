
-- Project-aware platform fee: honors per-project override (Concierge), else falls back to user tier
CREATE OR REPLACE FUNCTION public.get_project_platform_fee_bps(_project_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_override integer;
  v_owner uuid;
BEGIN
  SELECT platform_fee_bps_override, user_id
  INTO v_override, v_owner
  FROM public.projects
  WHERE id = _project_id;

  IF v_override IS NOT NULL THEN
    RETURN v_override;
  END IF;

  RETURN public.get_platform_fee_bps(v_owner);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_project_platform_fee_bps(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_project_platform_fee_bps(uuid) TO authenticated;

-- Convert a Concierge request into a real project (admin-only)
CREATE OR REPLACE FUNCTION public.convert_concierge_request(_request_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.concierge_requests%ROWTYPE;
  v_admin uuid := auth.uid();
  v_project_id uuid;
  v_budget_dollars numeric;
BEGIN
  IF v_admin IS NULL OR NOT public.has_role(v_admin, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can convert Concierge requests';
  END IF;

  SELECT * INTO v_req FROM public.concierge_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Concierge request not found';
  END IF;

  IF v_req.status = 'converted' AND v_req.converted_project_id IS NOT NULL THEN
    RETURN v_req.converted_project_id;
  END IF;

  IF v_req.scoped_budget_cents IS NULL OR v_req.scoped_budget_cents < 100000 THEN
    RAISE EXCEPTION 'Scoped budget must be at least $1,000 (Concierge minimum so the 25%% fee yields ≥ $250).';
  END IF;

  v_budget_dollars := v_req.scoped_budget_cents::numeric / 100;

  INSERT INTO public.projects (
    user_id, title, description, status, total_budget, is_estimate, currency,
    vision, client_name, project_type,
    intake_tier, curator_id, platform_fee_bps_override
  )
  VALUES (
    v_req.client_id,
    COALESCE(NULLIF(left(v_req.summary, 80), ''), 'Concierge project'),
    v_req.summary,
    'planning',
    v_budget_dollars,
    false,
    'USD',
    v_req.outcome,
    NULL,
    'paid',
    'concierge'::public.project_intake_tier,
    v_admin,
    2500
  )
  RETURNING id INTO v_project_id;

  UPDATE public.concierge_requests
  SET status = 'converted',
      converted_project_id = v_project_id,
      scoped_by = COALESCE(scoped_by, v_admin),
      updated_at = now()
  WHERE id = _request_id;

  RETURN v_project_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.convert_concierge_request(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.convert_concierge_request(uuid) TO authenticated;
