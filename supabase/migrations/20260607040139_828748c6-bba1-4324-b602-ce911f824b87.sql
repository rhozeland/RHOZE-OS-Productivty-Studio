
-- ============================================================
-- Helper: notify all supporters (cheerers) of a project
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_project_supporters(
  _project_id uuid,
  _exclude_user uuid,
  _type text,
  _title text,
  _body text,
  _link text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT DISTINCT pc.user_id, _type, _title, _body, _link
  FROM public.project_cheers pc
  WHERE pc.project_id = _project_id
    AND (_exclude_user IS NULL OR pc.user_id <> _exclude_user);
END;
$$;

-- ============================================================
-- Helper: notify all followers of an artist (cheerers across
-- any of their projects + active subscribers).
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_artist_followers(
  _artist_id uuid,
  _exclude_user uuid,
  _type text,
  _title text,
  _body text,
  _link text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT DISTINCT follower_id, _type, _title, _body, _link
  FROM (
    SELECT pc.user_id AS follower_id
    FROM public.project_cheers pc
    JOIN public.projects p ON p.id = pc.project_id
    WHERE p.user_id = _artist_id
    UNION
    SELECT cs.subscriber_id
    FROM public.creator_subscriptions cs
    WHERE cs.creator_id = _artist_id
      AND cs.status = 'active'
  ) sub
  WHERE _exclude_user IS NULL OR follower_id <> _exclude_user;
END;
$$;

-- ============================================================
-- 1. Notify creator when someone supports their release
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_new_cheer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_title text;
  v_slug text;
BEGIN
  SELECT user_id, title, public_slug INTO v_owner, v_title, v_slug
  FROM public.projects WHERE id = NEW.project_id;

  IF v_owner IS NOT NULL AND v_owner <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      v_owner,
      'project_supported',
      'New supporter on your release',
      'Someone is supporting "' || v_title || '"',
      CASE WHEN v_slug IS NOT NULL THEN '/release/' || v_slug ELSE '/projects/' || NEW.project_id END
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_new_cheer ON public.project_cheers;
CREATE TRIGGER trg_notify_on_new_cheer
AFTER INSERT ON public.project_cheers
FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_cheer();

-- ============================================================
-- 2. Milestone status change → notify supporters
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_milestone_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id uuid;
  v_project_title text;
  v_slug text;
  v_owner uuid;
  v_label text;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT p.id, p.title, p.public_slug, p.user_id
    INTO v_project_id, v_project_title, v_slug, v_owner
  FROM public.project_contracts c
  JOIN public.projects p ON p.id = c.project_id
  WHERE c.id = NEW.contract_id;

  IF v_project_id IS NULL THEN RETURN NEW; END IF;

  v_label := CASE NEW.status
    WHEN 'approved' THEN 'completed'
    WHEN 'released' THEN 'completed'
    WHEN 'submitted' THEN 'submitted for review'
    WHEN 'in_progress' THEN 'started'
    ELSE replace(NEW.status, '_', ' ')
  END;

  PERFORM public.notify_project_supporters(
    v_project_id,
    v_owner,
    'project_update',
    'Milestone ' || v_label,
    '"' || NEW.title || '" on "' || v_project_title || '"',
    CASE WHEN v_slug IS NOT NULL THEN '/release/' || v_slug ELSE '/projects/' || v_project_id END
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_milestone_change ON public.project_milestones;
CREATE TRIGGER trg_notify_on_milestone_change
AFTER UPDATE OF status ON public.project_milestones
FOR EACH ROW EXECUTE FUNCTION public.notify_on_milestone_change();

-- ============================================================
-- 3. Deliverable added / checked off → notify supporters
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_deliverable_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_title text;
  v_slug text;
  v_owner uuid;
  v_is_public boolean;
  v_msg text;
BEGIN
  SELECT title, public_slug, user_id, is_public
    INTO v_project_title, v_slug, v_owner, v_is_public
  FROM public.projects WHERE id = NEW.project_id;

  IF NOT COALESCE(v_is_public, false) THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    v_msg := 'New task added';
  ELSIF TG_OP = 'UPDATE' AND NEW.completed IS DISTINCT FROM OLD.completed THEN
    v_msg := CASE WHEN NEW.completed THEN 'Task checked off' ELSE 'Task reopened' END;
  ELSE
    RETURN NEW;
  END IF;

  PERFORM public.notify_project_supporters(
    NEW.project_id,
    v_owner,
    'project_update',
    v_msg || ' on "' || v_project_title || '"',
    NEW.title,
    CASE WHEN v_slug IS NOT NULL THEN '/release/' || v_slug ELSE '/projects/' || NEW.project_id END
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_deliverable_change ON public.project_deliverables;
CREATE TRIGGER trg_notify_on_deliverable_change
AFTER INSERT OR UPDATE OF completed ON public.project_deliverables
FOR EACH ROW EXECUTE FUNCTION public.notify_on_deliverable_change();

-- ============================================================
-- 4. Project: published, tokenize-ready, or coin linked
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_project_milestones()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link text;
BEGIN
  v_link := CASE WHEN NEW.public_slug IS NOT NULL
                 THEN '/release/' || NEW.public_slug
                 ELSE '/projects/' || NEW.id END;

  -- Just became public — notify the artist's existing followers
  IF NEW.is_public = true AND COALESCE(OLD.is_public, false) = false THEN
    PERFORM public.notify_artist_followers(
      NEW.user_id, NEW.user_id,
      'release_published',
      'New release: ' || NEW.title,
      'An artist you support just shared a new release',
      v_link
    );
  END IF;

  -- Flagged as ready to tokenize → tell the supporters
  IF NEW.tokenize_ready = true AND COALESCE(OLD.tokenize_ready, false) = false THEN
    PERFORM public.notify_project_supporters(
      NEW.id, NEW.user_id,
      'project_update',
      '"' || NEW.title || '" is going on-chain soon',
      'A&R flagged this release for tokenization on pump.fun',
      v_link
    );
  END IF;

  -- Coin linked → tell the supporters
  IF NEW.linked_token_id IS NOT NULL
     AND NEW.linked_token_id IS DISTINCT FROM OLD.linked_token_id THEN
    PERFORM public.notify_project_supporters(
      NEW.id, NEW.user_id,
      'project_update',
      '"' || NEW.title || '" is now a coin',
      'You can back this release on-chain',
      v_link
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_project_milestones ON public.projects;
CREATE TRIGGER trg_notify_on_project_milestones
AFTER UPDATE OF is_public, tokenize_ready, linked_token_id ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.notify_on_project_milestones();

-- ============================================================
-- 5. New public work uploaded → notify the artist's followers
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_new_work()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.visibility, 'public') <> 'public' THEN
    RETURN NEW;
  END IF;

  PERFORM public.notify_artist_followers(
    NEW.user_id, NEW.user_id,
    'artist_post',
    'New post from an artist you support',
    NEW.title,
    '/profile/' || NEW.user_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_new_work ON public.works;
CREATE TRIGGER trg_notify_on_new_work
AFTER INSERT ON public.works
FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_work();
