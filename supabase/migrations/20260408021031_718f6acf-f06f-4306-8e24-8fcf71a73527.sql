
-- Contribution proofs for on-chain reputation
CREATE TABLE public.contribution_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  reference_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  solana_signature TEXT,
  anchored_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contribution_proofs_user ON public.contribution_proofs (user_id);
CREATE INDEX idx_contribution_proofs_action ON public.contribution_proofs (action_type);
CREATE INDEX idx_contribution_proofs_anchored ON public.contribution_proofs (anchored_at) WHERE solana_signature IS NOT NULL;

ALTER TABLE public.contribution_proofs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view contribution proofs"
  ON public.contribution_proofs FOR SELECT USING (true);

CREATE POLICY "Users can insert own proofs"
  ON public.contribution_proofs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Revenue split configurations
CREATE TABLE public.revenue_split_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES public.project_contracts(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL,
  curator_id UUID,
  creator_pct NUMERIC NOT NULL DEFAULT 80,
  curator_pct NUMERIC NOT NULL DEFAULT 10,
  buyback_pct NUMERIC NOT NULL DEFAULT 10,
  buyback_wallet TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.revenue_split_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can view own split configs"
  ON public.revenue_split_configs FOR SELECT
  USING (auth.uid() = creator_id OR auth.uid() = curator_id);

CREATE POLICY "Creators can insert own split configs"
  ON public.revenue_split_configs FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update own split configs"
  ON public.revenue_split_configs FOR UPDATE
  USING (auth.uid() = creator_id);

-- Revenue split execution logs
CREATE TABLE public.revenue_split_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES public.revenue_split_configs(id),
  purchase_id UUID REFERENCES public.purchases(id),
  total_amount NUMERIC NOT NULL,
  creator_amount NUMERIC NOT NULL,
  curator_amount NUMERIC NOT NULL DEFAULT 0,
  buyback_amount NUMERIC NOT NULL DEFAULT 0,
  solana_signature TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.revenue_split_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Split participants can view logs"
  ON public.revenue_split_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.revenue_split_configs c
      WHERE c.id = config_id
      AND (c.creator_id = auth.uid() OR c.curator_id = auth.uid())
    )
  );

-- Trigger to auto-record contribution proofs from existing reward events
CREATE OR REPLACE FUNCTION public.record_contribution_proof()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.contribution_proofs (user_id, action_type, reference_id, metadata)
  VALUES (
    NEW.user_id,
    NEW.type,
    NEW.id,
    jsonb_build_object('description', NEW.description, 'amount', NEW.amount)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_record_contribution
  AFTER INSERT ON public.credit_transactions
  FOR EACH ROW
  WHEN (NEW.type = 'reward')
  EXECUTE FUNCTION public.record_contribution_proof();

-- Updated_at trigger for split configs
CREATE TRIGGER update_split_configs_updated_at
  BEFORE UPDATE ON public.revenue_split_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
