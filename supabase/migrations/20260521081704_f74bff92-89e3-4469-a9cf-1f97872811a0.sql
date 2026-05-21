-- v10.2 — Link tokens directly to creator profiles
-- Adds discovery-only metadata so the read-only TokenDiscoveryChip and
-- the upcoming Trending Tokens lane on Discover can resolve a creator's
-- token without depending on the simulated launchpad tables.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS token_mint_address text,
  ADD COLUMN IF NOT EXISTS token_ticker text;

CREATE INDEX IF NOT EXISTS idx_profiles_token_mint
  ON public.profiles(token_mint_address)
  WHERE token_mint_address IS NOT NULL;

-- Backfill from any existing launch rows (most recent non-cancelled per creator)
UPDATE public.profiles p
SET
  token_mint_address = COALESCE(p.token_mint_address, sub.mint_address),
  token_ticker       = COALESCE(p.token_ticker, sub.ticker)
FROM (
  SELECT DISTINCT ON (creator_id)
    creator_id, mint_address, ticker
  FROM public.coin_launches
  WHERE status <> 'cancelled'
    AND mint_address IS NOT NULL
  ORDER BY creator_id, created_at DESC
) sub
WHERE sub.creator_id = p.id;
