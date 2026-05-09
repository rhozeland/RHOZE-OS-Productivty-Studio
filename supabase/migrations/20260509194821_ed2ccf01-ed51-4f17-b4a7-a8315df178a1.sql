
-- 1. Lock + fingerprint columns
ALTER TABLE public.revenue_split_configs
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_platform_fee_bps INT,
  ADD COLUMN IF NOT EXISTS splits_hash TEXT;

ALTER TABLE public.revenue_split_configs
  ALTER COLUMN creator_pct DROP NOT NULL,
  ALTER COLUMN curator_pct DROP NOT NULL,
  ALTER COLUMN buyback_pct DROP NOT NULL;

-- 2. Collaborator table
CREATE TABLE IF NOT EXISTS public.revenue_split_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES public.revenue_split_configs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  pct NUMERIC NOT NULL CHECK (pct >= 0 AND pct <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (config_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_rsc_config ON public.revenue_split_collaborators(config_id);
CREATE INDEX IF NOT EXISTS idx_rsc_user ON public.revenue_split_collaborators(user_id);
ALTER TABLE public.revenue_split_collaborators ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_split_collaborator(_config_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.revenue_split_configs c
    WHERE c.id = _config_id AND c.creator_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.revenue_split_collaborators
    WHERE config_id = _config_id AND user_id = _user_id
  );
$$;

DROP POLICY IF EXISTS "collaborators_select" ON public.revenue_split_collaborators;
CREATE POLICY "collaborators_select" ON public.revenue_split_collaborators
FOR SELECT TO authenticated
USING (public.is_split_collaborator(config_id, auth.uid()));

DROP POLICY IF EXISTS "lead_can_insert" ON public.revenue_split_collaborators;
CREATE POLICY "lead_can_insert" ON public.revenue_split_collaborators
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.revenue_split_configs c
  WHERE c.id = config_id AND c.creator_id = auth.uid() AND c.locked_at IS NULL
));

DROP POLICY IF EXISTS "lead_can_update" ON public.revenue_split_collaborators;
CREATE POLICY "lead_can_update" ON public.revenue_split_collaborators
FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.revenue_split_configs c
  WHERE c.id = config_id AND c.creator_id = auth.uid() AND c.locked_at IS NULL
));

DROP POLICY IF EXISTS "lead_can_delete" ON public.revenue_split_collaborators;
CREATE POLICY "lead_can_delete" ON public.revenue_split_collaborators
FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.revenue_split_configs c
  WHERE c.id = config_id AND c.creator_id = auth.uid() AND c.locked_at IS NULL
));

-- 3. Migrate existing rows
INSERT INTO public.revenue_split_collaborators (config_id, user_id, pct)
SELECT c.id, c.creator_id, COALESCE(c.creator_pct, 100) + COALESCE(c.buyback_pct, 0)
FROM public.revenue_split_configs c
WHERE c.creator_id IS NOT NULL
ON CONFLICT (config_id, user_id) DO NOTHING;

INSERT INTO public.revenue_split_collaborators (config_id, user_id, pct)
SELECT c.id, c.curator_id, COALESCE(c.curator_pct, 0)
FROM public.revenue_split_configs c
WHERE c.curator_id IS NOT NULL AND COALESCE(c.curator_pct, 0) > 0
ON CONFLICT (config_id, user_id) DO NOTHING;

-- 4. lock_split_config (RAISE format fixed)
CREATE OR REPLACE FUNCTION public.lock_split_config(_config_id UUID)
RETURNS public.revenue_split_configs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _config public.revenue_split_configs;
  _fee_bps INT;
  _hash TEXT;
  _total NUMERIC;
BEGIN
  SELECT * INTO _config FROM public.revenue_split_configs WHERE id = _config_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Split config not found';
  END IF;
  IF _config.creator_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the project lead can lock splits';
  END IF;
  IF _config.locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Splits are already locked';
  END IF;

  SELECT COALESCE(SUM(pct), 0) INTO _total
  FROM public.revenue_split_collaborators WHERE config_id = _config_id;

  IF ROUND(_total, 2) <> 100 THEN
    RAISE EXCEPTION 'Collaborator shares must sum to 100 (got %)', _total;
  END IF;

  BEGIN
    SELECT public.get_platform_fee_bps(_config.creator_id) INTO _fee_bps;
  EXCEPTION WHEN OTHERS THEN
    _fee_bps := 1500;
  END;
  IF _fee_bps IS NULL THEN _fee_bps := 1500; END IF;

  SELECT encode(digest(
    json_build_object(
      'config_id', _config_id,
      'platform_bps', _fee_bps,
      'collaborators', (
        SELECT json_agg(json_build_object('user_id', user_id, 'pct', pct) ORDER BY user_id)
        FROM public.revenue_split_collaborators WHERE config_id = _config_id
      )
    )::text, 'sha256'
  ), 'hex') INTO _hash;

  UPDATE public.revenue_split_configs
  SET locked_at = now(),
      locked_platform_fee_bps = _fee_bps,
      splits_hash = _hash,
      updated_at = now()
  WHERE id = _config_id
  RETURNING * INTO _config;

  RETURN _config;
END;
$$;

GRANT EXECUTE ON FUNCTION public.lock_split_config(UUID) TO authenticated;
