
-- Add ban columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ban_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ban_reason TEXT;

-- Function to reject pending reward
CREATE OR REPLACE FUNCTION public.reject_pending_reward(_reward_id UUID, _admin_id UUID, _note TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  UPDATE public.pending_rewards
  SET status = 'rejected', reviewed_by = _admin_id, reviewed_at = now(), review_note = _note
  WHERE id = _reward_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reward not found or already processed';
  END IF;
END;
$$;
