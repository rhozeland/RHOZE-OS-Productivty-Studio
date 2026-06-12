DROP FUNCTION IF EXISTS public.get_my_private_profile_fields();

CREATE FUNCTION public.get_my_private_profile_fields()
RETURNS TABLE (
  shipping_address_line1 text,
  shipping_address_line2 text,
  shipping_city text,
  shipping_state text,
  shipping_zip text,
  shipping_country text,
  wallet_address text,
  wallet_locked boolean,
  luma_ics_url text,
  ics_last_synced_at timestamptz,
  token_mint_address_pending text,
  token_ticker_pending text,
  token_submission_status text,
  token_submitted_at timestamptz,
  token_reviewed_at timestamptz,
  token_review_note text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    p.shipping_address_line1,
    p.shipping_address_line2,
    p.shipping_city,
    p.shipping_state,
    p.shipping_zip,
    p.shipping_country,
    p.wallet_address,
    p.wallet_locked,
    p.luma_ics_url,
    p.ics_last_synced_at,
    p.token_mint_address_pending,
    p.token_ticker_pending,
    p.token_submission_status,
    p.token_submitted_at,
    p.token_reviewed_at,
    p.token_review_note
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_private_profile_fields() TO authenticated;