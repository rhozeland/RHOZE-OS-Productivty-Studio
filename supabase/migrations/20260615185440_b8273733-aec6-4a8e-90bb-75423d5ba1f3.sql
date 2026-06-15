
ALTER TABLE public.artist_announcements
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS artist_announcements_one_pin_per_user
  ON public.artist_announcements (user_id)
  WHERE is_pinned = true;

CREATE OR REPLACE FUNCTION public.set_pinned_announcement(_announcement_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid;
BEGIN
  SELECT user_id INTO _user FROM public.artist_announcements WHERE id = _announcement_id;
  IF _user IS NULL THEN RAISE EXCEPTION 'Announcement not found'; END IF;
  IF _user <> auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  UPDATE public.artist_announcements
    SET is_pinned = false, pinned_at = NULL
    WHERE user_id = _user AND is_pinned = true AND id <> _announcement_id;

  UPDATE public.artist_announcements
    SET is_pinned = true, pinned_at = now()
    WHERE id = _announcement_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.unpin_announcement(_announcement_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid;
BEGIN
  SELECT user_id INTO _user FROM public.artist_announcements WHERE id = _announcement_id;
  IF _user IS NULL THEN RAISE EXCEPTION 'Announcement not found'; END IF;
  IF _user <> auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  UPDATE public.artist_announcements
    SET is_pinned = false, pinned_at = NULL
    WHERE id = _announcement_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_pinned_announcement(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unpin_announcement(uuid) TO authenticated;
