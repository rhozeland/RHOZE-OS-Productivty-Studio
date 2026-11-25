-- US77 / Task #147: enforce token-link authorization at the row boundary.
--
-- Project admins retain their existing RLS permissions for unrelated Project
-- updates. Token-field changes are restricted to the authenticated row owner.
-- External mint labels are retained for the current display flow, but remain
-- client-supplied and unverified until the separate metadata retrieval task.

-- Fail with an actionable message before installing constraints if historical
-- rows already contain two active token relationships. Do not silently choose
-- which relationship to keep.
DO $$
DECLARE
    v_project_conflicts BIGINT;
    v_work_conflicts BIGINT;
    v_project_metadata_without_link BIGINT;
    v_work_metadata_without_link BIGINT;
    v_project_metadata_on_creator_link BIGINT;
    v_work_metadata_on_creator_link BIGINT;
BEGIN
    SELECT count(*)
    INTO v_project_conflicts
    FROM public.projects
    WHERE linked_token_id IS NOT NULL
      AND linked_token_mint IS NOT NULL;

    SELECT count(*)
    INTO v_work_conflicts
    FROM public.works
    WHERE linked_token_id IS NOT NULL
      AND linked_token_mint IS NOT NULL;

    SELECT count(*)
    INTO v_project_metadata_without_link
    FROM public.projects
    WHERE linked_token_id IS NULL
      AND linked_token_mint IS NULL
      AND (linked_token_ticker IS NOT NULL
           OR linked_token_name IS NOT NULL
           OR linked_token_image_url IS NOT NULL);

    SELECT count(*)
    INTO v_work_metadata_without_link
    FROM public.works
    WHERE linked_token_id IS NULL
      AND linked_token_mint IS NULL
      AND (linked_token_ticker IS NOT NULL
           OR linked_token_name IS NOT NULL
           OR linked_token_image_url IS NOT NULL);

    SELECT count(*)
    INTO v_project_metadata_on_creator_link
    FROM public.projects
    WHERE linked_token_id IS NOT NULL
      AND (linked_token_ticker IS NOT NULL
           OR linked_token_name IS NOT NULL
           OR linked_token_image_url IS NOT NULL);

    SELECT count(*)
    INTO v_work_metadata_on_creator_link
    FROM public.works
    WHERE linked_token_id IS NOT NULL
      AND (linked_token_ticker IS NOT NULL
           OR linked_token_name IS NOT NULL
           OR linked_token_image_url IS NOT NULL);

    RAISE NOTICE 'Task #147 preflight: conflicting Project rows %, conflicting Work rows %; metadata without a relationship: Projects %, Works %; metadata on creator-token links: Projects %, Works %',
        v_project_conflicts, v_work_conflicts,
        v_project_metadata_without_link, v_work_metadata_without_link,
        v_project_metadata_on_creator_link, v_work_metadata_on_creator_link;

    IF v_project_conflicts > 0 OR v_work_conflicts > 0 THEN
        RAISE EXCEPTION
            'Task #147 cannot add exclusive token-link constraints: % Project row(s) and % Work row(s) have both linked_token_id and linked_token_mint. Resolve these rows explicitly, then reapply this migration.',
            v_project_conflicts,
            v_work_conflicts
            USING ERRCODE = '23514';
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.projects'::regclass
          AND conname = 'projects_token_relationship_exclusive_chk'
    ) THEN
        ALTER TABLE public.projects
            ADD CONSTRAINT projects_token_relationship_exclusive_chk
            CHECK (linked_token_id IS NULL OR linked_token_mint IS NULL);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.works'::regclass
          AND conname = 'works_token_relationship_exclusive_chk'
    ) THEN
        ALTER TABLE public.works
            ADD CONSTRAINT works_token_relationship_exclusive_chk
            CHECK (linked_token_id IS NULL OR linked_token_mint IS NULL);
    END IF;
END;
$$;

-- This trigger remains SECURITY INVOKER. Its only elevated operation is
-- delegated to Task #135's narrowly scoped token-lock helper. The FK cascade
-- path can see a deleted token as service_role/postgres (the only roles that
-- can currently delete creator_tokens); client authorization always comes
-- from auth.uid(), never a supplied user ID.
CREATE OR REPLACE FUNCTION public.enforce_project_work_token_linking()
RETURNS TRIGGER
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID;
    v_token_fields_changed BOOLEAN;
    v_has_display_metadata BOOLEAN;
