
-- Create pending_rewards table
CREATE TABLE public.pending_rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  action_type TEXT NOT NULL,
  description TEXT,
  reference_id UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pending_rewards ENABLE ROW LEVEL SECURITY;

-- Users can view their own pending rewards
CREATE POLICY "Users can view own pending rewards"
ON public.pending_rewards FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all pending rewards
CREATE POLICY "Admins can view all pending rewards"
ON public.pending_rewards FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update pending rewards (approve/reject)
CREATE POLICY "Admins can update pending rewards"
ON public.pending_rewards FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- System inserts (via triggers) — allow service role
CREATE POLICY "System can insert pending rewards"
ON public.pending_rewards FOR INSERT
TO authenticated
WITH CHECK (true);

-- Admin approve function
CREATE OR REPLACE FUNCTION public.approve_pending_reward(_reward_id UUID, _admin_id UUID, _note TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reward RECORD;
BEGIN
  -- Verify admin
  IF NOT public.has_role(_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  -- Get and lock the reward
  SELECT * INTO v_reward FROM public.pending_rewards
  WHERE id = _reward_id AND status = 'pending'
  FOR UPDATE;

  IF v_reward IS NULL THEN
    RAISE EXCEPTION 'Reward not found or already processed';
  END IF;

  -- Mark as approved
  UPDATE public.pending_rewards
  SET status = 'approved', reviewed_by = _admin_id, reviewed_at = now(), review_note = _note
  WHERE id = _reward_id;

  -- Actually credit the user
  PERFORM public.award_rhoze(v_reward.user_id, v_reward.amount, v_reward.description);
END;
$$;

-- Admin reject function
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

-- Batch approve function
CREATE OR REPLACE FUNCTION public.approve_pending_rewards_batch(_reward_ids UUID[], _admin_id UUID)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reward RECORD;
  v_count integer := 0;
BEGIN
  IF NOT public.has_role(_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  FOR v_reward IN
    SELECT * FROM public.pending_rewards
    WHERE id = ANY(_reward_ids) AND status = 'pending'
    FOR UPDATE
  LOOP
    UPDATE public.pending_rewards
    SET status = 'approved', reviewed_by = _admin_id, reviewed_at = now()
    WHERE id = v_reward.id;

    PERFORM public.award_rhoze(v_reward.user_id, v_reward.amount, v_reward.description);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Now replace the auto-credit triggers with pending-reward triggers

-- Replace flow post reward trigger
CREATE OR REPLACE FUNCTION public.reward_flow_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.pending_rewards (user_id, amount, action_type, description, reference_id)
  VALUES (NEW.user_id, 2, 'flow_post', 'Posted to Flow: ' || LEFT(NEW.title, 50), NEW.id);
  RETURN NEW;
END;
$$;

-- Replace flow interaction reward trigger
CREATE OR REPLACE FUNCTION public.reward_flow_interaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT user_id INTO v_owner_id FROM public.flow_items WHERE id = NEW.flow_item_id;
  IF v_owner_id IS NOT NULL AND v_owner_id != NEW.user_id THEN
    INSERT INTO public.pending_rewards (user_id, amount, action_type, description, reference_id)
    VALUES (v_owner_id, 1, 'flow_interaction', 'Your Flow post received a ' || NEW.action, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- Replace review reward trigger
CREATE OR REPLACE FUNCTION public.reward_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.pending_rewards (user_id, amount, action_type, description, reference_id)
  VALUES (NEW.reviewer_id, 3, 'review', 'Left a review (' || NEW.rating || '★)', NEW.id);
  RETURN NEW;
END;
$$;

-- Replace drop room post reward trigger
CREATE OR REPLACE FUNCTION public.reward_drop_room_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.pending_rewards (user_id, amount, action_type, description, reference_id)
  VALUES (NEW.user_id, 1, 'drop_room_post', 'Posted in Drop Room', NEW.id);
  RETURN NEW;
END;
$$;

-- Replace milestone approved reward trigger
CREATE OR REPLACE FUNCTION public.reward_milestone_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_specialist_id uuid;
BEGIN
  IF OLD.status != 'approved' AND NEW.status = 'approved' THEN
    SELECT specialist_id INTO v_specialist_id
    FROM public.project_contracts WHERE id = NEW.contract_id;
    IF v_specialist_id IS NOT NULL THEN
      INSERT INTO public.pending_rewards (user_id, amount, action_type, description, reference_id)
      VALUES (v_specialist_id, 10, 'milestone_approved', 'Milestone approved: ' || LEFT(NEW.title, 50), NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
