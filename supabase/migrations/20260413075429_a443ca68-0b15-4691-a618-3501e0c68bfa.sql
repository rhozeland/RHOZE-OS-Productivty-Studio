-- Create project_disputes table
CREATE TABLE public.project_disputes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES public.project_contracts(id) ON DELETE CASCADE,
  milestone_id uuid REFERENCES public.project_milestones(id) ON DELETE SET NULL,
  filed_by uuid NOT NULL,
  dispute_type text NOT NULL DEFAULT 'stage',
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  resolution_note text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_disputes ENABLE ROW LEVEL SECURITY;

-- Contract parties can file disputes
CREATE POLICY "Contract parties can file disputes"
ON public.project_disputes FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = filed_by
  AND is_contract_party(auth.uid(), contract_id)
);

-- Contract parties can view disputes on their contracts
CREATE POLICY "Contract parties can view disputes"
ON public.project_disputes FOR SELECT
TO authenticated
USING (is_contract_party(auth.uid(), contract_id));

-- Admins can view all disputes
CREATE POLICY "Admins can view all disputes"
ON public.project_disputes FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update disputes (resolve/dismiss)
CREATE POLICY "Admins can update disputes"
ON public.project_disputes FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_project_disputes_updated_at
BEFORE UPDATE ON public.project_disputes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Update release_milestone_credits to auto-deduct 10% platform cut on final milestone
CREATE OR REPLACE FUNCTION public.release_milestone_credits(_milestone_id uuid, _approver_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract_id uuid;
  v_specialist_id uuid;
  v_client_id uuid;
  v_credit_amount numeric;
  v_milestone_status text;
  v_contract_status text;
  v_remaining_pending int;
  v_total_released numeric;
  v_platform_cut numeric;
BEGIN
  SELECT m.contract_id, m.credit_amount, m.status
  INTO v_contract_id, v_credit_amount, v_milestone_status
  FROM public.project_milestones m WHERE m.id = _milestone_id FOR UPDATE;

  IF v_contract_id IS NULL THEN RAISE EXCEPTION 'Milestone not found'; END IF;
  IF v_milestone_status != 'submitted' THEN RAISE EXCEPTION 'Milestone must be in submitted status to approve'; END IF;

  SELECT c.client_id, c.specialist_id, c.status
  INTO v_client_id, v_specialist_id, v_contract_status
  FROM public.project_contracts c WHERE c.id = v_contract_id FOR UPDATE;

  IF v_contract_status != 'active' THEN RAISE EXCEPTION 'Contract is not active'; END IF;
  IF _approver_id != v_client_id THEN RAISE EXCEPTION 'Only the client can approve milestones'; END IF;

  -- Approve milestone
  UPDATE public.project_milestones
  SET status = 'approved', approved_at = now(), updated_at = now()
  WHERE id = _milestone_id;

  -- Transfer credits
  UPDATE public.project_contracts
  SET escrowed_credits = escrowed_credits - v_credit_amount,
      released_credits = released_credits + v_credit_amount,
      updated_at = now()
  WHERE id = v_contract_id;

  -- Credit the specialist
  INSERT INTO public.user_credits (user_id, balance)
  VALUES (v_specialist_id, v_credit_amount)
  ON CONFLICT (user_id) DO UPDATE SET balance = user_credits.balance + v_credit_amount, updated_at = now();

  -- Record escrow release
  INSERT INTO public.escrow_transactions (contract_id, from_user_id, to_user_id, amount, type, status, description, milestone_id)
  VALUES (v_contract_id, v_client_id, v_specialist_id, v_credit_amount, 'release', 'completed', 'Credits released for milestone', _milestone_id);

  -- Check if this was the last milestone
  SELECT COUNT(*) INTO v_remaining_pending
  FROM public.project_milestones
  WHERE contract_id = v_contract_id AND status NOT IN ('approved', 'cancelled');

  IF v_remaining_pending = 0 THEN
    -- All milestones done — take 10% platform cut from total released
    SELECT released_credits INTO v_total_released
    FROM public.project_contracts WHERE id = v_contract_id;

    v_platform_cut := ROUND(v_total_released * 0.10, 2);

    IF v_platform_cut > 0 THEN
      -- Deduct from specialist balance
      UPDATE public.user_credits
      SET balance = balance - v_platform_cut, updated_at = now()
      WHERE user_id = v_specialist_id;

      -- Log platform cut transaction
      INSERT INTO public.credit_transactions (user_id, amount, type, description)
      VALUES (v_specialist_id, -v_platform_cut, 'platform_fee', 'Platform fee (10%) for completed project');

      INSERT INTO public.escrow_transactions (contract_id, from_user_id, amount, type, status, description)
      VALUES (v_contract_id, v_specialist_id, v_platform_cut, 'platform_fee', 'completed', '10% platform cut on project completion');
    END IF;

    -- Mark contract completed
    UPDATE public.project_contracts SET status = 'completed', updated_at = now() WHERE id = v_contract_id;
    UPDATE public.projects SET status = 'completed' WHERE id = (SELECT project_id FROM public.project_contracts WHERE id = v_contract_id);
  END IF;
END;
$$;

-- RPC: Complete project early
CREATE OR REPLACE FUNCTION public.complete_project_early(_contract_id uuid, _requester_id uuid, _reason text DEFAULT 'Early completion requested')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract record;
  v_remaining_escrow numeric;
  v_released numeric;
  v_platform_cut numeric;
BEGIN
  SELECT * INTO v_contract FROM public.project_contracts WHERE id = _contract_id FOR UPDATE;
  IF v_contract IS NULL THEN RAISE EXCEPTION 'Contract not found'; END IF;
  IF v_contract.status != 'active' THEN RAISE EXCEPTION 'Contract is not active'; END IF;
  IF _requester_id != v_contract.client_id AND _requester_id != v_contract.specialist_id THEN
    RAISE EXCEPTION 'Only contract parties can complete early';
  END IF;

  v_remaining_escrow := v_contract.escrowed_credits;
  v_released := v_contract.released_credits;

  -- Cancel remaining pending milestones
  UPDATE public.project_milestones
  SET status = 'cancelled', updated_at = now()
  WHERE contract_id = _contract_id AND status IN ('pending', 'submitted');

  -- Return remaining escrow to client
  IF v_remaining_escrow > 0 THEN
    UPDATE public.user_credits
    SET balance = balance + v_remaining_escrow, updated_at = now()
    WHERE user_id = v_contract.client_id;

    INSERT INTO public.escrow_transactions (contract_id, from_user_id, to_user_id, amount, type, status, description)
    VALUES (_contract_id, v_contract.client_id, v_contract.client_id, v_remaining_escrow, 'refund', 'completed', 'Escrow returned: ' || _reason);

    INSERT INTO public.credit_transactions (user_id, amount, type, description)
    VALUES (v_contract.client_id, v_remaining_escrow, 'escrow_refund', 'Escrow returned: ' || _reason);
  END IF;

  -- Platform cut on whatever was released
  IF v_released > 0 THEN
    v_platform_cut := ROUND(v_released * 0.10, 2);
    IF v_platform_cut > 0 THEN
      UPDATE public.user_credits
      SET balance = balance - v_platform_cut, updated_at = now()
      WHERE user_id = v_contract.specialist_id;

      INSERT INTO public.credit_transactions (user_id, amount, type, description)
      VALUES (v_contract.specialist_id, -v_platform_cut, 'platform_fee', 'Platform fee (10%) on early completion');

      INSERT INTO public.escrow_transactions (contract_id, from_user_id, amount, type, status, description)
      VALUES (_contract_id, v_contract.specialist_id, v_platform_cut, 'platform_fee', 'completed', '10% platform cut on early completion');
    END IF;
  END IF;

  -- Mark completed
  UPDATE public.project_contracts
  SET status = 'completed', escrowed_credits = 0, updated_at = now()
  WHERE id = _contract_id;

  UPDATE public.projects SET status = 'completed'
  WHERE id = v_contract.project_id;
END;
$$;