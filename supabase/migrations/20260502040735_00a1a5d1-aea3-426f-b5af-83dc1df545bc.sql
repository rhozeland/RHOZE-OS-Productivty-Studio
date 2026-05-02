-- Expand allowed statuses
ALTER TABLE public.artist_verification_requests
  DROP CONSTRAINT IF EXISTS artist_verification_requests_status_check;

ALTER TABLE public.artist_verification_requests
  ADD CONSTRAINT artist_verification_requests_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'in_review'::text, 'approved'::text, 'rejected'::text, 'revoked'::text]));

-- Trigger function: enqueue transactional email via send-transactional-email edge function
CREATE OR REPLACE FUNCTION public.notify_verification_status_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url text;
  v_service_key text;
  v_template text;
  v_status text;
  v_to text;
  v_display_name text;
  v_should_send boolean := false;
BEGIN
  -- Determine if we should send
  IF TG_OP = 'INSERT' THEN
    v_should_send := true;
    v_status := COALESCE(NEW.status, 'pending');
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_should_send := true;
    v_status := NEW.status;
  END IF;

  IF NOT v_should_send THEN
    RETURN NEW;
  END IF;

  -- Map "pending" on insert to "submitted" template state
  v_template := CASE
    WHEN TG_OP = 'INSERT' AND v_status = 'pending' THEN 'submitted'
    WHEN v_status = 'pending' THEN 'submitted'
    ELSE v_status
  END;

  -- Resolve recipient: prefer the request's contact_email, fall back to auth.users.email
  v_to := NEW.contact_email;
  IF v_to IS NULL OR v_to = '' THEN
    SELECT email INTO v_to FROM auth.users WHERE id = NEW.user_id;
  END IF;

  IF v_to IS NULL OR v_to = '' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(display_name, username) INTO v_display_name
  FROM public.profiles WHERE user_id = NEW.user_id LIMIT 1;

  -- Pull config (Vault) for service-role + url
  BEGIN
    SELECT decrypted_secret INTO v_service_key
    FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_service_key := NULL;
  END;

  v_supabase_url := 'https://puielauovddatgqvgxdy.supabase.co';

  IF v_service_key IS NULL THEN
    -- No key configured yet; skip silently rather than break the write
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/send-transactional-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := jsonb_build_object(
      'to', v_to,
      'template', 'verification-status',
      'purpose', 'transactional',
      'idempotency_key', 'verification-' || NEW.id::text || '-' || v_template,
      'data', jsonb_build_object(
        'status', v_template,
        'displayName', v_display_name,
        'reviewNote', NEW.review_note
      )
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_verification_status_email ON public.artist_verification_requests;
CREATE TRIGGER trg_notify_verification_status_email
AFTER INSERT OR UPDATE OF status ON public.artist_verification_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_verification_status_email();