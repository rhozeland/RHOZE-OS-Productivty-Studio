
CREATE OR REPLACE FUNCTION public.release_milestone_credits(
  _milestone_id uuid,
  _approver_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_contract_id uuid;
  v_specialist_id uuid;
  v_client_id uuid;
  v_credit_amount numeric;
  v_milestone_status text;
  v_contract_status text;
BEGIN
  -- Get milestone info
  SELECT m.contract_id, m.credit_amount, m.status
  INTO v_contract_id, v_credit_amount, v_milestone_status
  FROM public.project_milestones m
  WHERE m.id = _milestone_id
  FOR UPDATE;

  IF v_contract_id IS NULL THEN
    RAISE EXCEPTION 'Milestone not found';
  END IF;

  IF v_milestone_status != 'submitted' THEN
    RAISE EXCEPTION 'Milestone must be in submitted status to approve';
  END IF;

  -- Get contract info
  SELECT c.client_id, c.specialist_id, c.status
  INTO v_client_id, v_specialist_id, v_contract_status
  FROM public.project_contracts c
  WHERE c.id = v_contract_id
  FOR UPDATE;

  IF v_contract_status != 'active' THEN
    RAISE EXCEPTION 'Contract is not active';
  END IF;

  -- Only client can approve
  IF _approver_id != v_client_id THEN
    RAISE EXCEPTION 'Only the client can approve milestones';
  END IF;

  -- Update milestone to approved
  UPDATE public.project_milestones
  SET status = 'approved', approved_at = now(), updated_at = now()
  WHERE id = _milestone_id;

  -- Transfer credits from escrow to specialist
  UPDATE public.project_contracts
  SET escrowed_credits = escrowed_credits - v_credit_amount,
      released_credits = released_credits + v_credit_amount,
      updated_at = now()
  WHERE id = v_contract_id;

  -- Credit the specialist
  UPDATE public.user_credits
  SET balance = balance + v_credit_amount, updated_at = now()
  WHERE user_id = v_specialist_id;

  -- If no specialist credit row exists, create one
  IF NOT FOUND THEN
    INSERT INTO public.user_credits (user_id, balance)
    VALUES (v_specialist_id, v_credit_amount);
  END IF;

  -- Record escrow release transaction
  INSERT INTO public.escrow_transactions (contract_id, from_user_id, to_user_id, amount, type, status, description, milestone_id)
  VALUES (v_contract_id, v_client_id, v_specialist_id, v_credit_amount, 'release', 'completed', 'Credits released for milestone: ' || _milestone_id::text, _milestone_id);
END;
$$;
