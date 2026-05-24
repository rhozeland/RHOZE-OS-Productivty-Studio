
-- Concierge intake status enum
CREATE TYPE public.concierge_status AS ENUM (
  'new', 'reviewing', 'scoped', 'converted', 'declined', 'closed'
);

CREATE TYPE public.project_intake_tier AS ENUM (
  'self_serve', 'matched', 'concierge'
);

-- Concierge requests table
CREATE TABLE public.concierge_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  summary TEXT NOT NULL,
  outcome TEXT,
  budget_range TEXT,
  deadline DATE,
  category TEXT,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  status public.concierge_status NOT NULL DEFAULT 'new',
  scoped_by UUID,
  scoped_budget_cents BIGINT,
  scoped_team_ids UUID[] NOT NULL DEFAULT '{}',
  proposal_notes TEXT,
  converted_project_id UUID,
  contact_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_concierge_requests_client ON public.concierge_requests(client_id);
CREATE INDEX idx_concierge_requests_status ON public.concierge_requests(status);

ALTER TABLE public.concierge_requests ENABLE ROW LEVEL SECURITY;

-- Clients can see their own requests
CREATE POLICY "Clients view own concierge requests"
  ON public.concierge_requests FOR SELECT
  USING (auth.uid() = client_id);

-- Authenticated users can create a request for themselves
CREATE POLICY "Clients create own concierge requests"
  ON public.concierge_requests FOR INSERT
  WITH CHECK (auth.uid() = client_id);

-- Admins can view all
CREATE POLICY "Admins view all concierge requests"
  ON public.concierge_requests FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update all
CREATE POLICY "Admins update concierge requests"
  ON public.concierge_requests FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Timestamp trigger
CREATE TRIGGER update_concierge_requests_updated_at
  BEFORE UPDATE ON public.concierge_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Project columns to carry intake tier + curator + fee override
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS intake_tier public.project_intake_tier NOT NULL DEFAULT 'self_serve',
  ADD COLUMN IF NOT EXISTS curator_id UUID,
  ADD COLUMN IF NOT EXISTS platform_fee_bps_override INTEGER;

CREATE INDEX IF NOT EXISTS idx_projects_curator ON public.projects(curator_id);
