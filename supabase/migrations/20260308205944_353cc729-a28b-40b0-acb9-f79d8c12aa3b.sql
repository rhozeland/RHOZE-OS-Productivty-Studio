
-- Project goals/milestones table
CREATE TABLE public.project_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'medium',
  due_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  progress INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.project_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own project goals" ON public.project_goals
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can create goals" ON public.project_goals
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals" ON public.project_goals
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals" ON public.project_goals
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Project collaborators table
CREATE TABLE public.project_collaborators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  invited_by UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.project_collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project owners can manage collaborators" ON public.project_collaborators
  FOR ALL TO authenticated USING (
    auth.uid() = invited_by OR auth.uid() = user_id
  ) WITH CHECK (auth.uid() = invited_by);

CREATE POLICY "Collaborators can view membership" ON public.project_collaborators
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR auth.uid() = invited_by);
