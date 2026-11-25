-- US107  Task #109 - Restrict creator updates to approval fields

-- Objective: Harden creator token approval state against unauthorized profile updates.

-- Note: 
--   * Admin and trusted server operations bypass these protections.
--   * Normal token submissions continue to route live token changes into pending review.

-- implemention:
-- If an authenticated non-admin user directly modifies the following protected
-- fields on the public.profiles table, those changes are silently reverted:
--   * token_mint_address_pending
--   * token_ticker_pending
--   * token_submission_status
--   * token_submitted_at
--   * token_reviewed_at
--   * token_review_note
--
-- Unauthorized changes are silently reverted and a warning is written
-- to the PostgreSQL logs for operational visibility.


CREATE OR REPLACE FUNCTION public.enforce_token_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := false;
  v_reverted_cols text;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    v_is_admin := public.has_role(auth.uid(), 'admin');
  END IF;

  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- Service-role / server-side trusted context (no JWT): fully trusted,
  -- bypasses RLS by design. Keeps SECURITY DEFINER backend code (maintenance,
  -- integration-test cleanup) working. Never true for authenticated creators.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Case 1: live token columns changed (existing behavior, unchanged).
  IF (NEW.token_mint_address IS DISTINCT FROM OLD.token_mint_address)
     OR (NEW.token_ticker IS DISTINCT FROM OLD.token_ticker) THEN

    -- (a) Clearing both live fields: allow the clear and full-reset state.
    --     Takes precedence over Case 2 - any review-state columns smuggled
    --     into this same UPDATE are overwritten by the reset below.
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

    -- (b) Otherwise route to pending: keep live cols at OLD values.
    NEW.token_mint_address_pending := NEW.token_mint_address;
    NEW.token_ticker_pending := NEW.token_ticker;
    NEW.token_mint_address := OLD.token_mint_address;
    NEW.token_ticker := OLD.token_ticker;
    NEW.token_submission_status := 'pending';
    NEW.token_submitted_at := now();
    NEW.token_reviewed_at := NULL;
    NEW.token_review_note := NULL;
    RETURN NEW;
  END IF;

  -- Case 2 (NEW): live columns unchanged, but any of the six review-state
  -- columns differ from OLD -> revert all six to OLD and warn. Collect the
  -- changed column names BEFORE reverting.
  IF (NEW.token_mint_address_pending IS DISTINCT FROM OLD.token_mint_address_pending)
     OR (NEW.token_ticker_pending IS DISTINCT FROM OLD.token_ticker_pending)
     OR (NEW.token_submission_status IS DISTINCT FROM OLD.token_submission_status)
     OR (NEW.token_submitted_at IS DISTINCT FROM OLD.token_submitted_at)
     OR (NEW.token_reviewed_at IS DISTINCT FROM OLD.token_reviewed_at)
     OR (NEW.token_review_note IS DISTINCT FROM OLD.token_review_note) THEN

    v_reverted_cols := array_to_string(ARRAY[
      CASE WHEN NEW.token_mint_address_pending IS DISTINCT FROM OLD.token_mint_address_pending THEN 'token_mint_address_pending' END,
      CASE WHEN NEW.token_ticker_pending IS DISTINCT FROM OLD.token_ticker_pending THEN 'token_ticker_pending' END,
      CASE WHEN NEW.token_submission_status IS DISTINCT FROM OLD.token_submission_status THEN 'token_submission_status' END,
      CASE WHEN NEW.token_submitted_at IS DISTINCT FROM OLD.token_submitted_at THEN 'token_submitted_at' END,
      CASE WHEN NEW.token_reviewed_at IS DISTINCT FROM OLD.token_reviewed_at THEN 'token_reviewed_at' END,
      CASE WHEN NEW.token_review_note IS DISTINCT FROM OLD.token_review_note THEN 'token_review_note' END
    ], ', ');

    -- Silent revert (no exception): fail-safe against future code that
    -- round-trips whole rows; the smuggled write is discarded, the save
    -- itself does not break.
    RAISE WARNING 'enforce_token_approval: reverted direct write to review-state column(s) [%] by uid %',
      v_reverted_cols,
      COALESCE(auth.uid()::text, 'unauthenticated');

    NEW.token_mint_address_pending := OLD.token_mint_address_pending;
    NEW.token_ticker_pending := OLD.token_ticker_pending;
    NEW.token_submission_status := OLD.token_submission_status;
    NEW.token_submitted_at := OLD.token_submitted_at;
    NEW.token_reviewed_at := OLD.token_reviewed_at;
    NEW.token_review_note := OLD.token_review_note;
    RETURN NEW;
  END IF;

  -- No live token change and no review-state tampering: normal profile edit
  -- (e.g. display_name) passes through untouched.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_token_approval_trg ON public.profiles;
CREATE TRIGGER enforce_token_approval_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_token_approval();
