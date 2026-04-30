
-- Platform-configurable underwriting rules for the Capital scoring engine.
-- Single-row table (id = 1) holds the active rule set; admins update it from
-- the Admin panel; the seller-facing CapitalAdvancePanel reads the active
-- row via a public RPC so changes apply without a redeploy.

CREATE TABLE IF NOT EXISTS public.capital_underwriting_rules (
  id INTEGER PRIMARY KEY DEFAULT 1,
  -- Advance formula
  base_advance_ratio NUMERIC NOT NULL DEFAULT 0.60,        -- % of 90d gross
  provenance_bonus_max NUMERIC NOT NULL DEFAULT 0.25,      -- max +mult from on-chain ratio
  tenure_floor_mult NUMERIC NOT NULL DEFAULT 0.50,         -- multiplier at 0 months
  tenure_full_months INTEGER NOT NULL DEFAULT 6,           -- months to reach 1.0
  diversification_floor_per_work NUMERIC NOT NULL DEFAULT 25,
  advance_cap NUMERIC NOT NULL DEFAULT 25000,
  -- Eligibility thresholds
  min_settled_events INTEGER NOT NULL DEFAULT 1,
  min_anchored_works INTEGER NOT NULL DEFAULT 1,
  min_advance_amount NUMERIC NOT NULL DEFAULT 50,
  -- Score weights (must sum to 100 by convention; not enforced)
  score_weight_revenue INTEGER NOT NULL DEFAULT 40,
  score_weight_provenance INTEGER NOT NULL DEFAULT 25,
  score_weight_tenure INTEGER NOT NULL DEFAULT 20,
  score_weight_anchored INTEGER NOT NULL DEFAULT 15,
  -- Score normalization targets
  revenue_score_target NUMERIC NOT NULL DEFAULT 5000,      -- gross90d that earns full revenue points
  anchored_score_per_work NUMERIC NOT NULL DEFAULT 5,      -- points per anchored work
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

-- Seed the singleton row.
INSERT INTO public.capital_underwriting_rules (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.capital_underwriting_rules ENABLE ROW LEVEL SECURITY;

-- Admins manage. Authenticated sellers read via the SECURITY DEFINER RPC
-- below — no direct SELECT policy needed because they don't need to see
-- updated_by, and a function gives us cache-friendly access.
CREATE POLICY "Admins manage underwriting rules"
ON public.capital_underwriting_rules
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read underwriting rules"
ON public.capital_underwriting_rules
FOR SELECT
TO authenticated
USING (true);

-- Auto-stamp updated_at + updated_by on writes.
CREATE OR REPLACE FUNCTION public.touch_capital_underwriting_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_capital_underwriting_rules ON public.capital_underwriting_rules;
CREATE TRIGGER trg_touch_capital_underwriting_rules
BEFORE UPDATE ON public.capital_underwriting_rules
FOR EACH ROW EXECUTE FUNCTION public.touch_capital_underwriting_rules();
