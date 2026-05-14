
-- ============================================================
-- Prediction Markets v0 — simulated $RHOZE, parimutuel YES/NO
-- ============================================================

CREATE TABLE public.prediction_markets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL,                       -- artist the market is ABOUT
  created_by UUID NOT NULL,                       -- who posted the market
  subject_type TEXT NOT NULL CHECK (subject_type IN ('work','event','milestone')),
  subject_id UUID,
  question TEXT NOT NULL,
  description TEXT,
  target_metric TEXT,
  target_value NUMERIC,
  closes_at TIMESTAMPTZ NOT NULL,
  resolves_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','resolved','voided')),
  outcome BOOLEAN,
  yes_pool NUMERIC NOT NULL DEFAULT 0,
  no_pool NUMERIC NOT NULL DEFAULT 0,
  creator_optout BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prediction_markets_status_closes ON public.prediction_markets(status, closes_at);
CREATE INDEX idx_prediction_markets_creator ON public.prediction_markets(creator_id);
CREATE INDEX idx_prediction_markets_subject ON public.prediction_markets(subject_type, subject_id);

CREATE TABLE public.prediction_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  market_id UUID NOT NULL REFERENCES public.prediction_markets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  side BOOLEAN NOT NULL,                          -- true = YES, false = NO
  stake NUMERIC NOT NULL CHECK (stake > 0),
  payout NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prediction_positions_market ON public.prediction_positions(market_id);
CREATE INDEX idx_prediction_positions_user ON public.prediction_positions(user_id);

-- ── RLS ────────────────────────────────────────────────────
ALTER TABLE public.prediction_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prediction_positions ENABLE ROW LEVEL SECURITY;

-- Markets: public read, signed-in create, admin update
CREATE POLICY "Markets are viewable by everyone"
  ON public.prediction_markets FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create markets"
  ON public.prediction_markets FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can update markets"
  ON public.prediction_markets FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Positions: owner reads own; market creator (the artist) reads all on their market
CREATE POLICY "Users can view their own positions"
  ON public.prediction_positions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Market subject creator can view all positions"
  ON public.prediction_positions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.prediction_markets m
    WHERE m.id = prediction_positions.market_id AND m.creator_id = auth.uid()
  ));

CREATE POLICY "Users can create their own positions"
  ON public.prediction_positions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ── updated_at trigger ─────────────────────────────────────
CREATE TRIGGER update_prediction_markets_updated_at
  BEFORE UPDATE ON public.prediction_markets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Position validation: stake bounds + self-betting block + pool update
CREATE OR REPLACE FUNCTION public.handle_new_prediction_position()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m RECORD;
BEGIN
  SELECT * INTO m FROM public.prediction_markets WHERE id = NEW.market_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Market not found';
  END IF;
  IF m.status <> 'open' THEN
    RAISE EXCEPTION 'Market is not open for betting';
  END IF;
  IF m.closes_at <= now() THEN
    RAISE EXCEPTION 'Market has closed';
  END IF;
  IF m.creator_id = NEW.user_id THEN
    RAISE EXCEPTION 'Creators cannot bet on their own market';
  END IF;
  IF NEW.stake < 10 THEN
    RAISE EXCEPTION 'Minimum stake is 10 $RHOZE';
  END IF;
  IF NEW.stake > 5000 THEN
    RAISE EXCEPTION 'Maximum stake per position is 5000 $RHOZE';
  END IF;

  IF NEW.side THEN
    UPDATE public.prediction_markets SET yes_pool = yes_pool + NEW.stake WHERE id = NEW.market_id;
  ELSE
    UPDATE public.prediction_markets SET no_pool = no_pool + NEW.stake WHERE id = NEW.market_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER prediction_position_validate_and_update
  BEFORE INSERT ON public.prediction_positions
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_prediction_position();
