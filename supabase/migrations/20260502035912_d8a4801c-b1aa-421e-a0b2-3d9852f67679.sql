-- ─── Per-action daily cap config table ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.reward_daily_caps (
  action_type        text PRIMARY KEY,
  amount             numeric(12,4) NOT NULL CHECK (amount >= 0),
  per_day_cap        integer NOT NULL CHECK (per_day_cap >= 0),
  per_day_amount_cap numeric(12,4) CHECK (per_day_amount_cap IS NULL OR per_day_amount_cap >= 0),
  enabled            boolean NOT NULL DEFAULT true,
  description        text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reward_daily_caps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reward_caps_read_all_authed" ON public.reward_daily_caps;
CREATE POLICY "reward_caps_read_all_authed"
  ON public.reward_daily_caps
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "reward_caps_admin_write" ON public.reward_daily_caps;
CREATE POLICY "reward_caps_admin_write"
  ON public.reward_daily_caps
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_reward_daily_caps_touch ON public.reward_daily_caps;
CREATE TRIGGER trg_reward_daily_caps_touch
  BEFORE UPDATE ON public.reward_daily_caps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_pending_rewards_user_action_day
  ON public.pending_rewards (user_id, action_type, created_at DESC);

-- ─── Atomic "award if under cap" helper ─────────────────────────────
CREATE OR REPLACE FUNCTION public.award_engagement_reward(
  _user_id        uuid,
  _action_type    text,
  _reference_id   uuid DEFAULT NULL,
  _description    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg          public.reward_daily_caps%ROWTYPE;
  v_today_count  integer;
  v_today_amount numeric(12,4);
  v_new_id       uuid;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('status','rejected','reason','missing_user');
  END IF;

  SELECT * INTO v_cfg FROM public.reward_daily_caps WHERE action_type = _action_type;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','rejected','reason','unknown_action');
  END IF;

  IF NOT v_cfg.enabled THEN
    RETURN jsonb_build_object('status','disabled','reason','action_disabled');
  END IF;

  SELECT COUNT(*), COALESCE(SUM(amount), 0)
    INTO v_today_count, v_today_amount
    FROM public.pending_rewards
    WHERE user_id    = _user_id
      AND action_type = _action_type
      AND created_at >= date_trunc('day', now());

  IF v_today_count >= v_cfg.per_day_cap THEN
    RETURN jsonb_build_object(
      'status','capped','reason','count_cap',
      'cap', v_cfg.per_day_cap, 'used', v_today_count
    );
  END IF;

  IF v_cfg.per_day_amount_cap IS NOT NULL
     AND v_today_amount + v_cfg.amount > v_cfg.per_day_amount_cap THEN
    RETURN jsonb_build_object(
      'status','capped','reason','amount_cap',
      'cap', v_cfg.per_day_amount_cap, 'used', v_today_amount
    );
  END IF;

  INSERT INTO public.pending_rewards (user_id, amount, action_type, description, reference_id)
  VALUES (
    _user_id,
    v_cfg.amount,
    _action_type,
    COALESCE(_description, v_cfg.description, _action_type),
    _reference_id
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'status','awarded',
    'pending_reward_id', v_new_id,
    'amount', v_cfg.amount,
    'remaining_today', v_cfg.per_day_cap - (v_today_count + 1)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.award_engagement_reward(uuid, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.award_engagement_reward(uuid, text, uuid, text) TO authenticated, service_role;

INSERT INTO public.reward_daily_caps (action_type, amount, per_day_cap, per_day_amount_cap, description)
VALUES
  ('like_work',     0.5, 20, 10,  'Liked a work'),
  ('comment_work',  0.5, 20, 10,  'Commented on a work'),
  ('follow_artist', 1.0, 10, 10,  'Followed an artist')
ON CONFLICT (action_type) DO NOTHING;