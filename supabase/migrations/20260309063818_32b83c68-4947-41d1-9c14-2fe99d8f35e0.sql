
-- ============================================
-- 1. PROJECT CONTRACTS
-- Links a project to client + specialist with quote/escrow tracking
-- ============================================
CREATE TABLE public.project_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  client_id uuid NOT NULL,
  specialist_id uuid NOT NULL,
  listing_id uuid REFERENCES public.marketplace_listings(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  total_credits numeric NOT NULL DEFAULT 0,
  escrowed_credits numeric NOT NULL DEFAULT 0,
  released_credits numeric NOT NULL DEFAULT 0,
  auto_release_days integer NOT NULL DEFAULT 7,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id)
);

ALTER TABLE public.project_contracts ENABLE ROW LEVEL SECURITY;

-- Both client and specialist can view their contracts
CREATE POLICY "Users can view own contracts"
  ON public.project_contracts FOR SELECT TO authenticated
  USING (auth.uid() = client_id OR auth.uid() = specialist_id);

-- Specialist creates the quote/contract
CREATE POLICY "Specialists can create contracts"
  ON public.project_contracts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = specialist_id);

-- Both parties can update (specialist edits quote, client accepts)
CREATE POLICY "Contract parties can update"
  ON public.project_contracts FOR UPDATE TO authenticated
  USING (auth.uid() = client_id OR auth.uid() = specialist_id);

-- Only specialist can delete draft contracts
CREATE POLICY "Specialists can delete draft contracts"
  ON public.project_contracts FOR DELETE TO authenticated
  USING (auth.uid() = specialist_id AND status = 'draft');

-- Admins can view all
CREATE POLICY "Admins can view all contracts"
  ON public.project_contracts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- 2. PROJECT MILESTONES
-- Individual deliverables with credit amounts and statuses
-- ============================================
CREATE TABLE public.project_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES public.project_contracts(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  credit_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  sort_order integer NOT NULL DEFAULT 0,
  due_date timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz,
  auto_release_at timestamptz,
  proposed_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;

-- Security definer to check contract membership without recursion
CREATE OR REPLACE FUNCTION public.is_contract_party(_user_id uuid, _contract_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_contracts
    WHERE id = _contract_id
      AND (client_id = _user_id OR specialist_id = _user_id)
  )
$$;

-- Contract parties can view milestones
CREATE POLICY "Contract parties can view milestones"
  ON public.project_milestones FOR SELECT TO authenticated
  USING (public.is_contract_party(auth.uid(), contract_id));

-- Contract parties can create milestones
CREATE POLICY "Contract parties can create milestones"
  ON public.project_milestones FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = proposed_by AND public.is_contract_party(auth.uid(), contract_id));

-- Contract parties can update milestones
CREATE POLICY "Contract parties can update milestones"
  ON public.project_milestones FOR UPDATE TO authenticated
  USING (public.is_contract_party(auth.uid(), contract_id));

-- Contract parties can delete pending milestones
CREATE POLICY "Contract parties can delete pending milestones"
  ON public.project_milestones FOR DELETE TO authenticated
  USING (auth.uid() = proposed_by AND status = 'pending');

-- Admins can view all
CREATE POLICY "Admins can view all milestones"
  ON public.project_milestones FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- 3. ESCROW TRANSACTIONS
-- Tracks credit locks, releases, refunds
-- ============================================
CREATE TABLE public.escrow_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES public.project_contracts(id) ON DELETE CASCADE NOT NULL,
  milestone_id uuid REFERENCES public.project_milestones(id) ON DELETE SET NULL,
  from_user_id uuid NOT NULL,
  to_user_id uuid,
  amount numeric NOT NULL,
  type text NOT NULL DEFAULT 'lock',
  status text NOT NULL DEFAULT 'completed',
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.escrow_transactions ENABLE ROW LEVEL SECURITY;

-- Contract parties can view escrow transactions
CREATE POLICY "Contract parties can view escrow txns"
  ON public.escrow_transactions FOR SELECT TO authenticated
  USING (public.is_contract_party(auth.uid(), contract_id));

-- Only system/edge functions should insert escrow transactions,
-- but we allow insert for the user locking their own credits
CREATE POLICY "Users can create own escrow locks"
  ON public.escrow_transactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = from_user_id);

-- Admins can view all
CREATE POLICY "Admins can view all escrow txns"
  ON public.escrow_transactions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Add updated_at triggers
CREATE TRIGGER update_project_contracts_updated_at
  BEFORE UPDATE ON public.project_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_milestones_updated_at
  BEFORE UPDATE ON public.project_milestones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
