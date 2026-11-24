-- Task #108 follow-up — expected-submission validation is now unconditional;
-- the _strict flag is removed so no caller can skip it.

-- Drop the 7-argument signature (which allowed _strict = false) so no
-- overload that skips validation remains callable.
DROP FUNCTION IF EXISTS public.review_token_submission(
  uuid,
  boolean,
  text,
  text,
  text,
  timestamptz,
  boolean
);

-- New signature without _strict: expected-submission validation is always on.
CREATE OR REPLACE FUNCTION public.review_token_submission(
  _user_id               uuid,
  _approve               boolean,
  _note                  text DEFAULT NULL,
  _expected_mint         text DEFAULT NULL,
  _expected_ticker       text DEFAULT NULL,
  _expected_submitted_at timestamptz DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending_mint   text;
  v_pending_ticker text;
  v_submitted_at   timestamptz;
  v_status         text;
  v_ticker         text;
  v_artist_name    text;
BEGIN

  -- Only authenticated administrators may review token submissions.
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;


  -- Lock the creator's profile row and retrieve the authoritative
  -- pending submission.
  --
  -- FOR UPDATE keeps this row locked while validation and the
  -- approval/rejection happen.
  SELECT
    token_mint_address_pending,
    token_ticker_pending,
    token_submitted_at,
    token_submission_status,
    COALESCE(display_name, username, 'An artist')
  INTO
    v_pending_mint,
    v_pending_ticker,
    v_submitted_at,
    v_status,
    v_artist_name
  FROM public.profiles
  WHERE user_id = _user_id
  FOR UPDATE;


  -- The supplied user must have a profile to review.
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found';
  END IF;


  -- The review action is bound to exactly what the administrator saw in
  -- the review queue. This validation is unconditional.

  -- If another admin already reviewed the submission, or the
  -- submission is otherwise no longer pending, do not act on it.
  IF v_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION
      'submission_already_resolved: submission is no longer pending (status: %)',
      v_status;
  END IF;


  -- Compare the current locked database values against the exact
  -- values displayed to the administrator.
  --
  -- IS NOT DISTINCT FROM provides NULL-safe equality:
  -- NULL only matches NULL; it is not treated as a wildcard.
  IF NOT (
       v_pending_mint
         IS NOT DISTINCT FROM _expected_mint
   AND v_pending_ticker
         IS NOT DISTINCT FROM _expected_ticker
   AND v_submitted_at
         IS NOT DISTINCT FROM _expected_submitted_at
  ) THEN
    RAISE EXCEPTION
      'submission_changed: pending values differ from what was displayed — refresh the review queue';
  END IF;


  -- Existing approval behavior.
  IF _approve THEN

    UPDATE public.profiles
    SET
      token_mint_address =
        COALESCE(v_pending_mint, token_mint_address),

      token_ticker =
        COALESCE(v_pending_ticker, token_ticker),

      token_mint_address_pending = NULL,
      token_ticker_pending = NULL,
      token_submission_status = 'approved',
      token_reviewed_at = now(),
      token_review_note = _note

    WHERE user_id = _user_id;


    -- Retrieve the approved ticker for the existing notification.
    SELECT token_ticker
    INTO v_ticker
    FROM public.profiles
    WHERE user_id = _user_id;


    -- Existing behavior:
    -- notify every unique fan who cheered one of this artist's
    -- public projects.
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      body,
      link
    )
    SELECT DISTINCT
      pc.user_id,
      'coin_launched',
      v_artist_name || ' just launched ' ||
        COALESCE('$' || v_ticker, 'a coin'),
      'You backed their release early — be one of the first to trade it on pump.fun.',
      '/profiles/' || _user_id

    FROM public.project_cheers pc

    JOIN public.projects p
      ON p.id = pc.project_id

    WHERE p.user_id = _user_id
      AND p.is_public = true
      AND pc.user_id <> _user_id;


  -- Existing rejection behavior.
  ELSE

    UPDATE public.profiles
    SET
      token_mint_address_pending = NULL,
      token_ticker_pending = NULL,
      token_submission_status = 'rejected',
      token_reviewed_at = now(),
      token_review_note = _note

    WHERE user_id = _user_id;

  END IF;

END;
$$
;

-- Restrict the new RPC signature.
REVOKE ALL ON FUNCTION public.review_token_submission(
  uuid,
  boolean,
  text,
  text,
  text,
  timestamptz
) FROM public;

-- Authenticated users may invoke the RPC, but the function itself
-- requires the caller to have the admin role.
GRANT EXECUTE ON FUNCTION public.review_token_submission(
  uuid,
  boolean,
  text,
  text,
  text,
  timestamptz
) TO authenticated;