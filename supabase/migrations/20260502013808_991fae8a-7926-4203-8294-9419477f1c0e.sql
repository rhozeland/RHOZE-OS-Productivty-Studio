-- Immutable ledger of $RHOZE-denominated booking payments and related credit/revenue events
CREATE TABLE public.rhoze_booking_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  host_id UUID,
  booking_id UUID,
  service_id UUID,
  space_id UUID,
  entry_kind TEXT NOT NULL DEFAULT 'booking_payment',
  rhoze_amount NUMERIC NOT NULL,
  usd_value NUMERIC NOT NULL,
  rate_rhoze_per_usd NUMERIC NOT NULL DEFAULT 100,
  solana_signature TEXT,
  payer_wallet TEXT,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rhoze_ledger_user ON public.rhoze_booking_ledger (user_id, created_at DESC);
CREATE INDEX idx_rhoze_ledger_host ON public.rhoze_booking_ledger (host_id, created_at DESC);
CREATE INDEX idx_rhoze_ledger_booking ON public.rhoze_booking_ledger (booking_id);
CREATE INDEX idx_rhoze_ledger_signature ON public.rhoze_booking_ledger (solana_signature);
CREATE INDEX idx_rhoze_ledger_kind_created ON public.rhoze_booking_ledger (entry_kind, created_at DESC);

ALTER TABLE public.rhoze_booking_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own ledger entries"
ON public.rhoze_booking_ledger
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Hosts view entries tied to them"
ON public.rhoze_booking_ledger
FOR SELECT
TO authenticated
USING (auth.uid() = host_id);

CREATE POLICY "Admins view all ledger entries"
ON public.rhoze_booking_ledger
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users insert their own ledger entries"
ON public.rhoze_booking_ledger
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
