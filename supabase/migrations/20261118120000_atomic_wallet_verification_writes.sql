-- Apply a verified wallet signature and record its proof atomically.
--
-- verify-wallet-ownership used to make the change it was verifying (link the
-- wallet, or file a wallet change request) and then set the challenge's
-- verified_at in a second, separate write. If that second write failed:
--
--   * change: the request stayed pending without a verified challenge.
--     process_wallet_change refused to approve it, and
--     wallet_change_requests_one_pending_key stopped the user from filing a
--     new one.
--   * link: the wallet was linked but the caller got a server error, and the
--     audit trail had no record of the proof.
--
-- Each function below does both writes in one transaction, so they commit or
-- roll back together.
--
-- Only the edge function (service_role) calls these, and only after it has
-- checked the wallet's signature. They run with the caller's rights, not
-- SECURITY DEFINER; guard_profile_wallet_binding lets service_role through.

-- Links the challenge's wallet to an account that has none. Returns
-- 'linked' (also when this same wallet is already linked, e.g. from another
-- tab), 'wallet_already_linked' (a different wallet is linked) or
-- 'profile_not_found'. A wallet held by another account violates
-- profiles_wallet_address_key (23505) and rolls the whole call back.
CREATE OR REPLACE FUNCTION public.link_verified_wallet(
  _user_id uuid,
  _challenge_id uuid
)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_challenge public.wallet_verification_challenges%ROWTYPE;
  v_current text;
BEGIN
  -- The challenge must be this user's link challenge, consumed by the
  -- verify attempt that checked its signature, and not yet used as proof.
  SELECT * INTO v_challenge
    FROM public.wallet_verification_challenges
   WHERE id = _challenge_id
     AND user_id = _user_id
     AND purpose = 'rhoze-wallet-verification'
     AND consumed_at IS NOT NULL
     AND verified_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'wallet_link_invalid_challenge';
  END IF;

  UPDATE public.profiles
     SET wallet_address = v_challenge.wallet_address,
         wallet_locked = true
   WHERE user_id = _user_id
     AND COALESCE(wallet_address, '') = '';

  IF NOT FOUND THEN
    SELECT wallet_address INTO v_current
      FROM public.profiles
     WHERE user_id = _user_id;
    IF NOT FOUND THEN
      RETURN 'profile_not_found';
    END IF;
    IF v_current IS DISTINCT FROM v_challenge.wallet_address THEN
      RETURN 'wallet_already_linked';
    END IF;
  END IF;

  UPDATE public.wallet_verification_challenges
     SET verified_at = now()
   WHERE id = _challenge_id;

  RETURN 'linked';
END;
$$;

REVOKE ALL ON FUNCTION public.link_verified_wallet(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_verified_wallet(uuid, uuid)
  TO service_role;

-- Files a pending wallet change request backed by the challenge and returns
-- its id. A second pending request for the user violates
-- wallet_change_requests_one_pending_key (23505), which rolls the whole call
-- back, so the proof is never recorded without its request.
CREATE OR REPLACE FUNCTION public.file_wallet_change_request(
  _user_id uuid,
  _challenge_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_challenge public.wallet_verification_challenges%ROWTYPE;
  v_request_id uuid;
BEGIN
  SELECT * INTO v_challenge
    FROM public.wallet_verification_challenges
   WHERE id = _challenge_id
     AND user_id = _user_id
     AND purpose = 'rhoze-wallet-change'
     AND consumed_at IS NOT NULL
     AND verified_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'wallet_change_invalid_challenge';
  END IF;

  INSERT INTO public.wallet_change_requests (
    user_id, current_wallet, requested_wallet, verification_id, status
  )
  VALUES (
    _user_id, v_challenge.replaces_wallet, v_challenge.wallet_address,
    v_challenge.id, 'pending'
  )
  RETURNING id INTO v_request_id;

  UPDATE public.wallet_verification_challenges
     SET verified_at = now()
   WHERE id = _challenge_id;

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.file_wallet_change_request(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.file_wallet_change_request(uuid, uuid)
  TO service_role;
