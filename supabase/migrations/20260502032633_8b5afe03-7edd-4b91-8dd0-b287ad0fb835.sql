-- 1. Profile fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_verification_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_verification_status_check
  CHECK (verification_status IN ('none','pending','verified','revoked'));

-- 2. Unverified flag on works
ALTER TABLE public.works
  ADD COLUMN IF NOT EXISTS is_unverified boolean NOT NULL DEFAULT false;

-- 3. Verification requests table
CREATE TABLE IF NOT EXISTS public.artist_verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_url text NOT NULL,
  social_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  contact_email text NOT NULL,
  bio text,
  wallet_address text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  review_note text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_avr_user ON public.artist_verification_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_avr_status ON public.artist_verification_requests (status);

ALTER TABLE public.artist_verification_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner read own verification" ON public.artist_verification_requests;
CREATE POLICY "owner read own verification"
  ON public.artist_verification_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "owner insert own verification" ON public.artist_verification_requests;
CREATE POLICY "owner insert own verification"
  ON public.artist_verification_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "owner update own pending verification" ON public.artist_verification_requests;
CREATE POLICY "owner update own pending verification"
  ON public.artist_verification_requests FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending')
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "admin update verification" ON public.artist_verification_requests;
CREATE POLICY "admin update verification"
  ON public.artist_verification_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_avr_updated_at
  BEFORE UPDATE ON public.artist_verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Approval trigger: flip profile to verified + notify
CREATE OR REPLACE FUNCTION public.handle_artist_verification_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    UPDATE public.profiles
       SET verification_status = 'verified',
           verified_at = now(),
           updated_at = now()
     WHERE user_id = NEW.user_id;

    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (NEW.user_id, 'verification',
            'You''re a Verified Artist',
            'Verified IP, coins, paid services and paid Spaces are now unlocked.',
            '/settings');

    NEW.decided_at := now();
  ELSIF NEW.status = 'rejected' AND (OLD.status IS DISTINCT FROM 'rejected') THEN
    UPDATE public.profiles
       SET verification_status = 'none', updated_at = now()
     WHERE user_id = NEW.user_id AND verification_status = 'pending';

    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (NEW.user_id, 'verification',
            'Verification needs another look',
            COALESCE(NEW.review_note, 'Update your submission and try again.'),
            '/settings/verification');

    NEW.decided_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_artist_verification ON public.artist_verification_requests;
CREATE TRIGGER trg_handle_artist_verification
  BEFORE UPDATE ON public.artist_verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_artist_verification_decision();

-- 5. On INSERT, also flip profile to pending
CREATE OR REPLACE FUNCTION public.handle_artist_verification_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
     SET verification_status = 'pending', updated_at = now()
   WHERE user_id = NEW.user_id
     AND verification_status IN ('none','revoked');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_avr_submitted ON public.artist_verification_requests;
CREATE TRIGGER trg_handle_avr_submitted
  AFTER INSERT ON public.artist_verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_artist_verification_submitted();

-- 6. Helper
CREATE OR REPLACE FUNCTION public.is_verified_artist(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND verification_status = 'verified'
  );
$$;

-- 7. Gate coin_launches insert
CREATE OR REPLACE FUNCTION public.enforce_verified_for_coin_launch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_verified_artist(NEW.creator_id) THEN
    RAISE EXCEPTION 'Only Verified Artists can launch a coin. Submit verification at /settings/verification.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_coin_launch_verified ON public.coin_launches;
CREATE TRIGGER trg_coin_launch_verified
  BEFORE INSERT ON public.coin_launches
  FOR EACH ROW EXECUTE FUNCTION public.enforce_verified_for_coin_launch();

-- 8. Gate services insert (treats paid service creation as monetization)
CREATE OR REPLACE FUNCTION public.enforce_verified_for_service()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_verified_artist(NEW.user_id) THEN
    RAISE EXCEPTION 'Only Verified Artists can list paid services. Submit verification at /settings/verification.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- Only attach if services table exists with user_id column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='services' AND column_name='user_id'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_service_verified ON public.services';
    EXECUTE 'CREATE TRIGGER trg_service_verified BEFORE INSERT ON public.services FOR EACH ROW EXECUTE FUNCTION public.enforce_verified_for_service()';
  END IF;
END$$;

-- 9. Storage bucket for verification videos (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('artist-verification','artist-verification', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "owner upload verification video" ON storage.objects;
CREATE POLICY "owner upload verification video"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'artist-verification' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "owner read verification video" ON storage.objects;
CREATE POLICY "owner read verification video"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'artist-verification'
         AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin')));

DROP POLICY IF EXISTS "owner delete verification video" ON storage.objects;
CREATE POLICY "owner delete verification video"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'artist-verification' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 10. Backfill: keep existing user data permissive — leave verification_status='none'.
-- Owners (user_id) can still update their own profiles via existing RLS; status field is owner-controlled
-- but real flips happen via the trigger above (so a malicious user can't self-promote without an approved request,
-- as long as application code routes through artist_verification_requests). For belt + suspenders:
CREATE OR REPLACE FUNCTION public.guard_profile_verification_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
    -- Allow only if caller is admin OR the change came from our SECURITY DEFINER triggers (auth.uid() may be null then).
    IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'admin') THEN
      RAISE EXCEPTION 'verification_status can only be changed via verification flow';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_verification_status ON public.profiles;
CREATE TRIGGER trg_guard_profile_verification_status
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_verification_status();