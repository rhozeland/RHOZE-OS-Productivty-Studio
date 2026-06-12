
-- Stage assignment helpers + cross-user notification helper

-- 1) Generic helper to notify any user (SECURITY DEFINER bypasses notifications RLS)
CREATE OR REPLACE FUNCTION public.notify_user(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text DEFAULT NULL,
  p_link text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  -- skip self-notifications (no value)
  IF p_user_id = auth.uid() THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (p_user_id, p_type, p_title, p_body, p_link)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_user(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_user(uuid, text, text, text, text) TO authenticated;


-- 2) Assign / reassign a roadmap stage. Lead artist (project owner/admin) only.
CREATE OR REPLACE FUNCTION public.assign_project_stage(
  p_goal_id uuid,
  p_assignee_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id uuid;
  v_project_title text;
  v_stage_title text;
  v_previous_assignee uuid;
  v_caller_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT g.project_id, g.title, g.assignee_id
    INTO v_project_id, v_stage_title, v_previous_assignee
  FROM public.project_goals g
  WHERE g.id = p_goal_id;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'stage not found';
  END IF;

  IF NOT public.can_manage_project(v_project_id, auth.uid()) THEN
    RAISE EXCEPTION 'only the lead artist can assign stages';
  END IF;

  -- Assignee (when provided) must be a project member or the owner
  IF p_assignee_id IS NOT NULL
     AND NOT public.is_project_member(v_project_id, p_assignee_id) THEN
    RAISE EXCEPTION 'assignee is not a project member';
  END IF;

  UPDATE public.project_goals
     SET assignee_id = p_assignee_id,
         updated_at  = now()
   WHERE id = p_goal_id;

  IF p_assignee_id IS NOT NULL AND p_assignee_id IS DISTINCT FROM v_previous_assignee THEN
    SELECT COALESCE(NULLIF(display_name, ''), NULLIF(username, ''), 'Lead artist')
      INTO v_caller_name
    FROM public.profiles WHERE user_id = auth.uid();

    SELECT title INTO v_project_title FROM public.projects WHERE id = v_project_id;

    PERFORM public.notify_user(
      p_assignee_id,
      'stage_assigned',
      COALESCE(v_caller_name, 'Lead artist') || ' assigned you to ' || v_stage_title,
      'on ' || COALESCE(v_project_title, 'a project'),
      '/projects/' || v_project_id::text
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_project_stage(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_project_stage(uuid, uuid) TO authenticated;


-- 3) Collaborator marks their assigned stage as completed → "In Review"; notify owner
CREATE OR REPLACE FUNCTION public.request_stage_review(
  p_goal_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id uuid;
  v_owner_id uuid;
  v_assignee uuid;
  v_stage_title text;
  v_project_title text;
  v_caller_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT g.project_id, g.title, g.assignee_id
    INTO v_project_id, v_stage_title, v_assignee
  FROM public.project_goals g
  WHERE g.id = p_goal_id;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'stage not found';
  END IF;

  IF NOT public.is_project_member(v_project_id, auth.uid()) THEN
    RAISE EXCEPTION 'not a project member';
  END IF;

  UPDATE public.project_goals
     SET status = 'in_review',
         updated_at = now()
   WHERE id = p_goal_id;

  SELECT user_id, title INTO v_owner_id, v_project_title
  FROM public.projects WHERE id = v_project_id;

  SELECT COALESCE(NULLIF(display_name, ''), NULLIF(username, ''), 'A collaborator')
    INTO v_caller_name
  FROM public.profiles WHERE user_id = auth.uid();

  PERFORM public.notify_user(
    v_owner_id,
    'stage_review_requested',
    COALESCE(v_caller_name, 'A collaborator') || ' has completed ' || v_stage_title,
    'Review and approve on ' || COALESCE(v_project_title, 'your project'),
    '/projects/' || v_project_id::text
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_stage_review(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_stage_review(uuid) TO authenticated;
