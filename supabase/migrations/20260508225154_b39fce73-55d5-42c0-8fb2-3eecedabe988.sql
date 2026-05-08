CREATE OR REPLACE FUNCTION public.tick_reward_streak()
 RETURNS TABLE(reward_streak integer, last_reward_login timestamp with time zone, awarded_bonus boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _row public.user_credits%rowtype;
  _now timestamptz := now();
  _today date := (_now AT TIME ZONE 'UTC')::date;
  _last_date date;
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
    _last_date := (_row.last_reward_login AT TIME ZONE 'UTC')::date;
    IF _last_date = _today THEN
      -- already counted today; do not advance, do not reset
      RETURN QUERY SELECT _row.reward_streak, _row.last_reward_login, false;
      RETURN;
    ELSIF _last_date = _today - INTERVAL '1 day' THEN
      _new_streak := COALESCE(_row.reward_streak, 0) + 1;
    ELSE
      -- missed a day or more
      _new_streak := 1;
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
$function$;