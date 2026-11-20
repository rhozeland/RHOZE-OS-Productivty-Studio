-- Preserve identical display metadata only for the trusted external-attachment
-- RPC. The GUC alone is not trusted: current_user must also be the postgres
-- function owner, as enforced by guard_verified_external_mint_attachment().
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
        -- A mint-only update used by the Work attach button must not carry stale
        -- labels to a different mint. The verified RPC may preserve them only
        -- within its existing SECURITY DEFINER trust boundary.
        IF TG_OP = 'UPDATE'
           AND NEW.linked_token_mint IS DISTINCT FROM OLD.linked_token_mint
           AND NEW.linked_token_ticker IS NOT DISTINCT FROM OLD.linked_token_ticker
           AND NEW.linked_token_name IS NOT DISTINCT FROM OLD.linked_token_name
           AND NEW.linked_token_image_url IS NOT DISTINCT FROM OLD.linked_token_image_url
           AND NOT (
               current_user = 'postgres'
               AND COALESCE(current_setting('rhoze.external_mint_attachment', true), '') = 'verified'
           ) THEN
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
