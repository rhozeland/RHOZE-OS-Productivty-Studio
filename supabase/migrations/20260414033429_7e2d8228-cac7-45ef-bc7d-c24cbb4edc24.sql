
-- Add wallet_locked to profiles
ALTER TABLE public.profiles ADD COLUMN wallet_locked boolean NOT NULL DEFAULT false;

-- Wallet change requests table
CREATE TABLE public.wallet_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  current_wallet text NOT NULL,
  requested_wallet text NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_change_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view own wallet change requests"
ON public.wallet_change_requests FOR SELECT
USING (auth.uid() = user_id);

-- Users can create requests
CREATE POLICY "Users can create wallet change requests"
ON public.wallet_change_requests FOR INSERT
WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Admins can view all
CREATE POLICY "Admins can view all wallet change requests"
ON public.wallet_change_requests FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update
CREATE POLICY "Admins can update wallet change requests"
ON public.wallet_change_requests FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Lock existing wallets that already have an address set
UPDATE public.profiles SET wallet_locked = true WHERE wallet_address IS NOT NULL AND wallet_address != '';

-- Create RPC to process wallet change (admin only)
CREATE OR REPLACE FUNCTION public.process_wallet_change(_request_id uuid, _admin_id uuid, _approve boolean, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_request record;
BEGIN
  IF NOT public.has_role(_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  SELECT * INTO v_request
  FROM public.wallet_change_requests
  WHERE id = _request_id AND status = 'pending'
  FOR UPDATE;

  IF v_request IS NULL THEN
    RAISE EXCEPTION 'Request not found or already processed';
  END IF;

  IF _approve THEN
    UPDATE public.profiles
    SET wallet_address = v_request.requested_wallet, updated_at = now()
    WHERE user_id = v_request.user_id;

    UPDATE public.wallet_change_requests
    SET status = 'approved', processed_by = _admin_id, processed_at = now(), admin_note = _note, updated_at = now()
    WHERE id = _request_id;
  ELSE
    UPDATE public.wallet_change_requests
    SET status = 'rejected', processed_by = _admin_id, processed_at = now(), admin_note = _note, updated_at = now()
    WHERE id = _request_id;
  END IF;
END;
$$;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_wallet_change_requests_updated_at
BEFORE UPDATE ON public.wallet_change_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
