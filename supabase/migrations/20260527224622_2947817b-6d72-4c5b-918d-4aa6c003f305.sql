-- Part B: Token submission approval gate.
-- Verified Artists can submit a token mint/ticker for admin review. Non-admin
-- writes to the live token columns are intercepted by a trigger and routed
-- into shadow "pending" columns; an admin RPC moves them live.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS token_mint_address_pending text,
  ADD COLUMN IF NOT EXISTS token_ticker_pending text,
  ADD COLUMN IF NOT EXISTS token_submission_status text NOT NULL DEFAULT 'none'
    CHECK (token_submission_status IN ('none','pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS token_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS token_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS token_review_note text;

CREATE INDEX IF NOT EXISTS profiles_token_submission_status_idx
  ON public.profiles (token_submission_status)
  WHERE token_submission_status = 'pending';

-- Trigger: when a non-admin tries to set/change token_mint_address or
-- token_ticker, revert the live cols to OLD and stash the new values into the
-- _pending cols with status='pending'. Admins (has_role(uid,'admin')) bypass.
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

  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- Detect change in either token column.
  IF (NEW.token_mint_address IS DISTINCT FROM OLD.token_mint_address)
     OR (NEW.token_ticker IS DISTINCT FROM OLD.token_ticker) THEN

    -- If they are clearing both back to NULL, allow the clear and reset state.
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

    -- Otherwise route to pending: keep live cols at OLD values.
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

DROP TRIGGER IF EXISTS enforce_token_approval_trg ON public.profiles;
CREATE TRIGGER enforce_token_approval_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_token_approval();

-- Admin RPC: approve or reject a pending submission.
CREATE OR REPLACE FUNCTION public.review_token_submission(
  _user_id uuid,
  _approve boolean,
  _note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending_mint text;
  v_pending_ticker text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  SELECT token_mint_address_pending, token_ticker_pending
    INTO v_pending_mint, v_pending_ticker
    FROM public.profiles
   WHERE user_id = _user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found';
  END IF;

  IF _approve THEN
    -- Move pending -> live. Bypass trigger by using a temporary admin path:
    -- since this function is SECURITY DEFINER, the trigger will see auth.uid()
    -- of the calling admin and bypass. (Validated above.)
    UPDATE public.profiles
       SET token_mint_address = COALESCE(v_pending_mint, token_mint_address),
           token_ticker = COALESCE(v_pending_ticker, token_ticker),
           token_mint_address_pending = NULL,
           token_ticker_pending = NULL,
           token_submission_status = 'approved',
           token_reviewed_at = now(),
           token_review_note = _note
     WHERE user_id = _user_id;
  ELSE
    UPDATE public.profiles
       SET token_mint_address_pending = NULL,
           token_ticker_pending = NULL,
           token_submission_status = 'rejected',
           token_reviewed_at = now(),
           token_review_note = _note
     WHERE user_id = _user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.review_token_submission(uuid, boolean, text) FROM public;
GRANT EXECUTE ON FUNCTION public.review_token_submission(uuid, boolean, text) TO authenticated;