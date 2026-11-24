-- US107  Task #109 - Reject unauthorized token approval mutations explicitly

-- Objective: Harden creator token approval state against unauthorized profile updates.
--
-- Changes vs migration 20261030213201:
-- 1. Replace implicit null-uid trust with explicit positive authorization checks.
--    - Admin bypass: authenticated users with the 'admin' role.
--    - Service-role HTTP bypass: requests with role='service_role' AND session_user='authenticator'.
--    - Maintenance-session bypass: direct DB connections whose session_user is exactly 'postgres' or 'supabase_admin' (no wildcard patterns).
--    - All other contexts (anon-key HTTP requests, direct DB sessions without trusted session_user) are explicitly rejected.
-- 2. Replace silent revert (RAISE WARNING + assign OLD values) with explicit rejection (RAISE EXCEPTION).
--    - No legitimate client path writes these columns: SettingsPage writes only live columns + profile fields;
--      admins go through review_token_submission; service jobs hit the trusted branch.
--    - Failing loudly surfaces stale-UI/confused-creator bugs instead of hiding them.

CREATE OR REPLACE FUNCTION public.enforce_token_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := false;
  v_jwt_claims json;
  v_changed_cols text;
BEGIN
  -- Extract JWT claims safely; NULL if no JWT present (direct DB connections)
  BEGIN
    v_jwt_claims := nullif(current_setting('request.jwt.claims', true), '')::json;
  EXCEPTION WHEN OTHERS THEN
    v_jwt_claims := NULL;
  END;

  IF auth.uid() IS NOT NULL THEN
    v_is_admin := public.has_role(auth.uid(), 'admin');
  END IF;

  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- Service-role HTTP bypass: only trust requests with role='service_role' AND session_user='authenticator'.
  -- session_user='authenticator' ensures the request came through PostgREST, which verifies the JWT signature.
  IF v_jwt_claims IS NOT NULL
     AND v_jwt_claims->>'role' = 'service_role'
     AND session_user = 'authenticator' THEN
    RETURN NEW;
  END IF;

  -- Maintenance-session bypass: ONLY the exact canonical maintenance roles.
  -- session_user is fixed at connect time, cannot be changed by SET ROLE, and
  -- only a superuser can SET SESSION AUTHORIZATION. Exact matches only: a
  -- wildcard ('postgres.%') would also trust any role whose name merely
  -- shares the prefix, and pooler address formats must never widen this check.
  IF session_user IN ('postgres', 'supabase_admin') THEN
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

  -- Case 2 (CHANGED): live columns unchanged, but any of the six review-state
  -- columns differ from OLD -> explicitly reject instead of silently reverting.
  -- Collect the changed column names BEFORE rejecting.
  IF (NEW.token_mint_address_pending IS DISTINCT FROM OLD.token_mint_address_pending)
     OR (NEW.token_ticker_pending IS DISTINCT FROM OLD.token_ticker_pending)
     OR (NEW.token_submission_status IS DISTINCT FROM OLD.token_submission_status)
     OR (NEW.token_submitted_at IS DISTINCT FROM OLD.token_submitted_at)
     OR (NEW.token_reviewed_at IS DISTINCT FROM OLD.token_reviewed_at)
     OR (NEW.token_review_note IS DISTINCT FROM OLD.token_review_note) THEN

    v_changed_cols := array_to_string(ARRAY[
      CASE WHEN NEW.token_mint_address_pending IS DISTINCT FROM OLD.token_mint_address_pending THEN 'token_mint_address_pending' END,
      CASE WHEN NEW.token_ticker_pending IS DISTINCT FROM OLD.token_ticker_pending THEN 'token_ticker_pending' END,
      CASE WHEN NEW.token_submission_status IS DISTINCT FROM OLD.token_submission_status THEN 'token_submission_status' END,
      CASE WHEN NEW.token_submitted_at IS DISTINCT FROM OLD.token_submitted_at THEN 'token_submitted_at' END,
      CASE WHEN NEW.token_reviewed_at IS DISTINCT FROM OLD.token_reviewed_at THEN 'token_reviewed_at' END,
      CASE WHEN NEW.token_review_note IS DISTINCT FROM OLD.token_review_note THEN 'token_review_note' END
    ], ', ');

    RAISE WARNING
  'enforce_token_approval: unauthorized protected-field mutation by uid %, columns %',
  auth.uid(),
  v_changed_cols;

    -- Explicit rejection (ERRCODE 42501 = insufficient_privilege):
    -- No legitimate client path writes these columns directly. Failing loudly
    -- surfaces stale-UI/confused-creator bugs instead of hiding them.
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'token approval state cannot be modified directly';
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