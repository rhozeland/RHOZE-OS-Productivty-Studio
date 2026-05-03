-- 1. Events: poster cover + currency
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS cover_url_poster text,
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS currency_code text NOT NULL DEFAULT 'USD';

-- 2. Tier currency
ALTER TABLE public.event_ticket_tiers
  ADD COLUMN IF NOT EXISTS currency_code text NOT NULL DEFAULT 'USD';

-- 3. Event media (gallery carousel)
CREATE TABLE IF NOT EXISTS public.event_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('image','video')),
  url text NOT NULL,
  thumbnail_url text,
  caption text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_media_event_idx
  ON public.event_media(event_id, sort_order);

ALTER TABLE public.event_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view media for published events"
  ON public.event_media FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_media.event_id
      AND (e.status IN ('published','completed') OR e.host_id = auth.uid())
  ));

CREATE POLICY "Managers manage event media"
  ON public.event_media FOR ALL
  USING (public.can_manage_event(event_id, auth.uid()))
  WITH CHECK (public.can_manage_event(event_id, auth.uid()));

-- 4. Host fiat payout requests
CREATE TABLE IF NOT EXISTS public.host_payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL,
  amount numeric(20,2) NOT NULL CHECK (amount > 0),
  currency_code text NOT NULL DEFAULT 'USD',
  payout_method text NOT NULL,
  payout_details jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','processing','paid','rejected','cancelled')),
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS host_payout_host_idx
  ON public.host_payout_requests(host_id, created_at DESC);

ALTER TABLE public.host_payout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts view own payout requests"
  ON public.host_payout_requests FOR SELECT TO authenticated
  USING (auth.uid() = host_id OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Hosts create own payout requests"
  ON public.host_payout_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts cancel own pending requests"
  ON public.host_payout_requests FOR UPDATE TO authenticated
  USING (auth.uid() = host_id AND status = 'pending')
  WITH CHECK (auth.uid() = host_id AND status IN ('pending','cancelled'));

CREATE POLICY "Admins manage all payout requests"
  ON public.host_payout_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER host_payout_requests_touch
  BEFORE UPDATE ON public.host_payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Helper RPC: host fiat earnings summary
CREATE OR REPLACE FUNCTION public.get_host_fiat_earnings(_host_id uuid)
RETURNS TABLE(
  currency_code text,
  gross numeric,
  host_net numeric,
  platform_fee numeric,
  ticket_count bigint,
  pending_payouts numeric,
  paid_payouts numeric,
  available numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH s AS (
    SELECT upper(currency) AS currency_code,
           COALESCE(SUM(gross_amount),0) AS gross,
           COALESCE(SUM(host_amount),0) AS host_net,
           COALESCE(SUM(platform_amount),0) AS platform_fee,
           COUNT(*) AS ticket_count
    FROM public.event_ticket_settlements
    WHERE host_id = _host_id AND currency = 'usd'
    GROUP BY upper(currency)
  ),
  p AS (
    SELECT currency_code,
           COALESCE(SUM(amount) FILTER (WHERE status IN ('pending','approved','processing')),0) AS pending_payouts,
           COALESCE(SUM(amount) FILTER (WHERE status = 'paid'),0) AS paid_payouts
    FROM public.host_payout_requests
    WHERE host_id = _host_id
    GROUP BY currency_code
  )
  SELECT COALESCE(s.currency_code, p.currency_code) AS currency_code,
         COALESCE(s.gross,0),
         COALESCE(s.host_net,0),
         COALESCE(s.platform_fee,0),
         COALESCE(s.ticket_count,0),
         COALESCE(p.pending_payouts,0),
         COALESCE(p.paid_payouts,0),
         GREATEST(COALESCE(s.host_net,0) - COALESCE(p.pending_payouts,0) - COALESCE(p.paid_payouts,0), 0) AS available
  FROM s FULL OUTER JOIN p ON s.currency_code = p.currency_code;
$$;

-- 6. RPC: request a fiat payout (validates available balance)
CREATE OR REPLACE FUNCTION public.request_host_payout(
  _amount numeric,
  _currency_code text,
  _payout_method text,
  _payout_details jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_available numeric;
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  SELECT available INTO v_available
  FROM public.get_host_fiat_earnings(v_user)
  WHERE currency_code = upper(_currency_code);

  IF v_available IS NULL OR v_available < _amount THEN
    RAISE EXCEPTION 'Insufficient available balance: % %', COALESCE(v_available,0), upper(_currency_code);
  END IF;

  INSERT INTO public.host_payout_requests (host_id, amount, currency_code, payout_method, payout_details)
  VALUES (v_user, _amount, upper(_currency_code), _payout_method, _payout_details)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;