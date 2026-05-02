-- v7 phase 4 follow-up: align reward triggers with the canonical hybrid catalog
-- (src/lib/rewards-catalog.ts). Re-tune existing engagement rewards to small,
-- capped amounts and add commerce/milestone rewards that the catalog promised.

-- ─── 1. Daily-cap helper ─────────────────────────────────────────────────────
-- Returns true when the user has already hit `_cap` pending+approved rewards
-- of `_action_type` today. Used inside trigger functions that must enforce
-- a per-day ceiling (likes/follows/comments when those tables exist later,
-- but also future-proofs flow_post / drop_room_post if abuse appears).
CREATE OR REPLACE FUNCTION public.reward_daily_cap_hit(_user_id uuid, _action_type text, _cap int)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(COUNT(*), 0) >= _cap
  FROM public.pending_rewards
  WHERE user_id = _user_id
    AND action_type = _action_type
    AND created_at >= date_trunc('day', now());
$$;

-- ─── 2. Re-tune existing trigger amounts ─────────────────────────────────────
-- Catalog: posting to Flow stays small + capped; interactions become a fan
-- engagement signal (capped at 20/day on the recipient).
CREATE OR REPLACE FUNCTION public.reward_flow_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.reward_daily_cap_hit(NEW.user_id, 'flow_post', 10) THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.pending_rewards (user_id, amount, action_type, description, reference_id)
  VALUES (NEW.user_id, 1, 'flow_post', 'Posted to Flow: ' || LEFT(NEW.title, 50), NEW.id);
  RETURN NEW;
END;
$$;

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
  IF v_owner_id IS NULL OR v_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  IF public.reward_daily_cap_hit(v_owner_id, 'flow_interaction', 20) THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.pending_rewards (user_id, amount, action_type, description, reference_id)
  VALUES (v_owner_id, 0.5, 'flow_interaction', 'Your Flow post received a ' || NEW.action, NEW.id);
  RETURN NEW;
END;
$$;

-- Reviews kept at 3 $RHOZE (still commerce-adjacent — reviews come after a booking).
-- No change needed.

-- Drop-room posts cap at 10/day to prevent spam farming.
CREATE OR REPLACE FUNCTION public.reward_drop_room_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.reward_daily_cap_hit(NEW.user_id, 'drop_room_post', 10) THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.pending_rewards (user_id, amount, action_type, description, reference_id)
  VALUES (NEW.user_id, 1, 'drop_room_post', 'Posted in Drop Room', NEW.id);
  RETURN NEW;
END;
$$;

-- Milestone approval = commerce reward; bump from 10 → 25 to match
-- "complete a milestone is real economic action" framing.
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
      VALUES (v_specialist_id, 25, 'milestone_approved',
              'Milestone approved: ' || LEFT(NEW.title, 50), NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ─── 3. New reward: complete_profile (one-time, 25 $RHOZE) ───────────────────
-- Fires when a profile newly satisfies ALL of: display_name, bio, avatar_url,
-- and at least one social link. One-time per user.
CREATE OR REPLACE FUNCTION public.reward_profile_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_was_complete boolean;
  v_is_complete boolean;
  v_already_rewarded boolean;
BEGIN
  v_was_complete := OLD.display_name IS NOT NULL AND OLD.display_name <> ''
                AND OLD.bio IS NOT NULL AND OLD.bio <> ''
                AND OLD.avatar_url IS NOT NULL AND OLD.avatar_url <> ''
                AND (
                  COALESCE(OLD.instagram_url,'') <> ''
                  OR COALESCE(OLD.tiktok_url,'') <> ''
                  OR COALESCE(OLD.twitter_url,'') <> ''
                  OR COALESCE(OLD.youtube_url,'') <> ''
                  OR COALESCE(OLD.portfolio_url,'') <> ''
                );
  v_is_complete := NEW.display_name IS NOT NULL AND NEW.display_name <> ''
                AND NEW.bio IS NOT NULL AND NEW.bio <> ''
                AND NEW.avatar_url IS NOT NULL AND NEW.avatar_url <> ''
                AND (
                  COALESCE(NEW.instagram_url,'') <> ''
                  OR COALESCE(NEW.tiktok_url,'') <> ''
                  OR COALESCE(NEW.twitter_url,'') <> ''
                  OR COALESCE(NEW.youtube_url,'') <> ''
                  OR COALESCE(NEW.portfolio_url,'') <> ''
                );

  IF v_is_complete AND NOT v_was_complete THEN
    SELECT EXISTS(
      SELECT 1 FROM public.pending_rewards
      WHERE user_id = NEW.user_id AND action_type = 'complete_profile'
    ) INTO v_already_rewarded;
    IF NOT v_already_rewarded THEN
      INSERT INTO public.pending_rewards (user_id, amount, action_type, description, reference_id)
      VALUES (NEW.user_id, 25, 'complete_profile', 'Completed your profile', NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reward_profile_completed ON public.profiles;
CREATE TRIGGER trg_reward_profile_completed
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.reward_profile_completed();

-- ─── 4. New reward: attend_paid_space (25 $RHOZE) ────────────────────────────
-- Fires when a studio_booking flips to 'confirmed' and the user actually paid
-- (payment_method != 'credits' implies real fiat or $RHOZE spend, AND total > 0).
CREATE OR REPLACE FUNCTION public.reward_attend_paid_space()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'confirmed'
     AND (OLD.status IS DISTINCT FROM 'confirmed')
     AND COALESCE(NEW.total_price, 0) > 0
  THEN
    INSERT INTO public.pending_rewards (user_id, amount, action_type, description, reference_id)
    VALUES (NEW.user_id, 25, 'attend_paid_space',
            'Booked a paid Space', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reward_attend_paid_space ON public.studio_bookings;
CREATE TRIGGER trg_reward_attend_paid_space
  AFTER UPDATE ON public.studio_bookings
  FOR EACH ROW EXECUTE FUNCTION public.reward_attend_paid_space();