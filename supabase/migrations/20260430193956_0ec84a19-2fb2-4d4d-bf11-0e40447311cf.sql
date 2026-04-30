-- Phase 3: bind Works to Listings, Projects, Contracts, and Revenue Splits.

-- 1) work_attachments — many-to-many between works and any "target" entity.
CREATE TABLE public.work_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  work_id UUID NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('listing', 'project', 'contract')),
  target_id UUID NOT NULL,
  attached_by UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'reference',
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (work_id, target_type, target_id)
);

CREATE INDEX idx_work_attachments_work ON public.work_attachments(work_id);
CREATE INDEX idx_work_attachments_target ON public.work_attachments(target_type, target_id);

ALTER TABLE public.work_attachments ENABLE ROW LEVEL SECURITY;

-- View: you can see an attachment if you own the work, OR the work is public.
-- (Target-side access is enforced by the target table's own RLS at read time.)
CREATE POLICY "View attachments for accessible works"
  ON public.work_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.works w
      WHERE w.id = work_attachments.work_id
        AND (w.user_id = auth.uid() OR w.visibility = 'public')
    )
  );

-- Insert: only the owner of the work may attach it anywhere.
CREATE POLICY "Owners attach their own works"
  ON public.work_attachments FOR INSERT
  WITH CHECK (
    auth.uid() = attached_by
    AND EXISTS (
      SELECT 1 FROM public.works w
      WHERE w.id = work_attachments.work_id
        AND w.user_id = auth.uid()
    )
  );

-- Delete: only the owner of the work may detach.
CREATE POLICY "Owners detach their own works"
  ON public.work_attachments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.works w
      WHERE w.id = work_attachments.work_id
        AND w.user_id = auth.uid()
    )
  );

-- 2) Add work_id to revenue_split_configs so a split is bound to a specific IP.
ALTER TABLE public.revenue_split_configs
  ADD COLUMN work_id UUID REFERENCES public.works(id) ON DELETE SET NULL;

CREATE INDEX idx_revenue_split_configs_work ON public.revenue_split_configs(work_id);