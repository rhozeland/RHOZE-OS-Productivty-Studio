
-- Verification requests table
CREATE TABLE public.work_verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  applicant_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  applicant_note text,
  supporting_urls text[] NOT NULL DEFAULT '{}',
  reviewer_id uuid,
  review_note text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_verification_requests_status_check
    CHECK (status IN ('pending','approved','rejected','changes_requested','cancelled'))
);

CREATE INDEX idx_wvr_work ON public.work_verification_requests(work_id);
CREATE INDEX idx_wvr_applicant ON public.work_verification_requests(applicant_id);
CREATE INDEX idx_wvr_status ON public.work_verification_requests(status);
-- One open request per work at a time
CREATE UNIQUE INDEX idx_wvr_one_open_per_work
  ON public.work_verification_requests(work_id)
  WHERE status IN ('pending','changes_requested');

ALTER TABLE public.work_verification_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Applicants view own verification requests"
  ON public.work_verification_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = applicant_id);

CREATE POLICY "Admins view all verification requests"
  ON public.work_verification_requests FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Applicants create their own verification requests"
  ON public.work_verification_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = applicant_id);

CREATE POLICY "Admins update verification requests"
  ON public.work_verification_requests FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Applicants can cancel their own pending requests"
  ON public.work_verification_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = applicant_id AND status IN ('pending','changes_requested'))
  WITH CHECK (auth.uid() = applicant_id);

CREATE TRIGGER update_wvr_updated_at
  BEFORE UPDATE ON public.work_verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Submit a verification request (creator action)
CREATE OR REPLACE FUNCTION public.submit_work_verification(
  _work_id uuid,
  _applicant_note text DEFAULT NULL,
  _supporting_urls text[] DEFAULT '{}'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_request_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT user_id INTO v_owner FROM public.works WHERE id = _work_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Work not found';
  END IF;
  IF v_owner != auth.uid() THEN
    RAISE EXCEPTION 'Only the owner can submit this work for verification';
  END IF;

  -- Reject if already verified
  IF EXISTS (SELECT 1 FROM public.works WHERE id = _work_id AND solana_signature IS NOT NULL) THEN
    RAISE EXCEPTION 'This work is already verified';
  END IF;

  INSERT INTO public.work_verification_requests
    (work_id, applicant_id, applicant_note, supporting_urls, status)
  VALUES
    (_work_id, auth.uid(), _applicant_note, COALESCE(_supporting_urls, '{}'), 'pending')
  RETURNING id INTO v_request_id;

  -- Reflect "pending review" on any linked Flow item(s)
  UPDATE public.flow_items
    SET verification_status = 'pending'
    WHERE work_id = _work_id AND user_id = auth.uid();

  RETURN v_request_id;
END;
$$;

-- Approve a verification request (admin action). Caller is expected to first
-- anchor the Work via the anchor edge function and pass the resulting signature.
CREATE OR REPLACE FUNCTION public.approve_work_verification(
  _request_id uuid,
  _solana_signature text,
  _review_note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  SELECT * INTO v_request FROM public.work_verification_requests
    WHERE id = _request_id FOR UPDATE;
  IF v_request IS NULL THEN
    RAISE EXCEPTION 'Verification request not found';
  END IF;
  IF v_request.status NOT IN ('pending','changes_requested') THEN
    RAISE EXCEPTION 'Request is not open';
  END IF;
  IF _solana_signature IS NULL OR length(_solana_signature) < 10 THEN
    RAISE EXCEPTION 'A valid Solana signature is required to approve';
  END IF;

  -- Mark Work as anchored
  UPDATE public.works
    SET solana_signature = _solana_signature,
        anchored_at = now(),
        updated_at = now()
    WHERE id = v_request.work_id;

  -- Reflect on linked Flow items
  UPDATE public.flow_items
    SET verification_status = 'verified',
        solana_signature = _solana_signature,
        anchored_at = now()
    WHERE work_id = v_request.work_id;

  UPDATE public.work_verification_requests
    SET status = 'approved',
        reviewer_id = auth.uid(),
        review_note = _review_note,
        decided_at = now(),
        updated_at = now()
    WHERE id = _request_id;

  -- Notify creator
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    v_request.applicant_id,
    'verification_approved',
    'Your work was verified',
    'It now carries the Verified IP badge and is anchored on Solana.',
    '/works'
  );
END;
$$;

-- Reject or request changes (admin action)
CREATE OR REPLACE FUNCTION public.reject_work_verification(
  _request_id uuid,
  _review_note text,
  _changes_requested boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request record;
  v_new_status text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  SELECT * INTO v_request FROM public.work_verification_requests
    WHERE id = _request_id FOR UPDATE;
  IF v_request IS NULL THEN
    RAISE EXCEPTION 'Verification request not found';
  END IF;
  IF v_request.status NOT IN ('pending','changes_requested') THEN
    RAISE EXCEPTION 'Request is not open';
  END IF;

  v_new_status := CASE WHEN _changes_requested THEN 'changes_requested' ELSE 'rejected' END;

  UPDATE public.work_verification_requests
    SET status = v_new_status,
        reviewer_id = auth.uid(),
        review_note = _review_note,
        decided_at = now(),
        updated_at = now()
    WHERE id = _request_id;

  -- Reflect on linked Flow items
  UPDATE public.flow_items
    SET verification_status = v_new_status
    WHERE work_id = v_request.work_id;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    v_request.applicant_id,
    'verification_' || v_new_status,
    CASE WHEN _changes_requested
      THEN 'Verification: changes requested'
      ELSE 'Verification request declined' END,
    COALESCE(_review_note, 'See your dashboard for details.'),
    '/works'
  );
END;
$$;
