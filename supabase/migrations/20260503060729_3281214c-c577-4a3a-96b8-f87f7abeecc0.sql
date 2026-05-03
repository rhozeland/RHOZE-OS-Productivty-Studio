
CREATE OR REPLACE FUNCTION public._coin_drops_remaining(_user uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
  v_limit integer;
  v_used integer;
BEGIN
  SELECT COALESCE(balance, 0) INTO v_balance FROM public.user_credits WHERE user_id = _user;
  IF v_balance IS NULL THEN v_balance := 0; END IF;

  -- Tier thresholds mirror src/lib/tier-matrix.ts
  IF v_balance >= 50000000 THEN
    RETURN 2147483647; -- effectively unlimited (Play)
  ELSIF v_balance >= 25000000 THEN
    v_limit := 10; -- Glow
  ELSIF v_balance >= 1000000 THEN
    v_limit := 3;  -- Bloom
  ELSE
    v_limit := 1;  -- Spark
  END IF;

  SELECT COUNT(*) INTO v_used
  FROM public.coin_launches
  WHERE creator_id = _user
    AND status != 'cancelled'
    AND created_at > now() - interval '30 days';

  RETURN GREATEST(v_limit - v_used, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public._enforce_coin_drop_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining integer;
BEGIN
  v_remaining := public._coin_drops_remaining(NEW.creator_id);
  IF v_remaining <= 0 THEN
    RAISE EXCEPTION 'Coin drop limit reached for your tier this 30-day window. Hold more $RHOZE to raise your cap.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_coin_drop_limit ON public.coin_launches;
CREATE TRIGGER enforce_coin_drop_limit
BEFORE INSERT ON public.coin_launches
FOR EACH ROW EXECUTE FUNCTION public._enforce_coin_drop_limit();
