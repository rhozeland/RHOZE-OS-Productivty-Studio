
CREATE OR REPLACE FUNCTION public.tick_reward_streak()
RETURNS TABLE(reward_streak int, last_reward_login timestamptz, awarded_bonus boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.user_credits%rowtype;
  _now timestamptz := now();
  _hours numeric;
  _new_streak int;
  _bonus boolean := false;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _row FROM public.user_credits WHERE user_id = _uid;
  IF NOT FOUND THEN
    INSERT INTO public.user_credits (user_id, balance, reward_streak, last_reward_login)
    VALUES (_uid, 0, 1, _now)
    RETURNING * INTO _row;
    RETURN QUERY SELECT _row.reward_streak, _row.last_reward_login, false;
    RETURN;
  END IF;

  IF _row.last_reward_login IS NULL THEN
    _new_streak := 1;
  ELSE
    _hours := EXTRACT(EPOCH FROM (_now - _row.last_reward_login)) / 3600.0;
    IF _hours < 20 THEN
      RETURN QUERY SELECT _row.reward_streak, _row.last_reward_login, false;
      RETURN;
    ELSIF _hours > 48 THEN
      _new_streak := 1;
    ELSE
      _new_streak := COALESCE(_row.reward_streak, 0) + 1;
    END IF;
  END IF;

  UPDATE public.user_credits
    SET reward_streak = _new_streak, last_reward_login = _now
    WHERE user_id = _uid;

  IF _new_streak > 0 AND _new_streak % 7 = 0 THEN
    _bonus := true;
  END IF;

  RETURN QUERY SELECT _new_streak, _now, _bonus;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tick_reward_streak() TO authenticated;
