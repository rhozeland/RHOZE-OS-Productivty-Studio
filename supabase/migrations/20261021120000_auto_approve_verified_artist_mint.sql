ALTER TABLE public.artist_mint_verification_challenges
  ADD COLUMN token_ticker text;

CREATE OR REPLACE FUNCTION public.enforce_token_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := false;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    v_is_admin := public.has_role(auth.uid(), 'admin');
  END IF;

  IF v_is_admin OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF (NEW.token_mint_address IS DISTINCT FROM OLD.token_mint_address)
     OR (NEW.token_ticker IS DISTINCT FROM OLD.token_ticker) THEN
    IF (NEW.token_mint_address IS NULL OR NEW.token_mint_address = '')
       AND (NEW.token_ticker IS NULL OR NEW.token_ticker = '') THEN
      NEW.token_mint_address_pending := NULL;
      NEW.token_ticker_pending := NULL;
      NEW.token_submission_status := 'none';
      NEW.token_submitted_at := NULL;
      NEW.token_reviewed_at := now();
      NEW.token_review_note := NULL;
      RETURN NEW;
    END IF;

    NEW.token_mint_address_pending := NEW.token_mint_address;
    NEW.token_ticker_pending := NEW.token_ticker;
    NEW.token_mint_address := OLD.token_mint_address;
    NEW.token_ticker := OLD.token_ticker;
    NEW.token_submission_status := 'pending';
    NEW.token_submitted_at := now();
    NEW.token_reviewed_at := NULL;
    NEW.token_review_note := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_verified_artist_token_submission(
  _challenge_id uuid,
  _user_id uuid
) RETURNS TABLE (
  mint_address text,
  ticker text,
  approved_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_challenge public.artist_mint_verification_challenges%ROWTYPE;
  v_pending_mint text;
  v_pending_ticker text;
  v_profile_wallet text;
  v_submission_status text;
  v_artist_name text;
  v_approved_ticker text;
  v_approved_at timestamptz := now();
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role only' USING ERRCODE = '42501';
  END IF;

  SELECT *
    INTO v_challenge
    FROM public.artist_mint_verification_challenges
   WHERE id = _challenge_id
     AND user_id = _user_id
     AND consumed_at IS NULL
     AND expires_at > v_approved_at
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.artist_mint_verification_challenges
     SET consumed_at = v_approved_at
   WHERE id = _challenge_id;

  SELECT token_mint_address_pending,
         token_ticker_pending,
         wallet_address,
         token_submission_status,
         COALESCE(display_name, username, 'An artist')
    INTO v_pending_mint,
         v_pending_ticker,
         v_profile_wallet,
         v_submission_status,
         v_artist_name
    FROM public.profiles
   WHERE user_id = _user_id
   FOR UPDATE;

  IF NOT FOUND
     OR v_submission_status IS DISTINCT FROM 'pending'
     OR v_pending_mint IS DISTINCT FROM v_challenge.mint_address
     OR v_pending_ticker IS DISTINCT FROM v_challenge.token_ticker
     OR v_profile_wallet IS DISTINCT FROM v_challenge.creator_wallet THEN
    RETURN;
  END IF;

  UPDATE public.profiles
     SET token_mint_address = v_pending_mint,
         token_ticker = COALESCE(v_pending_ticker, token_ticker),
         token_mint_address_pending = NULL,
         token_ticker_pending = NULL,
         token_submission_status = 'approved',
         token_reviewed_at = v_approved_at,
         token_review_note = 'Automatically approved after wallet signature verification.'
   WHERE user_id = _user_id
   RETURNING token_ticker INTO v_approved_ticker;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT DISTINCT pc.user_id,
         'coin_launched',
         v_artist_name || ' just launched ' || COALESCE('$' || v_approved_ticker, 'a coin'),
         'You backed their release early — be one of the first to trade it on pump.fun.',
         '/profiles/' || _user_id
    FROM public.project_cheers pc
    JOIN public.projects p ON p.id = pc.project_id
   WHERE p.user_id = _user_id
     AND p.is_public = true
     AND pc.user_id <> _user_id;

  RETURN QUERY SELECT v_pending_mint, v_approved_ticker, v_approved_at;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_verified_artist_token_submission(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_verified_artist_token_submission(uuid, uuid)
  TO service_role;
