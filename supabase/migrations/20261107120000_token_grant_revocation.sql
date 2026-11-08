-- Token revocation rules for creator_token_grants.
-- A grant counts only while its mint is still the creator's live token
-- (profiles.token_mint_address, set only through admin approval). Replacing
-- or removing a creator's token revokes every grant for the old mint at once.

-- Scoped to the caller's own grants so it can't be used to probe creators' tokens.
CREATE OR REPLACE FUNCTION public.is_current_creator_token(_creator_id uuid, _mint_address text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.creator_token_grants g
      JOIN public.profiles p ON p.user_id = g.creator_id
     WHERE g.user_id = auth.uid()
       AND g.creator_id = _creator_id
       AND g.mint_address = _mint_address
       AND p.token_mint_address = _mint_address
       AND p.token_mint_address <> ''
  )
$$;

REVOKE ALL ON FUNCTION public.is_current_creator_token(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_current_creator_token(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.holds_creator_token(_creator_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.creator_token_grants
    WHERE user_id = auth.uid()
      AND creator_id = _creator_id
      AND expires_at > now()
      AND balance > 0
      AND public.is_own_linked_wallet(wallet_address)
      AND public.is_current_creator_token(creator_id, mint_address)
  )
$$;

DROP POLICY IF EXISTS "Users read own token grants" ON public.creator_token_grants;
CREATE POLICY "Users read own token grants"
ON public.creator_token_grants FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  AND public.is_own_linked_wallet(wallet_address)
  AND public.is_current_creator_token(creator_id, mint_address)
);

-- Revoking an approved primary coin (reject or un-primary) also removes it as
-- the creator's live token.
CREATE OR REPLACE FUNCTION public.mirror_primary_token_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    IF OLD.is_primary AND OLD.status = 'approved' THEN
      UPDATE public.profiles
         SET token_mint_address = NULL,
             token_ticker       = NULL
       WHERE user_id = OLD.user_id;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.is_primary AND OLD.status = 'approved'
     AND NOT (NEW.is_primary AND NEW.status = 'approved') THEN
    UPDATE public.profiles
       SET token_mint_address = NULL,
           token_ticker       = NULL
     WHERE user_id = OLD.user_id
       AND token_mint_address = OLD.mint_address;
  END IF;

  IF NEW.is_primary AND NEW.status = 'approved' THEN
    UPDATE public.profiles
       SET token_mint_address = NEW.mint_address,
           token_ticker       = NEW.ticker
     WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END
$$;
