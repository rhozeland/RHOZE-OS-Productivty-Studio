
-- Settlements ledger for paid event tickets (75/15/10 split)
CREATE TABLE IF NOT EXISTS public.event_ticket_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.event_tickets(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  host_id UUID NOT NULL,
  buyer_id UUID NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('usd','rhoze')),
  gross_amount NUMERIC(20,4) NOT NULL,
  host_amount NUMERIC(20,4) NOT NULL,
  reserve_amount NUMERIC(20,4) NOT NULL,
  platform_amount NUMERIC(20,4) NOT NULL,
  payment_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_ticket_settlements_host_idx ON public.event_ticket_settlements(host_id);
CREATE INDEX IF NOT EXISTS event_ticket_settlements_event_idx ON public.event_ticket_settlements(event_id);

ALTER TABLE public.event_ticket_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts view own settlements"
  ON public.event_ticket_settlements FOR SELECT
  TO authenticated
  USING (auth.uid() = host_id OR auth.uid() = buyer_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Buyers insert own settlements"
  ON public.event_ticket_settlements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = buyer_id);
