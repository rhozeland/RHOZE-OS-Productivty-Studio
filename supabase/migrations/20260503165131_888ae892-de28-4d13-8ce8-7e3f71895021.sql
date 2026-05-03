-- ── BUDDY STATUS ENUM ─────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.buddy_status AS ENUM ('pending', 'accepted', 'blocked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── USER NOTES ────────────────────────────────────────────
CREATE TABLE public.user_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  body TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX user_notes_expires_at_idx ON public.user_notes (expires_at);

CREATE OR REPLACE FUNCTION public.validate_user_note()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.body IS NULL OR length(trim(NEW.body)) = 0 THEN
    RAISE EXCEPTION 'Note body cannot be empty';
  END IF;
  IF length(NEW.body) > 300 THEN
    RAISE EXCEPTION 'Note must be 300 characters or fewer';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_validate_user_note
BEFORE INSERT OR UPDATE ON public.user_notes
FOR EACH ROW EXECUTE FUNCTION public.validate_user_note();

CREATE TRIGGER trg_user_notes_touch
BEFORE UPDATE ON public.user_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;

-- ── USER BUDDIES ──────────────────────────────────────────
CREATE TABLE public.user_buddies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID NOT NULL,
  addressee_id UUID NOT NULL,
  status public.buddy_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_buddies_no_self CHECK (requester_id <> addressee_id),
  CONSTRAINT user_buddies_unique_pair UNIQUE (requester_id, addressee_id)
);

CREATE INDEX user_buddies_requester_idx ON public.user_buddies (requester_id, status);
CREATE INDEX user_buddies_addressee_idx ON public.user_buddies (addressee_id, status);

CREATE TRIGGER trg_user_buddies_touch
BEFORE UPDATE ON public.user_buddies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.user_buddies ENABLE ROW LEVEL SECURITY;

-- ── HELPERS ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.are_buddies(_a uuid, _b uuid)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_buddies
    WHERE status = 'accepted'
      AND ((requester_id = _a AND addressee_id = _b)
        OR (requester_id = _b AND addressee_id = _a))
  );
$$;

-- ── RLS: user_notes ───────────────────────────────────────
-- Public read of active-only notes. Stale rows stay in the table until
-- the owner overwrites them, but they're never returned to clients.
CREATE POLICY "Active notes are publicly readable"
ON public.user_notes FOR SELECT
USING (expires_at > now());

CREATE POLICY "Owner can read their own note (even expired)"
ON public.user_notes FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Owner can insert own note"
ON public.user_notes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can update own note"
ON public.user_notes FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Owner can delete own note"
ON public.user_notes FOR DELETE
USING (auth.uid() = user_id);

-- ── RLS: user_buddies ─────────────────────────────────────
CREATE POLICY "Either party can view the relationship"
ON public.user_buddies FOR SELECT
USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Authenticated users can request a buddy"
ON public.user_buddies FOR INSERT
WITH CHECK (auth.uid() = requester_id AND status = 'pending');

CREATE POLICY "Addressee can accept or block"
ON public.user_buddies FOR UPDATE
USING (auth.uid() = addressee_id);

CREATE POLICY "Either party can unfriend"
ON public.user_buddies FOR DELETE
USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- ── RPC: list buddies + their active notes ────────────────
CREATE OR REPLACE FUNCTION public.list_my_buddies()
RETURNS TABLE(
  buddy_id uuid,
  display_name text,
  username text,
  avatar_url text,
  note_body text,
  note_expires_at timestamptz,
  buddied_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    p.user_id AS buddy_id,
    p.display_name,
    p.username,
    p.avatar_url,
    n.body AS note_body,
    n.expires_at AS note_expires_at,
    b.updated_at AS buddied_at
  FROM public.user_buddies b
  JOIN public.profiles p
    ON p.user_id = CASE WHEN b.requester_id = auth.uid()
                        THEN b.addressee_id ELSE b.requester_id END
  LEFT JOIN public.user_notes n
    ON n.user_id = p.user_id AND n.expires_at > now()
  WHERE b.status = 'accepted'
    AND (b.requester_id = auth.uid() OR b.addressee_id = auth.uid())
  ORDER BY (n.body IS NOT NULL) DESC, b.updated_at DESC;
$$;