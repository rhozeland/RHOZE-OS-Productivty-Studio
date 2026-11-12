-- Permanently invalidate grants when a creator's live token changes.
-- Every change to profiles.token_mint_address starts a new token generation,
-- and a grant only counts for the generation it was issued in, so re-approving
-- an old mint never revives its grants. Grants without a generation never count.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS token_generation bigint NOT NULL DEFAULT 0;
ALTER TABLE public.creator_token_grants
  ADD COLUMN IF NOT EXISTS token_generation bigint;

-- Server-maintained; client-supplied values are ignored.
CREATE OR REPLACE FUNCTION public.track_token_generation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.token_generation := 0;
  ELSIF NEW.token_mint_address IS DISTINCT FROM OLD.token_mint_address THEN
    NEW.token_generation := OLD.token_generation + 1;
  ELSE
    NEW.token_generation := OLD.token_generation;
  END IF;
  RETURN NEW;
END;
$$;

-- Must sort after enforce_token_approval_trg, which can revert the live mint.
DROP TRIGGER IF EXISTS track_token_generation_trg ON public.profiles;
CREATE TRIGGER track_token_generation_trg
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.track_token_generation();

CREATE OR REPLACE FUNCTION public.is_current_creator_token(_creator_id uuid, _mint_address text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.creator_token_grants g
      JOIN public.profiles p ON p.user_id = g.creator_id
     WHERE g.user_id = auth.uid()
       AND g.creator_id = _creator_id
       AND g.mint_address = _mint_address
       AND p.token_mint_address = _mint_address
       AND p.token_mint_address <> ''
       AND g.token_generation = p.token_generation
  )
$$;

-- Signed URLs can't be revoked, so token holders no longer read gated files directly.
DROP POLICY IF EXISTS "Subscribers or token-holders read gated files" ON storage.objects;
DROP POLICY IF EXISTS "Subscribers read gated files of their creators" ON storage.objects;
CREATE POLICY "Subscribers read gated files of their creators"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'gated-works'
  AND EXISTS (
    SELECT 1
    FROM public.works w
    WHERE (w.gating ->> 'gated_path') = storage.objects.name
      AND public.is_subscribed_to(w.user_id)
  )
);
