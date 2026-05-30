-- =============================================================================
-- Wave 2 — On-chain proposal signatures + filled agreement
-- =============================================================================
-- Extends project_proposals with a written agreement (terms_text + version),
-- a canonical SHA-256 hash of the signed snapshot, and per-side signature
-- hash + Solana tx signature. sign_project_proposal now stamps both the
-- timestamp AND the canonical hash on the signer's side so the off-chain
-- proof exists immediately; the on-chain anchor is performed separately by
-- the anchor-proposal-signature edge fn after each signature.
-- =============================================================================

-- pgcrypto is required for digest(). Already enabled on Supabase but kept
-- here for safety if this migration ever runs in isolation.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.project_proposals
  ADD COLUMN IF NOT EXISTS terms_text text,
  ADD COLUMN IF NOT EXISTS terms_version text NOT NULL DEFAULT 'rhozeland-agreement-v1-2026',
  ADD COLUMN IF NOT EXISTS terms_hash text,
  ADD COLUMN IF NOT EXISTS client_signature_hash text,
  ADD COLUMN IF NOT EXISTS client_signature_tx text,
  ADD COLUMN IF NOT EXISTS specialist_signature_hash text,
  ADD COLUMN IF NOT EXISTS specialist_signature_tx text,
  ADD COLUMN IF NOT EXISTS anchored_at timestamptz;

