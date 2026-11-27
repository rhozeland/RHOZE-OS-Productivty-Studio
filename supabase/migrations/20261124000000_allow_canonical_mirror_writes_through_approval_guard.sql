-- US107 Task #109 / US169 Task #188 Increment 1 -
-- Allow canonical creator_tokens -> profiles mirror writes through the approval guard.
--
-- This file reproduces public.enforce_token_approval() from
-- 20261108000000_enforce_token_approval_reject_unauthorized.sql verbatim, with ONE
-- addition: the canonical mirror exemption (branch 0 inside Case 1).
--
-- WHY THE EXEMPTION EXISTS:
--   mirror_primary_token_to_profile() (migration 20261117231112) updates
--   profiles.token_mint_address / token_ticker from the creator's approved primary
--   creator_tokens row. When that trigger chain runs under an authenticated NON-admin
--   JWT (e.g. a future creator-facing RPC that promotes their own primary token),
--   the nested profiles UPDATE re-enters this trigger, and without this exemption
--   Case 1(b) below would hijack the canonical mirror write into a phantom pending
--   submission (live columns reverted, pending columns populated).
--
-- WHY A DIRECT PROFILE EDIT CANNOT USE IT:
--   pg_trigger_depth() is 1 for any client-issued UPDATE on profiles; only a write
--   nested inside another trigger (the creator_tokens mirror trigger) reaches
--   depth >= 2, and clients cannot create triggers or SECURITY DEFINER functions.
--   On top of that, the written mint AND ticker must exactly equal the creator's
--   current approved primary creator_tokens row, so even a hypothetical depth-2
--   write can only converge the profile to canonical state - it can never
--   introduce divergent values.
--
-- RELATIONSHIP TO mirror_primary_token_to_profile():
--   The mirror's demote/reject/delete clear branches write NULL/NULL and
--   intentionally do NOT take this exemption; they pass through the existing
--   Case 1(a) "clearing both" allowance, which needs no change.

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

    -- (0) US169 / Task #188 Increment 1: canonical mirror exemption (see header).
    --     Trusted only when BOTH hold:
    --     - the write is trigger-nested (pg_trigger_depth() >= 2), i.e. it comes
    --       from mirror_primary_token_to_profile(), not from a client statement;
    --     - the written values exactly equal the creator's current approved
    --       primary creator_tokens row (convergence to canonical state only).
    IF pg_trigger_depth() >= 2
       AND EXISTS (
         SELECT 1
           FROM public.creator_tokens ct
          WHERE ct.user_id = NEW.user_id
            AND ct.is_primary = true
            AND ct.status = 'approved'
            AND ct.mint_address = NEW.token_mint_address
            AND ct.ticker      = NEW.token_ticker
       ) THEN
      RETURN NEW;
    END IF;

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

  -- Case 2 (unchanged): live columns unchanged, but any of the six review-state
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