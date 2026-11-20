-- Task #149: require a server-verified, creator-signed challenge for external
-- pump.fun mint attachment. Challenge rows are service-role-only and bind the
-- authenticated user, target, mint, creator wallet, metadata, and prior link.

CREATE TABLE IF NOT EXISTS public.external_mint_attachment_challenges (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK (target_type IN ('project', 'work')),
    target_id UUID NOT NULL,
    mint_address TEXT NOT NULL,
    creator_wallet TEXT NOT NULL,
    message TEXT NOT NULL,
    token_name TEXT NOT NULL,
    token_ticker TEXT NOT NULL,
    token_image_url TEXT,
    previous_linked_token_id UUID,
    previous_linked_token_mint TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT external_mint_attachment_expiry_after_creation
        CHECK (expires_at > created_at),
    CONSTRAINT external_mint_attachment_metadata_not_empty
        CHECK (btrim(token_name) <> '' AND btrim(token_ticker) <> '')
);

CREATE INDEX IF NOT EXISTS external_mint_attachment_challenges_expiry_idx
    ON public.external_mint_attachment_challenges (expires_at);

CREATE INDEX IF NOT EXISTS external_mint_attachment_challenges_user_idx
    ON public.external_mint_attachment_challenges (user_id, created_at DESC);

ALTER TABLE public.external_mint_attachment_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.external_mint_attachment_challenges
    FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.external_mint_attachment_challenges TO service_role;

-- Guard every direct INSERT/UPDATE that would attach or change an external
-- mint or its display metadata. The only permitted writer is the narrowly
-- scoped SECURITY DEFINER RPC below. Task #147 still handles owner checks,
-- approved creator-token links, exclusivity, and unlink cleanup.
CREATE OR REPLACE FUNCTION public.guard_verified_external_mint_attachment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_external_attachment_changed BOOLEAN;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_external_attachment_changed := NEW.linked_token_mint IS NOT NULL;
    ELSE
        v_external_attachment_changed := NEW.linked_token_mint IS NOT NULL
            AND (
                NEW.linked_token_mint IS DISTINCT FROM OLD.linked_token_mint
                OR NEW.linked_token_id IS DISTINCT FROM OLD.linked_token_id
                OR NEW.linked_token_ticker IS DISTINCT FROM OLD.linked_token_ticker
                OR NEW.linked_token_name IS DISTINCT FROM OLD.linked_token_name
                OR NEW.linked_token_image_url IS DISTINCT FROM OLD.linked_token_image_url
            );
    END IF;

    IF v_external_attachment_changed
       AND NOT (
            current_user = 'postgres'
            AND COALESCE(current_setting('rhoze.external_mint_attachment', true), '') = 'verified'
       ) THEN
        RAISE EXCEPTION 'External mint attachment requires creator wallet verification'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_verified_external_mint_attachment()
    FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS guard_project_external_mint_attachment_trg ON public.projects;
CREATE TRIGGER guard_project_external_mint_attachment_trg
    BEFORE INSERT OR UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.guard_verified_external_mint_attachment();

DROP TRIGGER IF EXISTS guard_work_external_mint_attachment_trg ON public.works;
CREATE TRIGGER guard_work_external_mint_attachment_trg
    BEFORE INSERT OR UPDATE ON public.works
    FOR EACH ROW EXECUTE FUNCTION public.guard_verified_external_mint_attachment();

