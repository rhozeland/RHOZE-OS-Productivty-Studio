-- Pivot coin_launches to support PROFILE coins (one per creator, optional work).
-- Existing work-bound coins keep working; new launches go through create_profile_coin_launch.

ALTER TABLE public.coin_launches
  ALTER COLUMN work_id DROP NOT NULL;

-- Allow only one ACTIVE profile coin (work_id IS NULL) per creator.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_profile_coin_per_creator
  ON public.coin_launches(creator_id)
  WHERE work_id IS NULL AND status != 'cancelled';

-- ─── RPC: create a profile coin (no work required) ───
CREATE OR REPLACE FUNCTION public.create_profile_coin_launch(
  _ticker text,
  _name text,
  _description text DEFAULT NULL,
  _image_url text DEFAULT NULL,
  _creator_fee_bps integer DEFAULT 200,
  _platform_fee_bps integer DEFAULT 100,
  _lp_lock_months integer DEFAULT 12
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_launch_id uuid;
  v_clean_ticker text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.coin_launches
    WHERE creator_id = auth.uid()
      AND work_id IS NULL
      AND status != 'cancelled'
  ) THEN
    RAISE EXCEPTION 'You already have an active profile coin';
  END IF;

  v_clean_ticker := upper(regexp_replace(coalesce(_ticker, ''), '[^A-Za-z0-9]', '', 'g'));
  IF length(v_clean_ticker) < 2 OR length(v_clean_ticker) > 10 THEN
    RAISE EXCEPTION 'Ticker must be 2-10 alphanumeric characters';
  END IF;
  IF EXISTS (SELECT 1 FROM public.coin_launches WHERE ticker = v_clean_ticker) THEN
    RAISE EXCEPTION 'Ticker % is already taken', v_clean_ticker;
  END IF;

  IF _creator_fee_bps NOT BETWEEN 0 AND 500 THEN
    RAISE EXCEPTION 'Creator fee must be 0-5%%';
  END IF;
  IF _platform_fee_bps NOT BETWEEN 0 AND 500 THEN
    RAISE EXCEPTION 'Platform fee must be 0-5%%';
  END IF;
  IF _lp_lock_months NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'LP lock must be 1-120 months';
  END IF;

  INSERT INTO public.coin_launches (
    work_id, creator_id, ticker, name, description, image_url,
    creator_fee_bps, platform_fee_bps, lp_lock_months
  ) VALUES (
    NULL, auth.uid(), v_clean_ticker, _name, _description, _image_url,
    _creator_fee_bps, _platform_fee_bps, _lp_lock_months
  )
  RETURNING id INTO v_launch_id;

  RETURN v_launch_id;
END;
$$;