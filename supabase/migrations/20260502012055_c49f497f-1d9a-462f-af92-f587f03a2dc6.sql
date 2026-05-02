CREATE OR REPLACE FUNCTION public.request_work_unlock(_work_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller        uuid := auth.uid();
  v_work          record;
  v_gating        jsonb;
  v_enabled       boolean;
  v_launch_id     uuid;
  v_min_tokens    numeric;
  v_gated_path    text;
  v_ticker        text;
  v_balance       numeric := 0;
  v_is_owner      boolean;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'auth_required');
  END IF;

  SELECT * INTO v_work FROM public.works WHERE id = _work_id;
  IF v_work IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'not_found');
  END IF;

  v_gating     := v_work.gating;
  v_enabled    := COALESCE((v_gating->>'enabled')::boolean, false);
  v_launch_id  := NULLIF(v_gating->>'launch_id', '')::uuid;
  v_min_tokens := COALESCE((v_gating->>'min_tokens')::numeric, 0);
  v_gated_path := v_gating->>'gated_path';
  v_is_owner   := (v_work.user_id = v_caller);

  IF NOT v_enabled OR v_gated_path IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'not_gated');
  END IF;

  IF v_launch_id IS NOT NULL THEN
    SELECT ticker INTO v_ticker FROM public.coin_launches WHERE id = v_launch_id;
    v_balance := public.get_user_token_holding(v_launch_id, v_caller);
  END IF;

  IF NOT v_is_owner AND v_balance < v_min_tokens THEN
    RETURN jsonb_build_object(
      'allowed',   false,
      'reason',    'insufficient_holdings',
      'balance',   v_balance,
      'threshold', v_min_tokens,
      'ticker',    v_ticker,
      'launch_id', v_launch_id
    );
  END IF;

  -- Caller qualifies. Return the path; client mints the signed URL.
  RETURN jsonb_build_object(
    'allowed',     true,
    'gated_path',  v_gated_path,
    'balance',     v_balance,
    'threshold',   v_min_tokens,
    'ticker',      v_ticker,
    'is_owner',    v_is_owner
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_work_unlock(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.request_work_unlock(uuid) TO authenticated;