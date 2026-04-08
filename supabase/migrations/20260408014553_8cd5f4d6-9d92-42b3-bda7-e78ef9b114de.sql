
-- Add streak tracking columns
ALTER TABLE public.user_credits
  ADD COLUMN IF NOT EXISTS last_reward_login timestamp with time zone,
  ADD COLUMN IF NOT EXISTS reward_streak integer NOT NULL DEFAULT 0;

-- Helper: award credits via service-level logic (no auth.uid check)
CREATE OR REPLACE FUNCTION public.award_rhoze(_user_id uuid, _amount numeric, _description text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Upsert user credits
  INSERT INTO public.user_credits (user_id, balance)
  VALUES (_user_id, _amount)
  ON CONFLICT (user_id)
  DO UPDATE SET balance = user_credits.balance + _amount, updated_at = now();

  -- Log transaction
  INSERT INTO public.credit_transactions (user_id, amount, type, description)
  VALUES (_user_id, _amount, 'reward', _description);
END;
$$;

-- 1. Flow post reward: +2 $RHOZE
CREATE OR REPLACE FUNCTION public.reward_flow_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.award_rhoze(NEW.user_id, 2, 'Posted to Flow: ' || LEFT(NEW.title, 50));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reward_flow_post
AFTER INSERT ON public.flow_items
FOR EACH ROW EXECUTE FUNCTION public.reward_flow_post();

-- 2. Flow interaction reward: +1 $RHOZE to post owner
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
    PERFORM public.award_rhoze(v_owner_id, 1, 'Your Flow post received a ' || NEW.action);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reward_flow_interaction
AFTER INSERT ON public.flow_interactions
FOR EACH ROW EXECUTE FUNCTION public.reward_flow_interaction();

-- 3. Review reward: +3 $RHOZE to reviewer
CREATE OR REPLACE FUNCTION public.reward_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.award_rhoze(NEW.reviewer_id, 3, 'Left a review (' || NEW.rating || '★)');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reward_review
AFTER INSERT ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.reward_review();

-- 4. Milestone approved reward: +10 $RHOZE to specialist
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
      PERFORM public.award_rhoze(v_specialist_id, 10, 'Milestone approved: ' || LEFT(NEW.title, 50));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reward_milestone_approved
AFTER UPDATE ON public.project_milestones
FOR EACH ROW EXECUTE FUNCTION public.reward_milestone_approved();

-- 5. Drop Room post reward: +1 $RHOZE
CREATE OR REPLACE FUNCTION public.reward_drop_room_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.award_rhoze(NEW.user_id, 1, 'Posted in Drop Room');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reward_drop_room_post
AFTER INSERT ON public.drop_room_posts
FOR EACH ROW EXECUTE FUNCTION public.reward_drop_room_post();
