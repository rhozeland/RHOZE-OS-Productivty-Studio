-- =========================================================
-- Spaces 2.0: Events, Tickets, Artifacts, Check-ins
-- =========================================================

-- ---------- enums ----------
DO $$ BEGIN
  CREATE TYPE public.event_status AS ENUM ('draft','published','cancelled','completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.event_ticket_status AS ENUM ('issued','checked_in','refunded','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.event_purchase_currency AS ENUM ('usd','rhoze','free');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- events ----------
CREATE TABLE IF NOT EXISTS public.events (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id                uuid NOT NULL,
  space_id               uuid REFERENCES public.studios(id) ON DELETE SET NULL,
  title                  text NOT NULL,
  slug                   text UNIQUE,
  description            text,
  cover_url              text,
  category               text NOT NULL DEFAULT 'gathering',
  starts_at              timestamptz NOT NULL,
  ends_at                timestamptz NOT NULL,
  venue_name             text,
  venue_address          text,
  is_online              boolean NOT NULL DEFAULT false,
  online_url             text,
  capacity               integer,
  status                 public.event_status NOT NULL DEFAULT 'draft',
  ticket_currency_modes  text[] NOT NULL DEFAULT ARRAY['free']::text[],
  manifest_json          jsonb,
  manifest_hash          text,
  solana_signature       text,
  anchored_at            timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT events_time_order CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS events_host_idx        ON public.events (host_id);
CREATE INDEX IF NOT EXISTS events_status_idx      ON public.events (status);
CREATE INDEX IF NOT EXISTS events_starts_at_idx   ON public.events (starts_at);
CREATE INDEX IF NOT EXISTS events_signature_idx   ON public.events (solana_signature);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published events"
  ON public.events FOR SELECT TO authenticated
  USING (status IN ('published','completed') OR auth.uid() = host_id);

CREATE POLICY "Public can view published events"
  ON public.events FOR SELECT TO anon
  USING (status IN ('published','completed'));

CREATE POLICY "Hosts can insert own events"
  ON public.events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts can update own events"
  ON public.events FOR UPDATE TO authenticated
  USING (auth.uid() = host_id);

CREATE POLICY "Hosts can delete own draft events"
  ON public.events FOR DELETE TO authenticated
  USING (auth.uid() = host_id AND status = 'draft');

CREATE POLICY "Admins can manage all events"
  ON public.events FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER events_touch_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- helper: is the user the host of an event ----------
CREATE OR REPLACE FUNCTION public.is_event_host(_user_id uuid, _event_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events WHERE id = _event_id AND host_id = _user_id
  )
$$;

-- ---------- event_ticket_tiers ----------
CREATE TABLE IF NOT EXISTS public.event_ticket_tiers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  price_usd       numeric(10,2),
  price_rhoze     numeric(20,4),
  quantity_total  integer,
  quantity_sold   integer NOT NULL DEFAULT 0,
  sale_starts_at  timestamptz,
  sale_ends_at    timestamptz,
  is_active       boolean NOT NULL DEFAULT true,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_ticket_tiers_event_idx ON public.event_ticket_tiers (event_id);

ALTER TABLE public.event_ticket_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tiers for visible events"
  ON public.event_ticket_tiers FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_ticket_tiers.event_id
        AND (e.status IN ('published','completed') OR e.host_id = auth.uid())
    )
  );

CREATE POLICY "Public can view tiers for published events"
  ON public.event_ticket_tiers FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_ticket_tiers.event_id
        AND e.status IN ('published','completed')
    )
  );

CREATE POLICY "Hosts manage tiers"
  ON public.event_ticket_tiers FOR ALL TO authenticated
  USING (public.is_event_host(auth.uid(), event_id))
  WITH CHECK (public.is_event_host(auth.uid(), event_id));

CREATE TRIGGER event_ticket_tiers_touch_updated_at
  BEFORE UPDATE ON public.event_ticket_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- event_tickets ----------
CREATE TABLE IF NOT EXISTS public.event_tickets (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id           uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  tier_id            uuid REFERENCES public.event_ticket_tiers(id) ON DELETE SET NULL,
  holder_id          uuid NOT NULL,
  purchase_currency  public.event_purchase_currency NOT NULL DEFAULT 'free',
  amount_paid        numeric(20,4) NOT NULL DEFAULT 0,
  payment_reference  text,
  status             public.event_ticket_status NOT NULL DEFAULT 'issued',
  qr_token           text NOT NULL UNIQUE,
  attendance_hash    text,
  solana_signature   text,
  anchored_at        timestamptz,
  issued_at          timestamptz NOT NULL DEFAULT now(),
  checked_in_at      timestamptz,
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS event_tickets_event_idx     ON public.event_tickets (event_id);
CREATE INDEX IF NOT EXISTS event_tickets_holder_idx    ON public.event_tickets (holder_id);
CREATE INDEX IF NOT EXISTS event_tickets_signature_idx ON public.event_tickets (solana_signature);

ALTER TABLE public.event_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Holders view own tickets"
  ON public.event_tickets FOR SELECT TO authenticated
  USING (auth.uid() = holder_id);

CREATE POLICY "Hosts view tickets for own events"
  ON public.event_tickets FOR SELECT TO authenticated
  USING (public.is_event_host(auth.uid(), event_id));

CREATE POLICY "Holders insert own tickets"
  ON public.event_tickets FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = holder_id
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_tickets.event_id AND e.status = 'published'
    )
  );

