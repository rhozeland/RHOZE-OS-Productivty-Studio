
CREATE OR REPLACE FUNCTION public.lock_split_config(_config_id uuid)
RETURNS public.revenue_split_configs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _config public.revenue_split_configs;
  _fee_bps INT;
  _override INT;
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

  -- Concierge Phase 2: prefer per-project override (e.g. 25%) when contract → project sets one
  IF _config.contract_id IS NOT NULL THEN
    SELECT p.platform_fee_bps_override INTO _override
    FROM public.project_contracts pc
    JOIN public.projects p ON p.id = pc.project_id
    WHERE pc.id = _config.contract_id;
  END IF;

  IF _override IS NOT NULL THEN
    _fee_bps := _override;
  ELSE
    BEGIN
      SELECT public.get_platform_fee_bps(_config.creator_id) INTO _fee_bps;
    EXCEPTION WHEN OTHERS THEN
      _fee_bps := 1500;
    END;
  END IF;
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
