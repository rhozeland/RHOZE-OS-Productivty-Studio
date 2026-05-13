DROP FUNCTION IF EXISTS public.swap_rhoze_for_coin(uuid, text, numeric, numeric);

CREATE OR REPLACE FUNCTION public.swap_rhoze_for_coin(
  _launch_id uuid,
  _side text,
  _amount numeric,
  _min_out numeric DEFAULT 0,
  _platform_fee_bps integer DEFAULT 100,
  _creator_fee_bps integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user           uuid := auth.uid();
  v_launch         public.coin_launches%ROWTYPE;
  v_k              numeric;
  v_new_virt_sol   numeric;
  v_new_virt_tok   numeric;
  v_new_real_sol   numeric;
  v_new_real_tok   numeric;
  v_tokens_out     numeric;
  v_rhoze_out      numeric;
  v_actual_amount  numeric;
  v_refund         numeric := 0;
  v_fee            numeric;
  v_net            numeric;
  v_price          numeric;
  v_total_fee_bps  int;
  v_balance        numeric;
  v_holding        numeric;
  v_graduated      boolean := false;
  v_payout         jsonb := NULL;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _side NOT IN ('buy', 'sell') THEN
    RAISE EXCEPTION 'side must be buy or sell';
  END IF;

  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'amount must be > 0';
  END IF;

  v_total_fee_bps := COALESCE(_platform_fee_bps, 100) + COALESCE(_creator_fee_bps, 100);

  SELECT * INTO v_launch FROM public.coin_launches WHERE id = _launch_id FOR UPDATE;
  IF v_launch.id IS NULL THEN
    RAISE EXCEPTION 'Launch not found';
  END IF;
  IF v_launch.status NOT IN ('live', 'active') THEN
    RAISE EXCEPTION 'Launch is not tradable (status=%)', v_launch.status;
  END IF;

  v_k := v_launch.virtual_sol_reserves * v_launch.virtual_token_reserves;

  IF _side = 'buy' THEN
    v_actual_amount := _amount;
    v_new_virt_sol := v_launch.virtual_sol_reserves + v_actual_amount;
    v_new_virt_tok := v_k / v_new_virt_sol;
    v_tokens_out := v_launch.virtual_token_reserves - v_new_virt_tok;

    IF v_tokens_out > v_launch.real_token_reserves THEN
      v_tokens_out := v_launch.real_token_reserves;
      v_new_virt_tok := v_launch.virtual_token_reserves - v_tokens_out;
      v_new_virt_sol := v_k / v_new_virt_tok;
      v_actual_amount := v_new_virt_sol - v_launch.virtual_sol_reserves;
      v_refund := _amount - v_actual_amount;
    END IF;

    v_fee := round(v_actual_amount * v_total_fee_bps / 10000.0, 6);
    v_net := v_actual_amount - v_fee;

    IF v_tokens_out < _min_out THEN
      RAISE EXCEPTION 'Slippage exceeded: would receive % tokens, minimum was %', v_tokens_out, _min_out;
    END IF;

    v_new_real_sol := v_launch.real_sol_reserves + v_actual_amount;
    v_new_real_tok := v_launch.real_token_reserves - v_tokens_out;
    v_price := v_actual_amount / v_tokens_out;

    SELECT balance INTO v_balance FROM public.user_credits WHERE user_id = v_user FOR UPDATE;
    IF v_balance IS NULL OR v_balance < v_actual_amount THEN
      RAISE EXCEPTION 'Insufficient $RHOZE balance. You have % but need %', COALESCE(v_balance, 0), v_actual_amount;
    END IF;

    UPDATE public.user_credits
       SET balance = balance - v_actual_amount, updated_at = now()
     WHERE user_id = v_user
     RETURNING balance INTO v_balance;

    INSERT INTO public.coin_holdings (launch_id, trader_id, balance, sol_invested)
    VALUES (_launch_id, v_user, v_tokens_out, v_actual_amount)
    ON CONFLICT (launch_id, trader_id) DO UPDATE
      SET balance = coin_holdings.balance + EXCLUDED.balance,
          sol_invested = coin_holdings.sol_invested + EXCLUDED.sol_invested,
          updated_at = now()
    RETURNING balance INTO v_holding;

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
    VALUES (v_user, _launch_id, 'buy', v_actual_amount, v_tokens_out, v_fee, v_price, v_balance);

    INSERT INTO public.coin_trades
      (launch_id, trader_id, side, sol_amount, token_amount, fee_sol, price_per_token)
    VALUES (_launch_id, v_user, 'buy', v_actual_amount, v_tokens_out, v_fee, v_price);

    IF v_graduated THEN
      v_payout := public._graduate_launch_payout(_launch_id);
    END IF;

    RETURN jsonb_build_object(
      'side', 'buy',
      'tokens_out', v_tokens_out,
      'rhoze_in', v_actual_amount,
      'refund', v_refund,
      'fee', v_fee,
      'price', v_price,
      'graduated', v_graduated,
      'payout', v_payout,
      'balance_after', v_balance,
      'holdings_after', v_holding
    );

  ELSE
    SELECT balance INTO v_holding FROM public.coin_holdings
     WHERE launch_id = _launch_id AND trader_id = v_user FOR UPDATE;
    IF v_holding IS NULL OR v_holding < _amount THEN
      RAISE EXCEPTION 'Insufficient $% balance. You hold % but tried to sell %',
        v_launch.ticker, COALESCE(v_holding, 0), _amount;
    END IF;

    v_new_virt_tok := v_launch.virtual_token_reserves + _amount;
    v_new_virt_sol := v_k / v_new_virt_tok;
    v_rhoze_out := v_launch.virtual_sol_reserves - v_new_virt_sol;

    IF v_rhoze_out > v_launch.real_sol_reserves THEN
      v_rhoze_out := v_launch.real_sol_reserves;
      v_new_virt_sol := v_launch.virtual_sol_reserves - v_rhoze_out;
      v_new_virt_tok := v_k / v_new_virt_sol;
      v_actual_amount := v_new_virt_tok - v_launch.virtual_token_reserves;
      IF v_actual_amount > _amount THEN
        v_actual_amount := _amount;
      END IF;
    ELSE
      v_actual_amount := _amount;
    END IF;

    v_fee := round(v_rhoze_out * v_total_fee_bps / 10000.0, 6);
    v_net := v_rhoze_out - v_fee;

    IF v_net < _min_out THEN
      RAISE EXCEPTION 'Slippage exceeded: would receive % $RHOZE, minimum was %', v_net, _min_out;
    END IF;

    v_new_real_sol := v_launch.real_sol_reserves - v_rhoze_out;
    v_new_real_tok := v_launch.real_token_reserves + v_actual_amount;
    v_price := v_net / v_actual_amount;

    UPDATE public.coin_holdings
       SET balance = balance - v_actual_amount, updated_at = now()
     WHERE launch_id = _launch_id AND trader_id = v_user
     RETURNING balance INTO v_holding;

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
    VALUES (v_user, _launch_id, 'sell', v_rhoze_out, v_actual_amount, v_fee, v_price, v_balance);

    INSERT INTO public.coin_trades
      (launch_id, trader_id, side, sol_amount, token_amount, fee_sol, price_per_token)
    VALUES (_launch_id, v_user, 'sell', v_rhoze_out, v_actual_amount, v_fee, v_price);

    RETURN jsonb_build_object(
      'side', 'sell',
      'rhoze_out', v_net,
      'tokens_in', v_actual_amount,
      'fee', v_fee,
      'price', v_price,
      'balance_after', v_balance,
      'holdings_after', v_holding
    );
  END IF;
END;
$$;