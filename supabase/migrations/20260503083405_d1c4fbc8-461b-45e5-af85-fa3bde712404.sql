
-- Tiered platform fee helper. Returns bps (1500=15%, 1000=10%, 700=7%).
-- Tier thresholds mirror src/lib/tier-matrix.ts.
CREATE OR REPLACE FUNCTION public.get_platform_fee_bps(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric := 0;
BEGIN
  SELECT COALESCE(balance, 0) INTO v_balance
  FROM public.user_credits WHERE user_id = _user_id;

  IF v_balance >= 50000000 THEN RETURN 700;   -- Play 7%
  ELSIF v_balance >= 25000000 THEN RETURN 1000; -- Glow 10%
  ELSE RETURN 1500;                             -- Spark/Bloom 15%
  END IF;
END;
$$;

-- Project milestones: tier-based fee instead of flat 10%
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
  v_fee_bps int;
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

  UPDATE public.project_milestones
  SET status = 'approved', approved_at = now(), updated_at = now()
  WHERE id = _milestone_id;

  UPDATE public.project_contracts
  SET escrowed_credits = escrowed_credits - v_credit_amount,
      released_credits = released_credits + v_credit_amount,
      updated_at = now()
  WHERE id = v_contract_id;

  INSERT INTO public.user_credits (user_id, balance)
  VALUES (v_specialist_id, v_credit_amount)
  ON CONFLICT (user_id) DO UPDATE SET balance = user_credits.balance + v_credit_amount, updated_at = now();

  INSERT INTO public.escrow_transactions (contract_id, from_user_id, to_user_id, amount, type, status, description, milestone_id)
  VALUES (v_contract_id, v_client_id, v_specialist_id, v_credit_amount, 'release', 'completed', 'Credits released for milestone', _milestone_id);

  SELECT COUNT(*) INTO v_remaining_pending
  FROM public.project_milestones
  WHERE contract_id = v_contract_id AND status NOT IN ('approved', 'cancelled');

  IF v_remaining_pending = 0 THEN
    SELECT released_credits INTO v_total_released
    FROM public.project_contracts WHERE id = v_contract_id;

    v_fee_bps := public.get_platform_fee_bps(v_specialist_id);
    v_platform_cut := ROUND(v_total_released * v_fee_bps / 10000.0, 2);

    IF v_platform_cut > 0 THEN
      UPDATE public.user_credits
      SET balance = balance - v_platform_cut, updated_at = now()
      WHERE user_id = v_specialist_id;

      INSERT INTO public.credit_transactions (user_id, amount, type, description)
      VALUES (v_specialist_id, -v_platform_cut, 'platform_fee', 'Platform fee (' || (v_fee_bps/100) || '%) for completed project');

      INSERT INTO public.escrow_transactions (contract_id, from_user_id, amount, type, status, description)
      VALUES (v_contract_id, v_specialist_id, v_platform_cut, 'platform_fee', 'completed', (v_fee_bps/100) || '% platform cut on project completion');
    END IF;

    UPDATE public.project_contracts SET status = 'completed', updated_at = now() WHERE id = v_contract_id;
    UPDATE public.projects SET status = 'completed' WHERE id = (SELECT project_id FROM public.project_contracts WHERE id = v_contract_id);
  END IF;
END;
$$;

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
  v_fee_bps int;
BEGIN
  SELECT * INTO v_contract FROM public.project_contracts WHERE id = _contract_id FOR UPDATE;
  IF v_contract IS NULL THEN RAISE EXCEPTION 'Contract not found'; END IF;
  IF v_contract.status != 'active' THEN RAISE EXCEPTION 'Contract is not active'; END IF;
  IF _requester_id != v_contract.client_id AND _requester_id != v_contract.specialist_id THEN
    RAISE EXCEPTION 'Only contract parties can complete early';
  END IF;

  v_remaining_escrow := v_contract.escrowed_credits;
  v_released := v_contract.released_credits;

  UPDATE public.project_milestones
  SET status = 'cancelled', updated_at = now()
  WHERE contract_id = _contract_id AND status IN ('pending', 'submitted');

  IF v_remaining_escrow > 0 THEN
    UPDATE public.user_credits
    SET balance = balance + v_remaining_escrow, updated_at = now()
    WHERE user_id = v_contract.client_id;

    INSERT INTO public.escrow_transactions (contract_id, from_user_id, to_user_id, amount, type, status, description)
    VALUES (_contract_id, v_contract.client_id, v_contract.client_id, v_remaining_escrow, 'refund', 'completed', 'Escrow returned: ' || _reason);

    INSERT INTO public.credit_transactions (user_id, amount, type, description)
    VALUES (v_contract.client_id, v_remaining_escrow, 'escrow_refund', 'Escrow returned: ' || _reason);
  END IF;

  IF v_released > 0 THEN
    v_fee_bps := public.get_platform_fee_bps(v_contract.specialist_id);
    v_platform_cut := ROUND(v_released * v_fee_bps / 10000.0, 2);
    IF v_platform_cut > 0 THEN
      UPDATE public.user_credits
      SET balance = balance - v_platform_cut, updated_at = now()
      WHERE user_id = v_contract.specialist_id;

      INSERT INTO public.credit_transactions (user_id, amount, type, description)
      VALUES (v_contract.specialist_id, -v_platform_cut, 'platform_fee', 'Platform fee (' || (v_fee_bps/100) || '%) on early completion');

      INSERT INTO public.escrow_transactions (contract_id, from_user_id, amount, type, status, description)
      VALUES (_contract_id, v_contract.specialist_id, v_platform_cut, 'platform_fee', 'completed', (v_fee_bps/100) || '% platform cut on early completion');
    END IF;
  END IF;

  UPDATE public.project_contracts
  SET status = 'completed', escrowed_credits = 0, updated_at = now()
  WHERE id = _contract_id;

  UPDATE public.projects SET status = 'completed'
  WHERE id = v_contract.project_id;
END;
$$;

-- Marketplace purchases: take tier-based platform fee from seller proceeds
CREATE OR REPLACE FUNCTION public.purchase_listing(_listing_id uuid, _buyer_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller_id uuid;
  v_price numeric;
  v_listing_type text;
  v_is_active boolean;
  v_buyer_balance numeric;
  v_purchase_id uuid;
  v_fee_bps int;
  v_platform_cut numeric;
  v_seller_net numeric;
BEGIN
  SELECT user_id, credits_price, listing_type, is_active
  INTO v_seller_id, v_price, v_listing_type, v_is_active
  FROM public.marketplace_listings WHERE id = _listing_id;

  IF v_seller_id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF NOT v_is_active THEN RAISE EXCEPTION 'Listing is no longer active'; END IF;
  IF v_price IS NULL OR v_price <= 0 THEN RAISE EXCEPTION 'Listing has no credit price set'; END IF;
  IF _buyer_id = v_seller_id THEN RAISE EXCEPTION 'Cannot purchase your own listing'; END IF;

  IF v_listing_type = 'digital_product' THEN
    IF EXISTS (SELECT 1 FROM public.purchases WHERE buyer_id = _buyer_id AND listing_id = _listing_id) THEN
      RAISE EXCEPTION 'You already purchased this item';
    END IF;
  END IF;

  SELECT balance INTO v_buyer_balance FROM public.user_credits WHERE user_id = _buyer_id FOR UPDATE;
  IF v_buyer_balance IS NULL THEN RAISE EXCEPTION 'No credit account found. Purchase some credits first.'; END IF;
  IF v_buyer_balance < v_price THEN RAISE EXCEPTION 'Insufficient credits. You have % but need %', v_buyer_balance, v_price; END IF;

  v_fee_bps := public.get_platform_fee_bps(v_seller_id);
  v_platform_cut := ROUND(v_price * v_fee_bps / 10000.0, 2);
  v_seller_net := v_price - v_platform_cut;

  UPDATE public.user_credits SET balance = balance - v_price, updated_at = now() WHERE user_id = _buyer_id;

  INSERT INTO public.user_credits (user_id, balance)
  VALUES (v_seller_id, v_seller_net)
  ON CONFLICT (user_id) DO UPDATE SET balance = user_credits.balance + v_seller_net, updated_at = now();

  INSERT INTO public.purchases (buyer_id, listing_id, seller_id, credits_paid)
  VALUES (_buyer_id, _listing_id, v_seller_id, v_price)
  RETURNING id INTO v_purchase_id;

  INSERT INTO public.credit_transactions (user_id, amount, type, description)
  VALUES (_buyer_id, -v_price, 'purchase', 'Purchased: ' || (SELECT title FROM marketplace_listings WHERE id = _listing_id));

  INSERT INTO public.credit_transactions (user_id, amount, type, description)
  VALUES (v_seller_id, v_seller_net, 'sale', 'Sale (net of ' || (v_fee_bps/100) || '% fee): ' || (SELECT title FROM marketplace_listings WHERE id = _listing_id));

  IF v_platform_cut > 0 THEN
    INSERT INTO public.credit_transactions (user_id, amount, type, description)
    VALUES (v_seller_id, -v_platform_cut, 'platform_fee', 'Platform fee (' || (v_fee_bps/100) || '%) on listing sale');
  END IF;

  RETURN v_purchase_id;
END;
$$;

-- Drop the community reserve from event ticket settlements
ALTER TABLE public.event_ticket_settlements
  ALTER COLUMN reserve_amount SET DEFAULT 0,
  ALTER COLUMN reserve_amount DROP NOT NULL;
