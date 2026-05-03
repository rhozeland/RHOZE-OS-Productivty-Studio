-- Coins are now free-form "drops" that can optionally attach to an event or space.

ALTER TABLE public.coin_launches
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS space_id uuid REFERENCES public.studios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_coin_launches_event ON public.coin_launches(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_coin_launches_space ON public.coin_launches(space_id) WHERE space_id IS NOT NULL;

-- The legacy "one active profile coin per creator" rule no longer applies — a
-- creator can drop as many coins as they like (each tied to an event, space,
-- or just standalone).
DROP INDEX IF EXISTS public.uniq_profile_coin_per_creator;

-- Generalized drop-coin RPC. Optional event_id / space_id let the coin live
-- on those detail pages. No work_id, no per-creator uniqueness.
CREATE OR REPLACE FUNCTION public.create_drop_coin_launch(
  _ticker text,
  _name text,
  _description text DEFAULT NULL,
  _image_url text DEFAULT NULL,
  _event_id uuid DEFAULT NULL,
  _space_id uuid DEFAULT NULL,
  _creator_fee_bps integer DEFAULT 200,
  _platform_fee_bps integer DEFAULT 100,
  _lp_lock_months integer DEFAULT 12
)
RETURNS uuid
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

  -- If attaching to an event, caller must be the host.
  IF _event_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = _event_id AND host_id = auth.uid()) THEN
      RAISE EXCEPTION 'You are not the host of this event';
    END IF;
  END IF;

  -- If attaching to a space, caller must be the owner.
  IF _space_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.studios WHERE id = _space_id AND owner_id = auth.uid()) THEN
      RAISE EXCEPTION 'You are not the owner of this space';
    END IF;
  END IF;

  INSERT INTO public.coin_launches (
    work_id, creator_id, ticker, name, description, image_url,
    event_id, space_id,
    creator_fee_bps, platform_fee_bps, lp_lock_months
  ) VALUES (
    NULL, auth.uid(), v_clean_ticker, _name, _description, _image_url,
    _event_id, _space_id,
    _creator_fee_bps, _platform_fee_bps, _lp_lock_months
  )
  RETURNING id INTO v_launch_id;

  RETURN v_launch_id;
END;
$$;