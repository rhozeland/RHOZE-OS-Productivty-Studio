-- A wallet can be linked to only one account. Solana addresses are
-- case-sensitive base58, so values are compared exactly as stored. NULL and
-- '' both mean "no wallet linked".

DO $$
DECLARE
  v_duplicates text;
BEGIN
  SELECT string_agg(format('%s: user_ids %s', wallet_address, user_ids), E'\n')
    INTO v_duplicates
    FROM (
      SELECT wallet_address,
             string_agg(user_id::text, ', ' ORDER BY user_id) AS user_ids
        FROM public.profiles
       WHERE wallet_address <> ''
       GROUP BY wallet_address
      HAVING count(*) > 1
    ) d;

  IF v_duplicates IS NOT NULL THEN
    RAISE EXCEPTION 'profiles_wallet_address_duplicates: some wallets are linked to more than one account'
      USING DETAIL = v_duplicates,
            HINT = 'Unlink each wallet from all but one account by hand, then re-run this migration.';
  END IF;
END
$$;

-- Final authority for concurrent links and approved wallet changes;
-- verify-wallet-ownership reports violations as wallet_already_in_use.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_wallet_address_key
  ON public.profiles (wallet_address)
  WHERE wallet_address <> '';
