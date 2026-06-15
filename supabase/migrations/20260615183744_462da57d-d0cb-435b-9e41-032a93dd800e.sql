
CREATE TABLE public.artist_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  image_url text,
  link_url text,
  scheduled_for timestamptz,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_artist_announcements_user_published
  ON public.artist_announcements (user_id, published_at DESC);

GRANT SELECT ON public.artist_announcements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.artist_announcements TO authenticated;
GRANT ALL ON public.artist_announcements TO service_role;

ALTER TABLE public.artist_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published announcements"
  ON public.artist_announcements FOR SELECT
  USING (published_at <= now());

CREATE POLICY "Owner can read own announcements"
  ON public.artist_announcements FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owner can insert own announcements"
  ON public.artist_announcements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can update own announcements"
  ON public.artist_announcements FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can delete own announcements"
  ON public.artist_announcements FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_artist_announcements_updated_at
  BEFORE UPDATE ON public.artist_announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Fan out notifications to all active subscribers when an announcement is published
CREATE OR REPLACE FUNCTION public.fanout_announcement_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  artist_name text;
  preview text;
BEGIN
  -- Only fan out for published-now announcements
  IF NEW.published_at > now() THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(display_name, username, 'An artist')
    INTO artist_name
    FROM public.profiles WHERE user_id = NEW.user_id;

  preview := CASE
    WHEN char_length(NEW.body) > 140 THEN substring(NEW.body from 1 for 137) || '…'
    ELSE NEW.body
  END;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT
    cs.subscriber_id,
    'announcement',
    artist_name || ' posted an update',
    preview,
    '/profile/' || NEW.user_id::text || '?tab=updates'
  FROM public.creator_subscriptions cs
  WHERE cs.creator_id = NEW.user_id
    AND cs.status = 'active'
    AND cs.subscriber_id <> NEW.user_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fanout_announcement_notifications
  AFTER INSERT ON public.artist_announcements
  FOR EACH ROW EXECUTE FUNCTION public.fanout_announcement_notifications();
