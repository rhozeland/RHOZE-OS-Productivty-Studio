-- 1. Creator opt-in flag
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dm_subscribers_only boolean NOT NULL DEFAULT false;

-- 2. SECURITY DEFINER helper: can `_sender_id` DM `_receiver_id`?
--    Rules:
--      - Self-DMs allowed (notes-to-self never blocked).
--      - If receiver has not opted in → allowed.
--      - Otherwise sender must have an active subscription to receiver
--        (via is_subscribed_to, which already honors current_period_end).
CREATE OR REPLACE FUNCTION public.can_dm(_sender_id uuid, _receiver_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _sender_id = _receiver_id THEN true
    WHEN NOT COALESCE(
      (SELECT dm_subscribers_only FROM public.profiles WHERE id = _receiver_id),
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
$$;

GRANT EXECUTE ON FUNCTION public.can_dm(uuid, uuid) TO anon, authenticated;

-- 3. Replace messages INSERT policy with the gated version.
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;

CREATE POLICY "Users can send messages"
ON public.messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND public.can_dm(auth.uid(), receiver_id)
);