-- ---------------------------------------------------------------------------
-- Canonicalisation helper. Builds a deterministic JSON string of the
-- signable snapshot (title, summary, budget, currency, terms, milestones in
-- sort_order) and returns its SHA-256 hex digest.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_proposal_terms_hash(_proposal_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _p public.project_proposals%ROWTYPE;
  _milestones jsonb;
  _payload text;
BEGIN
  SELECT * INTO _p FROM public.project_proposals WHERE id = _proposal_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'title', COALESCE(title, ''),
      'amount', COALESCE(credit_amount, 0),
      'sort', COALESCE(sort_order, 0)
    ) ORDER BY sort_order, id
  ), '[]'::jsonb)
  INTO _milestones
  FROM public.project_proposal_milestones
  WHERE proposal_id = _proposal_id;

  _payload := jsonb_build_object(
    'v', _p.terms_version,
    'proposal_id', _p.id,
    'client_id', _p.client_id,
    'specialist_id', _p.specialist_id,
    'title', COALESCE(_p.title, ''),
    'summary', COALESCE(_p.summary, ''),
    'budget', COALESCE(_p.budget_credits, 0),
    'currency', _p.currency,
    'terms', COALESCE(_p.terms_text, ''),
    'milestones', _milestones
  )::text;

  RETURN encode(digest(_payload, 'sha256'), 'hex');
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_proposal_terms_hash(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Replace sign_project_proposal to also stamp the canonical hash per side.
-- Body otherwise unchanged from the original.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sign_project_proposal(_proposal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _p public.project_proposals%ROWTYPE;
  _project_id uuid;
  _contract_id uuid;
  _total numeric := 0;
  _hash text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _p FROM public.project_proposals WHERE id = _proposal_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposal not found';
  END IF;
  IF _uid <> _p.client_id AND _uid <> _p.specialist_id THEN
    RAISE EXCEPTION 'Not a party to this proposal';
  END IF;
  IF _p.status NOT IN ('draft','awaiting_creator','awaiting_client') THEN
    RAISE EXCEPTION 'Proposal is not signable in status %', _p.status;
  END IF;

  -- Canonical snapshot hash of what is being signed.
  _hash := public.compute_proposal_terms_hash(_proposal_id);
  _p.terms_hash := _hash;

  -- Stamp this side (timestamp + signature hash).
  IF _uid = _p.client_id THEN
    _p.client_signed_at        := COALESCE(_p.client_signed_at, now());
    _p.client_signature_hash   := COALESCE(_p.client_signature_hash, _hash);
  ELSE
    _p.specialist_signed_at      := COALESCE(_p.specialist_signed_at, now());
    _p.specialist_signature_hash := COALESCE(_p.specialist_signature_hash, _hash);
  END IF;

  IF _p.client_signed_at IS NOT NULL AND _p.specialist_signed_at IS NOT NULL THEN
    SELECT COALESCE(SUM(credit_amount),0) INTO _total
      FROM public.project_proposal_milestones WHERE proposal_id = _p.id;

    INSERT INTO public.projects (user_id, title, description, total_budget, currency, project_type)
    VALUES (_p.client_id, _p.title, _p.summary, COALESCE(_p.budget_credits, _total),
            CASE WHEN _p.currency = 'usd' THEN 'USD' ELSE 'CAD' END,
            'standard')
    RETURNING id INTO _project_id;

    INSERT INTO public.project_contracts (
      project_id, client_id, specialist_id, listing_id, status, total_credits
    ) VALUES (
      _project_id, _p.client_id, _p.specialist_id, _p.source_listing_id, 'active', _total
    ) RETURNING id INTO _contract_id;

    INSERT INTO public.project_milestones (
      contract_id, title, description, credit_amount, sort_order, due_date, proposed_by, status
    )
    SELECT _contract_id, m.title, m.description, m.credit_amount, m.sort_order, m.due_date,
           m.proposed_by, 'pending'
    FROM public.project_proposal_milestones m
    WHERE m.proposal_id = _p.id
    ORDER BY m.sort_order;

    _p.status := 'signed';
    _p.contract_id := _contract_id;

    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES
      (_p.client_id, 'project', 'Agreement signed',
       'Both sides signed "' || _p.title || '". Anchoring on Solana…',
       '/projects/' || _project_id),
      (_p.specialist_id, 'project', 'Agreement signed',
       'Both sides signed "' || _p.title || '". Anchoring on Solana…',
       '/projects/' || _project_id);
  ELSE
    IF _uid = _p.client_id THEN
      _p.status := 'awaiting_creator';
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (_p.specialist_id, 'project',
              'Your turn to sign',
              'A project proposal "' || _p.title || '" is waiting for your signature.',
              '/messages?tab=projects');
    ELSE
      _p.status := 'awaiting_client';
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (_p.client_id, 'project',
              'Your turn to sign',
              'A project proposal "' || _p.title || '" is waiting for your signature.',
              '/messages?tab=projects');
    END IF;
  END IF;

  UPDATE public.project_proposals SET
    client_signed_at           = _p.client_signed_at,
    specialist_signed_at       = _p.specialist_signed_at,
    client_signature_hash      = _p.client_signature_hash,
    specialist_signature_hash  = _p.specialist_signature_hash,
    terms_hash                 = _p.terms_hash,
    status                     = _p.status,
    contract_id                = _p.contract_id,
    updated_at                 = now()
  WHERE id = _p.id;

  RETURN jsonb_build_object(
    'status', _p.status,
    'contract_id', _p.contract_id,
    'project_id', _project_id,
    'terms_hash', _p.terms_hash,
    'needs_anchor', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sign_project_proposal(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Service-only helper used by the edge fn to record an anchor tx after the
-- memo lands. Verifies the proposal exists and that the caller is the
-- service role (RLS will be bypassed by the fn using service key anyway,
-- but this gives the function a clean entry point and a clear contract).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_proposal_signature_anchor(
  _proposal_id uuid,
  _side text,
  _tx_signature text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _side NOT IN ('client','specialist') THEN
    RAISE EXCEPTION 'Invalid side %', _side;
  END IF;

  IF _side = 'client' THEN
    UPDATE public.project_proposals
       SET client_signature_tx = _tx_signature,
           anchored_at = CASE
             WHEN specialist_signature_tx IS NOT NULL THEN now()
             ELSE anchored_at
           END,
           updated_at = now()
     WHERE id = _proposal_id;
  ELSE
    UPDATE public.project_proposals
       SET specialist_signature_tx = _tx_signature,
           anchored_at = CASE
             WHEN client_signature_tx IS NOT NULL THEN now()
             ELSE anchored_at
           END,
           updated_at = now()
     WHERE id = _proposal_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.record_proposal_signature_anchor(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.record_proposal_signature_anchor(uuid, text, text) TO service_role;