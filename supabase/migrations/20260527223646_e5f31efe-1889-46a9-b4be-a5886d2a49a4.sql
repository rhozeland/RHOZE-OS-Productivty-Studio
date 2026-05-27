
-- =============================================================================
-- Project Proposals: two-sided draft + sign before becoming a contract
-- =============================================================================

CREATE TABLE public.project_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  specialist_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  summary text,
  budget_credits numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'credits' CHECK (currency IN ('credits','usd')),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','awaiting_creator','awaiting_client','signed','declined','expired')),
  client_signed_at timestamptz,
  specialist_signed_at timestamptz,
  source_listing_id uuid REFERENCES public.marketplace_listings(id) ON DELETE SET NULL,
  source_message_id uuid,
  contract_id uuid REFERENCES public.project_contracts(id) ON DELETE SET NULL,
  decline_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (client_id <> specialist_id)
);

CREATE INDEX idx_project_proposals_client ON public.project_proposals(client_id);
CREATE INDEX idx_project_proposals_specialist ON public.project_proposals(specialist_id);
CREATE INDEX idx_project_proposals_status ON public.project_proposals(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_proposals TO authenticated;
GRANT ALL ON public.project_proposals TO service_role;

ALTER TABLE public.project_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parties can view proposal"
  ON public.project_proposals FOR SELECT TO authenticated
  USING (auth.uid() = client_id OR auth.uid() = specialist_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can create a proposal as themselves"
  ON public.project_proposals FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND (auth.uid() = client_id OR auth.uid() = specialist_id)
  );

CREATE POLICY "Parties can update unsigned proposal"
  ON public.project_proposals FOR UPDATE TO authenticated
  USING (
    (auth.uid() = client_id OR auth.uid() = specialist_id)
    AND status IN ('draft','awaiting_creator','awaiting_client')
  );

CREATE POLICY "Creator can delete draft"
  ON public.project_proposals FOR DELETE TO authenticated
  USING (auth.uid() = created_by AND status = 'draft');

-- ---------------------------------------------------------------------------
-- Milestones drafted on the proposal (cloned into project_milestones on sign)
-- ---------------------------------------------------------------------------
CREATE TABLE public.project_proposal_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.project_proposals(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  credit_amount numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  due_date timestamptz,
  proposed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_milestones_proposal ON public.project_proposal_milestones(proposal_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_proposal_milestones TO authenticated;
GRANT ALL ON public.project_proposal_milestones TO service_role;

ALTER TABLE public.project_proposal_milestones ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_proposal_party(_user_id uuid, _proposal_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_proposals
    WHERE id = _proposal_id
      AND (_user_id = client_id OR _user_id = specialist_id)
  );
$$;

CREATE POLICY "Parties view proposal milestones"
  ON public.project_proposal_milestones FOR SELECT TO authenticated
  USING (public.is_proposal_party(auth.uid(), proposal_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Parties insert proposal milestones"
  ON public.project_proposal_milestones FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = proposed_by
    AND public.is_proposal_party(auth.uid(), proposal_id)
    AND EXISTS (
      SELECT 1 FROM public.project_proposals p
      WHERE p.id = proposal_id
        AND p.status IN ('draft','awaiting_creator','awaiting_client')
    )
  );

CREATE POLICY "Parties update proposal milestones"
  ON public.project_proposal_milestones FOR UPDATE TO authenticated
  USING (
    public.is_proposal_party(auth.uid(), proposal_id)
    AND EXISTS (
      SELECT 1 FROM public.project_proposals p
      WHERE p.id = proposal_id
        AND p.status IN ('draft','awaiting_creator','awaiting_client')
    )
  );

CREATE POLICY "Parties delete proposal milestones"
  ON public.project_proposal_milestones FOR DELETE TO authenticated
  USING (
    public.is_proposal_party(auth.uid(), proposal_id)
    AND EXISTS (
      SELECT 1 FROM public.project_proposals p
      WHERE p.id = proposal_id
        AND p.status IN ('draft','awaiting_creator','awaiting_client')
    )
  );

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
CREATE TRIGGER project_proposals_set_updated_at
BEFORE UPDATE ON public.project_proposals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Editing a proposal that is "awaiting_*" flips status back so the other
-- side knows it's their turn again.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.proposal_reset_turn_on_edit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Only fire on substantive edits (not on the sign RPC's own updates)
  IF NEW.status = OLD.status AND OLD.status IN ('awaiting_creator','awaiting_client') THEN
    IF NEW.title IS DISTINCT FROM OLD.title
       OR NEW.summary IS DISTINCT FROM OLD.summary
       OR NEW.budget_credits IS DISTINCT FROM OLD.budget_credits
       OR NEW.currency IS DISTINCT FROM OLD.currency
    THEN
      -- The editor's signature (if any) is revoked; flip turn to the other side
      IF auth.uid() = NEW.client_id THEN
        NEW.client_signed_at := NULL;
        NEW.status := 'awaiting_creator';
      ELSIF auth.uid() = NEW.specialist_id THEN
        NEW.specialist_signed_at := NULL;
        NEW.status := 'awaiting_client';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER project_proposals_reset_turn
BEFORE UPDATE ON public.project_proposals
FOR EACH ROW EXECUTE FUNCTION public.proposal_reset_turn_on_edit();

-- ---------------------------------------------------------------------------
-- Sign RPC: marks caller's side; when both sides signed, creates project +
-- contract + milestones and writes contract_id back to the proposal.
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

  -- Stamp this side
  IF _uid = _p.client_id THEN
    _p.client_signed_at := COALESCE(_p.client_signed_at, now());
  ELSE
    _p.specialist_signed_at := COALESCE(_p.specialist_signed_at, now());
  END IF;

  -- Both signed → convert
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

    -- Notify both sides
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES
      (_p.client_id, 'project', 'Project locked',
       'Both sides signed "' || _p.title || '". Work starts now.',
       '/projects/' || _project_id),
      (_p.specialist_id, 'project', 'Project locked',
       'Both sides signed "' || _p.title || '". Work starts now.',
       '/projects/' || _project_id);
  ELSE
    -- One side signed → flip status to the other side
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
    client_signed_at = _p.client_signed_at,
    specialist_signed_at = _p.specialist_signed_at,
    status = _p.status,
    contract_id = _p.contract_id,
    updated_at = now()
  WHERE id = _p.id;

  RETURN jsonb_build_object(
    'status', _p.status,
    'contract_id', _p.contract_id,
    'project_id', _project_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sign_project_proposal(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Decline RPC: either party can decline an unsigned proposal
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.decline_project_proposal(_proposal_id uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _p public.project_proposals%ROWTYPE;
BEGIN
  SELECT * INTO _p FROM public.project_proposals WHERE id = _proposal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposal not found'; END IF;
  IF _uid <> _p.client_id AND _uid <> _p.specialist_id THEN
    RAISE EXCEPTION 'Not a party';
  END IF;
  IF _p.status NOT IN ('draft','awaiting_creator','awaiting_client') THEN
    RAISE EXCEPTION 'Cannot decline a % proposal', _p.status;
  END IF;

  UPDATE public.project_proposals
    SET status = 'declined', decline_reason = _reason, updated_at = now()
    WHERE id = _proposal_id;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    CASE WHEN _uid = _p.client_id THEN _p.specialist_id ELSE _p.client_id END,
    'project',
    'Proposal declined',
    'The proposal "' || _p.title || '" was declined.' || COALESCE(' Reason: ' || _reason, ''),
    '/messages?tab=projects'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.decline_project_proposal(uuid, text) TO authenticated;
