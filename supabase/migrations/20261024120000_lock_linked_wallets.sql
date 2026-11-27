
-- Enforce verified, locked wallet bindings at the database layer.
-- Client users cannot modify wallet bindings directly; initial links require
-- signed verification and replacements require verified proof plus admin approval.

CREATE OR REPLACE FUNCTION public.guard_profile_wallet_binding()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.wallet_address, '') <> '' OR NEW.wallet_locked THEN
      RAISE EXCEPTION 'wallet_binding_locked: wallets are linked through wallet verification'
        USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.wallet_address IS DISTINCT FROM OLD.wallet_address
     OR NEW.wallet_locked IS DISTINCT FROM OLD.wallet_locked THEN
    RAISE EXCEPTION 'wallet_binding_locked: wallets are linked through wallet verification'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_wallet_binding_trg ON public.profiles;
CREATE TRIGGER guard_profile_wallet_binding_trg
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_wallet_binding();

UPDATE public.profiles
   SET wallet_locked = true
 WHERE COALESCE(wallet_address, '') <> ''
   AND NOT wallet_locked;

ALTER TABLE public.wallet_verification_challenges
  DROP CONSTRAINT IF EXISTS wallet_verification_challenges_purpose_check;
ALTER TABLE public.wallet_verification_challenges
  ADD CONSTRAINT wallet_verification_challenges_purpose_check
  CHECK (purpose IN ('rhoze-wallet-verification', 'rhoze-wallet-change'));

-- consumed_at is also set on failed attempts; verified_at only on success.
ALTER TABLE public.wallet_verification_challenges
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE public.wallet_verification_challenges
  DROP CONSTRAINT IF EXISTS wallet_verification_challenges_verified_check;
ALTER TABLE public.wallet_verification_challenges
  ADD CONSTRAINT wallet_verification_challenges_verified_check
  CHECK (verified_at IS NULL OR consumed_at IS NOT NULL);

-- A change signature authorizes replacing this exact wallet only.
ALTER TABLE public.wallet_verification_challenges
  ADD COLUMN IF NOT EXISTS replaces_wallet text;
ALTER TABLE public.wallet_verification_challenges
  DROP CONSTRAINT IF EXISTS wallet_verification_challenges_replaces_check;
ALTER TABLE public.wallet_verification_challenges
  ADD CONSTRAINT wallet_verification_challenges_replaces_check
  CHECK ((purpose = 'rhoze-wallet-change') = (COALESCE(replaces_wallet, '') <> ''));

ALTER TABLE public.wallet_change_requests
  ADD COLUMN IF NOT EXISTS verification_id uuid
  REFERENCES public.wallet_verification_challenges(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS wallet_change_requests_verification_key
  ON public.wallet_change_requests (verification_id)
  WHERE verification_id IS NOT NULL;

-- Existing pending requests have no ownership proof and can never be approved.
UPDATE public.wallet_change_requests
   SET status = 'rejected',
       admin_note = 'Replacement wallet was never verified. Request the change again.',
       processed_at = now(),
       updated_at = now()
 WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS wallet_change_requests_one_pending_key
  ON public.wallet_change_requests (user_id)
  WHERE status = 'pending';

-- Requests are only created by verify-wallet-ownership and only change state
-- through process_wallet_change; direct admin edits could replay a proof.
DROP POLICY IF EXISTS "Users can create wallet change requests" ON public.wallet_change_requests;
DROP POLICY IF EXISTS "Admins can update wallet change requests" ON public.wallet_change_requests;

-- The old overload trusted a caller-supplied _admin_id and was callable by anyone.
DROP FUNCTION IF EXISTS public.process_wallet_change(uuid, uuid, boolean, text);

CREATE OR REPLACE FUNCTION public.process_wallet_change(
  _request_id uuid,
  _approve boolean,
  _note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_request public.wallet_change_requests%ROWTYPE;
BEGIN
  IF v_admin IS NULL OR NOT public.has_role(v_admin, 'admin') THEN
    RAISE EXCEPTION 'Access denied: admin role required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_request
    FROM public.wallet_change_requests
   WHERE id = _request_id AND status = 'pending'
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or already processed';
  END IF;

  IF _approve THEN
    IF NOT EXISTS (
      SELECT 1
        FROM public.wallet_verification_challenges c
       WHERE c.id = v_request.verification_id
         AND c.user_id = v_request.user_id
         AND c.wallet_address = v_request.requested_wallet
         AND c.replaces_wallet = v_request.current_wallet
         AND c.purpose = 'rhoze-wallet-change'
         AND c.verified_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Requested wallet has not been verified by its owner';
    END IF;

    UPDATE public.profiles
       SET wallet_address = v_request.requested_wallet,
           wallet_locked = true,
           updated_at = now()
     WHERE user_id = v_request.user_id
       AND wallet_address = v_request.current_wallet;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Linked wallet changed since the request was made';
    END IF;

    UPDATE public.wallet_change_requests
       SET status = 'approved', processed_by = v_admin, processed_at = now(),
           admin_note = _note, updated_at = now()
     WHERE id = _request_id;
  ELSE
    UPDATE public.wallet_change_requests
       SET status = 'rejected', processed_by = v_admin, processed_at = now(),
           admin_note = _note, updated_at = now()
     WHERE id = _request_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.process_wallet_change(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_wallet_change(uuid, boolean, text) TO authenticated;
