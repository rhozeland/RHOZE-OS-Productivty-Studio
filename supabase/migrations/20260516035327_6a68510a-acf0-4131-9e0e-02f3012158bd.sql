-- Re-do the public chart helper using md5 (no pgcrypto dep needed).
DROP VIEW IF EXISTS public.coin_trades_public;
CREATE VIEW public.coin_trades_public
WITH (security_invoker = on) AS
SELECT
  id,
  launch_id,
  side,
  sol_amount,
  token_amount,
  fee_sol,
  price_per_token,
  created_at,
  md5(trader_id::text || ':' || launch_id::text) AS trader_hash
FROM public.coin_trades;

CREATE OR REPLACE FUNCTION public.get_coin_trades_public(
  _launch_id uuid,
  _limit int DEFAULT 2000,
  _since timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  launch_id uuid,
  side text,
  sol_amount numeric,
  token_amount numeric,
  fee_sol numeric,
  price_per_token numeric,
  created_at timestamptz,
  trader_hash text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    t.launch_id,
    t.side,
    t.sol_amount,
    t.token_amount,
    t.fee_sol,
    t.price_per_token,
    t.created_at,
    md5(t.trader_id::text || ':' || t.launch_id::text) AS trader_hash
  FROM public.coin_trades t
  WHERE t.launch_id = _launch_id
    AND (_since IS NULL OR t.created_at >= _since)
  ORDER BY t.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 5000));
$$;

GRANT EXECUTE ON FUNCTION public.get_coin_trades_public(uuid, int, timestamptz) TO anon, authenticated;