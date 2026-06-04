
CREATE OR REPLACE VIEW public.creator_tokens_public
WITH (security_invoker = false) AS
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