-- Atomically consume the one-use challenge and persist only the metadata that
-- the Edge Function retrieved from pump.fun. The service role is held only by
-- the server Edge Function; authenticated users cannot call this RPC directly.
CREATE OR REPLACE FUNCTION public.attach_verified_external_mint(
    p_challenge_id UUID
)
RETURNS TABLE (target_type TEXT, target_id UUID, mint_address TEXT)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_challenge public.external_mint_attachment_challenges%ROWTYPE;
    v_previous_linked_token_id UUID;
    v_previous_linked_token_mint TEXT;
    v_rows_updated INTEGER;
    v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'service role only'
            USING ERRCODE = '42501';
    END IF;

    SELECT *
      INTO v_challenge
      FROM public.external_mint_attachment_challenges AS c
     WHERE c.id = p_challenge_id
       AND c.consumed_at IS NULL
       AND c.expires_at > v_now
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'verification challenge is missing, expired, or already used'
            USING ERRCODE = '22023';
    END IF;

    IF v_challenge.target_type = 'project' THEN
        SELECT p.linked_token_id, p.linked_token_mint
          INTO v_previous_linked_token_id, v_previous_linked_token_mint
          FROM public.projects AS p
         WHERE p.id = v_challenge.target_id
           AND p.user_id = v_challenge.user_id
         FOR UPDATE;
    ELSE
        SELECT w.linked_token_id, w.linked_token_mint
          INTO v_previous_linked_token_id, v_previous_linked_token_mint
          FROM public.works AS w
         WHERE w.id = v_challenge.target_id
           AND w.user_id = v_challenge.user_id
         FOR UPDATE;
    END IF;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'target not found or not owned by challenge user'
            USING ERRCODE = '42501';
    END IF;

    IF v_previous_linked_token_id IS DISTINCT FROM v_challenge.previous_linked_token_id
       OR v_previous_linked_token_mint IS DISTINCT FROM v_challenge.previous_linked_token_mint THEN
        RAISE EXCEPTION 'target token relationship changed; request a new verification challenge'
            USING ERRCODE = '40001';
    END IF;

    UPDATE public.external_mint_attachment_challenges AS c
       SET consumed_at = v_now
     WHERE c.id = v_challenge.id
       AND c.consumed_at IS NULL
       AND c.expires_at > v_now;

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    IF v_rows_updated <> 1 THEN
        RAISE EXCEPTION 'verification challenge expired or was already used'
            USING ERRCODE = '22023';
    END IF;

    -- The Task #147 row trigger uses auth.uid() for its owner check. This
    -- SECURITY DEFINER path is service-role-only; bind that check to the
    -- challenge's server-recorded user for this transaction only.
    PERFORM set_config('request.jwt.claim.sub', v_challenge.user_id::TEXT, true);
    PERFORM set_config('rhoze.external_mint_attachment', 'verified', true);

    IF v_challenge.target_type = 'project' THEN
        UPDATE public.projects AS p
           SET linked_token_id = NULL,
               linked_token_mint = v_challenge.mint_address,
               linked_token_ticker = v_challenge.token_ticker,
               linked_token_name = v_challenge.token_name,
               linked_token_image_url = v_challenge.token_image_url
         WHERE p.id = v_challenge.target_id
           AND p.user_id = v_challenge.user_id
           AND p.linked_token_id IS NOT DISTINCT FROM v_challenge.previous_linked_token_id
           AND p.linked_token_mint IS NOT DISTINCT FROM v_challenge.previous_linked_token_mint;
    ELSE
        UPDATE public.works AS w
           SET linked_token_id = NULL,
               linked_token_mint = v_challenge.mint_address,
               linked_token_ticker = v_challenge.token_ticker,
               linked_token_name = v_challenge.token_name,
               linked_token_image_url = v_challenge.token_image_url
         WHERE w.id = v_challenge.target_id
           AND w.user_id = v_challenge.user_id
           AND w.linked_token_id IS NOT DISTINCT FROM v_challenge.previous_linked_token_id
           AND w.linked_token_mint IS NOT DISTINCT FROM v_challenge.previous_linked_token_mint;
    END IF;

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    IF v_rows_updated <> 1 THEN
        RAISE EXCEPTION 'target token relationship changed; request a new verification challenge'
            USING ERRCODE = '40001';
    END IF;

    RETURN QUERY SELECT
        v_challenge.target_type,
        v_challenge.target_id,
        v_challenge.mint_address;
END;
$$;

ALTER FUNCTION public.attach_verified_external_mint(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.attach_verified_external_mint(UUID)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attach_verified_external_mint(UUID)
    TO service_role;
