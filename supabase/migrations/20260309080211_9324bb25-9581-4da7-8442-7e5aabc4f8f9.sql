
-- Atomic function: accept inquiry → create project + contract + initial milestone
CREATE OR REPLACE FUNCTION public.convert_inquiry_to_project(
  _inquiry_id uuid,
  _receiver_id uuid,
  _total_credits numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inquiry record;
  v_listing record;
  v_project_id uuid;
  v_contract_id uuid;
BEGIN
  -- Get and validate inquiry
  SELECT * INTO v_inquiry
  FROM public.listing_inquiries
  WHERE id = _inquiry_id AND receiver_id = _receiver_id AND status = 'pending'
  FOR UPDATE;

  IF v_inquiry IS NULL THEN
    RAISE EXCEPTION 'Inquiry not found or already processed';
  END IF;

  -- Get listing info
  SELECT * INTO v_listing
  FROM public.marketplace_listings
  WHERE id = v_inquiry.listing_id;

  IF v_listing IS NULL THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;

  -- Use listing credits_price if total_credits not provided
  IF _total_credits <= 0 AND v_listing.credits_price IS NOT NULL THEN
    _total_credits := v_listing.credits_price;
  END IF;

  -- Create project (owned by the seller/receiver)
  INSERT INTO public.projects (user_id, title, description, status)
  VALUES (
    _receiver_id,
    v_listing.title || ' — ' || (SELECT COALESCE(display_name, 'Client') FROM profiles WHERE user_id = v_inquiry.sender_id LIMIT 1),
    'Created from marketplace inquiry. Original message: ' || v_inquiry.message,
    'active'
  )
  RETURNING id INTO v_project_id;

  -- Add sender as collaborator
  INSERT INTO public.project_collaborators (project_id, user_id, invited_by, role)
  VALUES (v_project_id, v_inquiry.sender_id, _receiver_id, 'editor');

  -- Create contract (seller = specialist, buyer = client)
  INSERT INTO public.project_contracts (project_id, specialist_id, client_id, listing_id, total_credits, status, notes)
  VALUES (
    v_project_id,
    _receiver_id,
    v_inquiry.sender_id,
    v_listing.id,
    _total_credits,
    'draft',
    'Auto-created from inquiry'
  )
  RETURNING id INTO v_contract_id;

  -- Create initial milestone
  INSERT INTO public.project_milestones (contract_id, title, description, credit_amount, proposed_by, sort_order, status)
  VALUES (
    v_contract_id,
    'Deliverable',
    'Full project delivery',
    _total_credits,
    _receiver_id,
    1,
    'pending'
  );

  -- Update inquiry status and link project
  UPDATE public.listing_inquiries
  SET status = 'accepted', project_id = v_project_id, updated_at = now()
  WHERE id = _inquiry_id;

  RETURN jsonb_build_object(
    'project_id', v_project_id,
    'contract_id', v_contract_id
  );
END;
$$;
