
-- =====================================================================
-- v8 expanded rewards: helpers
-- =====================================================================

CREATE OR REPLACE FUNCTION public.reward_weekly_cap_hit(_user_id uuid, _action_type text, _cap integer)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(COUNT(*), 0) >= _cap
  FROM public.pending_rewards
  WHERE user_id = _user_id
    AND action_type = _action_type
    AND created_at >= now() - interval '7 days';
$$;

-- True if user already has any pending_rewards row for (action_type, reference_id-or-NULL)
CREATE OR REPLACE FUNCTION public.reward_already_granted(_user_id uuid, _action_type text, _reference_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pending_rewards
    WHERE user_id = _user_id
      AND action_type = _action_type
      AND (_reference_id IS NULL OR reference_id = _reference_id)
  );
$$;

-- =====================================================================
-- WORKS: first upload, 10 uploads, first anchor, 10 anchors
-- =====================================================================

CREATE OR REPLACE FUNCTION public.reward_work_uploaded()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  -- first_work_uploaded (one-time per user)
  IF NOT public.reward_already_granted(NEW.user_id, 'first_work_uploaded') THEN
    INSERT INTO public.pending_rewards (user_id, amount, action_type, description, reference_id)
    VALUES (NEW.user_id, 10, 'first_work_uploaded', 'Uploaded first work: ' || LEFT(NEW.title, 50), NEW.id);
  END IF;

  -- ten_works_uploaded (one-time per user)
  IF NOT public.reward_already_granted(NEW.user_id, 'ten_works_uploaded') THEN
    SELECT COUNT(*) INTO v_count FROM public.works WHERE user_id = NEW.user_id;
    IF v_count >= 10 THEN
      INSERT INTO public.pending_rewards (user_id, amount, action_type, description, reference_id)
      VALUES (NEW.user_id, 50, 'ten_works_uploaded', 'Hit 10 works uploaded', NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reward_work_uploaded ON public.works;
CREATE TRIGGER trg_reward_work_uploaded
AFTER INSERT ON public.works
FOR EACH ROW EXECUTE FUNCTION public.reward_work_uploaded();

CREATE OR REPLACE FUNCTION public.reward_work_anchored()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  IF NEW.solana_signature IS NULL THEN RETURN NEW; END IF;
  IF OLD.solana_signature IS NOT NULL THEN RETURN NEW; END IF;

  IF NOT public.reward_already_granted(NEW.user_id, 'first_work_anchored') THEN
    INSERT INTO public.pending_rewards (user_id, amount, action_type, description, reference_id)
    VALUES (NEW.user_id, 25, 'first_work_anchored', 'Anchored first work as Verified IP', NEW.id);
  END IF;

  IF NOT public.reward_already_granted(NEW.user_id, 'ten_works_anchored') THEN
    SELECT COUNT(*) INTO v_count FROM public.works
      WHERE user_id = NEW.user_id AND solana_signature IS NOT NULL;
    IF v_count >= 10 THEN
      INSERT INTO public.pending_rewards (user_id, amount, action_type, description, reference_id)
      VALUES (NEW.user_id, 100, 'ten_works_anchored', 'Hit 10 anchored works', NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reward_work_anchored ON public.works;
CREATE TRIGGER trg_reward_work_anchored
AFTER UPDATE OF solana_signature ON public.works
FOR EACH ROW EXECUTE FUNCTION public.reward_work_anchored();

-- =====================================================================
-- LISTINGS: publish (3/week), inquiry received (10/week)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.reward_publish_listing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.reward_weekly_cap_hit(NEW.user_id, 'publish_listing', 3) THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.pending_rewards (user_id, amount, action_type, description, reference_id)
  VALUES (NEW.user_id, 5, 'publish_listing', 'Published listing: ' || LEFT(NEW.title, 50), NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reward_publish_listing ON public.marketplace_listings;
CREATE TRIGGER trg_reward_publish_listing
AFTER INSERT ON public.marketplace_listings
FOR EACH ROW EXECUTE FUNCTION public.reward_publish_listing();

CREATE OR REPLACE FUNCTION public.reward_listing_inquiry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.receiver_id = NEW.sender_id THEN RETURN NEW; END IF;
  IF public.reward_weekly_cap_hit(NEW.receiver_id, 'listing_inquiry_received', 10) THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.pending_rewards (user_id, amount, action_type, description, reference_id)
  VALUES (NEW.receiver_id, 3, 'listing_inquiry_received', 'Received an inquiry on your listing', NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reward_listing_inquiry ON public.listing_inquiries;
CREATE TRIGGER trg_reward_listing_inquiry
AFTER INSERT ON public.listing_inquiries
FOR EACH ROW EXECUTE FUNCTION public.reward_listing_inquiry();

-- =====================================================================
-- BOOKINGS: book_space (in addition to existing attend_paid_space)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.reward_book_space()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS DISTINCT FROM 'confirmed') THEN
    IF NOT public.reward_already_granted(NEW.user_id, 'book_space', NEW.id) THEN
      INSERT INTO public.pending_rewards (user_id, amount, action_type, description, reference_id)
      VALUES (NEW.user_id, 10, 'book_space', 'Booked a Space', NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reward_book_space ON public.studio_bookings;
CREATE TRIGGER trg_reward_book_space
AFTER UPDATE OF status ON public.studio_bookings
FOR EACH ROW EXECUTE FUNCTION public.reward_book_space();

-- =====================================================================
-- EVENTS: attend on check-in (free or paid), host paid event w/ attendee
-- =====================================================================

CREATE OR REPLACE FUNCTION public.reward_event_check_in()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ticket record;
  v_event record;
  v_attendee_action text;
  v_attendee_amount numeric;
BEGIN
  SELECT * INTO v_ticket FROM public.event_tickets WHERE id = NEW.ticket_id;
  IF v_ticket IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_event FROM public.events WHERE id = v_ticket.event_id;
  IF v_event IS NULL THEN RETURN NEW; END IF;

  IF v_ticket.purchase_currency = 'free' THEN
    v_attendee_action := 'attend_space';
    v_attendee_amount := 5;
  ELSE
    v_attendee_action := 'attend_paid_space';
    v_attendee_amount := 25;
  END IF;

  -- Attendee reward (one-time per ticket)
  IF NOT public.reward_already_granted(v_ticket.holder_id, v_attendee_action, v_ticket.id) THEN
    INSERT INTO public.pending_rewards (user_id, amount, action_type, description, reference_id)
    VALUES (v_ticket.holder_id, v_attendee_amount, v_attendee_action,
            'Checked in to: ' || LEFT(v_event.title, 50), v_ticket.id);
  END IF;

  -- Host reward (one-time per event, paid only)
  IF v_ticket.purchase_currency != 'free'
     AND NOT public.reward_already_granted(v_event.host_id, 'host_paid_space', v_event.id) THEN
    INSERT INTO public.pending_rewards (user_id, amount, action_type, description, reference_id)
    VALUES (v_event.host_id, 25, 'host_paid_space',
            'Hosted paid event: ' || LEFT(v_event.title, 50), v_event.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reward_event_check_in ON public.event_check_ins;
CREATE TRIGGER trg_reward_event_check_in
AFTER INSERT ON public.event_check_ins
FOR EACH ROW EXECUTE FUNCTION public.reward_event_check_in();

-- =====================================================================
-- COINS: first swap into a given artist coin, first coin launch
-- =====================================================================

CREATE OR REPLACE FUNCTION public.reward_coin_swap()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rebate numeric;
BEGIN
  IF NEW.side != 'buy' THEN RETURN NEW; END IF;
  -- One-time per (user, launch)
  IF NOT public.reward_already_granted(NEW.user_id, 'swap_into_artist_coin', NEW.launch_id) THEN
    v_rebate := ROUND(NEW.rhoze_amount * 0.02, 4);
    IF v_rebate > 0 THEN
      INSERT INTO public.pending_rewards (user_id, amount, action_type, description, reference_id)
      VALUES (NEW.user_id, v_rebate, 'swap_into_artist_coin',
              'First swap into artist coin (2% rebate)', NEW.launch_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reward_coin_swap ON public.coin_swap_ledger;
CREATE TRIGGER trg_reward_coin_swap
AFTER INSERT ON public.coin_swap_ledger
FOR EACH ROW EXECUTE FUNCTION public.reward_coin_swap();

CREATE OR REPLACE FUNCTION public.reward_coin_launch()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.reward_already_granted(NEW.creator_id, 'first_coin_launch') THEN
    INSERT INTO public.pending_rewards (user_id, amount, action_type, description, reference_id)
    VALUES (NEW.creator_id, 100, 'first_coin_launch',
            'Launched first artist coin: $' || NEW.ticker, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reward_coin_launch ON public.coin_launches;
CREATE TRIGGER trg_reward_coin_launch
AFTER INSERT ON public.coin_launches
FOR EACH ROW EXECUTE FUNCTION public.reward_coin_launch();

-- =====================================================================
-- PROFILES: verified_artist milestone
-- =====================================================================

CREATE OR REPLACE FUNCTION public.reward_verified_artist()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.verification_status = 'verified'
     AND (OLD.verification_status IS DISTINCT FROM 'verified')
     AND NOT public.reward_already_granted(NEW.user_id, 'verified_artist') THEN
    INSERT INTO public.pending_rewards (user_id, amount, action_type, description, reference_id)
    VALUES (NEW.user_id, 150, 'verified_artist', 'Became a Verified Artist', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reward_verified_artist ON public.profiles;
CREATE TRIGGER trg_reward_verified_artist
AFTER UPDATE OF verification_status ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.reward_verified_artist();
