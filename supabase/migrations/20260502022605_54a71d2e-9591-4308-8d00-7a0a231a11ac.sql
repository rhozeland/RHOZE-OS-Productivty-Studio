-- $RHOZE ↔ coin swap (simulated). Wraps the existing bonding curve and
-- debits/credits user_credits.balance ($RHOZE) instead of fake SOL.
-- The curve's "sol reserves" are reused as abstract "$RHOZE reserves" 1:1
-- since trades were already simulated.

CREATE TABLE IF NOT EXISTS public.coin_swap_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  launch_id uuid NOT NULL REFERENCES public.coin_launches(id) ON DELETE CASCADE,
  side text NOT NULL CHECK (side IN ('buy','sell')),
  rhoze_amount numeric NOT NULL,           -- $RHOZE in (buy) or out (sell), gross before fees
  token_amount numeric NOT NULL,           -- coin tokens out (buy) or in (sell)
  rhoze_fee numeric NOT NULL DEFAULT 0,    -- fee in $RHOZE
  price_per_token numeric NOT NULL,        -- $RHOZE per token at execution
  rhoze_balance_after numeric NOT NULL,    -- snapshot for audit
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coin_swap_ledger_user ON public.coin_swap_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coin_swap_ledger_launch ON public.coin_swap_ledger(launch_id, created_at DESC);

ALTER TABLE public.coin_swap_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own swaps"
  ON public.coin_swap_ledger FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Launch creators view swaps on their coin"
  ON public.coin_swap_ledger FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.coin_launches l
    WHERE l.id = coin_swap_ledger.launch_id AND l.creator_id = auth.uid()
  ));

CREATE POLICY "Admins view all swaps"
  ON public.coin_swap_ledger FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Main swap RPC. Atomically:
