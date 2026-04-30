-- ─── Status enum ────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.capital_advance_status AS ENUM (
    'submitted',
    'under_review',
    'approved',
    'funded',
    'rejected',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Requests table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.capital_advance_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  requested_amount NUMERIC NOT NULL CHECK (requested_amount > 0),
  funded_amount NUMERIC,
  status public.capital_advance_status NOT NULL DEFAULT 'submitted',
  collateral_score INTEGER,
  signal_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  applicant_note TEXT,
  admin_note TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  funded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS capital_advance_requests_user_idx
  ON public.capital_advance_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS capital_advance_requests_status_idx
  ON public.capital_advance_requests(status);

ALTER TABLE public.capital_advance_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own advance requests"
  ON public.capital_advance_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all advance requests"
  ON public.capital_advance_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can create own advance requests"
  ON public.capital_advance_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'submitted');

CREATE POLICY "Users can cancel own pending requests"
  ON public.capital_advance_requests FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    AND status IN ('submitted', 'under_review')
  )
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'cancelled'
  );

CREATE POLICY "Admins can update advance requests"
  ON public.capital_advance_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_capital_advance_requests_updated_at
  BEFORE UPDATE ON public.capital_advance_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── Audit trail ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.capital_advance_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.capital_advance_requests(id) ON DELETE CASCADE,
  actor_id UUID,
  event_type TEXT NOT NULL,
  from_status public.capital_advance_status,
  to_status public.capital_advance_status,
  note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS capital_advance_events_request_idx
  ON public.capital_advance_events(request_id, created_at);

ALTER TABLE public.capital_advance_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view events on own requests"
  ON public.capital_advance_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.capital_advance_requests r
      WHERE r.id = capital_advance_events.request_id
        AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all events"
  ON public.capital_advance_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can log own submission/cancel events"
  ON public.capital_advance_events FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = actor_id
    AND EXISTS (
      SELECT 1 FROM public.capital_advance_requests r
      WHERE r.id = capital_advance_events.request_id
        AND r.user_id = auth.uid()
    )
    AND event_type IN ('submitted', 'cancelled', 'note_added')
  );

CREATE POLICY "Admins can log any events"
  ON public.capital_advance_events FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ─── Auto-log status changes ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_capital_advance_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.capital_advance_events (
      request_id, actor_id, event_type, from_status, to_status, note
    ) VALUES (
      NEW.id,
      COALESCE(NEW.reviewed_by, auth.uid()),
      'status_change',
      OLD.status,
      NEW.status,
      NEW.admin_note
    );

    -- Notify the creator of any status change.
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      NEW.user_id,
      'capital_advance',
      'Capital advance: ' || REPLACE(NEW.status::text, '_', ' '),
      CASE
        WHEN NEW.status = 'funded' THEN 'Your advance has been funded' ||
          COALESCE(' ($' || NEW.funded_amount::text || ')', '') || '. Check your wallet.'
        WHEN NEW.status = 'approved' THEN 'Approved! Funding will be initiated shortly.'
        WHEN NEW.status = 'under_review' THEN 'Our team is reviewing your collateral signal.'
        WHEN NEW.status = 'rejected' THEN COALESCE(NEW.admin_note, 'See your dashboard for details.')
        WHEN NEW.status = 'cancelled' THEN 'Your request was cancelled.'
        ELSE 'Status updated.'
      END,
      '/seller'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_capital_advance_status_change
  AFTER UPDATE ON public.capital_advance_requests
  FOR EACH ROW EXECUTE FUNCTION public.log_capital_advance_status_change();

-- ─── Initial submission event ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_capital_advance_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.capital_advance_events (
    request_id, actor_id, event_type, to_status, note, metadata
  ) VALUES (
    NEW.id,
    NEW.user_id,
    'submitted',
    NEW.status,
    NEW.applicant_note,
    jsonb_build_object(
      'requested_amount', NEW.requested_amount,
      'collateral_score', NEW.collateral_score
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_capital_advance_submission
  AFTER INSERT ON public.capital_advance_requests
  FOR EACH ROW EXECUTE FUNCTION public.log_capital_advance_submission();