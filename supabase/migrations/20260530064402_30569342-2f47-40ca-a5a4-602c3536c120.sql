-- =========================================================
-- Wave A — multi-coin per creator
-- =========================================================

CREATE TABLE IF NOT EXISTS public.creator_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL,
  mint_address  text NOT NULL,
  ticker        text NOT NULL,
  name          text,
  is_primary    boolean NOT NULL DEFAULT false,
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','approved','rejected')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  approved_at   timestamptz,
  approved_by   uuid,
  reject_reason text,
  UNIQUE (mint_address)
);

CREATE INDEX IF NOT EXISTS creator_tokens_user_idx
  ON public.creator_tokens(user_id);
CREATE INDEX IF NOT EXISTS creator_tokens_status_idx
  ON public.creator_tokens(status);
-- Only one primary per user
CREATE UNIQUE INDEX IF NOT EXISTS creator_tokens_one_primary_per_user
  ON public.creator_tokens(user_id)
  WHERE is_primary = true;

GRANT SELECT ON public.creator_tokens TO anon;
GRANT SELECT, INSERT, UPDATE ON public.creator_tokens TO authenticated;
GRANT ALL ON public.creator_tokens TO service_role;

ALTER TABLE public.creator_tokens ENABLE ROW LEVEL SECURITY;

-- Public can read approved coins
CREATE POLICY "Approved creator coins are public"
ON public.creator_tokens FOR SELECT
USING (status = 'approved');

-- Owners can read their own (any status)
CREATE POLICY "Owners read their own coins"
ON public.creator_tokens FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admins can read everything
CREATE POLICY "Admins read all coins"
ON public.creator_tokens FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Owners can insert pending submissions for themselves
CREATE POLICY "Owners submit own coin"
ON public.creator_tokens FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND status = 'pending');

-- Owners can edit metadata of their own pending coins
CREATE POLICY "Owners edit own pending coin"
ON public.creator_tokens FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND status = 'pending')
WITH CHECK (user_id = auth.uid() AND status = 'pending');

-- Admins can update any
CREATE POLICY "Admins manage all coins"
ON public.creator_tokens FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE TRIGGER creator_tokens_set_updated_at
BEFORE UPDATE ON public.creator_tokens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- Mirror primary coin → profiles.token_* for back-compat
-- =========================================================
CREATE OR REPLACE FUNCTION public.mirror_primary_token_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    IF OLD.is_primary AND OLD.status = 'approved' THEN
      UPDATE public.profiles
         SET token_mint_address = NULL,
             token_ticker       = NULL
       WHERE user_id = OLD.user_id;
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.is_primary AND NEW.status = 'approved' THEN
    UPDATE public.profiles
       SET token_mint_address = NEW.mint_address,
           token_ticker       = NEW.ticker
     WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER creator_tokens_mirror_primary
AFTER INSERT OR UPDATE OR DELETE ON public.creator_tokens
FOR EACH ROW EXECUTE FUNCTION public.mirror_primary_token_to_profile();

-- =========================================================
-- Backfill from profiles
-- =========================================================
INSERT INTO public.creator_tokens
  (user_id, mint_address, ticker, name, is_primary, status, approved_at)
SELECT
  p.user_id,
  p.token_mint_address,
  COALESCE(p.token_ticker, 'COIN'),
  COALESCE(p.token_ticker, 'COIN'),
  true,
  'approved',
  now()
FROM public.profiles p
WHERE p.token_mint_address IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.creator_tokens ct
    WHERE ct.mint_address = p.token_mint_address
  );

-- =========================================================
-- Admin approval RPC
-- =========================================================
CREATE OR REPLACE FUNCTION public.review_creator_token(
  _token_id uuid,
  _decision text,
  _reason   text DEFAULT NULL
)
RETURNS public.creator_tokens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.creator_tokens;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  IF _decision NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'invalid decision';
  END IF;

  UPDATE public.creator_tokens
     SET status        = _decision,
         approved_at   = CASE WHEN _decision='approved' THEN now() ELSE approved_at END,
         approved_by   = CASE WHEN _decision='approved' THEN auth.uid() ELSE approved_by END,
         reject_reason = CASE WHEN _decision='rejected' THEN _reason ELSE NULL END
   WHERE id = _token_id
   RETURNING * INTO row;

  RETURN row;
END
$$;

GRANT EXECUTE ON FUNCTION public.review_creator_token(uuid, text, text) TO authenticated;