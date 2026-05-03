-- Add invite status + accept flow for event collaborators
DO $$ BEGIN
  CREATE TYPE public.event_collaborator_status AS ENUM ('pending','accepted','declined');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.event_collaborators
  ADD COLUMN IF NOT EXISTS status public.event_collaborator_status NOT NULL DEFAULT 'accepted';

-- Set new invites to pending unless self-add
CREATE OR REPLACE FUNCTION public.handle_new_event_collaborator()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event RECORD;
  v_inviter_name TEXT;
BEGIN
  IF NEW.user_id <> NEW.invited_by THEN
    NEW.status := 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_collaborator_set_status ON public.event_collaborators;
CREATE TRIGGER event_collaborator_set_status
BEFORE INSERT ON public.event_collaborators
FOR EACH ROW EXECUTE FUNCTION public.handle_new_event_collaborator();

-- Notify invitee on insert
CREATE OR REPLACE FUNCTION public.notify_event_collaborator_invite()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event RECORD;
  v_inviter TEXT;
BEGIN
  IF NEW.status <> 'pending' THEN RETURN NEW; END IF;
  SELECT id, title INTO v_event FROM public.events WHERE id = NEW.event_id;
  SELECT COALESCE(display_name, username, 'Someone') INTO v_inviter
    FROM public.profiles WHERE user_id = NEW.invited_by;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    NEW.user_id,
    'event_collab_invite',
    'You''ve been invited to co-host',
    COALESCE(v_inviter,'Someone') || ' invited you to ' || COALESCE(v_event.title,'an event'),
    '/spaces/events/' || NEW.event_id::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_collaborator_notify ON public.event_collaborators;
CREATE TRIGGER event_collaborator_notify
AFTER INSERT ON public.event_collaborators
FOR EACH ROW EXECUTE FUNCTION public.notify_event_collaborator_invite();

-- Only accepted collaborators should manage
CREATE OR REPLACE FUNCTION public.can_manage_event(_event_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events e WHERE e.id = _event_id AND e.host_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.event_collaborators c
    WHERE c.event_id = _event_id AND c.user_id = _user_id AND c.status = 'accepted'
  );
$$;

-- Allow invitee to update their own invite (accept/decline)
DROP POLICY IF EXISTS "Invitee can respond to own invite" ON public.event_collaborators;
CREATE POLICY "Invitee can respond to own invite"
ON public.event_collaborators FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);