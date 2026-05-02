-- Add mint_address column to coin_launches
ALTER TABLE public.coin_launches
  ADD COLUMN IF NOT EXISTS mint_address text;

-- Generator: produces a base58-looking string ending in "RHOZE"
-- Total length 43 chars (typical Solana mint address length)
CREATE OR REPLACE FUNCTION public.generate_rhoze_vanity_address()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path TO 'public'
AS $$
DECLARE
  alphabet text := '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  result text := '';
  i int;
  rand_idx int;
BEGIN
  -- 38 random base58 chars + "RHOZE" suffix (5) = 43 total
  FOR i IN 1..38 LOOP
    rand_idx := 1 + floor(random() * length(alphabet))::int;
    result := result || substr(alphabet, rand_idx, 1);
  END LOOP;
  RETURN result || 'RHOZE';
END;
$$;

-- Trigger: assign a unique vanity address on insert if missing
CREATE OR REPLACE FUNCTION public.assign_coin_mint_address()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_candidate text;
  v_attempts int := 0;
BEGIN
  IF NEW.mint_address IS NOT NULL AND length(NEW.mint_address) > 0 THEN
    RETURN NEW;
  END IF;

  LOOP
    v_candidate := public.generate_rhoze_vanity_address();
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.coin_launches WHERE mint_address = v_candidate
    );
    v_attempts := v_attempts + 1;
    IF v_attempts > 10 THEN
      RAISE EXCEPTION 'Could not generate unique mint address';
    END IF;
  END LOOP;

  NEW.mint_address := v_candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_coin_mint_address ON public.coin_launches;
CREATE TRIGGER trg_assign_coin_mint_address
  BEFORE INSERT ON public.coin_launches
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_coin_mint_address();

-- Backfill existing rows
DO $$
DECLARE
  r record;
  v_candidate text;
  v_attempts int;
BEGIN
  FOR r IN SELECT id FROM public.coin_launches WHERE mint_address IS NULL LOOP
    v_attempts := 0;
    LOOP
      v_candidate := public.generate_rhoze_vanity_address();
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.coin_launches WHERE mint_address = v_candidate
      );
      v_attempts := v_attempts + 1;
      EXIT WHEN v_attempts > 10;
    END LOOP;
    UPDATE public.coin_launches SET mint_address = v_candidate WHERE id = r.id;
  END LOOP;
END $$;

-- Enforce uniqueness
ALTER TABLE public.coin_launches
  ADD CONSTRAINT coin_launches_mint_address_key UNIQUE (mint_address);
