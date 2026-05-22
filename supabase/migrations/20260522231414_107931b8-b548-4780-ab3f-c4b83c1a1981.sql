
-- 1) Fix can_dm: profiles.user_id is the auth uid, not profiles.id
CREATE OR REPLACE FUNCTION public.can_dm(_sender_id uuid, _receiver_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _sender_id = _receiver_id THEN true
    WHEN NOT COALESCE(
      (SELECT dm_subscribers_only FROM public.profiles WHERE user_id = _receiver_id),
      false
    ) THEN true
    ELSE EXISTS (
      SELECT 1 FROM public.creator_subscriptions
      WHERE subscriber_id = _sender_id
        AND creator_id    = _receiver_id
        AND status = 'active'
        AND (current_period_end IS NULL OR current_period_end > now())
    )
  END
$function$;

-- 2) coin_trades: drop overly broad SELECT policy, restrict to trader + creator
DROP POLICY IF EXISTS "Coin trades viewable by authenticated users" ON public.coin_trades;

CREATE POLICY "Traders can view their own trades"
ON public.coin_trades FOR SELECT
TO authenticated
USING (auth.uid() = trader_id);

CREATE POLICY "Coin creators can view trades on their coin"
ON public.coin_trades FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.coin_launches cl
    WHERE cl.id = coin_trades.launch_id
      AND cl.creator_id = auth.uid()
  )
);

-- 3) gated-works: allow active subscribers to read files referenced by works.gating.gated_path
CREATE POLICY "Subscribers read gated files of their creators"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'gated-works'
  AND EXISTS (
    SELECT 1
    FROM public.works w
    WHERE (w.gating ->> 'gated_path') = storage.objects.name
      AND public.is_subscribed_to(w.user_id)
  )
);

-- 4) profiles: hide shipping address & wallet from anon and other authenticated users
-- Strategy: revoke column-level SELECT from anon/authenticated for sensitive cols,
-- expose owner-only access through a SECURITY DEFINER RPC.
REVOKE SELECT (
  shipping_address_line1,
  shipping_address_line2,
  shipping_city,
  shipping_state,
  shipping_zip,
  shipping_country,
  wallet_address
) ON public.profiles FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_private_profile_fields()
RETURNS TABLE (
  shipping_address_line1 text,
  shipping_address_line2 text,
  shipping_city text,
  shipping_state text,
  shipping_zip text,
  shipping_country text,
  wallet_address text,
  wallet_locked boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    p.shipping_address_line1,
    p.shipping_address_line2,
    p.shipping_city,
    p.shipping_state,
    p.shipping_zip,
    p.shipping_country,
    p.wallet_address,
    p.wallet_locked
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_private_profile_fields() TO authenticated;
