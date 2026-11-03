ALTER TABLE public.crypto_claims
  ADD COLUMN IF NOT EXISTS signed_transaction TEXT,
  ADD COLUMN IF NOT EXISTS last_valid_block_height BIGINT;

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
  PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::TEXT, 0));

  SELECT * INTO v_existing
  FROM public.crypto_claims
  WHERE request_id = p_request_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.user_id IS DISTINCT FROM p_user_id
      OR v_existing.wallet_address IS DISTINCT FROM p_wallet_address
      OR v_existing.credits IS DISTINCT FROM p_credits THEN
      RAISE EXCEPTION 'claim_request_mismatch';
    END IF;

    RETURN jsonb_build_object(
      'claim_id', v_existing.id,
      'status', v_existing.status,
      'signature', v_existing.signature,
      'signed_transaction', v_existing.signed_transaction,
      'last_valid_block_height', v_existing.last_valid_block_height,
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
    'signed_transaction', NULL,
    'last_valid_block_height', NULL,
    'created', true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.prepare_rhoze_claim_payout(
  p_claim_id UUID,
  p_signature TEXT,
  p_signed_transaction TEXT,
  p_last_valid_block_height BIGINT
)
RETURNS JSONB
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
    RAISE EXCEPTION 'claim_not_pending';
  END IF;

  -- The first prepared transaction becomes the only payout transaction for
  -- this claim. Concurrent retries receive that same signed transaction.
  IF v_claim.signature IS NOT NULL THEN
    RETURN jsonb_build_object(
      'signature', v_claim.signature,
      'signed_transaction', v_claim.signed_transaction,
      'last_valid_block_height', v_claim.last_valid_block_height
    );
  END IF;

  UPDATE public.crypto_claims
  SET signature = p_signature,
      signed_transaction = p_signed_transaction,
      last_valid_block_height = p_last_valid_block_height
  WHERE id = p_claim_id
  RETURNING * INTO v_claim;

  RETURN jsonb_build_object(
    'signature', v_claim.signature,
    'signed_transaction', v_claim.signed_transaction,
    'last_valid_block_height', v_claim.last_valid_block_height
  );
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_rhoze_claim_payout(UUID, TEXT, TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepare_rhoze_claim_payout(UUID, TEXT, TEXT, BIGINT) TO service_role;