CREATE POLICY "Holders can update own ticket"
  ON public.event_tickets FOR UPDATE TO authenticated
  USING (auth.uid() = holder_id);

CREATE POLICY "Hosts can update tickets on own events"
  ON public.event_tickets FOR UPDATE TO authenticated
  USING (public.is_event_host(auth.uid(), event_id));

-- ---------- helper: does the user hold any non-cancelled ticket ----------
CREATE OR REPLACE FUNCTION public.has_event_ticket(_user_id uuid, _event_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_tickets
    WHERE event_id = _event_id
      AND holder_id = _user_id
      AND status IN ('issued','checked_in')
  )
$$;

-- ---------- event_artifacts ----------
CREATE TABLE IF NOT EXISTS public.event_artifacts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  uploader_id      uuid NOT NULL,
  file_url         text NOT NULL,
  file_name        text NOT NULL,
  file_size        bigint,
  file_type        text,
  caption          text,
  sha256_hash      text,
  solana_signature text,
  anchored_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_artifacts_event_idx     ON public.event_artifacts (event_id);
CREATE INDEX IF NOT EXISTS event_artifacts_signature_idx ON public.event_artifacts (solana_signature);

ALTER TABLE public.event_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts and ticketholders view artifacts"
  ON public.event_artifacts FOR SELECT TO authenticated
  USING (
    public.is_event_host(auth.uid(), event_id)
    OR public.has_event_ticket(auth.uid(), event_id)
  );

CREATE POLICY "Public can view artifacts of completed events"
  ON public.event_artifacts FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_artifacts.event_id AND e.status = 'completed'
    )
  );

CREATE POLICY "Hosts and checked-in attendees can upload"
  ON public.event_artifacts FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = uploader_id
    AND (
      public.is_event_host(auth.uid(), event_id)
      OR EXISTS (
        SELECT 1 FROM public.event_tickets t
        WHERE t.event_id = event_artifacts.event_id
          AND t.holder_id = auth.uid()
          AND t.status = 'checked_in'
      )
    )
  );

CREATE POLICY "Uploader or host can update artifact"
  ON public.event_artifacts FOR UPDATE TO authenticated
  USING (auth.uid() = uploader_id OR public.is_event_host(auth.uid(), event_id));

CREATE POLICY "Uploader or host can delete artifact"
  ON public.event_artifacts FOR DELETE TO authenticated
  USING (auth.uid() = uploader_id OR public.is_event_host(auth.uid(), event_id));

-- ---------- event_check_ins ----------
CREATE TABLE IF NOT EXISTS public.event_check_ins (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   uuid NOT NULL REFERENCES public.event_tickets(id) ON DELETE CASCADE,
  scanned_by  uuid NOT NULL,
  scanned_at  timestamptz NOT NULL DEFAULT now(),
  method      text NOT NULL DEFAULT 'qr'
);

CREATE INDEX IF NOT EXISTS event_check_ins_ticket_idx ON public.event_check_ins (ticket_id);

ALTER TABLE public.event_check_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts can log check-ins"
  ON public.event_check_ins FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = scanned_by
    AND EXISTS (
      SELECT 1 FROM public.event_tickets t
      JOIN public.events e ON e.id = t.event_id
      WHERE t.id = event_check_ins.ticket_id
        AND e.host_id = auth.uid()
    )
  );

CREATE POLICY "Hosts and ticket holders can view check-ins"
  ON public.event_check_ins FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.event_tickets t
      WHERE t.id = event_check_ins.ticket_id
        AND (t.holder_id = auth.uid() OR public.is_event_host(auth.uid(), t.event_id))
    )
  );

-- ---------- storage bucket ----------
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-artifacts', 'event-artifacts', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Event hosts and attendees can read artifact files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'event-artifacts'
    AND (
      public.is_event_host(auth.uid(), (split_part(name, '/', 1))::uuid)
      OR public.has_event_ticket(auth.uid(), (split_part(name, '/', 1))::uuid)
    )
  );

CREATE POLICY "Hosts and checked-in attendees can upload artifact files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'event-artifacts'
    AND (
      public.is_event_host(auth.uid(), (split_part(name, '/', 1))::uuid)
      OR EXISTS (
        SELECT 1 FROM public.event_tickets t
        WHERE t.event_id = (split_part(name, '/', 1))::uuid
          AND t.holder_id = auth.uid()
          AND t.status = 'checked_in'
      )
    )
  );

CREATE POLICY "Hosts can delete artifact files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'event-artifacts'
    AND public.is_event_host(auth.uid(), (split_part(name, '/', 1))::uuid)
  );
