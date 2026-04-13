-- Create withdrawal_requests table
CREATE TABLE public.withdrawal_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  payout_method text NOT NULL DEFAULT 'bank_transfer',
  payout_details jsonb,
  admin_note text,
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view own withdrawals"
ON public.withdrawal_requests FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can create withdrawal requests
CREATE POLICY "Users can create withdrawals"
ON public.withdrawal_requests FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Admins can view all
CREATE POLICY "Admins can view all withdrawals"
ON public.withdrawal_requests FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update (process/approve/reject)
CREATE POLICY "Admins can update withdrawals"
ON public.withdrawal_requests FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_withdrawal_requests_updated_at
BEFORE UPDATE ON public.withdrawal_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RPC to request withdrawal (validates balance)
CREATE OR REPLACE FUNCTION public.request_withdrawal(_user_id uuid, _amount numeric, _payout_method text, _payout_details jsonb DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
  v_pending numeric;
  v_available numeric;
  v_request_id uuid;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != _user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Get current balance
  SELECT balance INTO v_balance
  FROM public.user_credits
  WHERE user_id = _user_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'No credit account found';
  END IF;

  -- Check pending withdrawals
  SELECT COALESCE(SUM(amount), 0) INTO v_pending
  FROM public.withdrawal_requests
  WHERE user_id = _user_id AND status IN ('pending', 'approved', 'processing');

  v_available := v_balance - v_pending;

  IF v_available < _amount THEN
    RAISE EXCEPTION 'Insufficient available balance. You have % available (% total, % pending withdrawal)', v_available, v_balance, v_pending;
  END IF;

  -- Create request
  INSERT INTO public.withdrawal_requests (user_id, amount, payout_method, payout_details)
  VALUES (_user_id, _amount, _payout_method, _payout_details)
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- RPC to process withdrawal (admin)
CREATE OR REPLACE FUNCTION public.process_withdrawal(_request_id uuid, _admin_id uuid, _new_status text, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request record;
BEGIN
  IF NOT public.has_role(_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  SELECT * INTO v_request
  FROM public.withdrawal_requests
  WHERE id = _request_id
  FOR UPDATE;

  IF v_request IS NULL THEN
    RAISE EXCEPTION 'Withdrawal request not found';
  END IF;

  IF v_request.status NOT IN ('pending', 'approved', 'processing') THEN
    RAISE EXCEPTION 'Request already finalized';
  END IF;

  -- If completing, deduct from balance
  IF _new_status = 'completed' THEN
    UPDATE public.user_credits
    SET balance = balance - v_request.amount, updated_at = now()
    WHERE user_id = v_request.user_id;

    INSERT INTO public.credit_transactions (user_id, amount, type, description)
    VALUES (v_request.user_id, -v_request.amount, 'withdrawal', 'Withdrawal processed via ' || v_request.payout_method);
  END IF;

  -- If rejecting, nothing to deduct
  UPDATE public.withdrawal_requests
  SET status = _new_status, admin_note = _note, processed_by = _admin_id, processed_at = now(), updated_at = now()
  WHERE id = _request_id;
END;
$$;
