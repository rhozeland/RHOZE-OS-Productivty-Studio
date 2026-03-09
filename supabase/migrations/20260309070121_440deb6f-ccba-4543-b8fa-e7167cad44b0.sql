
CREATE OR REPLACE FUNCTION public.lock_escrow_credits(
  _contract_id uuid,
  _client_id uuid,
  _amount numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance numeric;
  contract_status text;
BEGIN
  -- Verify contract exists, is draft, and client matches
  SELECT status INTO contract_status
  FROM public.project_contracts
  WHERE id = _contract_id AND client_id = _client_id
  FOR UPDATE;

  IF contract_status IS NULL THEN
    RAISE EXCEPTION 'Contract not found or access denied';
  END IF;

  IF contract_status != 'draft' THEN
    RAISE EXCEPTION 'Contract is not in draft status';
  END IF;

  -- Check and lock client balance
  SELECT balance INTO current_balance
  FROM public.user_credits
  WHERE user_id = _client_id
  FOR UPDATE;

  IF current_balance IS NULL THEN
    RAISE EXCEPTION 'No credit account found';
  END IF;

  IF current_balance < _amount THEN
    RAISE EXCEPTION 'Insufficient credits. You have % but need %', current_balance, _amount;
  END IF;

  -- Debit client balance
  UPDATE public.user_credits
  SET balance = balance - _amount, updated_at = now()
  WHERE user_id = _client_id;

  -- Credit contract escrow and activate
  UPDATE public.project_contracts
  SET escrowed_credits = _amount, status = 'active', updated_at = now()
  WHERE id = _contract_id;

  -- Record the escrow transaction
  INSERT INTO public.escrow_transactions (contract_id, from_user_id, amount, type, status, description)
  VALUES (_contract_id, _client_id, _amount, 'lock', 'completed', 'Credits locked into escrow');
END;
$$;
