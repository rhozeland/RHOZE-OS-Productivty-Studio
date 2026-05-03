
-- 1. profiles: revoke sensitive columns from anon (RLS still applies, but column grants block exposure)
REVOKE SELECT (
  shipping_address_line1,
  shipping_address_line2,
  shipping_city,
  shipping_state,
  shipping_zip,
  shipping_country,
  email_notif_messages,
  email_notif_inquiries,
  email_notif_purchases,
  email_notif_reviews
) ON public.profiles FROM anon;

-- 2. realtime.messages: drop broad policy
DROP POLICY IF EXISTS "Authenticated users can read realtime messages" ON realtime.messages;

-- 3. user_notes: restrict to authenticated users
DROP POLICY IF EXISTS "Active notes are publicly readable" ON public.user_notes;
CREATE POLICY "Active notes readable by authenticated users"
  ON public.user_notes FOR SELECT TO authenticated
  USING (expires_at > now());

-- 4. contribution_proofs: owner + admin
DROP POLICY IF EXISTS "Authenticated users can view contribution proofs" ON public.contribution_proofs;
CREATE POLICY "Owners and admins can view contribution proofs"
  ON public.contribution_proofs FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- 5. coin_trades: authenticated only
DROP POLICY IF EXISTS "Trades are publicly viewable" ON public.coin_trades;
CREATE POLICY "Coin trades viewable by authenticated users"
  ON public.coin_trades FOR SELECT TO authenticated
  USING (true);
