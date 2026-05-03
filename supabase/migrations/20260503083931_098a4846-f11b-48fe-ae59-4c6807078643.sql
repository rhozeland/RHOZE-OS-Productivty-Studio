
CREATE TABLE IF NOT EXISTS public.platform_fee_tiers (
  tier_id text PRIMARY KEY,
  label text NOT NULL,
  min_balance numeric NOT NULL,
  fee_bps integer NOT NULL CHECK (fee_bps BETWEEN 0 AND 5000),
  sort_order integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

CREATE TABLE IF NOT EXISTS public.platform_fee_tiers_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_by uuid NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL
);

ALTER TABLE public.platform_fee_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_fee_tiers_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fee tiers readable by authenticated" ON public.platform_fee_tiers;
CREATE POLICY "fee tiers readable by authenticated"
  ON public.platform_fee_tiers FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "fee tier audit admin read" ON public.platform_fee_tiers_audit;
CREATE POLICY "fee tier audit admin read"
  ON public.platform_fee_tiers_audit FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.platform_fee_tiers (tier_id, label, min_balance, fee_bps, sort_order) VALUES
  ('spark', 'Spark', 0,           1500, 0),
  ('bloom', 'Bloom', 1000000,     1500, 1),
  ('glow',  'Glow',  25000000,    1000, 2),
  ('play',  'Play',  50000000,    700,  3)
ON CONFLICT (tier_id) DO NOTHING;

-- Admin-only update RPC. Replaces all rows atomically + audits.
CREATE OR REPLACE FUNCTION public.update_platform_fee_tiers(_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  IF jsonb_typeof(_payload) <> 'array' THEN
    RAISE EXCEPTION 'Payload must be a JSON array of tier rows';
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(_payload) LOOP
    UPDATE public.platform_fee_tiers
    SET label = COALESCE(v_row->>'label', label),
        min_balance = COALESCE((v_row->>'min_balance')::numeric, min_balance),
        fee_bps = COALESCE((v_row->>'fee_bps')::int, fee_bps),
        sort_order = COALESCE((v_row->>'sort_order')::int, sort_order),
        updated_at = now(),
        updated_by = v_uid
    WHERE tier_id = v_row->>'tier_id';
  END LOOP;

  INSERT INTO public.platform_fee_tiers_audit (changed_by, payload)
  VALUES (v_uid, _payload);
END;
$$;

REVOKE ALL ON FUNCTION public.update_platform_fee_tiers(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_platform_fee_tiers(jsonb) TO authenticated;

-- Replace fee lookup to read from the table (live, no redeploy).
CREATE OR REPLACE FUNCTION public.get_platform_fee_bps(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric := 0;
  v_bps integer;
BEGIN
  SELECT COALESCE(balance, 0) INTO v_balance
  FROM public.user_credits WHERE user_id = _user_id;

  SELECT fee_bps INTO v_bps
  FROM public.platform_fee_tiers
  WHERE min_balance <= v_balance
  ORDER BY min_balance DESC
  LIMIT 1;

  RETURN COALESCE(v_bps, 1500);
END;
$$;
