
DROP POLICY "System can insert pending rewards" ON public.pending_rewards;

CREATE POLICY "Users can insert own pending rewards"
ON public.pending_rewards FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
