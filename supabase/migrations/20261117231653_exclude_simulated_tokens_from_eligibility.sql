-- US169 / Task #172: Consolidate profile and creator_tokens synchronization
--
-- Step 2D: Exclude simulated tokens from creator-token eligibility
-- Only approved, non-simulated creator tokens can be linked to Projects or Works.
--
-- Design doc: Docs/canonical-creator-token-data-model.md §7/§8

CREATE OR REPLACE FUNCTION public.is_creator_token_eligible(p_token_id UUID, p_target_type TEXT, p_target_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY INVOKER 
SET search_path = ''
AS $$
DECLARE 
v_user_id UUID;
v_target_owned BOOLEAN := FALSE;
BEGIN
-- Step 1: Identify the authenticated requester.
v_user_id := auth.uid();


-- Reject requests without an authenticated user.
IF v_user_id IS NULL THEN
    RETURN FALSE;
END IF;


-- Step 2: Validate token ownership and verification status.
-- Exclude simulated tokens (quarantined) and allow submission/backfill/external
IF NOT EXISTS (
    SELECT 1
    FROM public.creator_tokens ct
    WHERE ct.id = p_token_id
    AND ct.user_id = v_user_id
    AND ct.status = 'approved'
    AND ct.source IN ('submission','backfill','external')
) THEN
    RETURN FALSE;
END IF;

-- Step 3: Validate Project or Work Ownership;
IF p_target_type = 'project' THEN

    SELECT EXISTS (
        SELECT 1
        FROM public.projects p
        WHERE p.id = p_target_id
            AND p.user_id = v_user_id
    )
    INTO v_target_owned;

ELSIF p_target_type = 'work' THEN
    SELECT EXISTS (
        SELECT 1
        FROM public.works w
        WHERE w.id = p_target_id
            AND w.user_id = v_user_id
    )
    INTO v_target_owned;

    ELSE
        RETURN FALSE;
    END IF;

    --Return TRUE only if all validation checks passed.

    RETURN v_target_owned;

END;
$$;
