
CREATE TABLE public.creator_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipper_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents >= 100 AND amount_cents <= 50000),
  currency text NOT NULL DEFAULT 'usd',
  message text,
  stripe_session_id text UNIQUE,
  stripe_payment_intent text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','failed','refunded')),
  paid_at timestamptz,
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','live')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_creator_tips_creator ON public.creator_tips(creator_id);
CREATE INDEX idx_creator_tips_tipper ON public.creator_tips(tipper_id);
CREATE INDEX idx_creator_tips_status ON public.creator_tips(status);

ALTER TABLE public.creator_tips ENABLE ROW LEVEL SECURITY;

-- Tippers see their own tips
CREATE POLICY "Tippers see their own tips"
  ON public.creator_tips FOR SELECT
  USING (auth.uid() = tipper_id);

-- Creators see tips received on their profile
CREATE POLICY "Creators see tips received"
  ON public.creator_tips FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = creator_tips.creator_id AND p.user_id = auth.uid()
    )
  );

-- Writes happen only from edge functions via service role; no client INSERT policy.

CREATE TRIGGER trg_creator_tips_updated_at
  BEFORE UPDATE ON public.creator_tips
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
