
-- Recreate the discovery view with security_invoker=true so it respects the
-- querying user's RLS instead of the view owner's (fixes Supabase linter
-- 0010_security_definer_view).
DROP VIEW IF EXISTS public.creator_tokens_public;

CREATE VIEW public.creator_tokens_public
WITH (security_invoker = true) AS
SELECT
  p.id,
  p.user_id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.bio,
  p.archetype,
  p.verification_status,
  p.token_mint_address,
  p.token_ticker,
  p.show_token_chip,
  p.is_public
FROM public.profiles p
WHERE p.token_mint_address IS NOT NULL
  AND COALESCE(p.show_token_chip, true) = true
  AND COALESCE(p.is_public, true) = true
  AND COALESCE(p.ban_status, 'active') = 'active';

GRANT SELECT ON public.creator_tokens_public TO anon, authenticated;

-- Allow public read of profile rows that have opted into public token
-- discovery. The artist explicitly enabled token chip + public profile,
-- so exposing these existing public columns is intentional.
DROP POLICY IF EXISTS "Public can read creators with approved public tokens" ON public.profiles;
CREATE POLICY "Public can read creators with approved public tokens"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (
  token_mint_address IS NOT NULL
  AND COALESCE(show_token_chip, true) = true
  AND COALESCE(is_public, true) = true
  AND COALESCE(ban_status, 'active') = 'active'
);
