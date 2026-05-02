
-- =====================================================================
-- TABLES
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.user_streaks (
  user_id uuid PRIMARY KEY,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_active_at timestamptz,
  last_milestone_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own streak" ON public.user_streaks
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all streaks" ON public.user_streaks
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.coin_hold_snapshots (
  user_id uuid NOT NULL,
  launch_id uuid NOT NULL REFERENCES public.coin_launches(id) ON DELETE CASCADE,
  snapshot_balance numeric NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  last_7d_reward_at timestamptz,
  last_30d_reward_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, launch_id)
);

ALTER TABLE public.coin_hold_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own hold snapshots" ON public.coin_hold_snapshots
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all hold snapshots" ON public.coin_hold_snapshots
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_coin_hold_snapshots_user ON public.coin_hold_snapshots(user_id);

-- =====================================================================
-- STREAK TICK — called from any reward-emitting trigger to mark activity
-- (lightweight: just UPSERTs last_active_at; the daily sweep does the math)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.touch_user_activity(_user_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.user_streaks (user_id, last_active_at, updated_at)
  VALUES (_user_id, now(), now())
  ON CONFLICT (user_id) DO UPDATE
    SET last_active_at = now(), updated_at = now();
$$;

-- Auto-touch activity whenever any pending_reward is queued (covers all
-- engagement + commerce actions in one place).
CREATE OR REPLACE FUNCTION public.touch_activity_on_reward()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.touch_user_activity(NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_activity_on_reward ON public.pending_rewards;
CREATE TRIGGER trg_touch_activity_on_reward
AFTER INSERT ON public.pending_rewards
FOR EACH ROW EXECUTE FUNCTION public.touch_activity_on_reward();

-- =====================================================================
-- DAILY SWEEP — single SECURITY DEFINER function, callable by admins
-- =====================================================================

CREATE OR REPLACE FUNCTION public.process_streaks_and_holds()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_streaks_advanced int := 0;
  v_streaks_broken int := 0;
  v_streak_rewards int := 0;
  v_hold_7d_rewards int := 0;
  v_hold_30d_rewards int := 0;
  v_snapshots_reset int := 0;
  r record;
  v_per_user_count int;
BEGIN
  -- ──────────────────────────────────────────────
  -- STREAKS — rolling 24h windows
  -- ──────────────────────────────────────────────

  -- Advance streak for anyone active in the last 24h whose last bump was 12-48h ago
  -- (avoids double-incrementing if the sweep runs more than once a day).
  FOR r IN
    SELECT user_id, current_streak, last_active_at, last_milestone_at
    FROM public.user_streaks
    WHERE last_active_at >= now() - interval '24 hours'
      AND (updated_at < now() - interval '20 hours' OR current_streak = 0)
  LOOP
    UPDATE public.user_streaks
       SET current_streak = current_streak + 1,
           longest_streak = GREATEST(longest_streak, current_streak + 1),
           updated_at = now()
     WHERE user_id = r.user_id;
    v_streaks_advanced := v_streaks_advanced + 1;

    -- Reward every 7 days
    IF MOD(r.current_streak + 1, 7) = 0 THEN
      INSERT INTO public.pending_rewards (user_id, amount, action_type, description)
      VALUES (r.user_id, 5, 'daily_streak',
              (r.current_streak + 1) || '-day streak hit');
      UPDATE public.user_streaks SET last_milestone_at = now() WHERE user_id = r.user_id;
      v_streak_rewards := v_streak_rewards + 1;
    END IF;
  END LOOP;

  -- Break streaks for users inactive for 48h+ (gives one full day grace)
  UPDATE public.user_streaks
     SET current_streak = 0, updated_at = now()
   WHERE current_streak > 0
     AND last_active_at < now() - interval '48 hours';
  GET DIAGNOSTICS v_streaks_broken = ROW_COUNT;

  -- ──────────────────────────────────────────────
  -- COIN HOLD SNAPSHOTS — seed any new positions
  -- ──────────────────────────────────────────────

  INSERT INTO public.coin_hold_snapshots (user_id, launch_id, snapshot_balance, window_start)
  SELECT h.trader_id, h.launch_id, h.balance, now()
  FROM public.coin_holdings h
  WHERE h.balance > 0
  ON CONFLICT (user_id, launch_id) DO NOTHING;

  -- Reset snapshot if user sold more than 25% since window start
  UPDATE public.coin_hold_snapshots s
     SET snapshot_balance = h.balance,
         window_start = now(),
         updated_at = now()
    FROM public.coin_holdings h
   WHERE s.user_id = h.trader_id
     AND s.launch_id = h.launch_id
     AND h.balance < s.snapshot_balance * 0.75;
  GET DIAGNOSTICS v_snapshots_reset = ROW_COUNT;

  -- Drop snapshots for fully-sold positions
  DELETE FROM public.coin_hold_snapshots s
   WHERE NOT EXISTS (
     SELECT 1 FROM public.coin_holdings h
      WHERE h.trader_id = s.user_id AND h.launch_id = s.launch_id AND h.balance > 0
   );

  -- ──────────────────────────────────────────────
  -- 7-DAY HOLD REWARDS — capped at 5 coins/user/week
  -- ──────────────────────────────────────────────

  FOR r IN
    SELECT s.user_id, s.launch_id
    FROM public.coin_hold_snapshots s
    JOIN public.coin_holdings h ON h.trader_id = s.user_id AND h.launch_id = s.launch_id
    WHERE s.window_start <= now() - interval '7 days'
      AND (s.last_7d_reward_at IS NULL OR s.last_7d_reward_at < now() - interval '7 days')
      AND h.balance >= s.snapshot_balance * 0.75
    ORDER BY s.user_id, s.window_start
  LOOP
    -- Per-user weekly cap of 5 coins
    SELECT COUNT(*) INTO v_per_user_count
    FROM public.pending_rewards
    WHERE user_id = r.user_id
      AND action_type = 'hold_artist_coin_7d'
      AND created_at >= now() - interval '7 days';
    IF v_per_user_count >= 5 THEN CONTINUE; END IF;

    INSERT INTO public.pending_rewards (user_id, amount, action_type, description, reference_id)
    VALUES (r.user_id, 10, 'hold_artist_coin_7d',
            'Held artist coin for 7 days', r.launch_id);

    UPDATE public.coin_hold_snapshots
       SET last_7d_reward_at = now(), updated_at = now()
     WHERE user_id = r.user_id AND launch_id = r.launch_id;
    v_hold_7d_rewards := v_hold_7d_rewards + 1;
  END LOOP;

  -- ──────────────────────────────────────────────
  -- 30-DAY HOLD REWARDS — diamond hands bonus
  -- ──────────────────────────────────────────────

  FOR r IN
    SELECT s.user_id, s.launch_id
    FROM public.coin_hold_snapshots s
    JOIN public.coin_holdings h ON h.trader_id = s.user_id AND h.launch_id = s.launch_id
    WHERE s.window_start <= now() - interval '30 days'
      AND (s.last_30d_reward_at IS NULL OR s.last_30d_reward_at < now() - interval '30 days')
      AND h.balance >= s.snapshot_balance * 0.75
  LOOP
    INSERT INTO public.pending_rewards (user_id, amount, action_type, description, reference_id)
    VALUES (r.user_id, 50, 'hold_artist_coin_30d',
            'Diamond-hand bonus: held artist coin for 30 days', r.launch_id);

    UPDATE public.coin_hold_snapshots
       SET last_30d_reward_at = now(), updated_at = now()
     WHERE user_id = r.user_id AND launch_id = r.launch_id;
    v_hold_30d_rewards := v_hold_30d_rewards + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'streaks_advanced', v_streaks_advanced,
    'streaks_broken', v_streaks_broken,
    'streak_rewards', v_streak_rewards,
    'hold_7d_rewards', v_hold_7d_rewards,
    'hold_30d_rewards', v_hold_30d_rewards,
    'snapshots_reset', v_snapshots_reset,
    'ran_at', now()
  );
END;
$$;

-- =====================================================================
-- CRON — run every day at 09:00 UTC
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop any old version of this job
DO $$
BEGIN
  PERFORM cron.unschedule(jobid)
  FROM cron.job WHERE jobname = 'process_streaks_and_holds_daily';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'process_streaks_and_holds_daily',
  '0 9 * * *',
  $$ SELECT public.process_streaks_and_holds(); $$
);
