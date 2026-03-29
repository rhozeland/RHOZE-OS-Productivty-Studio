
-- =============================================
-- FIX 1: Remove user_credits UPDATE policy (prevent self-modification of balance)
-- =============================================
DROP POLICY IF EXISTS "Users can update own credits" ON public.user_credits;

-- Create RPC for adjusting credits (deduct/refund for bookings)
CREATE OR REPLACE FUNCTION public.adjust_user_credits(
  _user_id uuid,
  _amount numeric,
  _type text,
  _description text,
  _payment_method text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance numeric;
BEGIN
  -- Only allow the user themselves to call this
  IF auth.uid() IS NULL OR auth.uid() != _user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Validate amount
  IF _amount = 0 THEN
    RAISE EXCEPTION 'Amount cannot be zero';
  END IF;

  -- Get current balance with row lock
  SELECT balance INTO current_balance
  FROM public.user_credits
  WHERE user_id = _user_id
  FOR UPDATE;

  IF current_balance IS NULL THEN
    RAISE EXCEPTION 'No credit account found';
  END IF;

  -- If deducting, check sufficient balance
  IF _amount < 0 AND current_balance + _amount < 0 THEN
    RAISE EXCEPTION 'Insufficient credits. You have % but need %', current_balance, ABS(_amount);
  END IF;

  -- Update balance
  UPDATE public.user_credits
  SET balance = balance + _amount, updated_at = now()
  WHERE user_id = _user_id;

  -- Record transaction
  INSERT INTO public.credit_transactions (user_id, amount, type, description, payment_method)
  VALUES (_user_id, _amount, _type, _description, _payment_method);
END;
$$;

-- Create RPC for subscription changes (tier, subscription dates)
CREATE OR REPLACE FUNCTION public.update_user_subscription(
  _user_id uuid,
  _tier text,
  _tier_credits_monthly numeric,
  _subscription_start text,
  _subscription_end text,
  _description text,
  _payment_method text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow the user themselves
  IF auth.uid() IS NULL OR auth.uid() != _user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Update subscription fields only (not balance)
  UPDATE public.user_credits
  SET tier = _tier,
      tier_credits_monthly = _tier_credits_monthly,
      subscription_start = _subscription_start,
      subscription_end = _subscription_end,
      updated_at = now()
  WHERE user_id = _user_id;

  -- If no row exists, create one
  IF NOT FOUND THEN
    INSERT INTO public.user_credits (user_id, balance, tier, tier_credits_monthly, subscription_start, subscription_end)
    VALUES (_user_id, 0, _tier, _tier_credits_monthly, _subscription_start, _subscription_end);
  END IF;

  -- Record transaction
  INSERT INTO public.credit_transactions (user_id, amount, type, description, payment_method)
  VALUES (_user_id, 0, 'subscription', _description, _payment_method);
END;
$$;

-- =============================================
-- FIX 2: Restrict profiles SELECT to authenticated users only
-- =============================================
DROP POLICY IF EXISTS "Profiles viewable by everyone" ON public.profiles;

CREATE POLICY "Authenticated users can view profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- Owner can still see their own profile (covered by above policy)
-- Shipping addresses are visible to authenticated users but not anonymous

-- =============================================
-- FIX 3: Studio reviews - require completed booking
-- =============================================
DROP POLICY IF EXISTS "Users can create studio reviews" ON public.studio_reviews;

CREATE POLICY "Users can create verified studio reviews"
ON public.studio_reviews FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.studio_bookings
    WHERE studio_bookings.user_id = auth.uid()
    AND studio_bookings.studio_id = studio_reviews.studio_id
    AND studio_bookings.status = 'completed'
  )
);
