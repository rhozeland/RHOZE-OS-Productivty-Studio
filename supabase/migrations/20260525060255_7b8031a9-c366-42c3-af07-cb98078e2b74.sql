
-- 1) event_tickets: drop the broad "Collaborators read tickets" SELECT policy.
--    qr_token / attendance_hash / payment_reference must not be readable by
--    every accepted event collaborator. Hosts retain access via the existing
--    "Hosts view tickets for own events" policy; collaborators who need to
--    manage tickets without seeing the QR token must go through a future
--    sanitized view.
DROP POLICY IF EXISTS "Collaborators read tickets" ON public.event_tickets;
DROP POLICY IF EXISTS "Collaborators update tickets" ON public.event_tickets;

-- Re-add a narrower UPDATE policy for collaborators (status / check-in only is
-- enforced at the app layer; this just preserves write access for non-host
-- managers without granting them SELECT on qr_token).
CREATE POLICY "Collaborators can update tickets on managed events"
  ON public.event_tickets
  FOR UPDATE
  USING (public.can_manage_event(event_id, auth.uid()));

-- 2) reward_daily_caps: lock SELECT to admins only.
--    Exposing daily caps lets users farm rewards right up to the threshold.
DROP POLICY IF EXISTS "reward_caps_read_all_authed" ON public.reward_daily_caps;
CREATE POLICY "reward_caps_admin_read"
  ON public.reward_daily_caps
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3) works.gating: prevent users from pointing gated_path at another user's
--    storage object. The storage policy "Subscribers read gated files of
--    their creators" trusts works.gating->>'gated_path'; this trigger
--    enforces that the path is inside the owner's folder.
CREATE OR REPLACE FUNCTION public.validate_works_gating_path()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _gated_path text;
  _expected_prefix text;
BEGIN
  IF NEW.gating IS NULL THEN
    RETURN NEW;
  END IF;

  _gated_path := NEW.gating ->> 'gated_path';
  IF _gated_path IS NULL OR length(_gated_path) = 0 THEN
    RETURN NEW;
  END IF;

  -- Owner's storage folder is "<user_id>/..." inside the gated-works bucket.
  _expected_prefix := NEW.user_id::text || '/';
  IF position(_expected_prefix in _gated_path) <> 1 THEN
    RAISE EXCEPTION 'gating.gated_path must live inside the owner''s folder (%).', _expected_prefix
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_works_gating_path_trg ON public.works;
CREATE TRIGGER validate_works_gating_path_trg
  BEFORE INSERT OR UPDATE OF gating, user_id ON public.works
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_works_gating_path();
