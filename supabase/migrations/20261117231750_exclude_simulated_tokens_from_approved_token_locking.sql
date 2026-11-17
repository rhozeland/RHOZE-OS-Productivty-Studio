-- US169 / Task #172: Consolidate profile and creator_tokens synchronization
--
-- Step 2E: Exclude simulated tokens from approved-token locking
-- Only approved, non-simulated creator tokens can be locked for Project/Work linking.
--
-- Design doc: Docs/canonical-creator-token-data-model.md §7/§8

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
      AND ct.source IN ('submission','backfill','external') 
    FOR SHARE;

    RETURN FOUND;
END;
$$;
