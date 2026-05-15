
-- Referral codes table
CREATE TABLE public.referral_codes (
  code TEXT PRIMARY KEY,
  reward_rhoze INTEGER NOT NULL CHECK (reward_rhoze > 0),
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active codes readable by authenticated"
  ON public.referral_codes FOR SELECT
  TO authenticated
  USING (active = true);

CREATE POLICY "Admins manage codes"
  ON public.referral_codes FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Redemptions table (one redemption per user)
CREATE TABLE public.referral_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  code TEXT NOT NULL REFERENCES public.referral_codes(code),
  reward_rhoze INTEGER NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own redemption"
  ON public.referral_redemptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Redemption RPC: validates and credits the user atomically
CREATE OR REPLACE FUNCTION public.redeem_referral_code(_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_code TEXT;
  v_reward INTEGER;
  v_max INTEGER;
  v_used INTEGER;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  v_code := upper(trim(_code));

  -- Already redeemed?
  IF EXISTS (SELECT 1 FROM public.referral_redemptions WHERE user_id = v_user) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_redeemed');
  END IF;

  SELECT reward_rhoze, max_uses, used_count
    INTO v_reward, v_max, v_used
  FROM public.referral_codes
  WHERE code = v_code AND active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  IF v_max IS NOT NULL AND v_used >= v_max THEN
    RETURN jsonb_build_object('ok', false, 'error', 'code_exhausted');
  END IF;

  -- Credit the user
  INSERT INTO public.user_credits (user_id, balance)
  VALUES (v_user, v_reward)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = public.user_credits.balance + v_reward,
        updated_at = now();

  -- Log redemption
  INSERT INTO public.referral_redemptions (user_id, code, reward_rhoze)
  VALUES (v_user, v_code, v_reward);

  -- Increment usage counter
  UPDATE public.referral_codes
  SET used_count = used_count + 1, updated_at = now()
  WHERE code = v_code;

  -- Log a credit transaction if the table exists
  BEGIN
    INSERT INTO public.credit_transactions (user_id, amount, kind, note)
    VALUES (v_user, v_reward, 'referral', 'Referral code: ' || v_code);
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    NULL;
  END;

  RETURN jsonb_build_object('ok', true, 'reward', v_reward, 'code', v_code);
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_referral_code(TEXT) TO authenticated;

-- Seed SHOPIFY code (deactivated — re-enable when needed)
-- INSERT INTO public.referral_codes (code, reward_rhoze, max_uses, active, note)
-- VALUES ('SHOPIFY', 100000, NULL, true, 'Shopify presentation — 2026-05-10');
