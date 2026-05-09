
CREATE OR REPLACE FUNCTION public.record_rhoze_topup(
  p_user_id uuid,
  p_credits numeric,
  p_amount_cents integer,
  p_payment_reference text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_credits <= 0 OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  INSERT INTO public.user_credits (user_id, balance)
  VALUES (p_user_id, p_credits)
  ON CONFLICT (user_id)
  DO UPDATE SET balance = public.user_credits.balance + p_credits,
                updated_at = now();

  INSERT INTO public.credit_transactions (
    user_id, amount, type, description, payment_method, payment_reference
  ) VALUES (
    p_user_id,
    p_credits,
    'purchase',
    format('Bought %s $RHOZE for $%s.%s', p_credits, p_amount_cents / 100, lpad((p_amount_cents % 100)::text, 2, '0')),
    'card',
    p_payment_reference
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_rhoze_topup(uuid, numeric, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_rhoze_topup(uuid, numeric, integer, text) TO service_role;
