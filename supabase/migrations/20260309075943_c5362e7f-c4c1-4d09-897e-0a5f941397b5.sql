
-- Purchases table
CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL,
  listing_id uuid NOT NULL REFERENCES public.marketplace_listings(id),
  seller_id uuid NOT NULL,
  credits_paid numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- RLS: buyers see their purchases, sellers see sales
CREATE POLICY "Buyers can view own purchases" ON public.purchases
  FOR SELECT USING (auth.uid() = buyer_id);

CREATE POLICY "Sellers can view own sales" ON public.purchases
  FOR SELECT USING (auth.uid() = seller_id);

-- Atomic purchase function: deduct buyer credits, credit seller, record purchase
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
BEGIN
  -- Get listing info
  SELECT user_id, credits_price, listing_type, is_active
  INTO v_seller_id, v_price, v_listing_type, v_is_active
  FROM public.marketplace_listings
  WHERE id = _listing_id;

  IF v_seller_id IS NULL THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;

  IF NOT v_is_active THEN
    RAISE EXCEPTION 'Listing is no longer active';
  END IF;

  IF v_price IS NULL OR v_price <= 0 THEN
    RAISE EXCEPTION 'Listing has no credit price set';
  END IF;

  IF _buyer_id = v_seller_id THEN
    RAISE EXCEPTION 'Cannot purchase your own listing';
  END IF;

  -- Check for duplicate purchase (digital products)
  IF v_listing_type = 'digital_product' THEN
    IF EXISTS (SELECT 1 FROM public.purchases WHERE buyer_id = _buyer_id AND listing_id = _listing_id) THEN
      RAISE EXCEPTION 'You already purchased this item';
    END IF;
  END IF;

  -- Check buyer balance
  SELECT balance INTO v_buyer_balance
  FROM public.user_credits
  WHERE user_id = _buyer_id
  FOR UPDATE;

  IF v_buyer_balance IS NULL THEN
    RAISE EXCEPTION 'No credit account found. Purchase some credits first.';
  END IF;

  IF v_buyer_balance < v_price THEN
    RAISE EXCEPTION 'Insufficient credits. You have % but need %', v_buyer_balance, v_price;
  END IF;

  -- Deduct from buyer
  UPDATE public.user_credits SET balance = balance - v_price, updated_at = now()
  WHERE user_id = _buyer_id;

  -- Credit seller (upsert)
  INSERT INTO public.user_credits (user_id, balance)
  VALUES (v_seller_id, v_price)
  ON CONFLICT (user_id) DO UPDATE SET balance = user_credits.balance + v_price, updated_at = now();

  -- Record purchase
  INSERT INTO public.purchases (buyer_id, listing_id, seller_id, credits_paid)
  VALUES (_buyer_id, _listing_id, v_seller_id, v_price)
  RETURNING id INTO v_purchase_id;

  -- Record transactions for both parties
  INSERT INTO public.credit_transactions (user_id, amount, type, description)
  VALUES (_buyer_id, -v_price, 'purchase', 'Purchased: ' || (SELECT title FROM marketplace_listings WHERE id = _listing_id));

  INSERT INTO public.credit_transactions (user_id, amount, type, description)
  VALUES (v_seller_id, v_price, 'sale', 'Sale: ' || (SELECT title FROM marketplace_listings WHERE id = _listing_id));

  RETURN v_purchase_id;
END;
$$;
