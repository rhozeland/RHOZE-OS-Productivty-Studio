CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_payment_reference_key
  ON public.credit_transactions (payment_reference)
  WHERE payment_reference IS NOT NULL;

CREATE OR REPLACE FUNCTION public.record_crypto_payment(
  p_user_id uuid,
  p_amount numeric,
  p_type text,
  p_description text,
  p_payment_method text,
  p_payment_reference text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_amount < 0 OR p_payment_reference IS NULL OR btrim(p_payment_reference) = '' THEN
    RAISE EXCEPTION 'invalid_crypto_payment';
  END IF;

  INSERT INTO public.credit_transactions (
    user_id, amount, type, description, payment_method, payment_reference
  ) VALUES (
    p_user_id, p_amount, p_type, p_description, p_payment_method, p_payment_reference
  );

  IF p_amount > 0 THEN
    INSERT INTO public.user_credits (user_id, balance)
    VALUES (p_user_id, p_amount)
    ON CONFLICT (user_id)
    DO UPDATE SET
      balance = public.user_credits.balance + EXCLUDED.balance,
      updated_at = now();
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.record_crypto_payment(uuid, numeric, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_crypto_payment(uuid, numeric, text, text, text, text) TO service_role;
