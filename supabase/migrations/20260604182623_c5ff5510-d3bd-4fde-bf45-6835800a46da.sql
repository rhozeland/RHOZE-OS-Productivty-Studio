
-- 1) Helper: recompute tokenize_ready for a single project
CREATE OR REPLACE FUNCTION public.recompute_tokenize_ready(_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cheers int;
  v_done int;
  v_is_public boolean;
  v_current boolean;
BEGIN
  SELECT is_public, COALESCE(cheer_count, 0), COALESCE(tokenize_ready, false)
    INTO v_is_public, v_cheers, v_current
    FROM public.projects
   WHERE id = _project_id;

  IF NOT FOUND OR NOT v_is_public THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_done
    FROM public.project_goals
   WHERE project_id = _project_id
     AND status = 'completed';

  IF v_cheers >= 10 AND v_done >= 2 AND NOT v_current THEN
    UPDATE public.projects
       SET tokenize_ready = true
     WHERE id = _project_id;
  END IF;
END;
$$;

-- 2) Trigger on cheers
CREATE OR REPLACE FUNCTION public.trg_cheers_recompute_tokenize()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recompute_tokenize_ready(NEW.project_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cheers_tokenize_ready ON public.project_cheers;
CREATE TRIGGER trg_cheers_tokenize_ready
  AFTER INSERT ON public.project_cheers
  FOR EACH ROW EXECUTE FUNCTION public.trg_cheers_recompute_tokenize();

-- 3) Trigger on milestone completion
CREATE OR REPLACE FUNCTION public.trg_goal_recompute_tokenize()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.recompute_tokenize_ready(NEW.project_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_goals_tokenize_ready ON public.project_goals;
CREATE TRIGGER trg_goals_tokenize_ready
  AFTER INSERT OR UPDATE OF status ON public.project_goals
  FOR EACH ROW EXECUTE FUNCTION public.trg_goal_recompute_tokenize();

-- 4) Backfill existing public projects
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.projects WHERE is_public = true AND tokenize_ready = false LOOP
    PERFORM public.recompute_tokenize_ready(r.id);
  END LOOP;
END $$;

-- 5) Replace review_token_submission to notify early backers on approval
CREATE OR REPLACE FUNCTION public.review_token_submission(
  _user_id uuid,
  _approve boolean,
  _note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending_mint text;
  v_pending_ticker text;
  v_ticker text;
  v_artist_name text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  SELECT token_mint_address_pending, token_ticker_pending,
         COALESCE(display_name, username, 'An artist')
    INTO v_pending_mint, v_pending_ticker, v_artist_name
    FROM public.profiles
   WHERE user_id = _user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found';
  END IF;

  IF _approve THEN
    UPDATE public.profiles
       SET token_mint_address = COALESCE(v_pending_mint, token_mint_address),
           token_ticker = COALESCE(v_pending_ticker, token_ticker),
           token_mint_address_pending = NULL,
           token_ticker_pending = NULL,
           token_submission_status = 'approved',
           token_reviewed_at = now(),
           token_review_note = _note
     WHERE user_id = _user_id;

    SELECT token_ticker INTO v_ticker FROM public.profiles WHERE user_id = _user_id;

    -- Notify every unique fan who cheered one of this artist's public projects.
    INSERT INTO public.notifications (user_id, type, title, body, link)
    SELECT DISTINCT pc.user_id,
           'coin_launched',
           v_artist_name || ' just launched ' || COALESCE('$' || v_ticker, 'a coin'),
           'You backed their release early — be one of the first to trade it on pump.fun.',
           '/profiles/' || _user_id
      FROM public.project_cheers pc
      JOIN public.projects p ON p.id = pc.project_id
     WHERE p.user_id = _user_id
       AND p.is_public = true
       AND pc.user_id <> _user_id;
  ELSE
    UPDATE public.profiles
       SET token_mint_address_pending = NULL,
           token_ticker_pending = NULL,
           token_submission_status = 'rejected',
           token_reviewed_at = now(),
           token_review_note = _note
     WHERE user_id = _user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.review_token_submission(uuid, boolean, text) FROM public;
GRANT EXECUTE ON FUNCTION public.review_token_submission(uuid, boolean, text) TO authenticated;
