-- Bind token-gated access to the account's verified wallet.
-- A grant only counts while its wallet is still the wallet linked to the
-- grantee's profile (set only after a signed ownership proof). Grants issued
-- for any other wallet, or for a wallet since replaced, unlock nothing.

-- Scoped to auth.uid() so it can't reveal other accounts' wallets.
CREATE OR REPLACE FUNCTION public.is_own_linked_wallet(_wallet_address text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.profiles
     WHERE user_id = auth.uid()
       AND wallet_address = _wallet_address
       AND wallet_address <> ''
  )
$$;

REVOKE ALL ON FUNCTION public.is_own_linked_wallet(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_own_linked_wallet(text) TO authenticated;

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
  )
$$;

-- Keeps the client's view of its grants in line with holds_creator_token().
DROP POLICY IF EXISTS "Users read own token grants" ON public.creator_token_grants;
CREATE POLICY "Users read own token grants"
ON public.creator_token_grants FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  AND public.is_own_linked_wallet(wallet_address)
);

DELETE FROM public.creator_token_grants g
 WHERE NOT EXISTS (
   SELECT 1
     FROM public.profiles p
    WHERE p.user_id = g.user_id
      AND p.wallet_address = g.wallet_address
 );
