
-- Curator Invites Table
CREATE TABLE public.curator_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  split_config_id UUID NOT NULL REFERENCES public.revenue_split_configs(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL,
  invitee_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','revoked')),
  message TEXT,
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (split_config_id, invitee_id)
);

CREATE INDEX idx_curator_invites_invitee ON public.curator_invites(invitee_id, status);
CREATE INDEX idx_curator_invites_inviter ON public.curator_invites(inviter_id, status);

ALTER TABLE public.curator_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parties can view own invites"
  ON public.curator_invites FOR SELECT
  TO authenticated
  USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

CREATE POLICY "Inviter can create invites"
  ON public.curator_invites FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = inviter_id
    AND EXISTS (
      SELECT 1 FROM public.revenue_split_configs c
      WHERE c.id = split_config_id AND c.creator_id = auth.uid()
    )
  );

CREATE POLICY "Parties can update invites"
  ON public.curator_invites FOR UPDATE
  TO authenticated
  USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

-- Trigger: on accept, attach curator to split config + notify both
CREATE OR REPLACE FUNCTION public.handle_curator_invite_response()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inviter_name TEXT;
  v_invitee_name TEXT;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  NEW.responded_at := now();
  NEW.updated_at := now();

  SELECT COALESCE(display_name, username, 'Someone') INTO v_inviter_name
    FROM public.profiles WHERE user_id = NEW.inviter_id;
  SELECT COALESCE(display_name, username, 'Someone') INTO v_invitee_name
    FROM public.profiles WHERE user_id = NEW.invitee_id;

  IF NEW.status = 'accepted' THEN
    UPDATE public.revenue_split_configs
       SET curator_id = NEW.invitee_id,
           updated_at = now()
     WHERE id = NEW.split_config_id;

    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (NEW.inviter_id, 'curator_accepted',
            v_invitee_name || ' accepted your curator invite',
            'They will now receive their share on every release.',
            '/inquiries');

    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (NEW.invitee_id, 'curator_role',
            'You are now a curator',
            'You will start receiving curator splits from ' || v_inviter_name || '.',
            '/seller');

  ELSIF NEW.status = 'declined' THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (NEW.inviter_id, 'curator_declined',
            v_invitee_name || ' declined your curator invite',
            'You can invite someone else from the revenue split panel.',
            '/inquiries');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER curator_invite_response_trigger
  BEFORE UPDATE ON public.curator_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_curator_invite_response();

-- Trigger: on insert, notify the invitee
CREATE OR REPLACE FUNCTION public.handle_curator_invite_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inviter_name TEXT;
BEGIN
  SELECT COALESCE(display_name, username, 'Someone') INTO v_inviter_name
    FROM public.profiles WHERE user_id = NEW.inviter_id;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (NEW.invitee_id, 'curator_invite',
          v_inviter_name || ' invited you to curate',
          'Accept to start receiving curator splits on their work.',
          '/inquiries?tab=curator');

  RETURN NEW;
END;
$$;

CREATE TRIGGER curator_invite_created_trigger
  AFTER INSERT ON public.curator_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_curator_invite_created();

-- The notifications.user_id RLS only allows users to insert their own;
-- since the triggers run as SECURITY DEFINER, they bypass RLS.
-- However, the existing INSERT policy on notifications requires auth.uid() = user_id.
-- SECURITY DEFINER functions bypass RLS by default in Postgres ONLY when the
-- function owner is the table owner. To be safe, explicitly grant permission:
GRANT INSERT ON public.notifications TO postgres;