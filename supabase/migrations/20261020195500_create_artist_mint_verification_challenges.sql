CREATE TABLE public.artist_mint_verification_challenges (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mint_address text NOT NULL,
  creator_wallet text NOT NULL,
  message text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT artist_mint_challenge_expiration_after_creation
    CHECK (expires_at > created_at)
);

CREATE INDEX artist_mint_verification_challenges_expiry_idx
  ON public.artist_mint_verification_challenges (expires_at);

ALTER TABLE public.artist_mint_verification_challenges ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.artist_mint_verification_challenges
  FROM anon, authenticated;
GRANT ALL ON TABLE public.artist_mint_verification_challenges TO service_role;
