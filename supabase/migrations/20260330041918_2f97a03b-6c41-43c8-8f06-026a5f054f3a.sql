
-- Add goal_id to project_approvals for per-stage approval
ALTER TABLE public.project_approvals 
  ADD COLUMN goal_id uuid REFERENCES public.project_goals(id) ON DELETE CASCADE;

-- Create index for efficient lookups
CREATE INDEX idx_project_approvals_goal_id ON public.project_approvals(goal_id) WHERE goal_id IS NOT NULL;

-- Update RLS: allow collaborators to view stage approvals
CREATE POLICY "Collaborators can view stage approvals"
ON public.project_approvals
FOR SELECT
TO authenticated
USING (
  goal_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.project_goals pg
    JOIN public.project_collaborators pc ON pc.project_id = pg.project_id
    WHERE pg.id = project_approvals.goal_id AND pc.user_id = auth.uid()
  )
);
