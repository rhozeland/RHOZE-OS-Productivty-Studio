INSERT INTO public.reward_daily_caps (action_type, amount, per_day_cap, per_day_amount_cap, enabled, description)
VALUES ('post_flow_item', 1.0000, 5, 5.0000, true, 'Shared a post to Flow')
ON CONFLICT (action_type) DO NOTHING;