
-- Drop client INSERT policies on financial/proof tables; writes now happen via service-role edge functions or SECURITY DEFINER RPCs.
DROP POLICY IF EXISTS "Users can insert own proofs" ON public.contribution_proofs;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.credit_transactions;
DROP POLICY IF EXISTS "Users can create own escrow locks" ON public.escrow_transactions;
DROP POLICY IF EXISTS "Buyers insert own settlements" ON public.event_ticket_settlements;
DROP POLICY IF EXISTS "Users can insert own pending rewards" ON public.pending_rewards;
DROP POLICY IF EXISTS "Users insert their own ledger entries" ON public.rhoze_booking_ledger;

-- Provide a SECURITY DEFINER RPC for users to record contribution proofs without being able to forge a solana_signature.
CREATE OR REPLACE FUNCTION public.record_contribution_proof(
  _action_type text,
  _reference_id uuid,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _action_type IS NULL OR length(_action_type) = 0 OR length(_action_type) > 64 THEN
    RAISE EXCEPTION 'Invalid action_type';
  END IF;

  INSERT INTO public.contribution_proofs (user_id, action_type, reference_id, metadata)
  VALUES (auth.uid(), _action_type, _reference_id, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_contribution_proof(text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_contribution_proof(text, uuid, jsonb) TO authenticated;
