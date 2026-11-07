-- Single-use, server-issued challenges for verify-token-grant.
-- Reuses wallet_verification_challenges: each token-grant signature is bound
-- to one user, wallet, creator and nonce, and is consumed atomically once.

ALTER TABLE public.wallet_verification_challenges
  ADD COLUMN IF NOT EXISTS creator_id uuid;

ALTER TABLE public.wallet_verification_challenges
  DROP CONSTRAINT IF EXISTS wallet_verification_challenges_purpose_check;
ALTER TABLE public.wallet_verification_challenges
  ADD CONSTRAINT wallet_verification_challenges_purpose_check
  CHECK (purpose IN ('rhoze-wallet-verification', 'rhoze-wallet-change', 'rhoze-token-grant'));

-- A token-grant signature authorizes access to this creator only.
ALTER TABLE public.wallet_verification_challenges
  DROP CONSTRAINT IF EXISTS wallet_verification_challenges_creator_check;
ALTER TABLE public.wallet_verification_challenges
  ADD CONSTRAINT wallet_verification_challenges_creator_check
  CHECK ((purpose = 'rhoze-token-grant') = (creator_id IS NOT NULL));

-- Cap token-grant and wallet-verification challenges separately, so open
-- unlock prompts can't block wallet verification (or vice versa).
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
       AND (purpose = 'rhoze-token-grant') = (NEW.purpose = 'rhoze-token-grant')
  ) >= 5 THEN
    RAISE EXCEPTION 'wallet_verification_challenge_limit';
  END IF;

  RETURN NEW;
END;
$$;
