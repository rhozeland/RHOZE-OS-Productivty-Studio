-- =========================================================
-- ARTIST COIN LAUNCHPAD (Sub-step 4a: DB + simulated curve)
-- =========================================================

-- ---------- coin_launches ----------
CREATE TABLE public.coin_launches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id         uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  creator_id      uuid NOT NULL,
  ticker          text NOT NULL,
  name            text NOT NULL,
  description     text,
  image_url       text,

  -- Status: live | graduated | cancelled
  status          text NOT NULL DEFAULT 'live',

  -- Bonding-curve params (constant product x*y=k, all in human units)
  virtual_sol_reserves    numeric NOT NULL DEFAULT 30,        -- "virtual" SOL seed
  virtual_token_reserves  numeric NOT NULL DEFAULT 1073000000,-- 1.073B virtual tokens
  real_sol_reserves       numeric NOT NULL DEFAULT 0,         -- actual SOL collected
  real_token_reserves     numeric NOT NULL DEFAULT 793100000, -- circulating supply in curve
  total_supply            numeric NOT NULL DEFAULT 1000000000,-- 1B total
  graduation_sol_target   numeric NOT NULL DEFAULT 85,        -- SOL to migrate to Raydium

  -- Fees (basis points: 200 = 2%)
  creator_fee_bps   integer NOT NULL DEFAULT 200,
  platform_fee_bps  integer NOT NULL DEFAULT 100,
  creator_fees_earned   numeric NOT NULL DEFAULT 0,
  platform_fees_earned  numeric NOT NULL DEFAULT 0,

  -- Graduation config
  lp_lock_months   integer NOT NULL DEFAULT 12,
  graduated_at     timestamptz,
  raydium_pool     text,
  mint_address     text,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT coin_launches_ticker_unique UNIQUE (ticker),
  CONSTRAINT coin_launches_status_chk CHECK (status IN ('live','graduated','cancelled')),
  CONSTRAINT coin_launches_creator_fee_chk CHECK (creator_fee_bps BETWEEN 0 AND 1000),
  CONSTRAINT coin_launches_platform_fee_chk CHECK (platform_fee_bps BETWEEN 0 AND 1000),
  CONSTRAINT coin_launches_lp_lock_chk CHECK (lp_lock_months BETWEEN 1 AND 120)
);

CREATE INDEX idx_coin_launches_status ON public.coin_launches(status);
CREATE INDEX idx_coin_launches_creator ON public.coin_launches(creator_id);
CREATE INDEX idx_coin_launches_work ON public.coin_launches(work_id);
CREATE INDEX idx_coin_launches_created ON public.coin_launches(created_at DESC);

ALTER TABLE public.coin_launches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Launches are publicly viewable"
  ON public.coin_launches FOR SELECT USING (true);

-- All writes go through SECURITY DEFINER functions; no direct INSERT/UPDATE/DELETE policies.

CREATE TRIGGER touch_coin_launches
  BEFORE UPDATE ON public.coin_launches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- coin_trades ----------
CREATE TABLE public.coin_trades (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  launch_id     uuid NOT NULL REFERENCES public.coin_launches(id) ON DELETE CASCADE,
  trader_id     uuid NOT NULL,
  side          text NOT NULL,              -- 'buy' | 'sell'
  sol_amount    numeric NOT NULL,           -- SOL in (buy) or out (sell), gross
  token_amount  numeric NOT NULL,           -- tokens out (buy) or in (sell)
  fee_sol       numeric NOT NULL DEFAULT 0, -- total fees in SOL
  price_per_token numeric NOT NULL,         -- effective price at trade
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coin_trades_side_chk CHECK (side IN ('buy','sell'))
);

CREATE INDEX idx_coin_trades_launch ON public.coin_trades(launch_id, created_at DESC);
CREATE INDEX idx_coin_trades_trader ON public.coin_trades(trader_id, created_at DESC);

ALTER TABLE public.coin_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trades are publicly viewable"
  ON public.coin_trades FOR SELECT USING (true);

-- ---------- coin_holdings ----------
CREATE TABLE public.coin_holdings (
  launch_id    uuid NOT NULL REFERENCES public.coin_launches(id) ON DELETE CASCADE,
  trader_id    uuid NOT NULL,
  balance      numeric NOT NULL DEFAULT 0,
  sol_invested numeric NOT NULL DEFAULT 0,  -- net SOL in (gross buys - gross sells)
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (launch_id, trader_id)
);

CREATE INDEX idx_coin_holdings_trader ON public.coin_holdings(trader_id);

ALTER TABLE public.coin_holdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Holders can read their own holdings"
  ON public.coin_holdings FOR SELECT
  USING (auth.uid() = trader_id);

