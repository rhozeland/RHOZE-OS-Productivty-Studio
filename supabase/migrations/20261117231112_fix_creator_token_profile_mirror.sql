-- US169 / Task #172: Consolidate profile and creator_tokens synchronization
--
-- Step 3: Fix creator_tokens -> profiles mirror synchronization.
-- Keeps the profile compatibility fields synchronized with the current
-- approved primary creator token and clears stale profile values when
-- that token is demoted, rejected, or deleted.
--
-- Design doc: Docs/canonical-creator-token-data-model.md sections 7 & 12

CREATE OR REPLACE FUNCTION public.mirror_primary_token_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- DELETE: clear mirror if the deleted row was primary+approved
  IF (TG_OP = 'DELETE') THEN
    IF OLD.is_primary AND OLD.status = 'approved' THEN
      UPDATE public.profiles
         SET token_mint_address = NULL,
             token_ticker       = NULL
       WHERE user_id = OLD.user_id
         AND (token_mint_address = OLD.mint_address OR token_mint_address IS NULL);
    END IF;
    RETURN OLD;
  END IF;

  -- INSERT/UPDATE: if NEW is primary+approved, set mirror
  IF NEW.is_primary AND NEW.status = 'approved' THEN
    UPDATE public.profiles
       SET token_mint_address = NEW.mint_address,
           token_ticker       = NEW.ticker
     WHERE user_id = NEW.user_id;
  END IF;

  -- UPDATE: if NEW is no longer primary+approved but OLD was, clear mirror
  -- Only clear if the profile mirror still points at the OLD mint (order independence)
  IF (TG_OP = 'UPDATE') THEN
    IF NOT (NEW.is_primary AND NEW.status = 'approved')
       AND (OLD.is_primary AND OLD.status = 'approved')
       AND EXISTS (
         SELECT 1 FROM public.profiles p
          WHERE p.user_id = NEW.user_id
            AND p.token_mint_address = OLD.mint_address
       ) THEN
      UPDATE public.profiles
         SET token_mint_address = NULL,
             token_ticker       = NULL
       WHERE user_id = NEW.user_id
         AND token_mint_address = OLD.mint_address;
    END IF;
  END IF;

  RETURN NEW;
END
$$;
