
CREATE TABLE IF NOT EXISTS public.access_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  note text,
  active boolean NOT NULL DEFAULT true,
  max_uses integer,
  uses integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_codes TO authenticated;
GRANT ALL ON public.access_codes TO service_role;

ALTER TABLE public.access_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage access codes"
ON public.access_codes FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.redeem_access_code(_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.access_codes%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.access_codes
  WHERE upper(trim(code)) = upper(trim(_code))
  LIMIT 1;

  IF NOT FOUND THEN RETURN false; END IF;
  IF NOT r.active THEN RETURN false; END IF;
  IF r.expires_at IS NOT NULL AND r.expires_at < now() THEN RETURN false; END IF;
  IF r.max_uses IS NOT NULL AND r.uses >= r.max_uses THEN RETURN false; END IF;

  UPDATE public.access_codes SET uses = uses + 1 WHERE id = r.id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_access_code(text) TO anon, authenticated;

INSERT INTO public.access_codes (code, note)
VALUES ('RHOZE-2026', 'Initial founding invite')
ON CONFLICT (code) DO NOTHING;