CREATE POLICY "Launch creator can read all holdings for their coin"
  ON public.coin_holdings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.coin_launches l
    WHERE l.id = launch_id AND l.creator_id = auth.uid()
  ));

-- =========================================================
-- FUNCTIONS
-- =========================================================

-- Create a launch (gated to Verified IP owner)
CREATE OR REPLACE FUNCTION public.create_coin_launch(
  _work_id uuid,
  _ticker text,
  _name text,
  _description text DEFAULT NULL,
  _image_url text DEFAULT NULL,
  _creator_fee_bps integer DEFAULT 200,
  _platform_fee_bps integer DEFAULT 100,
  _lp_lock_months integer DEFAULT 12
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_signature text;
  v_launch_id uuid;
  v_clean_ticker text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT user_id, solana_signature INTO v_owner, v_signature
  FROM public.works WHERE id = _work_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Work not found';
  END IF;
  IF v_owner != auth.uid() THEN
    RAISE EXCEPTION 'Only the work owner can launch a coin';
  END IF;
  IF v_signature IS NULL THEN
    RAISE EXCEPTION 'Work must be Verified IP before launching a coin';
  END IF;

  IF EXISTS (SELECT 1 FROM public.coin_launches WHERE work_id = _work_id AND status != 'cancelled') THEN
    RAISE EXCEPTION 'This work already has an active or graduated coin';
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
  )
  VALUES (
    _work_id, auth.uid(), v_clean_ticker, _name, _description, _image_url,
    _creator_fee_bps, _platform_fee_bps, _lp_lock_months
  )
  RETURNING id INTO v_launch_id;

  RETURN v_launch_id;
END;
$$;

