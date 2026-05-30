-- Pillar 2: token-holder access to private feed
-- Fans who hold a creator's pump.fun token get the same private-feed access as subscribers.

CREATE TABLE public.creator_token_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  creator_id uuid NOT NULL,
  wallet_address text NOT NULL,
  mint_address text NOT NULL,
  balance numeric NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, creator_id)
);

CREATE INDEX creator_token_grants_user_idx ON public.creator_token_grants (user_id, expires_at);
CREATE INDEX creator_token_grants_creator_idx ON public.creator_token_grants (creator_id);

GRANT SELECT ON public.creator_token_grants TO authenticated;
GRANT ALL ON public.creator_token_grants TO service_role;

ALTER TABLE public.creator_token_grants ENABLE ROW LEVEL SECURITY;

-- Users can read their own grants; writes only via service_role (edge fn).
CREATE POLICY "Users read own token grants"
ON public.creator_token_grants FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Security definer fn for RLS reuse without recursion.
CREATE OR REPLACE FUNCTION public.holds_creator_token(_creator_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.creator_token_grants
    WHERE user_id = auth.uid()
      AND creator_id = _creator_id
      AND expires_at > now()
      AND balance > 0
  )
$$;

-- Extend works SELECT policy: also unlock via token grant.
DROP POLICY IF EXISTS "Public or subscribed works are viewable" ON public.works;
CREATE POLICY "Public or subscribed works are viewable"
ON public.works
FOR SELECT
USING (
  archived_at IS NULL
  AND (
    visibility = 'public'
    OR (
      auth.uid() IS NOT NULL
      AND auth.uid() <> user_id
      AND (
        public.is_subscribed_to(user_id)
        OR public.holds_creator_token(user_id)
      )
    )
  )
);

-- Extend gated-works storage policy: token-holders can also read.
DROP POLICY IF EXISTS "Subscribers read gated files of their creators" ON storage.objects;
CREATE POLICY "Subscribers or token-holders read gated files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'gated-works'
  AND EXISTS (
    SELECT 1
    FROM public.works w
    WHERE (w.gating ->> 'gated_path') = storage.objects.name
      AND (
        public.is_subscribed_to(w.user_id)
        OR public.holds_creator_token(w.user_id)
      )
  )
);

-- updated_at trigger
CREATE TRIGGER creator_token_grants_updated_at
BEFORE UPDATE ON public.creator_token_grants
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();