CREATE TABLE IF NOT EXISTS public.crypto_claims (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  wallet_address TEXT NOT NULL,
  credits NUMERIC NOT NULL CHECK (credits > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed')),
  signature TEXT UNIQUE,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.crypto_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own crypto claims"
  ON public.crypto_claims FOR SELECT
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.reserve_rhoze_claim(
  p_request_id UUID,
  p_user_id UUID,
  p_wallet_address TEXT,
  p_credits NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.crypto_claims%ROWTYPE;
  v_balance NUMERIC;
  v_claim public.crypto_claims;
BEGIN
  SELECT * INTO v_existing
  FROM public.crypto_claims
  WHERE request_id = p_request_id
  FOR UPDATE;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'claim_id', v_existing.id,
      'status', v_existing.status,
      'signature', v_existing.signature,
      'created', false
    );
  END IF;

  SELECT balance INTO v_balance
  FROM public.user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL OR v_balance < p_credits THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  INSERT INTO public.crypto_claims (
    request_id, user_id, wallet_address, credits
  ) VALUES (
    p_request_id, p_user_id, p_wallet_address, p_credits
  )
  RETURNING * INTO v_claim;

  UPDATE public.user_credits
  SET balance = balance - p_credits, updated_at = now()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'claim_id', v_claim.id,
    'status', v_claim.status,
    'signature', NULL,
    'created', true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_rhoze_claim(
  p_claim_id UUID,
  p_signature TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim public.crypto_claims%ROWTYPE;
BEGIN
  SELECT * INTO v_claim
  FROM public.crypto_claims
  WHERE id = p_claim_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'claim_not_found';
  END IF;
  IF v_claim.status = 'completed' THEN
    IF v_claim.signature IS DISTINCT FROM p_signature THEN
      RAISE EXCEPTION 'claim_signature_mismatch';
    END IF;
    RETURN;
  END IF;
  IF v_claim.status <> 'pending' THEN
    RAISE EXCEPTION 'claim_not_pending';
  END IF;

  UPDATE public.crypto_claims
  SET status = 'completed', signature = p_signature, completed_at = now()
  WHERE id = p_claim_id;

  INSERT INTO public.credit_transactions (
    user_id, amount, type, description, payment_method, payment_reference
  ) VALUES (
    v_claim.user_id,
    -v_claim.credits,
    'claim',
    format('Claimed %s $RHOZE to %s...', v_claim.credits, left(v_claim.wallet_address, 6)),
    'crypto',
    p_signature
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_rhoze_claim(
  p_claim_id UUID,
  p_error_message TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim public.crypto_claims%ROWTYPE;
BEGIN
  SELECT * INTO v_claim
  FROM public.crypto_claims
  WHERE id = p_claim_id
  FOR UPDATE;

  IF NOT FOUND OR v_claim.status <> 'pending' THEN
    RETURN;
  END IF;

  UPDATE public.user_credits
  SET balance = balance + v_claim.credits, updated_at = now()
  WHERE user_id = v_claim.user_id;

  UPDATE public.crypto_claims
  SET status = 'failed', error_message = left(p_error_message, 500)
  WHERE id = p_claim_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_rhoze_claim(UUID, UUID, TEXT, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_rhoze_claim(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fail_rhoze_claim(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_rhoze_claim(UUID, UUID, TEXT, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_rhoze_claim(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_rhoze_claim(UUID, TEXT) TO service_role;
