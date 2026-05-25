-- Finding: gated_works_file_url_public_bucket
-- Reject works.file_url pointing to public buckets when gating is non-null.
CREATE OR REPLACE FUNCTION public.enforce_gated_work_file_url()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.gating IS NOT NULL
     AND NEW.file_url IS NOT NULL
     AND (
       NEW.file_url LIKE '%/storage/v1/object/public/flow-uploads/%'
       OR NEW.file_url LIKE '%/storage/v1/object/public/works/%'
       OR NEW.file_url LIKE '%/storage/v1/object/public/avatars/%'
     ) THEN
    RAISE EXCEPTION 'Gated works must not store a public-bucket file_url. Upload to the private gated-works bucket and set gating.gated_path instead.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_gated_work_file_url ON public.works;
CREATE TRIGGER trg_enforce_gated_work_file_url
BEFORE INSERT OR UPDATE OF file_url, gating ON public.works
FOR EACH ROW EXECUTE FUNCTION public.enforce_gated_work_file_url();

-- Finding: waitlist_email_exposure
-- Tighten anonymous INSERT to require a syntactically valid email and a
-- reasonable length. (Rate limiting still belongs in an edge function, but
-- removing the unconditional "true" check kills the obvious abuse vector.)
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'waitlist' AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.waitlist', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Anyone can join waitlist with a valid email"
ON public.waitlist
FOR INSERT
TO anon, authenticated
WITH CHECK (
  email IS NOT NULL
  AND length(email) BETWEEN 5 AND 254
  AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
);
