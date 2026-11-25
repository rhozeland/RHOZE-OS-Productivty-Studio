-- Secure Approved Creator Token Linking
-- Allow authenticated creators to securely link an approved creator token to a Project or Work

-- public.is_creator_token_eligible()
-- public.creator_tokens.status = 'approved'

-- Rules:
-- 1. Only authenticated target owner may link/unlink
-- 2. Link creator tokens must be approved
-- 3. Token must belong to the target owner
-- 4. A target has at most one active linked coin
-- 5. Approved-token linking clears external mint metadata

-- 1. Add approved-token relationship to Works
ALTER TABLE public.works
ADD COLUMN IF NOT EXISTS linked_token_id UUID
REFERENCES public.creator_tokens(id)
ON DELETE SET NULL;

-- 2. Lock an approved token while the linking transaction validates and links it.
--
-- The caller cannot acquire this row lock through the SECURITY INVOKER RPC under
-- the normal creator_tokens grants. This narrowly scoped SECURITY DEFINER helper
-- performs the lock only after checking auth.uid() against the token owner, and
-- returns no token data. The lock prevents approval/rejection updates from
-- committing between this check and the link operation.
CREATE OR REPLACE FUNCTION public.lock_approved_creator_token(p_token_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL OR p_token_id IS NULL THEN
        RETURN FALSE;
    END IF;

    PERFORM 1
    FROM public.creator_tokens AS ct
    WHERE ct.id = p_token_id
      AND ct.user_id = v_user_id
      AND ct.status = 'approved'
    FOR SHARE;

    RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.lock_approved_creator_token(UUID)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.lock_approved_creator_token(UUID)
TO authenticated;

-- Supabase migrations run as postgres. Keep the definer identity explicit so
-- the helper can take the row lock despite creator_tokens RLS and caller grants.
ALTER FUNCTION public.lock_approved_creator_token(UUID) OWNER TO postgres;

-- 3. Create approved token-linking RPC

CREATE OR REPLACE FUNCTION public.link_approved_creator_token(p_token_id UUID, p_target_type TEXT, p_target_id UUID)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID;
    v_rows_updated INTEGER;
BEGIN

    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required'
            USING ERRCODE = '42501';
    END IF;
    
    IF p_target_type IS NULL
        OR p_target_type NOT IN ('project', 'work') THEN

        RAISE EXCEPTION 'Invalid target type'
            USING ERRCODE = '22023';
    END IF;

    IF p_target_id IS NULL THEN

        RAISE EXCEPTION 'Target ID is required'
            USING ERRCODE = '22023';

    END IF;

    IF p_token_id IS NULL THEN

        IF p_target_type = 'project' THEN

            UPDATE public.projects
            SET
                linked_token_id = NULL,
                linked_token_mint = NULL,
                linked_token_ticker = NULL,
                linked_token_name = NULL,
                linked_token_image_url = NULL
            WHERE id = p_target_id
                AND user_id = v_user_id;

        ELSE

            UPDATE public.works
            SET
                linked_token_id = NULL,
                linked_token_mint = NULL,
                linked_token_ticker = NULL,
                linked_token_name = NULL,
                linked_token_image_url = NULL
            WHERE id = p_target_id
                AND user_id = v_user_id;

        END IF;

        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

        IF v_rows_updated = 0 THEN

            RAISE EXCEPTION 'Target not found or not owned'
                USING ERRCODE = '42501';

        END IF;

        RETURN;

    END IF;

    IF NOT public.lock_approved_creator_token(p_token_id) THEN
        RAISE EXCEPTION 'Token is not eligible for this target'
            USING ERRCODE = '42501';
    END IF;

    IF NOT public.is_creator_token_eligible(p_token_id, p_target_type, p_target_id) THEN
        RAISE EXCEPTION 'Token is not eligible for this target'
            USING ERRCODE = '42501';
    END IF;

    IF p_target_type = 'project' THEN

        UPDATE public.projects
        SET
            linked_token_id = p_token_id,
            linked_token_mint = NULL,
            linked_token_ticker = NULL,
            linked_token_name = NULL,
            linked_token_image_url = NULL
        WHERE id = p_target_id
            AND user_id = v_user_id;

    ELSE

        UPDATE public.works
        SET
            linked_token_id = p_token_id,
            linked_token_mint = NULL,
            linked_token_ticker = NULL,
            linked_token_name = NULL,
            linked_token_image_url = NULL
        WHERE id = p_target_id
            AND user_id = v_user_id;

    END IF;


    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

    IF v_rows_updated = 0 THEN

        RAISE EXCEPTION 'Target not found or not owned'
            USING ERRCODE = '42501';

    END IF;

END;
$$;

REVOKE ALL ON FUNCTION
    public.link_approved_creator_token(UUID, TEXT, UUID)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
    public.link_approved_creator_token(UUID, TEXT, UUID)
TO authenticated;
