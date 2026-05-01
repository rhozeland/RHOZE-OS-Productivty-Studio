-- 1. Normalize legacy roles
UPDATE public.project_collaborators
SET role = CASE
  WHEN role IN ('admin') THEN 'admin'
  ELSE 'member'
END
WHERE role NOT IN ('admin', 'member');

ALTER TABLE public.project_collaborators
  ALTER COLUMN role SET DEFAULT 'member';

-- Constrain to the new role set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_collaborators_role_check'
  ) THEN
    ALTER TABLE public.project_collaborators
      ADD CONSTRAINT project_collaborators_role_check
      CHECK (role IN ('admin', 'member'));
  END IF;
END$$;

-- 2. Role helper (SECURITY DEFINER so it bypasses RLS recursion)
CREATE OR REPLACE FUNCTION public.project_member_role(_project_id uuid, _user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.projects p WHERE p.id = _project_id AND p.user_id = _user_id) THEN 'owner'
    ELSE (
      SELECT role FROM public.project_collaborators
      WHERE project_id = _project_id AND user_id = _user_id
      LIMIT 1
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.is_project_member(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.project_member_role(_project_id, _user_id) IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.can_manage_project(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.project_member_role(_project_id, _user_id) IN ('owner', 'admin')
$$;

-- 3. Projects policies — extend to team members
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
CREATE POLICY "Team can view project"
  ON public.projects
  FOR SELECT
  USING (public.is_project_member(id, auth.uid()));

DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
CREATE POLICY "Owner and admins can update project"
  ON public.projects
  FOR UPDATE
  USING (public.can_manage_project(id, auth.uid()))
  WITH CHECK (public.can_manage_project(id, auth.uid()));

-- DELETE stays owner-only (existing policy "Users can delete own projects")

-- 4. Project goals — team can view, owner+admin can edit
DROP POLICY IF EXISTS "Users can view own project goals" ON public.project_goals;
CREATE POLICY "Team can view goals"
  ON public.project_goals
  FOR SELECT
  USING (public.is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "Users can update own goals" ON public.project_goals;
CREATE POLICY "Owner and admins can update goals"
  ON public.project_goals
  FOR UPDATE
  USING (public.can_manage_project(project_id, auth.uid()))
  WITH CHECK (public.can_manage_project(project_id, auth.uid()));

DROP POLICY IF EXISTS "Users can delete own goals" ON public.project_goals;
CREATE POLICY "Owner and admins can delete goals"
  ON public.project_goals
  FOR DELETE
  USING (public.can_manage_project(project_id, auth.uid()));

DROP POLICY IF EXISTS "Users can create goals" ON public.project_goals;
CREATE POLICY "Owner and admins can create goals"
  ON public.project_goals
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.can_manage_project(project_id, auth.uid())
  );

-- 5. Moodboard items — team can view, owner+admin can upload, anyone on team can edit own
DROP POLICY IF EXISTS "Users can view own moodboard items" ON public.moodboard_items;
CREATE POLICY "Team can view moodboard"
  ON public.moodboard_items
  FOR SELECT
  USING (public.is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "Users can insert moodboard items" ON public.moodboard_items;
CREATE POLICY "Owner and admins can add moodboard items"
  ON public.moodboard_items
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.can_manage_project(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can update own moodboard items" ON public.moodboard_items;
CREATE POLICY "Editors can update moodboard items"
  ON public.moodboard_items
  FOR UPDATE
  USING (
    auth.uid() = user_id
    OR public.can_manage_project(project_id, auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    OR public.can_manage_project(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete own moodboard items" ON public.moodboard_items;
CREATE POLICY "Editors can delete moodboard items"
  ON public.moodboard_items
  FOR DELETE
  USING (
    auth.uid() = user_id
    OR public.can_manage_project(project_id, auth.uid())
  );

-- 6. Collaborators — team can view roster; owner+admin manage; only owner can promote to admin
DROP POLICY IF EXISTS "Collaborators can view membership" ON public.project_collaborators;
CREATE POLICY "Team can view roster"
  ON public.project_collaborators
  FOR SELECT
  USING (public.is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "Project owners can manage collaborators" ON public.project_collaborators;

CREATE POLICY "Owner and admins can invite members"
  ON public.project_collaborators
  FOR INSERT
  WITH CHECK (
    auth.uid() = invited_by
    AND public.can_manage_project(project_id, auth.uid())
    -- Only the owner can grant admin role
    AND (
      role = 'member'
      OR public.project_member_role(project_id, auth.uid()) = 'owner'
    )
  );

CREATE POLICY "Owner and admins can update memberships"
  ON public.project_collaborators
  FOR UPDATE
  USING (public.can_manage_project(project_id, auth.uid()))
  WITH CHECK (
    public.can_manage_project(project_id, auth.uid())
    AND (
      role = 'member'
      OR public.project_member_role(project_id, auth.uid()) = 'owner'
    )
  );

CREATE POLICY "Owner and admins can remove members"
  ON public.project_collaborators
  FOR DELETE
  USING (
    public.can_manage_project(project_id, auth.uid())
    -- A member can also remove themselves
    OR auth.uid() = user_id
  );