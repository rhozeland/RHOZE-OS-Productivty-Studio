-- Notify all admins when a new artist_verification_requests row is inserted
CREATE OR REPLACE FUNCTION public.notify_admins_on_verification_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin RECORD;
  v_name  TEXT;
BEGIN
  SELECT COALESCE(p.display_name, p.username, 'A creator')
    INTO v_name
  FROM public.profiles p
  WHERE p.user_id = NEW.user_id;

  FOR v_admin IN
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      v_admin.user_id,
      'admin_verification_request',
      'New artist verification',
      COALESCE(v_name, 'A creator') || ' submitted a Verified Artist request.',
      '/admin?tab=verifications'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_on_verification_request
  ON public.artist_verification_requests;

CREATE TRIGGER trg_notify_admins_on_verification_request
AFTER INSERT ON public.artist_verification_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_admins_on_verification_request();