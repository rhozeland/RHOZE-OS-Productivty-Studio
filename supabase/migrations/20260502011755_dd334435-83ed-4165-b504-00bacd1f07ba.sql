-- 1. Private bucket for gated assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('gated-works', 'gated-works', false)
ON CONFLICT (id) DO NOTHING;

-- Owners can manage files inside their own folder: gated-works/{auth.uid()}/...
DROP POLICY IF EXISTS "Owners read own gated files" ON storage.objects;
CREATE POLICY "Owners read own gated files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'gated-works'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

DROP POLICY IF EXISTS "Owners upload own gated files" ON storage.objects;
CREATE POLICY "Owners upload own gated files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'gated-works'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

DROP POLICY IF EXISTS "Owners delete own gated files" ON storage.objects;
CREATE POLICY "Owners delete own gated files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'gated-works'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- Note: non-owners never read directly. They get short-lived signed URLs
-- minted by the SECURITY DEFINER RPC below, which bypasses RLS by design.

-- 2. Gating config on works
ALTER TABLE public.works
  ADD COLUMN IF NOT EXISTS gating jsonb;

COMMENT ON COLUMN public.works.gating IS
  'Token-gate config. Shape: {"enabled":bool,"launch_id":uuid,"min_tokens":number,"gated_path":text}. Null = ungated.';

-- 3. Simulated holdings helper (sums buys - sells from coin_trades)
CREATE OR REPLACE FUNCTION public.get_user_token_holding(_launch_id uuid, _user_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(
    CASE WHEN side = 'buy'  THEN token_amount
         WHEN side = 'sell' THEN -token_amount
         ELSE 0 END
  ), 0)
  FROM public.coin_trades
  WHERE launch_id = _launch_id
    AND trader_id = _user_id;
$$;

-- 4. Unlock RPC — server-side gate + signed URL mint
CREATE OR REPLACE FUNCTION public.request_work_unlock(_work_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
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
  v_signed_url    text;
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

  -- Look up ticker for nice messaging
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

  -- Mint a 5-minute signed URL via storage's built-in helper
  SELECT (storage.create_signed_url('gated-works', v_gated_path, 300)).signed_url
    INTO v_signed_url;

  RETURN jsonb_build_object(
    'allowed',   true,
    'signed_url', v_signed_url,
    'balance',   v_balance,
    'threshold', v_min_tokens,
    'ticker',    v_ticker,
    'is_owner',  v_is_owner
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_work_unlock(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_token_holding(uuid, uuid) TO authenticated;