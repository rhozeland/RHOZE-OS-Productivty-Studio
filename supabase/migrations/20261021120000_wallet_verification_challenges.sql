-- Verify creator wallet ownership.
--
-- One-time challenges for the `verify-wallet-ownership` edge function. A
-- creator's wallet is only written to profiles.wallet_address after the
-- wallet signs one of these challenges and the edge function verifies the
-- signature server-side.
--
-- Each challenge is bound to the authenticated user, the wallet being
-- verified, a random nonce, an expiry and a fixed purpose string. It is
-- consumed atomically (consumed_at IS NULL → now()) on the first verify
-- attempt, so a signed challenge can never be replayed. Consumed rows are
-- kept as an audit trail of successful/attempted verifications.
--
-- Only the edge function (service_role) touches this table. RLS is enabled
-- with no policies, and anon/authenticated have no grants.

CREATE TABLE IF NOT EXISTS public.wallet_verification_challenges (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address text NOT NULL,
  purpose        text NOT NULL DEFAULT 'rhoze-wallet-verification'
                 CHECK (purpose = 'rhoze-wallet-verification'),
  nonce          text NOT NULL UNIQUE CHECK (length(nonce) >= 32),
  message        text NOT NULL,
  issued_at      timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL,
  consumed_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > issued_at)
);

-- Outstanding-challenge lookups (rate limit + housekeeping) per user.
CREATE INDEX IF NOT EXISTS wallet_verification_challenges_open_idx
  ON public.wallet_verification_challenges (user_id, expires_at)
  WHERE consumed_at IS NULL;

ALTER TABLE public.wallet_verification_challenges ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.wallet_verification_challenges FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.wallet_verification_challenges TO service_role;

-- At most 5 open (unconsumed, unexpired) challenges per user. Checked under a
-- per-user transaction lock so concurrent requests can't race past the cap;
-- the edge function maps this error to HTTP 429.
CREATE OR REPLACE FUNCTION public.limit_open_wallet_verification_challenges()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('wallet_verification_challenges:' || NEW.user_id::text, 0)
  );

  IF (
    SELECT count(*)
      FROM public.wallet_verification_challenges
     WHERE user_id = NEW.user_id
       AND consumed_at IS NULL
       AND expires_at > now()
  ) >= 5 THEN
    RAISE EXCEPTION 'wallet_verification_challenge_limit';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS limit_open_wallet_verification_challenges_trg
  ON public.wallet_verification_challenges;
CREATE TRIGGER limit_open_wallet_verification_challenges_trg
  BEFORE INSERT ON public.wallet_verification_challenges
  FOR EACH ROW EXECUTE FUNCTION public.limit_open_wallet_verification_challenges();
