-- 1. Replace the permissive read policy with admin-only access on the base table.
DROP POLICY IF EXISTS "Authenticated can read underwriting rules"
  ON public.capital_underwriting_rules;

-- (The "Admins manage underwriting rules" ALL policy already covers admin
-- SELECT/INSERT/UPDATE/DELETE, so no replacement policy is needed for admins.)

-- 2. Public read helper for the seller-facing estimator.
--    Returns only the rule values; no writes, no audit, no metadata about
--    who last touched the row. Any authenticated user can call it because
--    the values themselves drive the estimator they see.
CREATE OR REPLACE FUNCTION public.get_active_underwriting_rules()
RETURNS TABLE (
  base_advance_ratio numeric,
  provenance_bonus_max numeric,
  tenure_floor_mult numeric,
  tenure_full_months integer,
  diversification_floor_per_work numeric,
  advance_cap numeric,
  min_settled_events integer,
  min_anchored_works integer,
  min_advance_amount numeric,
  score_weight_revenue integer,
  score_weight_provenance integer,
  score_weight_tenure integer,
  score_weight_anchored integer,
  revenue_score_target numeric,
  anchored_score_per_work numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.base_advance_ratio,
    r.provenance_bonus_max,
    r.tenure_floor_mult,
    r.tenure_full_months,
    r.diversification_floor_per_work,
    r.advance_cap,
    r.min_settled_events,
    r.min_anchored_works,
    r.min_advance_amount,
    r.score_weight_revenue,
    r.score_weight_provenance,
    r.score_weight_tenure,
    r.score_weight_anchored,
    r.revenue_score_target,
    r.anchored_score_per_work
  FROM public.capital_underwriting_rules r
  WHERE r.id = 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_active_underwriting_rules() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_active_underwriting_rules() TO authenticated;

-- 3. Admin-only update helper. Even though the table policy already restricts
--    writes to admins, this RPC gives us a single, auditable choke-point and
--    re-checks the role server-side so a misconfigured client cannot bypass
--    it. It writes through the table so the existing audit trigger still
--    fires and captures `auth.uid()` as the actor.
CREATE OR REPLACE FUNCTION public.update_underwriting_rules(_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  UPDATE public.capital_underwriting_rules SET
    base_advance_ratio              = COALESCE((_payload->>'base_advance_ratio')::numeric,              base_advance_ratio),
    provenance_bonus_max            = COALESCE((_payload->>'provenance_bonus_max')::numeric,            provenance_bonus_max),
    tenure_floor_mult               = COALESCE((_payload->>'tenure_floor_mult')::numeric,               tenure_floor_mult),
    tenure_full_months              = COALESCE((_payload->>'tenure_full_months')::integer,              tenure_full_months),
    diversification_floor_per_work  = COALESCE((_payload->>'diversification_floor_per_work')::numeric,  diversification_floor_per_work),
    advance_cap                     = COALESCE((_payload->>'advance_cap')::numeric,                     advance_cap),
    min_settled_events              = COALESCE((_payload->>'min_settled_events')::integer,              min_settled_events),
    min_anchored_works              = COALESCE((_payload->>'min_anchored_works')::integer,              min_anchored_works),
    min_advance_amount              = COALESCE((_payload->>'min_advance_amount')::numeric,              min_advance_amount),
    score_weight_revenue            = COALESCE((_payload->>'score_weight_revenue')::integer,            score_weight_revenue),
    score_weight_provenance         = COALESCE((_payload->>'score_weight_provenance')::integer,         score_weight_provenance),
    score_weight_tenure             = COALESCE((_payload->>'score_weight_tenure')::integer,             score_weight_tenure),
    score_weight_anchored           = COALESCE((_payload->>'score_weight_anchored')::integer,           score_weight_anchored),
    revenue_score_target            = COALESCE((_payload->>'revenue_score_target')::numeric,            revenue_score_target),
    anchored_score_per_work         = COALESCE((_payload->>'anchored_score_per_work')::numeric,         anchored_score_per_work),
    updated_at                      = now(),
    updated_by                      = auth.uid()
  WHERE id = 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_underwriting_rules(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_underwriting_rules(jsonb) TO authenticated;