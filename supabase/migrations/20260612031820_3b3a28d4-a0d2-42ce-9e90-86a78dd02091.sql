
-- Lock flag on the project itself (one source of truth, no extra table needed)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS team_splits_locked_at timestamptz;

-- Team splits table: one row per project + team member
CREATE TABLE IF NOT EXISTS public.project_team_splits (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  pct         numeric NOT NULL DEFAULT 0 CHECK (pct >= 0 AND pct <= 100),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_team_splits_project ON public.project_team_splits(project_id);
CREATE INDEX IF NOT EXISTS idx_project_team_splits_user    ON public.project_team_splits(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_team_splits TO authenticated;
GRANT ALL ON public.project_team_splits TO service_role;

ALTER TABLE public.project_team_splits ENABLE ROW LEVEL SECURITY;

-- SELECT: owner/admin sees every row; each user sees only their own row
CREATE POLICY "Lead artist or self can view splits"
  ON public.project_team_splits
  FOR SELECT
  TO authenticated
  USING (
    public.can_manage_project(project_id, auth.uid())
    OR user_id = auth.uid()
  );

-- INSERT/UPDATE/DELETE: only the lead artist (owner/admin), only while unlocked
CREATE POLICY "Lead artist can insert splits"
  ON public.project_team_splits
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_manage_project(project_id, auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.team_splits_locked_at IS NOT NULL
    )
  );

CREATE POLICY "Lead artist can update splits"
  ON public.project_team_splits
  FOR UPDATE
  TO authenticated
  USING (
    public.can_manage_project(project_id, auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.team_splits_locked_at IS NOT NULL
    )
  )
  WITH CHECK (
    public.can_manage_project(project_id, auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.team_splits_locked_at IS NOT NULL
    )
  );

CREATE POLICY "Lead artist can delete splits"
  ON public.project_team_splits
  FOR DELETE
  TO authenticated
  USING (
    public.can_manage_project(project_id, auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.team_splits_locked_at IS NOT NULL
    )
  );

-- updated_at trigger
DROP TRIGGER IF EXISTS update_project_team_splits_updated_at ON public.project_team_splits;
CREATE TRIGGER update_project_team_splits_updated_at
  BEFORE UPDATE ON public.project_team_splits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Lock RPC: verify owner, verify total = 100, set lock, notify every team member
CREATE OR REPLACE FUNCTION public.lock_project_team_splits(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_already_locked timestamptz;
  v_project_title  text;
  v_owner_id       uuid;
  v_total          numeric;
  r                record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT user_id, title, team_splits_locked_at
    INTO v_owner_id, v_project_title, v_already_locked
  FROM public.projects WHERE id = p_project_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'project not found';
  END IF;

  IF NOT public.can_manage_project(p_project_id, auth.uid()) THEN
    RAISE EXCEPTION 'only the lead artist can lock splits';
  END IF;

  IF v_already_locked IS NOT NULL THEN
    RAISE EXCEPTION 'splits are already locked';
  END IF;

  SELECT COALESCE(SUM(pct), 0) INTO v_total
  FROM public.project_team_splits WHERE project_id = p_project_id;

  IF v_total <> 100 THEN
    RAISE EXCEPTION 'splits must total exactly 100%% (got %)', v_total;
  END IF;

  UPDATE public.projects
     SET team_splits_locked_at = now()
   WHERE id = p_project_id;

  FOR r IN
    SELECT user_id, pct FROM public.project_team_splits WHERE project_id = p_project_id
  LOOP
    PERFORM public.notify_user(
      r.user_id,
      'team_splits_locked',
      'Splits have been locked on ' || COALESCE(v_project_title, 'a project'),
      'Your share is ' || r.pct::text || '%',
      '/projects/' || p_project_id::text
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.lock_project_team_splits(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lock_project_team_splits(uuid) TO authenticated;
