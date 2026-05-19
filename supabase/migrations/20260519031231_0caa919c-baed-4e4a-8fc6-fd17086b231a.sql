-- Phase B3: Verified Pro one-time upgrade

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verified_pro_at timestamptz;

CREATE OR REPLACE FUNCTION public.purchase_verified_pro()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_credits numeric := 2900;
  v_balance numeric;
  v_already timestamptz;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT verified_pro_at INTO v_already
    FROM public.profiles WHERE user_id = v_user;
  IF v_already IS NOT NULL THEN
    RAISE EXCEPTION 'Already Verified Pro';
  END IF;

  SELECT balance INTO v_balance
    FROM public.user_credits WHERE user_id = v_user FOR UPDATE;
  IF v_balance IS NULL OR v_balance < v_credits THEN
    RAISE EXCEPTION 'Insufficient credits (need % $RHOZE)', v_credits;
  END IF;

  PERFORM public.adjust_user_credits(
    v_user, -v_credits, 'spend', 'Verified Pro upgrade', 'credits'
  );

  UPDATE public.profiles
    SET verified_pro_at = now()
    WHERE user_id = v_user;

  -- Reuse boost ledger for revenue tracking
  INSERT INTO public.featured_boost_purchases
    (user_id, sku, credits_spent, usd_equivalent, duration_hours, tier, expires_at)
    VALUES (v_user, 'verified_pro', v_credits, 29, 0, 'verified_pro',
            now() + interval '100 years');

  RETURN jsonb_build_object(
    'success', true,
    'verified_pro_at', now(),
    'credits_spent', v_credits
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.purchase_verified_pro() TO authenticated;

-- Pro users skip the 15% Spark/Bloom tier; floor at 1000 bps (10%).
CREATE OR REPLACE FUNCTION public.get_platform_fee_bps(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_balance numeric := 0;
  v_bps integer;
  v_is_pro boolean := false;
BEGIN
  SELECT COALESCE(balance, 0) INTO v_balance
  FROM public.user_credits WHERE user_id = _user_id;

  SELECT verified_pro_at IS NOT NULL INTO v_is_pro
  FROM public.profiles WHERE user_id = _user_id;

  SELECT fee_bps INTO v_bps
  FROM public.platform_fee_tiers
  WHERE min_balance <= v_balance
  ORDER BY min_balance DESC
  LIMIT 1;

  v_bps := COALESCE(v_bps, 1500);

  IF COALESCE(v_is_pro, false) AND v_bps > 1000 THEN
    v_bps := 1000;
  END IF;

  RETURN v_bps;
END;
$$;