-- Cancel a launch (owner only, only while live and never traded)
CREATE OR REPLACE FUNCTION public.cancel_coin_launch(_launch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator uuid;
  v_status text;
  v_trades int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT creator_id, status INTO v_creator, v_status
  FROM public.coin_launches WHERE id = _launch_id FOR UPDATE;

  IF v_creator IS NULL THEN RAISE EXCEPTION 'Launch not found'; END IF;
  IF v_creator != auth.uid() THEN RAISE EXCEPTION 'Only the creator can cancel'; END IF;
  IF v_status != 'live' THEN RAISE EXCEPTION 'Only live launches can be cancelled'; END IF;

  SELECT count(*) INTO v_trades FROM public.coin_trades WHERE launch_id = _launch_id;
  IF v_trades > 0 THEN RAISE EXCEPTION 'Cannot cancel after trades exist'; END IF;

  UPDATE public.coin_launches SET status = 'cancelled', updated_at = now() WHERE id = _launch_id;
END;
$$;

-- Simulated bonding-curve trade.
-- For 'buy': _amount = SOL in (gross). For 'sell': _amount = tokens in.
-- Returns jsonb with the trade result.
CREATE OR REPLACE FUNCTION public.simulate_coin_trade(
  _launch_id uuid,
  _side text,
  _amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_launch record;
  v_total_fee_bps integer;
  v_fee_sol numeric;
  v_creator_fee numeric;
  v_platform_fee numeric;
  v_net_sol numeric;
  v_tokens_out numeric;
  v_sol_out numeric;
  v_new_virt_sol numeric;
  v_new_virt_tok numeric;
  v_new_real_sol numeric;
  v_new_real_tok numeric;
  v_k numeric;
  v_price numeric;
  v_holding numeric;
  v_graduated boolean := false;
  v_trade_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF _side NOT IN ('buy','sell') THEN
    RAISE EXCEPTION 'Side must be buy or sell';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  SELECT * INTO v_launch FROM public.coin_launches WHERE id = _launch_id FOR UPDATE;
  IF v_launch IS NULL THEN RAISE EXCEPTION 'Launch not found'; END IF;
  IF v_launch.status != 'live' THEN RAISE EXCEPTION 'Trading closed for this coin'; END IF;

  v_total_fee_bps := v_launch.creator_fee_bps + v_launch.platform_fee_bps;
  v_k := v_launch.virtual_sol_reserves * v_launch.virtual_token_reserves;

  IF _side = 'buy' THEN
    -- Fees taken off the top
    v_fee_sol := round(_amount * v_total_fee_bps / 10000.0, 9);
    v_creator_fee := round(_amount * v_launch.creator_fee_bps / 10000.0, 9);
    v_platform_fee := v_fee_sol - v_creator_fee;
    v_net_sol := _amount - v_fee_sol;

    v_new_virt_sol := v_launch.virtual_sol_reserves + v_net_sol;
    v_new_virt_tok := v_k / v_new_virt_sol;
    v_tokens_out := v_launch.virtual_token_reserves - v_new_virt_tok;

    IF v_tokens_out > v_launch.real_token_reserves THEN
      RAISE EXCEPTION 'Not enough liquidity left on the curve';
    END IF;

    v_new_real_sol := v_launch.real_sol_reserves + v_net_sol;
    v_new_real_tok := v_launch.real_token_reserves - v_tokens_out;
    v_price := v_net_sol / v_tokens_out;

    -- Upsert holdings (+balance, +sol_invested)
    INSERT INTO public.coin_holdings (launch_id, trader_id, balance, sol_invested)
    VALUES (_launch_id, auth.uid(), v_tokens_out, _amount)
    ON CONFLICT (launch_id, trader_id) DO UPDATE
      SET balance = coin_holdings.balance + EXCLUDED.balance,
          sol_invested = coin_holdings.sol_invested + EXCLUDED.sol_invested,
          updated_at = now();

    INSERT INTO public.coin_trades (launch_id, trader_id, side, sol_amount, token_amount, fee_sol, price_per_token)
    VALUES (_launch_id, auth.uid(), 'buy', _amount, v_tokens_out, v_fee_sol, v_price)
    RETURNING id INTO v_trade_id;

    -- Graduation check
    IF v_new_real_sol >= v_launch.graduation_sol_target THEN
      v_graduated := true;
    END IF;

    UPDATE public.coin_launches
      SET virtual_sol_reserves = v_new_virt_sol,
          virtual_token_reserves = v_new_virt_tok,
          real_sol_reserves = v_new_real_sol,
          real_token_reserves = v_new_real_tok,
          creator_fees_earned = creator_fees_earned + v_creator_fee,
          platform_fees_earned = platform_fees_earned + v_platform_fee,
          status = CASE WHEN v_graduated THEN 'graduated' ELSE status END,
          graduated_at = CASE WHEN v_graduated THEN now() ELSE graduated_at END,
          updated_at = now()
      WHERE id = _launch_id;

    RETURN jsonb_build_object(
      'trade_id', v_trade_id,
      'side', 'buy',
      'sol_in', _amount,
      'tokens_out', v_tokens_out,
      'fee_sol', v_fee_sol,
      'price', v_price,
      'graduated', v_graduated
    );
  ELSE
    -- SELL: tokens in, SOL out (after fee on the SOL leg)
    SELECT balance INTO v_holding FROM public.coin_holdings
      WHERE launch_id = _launch_id AND trader_id = auth.uid() FOR UPDATE;

    IF v_holding IS NULL OR v_holding < _amount THEN
      RAISE EXCEPTION 'Insufficient token balance';
    END IF;

    v_new_virt_tok := v_launch.virtual_token_reserves + _amount;
    v_new_virt_sol := v_k / v_new_virt_tok;
    v_sol_out := v_launch.virtual_sol_reserves - v_new_virt_sol;  -- gross SOL

    IF v_sol_out > v_launch.real_sol_reserves THEN
      RAISE EXCEPTION 'Not enough SOL in the curve';
    END IF;

    v_fee_sol := round(v_sol_out * v_total_fee_bps / 10000.0, 9);
    v_creator_fee := round(v_sol_out * v_launch.creator_fee_bps / 10000.0, 9);
    v_platform_fee := v_fee_sol - v_creator_fee;
    v_net_sol := v_sol_out - v_fee_sol;  -- what trader receives

    v_new_real_sol := v_launch.real_sol_reserves - v_sol_out;
    v_new_real_tok := v_launch.real_token_reserves + _amount;
    v_price := v_net_sol / _amount;

    UPDATE public.coin_holdings
      SET balance = balance - _amount,
          sol_invested = GREATEST(sol_invested - v_net_sol, 0),
          updated_at = now()
      WHERE launch_id = _launch_id AND trader_id = auth.uid();

    INSERT INTO public.coin_trades (launch_id, trader_id, side, sol_amount, token_amount, fee_sol, price_per_token)
    VALUES (_launch_id, auth.uid(), 'sell', v_net_sol, _amount, v_fee_sol, v_price)
    RETURNING id INTO v_trade_id;

    UPDATE public.coin_launches
      SET virtual_sol_reserves = v_new_virt_sol,
          virtual_token_reserves = v_new_virt_tok,
          real_sol_reserves = v_new_real_sol,
          real_token_reserves = v_new_real_tok,
          creator_fees_earned = creator_fees_earned + v_creator_fee,
          platform_fees_earned = platform_fees_earned + v_platform_fee,
          updated_at = now()
      WHERE id = _launch_id;

    RETURN jsonb_build_object(
      'trade_id', v_trade_id,
      'side', 'sell',
      'tokens_in', _amount,
      'sol_out_net', v_net_sol,
      'sol_out_gross', v_sol_out,
      'fee_sol', v_fee_sol,
      'price', v_price,
      'graduated', false
    );
  END IF;
END;
$$;