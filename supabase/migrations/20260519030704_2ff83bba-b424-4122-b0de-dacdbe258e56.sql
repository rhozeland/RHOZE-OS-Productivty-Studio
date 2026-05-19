-- Phase B2: Self-serve Featured Boost

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS featured_tier text;

CREATE TABLE IF NOT EXISTS public.featured_boost_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  sku text NOT NULL,
  credits_spent numeric NOT NULL,
  usd_equivalent numeric NOT NULL,
  duration_hours integer NOT NULL,
  tier text NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fbp_user ON public.featured_boost_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_fbp_expires ON public.featured_boost_purchases(expires_at);

ALTER TABLE public.featured_boost_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers can view their own boost purchases"
  ON public.featured_boost_purchases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all boost purchases"
  ON public.featured_boost_purchases FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- RPC: purchase a boost SKU. Debits credits, extends featured_pin_until,
-- writes audit row. Returns the new expires_at.
CREATE OR REPLACE FUNCTION public.purchase_featured_boost(_sku text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_credits numeric;
  v_usd numeric;
  v_hours integer;
  v_tier text;
  v_balance numeric;
  v_now timestamptz := now();
  v_current_pin timestamptz;
  v_new_pin timestamptz;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- SKU catalog (kept in DB so we can change pricing without redeploy)
  IF _sku = 'featured_24h' THEN
    v_credits := 1500; v_usd := 15; v_hours := 24; v_tier := 'featured';
  ELSIF _sku = 'featured_7d' THEN
    v_credits := 7500; v_usd := 75; v_hours := 168; v_tier := 'featured';
  ELSIF _sku = 'globe_pin_24h' THEN
    v_credits := 3000; v_usd := 30; v_hours := 24; v_tier := 'globe';
  ELSE
    RAISE EXCEPTION 'Unknown boost SKU: %', _sku;
  END IF;

  -- Check balance
  SELECT balance INTO v_balance
    FROM public.user_credits WHERE user_id = v_user FOR UPDATE;
  IF v_balance IS NULL OR v_balance < v_credits THEN
    RAISE EXCEPTION 'Insufficient credits (need % $RHOZE)', v_credits;
  END IF;

  -- Debit
  PERFORM public.adjust_user_credits(
    v_user, -v_credits, 'spend', 'Profile boost: ' || _sku, 'credits'
  );

  -- Stack on top of existing pin if active
  SELECT featured_pin_until INTO v_current_pin
    FROM public.profiles WHERE user_id = v_user;
  v_new_pin := GREATEST(COALESCE(v_current_pin, v_now), v_now) + make_interval(hours => v_hours);

  UPDATE public.profiles
    SET featured_pin_until = v_new_pin,
        featured_tier = v_tier
    WHERE user_id = v_user;

  INSERT INTO public.featured_boost_purchases
    (user_id, sku, credits_spent, usd_equivalent, duration_hours, tier, expires_at)
    VALUES (v_user, _sku, v_credits, v_usd, v_hours, v_tier, v_new_pin);

  RETURN jsonb_build_object(
    'success', true,
    'expires_at', v_new_pin,
    'tier', v_tier,
    'credits_spent', v_credits
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.purchase_featured_boost(text) TO authenticated;