BEGIN
    v_user_id := auth.uid();

    IF TG_OP = 'UPDATE'
       AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
        RAISE EXCEPTION 'Project and Work ownership cannot be changed by row update'
            USING ERRCODE = '42501';
    END IF;

    v_has_display_metadata := NEW.linked_token_ticker IS NOT NULL
        OR NEW.linked_token_name IS NOT NULL
        OR NEW.linked_token_image_url IS NOT NULL;

    IF TG_OP = 'INSERT' THEN
        v_token_fields_changed := NEW.linked_token_id IS NOT NULL
            OR NEW.linked_token_mint IS NOT NULL
            OR v_has_display_metadata;
    ELSE
        v_token_fields_changed := NEW.linked_token_id IS DISTINCT FROM OLD.linked_token_id
            OR NEW.linked_token_mint IS DISTINCT FROM OLD.linked_token_mint
            OR NEW.linked_token_ticker IS DISTINCT FROM OLD.linked_token_ticker
            OR NEW.linked_token_name IS DISTINCT FROM OLD.linked_token_name
            OR NEW.linked_token_image_url IS DISTINCT FROM OLD.linked_token_image_url;
    END IF;

    IF NOT v_token_fields_changed THEN
        RETURN NEW;
    END IF;

    -- Preserve creator-token ON DELETE SET NULL behavior. This exception is
    -- limited to a nested FK action after the referenced row is gone.
    IF TG_OP = 'UPDATE'
       AND pg_trigger_depth() > 1
       AND OLD.linked_token_id IS NOT NULL
       AND NEW.linked_token_id IS NULL
       AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id THEN
        PERFORM 1
        FROM public.creator_tokens AS ct
        WHERE ct.id = OLD.linked_token_id;

        IF NOT FOUND THEN
            NEW.linked_token_ticker := NULL;
            NEW.linked_token_name := NULL;
            NEW.linked_token_image_url := NULL;
            RETURN NEW;
        END IF;
    END IF;

    IF v_user_id IS NULL
       OR NEW.user_id IS DISTINCT FROM v_user_id
       OR (TG_OP = 'UPDATE' AND OLD.user_id IS DISTINCT FROM v_user_id) THEN
        RAISE EXCEPTION 'Only the authenticated Project or Work owner may change token fields'
            USING ERRCODE = '42501';
    END IF;

    IF NEW.linked_token_id IS NOT NULL
       AND NEW.linked_token_mint IS NOT NULL THEN
        RAISE EXCEPTION 'Choose either an approved creator token or an external mint, not both'
            USING ERRCODE = '23514';
    END IF;

    IF NEW.linked_token_mint IS NOT NULL
       AND btrim(NEW.linked_token_mint) = '' THEN
        RAISE EXCEPTION 'External mint cannot be empty'
            USING ERRCODE = '22023';
    END IF;

    IF NEW.linked_token_id IS NOT NULL THEN
        -- Approved-token links use the Task #135 lock helper. Metadata columns
        -- must be empty for this path; the UI resolves approved-token data from
        -- creator_tokens, while client-supplied labels are not authoritative.
        IF v_has_display_metadata THEN
            RAISE EXCEPTION 'Approved creator-token metadata is resolved from creator_tokens'
                USING ERRCODE = '23514';
        END IF;

        IF NOT public.lock_approved_creator_token(NEW.linked_token_id) THEN
            RAISE EXCEPTION 'Token is not owned by the authenticated owner or is not approved'
                USING ERRCODE = '42501';
        END IF;

    ELSIF NEW.linked_token_mint IS NULL THEN
        -- On unlink, discard stale display labels. Metadata-only writes with no
        -- active relationship are rejected rather than creating a phantom coin.
        IF TG_OP = 'UPDATE'
           AND (OLD.linked_token_id IS NOT NULL OR OLD.linked_token_mint IS NOT NULL) THEN
            NEW.linked_token_ticker := NULL;
            NEW.linked_token_name := NULL;
            NEW.linked_token_image_url := NULL;
        ELSIF v_has_display_metadata THEN
            RAISE EXCEPTION 'Token display metadata requires an active token relationship'
                USING ERRCODE = '23514';
        END IF;
    ELSE
        -- A mint-only update (used by the Work attach button) must not carry
        -- stale labels from the row's previous relationship to a new mint.
        -- Preserve caller-supplied display labels when they actually changed.
        IF TG_OP = 'UPDATE'
           AND NEW.linked_token_mint IS DISTINCT FROM OLD.linked_token_mint
           AND NEW.linked_token_ticker IS NOT DISTINCT FROM OLD.linked_token_ticker
           AND NEW.linked_token_name IS NOT DISTINCT FROM OLD.linked_token_name
           AND NEW.linked_token_image_url IS NOT DISTINCT FROM OLD.linked_token_image_url THEN
            NEW.linked_token_ticker := NULL;
            NEW.linked_token_name := NULL;
            NEW.linked_token_image_url := NULL;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_project_work_token_linking()
    FROM PUBLIC, anon, authenticated, service_role;

-- Broaden the existing Project trigger's coverage without removing its
-- approved-token validation. Its original trigger remains in place.
DROP TRIGGER IF EXISTS guard_project_token_linking_trg ON public.projects;
CREATE TRIGGER guard_project_token_linking_trg
    BEFORE INSERT OR UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.enforce_project_work_token_linking();

DROP TRIGGER IF EXISTS guard_work_token_linking_trg ON public.works;
CREATE TRIGGER guard_work_token_linking_trg
    BEFORE INSERT OR UPDATE ON public.works
    FOR EACH ROW EXECUTE FUNCTION public.enforce_project_work_token_linking();
