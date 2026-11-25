-- Recheck challenge expiry after acquiring both the challenge and target row
-- locks so waiting on either lock cannot extend the challenge's valid period.
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
        RAISE SQLSTATE 'PT409'
            USING MESSAGE = 'target token relationship changed; request a new verification challenge';
    END IF;

    v_now := clock_timestamp();

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
        RAISE SQLSTATE 'PT409'
            USING MESSAGE = 'target token relationship changed; request a new verification challenge';
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