--   buy:  debit $RHOZE balance, advance curve, credit holdings, log swap
--   sell: debit holdings, retreat curve, credit $RHOZE balance, log swap
-- Returns: { tokens_out, rhoze_out, fee, price, graduated, balance_after, holdings_after }
CREATE OR REPLACE FUNCTION public.swap_rhoze_for_coin(
  _launch_id uuid,
  _side text,
  _amount numeric,
  _min_out numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_launch record;
  v_total_fee_bps integer;
  v_k numeric;
  v_fee numeric;
  v_net numeric;
  v_tokens_out numeric;
  v_rhoze_out numeric;
  v_new_virt_sol numeric;
  v_new_virt_tok numeric;
  v_new_real_sol numeric;
  v_new_real_tok numeric;
  v_price numeric;
  v_balance numeric;
  v_holding numeric;
  v_graduated boolean := false;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF _side NOT IN ('buy','sell') THEN RAISE EXCEPTION 'Side must be buy or sell'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  SELECT * INTO v_launch FROM public.coin_launches WHERE id = _launch_id FOR UPDATE;
  IF v_launch IS NULL THEN RAISE EXCEPTION 'Coin not found'; END IF;
  IF v_launch.status != 'live' THEN RAISE EXCEPTION 'Trading closed for this coin'; END IF;

  v_total_fee_bps := v_launch.creator_fee_bps + v_launch.platform_fee_bps;
  v_k := v_launch.virtual_sol_reserves * v_launch.virtual_token_reserves;

  IF _side = 'buy' THEN
    -- Lock & verify $RHOZE balance
    SELECT balance INTO v_balance FROM public.user_credits WHERE user_id = v_user FOR UPDATE;
    IF v_balance IS NULL THEN RAISE EXCEPTION 'No $RHOZE wallet found'; END IF;
    IF v_balance < _amount THEN
      RAISE EXCEPTION 'Insufficient $RHOZE. You have % but tried to spend %', v_balance, _amount;
    END IF;

    v_fee := round(_amount * v_total_fee_bps / 10000.0, 6);
    v_net := _amount - v_fee;
    v_new_virt_sol := v_launch.virtual_sol_reserves + v_net;
    v_new_virt_tok := v_k / v_new_virt_sol;
    v_tokens_out := v_launch.virtual_token_reserves - v_new_virt_tok;

    IF v_tokens_out > v_launch.real_token_reserves THEN
      RAISE EXCEPTION 'Not enough liquidity left on the curve';
    END IF;
    IF v_tokens_out < _min_out THEN
      RAISE EXCEPTION 'Slippage exceeded: would receive % tokens, minimum was %', v_tokens_out, _min_out;
    END IF;

    v_new_real_sol := v_launch.real_sol_reserves + v_net;
    v_new_real_tok := v_launch.real_token_reserves - v_tokens_out;
    v_price := v_net / v_tokens_out;

    -- Debit $RHOZE
    UPDATE public.user_credits
       SET balance = balance - _amount, updated_at = now()
     WHERE user_id = v_user
     RETURNING balance INTO v_balance;

    -- Credit holdings
    INSERT INTO public.coin_holdings (launch_id, trader_id, balance, sol_invested)
    VALUES (_launch_id, v_user, v_tokens_out, _amount)
    ON CONFLICT (launch_id, trader_id) DO UPDATE
      SET balance = coin_holdings.balance + EXCLUDED.balance,
          sol_invested = coin_holdings.sol_invested + EXCLUDED.sol_invested,
          updated_at = now()
    RETURNING balance INTO v_holding;

    -- Advance curve, graduation check
    IF v_new_real_sol >= v_launch.graduation_sol_target THEN
      v_graduated := true;
    END IF;

    UPDATE public.coin_launches
       SET virtual_sol_reserves = v_new_virt_sol,
           virtual_token_reserves = v_new_virt_tok,
           real_sol_reserves = v_new_real_sol,
           real_token_reserves = v_new_real_tok,
           status = CASE WHEN v_graduated THEN 'graduated' ELSE status END,
           graduated_at = CASE WHEN v_graduated THEN now() ELSE graduated_at END,
           updated_at = now()
     WHERE id = _launch_id;

    INSERT INTO public.coin_swap_ledger
      (user_id, launch_id, side, rhoze_amount, token_amount, rhoze_fee, price_per_token, rhoze_balance_after)
    VALUES (v_user, _launch_id, 'buy', _amount, v_tokens_out, v_fee, v_price, v_balance);

    -- Mirror in coin_trades for chart compatibility
    INSERT INTO public.coin_trades
      (launch_id, trader_id, side, sol_amount, token_amount, fee_sol, price_per_token)
    VALUES (_launch_id, v_user, 'buy', _amount, v_tokens_out, v_fee, v_price);

    RETURN jsonb_build_object(
      'side', 'buy',
      'tokens_out', v_tokens_out,
      'rhoze_in', _amount,
      'fee', v_fee,
      'price', v_price,
      'graduated', v_graduated,
      'balance_after', v_balance,
      'holdings_after', v_holding
    );

  ELSE -- sell
    SELECT balance INTO v_holding FROM public.coin_holdings
     WHERE launch_id = _launch_id AND trader_id = v_user FOR UPDATE;
    IF v_holding IS NULL OR v_holding < _amount THEN
      RAISE EXCEPTION 'Insufficient $% balance. You hold % but tried to sell %',
        v_launch.ticker, COALESCE(v_holding, 0), _amount;
    END IF;

    v_new_virt_tok := v_launch.virtual_token_reserves + _amount;
    v_new_virt_sol := v_k / v_new_virt_tok;
    v_rhoze_out := v_launch.virtual_sol_reserves - v_new_virt_sol;
    v_fee := round(v_rhoze_out * v_total_fee_bps / 10000.0, 6);
    v_net := v_rhoze_out - v_fee;

    IF v_net < _min_out THEN
      RAISE EXCEPTION 'Slippage exceeded: would receive % $RHOZE, minimum was %', v_net, _min_out;
    END IF;
    IF v_rhoze_out > v_launch.real_sol_reserves THEN
      RAISE EXCEPTION 'Not enough $RHOZE liquidity on the curve';
    END IF;

    v_new_real_sol := v_launch.real_sol_reserves - v_rhoze_out;
    v_new_real_tok := v_launch.real_token_reserves + _amount;
    v_price := v_net / _amount;

    -- Debit holdings
    UPDATE public.coin_holdings
       SET balance = balance - _amount, updated_at = now()
     WHERE launch_id = _launch_id AND trader_id = v_user
     RETURNING balance INTO v_holding;

    -- Credit $RHOZE (net of fees)
    UPDATE public.user_credits
       SET balance = balance + v_net, updated_at = now()
     WHERE user_id = v_user
     RETURNING balance INTO v_balance;

    IF v_balance IS NULL THEN
      INSERT INTO public.user_credits (user_id, balance) VALUES (v_user, v_net)
      RETURNING balance INTO v_balance;
    END IF;

    UPDATE public.coin_launches
       SET virtual_sol_reserves = v_new_virt_sol,
           virtual_token_reserves = v_new_virt_tok,
           real_sol_reserves = v_new_real_sol,
           real_token_reserves = v_new_real_tok,
           updated_at = now()
     WHERE id = _launch_id;

    INSERT INTO public.coin_swap_ledger
      (user_id, launch_id, side, rhoze_amount, token_amount, rhoze_fee, price_per_token, rhoze_balance_after)
    VALUES (v_user, _launch_id, 'sell', v_net, _amount, v_fee, v_price, v_balance);

    INSERT INTO public.coin_trades
      (launch_id, trader_id, side, sol_amount, token_amount, fee_sol, price_per_token)
    VALUES (_launch_id, v_user, 'sell', v_net, _amount, v_fee, v_price);

    RETURN jsonb_build_object(
      'side', 'sell',
      'rhoze_out', v_net,
      'tokens_in', _amount,
      'fee', v_fee,
      'price', v_price,
      'balance_after', v_balance,
      'holdings_after', v_holding
    );
  END IF;
END;
$$;