
-- Project approvals / digital sign-off
CREATE TABLE public.project_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'client',
  printed_name text NOT NULL,
  signed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

ALTER TABLE public.project_approvals ENABLE ROW LEVEL SECURITY;

-- Project owner can view all approvals
CREATE POLICY "Project owners can view approvals"
  ON public.project_approvals FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects WHERE id = project_approvals.project_id AND user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.project_collaborators WHERE project_id = project_approvals.project_id AND user_id = auth.uid()
    )
    OR auth.uid() = project_approvals.user_id
  );

-- Users can sign (insert their own approval)
CREATE POLICY "Users can sign approvals"
  ON public.project_approvals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can remove their own approval
CREATE POLICY "Users can revoke own approval"
  ON public.project_approvals FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
