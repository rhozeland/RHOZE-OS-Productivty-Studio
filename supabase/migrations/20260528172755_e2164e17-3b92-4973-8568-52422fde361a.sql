
-- 1) coin_swap_ledger
DROP POLICY IF EXISTS "Launch creators view swaps on their coin" ON public.coin_swap_ledger;

-- 2) creator_subscription_tiers
DROP POLICY IF EXISTS "Tiers viewable by everyone" ON public.creator_subscription_tiers;
CREATE POLICY "Tiers viewable by authenticated"
ON public.creator_subscription_tiers
FOR SELECT
TO authenticated
USING (true);
REVOKE SELECT ON public.creator_subscription_tiers FROM anon;

-- 3) referral_codes
DROP POLICY IF EXISTS "Active codes readable by authenticated" ON public.referral_codes;

CREATE OR REPLACE FUNCTION public.lookup_referral_code(_code text)
RETURNS TABLE (
  code text,
  reward_rhoze integer,
  valid boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    rc.code,
    rc.reward_rhoze,
    (rc.active = true
     AND (rc.max_uses IS NULL OR rc.used_count < rc.max_uses)) AS valid
  FROM public.referral_codes rc
  WHERE rc.code = _code
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_referral_code(text) FROM public;
GRANT EXECUTE ON FUNCTION public.lookup_referral_code(text) TO authenticated, anon;

-- 4) realtime.messages explicit deny-by-default
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'realtime.messages'::regclass
      AND polname = 'Deny all realtime channel access by default'
  ) THEN
    EXECUTE 'CREATE POLICY "Deny all realtime channel access by default" ON realtime.messages FOR SELECT TO authenticated, anon USING (false)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'realtime.messages'::regclass
      AND polname = 'Deny all realtime channel writes by default'
  ) THEN
    EXECUTE 'CREATE POLICY "Deny all realtime channel writes by default" ON realtime.messages FOR INSERT TO authenticated, anon WITH CHECK (false)';
  END IF;
END$$;
