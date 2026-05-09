
ALTER TABLE public.curator_invites
  ADD COLUMN IF NOT EXISTS pct NUMERIC NOT NULL DEFAULT 10
    CHECK (pct >= 0 AND pct <= 100);

ALTER TABLE public.revenue_split_logs
  ADD COLUMN IF NOT EXISTS platform_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS platform_fee_bps INT,
  ADD COLUMN IF NOT EXISTS splits_hash TEXT,
  ADD COLUMN IF NOT EXISTS splits JSONB;

-- Trigger: on accept, fold the invitee into the collaborators table
CREATE OR REPLACE FUNCTION public.handle_curator_invite_accept()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lead_id UUID;
  _lead_pct NUMERIC;
  _is_locked BOOLEAN;
BEGIN
  IF NEW.status <> 'accepted' OR OLD.status = 'accepted' THEN
    RETURN NEW;
  END IF;

  SELECT creator_id, locked_at IS NOT NULL
  INTO _lead_id, _is_locked
  FROM public.revenue_split_configs
  WHERE id = NEW.split_config_id;

  IF _is_locked THEN
    RAISE EXCEPTION 'Splits are already locked';
  END IF;

  SELECT pct INTO _lead_pct
  FROM public.revenue_split_collaborators
  WHERE config_id = NEW.split_config_id AND user_id = _lead_id;

  IF _lead_pct IS NULL OR _lead_pct < NEW.pct THEN
    RAISE EXCEPTION 'Lead does not have enough share to accept this invite';
  END IF;

  -- Decrement lead, insert/upsert invitee
  UPDATE public.revenue_split_collaborators
  SET pct = pct - NEW.pct
  WHERE config_id = NEW.split_config_id AND user_id = _lead_id;

  INSERT INTO public.revenue_split_collaborators (config_id, user_id, pct)
  VALUES (NEW.split_config_id, NEW.invitee_id, NEW.pct)
  ON CONFLICT (config_id, user_id)
  DO UPDATE SET pct = public.revenue_split_collaborators.pct + EXCLUDED.pct;

  NEW.responded_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS curator_invite_accept_tg ON public.curator_invites;
CREATE TRIGGER curator_invite_accept_tg
BEFORE UPDATE ON public.curator_invites
FOR EACH ROW
EXECUTE FUNCTION public.handle_curator_invite_accept();
